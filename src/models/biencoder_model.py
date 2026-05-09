from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from src.models.base_model import BaseRetrievalModel


@dataclass
class BiEncoderModel(BaseRetrievalModel):
    encoder_name: str = "stub-biencoder"

    def fit(self, *args, **kwargs) -> "BiEncoderModel":
        return self

    def query(self, *args, **kwargs) -> pd.DataFrame:
        raise NotImplementedError("Bi-encoder model is a stub and should be implemented in a future iteration.")
