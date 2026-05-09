# Football Player Search and Recommendation Framework

Framework modular em Python para busca e recomendacao de jogadores com base em um arquivo Excel da temporada 2024-2025.

## Estrutura

```text
football-player-framework/
|- data/
|  |- raw/
|  |- processed/
|  `- queries/
|- configs/
|  |- datasets/
|  `- models/
|- experiments/
|- src/
|  |- dataset/
|  |- recs/
|  |  |- dataloader/
|  |  |- evaluation/
|  |  `- model/
|  `- search/
|     |- dataloader/
|     |- evaluation/
|     `- model/
|- outputs/
`- tests/
```

## Requisitos

- Python 3.10+
- pandas
- numpy
- scikit-learn
- pyyaml
- openpyxl
- tqdm
- pytest
- kaggle

## Instalacao

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Ou:

```bash
conda env create -f environment.yml
conda activate football-player-framework
```

## Execucao

Busca textual com `BM25` e perfil `concat_labels`:

```bash
python -m src.main --experiment experiments/search_bm25_concat.json
```

Recomendacao com `KNN`:

```bash
python -m src.main --experiment experiments/recs_knn.json
```

Os experimentos agora aceitam `JSON` ou `YAML`. O formato preferido e o JSON unificado, com campos como:

- `experiment_name`
- `task_type`
- `dataset`
- `model`
- `execution`
- `evaluation`
- `search` ou `recs`

## Dataset

O dataset principal fica em `data/raw/` e a configuracao base esta em [configs/datasets/football_players.yaml](/home/messias/projects/Framework-football_player/configs/datasets/football_players.yaml).

Se o arquivo nao existir localmente, o loader tenta baixar do Kaggle:

- `abhayr10/top-10-leagues-player-data2024-25`

Configure a autenticacao do Kaggle por um destes caminhos:

1. salvar `kaggle.json` em `~/.config/kaggle/kaggle.json`
2. definir `KAGGLE_USERNAME` e `KAGGLE_KEY`

Se preferir nao configurar Kaggle agora, coloque o arquivo Excel manualmente em:

- `data/raw/Top_10_Leagues_Player_Data_2024_2025.xlsx`
- ou `data/raw/football_players/Top_10_Leagues_Player_Data_2024_2025.xlsx`

## O que esta funcional hoje

- `search/model/bm25_model.py`: baseline de busca textual
- `search/dataloader/profile_builder.py`: `concat_labels` e mock `llm_description`
- `recs/model/knn_model.py`: baseline de recomendacao com `StandardScaler` + `NearestNeighbors`
- `dataset/manager.py`: carga, download, limpeza e padronizacao do Excel

## Testes

```bash
pytest -q
```
