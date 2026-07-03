# FutAnalytics — Football Player Search & Recommendation

Plataforma para busca textual e recomendação de jogadores de futebol das 10 principais ligas do mundo na temporada 2024-2025. Reúne o framework de ML (busca por BM25/bi-encoder e recomendação por KNN) desenvolvido na disciplina de Aprendizado de Máquina com o dashboard web (Next.js + Supabase) desenvolvido na disciplina de Tecnologias para Web, agora consolidados num único monorepo `frontend/` + `backend/`.

Explore mais de 6.000 jogadores com estatísticas completas, busca por perfil em linguagem natural, recomendações automáticas de jogadores similares e relatórios visuais de ranking e similaridade (com exportação em PDF).

## Participantes

- André Chagas Lima [Universidade Federal de São João del-Rei | andrechalima@aluno.ufsj.edu.br]
- Lucas Eduardo Bernardes de Paula [Universidade Federal de São João del-Rei | xxlucas0404xx@aluno.ufsj.edu.br]
- Messias Feres Curi Melo [Universidade Federal de São João del-Rei | messiasferes127@aluno.ufsj.edu.br]

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Banco de dados | Supabase (PostgreSQL + RLS) |
| Backend / ML | Python — BM25 e bi-encoder (E5) para busca, KNN para recomendação |
| PDF | jsPDF + jspdf-autotable |

## Estrutura

```text
Code-AM/
|-- frontend/                  # Dashboard Next.js
|   |-- app/                   # Rotas (pages)
|   |-- components/            # Componentes reutilizaveis (PlayerCard, Skeleton...)
|   |-- lib/                   # Auth, Supabase client, historico, geracao de PDF
|   |-- services/              # CRUDs Supabase por tabela
|   |-- scripts/               # Migracoes SQL e scripts utilitarios (fotos, RLS...)
|   `-- .env                   # Credenciais publicas do Supabase (versionadas)
|-- backend/                   # Servico HTTP de ML + framework de experimentacao
|   |-- app/                   # search_service.py, biencoder_service.py (usados pelo server.py)
|   |-- server.py              # HTTP server (POST /search, GET /health)
|   |-- train.py               # Reconstroi os indices (BM25 / bi-encoder) usados pelo server.py
|   |-- scripts/               # Scripts auxiliares (fotos, dataset de similares...)
|   |-- data/                  # Dataset processado + indices pre-compilados
|   |-- configs/               # Configuracoes de dataset e modelos (recs/search)
|   |-- experiments/           # Definicoes de experimentos (json)
|   |-- outputs/               # Resultados, tabelas e figuras gerados pelo framework
|   |-- preprocess/            # Scripts de geracao de tags e ground truth (heuristico/LLM)
|   `-- src/                   # Framework de ML: dataset, recs (KNN), search (BM25/bi-encoder)
`-- dev.sh                     # Sobe backend + frontend juntos
```

`backend/` acumula dois papeis: é o **serviço de ML** que o dashboard consome em tempo real (`server.py`, `train.py`, `app/`) e é também o **framework de experimentação** usado para treinar/avaliar os modelos offline (`src/`, `configs/`, `experiments/`, `preprocess/`).

## Requisitos

- [Node.js](https://nodejs.org/) v18+
- Python 3.10+
- Dependências do backend em `backend/requirements.txt`
- Para os scripts de `backend/preprocess` com LLM local: `backend/preprocess/requirements.txt`

## Como executar

### Tudo de uma vez

```bash
./dev.sh
```

Sobe o backend em **http://localhost:8000** e o frontend em **http://localhost:3000** (o frontend faz proxy de `/api/ml/*` para o backend).

### Frontend isolado

```bash
cd frontend
npm install
npm run dev
```

Acesse em **http://localhost:3000**. As credenciais do Supabase já estão em `frontend/.env`.

### Backend isolado

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python server.py
```

Sobe em **http://localhost:8000**. Os índices de busca já vêm pré-compilados em `backend/data/` (`bm25_index.pkl`, `biencoder_embeddings.npy`). Para reconstruí-los:

```bash
python train.py
```

## Dataset

O arquivo Excel principal (usado pelo framework de experimentação em `backend/src`) deve estar em um destes caminhos:

- `backend/data/raw/Top_10_Leagues_Player_Data_2024_2025.xlsx`
- `backend/data/raw/football_players/Top_10_Leagues_Player_Data_2024_2025.xlsx`

Configuração base: [backend/configs/datasets/football_players.yaml](backend/configs/datasets/football_players.yaml)

Se o arquivo não existir localmente, o projeto tenta baixar do Kaggle:

- `abhayr10/top-10-leagues-player-data2024-25`

Autenticação do Kaggle:

1. Colocar `kaggle.json` em `~/.config/kaggle/kaggle.json`
2. Ou definir `KAGGLE_USERNAME` e `KAGGLE_KEY`

## Funcionalidades do dashboard

- **Jogadores** — lista com filtros por nome, posição, time e liga; perfil completo com estatísticas por temporada
- **Busca por Perfil** — busca textual em linguagem natural (ex.: "atacante veloz com alto xG")
- **Recomendar Similares** — KNN estatístico para encontrar jogadores parecidos
- **Relatório de Ranking** — ranking por métrica (gols, assists, xG…) com download em PDF
- **Relatório de Similaridade** — comparativo tabular entre jogador de referência e similares, com download em PDF
- **Histórico de buscas** — últimas 5 buscas por tela, salvas no Supabase (usuário logado) ou `localStorage`
- **Autenticação** — cadastro com nome/e-mail/senha e login; sessão salva em `localStorage`

## Framework de experimentação (backend)

Pipeline usada para treinar e avaliar os modelos de busca e recomendação offline, independente do servidor web:

```bash
python -m src.main --experiment experiments/search_bm25_concat.json
```

Esse fluxo carrega o Excel, processa os dados e gera saídas em `data/processed/` e `outputs/results/` (caminhos relativos a `backend/`).

Exemplo de script em `preprocess/scripts`:

```bash
python preprocess/scripts/build_ground_truth_rules.py
```

Esse script gera as tags heurísticas em `preprocess/output/tags_rules.csv`.
