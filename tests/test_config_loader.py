from __future__ import annotations

from pathlib import Path

from src.utils.config import load_config


def test_load_config_supports_json(tmp_path: Path) -> None:
    config_path = tmp_path / "experiment.json"
    config_path.write_text('{"task_type": "search", "model": [{"name": "bm25"}]}', encoding="utf-8")

    loaded = load_config(config_path)

    assert loaded["task_type"] == "search"
    assert loaded["model"][0]["name"] == "bm25"
