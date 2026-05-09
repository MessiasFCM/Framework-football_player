from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from src.models.base_model import BaseRetrievalModel


@dataclass
class Retriever:
    model: BaseRetrievalModel

    def retrieve(self, *args, **kwargs) -> pd.DataFrame:
        return self.model.query(*args, **kwargs)
