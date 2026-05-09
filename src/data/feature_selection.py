from __future__ import annotations

from dataclasses import dataclass

import pandas as pd


@dataclass
class FeatureSelector:
    feature_columns: list[str]

    def select(self, dataframe: pd.DataFrame) -> pd.DataFrame:
        available_columns = [column for column in self.feature_columns if column in dataframe.columns]
        if not available_columns:
            raise ValueError("No configured feature columns were found in the dataframe.")
        return dataframe[available_columns].copy()
