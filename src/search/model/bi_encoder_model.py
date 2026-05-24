from __future__ import annotations

import os
from dataclasses import dataclass, field

os.environ.setdefault("TF_USE_LEGACY_KERAS", "1")

import numpy as np
import pandas as pd

from src.search.model.base_model import BaseSearchModel

try:
    import torch
    from sentence_transformers import SentenceTransformer
except ImportError:  # pragma: no cover - handled at runtime with a clearer error
    torch = None
    SentenceTransformer = None

try:
    from annoy import AnnoyIndex
except ImportError:  # pragma: no cover - annoy is optional at runtime
    AnnoyIndex = None

QUERY_PREFIX = "query: "
DOCUMENT_PREFIX = "passage: "


@dataclass
class BiEncoderSearchModel(BaseSearchModel):
    pretrained_name: str = "all-MiniLM-L6-v2"
    token_max_length: int = 128
    batch_size: int = 64
    normalize_embeddings: bool = True
    use_annoy: bool = True
    annoy_n_trees: int = 10
    annoy_metric: str = "angular"
    metadata_: pd.DataFrame | None = None
    documents_: list[str] = field(default_factory=list)
    embeddings_: np.ndarray | None = None
    annoy_index_: AnnoyIndex | None = None
    device_: str = field(init=False, default="cpu")
    model_: SentenceTransformer | None = field(init=False, default=None)

    def __post_init__(self) -> None:
        if torch is not None and torch.cuda.is_available():
            self.device_ = "cuda"

    def fit(self, documents: list[str] | pd.Series, metadata: pd.DataFrame) -> "BiEncoderSearchModel":
        self._ensure_dependencies()
        self.documents_ = [str(document) for document in documents]
        self.metadata_ = metadata.reset_index(drop=True).copy()
        self.model_ = self._load_model()
        self.embeddings_ = self._encode(self.documents_, text_type="document")

        if self.use_annoy and AnnoyIndex is not None and self.embeddings_.size > 0:
            self.annoy_index_ = self._build_annoy_index(self.embeddings_)
        else:
            self.annoy_index_ = None

        return self

    def query(self, query_text: str, top_k: int = 5) -> pd.DataFrame:
        self._ensure_fitted()

        query_embedding = self._encode([query_text], text_type="query")[0]
        top_k = max(1, min(int(top_k), len(self.documents_)))

        if self.annoy_index_ is not None:
            doc_ids, distances = self.annoy_index_.get_nns_by_vector(query_embedding, top_k, include_distances=True)
            scores = [float(1.0 - (distance**2 / 2.0)) for distance in distances]
            results = self.metadata_.iloc[doc_ids].copy()
            results["score"] = scores
            return results.reset_index(drop=True)

        scores = self._cosine_scores(query_embedding, self.embeddings_)
        top_indices = np.argsort(-scores)[:top_k]
        results = self.metadata_.iloc[top_indices].copy()
        results["score"] = scores[top_indices]
        return results.reset_index(drop=True)

    def rank(self, query_text: str) -> pd.DataFrame:
        self._ensure_fitted()

        query_embedding = self._encode([query_text], text_type="query")[0]
        scores = self._cosine_scores(query_embedding, self.embeddings_)
        ranking = self.metadata_.copy()
        ranking["score"] = scores
        ranking = ranking.sort_values(by="score", ascending=False, kind="stable")
        return ranking.reset_index(drop=True)

    def _ensure_dependencies(self) -> None:
        if SentenceTransformer is None:
            raise ImportError(
                "sentence-transformers is required for the bi-encoder model. "
                "Install the project dependencies again after updating requirements.txt."
            )

    def _ensure_fitted(self) -> None:
        if self.metadata_ is None or self.embeddings_ is None or self.model_ is None:
            raise RuntimeError("The bi-encoder model must be fitted before querying.")

    def _load_model(self) -> SentenceTransformer:
        model = SentenceTransformer(
            model_name_or_path=self.pretrained_name,
            device=self.device_,
        )
        model.max_seq_length = self.token_max_length
        return model

    def _encode(self, texts: list[str], text_type: str) -> np.ndarray:
        if self.model_ is None:
            raise RuntimeError("The bi-encoder model is not loaded.")

        prefix = QUERY_PREFIX if text_type == "query" else DOCUMENT_PREFIX
        prefixed_texts = [f"{prefix}{text}" for text in texts]
        embeddings = self.model_.encode(
            prefixed_texts,
            batch_size=self.batch_size,
            show_progress_bar=False,
            normalize_embeddings=self.normalize_embeddings,
            convert_to_numpy=True,
        )
        return np.asarray(embeddings, dtype="float32")

    def _build_annoy_index(self, embeddings: np.ndarray) -> AnnoyIndex:
        dim = int(embeddings.shape[1])
        index = AnnoyIndex(dim, self.annoy_metric)
        for idx, vector in enumerate(embeddings):
            index.add_item(idx, vector.tolist())
        index.build(self.annoy_n_trees)
        return index

    def _cosine_scores(self, query_embedding: np.ndarray, document_embeddings: np.ndarray) -> np.ndarray:
        query_norm = np.linalg.norm(query_embedding) + 1e-12
        doc_norms = np.linalg.norm(document_embeddings, axis=1) + 1e-12
        similarities = document_embeddings @ query_embedding
        return similarities / (doc_norms * query_norm)
