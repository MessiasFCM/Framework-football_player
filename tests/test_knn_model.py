import pandas as pd

from src.models.knn_model import KNNPlayerRecommender


def test_knn_returns_expected_number_of_similar_players() -> None:
    metadata = pd.DataFrame(
        {
            "Player": ["Player A", "Player B", "Player C", "Player D"],
            "Squad": ["T1", "T2", "T3", "T4"],
        }
    )
    features = pd.DataFrame(
        {
            "Gls": [10, 9, 1, 0],
            "Ast": [5, 4, 0, 1],
            "xG": [8.0, 7.5, 0.5, 0.3],
        }
    )

    model = KNNPlayerRecommender(n_neighbors=3)
    model.fit(features, metadata, player_column="Player")
    results = model.query("Player A", top_k=2)

    assert len(results) == 2
    assert "Player A" not in results["Player"].tolist()
    assert results.iloc[0]["Player"] == "Player B"
