from pathlib import Path

import pandas as pd

INPUT_CSV = Path("/home/andrelima/Projetos/Framework-football_player/llm/output/tags_llm.csv")

df = pd.read_csv(INPUT_CSV)
print(df["tag"].value_counts().to_string())
