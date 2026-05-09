from __future__ import annotations

from abc import ABC, abstractmethod

import pandas as pd


class BaseRecsModel(ABC):
    @abstractmethod
    def fit(self, *args, **kwargs) -> "BaseRecsModel":
        raise NotImplementedError

    @abstractmethod
    def query(self, *args, **kwargs) -> pd.DataFrame:
        raise NotImplementedError
