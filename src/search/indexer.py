from __future__ import annotations

from dataclasses import dataclass

from src.models.base_model import BaseRetrievalModel


@dataclass
class Indexer:
    model: BaseRetrievalModel

    def build(self, *args, **kwargs) -> BaseRetrievalModel:
        return self.model.fit(*args, **kwargs)
