from __future__ import annotations

from pathlib import Path

import yaml

from src.utils.paths import project_root


def load_yaml(path: str | Path) -> dict:
    yaml_path = Path(path)
    if not yaml_path.is_absolute():
        yaml_path = project_root() / yaml_path

    with yaml_path.open("r", encoding="utf-8") as file:
        return yaml.safe_load(file)
