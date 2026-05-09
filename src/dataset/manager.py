from __future__ import annotations

from dataclasses import dataclass
import re
import shutil
from pathlib import Path
from typing import Dict, Iterable

import numpy as np
import pandas as pd

from src.utils.paths import project_root, resolve_path


@dataclass(frozen=True)
class DatasetSpec:
    name: str
    folder: str
    raw_file: str
    sheet_name: str
    required: tuple[str, ...]
    aliases: tuple[str, ...]
    source_type: str = "kaggle"
    source_ref: str = "abhayr10/top-10-leagues-player-data2024-25"


DATASETS: Dict[str, DatasetSpec] = {
    "football_players": DatasetSpec(
        name="football_players",
        folder="football_players",
        raw_file="Top_10_Leagues_Player_Data_2024_2025.xlsx",
        sheet_name="AllCompDataset",
        required=("Top_10_Leagues_Player_Data_2024_2025.xlsx",),
        aliases=("football", "footballplayers", "players", "soccer", "soccerplayers"),
    )
}


def _norm_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value or "").lower())


def _dataset_key(name: str) -> str:
    wanted = _norm_key(name)
    for key, spec in DATASETS.items():
        if wanted in {_norm_key(key), _norm_key(spec.folder)}:
            return key
        for alias in spec.aliases:
            if wanted == _norm_key(alias):
                return key
    raise KeyError(f"Unknown dataset '{name}'. Known datasets: {list(DATASETS)}")


def data_root() -> Path:
    return project_root() / "data"


def get_dataset_directory(name: str) -> Path:
    key = _dataset_key(name)
    return data_root() / "raw" / DATASETS[key].folder


def ensure_dataset(name: str, allow_download: bool = True) -> Path:
    key = _dataset_key(name)
    spec = DATASETS[key]
    dataset_dir = get_dataset_directory(key)

    if _required_exist(dataset_dir, spec.required):
        return dataset_dir

    promoted_file = resolve_path("data/raw") / spec.raw_file
    if promoted_file.exists():
        dataset_dir.mkdir(parents=True, exist_ok=True)
        target = dataset_dir / spec.raw_file
        if not target.exists():
            shutil.copy2(promoted_file, target)
        return dataset_dir

    if not allow_download:
        raise FileNotFoundError(
            f"Dataset '{key}' not found in {dataset_dir}. "
            f"Place '{spec.raw_file}' inside 'data/raw/{spec.folder}/' or 'data/raw/'."
        )

    if spec.source_type != "kaggle":
        raise RuntimeError(f"Unsupported source type for dataset '{key}': {spec.source_type}")

    return _download_from_kaggle(spec)


def resolve_dataset_file(dataset_config: dict) -> Path:
    configured_path = Path(dataset_config["raw_file"])
    if configured_path.is_absolute():
        if configured_path.exists():
            return configured_path
        raise FileNotFoundError(f"Excel file not found at {configured_path}.")

    dataset_name = dataset_config.get("name", "football_players")
    try:
        dataset_dir = ensure_dataset(dataset_name, allow_download=dataset_config.get("allow_download", True))
    except RuntimeError as exc:
        fallback_file = _find_fallback_excel_file(resolve_path("data/raw"))
        if fallback_file is not None:
            return fallback_file
        raise RuntimeError(
            "Dataset not found locally and the automatic Kaggle download could not start. "
            f"Place '{configured_path.name}' in 'data/raw/{dataset_name}/' or 'data/raw/', "
            "or configure ~/.config/kaggle/kaggle.json or the KAGGLE_USERNAME and KAGGLE_KEY "
            "environment variables."
        ) from exc

    dataset_candidate = dataset_dir / configured_path.name
    if dataset_candidate.exists():
        return dataset_candidate

    promoted_candidate = resolve_path("data/raw") / configured_path.name
    if promoted_candidate.exists():
        return promoted_candidate

    fallback_file = _find_fallback_excel_file(resolve_path("data/raw"))
    if fallback_file is not None:
        return fallback_file

    raise FileNotFoundError(
        f"Excel file '{configured_path.name}' was not found for dataset '{dataset_name}'."
    )


def load_excel_dataset(dataset_config: dict) -> pd.DataFrame:
    raw_file = resolve_dataset_file(dataset_config)
    return pd.read_excel(raw_file, sheet_name=dataset_config["sheet_name"], engine="openpyxl")


def preprocess_player_dataframe(dataframe: pd.DataFrame, dataset_config: dict) -> pd.DataFrame:
    df = dataframe.copy()
    df.columns = [str(column).strip() for column in df.columns]

    id_column = dataset_config["id_column"]
    if id_column not in df.columns:
        raise KeyError(f"Required id column '{id_column}' not found in dataset.")

    if dataset_config.get("drop_missing_player", True):
        df = df.dropna(subset=[id_column])

    df[id_column] = df[id_column].astype(str).str.strip()
    df = df[df[id_column] != ""].reset_index(drop=True)

    text_columns = [column for column in dataset_config["text_columns"] if column in df.columns]
    numeric_columns = [column for column in dataset_config["numeric_columns"] if column in df.columns]

    for column in text_columns:
        df[column] = df[column].fillna("Unknown").astype(str).str.strip()

    for column in numeric_columns:
        df[column] = _coerce_numeric_series(df[column])

    dedupe_columns = [id_column, "Squad"] if "Squad" in df.columns else [id_column]
    return df.drop_duplicates(subset=dedupe_columns).reset_index(drop=True)


def select_feature_columns(dataframe: pd.DataFrame, feature_columns: list[str]) -> pd.DataFrame:
    available_columns = [column for column in feature_columns if column in dataframe.columns]
    if not available_columns:
        raise ValueError("No configured feature columns were found in the dataframe.")
    return dataframe[available_columns].copy()


def save_dataframe(dataframe: pd.DataFrame, output_path: str | Path) -> None:
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    dataframe.to_csv(output_path, index=False)


def _required_exist(path: Path, required: Iterable[str]) -> bool:
    return path.is_dir() and all((path / rel).exists() for rel in required)


def _download_from_kaggle(spec: DatasetSpec) -> Path:
    try:
        from kaggle.api.kaggle_api_extended import KaggleApi
    except ImportError as exc:
        raise ImportError(
            "The 'kaggle' package is required for automatic downloads. Install the project dependencies first."
        ) from exc
    except OSError as exc:
        raise RuntimeError(
            "Kaggle authentication was not found. Configure "
            "~/.config/kaggle/kaggle.json or the KAGGLE_USERNAME and KAGGLE_KEY "
            "environment variables."
        ) from exc

    dataset_dir = get_dataset_directory(spec.name)
    dataset_dir.mkdir(parents=True, exist_ok=True)

    api = KaggleApi()
    try:
        api.authenticate()
    except OSError as exc:
        raise RuntimeError(
            "Kaggle authentication was not found. Configure "
            "~/.config/kaggle/kaggle.json or the KAGGLE_USERNAME and KAGGLE_KEY "
            "environment variables."
        ) from exc

    api.dataset_download_files(dataset=spec.source_ref, path=str(dataset_dir), unzip=True, quiet=False)

    dataset_file = dataset_dir / spec.raw_file
    if dataset_file.exists():
        promoted_path = resolve_path("data/raw") / spec.raw_file
        promoted_path.parent.mkdir(parents=True, exist_ok=True)
        if promoted_path != dataset_file:
            shutil.copy2(dataset_file, promoted_path)
        return dataset_dir

    detected_file = detect_excel_file(dataset_dir)
    target_file = dataset_dir / spec.raw_file
    if detected_file != target_file:
        shutil.copy2(detected_file, target_file)

    promoted_path = resolve_path("data/raw") / spec.raw_file
    promoted_path.parent.mkdir(parents=True, exist_ok=True)
    if promoted_path != target_file:
        shutil.copy2(target_file, promoted_path)
    return dataset_dir


def detect_excel_file(search_dir: Path) -> Path:
    excel_files = sorted(search_dir.rglob("*.xlsx")) + sorted(search_dir.rglob("*.xls"))
    if not excel_files:
        raise FileNotFoundError(f"No Excel file was found in dataset directory: {search_dir}")
    if len(excel_files) > 1:
        excel_files = sorted(excel_files, key=lambda path: path.stat().st_size, reverse=True)
    return excel_files[0]


def _find_fallback_excel_file(search_dir: Path) -> Path | None:
    if not search_dir.exists():
        return None
    try:
        return detect_excel_file(search_dir)
    except FileNotFoundError:
        return None


def _coerce_numeric_series(series: pd.Series) -> pd.Series:
    cleaned = (
        series.astype(str)
        .str.replace(",", "", regex=False)
        .str.replace(r"[^0-9\.\-]", "", regex=True)
        .replace("", np.nan)
    )
    numeric_series = pd.to_numeric(cleaned, errors="coerce")
    fill_value = numeric_series.median() if not numeric_series.dropna().empty else 0.0
    return numeric_series.fillna(fill_value)
