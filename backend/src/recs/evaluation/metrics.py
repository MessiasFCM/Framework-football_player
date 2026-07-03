from __future__ import annotations

from typing import Iterable


def precision_at_k(retrieved_items: Iterable[str], relevant_items: Iterable[str], k: int) -> float:
    retrieved_at_k = list(retrieved_items)[:k]
    relevant_set = set(relevant_items)
    if not retrieved_at_k:
        return 0.0
    hits = sum(1 for item in retrieved_at_k if item in relevant_set)
    return hits / len(retrieved_at_k)
