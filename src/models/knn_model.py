from __future__ import annotations

from dataclasses import dataclass, field

import pandas as pd
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import StandardScaler

from src.models.base_model import BaseRetrievalModel


@dataclass
class KNNPlayerRecommender(BaseRetrievalModel):
    n_neighbors: int = 6
    metric: str = "euclidean"
    algorithm: str = "auto"
    scaler: StandardScaler = field(default_factory=StandardScaler)
    index: NearestNeighbors | None = None
    feature_matrix_: pd.DataFrame | None = None
    scaled_features_: pd.DataFrame | None = None
    metadata_: pd.DataFrame | None = None
    player_column_: str | None = None

    def fit(self, feature_matrix: pd.DataFrame, metadata: pd.DataFrame, player_column: str) -> "KNNPlayerRecommender":
        scaled = self.scaler.fit_transform(feature_matrix)
        self.index = NearestNeighbors(
            n_neighbors=min(self.n_neighbors, len(feature_matrix)),
            metric=self.metric,
            algorithm=self.algorithm,
        )
        self.index.fit(scaled)

        self.feature_matrix_ = feature_matrix.reset_index(drop=True)
        self.scaled_features_ = pd.DataFrame(scaled)
        self.metadata_ = metadata.reset_index(drop=True)
        self.player_column_ = player_column
        return self

    def query(self, player_name: str, top_k: int = 5) -> pd.DataFrame:
        if self.index is None or self.metadata_ is None or self.scaled_features_ is None or self.player_column_ is None:
            raise RuntimeError("The KNN model must be fitted before querying.")

        matches = self.metadata_[self.metadata_[self.player_column_].str.casefold() == player_name.casefold()]
        if matches.empty:
            raise ValueError(f"Player '{player_name}' was not found in the fitted metadata.")

        query_idx = matches.index[0]
        n_neighbors = min(top_k + 1, len(self.metadata_))
        distances, indices = self.index.kneighbors(
            self.scaled_features_.iloc[[query_idx]],
            n_neighbors=n_neighbors,
        )

        results = self.metadata_.iloc[indices[0]].copy()
        results["distance"] = distances[0]
        results = results[results[self.player_column_] != self.metadata_.iloc[query_idx][self.player_column_]]
        return results.head(top_k).reset_index(drop=True)
