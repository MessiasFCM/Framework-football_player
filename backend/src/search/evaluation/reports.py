from __future__ import annotations

import json
from pathlib import Path

import pandas as pd


def save_report(report: pd.DataFrame, output_path: str | Path) -> None:
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    report.to_csv(output_path, index=False)


def save_metrics_report(metrics_report: dict[int, dict[str, float]], output_path: str | Path) -> None:
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as file:
        json.dump(metrics_report, file, indent=2)


def metrics_report_to_dataframe(metrics_report: dict[int, dict[str, float]]) -> pd.DataFrame:
    rows: list[dict[str, float | int]] = []
    for top_k, metric_values in sorted(metrics_report.items()):
        row: dict[str, float | int] = {"top_k": int(top_k)}
        row.update(metric_values)
        rows.append(row)
    return pd.DataFrame(rows)
