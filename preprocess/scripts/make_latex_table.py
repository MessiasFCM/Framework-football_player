"""
Gera tabelas LaTeX (booktabs) a partir do summary.csv produzido pelo
evaluate_tag_search_matrix.py.

Uma tabela por valor de K — rows = 8 combos (text × model × tag_source),
columns = 5 métricas. Melhor valor por coluna em negrito.

Saídas (em preprocess/output/eval/):
  results_table_k10.tex
  results_table_k20.tex
  results_table_k50.tex
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd

EVAL_DIR = Path("/home/andrelima/Projetos/Framework-football_player/preprocess/output/eval")
SUMMARY_CSV = EVAL_DIR / "summary.csv"

KS = [10, 20, 50]
METRIC_ORDER = ["RECALL", "NDCG", "MAP", "MRR", "PRECISION"]

TEXT_LABEL = {"llm": "LLM", "concat": "Concat"}
MODEL_LABEL = {"bm25": "BM25", "biencoder": "BiEncoder"}
TAG_LABEL = {"rules": "regras", "llm": "LLM"}


def metric_label(metric: str, k: int) -> str:
    name = {"RECALL": "Recall", "NDCG": "nDCG", "MAP": "MAP",
            "MRR": "MRR", "PRECISION": "P"}[metric]
    return f"{name}@{k}"


def build_combined_table(df: pd.DataFrame, ks: list[int]) -> str:
    """Uma tabela só, agrupada por K via \\multirow. Requer \\usepackage{multirow}."""
    metric_short = {"RECALL": "Recall", "NDCG": "nDCG", "MAP": "MAP",
                    "MRR": "MRR", "PRECISION": "P"}
    blocks: list[str] = []
    for k in ks:
        sub = df[df["top_k"] == k]
        pivot = (
            sub.pivot_table(
                index=["text_source", "model", "tag_source"],
                columns="metric",
                values="value",
            )
            .reset_index()
            .sort_values(["text_source", "model", "tag_source"])
            .reset_index(drop=True)
        )
        best = {m: pivot[m].max() for m in METRIC_ORDER}

        block_rows: list[str] = []
        for i, (_, row) in enumerate(pivot.iterrows()):
            k_label = (
                rf"\multirow{{{len(pivot)}}}{{*}}{{$K={k}$}}" if i == 0 else ""
            )
            cells = [
                k_label,
                TEXT_LABEL[row["text_source"]],
                MODEL_LABEL[row["model"]],
                TAG_LABEL[row["tag_source"]],
            ]
            for m in METRIC_ORDER:
                txt = f"{row[m]:.4f}"
                cells.append(r"\textbf{" + txt + "}" if abs(row[m] - best[m]) < 1e-12 else txt)
            block_rows.append(" & ".join(cells) + r" \\")
        blocks.append("\n".join(block_rows))

    headers = ["$K$", "Texto", "Modelo", "Tags"] + [metric_short[m] for m in METRIC_ORDER]
    col_spec = "l" * 4 + "r" * len(METRIC_ORDER)

    return (
        r"\begin{table}[h]" "\n"
        r"\centering" "\n"
        r"\caption{Resultados da busca por tag de estilo de jogo para "
        + ", ".join(f"$K={k}$" for k in ks) + ". "
        r"Negrito indica o melhor valor por métrica dentro de cada bloco de $K$.}" "\n"
        r"\label{tab:tag-search-combined}" "\n"
        r"\begin{tabular}{" + col_spec + "}" "\n"
        r"\toprule" "\n"
        + " & ".join(headers) + r" \\" + "\n"
        r"\midrule" "\n"
        + "\n\\midrule\n".join(blocks) + "\n"
        r"\bottomrule" "\n"
        r"\end{tabular}" "\n"
        r"\end{table}" "\n"
    )


def build_table(df: pd.DataFrame, k: int) -> str:
    sub = df[df["top_k"] == k]
    pivot = (
        sub.pivot_table(
            index=["text_source", "model", "tag_source"],
            columns="metric",
            values="value",
        )
        .reset_index()
        .sort_values(["text_source", "model", "tag_source"])
        .reset_index(drop=True)
    )

    best = {m: pivot[m].max() for m in METRIC_ORDER}

    def fmt_cell(value: float, metric: str) -> str:
        text = f"{value:.4f}"
        return r"\textbf{" + text + "}" if abs(value - best[metric]) < 1e-12 else text

    headers = ["Texto", "Modelo", "Tags"] + [metric_label(m, k) for m in METRIC_ORDER]
    rows: list[str] = []
    for _, row in pivot.iterrows():
        cells = [
            TEXT_LABEL[row["text_source"]],
            MODEL_LABEL[row["model"]],
            TAG_LABEL[row["tag_source"]],
            *[fmt_cell(row[m], m) for m in METRIC_ORDER],
        ]
        rows.append(" & ".join(cells) + r" \\")

    col_spec = "lll" + "r" * len(METRIC_ORDER)
    return (
        r"\begin{table}[h]" "\n"
        r"\centering" "\n"
        r"\caption{Resultados da busca por tag de estilo de jogo, K=" + str(k) + ". "
        r"Negrito indica o melhor valor por métrica.}" "\n"
        r"\label{tab:tag-search-k" + str(k) + "}" "\n"
        r"\begin{tabular}{" + col_spec + "}" "\n"
        r"\toprule" "\n"
        + " & ".join(headers) + r" \\" + "\n"
        r"\midrule" "\n"
        + "\n".join(rows) + "\n"
        r"\bottomrule" "\n"
        r"\end{tabular}" "\n"
        r"\end{table}" "\n"
    )


def main() -> None:
    if not SUMMARY_CSV.exists():
        raise FileNotFoundError(
            f"Não encontrei {SUMMARY_CSV}. Rode evaluate_tag_search_matrix.py primeiro."
        )

    df = pd.read_csv(SUMMARY_CSV)
    available = set(df["top_k"].unique())
    missing = [k for k in KS if k not in available]
    if missing:
        raise ValueError(f"K(s) ausente(s) no summary.csv: {missing}. "
                         f"Disponíveis: {sorted(available)}.")

    for k in KS:
        latex = build_table(df, k)
        out_path = EVAL_DIR / f"results_table_k{k}.tex"
        out_path.write_text(latex, encoding="utf-8")
        print(f"[ok] {out_path}")

    combined = build_combined_table(df, KS)
    combined_path = EVAL_DIR / "results_table_combined.tex"
    combined_path.write_text(combined, encoding="utf-8")
    print(f"[ok] {combined_path}")

    print("\nPara incluir no documento LaTeX:")
    print(r"  \usepackage{booktabs}    % no preâmbulo")
    print(r"  \usepackage{multirow}    % necessário pra results_table_combined")
    print(r"  \input{results_table_combined}    % ou as 3 separadas:")
    for k in KS:
        print(rf"  \input{{results_table_k{k}}}")


if __name__ == "__main__":
    main()
