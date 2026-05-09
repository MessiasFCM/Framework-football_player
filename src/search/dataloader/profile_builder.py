from __future__ import annotations

from dataclasses import dataclass
import re

import pandas as pd


@dataclass
class TextConcatBuilder:
    feature_columns: list[str]

    LABEL_ALIASES = {
        "Player": "player",
        "Nation": "nation",
        "Pos": "position",
        "Squad": "club",
        "Age": "age",
        "Born": "birth_year",
        "MP": "matches_played",
        "Starts": "starts",
        "Min": "minutes_played",
        "90s": "full_match_equivalents",
        "Gls": "goals",
        "Ast": "assists",
        "CrdY": "yellow_cards",
        "CrdR": "red_cards",
        "xG": "expected_goals",
        "xAG": "expected_assists",
        "npxG": "non_penalty_expected_goals",
        "xG+xAG": "expected_goal_involvements",
        "PrgC": "progressive_carries",
        "PrgP": "progressive_passes",
        "PrgR": "progressive_receptions",
    }
    POSITION_ALIASES = {
        "GK": "goalkeeper",
        "DF": "defender",
        "MF": "midfielder",
        "FW": "forward",
    }

    def build(self, dataframe: pd.DataFrame) -> list[str]:
        available_columns = [column for column in self.feature_columns if column in dataframe.columns]
        profiles: list[str] = []

        for _, row in dataframe.iterrows():
            segments = [self._build_segment(column, row[column]) for column in available_columns]
            profiles.append(" | ".join(segments))

        return profiles

    def _build_segment(self, column: str, value: object) -> str:
        label = self.LABEL_ALIASES.get(column, self._normalize_label(column))
        rendered_value = self._render_value(column, value)

        if label == column:
            return f"{label}: {rendered_value}"

        return f"{label} ({column}): {rendered_value}"

    def _render_value(self, column: str, value: object) -> str:
        if column == "Pos":
            expanded = self._expand_position_value(value)
            if expanded:
                return expanded

        return str(value)

    def _expand_position_value(self, value: object) -> str:
        raw_value = str(value).strip()
        if not raw_value:
            return raw_value

        codes = [code.strip() for code in re.split(r"[/,]", raw_value) if code.strip()]
        expanded_labels = [self.POSITION_ALIASES.get(code, code.casefold()) for code in codes]
        readable_value = ", ".join(expanded_labels)

        if readable_value.casefold() == raw_value.casefold():
            return raw_value

        return f"{readable_value} ({raw_value})"

    @staticmethod
    def _normalize_label(column: str) -> str:
        return str(column).strip().casefold().replace(" ", "_")


@dataclass
class LLMDescriptionBuilder:
    feature_columns: list[str]

    def build(self, dataframe: pd.DataFrame) -> list[str]:
        descriptions: list[str] = []
        for _, row in dataframe.iterrows():
            name = row.get("Player", "Unknown player")
            squad = row.get("Squad", "Unknown squad")
            position = row.get("Pos", "Unknown position")
            nation = row.get("Nation", "Unknown nation")

            metrics = []
            for column in self.feature_columns:
                if column in {"Player", "Squad", "Pos", "Nation"}:
                    continue
                if column in dataframe.columns:
                    metrics.append(f"{column}={row[column]}")

            metric_summary = ", ".join(metrics[:8])
            descriptions.append(
                f"{name} plays for {squad} as {position}, represents {nation}, and has season indicators: {metric_summary}."
            )

        return descriptions


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
