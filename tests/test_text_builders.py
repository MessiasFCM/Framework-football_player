import pandas as pd

from src.representations.llm_description_builder import LLMDescriptionBuilder
from src.representations.text_concat_builder import TextConcatBuilder


def test_text_concat_builder_formats_profiles() -> None:
    df = pd.DataFrame([{"Player": "Player A", "Squad": "Team A", "Gls": 5}])
    builder = TextConcatBuilder(feature_columns=["Player", "Squad", "Gls"])

    profiles = builder.build(df)

    assert profiles == ["Player: Player A | Squad: Team A | Gls: 5"]


def test_llm_description_builder_returns_deterministic_template() -> None:
    df = pd.DataFrame(
        [{"Player": "Player A", "Squad": "Team A", "Pos": "FW", "Nation": "BRA", "Gls": 5, "Ast": 3}]
    )
    builder = LLMDescriptionBuilder(feature_columns=["Player", "Squad", "Pos", "Nation", "Gls", "Ast"])

    profiles = builder.build(df)

    assert profiles[0] == (
        "Player A plays for Team A as FW, represents BRA, and has season indicators: Gls=5, Ast=3."
    )
