from __future__ import annotations

import json
from pathlib import Path

import yaml

from src.utils.paths import project_root


def load_config(path: str | Path) -> dict:
    config_path = Path(path)
    if not config_path.is_absolute():
        config_path = project_root() / config_path

    with config_path.open("r", encoding="utf-8") as file:
        if config_path.suffix.lower() == ".json":
            return json.load(file)
        return yaml.safe_load(file)
