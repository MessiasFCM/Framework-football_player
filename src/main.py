from __future__ import annotations

import argparse
from pathlib import Path
import re

from src.dataset.manager import load_excel_dataset
from src.dataset.manager import preprocess_player_dataframe
from src.dataset.manager import save_dataframe
from src.recs.dataloader.numeric_builder import NumericRepresentationBuilder
from src.recs.model.knn_model import KNNPlayerRecommender
from src.search.dataloader.profile_builder import PlayerProfileBuilder
from src.search.evaluation.evaluator import SearchEvaluator
from src.search.evaluation.reports import metrics_report_to_dataframe
from src.search.evaluation.reports import save_metrics_report
from src.search.evaluation.reports import save_report
from src.search.model.bm25_model import BM25SearchModel
from src.utils.config import load_config
from src.utils.logging import get_logger
from src.utils.paths import ensure_project_dirs, resolve_path


logger = get_logger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Football player search and recommendation framework")
    parser.add_argument(
        "--experiment",
        type=str,
        required=True,
        help="Path to the experiment JSON or YAML file.",
    )
    return parser.parse_args()


def run_recs_experiment(experiment_config: dict) -> Path:
    dataset_config = resolve_dataset_config(experiment_config)
    model_entry = experiment_config["model"][0]
    model_config = resolve_model_config(experiment_config["task_type"], model_entry)
    recs_config = experiment_config.get("recs", {})

    processed_df = load_and_process_dataset(dataset_config)

    numeric_builder = NumericRepresentationBuilder(
        feature_columns=dataset_config["numeric_columns"]
    )
    feature_matrix = numeric_builder.build(processed_df)

    recommender = KNNPlayerRecommender(
        n_neighbors=model_config.get("n_neighbors", 6),
        metric=model_config.get("metric", "euclidean"),
        algorithm=model_config.get("algorithm", "auto"),
    )
    recommender.fit(
        feature_matrix=feature_matrix,
        metadata=processed_df,
        player_column=dataset_config["id_column"],
    )

    results_df = recommender.query(
        player_name=recs_config["query_player"],
        top_k=recs_config.get("top_k", 5),
    )

    output_path = build_output_path(
        experiment_config=experiment_config,
        task_type="recs",
        model_name=model_entry["name"],
        explicit_filename=recs_config.get("output_file"),
    )
    save_dataframe(results_df, output_path)
    logger.info("Recommendation results saved to %s", output_path)

    return output_path


def run_search_experiment(experiment_config: dict) -> Path:
    dataset_config = resolve_dataset_config(experiment_config)
    model_entry = experiment_config["model"][0]
    model_config = resolve_model_config(experiment_config["task_type"], model_entry)
    model_params = extract_model_parameters(model_config)
    search_config = experiment_config.get("search", {})
    evaluation_config = experiment_config.get("evaluation", {})

    processed_df = load_and_process_dataset(dataset_config)
    profiled_df = build_profiled_dataset(
        processed_df,
        dataset_config,
        model_entry.get("text_strategy", search_config.get("text_strategy", "concat_labels")),
    )

    model_name = str(model_config["name"]).casefold()
    if model_name not in {"bm25", "bm25model"}:
        raise ValueError(f"Unsupported text search model: {model_name}")

    model = BM25SearchModel(
        k1=model_params.get("hyperparams", {}).get("k1", model_params.get("k1", 1.5)),
        b=model_params.get("hyperparams", {}).get("b", model_params.get("b", 0.75)),
    )
    fitted_model = model.fit(documents=profiled_df["player_profile"], metadata=profiled_df)
    save_profile_jsonl(profiled_df, sanitize_name(experiment_config["experiment_name"]))

    evaluation_path = run_search_evaluation(
        experiment_config=experiment_config,
        evaluation_config=evaluation_config,
        dataset_config=dataset_config,
        profiled_df=profiled_df,
        fitted_model=fitted_model,
    )
    if evaluation_path is not None:
        logger.info("Search evaluation saved to %s", evaluation_path)

    query_text = resolve_search_query(
        profiled_df=profiled_df,
        query_config=search_config,
        id_column=dataset_config["id_column"],
    )
    results_df = fitted_model.query(query_text=query_text, top_k=search_config.get("top_k", 10))

    if "query_player" in search_config:
        results_df = results_df[
            results_df[dataset_config["id_column"]].str.casefold()
            != str(search_config["query_player"]).casefold()
        ].reset_index(drop=True)

    results_df.insert(0, "query_text", query_text)
    results_df = select_result_columns(results_df, search_config.get("result_columns"))

    output_path = build_output_path(
        experiment_config=experiment_config,
        task_type="search",
        model_name=model_entry["name"],
        explicit_filename=search_config.get("output_file"),
    )
    save_dataframe(results_df, output_path)
    logger.info("Search results saved to %s", output_path)
    return output_path


def load_and_process_dataset(dataset_config: dict):
    raw_df = load_excel_dataset(dataset_config)
    processed_df = preprocess_player_dataframe(raw_df, dataset_config)

    processed_path = resolve_path("data/processed") / dataset_config["processed_filename"]
    save_dataframe(processed_df, processed_path)
    logger.info("Processed dataset saved to %s", processed_path)
    return processed_df


def build_profiled_dataset(processed_df, dataset_config: dict, text_strategy: str):
    profile_builder = PlayerProfileBuilder(
        strategy=text_strategy,
        feature_columns=dataset_config["text_columns"] + dataset_config["numeric_columns"],
    )
    profiled_df = processed_df.copy()
    profiled_df["document_id"] = build_document_ids(profiled_df)
    profiled_df["player_profile"] = profile_builder.build(processed_df)
    return profiled_df


def resolve_search_query(profiled_df, query_config: dict, id_column: str) -> str:
    if query_config.get("query_text"):
        return str(query_config["query_text"]).strip()

    if query_config.get("query_player"):
        matches = profiled_df[profiled_df[id_column].str.casefold() == str(query_config["query_player"]).casefold()]
        if matches.empty:
            raise ValueError(f"Player '{query_config['query_player']}' was not found in the processed dataset.")
        return str(matches.iloc[0]["player_profile"])

    raise ValueError("Search experiments require either 'query_text' or 'query_player'.")


def select_result_columns(results_df, configured_columns: list[str] | None):
    if not configured_columns:
        return results_df

    leading_columns = ["query_text"]
    trailing_columns = ["score", "player_profile"]
    selected_columns = [
        column
        for column in leading_columns + configured_columns + trailing_columns
        if column in results_df.columns
    ]
    return results_df.loc[:, selected_columns]


def resolve_dataset_config(experiment_config: dict) -> dict:
    dataset_entry = experiment_config["dataset"]
    config_path = dataset_entry.get("config")
    if config_path is None:
        config_path = f"configs/datasets/{dataset_entry['name']}.yaml"
    loaded_config = load_config(config_path)
    return loaded_config.get("dataset", loaded_config)


def resolve_model_config(task_type: str, model_entry: dict) -> dict:
    config_path = model_entry.get("config")
    if config_path is None:
        config_path = resolve_model_config_path(task_type, model_entry["name"])
    loaded_config = load_config(config_path)
    model_config = loaded_config.get("model", loaded_config)
    if "name" not in model_config:
        model_config["name"] = model_entry["name"]
    return model_config


def resolve_model_config_path(task_type: str, model_name: str) -> str:
    direct_path = resolve_path(f"configs/models/{task_type}/{model_name}.yaml")
    if direct_path.exists():
        return str(direct_path)

    models_dir = resolve_path(f"configs/models/{task_type}")
    normalized_target = sanitize_name(model_name)
    for candidate_path in sorted(models_dir.glob("*.yaml")):
        loaded_config = load_config(candidate_path)
        candidate_model = loaded_config.get("model", loaded_config)
        candidate_names = {
            sanitize_name(str(candidate_model.get("name", ""))),
            sanitize_name(str(candidate_model.get("model_name", ""))),
            sanitize_name(candidate_path.stem),
        }
        if normalized_target in candidate_names:
            return str(candidate_path)

    return str(direct_path)


def extract_model_parameters(model_config: dict) -> dict:
    parameters = model_config.get("parameters")
    if isinstance(parameters, dict):
        merged = parameters.copy()
        for key, value in model_config.items():
            if key == "parameters":
                continue
            merged.setdefault(key, value)
        return merged
    return model_config


def build_output_path(experiment_config: dict, task_type: str, model_name: str, explicit_filename: str | None) -> Path:
    output_dir = Path(experiment_config.get("output_dir", "outputs/results"))
    if not output_dir.is_absolute():
        output_dir = resolve_path(str(output_dir))

    if explicit_filename:
        filename = explicit_filename
    else:
        experiment_name = sanitize_name(experiment_config["experiment_name"])
        filename = f"{experiment_name}_{task_type}_{model_name}.csv"

    return output_dir / filename


def sanitize_name(value: str) -> str:
    sanitized = re.sub(r"[^a-z0-9]+", "_", value.casefold()).strip("_")
    return sanitized or "experiment"


def normalize_experiment_config(raw_config: dict) -> dict:
    if "experiment" not in raw_config:
        experiment = raw_config.copy()
        model_entries = experiment.get("model", [])
        if isinstance(model_entries, dict):
            experiment["model"] = [model_entries]
        return experiment

    legacy_config = raw_config["experiment"]
    experiment_name = legacy_config["name"]

    if experiment_name == "exp_knn":
        return {
            "experiment_name": experiment_name,
            "task_type": "recs",
            "output_dir": "outputs/results",
            "dataset": {"config": legacy_config["dataset_config"], "name": "football_players"},
            "model": [{"config": legacy_config["model_config"], "name": "knn"}],
            "recs": {
                "query_player": legacy_config["query_player"],
                "top_k": legacy_config["top_k"],
                "output_file": legacy_config["output_file"],
            },
        }

    if experiment_name == "exp_search_bm25_concat":
        return {
            "experiment_name": experiment_name,
            "task_type": "search",
            "output_dir": "outputs/results",
            "dataset": {"config": legacy_config["dataset_config"], "name": "football_players"},
            "model": [{
                "config": legacy_config["model_config"],
                "name": "bm25",
                "text_strategy": legacy_config.get("text_strategy", "concat_labels"),
            }],
            "search": {
                "query_text": legacy_config.get("query_text"),
                "query_player": legacy_config.get("query_player"),
                "top_k": legacy_config["top_k"],
                "output_file": legacy_config["output_file"],
                "result_columns": legacy_config.get("result_columns"),
            },
        }

    raise ValueError(f"Unsupported legacy experiment: {experiment_name}")


def run_search_evaluation(
    experiment_config: dict,
    evaluation_config: dict,
    dataset_config: dict,
    profiled_df,
    fitted_model: BM25SearchModel,
) -> Path | None:
    metrics = evaluation_config.get("metrics", [])
    top_ks = [int(value) for value in evaluation_config.get("top_ks", [])]
    if not metrics or not top_ks:
        return None

    id_column = dataset_config["id_column"]
    doc_id_column = "document_id"
    rankings: list[list[str]] = []
    relevance_sets: list[list[str]] = []
    per_query_rows: list[dict[str, object]] = []

    for _, row in profiled_df.iterrows():
        ranking_df = fitted_model.rank(str(row["player_profile"]))
        ranked_ids = ranking_df[doc_id_column].astype(str).tolist()
        rankings.append(ranked_ids)
        relevance_sets.append([str(row[doc_id_column])])

        rank_position = next(
            (rank for rank, candidate in enumerate(ranked_ids, start=1) if candidate == str(row[doc_id_column])),
            None,
        )
        per_query_rows.append(
            {
                "document_id": row[doc_id_column],
                "query_player": row[id_column],
                "relevant_player": row[id_column],
                "rank": rank_position,
                "top_1_document_id": ranked_ids[0] if ranked_ids else None,
                "top_1_player": ranking_df.iloc[0][id_column] if not ranking_df.empty else None,
                "top_5_document_ids": " | ".join(ranked_ids[: min(5, len(ranked_ids))]),
                "top_5_players": " | ".join(ranking_df[id_column].astype(str).tolist()[: min(5, len(ranking_df))]),
                "query_text": row["player_profile"],
            }
        )

    evaluator = SearchEvaluator()
    metrics_report = evaluator.evaluate(
        rankings=rankings,
        relevance_sets=relevance_sets,
        top_ks=top_ks,
        metrics=metrics,
    )

    experiment_name = sanitize_name(experiment_config["experiment_name"])
    metrics_json_path = resolve_path("outputs/results") / f"{experiment_name}_search_metrics.json"
    save_metrics_report(metrics_report, metrics_json_path)

    metrics_table = metrics_report_to_dataframe(metrics_report)
    metrics_csv_path = resolve_path("outputs/tables") / f"{experiment_name}_search_metrics.csv"
    save_report(metrics_table, metrics_csv_path)

    per_query_df = save_per_query_search_report(per_query_rows, experiment_name)
    logger.info("Per-query search report saved with %s rows", len(per_query_df))
    return metrics_json_path


def save_per_query_search_report(rows: list[dict[str, object]], experiment_name: str):
    import pandas as pd

    report_df = pd.DataFrame(rows)
    report_path = resolve_path("outputs/results") / f"{experiment_name}_search_queries.csv"
    save_report(report_df, report_path)
    return report_df


def save_profile_jsonl(profiled_df, experiment_name: str) -> None:
    output_path = resolve_path("outputs/results") / f"{experiment_name}_players_text.jsonl"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as file:
        for _, row in profiled_df.iterrows():
            record = {
                "document_id": str(row["document_id"]),
                "player": row.get("Player"),
                "squad": row.get("Squad"),
                "pos": row.get("Pos"),
                "nation": row.get("Nation"),
                "text": row.get("player_profile"),
            }
            import json

            file.write(json.dumps(record, ensure_ascii=False) + "\n")


def build_document_ids(profiled_df) -> list[str]:
    if "Rk" in profiled_df.columns:
        return [f"rk_{int(value)}" for value in profiled_df["Rk"].tolist()]

    document_ids: list[str] = []
    for index, row in profiled_df.reset_index(drop=True).iterrows():
        player = sanitize_name(str(row.get("Player", "player")))
        squad = sanitize_name(str(row.get("Squad", "club")))
        document_ids.append(f"{player}_{squad}_{index}")
    return document_ids


def main() -> None:
    ensure_project_dirs()
    args = parse_args()
    experiment_path = Path(args.experiment)
    experiment_config = normalize_experiment_config(load_config(experiment_path))

    logger.info("Running experiment: %s", experiment_config["experiment_name"])

    task_type = experiment_config["task_type"]

    if task_type == "search":
        run_search_experiment(experiment_config)
    elif task_type == "recs":
        run_recs_experiment(experiment_config)
    else:
        raise ValueError(f"Unsupported task type: {task_type}")


if __name__ == "__main__":
    main()
