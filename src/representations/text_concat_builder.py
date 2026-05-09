from __future__ import annotations

from dataclasses import dataclass

import pandas as pd


@dataclass
class TextConcatBuilder:
    feature_columns: list[str]

    def build(self, dataframe: pd.DataFrame) -> list[str]:
        available_columns = [column for column in self.feature_columns if column in dataframe.columns]
        profiles: list[str] = []

        for _, row in dataframe.iterrows():
            segments = [f"{column}: {row[column]}" for column in available_columns]
            profiles.append(" | ".join(segments))

        return profiles
