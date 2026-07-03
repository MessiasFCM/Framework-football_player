from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import pandas as pd
from llama_cpp import Llama, LlamaGrammar
from tqdm import tqdm

PROJECT_ROOT = Path("/home/andrelima/Projetos/Framework-football_player")
ROOT = PROJECT_ROOT / "preprocess"
INPUT_XLSX = PROJECT_ROOT / "data" / "raw" / "All_Leagues_Data.xlsx"
OUTPUT_JSONL = ROOT / "output" / "tags_llm.jsonl"
OUTPUT_CSV = ROOT / "output" / "tags_llm.csv"
MODEL_PATH = ROOT / "models" / "Llama-3.2-3B-Instruct-Q4_K_M.gguf"

SHEET = "AllCompDataset"
MIN_90S = 0
N_CTX = 2048
TEMPERATURE = 0.1   

ROLE_DESCRIPTIONS: dict[str, dict[str, str]] = {
    "DF": {
        "zagueiro_classico": (
            "Defensor central tradicional. Joga muitos minutos, foca em "
            "marcação, raramente conduz a bola pra frente ou dá assistências. "
            "Estilo defensivo puro, pouco progressivo."
        ),
        "zagueiro_construtor": (
            "Defensor central moderno. Sai jogando, tem alto volume de "
            "passes progressivos (PrgP) e conduções progressivas (PrgC). "
            "Inicia jogadas desde a defesa."
        ),
        "lateral_ofensivo": (
            "Lateral que apoia o ataque. Recebe muitos passes progressivos "
            "(PrgR), contribui com assistências e xAG, atua avançando ao "
            "campo de ataque pelas faixas."
        ),
    },
    "MF": {
        "volante_defensivo": (
            "Primeiro volante / cabeça de área. Foca em marcação, joga "
            "muitos minutos, costuma receber cartões por faltas táticas, "
            "produz poucos gols e assistências."
        ),
        "box_to_box": (
            "Meio-campista completo, vai e volta. Equilibra defesa e ataque, "
            "contribui com gols e assistências, alto volume de conduções e "
            "passes progressivos."
        ),
        "meia_criativo": (
            "Camisa 10 / armador. Alto volume de assistências e xAG, "
            "principal passador da equipe, cria as jogadas ofensivas."
        ),
    },
    "FW": {
        "centroavante_goleador": (
            "Atacante de área, número 9 clássico. Marca muitos gols, alto "
            "xG e npxG, contribui pouco em assistências ou conduções. "
            "Especialista em finalizar."
        ),
        "ponta_dribllador": (
            "Extremo / ponta. Alto volume de conduções progressivas (PrgC) "
            "e recepções de passes progressivos (PrgR). Atua pelas faixas "
            "laterais do ataque com drible e velocidade."
        ),
        "segundo_atacante": (
            "Atacante associativo / falso 9. Equilibra gols e assistências, "
            "alto xAG, participa da construção das jogadas além de finalizar."
        ),
    },
    "GK": {
        "goleiro_titular": (
            "Goleiro principal do elenco. Joga a maioria das partidas, alto "
            "volume de minutos."
        ),
        "goleiro_reserva": (
            "Goleiro suplente. Pouco utilizado, joga poucos minutos."
        ),
        "goleiro_joia": (
            "Goleiro jovem promissor. Idade baixa (jovem), recebendo "
            "algumas oportunidades."
        ),
    },
}

SYSTEM_PROMPT = (
    "Você é um analista de futebol. Sua tarefa é classificar um jogador em "
    "UMA das funções fornecidas, com base nas estatísticas. Responda APENAS "
    "com o nome exato da função (snake_case), sem explicação adicional."
)


def primary_pos(pos: object) -> str:
    return str(pos).split(",")[0].strip()


def clean_minutes(series: pd.Series) -> pd.Series:
    return pd.to_numeric(
        series.astype(str).str.replace(",", "", regex=False),
        errors="coerce",
    ).fillna(0).astype(int)


def build_prompt(row: pd.Series, pos: str) -> str:
    roles_text = "\n".join(
        f"- {tag}: {desc}"
        for tag, desc in ROLE_DESCRIPTIONS[pos].items()
    )
    return (
        f"Funções possíveis para a posição {pos}:\n{roles_text}\n\n"
        f"Estatísticas do jogador:\n"
        f"Nome: {row['Player']}\n"
        f"Posição declarada: {row['Pos']} | Nacionalidade: {row['Nation']} | "
        f"Idade: {row['Age']} | Clube: {row['Squad']}\n"
        f"Partidas: {row['MP']} (titular {row['Starts']}) | "
        f"Minutos: {row['Min']} | 90s: {row['90s']}\n"
        f"Gols: {row['Gls']} (npxG: {row['npxG']}, xG: {row['xG']}) | "
        f"Pênaltis: {row['PK']}/{row['PKatt']}\n"
        f"Assistências: {row['Ast']} (xAG: {row['xAG']})\n"
        f"Conduções progressivas (PrgC): {row['PrgC']} | "
        f"Passes progressivos (PrgP): {row['PrgP']} | "
        f"Recepções progressivas (PrgR): {row['PrgR']}\n"
        f"Cartões: {row['CrdY']} amarelos, {row['CrdR']} vermelhos\n"
        f"Por 90 min — Gols: {row['Gls.1']}, Ast: {row['Ast.1']}, "
        f"xG: {row['xG.1']}, xAG: {row['xAG.1']}\n\n"
        f"Classifique este jogador em UMA das funções listadas. "
        f"Responda APENAS com o nome da função:"
    )


def grammar_for(pos: str) -> LlamaGrammar:
    options = " | ".join(f'"{tag}"' for tag in ROLE_DESCRIPTIONS[pos])
    return LlamaGrammar.from_string(f"root ::= {options}")


def already_done(path: Path) -> set[int]:
    if not path.exists():
        return set()
    done: set[int] = set()
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            try:
                done.add(int(json.loads(line)["rk"]))
            except (json.JSONDecodeError, KeyError, ValueError):
                continue
    return done


def export_csv(jsonl_path: Path, csv_path: Path) -> None:
    rows = []
    with jsonl_path.open("r", encoding="utf-8") as f:
        for line in f:
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    out = pd.DataFrame(rows)
    out.to_csv(csv_path, index=False)


def main() -> None:
    if not MODEL_PATH.exists():
        sys.exit(f"Modelo não encontrado em {MODEL_PATH}")

    df = pd.read_excel(INPUT_XLSX, sheet_name=SHEET)
    df["Min"] = clean_minutes(df["Min"])
    df["primary_pos"] = df["Pos"].apply(primary_pos)

    eligible = df[df["90s"] >= MIN_90S].copy()
    skipped = df[df["90s"] < MIN_90S].copy()
    print(f"Total: {len(df)} | elegíveis: {len(eligible)} | "
          f"insuficientes (skip LLM): {len(skipped)}")

    done = already_done(OUTPUT_JSONL)
    pending = eligible[~eligible["Rk"].isin(done)]
    print(f"Já feitos: {len(done)} | pendentes: {len(pending)}")

    llm = Llama(
        model_path=str(MODEL_PATH),
        n_ctx=N_CTX,
        n_gpu_layers=-1,
        verbose=False,
    )

    grammars = {pos: grammar_for(pos) for pos in ROLE_DESCRIPTIONS}

    OUTPUT_JSONL.parent.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    with OUTPUT_JSONL.open("a", encoding="utf-8") as out:
        for _, row in skipped.iterrows():
            if int(row["Rk"]) in done:
                continue
            record = {
                "rk": int(row["Rk"]),
                "player": row["Player"],
                "squad": row["Squad"],
                "nation": row["Nation"],
                "pos": row["Pos"],
                "primary_pos": row["primary_pos"],
                "age": int(row["Age"]),
                "ninetys": float(row["90s"]),
                "tag": "insuficiente",
            }
            out.write(json.dumps(record, ensure_ascii=False) + "\n")
            done.add(int(row["Rk"]))
        out.flush()

        for _, row in tqdm(pending.iterrows(), total=len(pending),
                           desc="classificando"):
            pos = row["primary_pos"]
            if pos not in ROLE_DESCRIPTIONS:
                tag = "insuficiente"
            else:
                prompt = build_prompt(row, pos)
                try:
                    resp = llm.create_chat_completion(
                        messages=[
                            {"role": "system", "content": SYSTEM_PROMPT},
                            {"role": "user", "content": prompt},
                        ],
                        max_tokens=20,
                        temperature=TEMPERATURE,
                        grammar=grammars[pos],
                    )
                    tag = resp["choices"][0]["message"]["content"].strip()
                except Exception as e:
                    tag = f"[ERRO: {e}]"

            record = {
                "rk": int(row["Rk"]),
                "player": row["Player"],
                "squad": row["Squad"],
                "nation": row["Nation"],
                "pos": row["Pos"],
                "primary_pos": row["primary_pos"],
                "age": int(row["Age"]),
                "ninetys": float(row["90s"]),
                "tag": tag,
            }
            out.write(json.dumps(record, ensure_ascii=False) + "\n")
            out.flush()

    print(f"\nClassificação concluída em {time.time() - t0:.0f}s.")
    print(f"  JSONL: {OUTPUT_JSONL}")

    export_csv(OUTPUT_JSONL, OUTPUT_CSV)
    final = pd.read_csv(OUTPUT_CSV)
    print(f"  CSV:   {OUTPUT_CSV}")
    print("\n[tags] distribuição:")
    print(final["tag"].value_counts().to_string())


if __name__ == "__main__":
    main()
