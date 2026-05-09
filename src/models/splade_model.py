from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from src.models.base_model import BaseRetrievalModel


@dataclass
class SPLADEModel(BaseRetrievalModel):
    encoder_name: str = "stub-splade"

    def fit(self, *args, **kwargs) -> "SPLADEModel":
        return self

    def query(self, *args, **kwargs) -> pd.DataFrame:
        raise NotImplementedError("SPLADE model is a stub and should be implemented in a future iteration.")
