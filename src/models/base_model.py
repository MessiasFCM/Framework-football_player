from __future__ import annotations

from abc import ABC, abstractmethod

import pandas as pd


class BaseRetrievalModel(ABC):
    @abstractmethod
    def fit(self, *args, **kwargs) -> "BaseRetrievalModel":
        raise NotImplementedError

    @abstractmethod
    def query(self, *args, **kwargs) -> pd.DataFrame:
        raise NotImplementedError
