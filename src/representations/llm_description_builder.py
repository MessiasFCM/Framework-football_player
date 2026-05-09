from __future__ import annotations

from dataclasses import dataclass

import pandas as pd


@dataclass
class LLMDescriptionBuilder:
    feature_columns: list[str]

    def build(self, dataframe: pd.DataFrame) -> list[str]:
        descriptions: list[str] = []
        for _, row in dataframe.iterrows():
            name = row.get("Player", "Unknown player")
            squad = row.get("Squad", "Unknown squad")
            position = row.get("Pos", "Unknown position")
            nation = row.get("Nation", "Unknown nation")

            metrics = []
            for column in self.feature_columns:
                if column in {"Player", "Squad", "Pos", "Nation"}:
                    continue
                if column in dataframe.columns:
                    metrics.append(f"{column}={row[column]}")

            metric_summary = ", ".join(metrics[:8])
            descriptions.append(
                f"{name} plays for {squad} as {position}, represents {nation}, and has season indicators: {metric_summary}."
            )

        return descriptions
