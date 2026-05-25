from __future__ import annotations

import json
import sys
import time
from itertools import product
from pathlib import Path

import pandas as pd
from sklearn.model_selection import train_test_split


def fmt_seconds(seconds: float) -> str:
    if seconds < 60:
        return f"{seconds:.1f}s"
    minutes, sec = divmod(seconds, 60)
    return f"{int(minutes)}m{sec:04.1f}s"

PROJECT_ROOT = Path("/home/andrelima/Projetos/Framework-football_player")
sys.path.insert(0, str(PROJECT_ROOT))

from src.search.dataloader.profile_builder import TextConcatBuilder        
from src.search.evaluation.evaluator import SearchEvaluator                
from src.search.model.bi_encoder_model import BiEncoderSearchModel         
from src.search.model.bm25_model import BM25SearchModel                    

PREPROCESS_ROOT = PROJECT_ROOT / "preprocess"
PLAYERS_TEXT_JSONL = PREPROCESS_ROOT / "output" / "players_text.jsonl"
PROCESSED_CSV = PROJECT_ROOT / "data" / "processed" / "players_processed.csv"
TAGS_RULES_CSV = PREPROCESS_ROOT / "output" / "tags_rules.csv"
TAGS_LLM_CSV = PREPROCESS_ROOT / "output" / "tags_llm.csv"
OUT_DIR = PREPROCESS_ROOT / "output" / "eval"

TEXT_SOURCES = ["llm", "concat"]
MODELS = ["bm25", "biencoder"]
TAG_SOURCES = ["rules", "llm"]

BIENCODER_MODEL = "intfloat/multilingual-e5-small"

TEST_SIZE = 0.2
SEED = 42
MIN_SAMPLES_PER_TAG = 5
TOP_KS = [5, 10, 20, 50]
METRICS = ["RECALL", "NDCG", "MAP", "MRR", "PRECISION"]

CONCAT_FEATURE_COLUMNS = [
    "Player", "Nation", "Pos", "Squad", "Age", "Born",
    "MP", "Starts", "Min", "90s", "Gls", "Ast", "CrdY", "CrdR",
    "xG", "xAG", "npxG", "xG+xAG", "PrgC", "PrgP", "PrgR",
]

def load_llm_texts() -> pd.DataFrame:
    if not PLAYERS_TEXT_JSONL.exists():
        raise FileNotFoundError(f"Texto LLM não encontrado: {PLAYERS_TEXT_JSONL}")
    rows: list[dict] = []
    with PLAYERS_TEXT_JSONL.open("r", encoding="utf-8") as file:
        for line in file:
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    df = pd.DataFrame(rows)
    df["rk"] = df["rk"].astype(int)
    return df[["rk", "text"]].rename(columns={"text": "doc"})


def load_concat_texts() -> pd.DataFrame:
    if not PROCESSED_CSV.exists():
        raise FileNotFoundError(
            f"CSV processado não encontrado: {PROCESSED_CSV}. "
            "Rode um experimento BM25 primeiro pra gerar."
        )
    df = pd.read_csv(PROCESSED_CSV)
    if "Rk" not in df.columns:
        raise RuntimeError("Coluna Rk não encontrada em players_processed.csv")
    builder = TextConcatBuilder(feature_columns=CONCAT_FEATURE_COLUMNS)
    docs = builder.build(df)
    return pd.DataFrame({"rk": df["Rk"].astype(int), "doc": docs})


def load_tags(source: str) -> pd.DataFrame:
    path = TAGS_RULES_CSV if source == "rules" else TAGS_LLM_CSV
    if not path.exists():
        raise FileNotFoundError(f"Tags não encontradas: {path}")
    df = pd.read_csv(path)
    df["rk"] = df["rk"].astype(int)
    return df[["rk", "player", "tag"]]


def tag_to_query(tag: str) -> str:
    return tag.replace("_", " ")

def run_combo(text_source: str, model_name: str, tag_source: str) -> dict:
    label = f"{text_source} + {model_name} + tags_{tag_source}"
    print(f"\n=== {label} ===")
    combo_start = time.perf_counter()
    stage_times: dict[str, float] = {}

    t0 = time.perf_counter()
    texts_df = load_llm_texts() if text_source == "llm" else load_concat_texts()
    tags_df = load_tags(tag_source)
    stage_times["load"] = time.perf_counter() - t0

    merged = tags_df.merge(texts_df, on="rk", how="inner")
    merged = merged[merged["tag"] != "insuficiente"].reset_index(drop=True)

    counts = merged["tag"].value_counts()
    valid_tags = counts[counts >= MIN_SAMPLES_PER_TAG].index
    dropped = counts[counts < MIN_SAMPLES_PER_TAG]
    if not dropped.empty:
        print(f"  [aviso] tags descartadas (< {MIN_SAMPLES_PER_TAG}): "
              f"{dropped.to_dict()}")
    merged = merged[merged["tag"].isin(valid_tags)].reset_index(drop=True)

    print(f"  corpus elegível: {len(merged)} | tags válidas: {len(valid_tags)}")

    train_df, test_df = train_test_split(
        merged,
        test_size=TEST_SIZE,
        random_state=SEED,
        stratify=merged["tag"],
    )
    test_df = test_df.reset_index(drop=True)
    print(f"  teste (indexado e avaliado): {len(test_df)}")

    if model_name == "bm25":
        model = BM25SearchModel()
    elif model_name == "biencoder":
        model = BiEncoderSearchModel(pretrained_name=BIENCODER_MODEL)
    else:
        raise ValueError(f"Modelo desconhecido: {model_name}")

    t0 = time.perf_counter()
    fitted = model.fit(documents=test_df["doc"].astype(str).tolist(), metadata=test_df)
    stage_times["index"] = time.perf_counter() - t0

    t0 = time.perf_counter()
    rankings: list[list[str]] = []
    relevance_sets: list[list[str]] = []
    for tag in sorted(test_df["tag"].unique()):
        query = tag_to_query(tag)
        ranking_df = fitted.rank(query)
        rankings.append(ranking_df["rk"].astype(str).tolist())
        relevance_sets.append(
            test_df.loc[test_df["tag"] == tag, "rk"].astype(str).tolist()
        )
    stage_times["search"] = time.perf_counter() - t0

    t0 = time.perf_counter()
    evaluator = SearchEvaluator()
    metrics_report = evaluator.evaluate(
        rankings=rankings,
        relevance_sets=relevance_sets,
        top_ks=TOP_KS,
        metrics=METRICS,
    )
    stage_times["metrics"] = time.perf_counter() - t0
    combo_total = time.perf_counter() - combo_start

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUT_DIR / f"{text_source}_{model_name}_{tag_source}.json"
    out_path.write_text(
        json.dumps({
            "text_source": text_source,
            "model": model_name,
            "tag_source": tag_source,
            "n_test_corpus": len(test_df),
            "n_tags": int(len(valid_tags)),
            "metrics": metrics_report,
            "elapsed_seconds": {
                "load": round(stage_times["load"], 2),
                "index": round(stage_times["index"], 2),
                "search": round(stage_times["search"], 2),
                "metrics": round(stage_times["metrics"], 2),
                "total": round(combo_total, 2),
            },
        }, indent=2),
        encoding="utf-8",
    )
    print(
        f"  tempo: load={fmt_seconds(stage_times['load'])}, "
        f"index={fmt_seconds(stage_times['index'])}, "
        f"search={fmt_seconds(stage_times['search'])}, "
        f"metrics={fmt_seconds(stage_times['metrics'])} "
        f"| total={fmt_seconds(combo_total)}"
    )
    print(f"  -> {out_path.name}")

    return {
        "text_source": text_source,
        "model": model_name,
        "tag_source": tag_source,
        "metrics_report": metrics_report,
        "elapsed_total": combo_total,
    }


def main() -> None:
    global_start = time.perf_counter()
    rows: list[dict] = []
    combo_durations: list[tuple[str, float]] = []

    for text_source, model_name, tag_source in product(TEXT_SOURCES, MODELS, TAG_SOURCES):
        result = run_combo(text_source, model_name, tag_source)
        combo_durations.append(
            (f"{result['text_source']}+{result['model']}+{result['tag_source']}",
             result["elapsed_total"])
        )
        for top_k, scores in result["metrics_report"].items():
            for metric_name, value in scores.items():
                rows.append({
                    "text_source": result["text_source"],
                    "model": result["model"],
                    "tag_source": result["tag_source"],
                    "top_k": int(top_k),
                    "metric": metric_name,
                    "value": float(value),
                })

    summary = pd.DataFrame(rows)
    summary_path = OUT_DIR / "summary.csv"
    summary.to_csv(summary_path, index=False)
    print(f"\n[ok] Resumo longo: {summary_path}")

    total_elapsed = time.perf_counter() - global_start
    print("\nTempo por combinação:")
    for label, dur in combo_durations:
        print(f"  {label:55s} {fmt_seconds(dur)}")
    print(f"  {'-' * 55} -------")
    print(f"  {'TOTAL':55s} {fmt_seconds(total_elapsed)}")

    for metric_name in ("NDCG", "RECALL", "MRR"):
        for k in (10,):
            slice_df = summary[(summary["metric"] == metric_name) & (summary["top_k"] == k)]
            pivot = slice_df.pivot_table(
                index=["text_source", "tag_source"],
                columns="model",
                values="value",
            ).round(4)
            print(f"\n{metric_name}@{k}:")
            print(pivot.to_string())


if __name__ == "__main__":
    main()
