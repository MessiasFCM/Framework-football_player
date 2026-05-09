from __future__ import annotations

from dataclasses import dataclass
from statistics import mean

from src.search.evaluation.metrics import average_precision_at_k
from src.search.evaluation.metrics import ndcg_at_k
from src.search.evaluation.metrics import precision_at_k
from src.search.evaluation.metrics import recall_at_k
from src.search.evaluation.metrics import reciprocal_rank_at_k


@dataclass
class SearchEvaluator:
    metric_map = {
        "PRECISION": precision_at_k,
        "RECALL": recall_at_k,
        "MRR": reciprocal_rank_at_k,
        "MAP": average_precision_at_k,
        "NDCG": ndcg_at_k,
    }

    def evaluate(self, rankings: list[list[str]], relevance_sets: list[list[str]], top_ks: list[int], metrics: list[str]) -> dict:
        results: dict[int, dict[str, float]] = {}

        normalized_metrics = [metric.upper().strip() for metric in metrics]
        for top_k in top_ks:
            metric_scores: dict[str, float] = {}
            for metric_name in normalized_metrics:
                metric_fn = self.metric_map.get(metric_name)
                if metric_fn is None:
                    continue
                values = [
                    metric_fn(retrieved_items=ranking, relevant_items=relevant_items, k=top_k)
                    for ranking, relevant_items in zip(rankings, relevance_sets)
                ]
                metric_scores[metric_name] = mean(values) if values else 0.0
            results[int(top_k)] = metric_scores

        return results
