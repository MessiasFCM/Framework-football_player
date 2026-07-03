from __future__ import annotations

import argparse
import csv
import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_CSV = PROJECT_ROOT / "data" / "processed" / "players_processed.csv"
OUT_JSON = PROJECT_ROOT / "outputs" / "results" / "similar_players_style_top5_10_20.json"

PER90_COLUMNS = ["Gls.1", "Ast.1", "xG.1", "xAG.1", "npxG.1"]
PER90_DERIVED = ["PrgC", "PrgP", "PrgR"]
FEATURE_NAMES = PER90_COLUMNS + [f"{c}_p90" for c in PER90_DERIVED]
K_LIST = [5, 10, 20]
MAX_K = max(K_LIST)


def to_float(value: str) -> float:
    try:
        return float(str(value).replace(",", "").strip())
    except (ValueError, AttributeError):
        return 0.0


def parse_positions(pos: str) -> list[str]:
    return [tok.strip() for tok in str(pos).split(",") if tok.strip()]


def main() -> None:
    ap = argparse.ArgumentParser(description="Similares por estilo (por-90 + posicao).")
    ap.add_argument("--min-90s", type=float, default=5.0, help="minimo de 90s jogados p/ entrar (padrao 5)")
    ap.add_argument("--no-position-filter", action="store_true", help="nao filtra por posicao")
    args = ap.parse_args()

    with SRC_CSV.open(encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
    n = len(rows)

    need = PER90_COLUMNS + PER90_DERIVED + ["90s"]
    missing = [c for c in need if c not in rows[0]]
    if missing:
        raise SystemExit(f"Colunas ausentes no CSV: {missing}")

    nineties = np.array([to_float(r["90s"]) for r in rows], dtype=np.float64)

    feats = []
    for r in rows:
        base = [to_float(r[c]) for c in PER90_COLUMNS]
        n90 = to_float(r["90s"])
        derived = [(to_float(r[c]) / n90 if n90 > 0 else 0.0) for c in PER90_DERIVED]
        feats.append(base + derived)
    X = np.nan_to_num(np.array(feats, dtype=np.float64), nan=0.0, posinf=0.0, neginf=0.0)

    qual_mask = nineties >= args.min_90s
    qual_idx = np.flatnonzero(qual_mask)
    m = len(qual_idx)
    print(f"Total: {n} | qualificados (>= {args.min_90s} 90s): {m}")
    if m < 2:
        raise SystemExit("Pool qualificado pequeno demais; baixe --min-90s.")

    mean = X[qual_idx].mean(axis=0)
    std = X[qual_idx].std(axis=0)
    std[std == 0] = 1.0
    Xq = (X[qual_idx] - mean) / std  

    primary = []
    cand_by_token: dict[str, list[int]] = defaultdict(list)
    for qi, orig in enumerate(qual_idx):
        positions = parse_positions(rows[orig]["Pos"]) or ["?"]
        primary.append(positions[0])
        if args.no_position_filter:
            cand_by_token["__all__"].append(qi)
        else:
            for tok in set(positions):
                cand_by_token[tok].append(qi)
    cand_arr = {tok: np.array(idxs, dtype=np.int64) for tok, idxs in cand_by_token.items()}

    def neighbor_obj(orig_idx: int, dist: float) -> dict:
        r = rows[orig_idx]
        return {
            "rk": int(r["Rk"]), "player": r["Player"], "squad": r["Squad"],
            "pos": r["Pos"], "distance": round(float(dist), 4),
        }

    players = []
    for qi in range(m):
        token = "__all__" if args.no_position_filter else primary[qi]
        cands = cand_arr.get(token, np.array([qi], dtype=np.int64))
        diff = Xq[cands] - Xq[qi]
        dist = np.sqrt(np.maximum((diff ** 2).sum(axis=1), 0.0))
        keep = cands != qi  
        cands, dist = cands[keep], dist[keep]
        k = min(MAX_K, len(cands))
        if k > 0:
            sel = np.argpartition(dist, k - 1)[:k]
            sel = sel[np.argsort(dist[sel])]
            nbrs = [neighbor_obj(int(qual_idx[cands[s]]), dist[s]) for s in sel]
        else:
            nbrs = []

        r = rows[qual_idx[qi]]
        entry = {
            "rk": int(r["Rk"]), "player": r["Player"], "squad": r["Squad"],
            "pos": r["Pos"], "nation": r["Nation"], "played_90s": round(float(nineties[qual_idx[qi]]), 1),
        }
        for kk in K_LIST:
            entry[f"top_{kk}"] = nbrs[:kk]
        players.append(entry)
        if (qi + 1) % 500 == 0:
            print(f"  {qi + 1}/{m}", end="\r")
    print()

    payload = {
        "meta": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "n_players_total": n,
            "n_players_included": m,
            "min_90s": args.min_90s,
            "position_filter": not args.no_position_filter,
            "k_list": K_LIST,
            "metric": "euclidean",
            "standardization": "zscore (pool qualificado)",
            "feature_columns": FEATURE_NAMES,
            "source": str(SRC_CSV.relative_to(PROJECT_ROOT)),
        },
        "players": players,
    }

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    with OUT_JSON.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=1)
    print(f"OK -> {OUT_JSON} ({OUT_JSON.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
