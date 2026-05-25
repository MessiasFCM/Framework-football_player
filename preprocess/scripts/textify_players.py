from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import pandas as pd
from llama_cpp import Llama
from tqdm import tqdm

PROJECT_ROOT = Path("/home/andrelima/Projetos/Framework-football_player")
ROOT = PROJECT_ROOT / "preprocess"
INPUT_XLSX = PROJECT_ROOT / "data" / "raw" / "All_Leagues_Data.xlsx"
OUTPUT_JSONL = ROOT / "output" / "players_text.jsonl"

MODEL_PATH = ROOT / "models" / "Llama-3.2-3B-Instruct-Q4_K_M.gguf"

SHEET = "AllCompDataset"   
N_CTX = 2048
MAX_TOKENS = 180
TEMPERATURE = 0.3

SYSTEM_PROMPT = (
    "Você é um analista de futebol. A partir de estatísticas de um jogador, "
    "escreva uma descrição curta (3 a 4 frases) em português, factual e objetiva. "
    "Mencione posição, clube, nacionalidade, perfil ofensivo/defensivo e os números "
    "mais relevantes. Não invente dados que não estão presentes."
)


def build_user_prompt(row: pd.Series) -> str:
    return (
        f"Jogador: {row['Player']}\n"
        f"Nacionalidade: {row['Nation']}\n"
        f"Posição: {row['Pos']}\n"
        f"Clube: {row['Squad']}\n"
        f"Idade: {row['Age']} (nascido em {row['Born']})\n"
        f"Partidas: {row['MP']} | Titular: {row['Starts']} | Minutos: {row['Min']} | 90s: {row['90s']}\n"
        f"Gols: {row['Gls']} (sem pênaltis: {row['G-PK']}, pênaltis: {row['PK']}/{row['PKatt']})\n"
        f"Assistências: {row['Ast']} | G+A: {row['G+A']}\n"
        f"xG: {row['xG']} | npxG: {row['npxG']} | xAG: {row['xAG']} | npxG+xAG: {row['npxG+xAG']}\n"
        f"Conduções progressivas: {row['PrgC']} | Passes progressivos: {row['PrgP']} | "
        f"Recepções progressivas: {row['PrgR']}\n"
        f"Cartões: {row['CrdY']} amarelos, {row['CrdR']} vermelhos\n"
        f"Por 90 min — Gols: {row['Gls.1']} | Assist: {row['Ast.1']} | "
        f"xG: {row['xG.1']} | xAG: {row['xAG.1']}\n"
        "\nEscreva agora a descrição:"
    )

def load_dataframe() -> pd.DataFrame:
    df = pd.read_excel(INPUT_XLSX, sheet_name=SHEET)
    df["Min"] = (
        df["Min"].astype(str).str.replace(",", "", regex=False).str.strip()
    )
    df["Min"] = pd.to_numeric(df["Min"], errors="coerce").fillna(0).astype(int)
    return df


def already_done(path: Path) -> set[int]:
    if not path.exists():
        return set()
    done = set()
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            try:
                done.add(int(json.loads(line)["rk"]))
            except (json.JSONDecodeError, KeyError, ValueError):
                continue
    return done


def main() -> None:
    if not MODEL_PATH.exists():
        sys.exit(f"Modelo não encontrado em {MODEL_PATH}. Faça o download primeiro.")

    df = load_dataframe()
    done = already_done(OUTPUT_JSONL)
    pending = df[~df["Rk"].isin(done)]
    print(f"Total: {len(df)} | já feitos: {len(done)} | pendentes: {len(pending)}")

    llm = Llama(
        model_path=str(MODEL_PATH),
        n_ctx=N_CTX,
        n_gpu_layers=-1,   
        verbose=False,
    )

    OUTPUT_JSONL.parent.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    with OUTPUT_JSONL.open("a", encoding="utf-8") as out:
        for _, row in tqdm(pending.iterrows(), total=len(pending), desc="textificando"):
            user_prompt = build_user_prompt(row)
            try:
                resp = llm.create_chat_completion(
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt},
                    ],
                    max_tokens=MAX_TOKENS,
                    temperature=TEMPERATURE,
                )
                text = resp["choices"][0]["message"]["content"].strip()
            except Exception as e:
                text = f"[ERRO: {e}]"

            record = {
                "rk": int(row["Rk"]),
                "player": row["Player"],
                "squad": row["Squad"],
                "pos": row["Pos"],
                "nation": row["Nation"],
                "text": text,
            }
            out.write(json.dumps(record, ensure_ascii=False) + "\n")
            out.flush()  

    print(f"Pronto. Gerados {len(pending)} registros em {time.time() - t0:.0f}s.")
    print(f"Saída: {OUTPUT_JSONL}")


if __name__ == "__main__":
    main()