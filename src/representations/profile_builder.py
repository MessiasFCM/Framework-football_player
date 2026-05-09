from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from src.representations.llm_description_builder import LLMDescriptionBuilder
from src.representations.text_concat_builder import TextConcatBuilder


@dataclass
class PlayerProfileBuilder:
    strategy: str
    feature_columns: list[str]

    def build(self, dataframe: pd.DataFrame) -> list[str]:
        if self.strategy == "concat_labels":
            builder = TextConcatBuilder(feature_columns=self.feature_columns)
        elif self.strategy == "llm_description":
            builder = LLMDescriptionBuilder(feature_columns=self.feature_columns)
        else:
            raise ValueError(f"Unknown profile strategy: {self.strategy}")

        return builder.build(dataframe)
