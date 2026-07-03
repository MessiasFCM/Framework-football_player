from __future__ import annotations

import csv
import json
import pickle
from pathlib import Path

import numpy as np

BACKEND_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = BACKEND_ROOT / "data" / "processed"
CSV_WITH_URL = DATA_DIR / "players_with_photo_url.csv"
CSV_PLAIN = DATA_DIR / "players_processed.csv"
LLM_TEXT_JSONL = DATA_DIR / "players_text.jsonl"

EMB_PATH = BACKEND_ROOT / "data" / "biencoder_embeddings.npy"
META_PATH = BACKEND_ROOT / "data" / "biencoder_meta.pkl"

MODEL_NAME = "intfloat/multilingual-e5-small"
QUERY_PREFIX = "query: "
DOC_PREFIX = "passage: "


class BiEncoderService:
    def __init__(self, model_name: str = MODEL_NAME, build: bool = True) -> None:
        self.model_name = model_name
        self._model = None
        if build:
            self.rows = self._load_rows()
            self.n = len(self.rows)
            self.llm_texts = self._load_llm_texts()
            documents = [self._build_document(row) for row in self.rows]
            self.embeddings = self._encode(documents, DOC_PREFIX, show_progress=True)

    @property
    def model(self):
        if self._model is None:
            from sentence_transformers import SentenceTransformer

            self._model = SentenceTransformer(self.model_name)
        return self._model

    def warmup(self) -> None:
        self._encode(["ok"], QUERY_PREFIX)

    def _encode(self, texts: list[str], prefix: str, show_progress: bool = False) -> np.ndarray:
        prefixed = [prefix + t for t in texts]
        emb = self.model.encode(
            prefixed,
            batch_size=64,
            normalize_embeddings=True,   
            convert_to_numpy=True,
            show_progress_bar=show_progress,
        )
        return np.asarray(emb, dtype="float32")

    def _load_rows(self) -> list[dict]:
        path = CSV_WITH_URL if CSV_WITH_URL.exists() else CSV_PLAIN
        if not path.exists():
            raise FileNotFoundError(f"Dataset nao encontrado em {DATA_DIR}")
        with path.open(encoding="utf-8", newline="") as f:
            return list(csv.DictReader(f))

    def _load_llm_texts(self) -> dict[str, str]:
        texts: dict[str, str] = {}
        if not LLM_TEXT_JSONL.exists():
            return texts
        with LLM_TEXT_JSONL.open(encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    record = json.loads(line)
                    texts[str(record["rk"])] = record.get("text", "")
                except (json.JSONDecodeError, KeyError):
                    continue
        return texts

    def _build_document(self, row: dict) -> str:
        text = self.llm_texts.get(str(row.get("Rk", "")), "").strip()
        if text:
            return text
        return (
            f"{row.get('Player', '')}, {row.get('Pos', '')} do {row.get('Squad', '')}, "
            f"nacionalidade {row.get('Nation', '')}."
        )

    def search(self, query: str, top_k: int = 10) -> list[dict]:
        q = self._encode([query], QUERY_PREFIX)[0]        
        sims = self.embeddings @ q                        
        top_k = max(0, min(top_k, self.n))
        if top_k == 0:
            return []
        order = np.argpartition(-sims, top_k - 1)[:top_k] if top_k < self.n else np.arange(self.n)
        order = order[np.argsort(-sims[order])]
        results = []
        for i in order:
            item = dict(self.rows[int(i)])
            item["score"] = round(float(sims[int(i)]), 4)
            results.append(item)
        return results

    def save(self) -> Path:
        EMB_PATH.parent.mkdir(parents=True, exist_ok=True)
        np.save(EMB_PATH, self.embeddings)
        with META_PATH.open("wb") as f:
            pickle.dump({"model_name": self.model_name, "rows": self.rows, "n": self.n}, f)
        return EMB_PATH

    @classmethod
    def load(cls) -> "BiEncoderService":
        with META_PATH.open("rb") as f:
            meta = pickle.load(f)
        svc = cls(model_name=meta["model_name"], build=False)
        svc.rows = meta["rows"]
        svc.n = meta["n"]
        svc.embeddings = np.load(EMB_PATH)
        return svc
