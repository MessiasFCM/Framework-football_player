import pandas as pd

from src.search.model.bm25_model import BM25SearchModel


def test_bm25_ranks_more_relevant_profile_first() -> None:
    metadata = pd.DataFrame(
        {
            "Player": ["Playmaker A", "Defender B", "Striker C"],
            "player_profile": [
                "player (Player): Playmaker A | position (Pos): midfielder (MF) | assists (Ast): 12 | progressive_passes (PrgP): 220",
                "player (Player): Defender B | position (Pos): defender (DF) | yellow_cards (CrdY): 7",
                "player (Player): Striker C | position (Pos): forward (FW) | goals (Gls): 18",
            ],
        }
    )

    model = BM25SearchModel().fit(metadata["player_profile"], metadata)
    results = model.query("playmaker assists progressive passes", top_k=2)

    assert len(results) == 2
    assert results.iloc[0]["Player"] == "Playmaker A"
    assert results.iloc[0]["score"] >= results.iloc[1]["score"]


def test_bm25_rejects_empty_queries_after_tokenization() -> None:
    metadata = pd.DataFrame({"Player": ["Player A"], "player_profile": ["player (Player): Player A"]})

    model = BM25SearchModel().fit(metadata["player_profile"], metadata)

    try:
        model.query("!!!", top_k=1)
    except ValueError as exc:
        assert "no valid tokens" in str(exc)
    else:
        raise AssertionError("Expected ValueError for an empty tokenized query.")
