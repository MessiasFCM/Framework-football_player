# Football Player Search and Recommendation Framework

Framework modular em Python para busca e recomendacao de jogadores de futebol a partir de uma base Excel com estatisticas da temporada 2024-2025.

## Estrutura

```text
football-player-framework/
|- data/
|- configs/
|- notebooks/
|- src/
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

## Instalacao

### Via `venv`

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

### Via Conda

```bash
conda env create -f environment.yml
conda activate football-player-framework
```

## Dados

1. Coloque o arquivo Excel bruto em `data/raw/`.
2. Ajuste o nome do arquivo em `configs/dataset_config.yaml`, se necessario.
3. A aba esperada por padrao e `AllCompDataset`.

## Execucao

O primeiro experimento funcional e o baseline KNN:

```bash
python -m src.main --experiment configs/experiments/exp_knn.yaml
```

Esse fluxo:

1. carrega a base Excel;
2. limpa e padroniza os dados;
3. gera vetores numericos;
4. treina/indexa um modelo KNN com `StandardScaler` + `NearestNeighbors`;
5. busca jogadores similares ao atleta definido no experimento;
6. salva os resultados em `outputs/results/`.

## Download Automatico Do Dataset

O projeto agora tenta baixar automaticamente o dataset do Kaggle quando o arquivo configurado nao existe em `data/raw/`.

Dataset configurado:

- `abhayr10/top-10-leagues-player-data2024-25`

Antes da primeira execucao, configure a autenticacao do Kaggle de uma destas formas:

1. baixe seu arquivo `kaggle.json` em Kaggle > Account > Create New Token e salve em `~/.kaggle/kaggle.json`;
2. ou defina as variaveis de ambiente `KAGGLE_USERNAME` e `KAGGLE_KEY`.

Na primeira execucao do experimento, o framework:

1. baixa o dataset com a API oficial do Kaggle;
2. extrai os arquivos em `data/raw/top-10-leagues-player-data2024-25/`;
3. localiza automaticamente o arquivo Excel principal;
4. copia esse arquivo para `data/raw/` e segue o pipeline normalmente.

## Estrategias Textuais

- `concat_labels`: concatena atributos e valores em texto controlado.
- `llm_description`: interface local e deterministica baseada em template, sem chamadas externas.

## Testes

```bash
pytest -q
```

## Observacoes

- Os arquivos processados sao salvos em `data/processed/`.
- Os resultados dos experimentos sao salvos em `outputs/results/`.
- Os modelos `Bi-encoder` e `SPLADE` estao preparados como stubs modulares para futuras extensoes.
