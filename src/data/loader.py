from __future__ import annotations

from pathlib import Path
import shutil

import pandas as pd

from src.utils.paths import resolve_path


def load_excel_dataset(dataset_config: dict) -> pd.DataFrame:
    raw_file = ensure_raw_dataset(dataset_config)
    return pd.read_excel(raw_file, sheet_name=dataset_config["sheet_name"], engine="openpyxl")


def ensure_raw_dataset(dataset_config: dict) -> Path:
    raw_file = resolve_path("data/raw") / dataset_config["raw_file"]
    if not raw_file.exists():
        source_config = dataset_config.get("source", {})
        if source_config.get("type") == "kaggle" and source_config.get("auto_download", False):
            raw_file = download_from_kaggle(dataset_config, source_config)
        else:
            raise FileNotFoundError(
                f"Excel file not found at {raw_file}. Place the raw dataset in data/raw/."
            )

    return raw_file


def download_from_kaggle(dataset_config: dict, source_config: dict) -> Path:
    try:
        from kaggle.api.kaggle_api_extended import KaggleApi
    except ImportError as exc:
        raise ImportError(
            "The 'kaggle' package is required for automatic downloads. Install the project dependencies first."
        ) from exc

    dataset_ref = source_config["dataset_ref"]
    download_dir = resolve_path("data/raw") / source_config.get("extract_subdir", dataset_ref.split("/")[-1])
    download_dir.mkdir(parents=True, exist_ok=True)

    api = KaggleApi()
    try:
        api.authenticate()
    except OSError as exc:
        raise RuntimeError(
            "Kaggle authentication was not found. Configure ~/.kaggle/kaggle.json or the "
            "KAGGLE_USERNAME and KAGGLE_KEY environment variables."
        ) from exc

    api.dataset_download_files(dataset=dataset_ref, path=str(download_dir), unzip=True, quiet=False)

    configured_file = download_dir / dataset_config["raw_file"]
    if configured_file.exists():
        promoted_path = resolve_path("data/raw") / dataset_config["raw_file"]
        if configured_file != promoted_path:
            shutil.copy2(configured_file, promoted_path)
        return promoted_path

    if source_config.get("auto_detect_downloaded_file", False):
        detected_file = detect_excel_file(download_dir)
        promoted_path = resolve_path("data/raw") / detected_file.name
        if detected_file != promoted_path:
            shutil.copy2(detected_file, promoted_path)
        return promoted_path

    raise FileNotFoundError(
        f"Dataset downloaded from Kaggle, but the configured file '{dataset_config['raw_file']}' was not found "
        f"in {download_dir}."
    )


def detect_excel_file(search_dir: Path) -> Path:
    excel_files = sorted(search_dir.rglob("*.xlsx")) + sorted(search_dir.rglob("*.xls"))
    if not excel_files:
        raise FileNotFoundError(f"No Excel file was found in downloaded dataset directory: {search_dir}")
    if len(excel_files) > 1:
        # Prefer the largest workbook when Kaggle publishes multiple auxiliary files.
        excel_files = sorted(excel_files, key=lambda path: path.stat().st_size, reverse=True)
    return excel_files[0]


def save_dataframe(dataframe: pd.DataFrame, output_path: str | Path) -> None:
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    dataframe.to_csv(output_path, index=False)
