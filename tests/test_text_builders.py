import pandas as pd

from src.search.dataloader.profile_builder import LLMDescriptionBuilder
from src.search.dataloader.profile_builder import TextConcatBuilder


def test_text_concat_builder_formats_profiles() -> None:
    df = pd.DataFrame([{"Player": "Player A", "Squad": "Team A", "Gls": 5}])
    builder = TextConcatBuilder(feature_columns=["Player", "Squad", "Gls"])

    profiles = builder.build(df)

    assert profiles == ["player (Player): Player A | club (Squad): Team A | goals (Gls): 5"]


def test_llm_description_builder_returns_deterministic_template() -> None:
    df = pd.DataFrame(
        [{"Player": "Player A", "Squad": "Team A", "Pos": "FW", "Nation": "BRA", "Gls": 5, "Ast": 3}]
    )
    builder = LLMDescriptionBuilder(feature_columns=["Player", "Squad", "Pos", "Nation", "Gls", "Ast"])

    profiles = builder.build(df)

    assert profiles[0] == (
        "Player A is a BRA football player who plays for Team A as a forward (FW). "
        "Attacking output: goals 5, assists 3."
    )
