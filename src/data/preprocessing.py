from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd


@dataclass
class DataPreprocessor:
    dataset_config: dict

    def fit(self, dataframe: pd.DataFrame) -> "DataPreprocessor":
        return self

    def transform(self, dataframe: pd.DataFrame) -> pd.DataFrame:
        df = dataframe.copy()
        df.columns = [self._normalize_column_name(column) for column in df.columns]

        expected_id_column = self.dataset_config["id_column"]
        if expected_id_column not in df.columns:
            raise KeyError(f"Required id column '{expected_id_column}' not found in dataset.")

        if self.dataset_config.get("drop_missing_player", True):
            df = df.dropna(subset=[expected_id_column])

        df[expected_id_column] = df[expected_id_column].astype(str).str.strip()
        df = df[df[expected_id_column] != ""].reset_index(drop=True)

        text_columns = [column for column in self.dataset_config["text_columns"] if column in df.columns]
        numeric_columns = [column for column in self.dataset_config["numeric_columns"] if column in df.columns]

        for column in text_columns:
            df[column] = df[column].fillna("Unknown").astype(str).str.strip()

        for column in numeric_columns:
            df[column] = self._coerce_numeric_series(df[column])

        df = df.drop_duplicates(subset=[expected_id_column, "Squad"] if "Squad" in df.columns else [expected_id_column])
        return df.reset_index(drop=True)

    def fit_transform(self, dataframe: pd.DataFrame) -> pd.DataFrame:
        return self.fit(dataframe).transform(dataframe)

    @staticmethod
    def _normalize_column_name(column_name: str) -> str:
        return str(column_name).strip()

    @staticmethod
    def _coerce_numeric_series(series: pd.Series) -> pd.Series:
        cleaned = (
            series.astype(str)
            .str.replace(",", "", regex=False)
            .str.replace(r"[^0-9\.\-]", "", regex=True)
            .replace("", np.nan)
        )
        numeric_series = pd.to_numeric(cleaned, errors="coerce")
        fill_value = numeric_series.median() if not numeric_series.dropna().empty else 0.0
        return numeric_series.fillna(fill_value)
