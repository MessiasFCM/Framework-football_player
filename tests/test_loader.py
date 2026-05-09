from pathlib import Path

from src.data.loader import detect_excel_file


def test_detect_excel_file_prefers_largest_workbook(tmp_path: Path) -> None:
    small_file = tmp_path / "small.xlsx"
    large_file = tmp_path / "large.xlsx"

    small_file.write_bytes(b"123")
    large_file.write_bytes(b"123456789")

    detected = detect_excel_file(tmp_path)

    assert detected == large_file
