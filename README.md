# A Framework for Football Player Search

Framework em Python para busca textual e recomendação de jogadores com base em dados da temporada 2024-2025.

## Participantes

- André Chagas Lima [Universidade Federal de São João del-Rei | andrechalima@aluno.ufsj.edu.br]
- Lucas Eduardo Bernardes de Paula [Universidade Federal de São João del-Rei | xxlucas0404xx@aluno.ufsj.edu.br]
- Messias Feres Curi Melo [Universidade Federal de São João del-Rei | messiasferes127@aluno.ufsj.edu.br]

## Estrutura

```text
Code-AM/
|-- configs/
|-- data/
|   |-- raw/
|   `-- processed/
|-- experiments/
|-- outputs/
|-- preprocess/
|   |-- output/
|   `-- scripts/
`-- src/
    |-- dataset/
    |-- recs/
    |   |-- dataloader/
    |   |-- evaluation/
    |   `-- model/
    |-- search/
    |   |-- dataloader/
    |   |-- evaluation/
    |   `-- model/
    `-- utils/
```

## Requisitos

- Python 3.10+
- `pip` ou `conda`
- Dependências em `requirements.txt`
- Para scripts com LLM local: dependências em `preprocess/requirements.txt`

## Instalação

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Se for usar os scripts de `preprocess` com LLM local:

```bash
pip install -r preprocess/requirements.txt
```

## Dataset

O arquivo Excel principal deve estar em um destes caminhos:

- `data/raw/Top_10_Leagues_Player_Data_2024_2025.xlsx`
- `data/raw/football_players/Top_10_Leagues_Player_Data_2024_2025.xlsx`

Configuração base: [configs/datasets/football_players.yaml](C:/Users/MessiasFCM/OneDrive/Documentos/GitHub/Code-AM/configs/datasets/football_players.yaml)

Se o arquivo não existir localmente, o projeto tenta baixar do Kaggle:

- `abhayr10/top-10-leagues-player-data2024-25`

Autenticação do Kaggle:

1. Colocar `kaggle.json` em `~/.config/kaggle/kaggle.json`
2. Ou definir `KAGGLE_USERNAME` e `KAGGLE_KEY`

## Como rodar

Exemplo da pipeline principal:

```bash
python -m src.main --experiment experiments/search_bm25_concat.json
```

Esse fluxo carrega o Excel, processa os dados e gera saídas em `data/processed/` e `outputs/results/`.

Exemplo de `preprocess/scripts`:

```bash
python preprocess/scripts/build_ground_truth_rules.py
```

Esse script gera as tags heurísticas em `preprocess/output/tags_rules.csv`.
