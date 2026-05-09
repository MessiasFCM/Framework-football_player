from __future__ import annotations

import math
from typing import Iterable


def precision_at_k(retrieved_items: Iterable[str], relevant_items: Iterable[str], k: int) -> float:
    retrieved_at_k = list(retrieved_items)[:k]
    relevant_set = set(relevant_items)
    if not retrieved_at_k:
        return 0.0
    hits = sum(1 for item in retrieved_at_k if item in relevant_set)
    return hits / len(retrieved_at_k)


def recall_at_k(retrieved_items: Iterable[str], relevant_items: Iterable[str], k: int) -> float:
    relevant_set = set(relevant_items)
    if not relevant_set:
        return 0.0
    retrieved_at_k = list(retrieved_items)[:k]
    hits = sum(1 for item in retrieved_at_k if item in relevant_set)
    return hits / len(relevant_set)


def reciprocal_rank_at_k(retrieved_items: Iterable[str], relevant_items: Iterable[str], k: int) -> float:
    relevant_set = set(relevant_items)
    for rank, item in enumerate(list(retrieved_items)[:k], start=1):
        if item in relevant_set:
            return 1.0 / float(rank)
    return 0.0


def average_precision_at_k(retrieved_items: Iterable[str], relevant_items: Iterable[str], k: int) -> float:
    relevant_set = set(relevant_items)
    if not relevant_set:
        return 0.0

    retrieved_at_k = list(retrieved_items)[:k]
    hit_count = 0
    precision_sum = 0.0
    for rank, item in enumerate(retrieved_at_k, start=1):
        if item in relevant_set:
            hit_count += 1
            precision_sum += hit_count / float(rank)

    if hit_count == 0:
        return 0.0

    return precision_sum / float(min(len(relevant_set), k))


def ndcg_at_k(retrieved_items: Iterable[str], relevant_items: Iterable[str], k: int) -> float:
    relevant_set = set(relevant_items)
    if not relevant_set:
        return 0.0

    retrieved_at_k = list(retrieved_items)[:k]
    dcg = 0.0
    for rank, item in enumerate(retrieved_at_k, start=1):
        if item in relevant_set:
            dcg += 1.0 / math.log2(rank + 1.0)

    ideal_hits = min(len(relevant_set), k)
    if ideal_hits == 0:
        return 0.0

    idcg = sum(1.0 / math.log2(rank + 1.0) for rank in range(1, ideal_hits + 1))
    if idcg == 0.0:
        return 0.0

    return dcg / idcg
