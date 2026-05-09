from __future__ import annotations

from pathlib import Path


def project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def resolve_path(relative_path: str) -> Path:
    return project_root() / relative_path


def ensure_project_dirs() -> None:
    required_dirs = [
        "data/raw",
        "data/processed",
        "data/queries",
        "outputs/indexes",
        "outputs/results",
        "outputs/tables",
        "outputs/figures",
    ]
    for directory in required_dirs:
        resolve_path(directory).mkdir(parents=True, exist_ok=True)
