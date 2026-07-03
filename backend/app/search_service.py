from __future__ import annotations

import csv
import math
import re
from collections import Counter, defaultdict
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = BACKEND_ROOT / "data" / "processed"
CSV_WITH_URL = DATA_DIR / "players_with_photo_url.csv"
CSV_PLAIN = DATA_DIR / "players_processed.csv"
LLM_TEXT_JSONL = DATA_DIR / "players_text.jsonl"  
INDEX_PATH = BACKEND_ROOT / "data" / "bm25_index.pkl"  

TOKEN_PATTERN = re.compile(r"[a-z0-9]+(?:[.+-][a-z0-9]+)*")

STOPWORDS = {
    "a", "an", "and", "or", "the", "with", "of", "for", "to", "in", "on", "by", "at",
    "as", "is", "are", "be", "that", "this", "from",
    "com", "de", "da", "do", "das", "dos", "e", "ou", "o", "os", "um", "uma",
    "para", "que", "no", "na", "nos", "nas",
}

LABEL_ALIASES = {
    "Gls": "goals", "Ast": "assists", "xG": "expected_goals", "xAG": "expected_assists",
    "npxG": "non_penalty_expected_goals", "xG+xAG": "expected_goal_involvements",
    "PrgC": "progressive_carries", "PrgP": "progressive_passes", "PrgR": "progressive_receptions",
    "MP": "matches_played", "Starts": "starts", "Min": "minutes_played", "90s": "full_matches",
    "CrdY": "yellow_cards", "CrdR": "red_cards",
}
POSITION_ALIASES = {"GK": "goalkeeper", "DF": "defender", "MF": "midfielder", "FW": "forward"}

STAT_COLUMNS = ["Gls", "Ast", "xG", "xAG", "npxG", "xG+xAG", "PrgC", "PrgP", "PrgR",
                "MP", "Starts", "Min", "90s", "CrdY", "CrdR"]
QUANTILE_COLUMNS = ["Gls", "Ast", "xG", "xAG", "PrgC", "PrgP", "PrgR", "Min", "Starts", "90s"]
BUCKET_METRICS = [("Gls", "goals"), ("Ast", "assists"), ("xG", "expected_goals"),
                  ("xAG", "expected_assists"), ("PrgC", "progressive_carries"),
                  ("PrgP", "progressive_passes"), ("PrgR", "progressive_receptions"),
                  ("Min", "minutes_played")]

MIN_FULL_MATCHES = 10.0


def tokenize(text: str) -> list[str]:
    return [t for t in TOKEN_PATTERN.findall(str(text).casefold()) if t not in STOPWORDS]


def to_float(value: object) -> float:
    try:
        return float(str(value).replace(",", "").strip())
    except (ValueError, AttributeError):
        return 0.0


def expand_position(value: object) -> str:
    raw = str(value).strip()
    codes = [c.strip() for c in re.split(r"[/,]", raw) if c.strip()]
    labels = [POSITION_ALIASES.get(c, c.casefold()) for c in codes]
    return " ".join(labels)


def percentile(sorted_vals: list[float], p: float) -> float:
    if not sorted_vals:
        return 0.0
    k = (len(sorted_vals) - 1) * p
    lo, hi = math.floor(k), math.ceil(k)
    if lo == hi:
        return sorted_vals[int(k)]
    return sorted_vals[lo] * (hi - k) + sorted_vals[hi] * (k - lo)


class SearchService:
    def __init__(self, k1: float = 1.5, b: float = 0.75, build: bool = True) -> None:
        self.k1, self.b = k1, b
        if build:
            self.rows = self._load_rows()
            self.n = len(self.rows)
            self.llm_texts = self._load_llm_texts()
            quantile_map = self._build_quantile_map()
            documents = [self._build_document(row, quantile_map) for row in self.rows]
            self._fit(documents)

    def save(self, path: Path = INDEX_PATH) -> Path:
        import pickle

        state = {
            "version": 1, "k1": self.k1, "b": self.b, "n": self.n,
            "rows": self.rows, "doc_len": self.doc_len, "avgdl": self.avgdl,
            "idf": self.idf, "postings": dict(self.postings),
        }
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("wb") as f:
            pickle.dump(state, f, protocol=pickle.HIGHEST_PROTOCOL)
        return path

    @classmethod
    def load(cls, path: Path = INDEX_PATH) -> "SearchService":
        import pickle

        with path.open("rb") as f:
            state = pickle.load(f)
        svc = cls(k1=state["k1"], b=state["b"], build=False)
        svc.n = state["n"]
        svc.rows = state["rows"]
        svc.doc_len = state["doc_len"]
        svc.avgdl = state["avgdl"]
        svc.idf = state["idf"]
        svc.postings = state["postings"]
        return svc

    def _load_rows(self) -> list[dict]:
        path = CSV_WITH_URL if CSV_WITH_URL.exists() else CSV_PLAIN
        if not path.exists():
            raise FileNotFoundError(f"Dataset nao encontrado em {DATA_DIR}")
        with path.open(encoding="utf-8", newline="") as f:
            return list(csv.DictReader(f))

    def _load_llm_texts(self) -> dict[str, str]:
        import json

        texts: dict[str, str] = {}
        if not LLM_TEXT_JSONL.exists():
            return texts
        with LLM_TEXT_JSONL.open(encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    record = json.loads(line)
                    texts[str(record["rk"])] = record.get("text", "")
                except (json.JSONDecodeError, KeyError):
                    continue
        return texts

    def _build_quantile_map(self) -> dict[str, tuple[float, float, float]]:
        qmap: dict[str, tuple[float, float, float]] = {}
        for col in QUANTILE_COLUMNS:
            if col not in self.rows[0]:
                continue
            vals = sorted(to_float(r[col]) for r in self.rows)
            qmap[col] = (percentile(vals, 0.50), percentile(vals, 0.75), percentile(vals, 0.90))
        return qmap

    def _build_document(self, row: dict, qmap: dict) -> str:
        parts = [
            self.llm_texts.get(str(row.get("Rk", "")), ""), 
            str(row.get("Player", "")),
            str(row.get("Nation", "")),
            expand_position(row.get("Pos", "")),
            str(row.get("Squad", "")),
            f"age {row.get('Age', '')}",
        ]
        for col in STAT_COLUMNS:
            if col in row:
                parts.append(f"{LABEL_ALIASES.get(col, col)} {col} {row.get(col)}")
        parts.extend(self._build_tags(row, qmap))
        return " ".join(p for p in parts if p and p.strip())

    def _build_tags(self, row: dict, qmap: dict) -> list[str]:
        tags: list[str] = []
        nation = str(row.get("Nation", "")).strip()
        if nation:
            tags.append("nation_" + nation.casefold())
        for code in re.split(r"[/,]", str(row.get("Pos", ""))):
            code = code.strip()
            if code:
                tags.append("position_" + POSITION_ALIASES.get(code, code.casefold()))
        for col, label in BUCKET_METRICS:
            bucket = self._bucketize(col, row.get(col), qmap)
            if bucket:
                tags.append(f"{bucket}_{label}")
        starts, mp = to_float(row.get("Starts")), to_float(row.get("MP"))
        if mp > 0 and starts / mp >= 0.75:
            tags.append("regular_starter")
        elif starts > 0:
            tags.append("rotation_player")
        return tags

    @staticmethod
    def _bucketize(col: str, value: object, qmap: dict) -> str | None:
        if col not in qmap:
            return None
        v = to_float(value)
        q50, q75, q90 = qmap[col]
        if v >= q90:
            return "elite"
        if v >= q75:
            return "high"
        if v >= q50:
            return "medium"
        return "low"

    def _fit(self, documents: list[str]) -> None:
        self.doc_len: list[int] = []
        self.postings: dict[str, list[tuple[int, int]]] = defaultdict(list)
        document_frequency: Counter[str] = Counter()
        for idx, doc in enumerate(documents):
            tokens = tokenize(doc)
            self.doc_len.append(len(tokens))
            tf = Counter(tokens)
            for term, freq in tf.items():
                self.postings[term].append((idx, freq))
            document_frequency.update(tf.keys())
        self.avgdl = sum(self.doc_len) / self.n if self.n else 0.0
        self.idf = {
            term: math.log(1 + ((self.n - df + 0.5) / (df + 0.5)))
            for term, df in document_frequency.items()
        }

    def search(self, query: str, top_k: int = 10) -> list[dict]:
        query_terms = {t for t in tokenize(query) if t in self.idf}
        scores: dict[int, float] = defaultdict(float)
        matched: dict[int, int] = defaultdict(int)  
        for term in query_terms:
            idf = self.idf[term]
            for doc_idx, tf in self.postings[term]:
                denom = tf + self.k1 * (1 - self.b + self.b * (self.doc_len[doc_idx] / max(self.avgdl, 1.0)))
                scores[doc_idx] += idf * (tf * (self.k1 + 1)) / denom
                matched[doc_idx] += 1

        ranked = sorted(scores, key=lambda d: (matched[d], scores[d]), reverse=True)
        limit = max(top_k, 0)
        results = []
        for doc_idx in ranked:
            if len(results) >= limit:
                break
            row = self.rows[doc_idx]
            if to_float(row.get("90s")) <= MIN_FULL_MATCHES:
                continue
            item = dict(row)
            item["score"] = round(scores[doc_idx], 4)
            results.append(item)
        return results
