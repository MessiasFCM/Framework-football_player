from __future__ import annotations

import pandas as pd


class IdentityReranker:
    def rerank(self, dataframe: pd.DataFrame) -> pd.DataFrame:
        return dataframe
