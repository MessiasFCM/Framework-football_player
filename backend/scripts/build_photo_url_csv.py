from __future__ import annotations

import csv
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
PROCESSED = PROJECT_ROOT / "data" / "processed"
MANIFEST = PROCESSED / "photos" / "_manifest.csv"
SRC = PROCESSED / "players_processed.csv"
DST = PROCESSED / "players_with_photo_url.csv"


def main() -> None:
    url_by_rk: dict[str, str] = {}
    with MANIFEST.open(encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            url_by_rk[r["rk"]] = r["image_url"]

    with SRC.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        fields = list(reader.fieldnames) + ["photo_url"]
        rows = list(reader)

    com = 0
    for row in rows:
        url = url_by_rk.get(row["Rk"], "")
        row["photo_url"] = url
        if url:
            com += 1

    with DST.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Arquivo gerado: {DST}")
    print(f"Total: {len(rows)} | com photo_url: {com} | sem: {len(rows) - com}")
    print("\nExemplos:")
    for row in rows[:3]:
        url = row["photo_url"] or "(sem foto)"
        print(f"  {row['Player']:22s} -> {url[:80]}")


if __name__ == "__main__":
    main()
