from pathlib import Path

import pandas as pd

from src.dataset.manager import detect_excel_file
from src.dataset.manager import get_dataset_directory
from src.dataset.manager import preprocess_player_dataframe


def test_dataset_alias_resolves_to_football_directory() -> None:
    dataset_dir = get_dataset_directory("football")

    assert dataset_dir.name == "football_players"


def test_detect_excel_file_prefers_largest_workbook(tmp_path: Path) -> None:
    small_file = tmp_path / "small.xlsx"
    large_file = tmp_path / "large.xlsx"

    small_file.write_bytes(b"123")
    large_file.write_bytes(b"123456789")

    detected = detect_excel_file(tmp_path)

    assert detected == large_file


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

    processed = preprocess_player_dataframe(df, config)

    assert processed.shape[0] == 1
    assert processed.loc[0, "Player"] == "Alice"
    assert processed.loc[0, "Nation"] == "BRA"
    assert processed.loc[0, "Min"] == 1234
    assert processed.loc[0, "Gls"] == 10
