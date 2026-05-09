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
    search_config = experiment_config.get("search", {})

    processed_df = load_and_process_dataset(dataset_config)
    profiled_df = build_profiled_dataset(
        processed_df,
        dataset_config,
        model_entry.get("text_strategy", search_config.get("text_strategy", "concat_labels")),
    )

    model_name = model_config["name"]
    if model_name != "bm25":
        raise ValueError(f"Unsupported text search model: {model_name}")

    model = BM25SearchModel(
        k1=model_config.get("k1", 1.5),
        b=model_config.get("b", 0.75),
    )
    fitted_model = model.fit(documents=profiled_df["player_profile"], metadata=profiled_df)

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
        config_path = f"configs/models/{task_type}/{model_entry['name']}.yaml"
    loaded_config = load_config(config_path)
    model_config = loaded_config.get("model", loaded_config)
    if "name" not in model_config:
        model_config["name"] = model_entry["name"]
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
