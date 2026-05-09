from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from src.dataset.manager import select_feature_columns


@dataclass
class NumericRepresentationBuilder:
    feature_columns: list[str]

    def build(self, dataframe: pd.DataFrame) -> pd.DataFrame:
        return select_feature_columns(dataframe, self.feature_columns)
