from __future__ import annotations

from pathlib import Path

import pandas as pd

PROJECT_ROOT = Path("/home/andrelima/Projetos/Framework-football_player")
ROOT = PROJECT_ROOT / "preprocess"
INPUT_XLSX = PROJECT_ROOT / "data" / "raw" / "All_Leagues_Data.xlsx"
OUTPUT_CSV = ROOT / "output" / "tags_rules.csv"

SHEET = "AllCompDataset"
MIN_90S = 0  
ROLES: dict[str, dict[str, dict[str, float]]] = {
    "DF": {
        "zagueiro_classico":  {"Min": 1.0, "PrgC": -1.0, "PrgP": -0.5, "Ast": -0.5},
        "zagueiro_construtor": {"PrgP": 1.5, "PrgC": 1.0},
        "lateral_ofensivo":   {"PrgR": 1.0, "Ast": 1.0, "xAG": 1.0},
    },
    "MF": {
        "volante_defensivo": {"Min": 1.0, "CrdY": 0.5, "Gls.1": -1.0,
                              "xG.1": -1.0, "Ast.1": -0.5},
        "box_to_box":        {"PrgP": 1.0, "PrgC": 1.0, "G+A.1": 0.5},
        "meia_criativo":     {"xAG.1": 1.5, "Ast.1": 1.5, "PrgP": 0.5},
    },
    "FW": {
        "centroavante_goleador": {"Gls.1": 1.5, "npxG.1": 1.0,
                                  "Ast.1": -0.5, "PrgC": -0.3},
        "ponta_dribllador":      {"PrgC": 1.5, "PrgR": 1.0, "Ast.1": 0.5},
        "segundo_atacante":      {"xAG.1": 1.0, "Ast.1": 1.0, "G+A.1": 0.5},
    },
    "GK": {
        "goleiro_titular": {"Min": 1.0},
        "goleiro_reserva": {"Min": -1.0},
        "goleiro_joia":    {"Age": -1.5, "Min": 0.3},
    },
}


def primary_pos(pos: object) -> str:
    return str(pos).split(",")[0].strip()


def clean_minutes(series: pd.Series) -> pd.Series:
    return pd.to_numeric(
        series.astype(str).str.replace(",", "", regex=False),
        errors="coerce",
    ).fillna(0).astype(int)


def assign_tags(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["Min"] = clean_minutes(df["Min"])
    df["primary_pos"] = df["Pos"].apply(primary_pos)
    df["tag"] = pd.NA

    mask_enough = df["90s"] >= MIN_90S

    for pos, roles in ROLES.items():
        sub_idx = df.index[mask_enough & (df["primary_pos"] == pos)]
        if len(sub_idx) == 0:
            continue

        cols = sorted({c for weights in roles.values() for c in weights})
        Z = df.loc[sub_idx, cols].apply(pd.to_numeric, errors="coerce").fillna(0)
        std = Z.std(ddof=0).replace(0, 1)
        Z = (Z - Z.mean()) / std

        scores = pd.DataFrame(index=sub_idx)
        for role, weights in roles.items():
            scores[role] = sum(Z[c] * w for c, w in weights.items())

        df.loc[sub_idx, "tag"] = scores.idxmax(axis=1)

    df["tag"] = df["tag"].fillna("insuficiente")
    return df


def main() -> None:
    if not INPUT_XLSX.exists():
        raise FileNotFoundError(
            f"Excel não encontrado em {INPUT_XLSX}. "
            "Verifique o caminho ou coloque o arquivo lá."
        )

    df = pd.read_excel(INPUT_XLSX, sheet_name=SHEET)
    tagged = assign_tags(df)

    OUTPUT_CSV.parent.mkdir(parents=True, exist_ok=True)

    output = pd.DataFrame({
        "rk": tagged["Rk"].astype(int),
        "player": tagged["Player"],
        "squad": tagged["Squad"],
        "nation": tagged["Nation"],
        "pos": tagged["Pos"],
        "primary_pos": tagged["primary_pos"],
        "age": tagged["Age"].astype(int),
        "ninetys": tagged["90s"].astype(float),
        "tag": tagged["tag"],
    })
    output.to_csv(OUTPUT_CSV, index=False)

    print(f"[tags] salvas em {OUTPUT_CSV}")
    print(f"[tags] total: {len(output)}")
    print("[tags] distribuição:")
    print(output["tag"].value_counts().to_string())


if __name__ == "__main__":
    main()
