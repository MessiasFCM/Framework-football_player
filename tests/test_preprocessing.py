import pandas as pd

from src.data.preprocessing import DataPreprocessor


def test_preprocessor_cleans_numeric_and_text_fields() -> None:
    config = {
        "id_column": "Player",
        "text_columns": ["Player", "Nation", "Squad"],
        "numeric_columns": ["Min", "Gls"],
        "drop_missing_player": True,
    }
    df = pd.DataFrame(
        {
            "Player": [" Alice ", None],
            "Nation": [" BRA ", "ARG"],
            "Squad": [" Team A ", "Team B"],
            "Min": ["1,234", "900"],
            "Gls": ["10*", None],
        }
    )

    processed = DataPreprocessor(config).fit_transform(df)

    assert processed.shape[0] == 1
    assert processed.loc[0, "Player"] == "Alice"
    assert processed.loc[0, "Nation"] == "BRA"
    assert processed.loc[0, "Min"] == 1234
    assert processed.loc[0, "Gls"] == 10
