from __future__ import annotations

import argparse
from pathlib import Path

from src.data.loader import load_excel_dataset, save_dataframe
from src.data.preprocessing import DataPreprocessor
from src.models.knn_model import KNNPlayerRecommender
from src.recommendation.similar_players import SimilarPlayersService
from src.representations.numeric_builder import NumericRepresentationBuilder
from src.representations.profile_builder import PlayerProfileBuilder
from src.utils.config import load_yaml
from src.utils.logging import get_logger
from src.utils.paths import ensure_project_dirs, resolve_path


logger = get_logger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Football player search and recommendation framework")
    parser.add_argument(
        "--experiment",
        type=str,
        required=True,
        help="Path to the experiment YAML file.",
    )
    return parser.parse_args()


def run_knn_experiment(experiment_config: dict) -> Path:
    dataset_config = load_yaml(experiment_config["dataset_config"])
    model_config = load_yaml(experiment_config["model_config"])

    raw_df = load_excel_dataset(dataset_config["dataset"])
    preprocessor = DataPreprocessor(dataset_config["dataset"])
    processed_df = preprocessor.fit_transform(raw_df)

    processed_path = resolve_path("data/processed") / dataset_config["dataset"]["processed_filename"]
    save_dataframe(processed_df, processed_path)
    logger.info("Processed dataset saved to %s", processed_path)

    numeric_builder = NumericRepresentationBuilder(
        feature_columns=dataset_config["dataset"]["numeric_columns"]
    )
    feature_matrix = numeric_builder.build(processed_df)

    recommender = KNNPlayerRecommender(
        n_neighbors=model_config["model"]["n_neighbors"],
        metric=model_config["model"]["metric"],
        algorithm=model_config["model"]["algorithm"],
    )
    recommender.fit(
        feature_matrix=feature_matrix,
        metadata=processed_df,
        player_column=dataset_config["dataset"]["id_column"],
    )

    service = SimilarPlayersService(recommender=recommender)
    results_df = service.find_similar_players(
        player_name=experiment_config["query_player"],
        top_k=experiment_config["top_k"],
    )

    output_path = resolve_path("outputs/results") / experiment_config["output_file"]
    save_dataframe(results_df, output_path)
    logger.info("Recommendation results saved to %s", output_path)

    return output_path


def run_text_experiment(experiment_config: dict) -> Path:
    dataset_config = load_yaml(experiment_config["dataset_config"])

    raw_df = load_excel_dataset(dataset_config["dataset"])
    preprocessor = DataPreprocessor(dataset_config["dataset"])
    processed_df = preprocessor.fit_transform(raw_df)
    processed_path = resolve_path("data/processed") / dataset_config["dataset"]["processed_filename"]
    save_dataframe(processed_df, processed_path)
    logger.info("Processed dataset saved to %s", processed_path)

    profile_builder = PlayerProfileBuilder(
        strategy=experiment_config["text_strategy"],
        feature_columns=dataset_config["dataset"]["text_columns"] + dataset_config["dataset"]["numeric_columns"],
    )
    profiled_df = processed_df.copy()
    profiled_df["player_profile"] = profile_builder.build(processed_df)

    output_path = resolve_path("outputs/results") / experiment_config["output_file"]
    save_dataframe(profiled_df, output_path)
    logger.info("Text profiles saved to %s", output_path)

    return output_path


def main() -> None:
    ensure_project_dirs()
    args = parse_args()
    experiment_path = Path(args.experiment)
    experiment_wrapper = load_yaml(experiment_path)
    experiment_config = experiment_wrapper["experiment"]

    logger.info("Running experiment: %s", experiment_config["name"])

    if experiment_config["name"] == "exp_knn":
        run_knn_experiment(experiment_config)
    elif experiment_config["name"] in {"exp_text_concat", "exp_text_llm"}:
        run_text_experiment(experiment_config)
    else:
        raise ValueError(f"Unsupported experiment: {experiment_config['name']}")


if __name__ == "__main__":
    main()
