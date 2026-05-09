from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from src.models.knn_model import KNNPlayerRecommender
from src.search.retriever import Retriever


@dataclass
class SimilarPlayersService:
    recommender: KNNPlayerRecommender

    def find_similar_players(self, player_name: str, top_k: int = 5) -> pd.DataFrame:
        retriever = Retriever(model=self.recommender)
        return retriever.retrieve(player_name=player_name, top_k=top_k)
