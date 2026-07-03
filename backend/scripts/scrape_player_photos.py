from __future__ import annotations

import argparse
import csv
import re
import sys
import time
import unicodedata
from pathlib import Path

import requests

PROJECT_ROOT = Path(__file__).resolve().parents[1]
INPUT_CSV = PROJECT_ROOT / "data" / "processed" / "players_processed.csv"
OUT_DIR = PROJECT_ROOT / "data" / "processed" / "photos"
MANIFEST = OUT_DIR / "_manifest.csv"

WIKI_API = "https://en.wikipedia.org/w/api.php"
USER_AGENT = (
    "FootballPlayerFramework/1.0 (academic research; andrechalima@gmail.com)"
)
MANIFEST_FIELDS = ["rk", "player", "squad", "status", "page_title", "description", "image_url", "file"]


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    text = re.sub(r"[^a-zA-Z0-9]+", "_", text).strip("_").lower()
    return text or "player"


def load_players() -> list[dict]:
    with INPUT_CSV.open("r", encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def load_manifest() -> dict[str, dict]:
    if not MANIFEST.exists():
        return {}
    with MANIFEST.open("r", encoding="utf-8", newline="") as f:
        return {row["rk"]: row for row in csv.DictReader(f)}


def save_manifest(rows: dict[str, dict]) -> None:
    ordered = sorted(rows.values(), key=lambda r: int(r["rk"]))
    with MANIFEST.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=MANIFEST_FIELDS)
        w.writeheader()
        w.writerows(ordered)


def wiki_lookup(session: requests.Session, name: str, size: int) -> dict:
    params = {
        "action": "query",
        "format": "json",
        "generator": "search",
        "gsrsearch": f"{name} footballer",
        "gsrlimit": 1,
        "prop": "pageimages|description",
        "piprop": "thumbnail|original",
        "pithumbsize": size,
        "redirects": 1,
    }
    r = session.get(WIKI_API, params=params, timeout=30)
    r.raise_for_status()
    pages = (r.json().get("query") or {}).get("pages") or {}
    if not pages:
        return {"page_title": None, "description": None, "image_url": None}
    page = next(iter(pages.values()))
    thumb = (page.get("thumbnail") or {}).get("source")
    original = (page.get("original") or {}).get("source")
    return {
        "page_title": page.get("title"),
        "description": page.get("description"),
        "image_url": thumb or original,
    }


def download_image(session: requests.Session, url: str, dest_no_ext: Path) -> Path:
    ext = Path(url.split("?")[0]).suffix.lower() or ".jpg"
    if ext == ".svg":  
        raise ValueError("imagem é SVG, ignorando")
    dest = dest_no_ext.with_suffix(ext)
    with session.get(url, timeout=60, stream=True) as resp:
        resp.raise_for_status()
        with dest.open("wb") as f:
            for chunk in resp.iter_content(8192):
                f.write(chunk)
    return dest


def main() -> None:
    ap = argparse.ArgumentParser(description="Baixa fotos dos jogadores via Wikipedia.")
    ap.add_argument("--limit", type=int, default=0, help="processa só os N primeiros pendentes (0 = todos)")
    ap.add_argument("--size", type=int, default=500, help="largura máx. da miniatura em px")
    ap.add_argument("--sleep", type=float, default=0.2, help="pausa entre jogadores (s)")
    ap.add_argument("--redo-failed", action="store_true", help="tenta de novo quem não está 'ok'")
    ap.add_argument("--no-download", action="store_true", help="não baixa a imagem, só registra a URL no manifesto (mais rápido)")
    args = ap.parse_args()

    if not INPUT_CSV.exists():
        sys.exit(f"CSV não encontrado: {INPUT_CSV}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    players = load_players()
    manifest = load_manifest()

    def is_done(rk: str) -> bool:
        row = manifest.get(rk)
        if not row:
            return False
        if args.redo_failed:
            return row["status"] == "ok"
        return True

    pending = [p for p in players if not is_done(p["Rk"])]
    if args.limit:
        pending = pending[: args.limit]

    print(f"Total: {len(players)} | já no manifesto: {len(manifest)} | a processar: {len(pending)}")

    session = requests.Session()
    session.headers["User-Agent"] = USER_AGENT

    stats = {"ok": 0, "no_photo": 0, "no_page": 0, "download_error": 0}
    t0 = time.time()
    try:
        for i, p in enumerate(pending, 1):
            rk, name, squad = p["Rk"], p["Player"], p["Squad"]
            status = page_title = description = image_url = file_path = ""
            try:
                info = wiki_lookup(session, name, args.size)
                page_title = info["page_title"] or ""
                description = info["description"] or ""
                image_url = info["image_url"] or ""
                if not page_title:
                    status = "no_page"
                elif not image_url:
                    status = "no_photo"
                elif args.no_download:
                    status = "ok"  
                else:
                    dest = download_image(session, image_url, OUT_DIR / f"{rk}_{slugify(name)}")
                    file_path = dest.name
                    status = "ok"
            except requests.HTTPError as e:
                code = e.response.status_code if e.response is not None else "?"
                if code == 429:  
                    time.sleep(5)
                status = "download_error"
            except Exception:
                status = "download_error"

            stats[status] = stats.get(status, 0) + 1
            manifest[rk] = {
                "rk": rk, "player": name, "squad": squad, "status": status,
                "page_title": page_title, "description": description,
                "image_url": image_url, "file": file_path,
            }

            if i % 25 == 0 or i == len(pending):
                save_manifest(manifest)
                done_pct = 100 * i / len(pending)
                print(f"  [{i}/{len(pending)} {done_pct:4.0f}%] {name[:28]:28s} -> {status}")
            time.sleep(args.sleep)
    except KeyboardInterrupt:
        print("\nInterrompido — salvando progresso...")
    finally:
        save_manifest(manifest)

    dt = time.time() - t0
    print(f"\nConcluído em {dt:.0f}s. Resumo desta rodada: {stats}")
    print(f"Imagens em: {OUT_DIR}")
    print(f"Manifesto:  {MANIFEST}")


if __name__ == "__main__":
    main()
