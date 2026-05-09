from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from src.data.feature_selection import FeatureSelector


@dataclass
class NumericRepresentationBuilder:
    feature_columns: list[str]

    def build(self, dataframe: pd.DataFrame) -> pd.DataFrame:
        selector = FeatureSelector(feature_columns=self.feature_columns)
        return selector.select(dataframe)
