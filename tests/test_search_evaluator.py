from src.search.evaluation.evaluator import SearchEvaluator


def test_search_evaluator_reports_metrics_for_multiple_top_ks() -> None:
    evaluator = SearchEvaluator()

    rankings = [
        ["Player A", "Player B", "Player C"],
        ["Player C", "Player B", "Player A"],
    ]
    relevance_sets = [
        ["Player A"],
        ["Player B"],
    ]

    results = evaluator.evaluate(
        rankings=rankings,
        relevance_sets=relevance_sets,
        top_ks=[1, 2],
        metrics=["PRECISION", "RECALL", "MRR", "MAP", "NDCG"],
    )

    assert set(results.keys()) == {1, 2}
    assert results[1]["PRECISION"] == 0.5
    assert results[2]["RECALL"] == 1.0
    assert results[2]["MRR"] == 0.75


def test_search_evaluator_ignores_unknown_metrics() -> None:
    evaluator = SearchEvaluator()

    results = evaluator.evaluate(
        rankings=[["Player A"]],
        relevance_sets=[["Player A"]],
        top_ks=[5],
        metrics=["UNKNOWN", "PRECISION"],
    )

    assert list(results[5].keys()) == ["PRECISION"]
