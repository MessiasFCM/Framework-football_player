from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))


def train_bm25() -> None:
    from app.search_service import SearchService

    t0 = time.time()
    print("[bm25] construindo indice...")
    svc = SearchService()
    path = svc.save()
    print(f"[bm25] OK: {svc.n} jogadores, {len(svc.idf)} termos em {time.time() - t0:.1f}s "
          f"-> {path.name} ({path.stat().st_size / 1e6:.1f} MB)")


def train_biencoder() -> None:
    from app.biencoder_service import BiEncoderService

    t0 = time.time()
    print("[biencoder] codificando com E5 multilingue (pode levar ~3 min na CPU)...")
    svc = BiEncoderService()
    path = svc.save()
    print(f"[biencoder] OK: {svc.n} jogadores, dim={int(svc.embeddings.shape[1])} em {time.time() - t0:.0f}s "
          f"-> {path.name} ({path.stat().st_size / 1e6:.1f} MB)")


def main() -> None:
    which = (sys.argv[1] if len(sys.argv) > 1 else "both").lower()
    if which not in {"bm25", "biencoder", "both"}:
        sys.exit("uso: python train.py [bm25|biencoder|both]")
    if which in ("bm25", "both"):
        train_bm25()
    if which in ("biencoder", "both"):
        train_biencoder()


if __name__ == "__main__":
    main()
