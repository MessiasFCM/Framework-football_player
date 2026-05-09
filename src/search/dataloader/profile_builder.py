from __future__ import annotations

from dataclasses import dataclass
import re

import pandas as pd


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


def expand_position_value(value: object) -> str:
    raw_value = str(value).strip()
    if not raw_value:
        return raw_value

    codes = [code.strip() for code in re.split(r"[/,]", raw_value) if code.strip()]
    expanded_labels = [POSITION_ALIASES.get(code, code.casefold()) for code in codes]
    readable_value = ", ".join(expanded_labels)

    if readable_value.casefold() == raw_value.casefold():
        return raw_value

    return f"{readable_value} ({raw_value})"


@dataclass
class TextConcatBuilder:
    feature_columns: list[str]

    def build(self, dataframe: pd.DataFrame) -> list[str]:
        available_columns = [column for column in self.feature_columns if column in dataframe.columns]
        profiles: list[str] = []

        for _, row in dataframe.iterrows():
            segments = [self._build_segment(column, row[column]) for column in available_columns]
            profiles.append(" | ".join(segments))

        return profiles

    def _build_segment(self, column: str, value: object) -> str:
        label = LABEL_ALIASES.get(column, self._normalize_label(column))
        rendered_value = self._render_value(column, value)

        if label == column:
            return f"{label}: {rendered_value}"

        return f"{label} ({column}): {rendered_value}"

    def _render_value(self, column: str, value: object) -> str:
        if column == "Pos":
            expanded = expand_position_value(value)
            if expanded:
                return expanded

        return str(value)

    @staticmethod
    def _normalize_label(column: str) -> str:
        return str(column).strip().casefold().replace(" ", "_")


@dataclass
class LLMDescriptionBuilder:
    feature_columns: list[str]

    def build(self, dataframe: pd.DataFrame) -> list[str]:
        descriptions: list[str] = []
        for _, row in dataframe.iterrows():
            descriptions.append(self._build_description(row, dataframe.columns))

        return descriptions

    def _build_description(self, row: pd.Series, dataframe_columns: pd.Index) -> str:
        name = str(row.get("Player", "Unknown player")).strip()
        squad = str(row.get("Squad", "Unknown squad")).strip()
        position = expand_position_value(row.get("Pos", "Unknown position"))
        nation = str(row.get("Nation", "Unknown nation")).strip()
        age = self._format_optional_value(row.get("Age"))
        born = self._format_optional_value(row.get("Born"))

        opening = (
            f"{name} is a {nation} football player who plays for {squad} "
            f"as a {position}."
        )
        bio_bits = []
        if age:
            bio_bits.append(f"Age: {age}")
        if born:
            bio_bits.append(f"Born: {born}")

        metric_groups = []
        scoring = self._format_metric_group(
            row=row,
            dataframe_columns=dataframe_columns,
            columns=["Gls", "Ast", "xG", "xAG", "npxG", "xG+xAG"],
            prefix="Attacking output",
        )
        if scoring:
            metric_groups.append(scoring)

        progression = self._format_metric_group(
            row=row,
            dataframe_columns=dataframe_columns,
            columns=["PrgC", "PrgP", "PrgR"],
            prefix="Progression",
        )
        if progression:
            metric_groups.append(progression)

        workload = self._format_metric_group(
            row=row,
            dataframe_columns=dataframe_columns,
            columns=["MP", "Starts", "Min", "90s"],
            prefix="Usage",
        )
        if workload:
            metric_groups.append(workload)

        discipline = self._format_metric_group(
            row=row,
            dataframe_columns=dataframe_columns,
            columns=["CrdY", "CrdR"],
            prefix="Discipline",
        )
        if discipline:
            metric_groups.append(discipline)

        description_parts = [opening]
        if bio_bits:
            description_parts.append(" ".join(bio_bits) + ".")
        if metric_groups:
            description_parts.append(" ".join(metric_groups))
        return " ".join(description_parts).strip()

    def _format_metric_group(
        self,
        row: pd.Series,
        dataframe_columns: pd.Index,
        columns: list[str],
        prefix: str,
    ) -> str:
        parts: list[str] = []
        for column in columns:
            if column not in dataframe_columns:
                continue
            label = LABEL_ALIASES.get(column, column)
            value = self._format_optional_value(row.get(column))
            if value is None:
                continue
            parts.append(f"{label} {value}")

        if not parts:
            return ""

        return f"{prefix}: " + ", ".join(parts) + "."

    @staticmethod
    def _format_optional_value(value: object) -> str | None:
        if value is None:
            return None
        rendered = str(value).strip()
        if not rendered or rendered.lower() == "nan":
            return None
        return rendered


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
