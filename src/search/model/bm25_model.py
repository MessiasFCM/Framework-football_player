from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field
import math
import re

import pandas as pd

from src.search.model.base_model import BaseSearchModel


@dataclass
class BM25SearchModel(BaseSearchModel):
    k1: float = 1.5
    b: float = 0.75
    token_pattern: str = r"[a-z0-9]+(?:[.+-][a-z0-9]+)*"
    metadata_: pd.DataFrame | None = None
    documents_: list[str] = field(default_factory=list)
    term_frequencies_: list[Counter[str]] = field(default_factory=list)
    document_lengths_: list[int] = field(default_factory=list)
    idf_: dict[str, float] = field(default_factory=dict)
    avg_document_length_: float = 0.0

    def fit(self, documents: list[str] | pd.Series, metadata: pd.DataFrame) -> "BM25SearchModel":
        self.documents_ = [str(document) for document in documents]
        self.metadata_ = metadata.reset_index(drop=True).copy()
        tokenized_documents = [self._tokenize(document) for document in self.documents_]
        self.term_frequencies_ = [Counter(tokens) for tokens in tokenized_documents]
        self.document_lengths_ = [len(tokens) for tokens in tokenized_documents]
        self.avg_document_length_ = (
            sum(self.document_lengths_) / len(self.document_lengths_) if self.document_lengths_ else 0.0
        )

        document_frequency: Counter[str] = Counter()
        for tokens in tokenized_documents:
            document_frequency.update(set(tokens))

        total_documents = len(tokenized_documents)
        self.idf_ = {
            term: math.log(1 + ((total_documents - frequency + 0.5) / (frequency + 0.5)))
            for term, frequency in document_frequency.items()
        }
        return self

    def query(self, query_text: str, top_k: int = 5) -> pd.DataFrame:
        if self.metadata_ is None or not self.documents_:
            raise RuntimeError("The BM25 model must be fitted before querying.")

        tokens = self._tokenize(query_text)
        if not tokens:
            raise ValueError("The search query produced no valid tokens.")

        scores = [self._score_document(tokens, index) for index in range(len(self.documents_))]
        results = self.metadata_.copy()
        results["score"] = scores
        results = results.sort_values(by="score", ascending=False, kind="stable")
        return results.head(top_k).reset_index(drop=True)

    def _score_document(self, query_tokens: list[str], document_index: int) -> float:
        document_term_frequency = self.term_frequencies_[document_index]
        document_length = self.document_lengths_[document_index]
        score = 0.0

        for token in query_tokens:
            term_frequency = document_term_frequency.get(token, 0)
            if term_frequency == 0:
                continue

            denominator = term_frequency + self.k1 * (
                1 - self.b + self.b * (document_length / max(self.avg_document_length_, 1.0))
            )
            score += self.idf_.get(token, 0.0) * ((term_frequency * (self.k1 + 1)) / denominator)

        return score

    def _tokenize(self, text: str) -> list[str]:
        return re.findall(self.token_pattern, str(text).casefold())
