from __future__ import annotations

from dataclasses import dataclass

from src.recs.evaluation.metrics import precision_at_k


@dataclass
class RecsEvaluator:
    k: int = 5

    def evaluate(self, retrieved_items: list[str], relevant_items: list[str]) -> dict:
        return {"precision_at_k": precision_at_k(retrieved_items, relevant_items, self.k)}
