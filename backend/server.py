from __future__ import annotations

import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from app.search_service import SearchService, INDEX_PATH  
from app.biencoder_service import BiEncoderService, EMB_PATH  

PORT = int(os.environ.get("PORT", "8000"))
DEFAULT_ENGINE = os.environ.get("ENGINE", "bm25").lower()
ENGINES: dict[str, object] = {}


def load_engines() -> None:
    try:
        print("Carregando BM25...")
        ENGINES["bm25"] = SearchService.load() if INDEX_PATH.exists() else SearchService()
        print(f"  bm25 OK ({ENGINES['bm25'].n} jogadores)")
    except Exception as exc:  
        print(f"  bm25 indisponivel: {exc}")

    if EMB_PATH.exists():
        try:
            print("Carregando bi-encoder (embeddings + modelo E5)...")
            svc = BiEncoderService.load()
            svc.warmup()
            ENGINES["biencoder"] = svc
            print(f"  biencoder OK ({svc.n} jogadores)")
        except Exception as exc:  
            print(f"  biencoder indisponivel: {exc}")
    else:
        print("  biencoder: embeddings nao encontrados — rode 'python train.py biencoder'")

    global DEFAULT_ENGINE
    if DEFAULT_ENGINE not in ENGINES and ENGINES:
        fallback = next(iter(ENGINES))
        print(f"Engine padrao '{DEFAULT_ENGINE}' indisponivel; usando '{fallback}'.")
        DEFAULT_ENGINE = fallback

class Handler(BaseHTTPRequestHandler):
    def _send(self, code: int, payload: dict | None) -> None:
        body = b"" if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if body:
            self.wfile.write(body)

    def do_OPTIONS(self) -> None:  
        self._send(204, None)

    def do_GET(self) -> None:
        if self.path.rstrip("/") == "/health":
            self._send(200, {
                "status": "ok",
                "engines": {name: svc.n for name, svc in ENGINES.items()},
                "default": DEFAULT_ENGINE,
            })
        else:
            self._send(404, {"error": "not found"})

    def do_POST(self) -> None:
        if self.path.rstrip("/") != "/search":
            self._send(404, {"error": "not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length) or b"{}")
            query = str(payload.get("query", "")).strip()
            top_k = int(payload.get("top_k", 10))
            engine = str(payload.get("engine", "")).strip().lower() or DEFAULT_ENGINE
        except (ValueError, json.JSONDecodeError):
            self._send(400, {"error": "JSON invalido"})
            return
        if not query:
            self._send(400, {"error": "query vazia"})
            return
        if engine not in ENGINES:
            self._send(400, {"error": f"engine '{engine}' indisponivel", "available": list(ENGINES)})
            return
        results = ENGINES[engine].search(query, top_k)
        self._send(200, {"query": query, "top_k": top_k, "engine": engine, "results": results})

    def log_message(self, fmt: str, *args) -> None:  
        sys.stderr.write("[ml] %s\n" % (fmt % args))


def main() -> None:
    load_engines()
    if not ENGINES:
        sys.exit("Nenhum motor de busca disponivel. Rode train.py primeiro.")
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"ml-service ouvindo em http://localhost:{PORT} | engines: {list(ENGINES)} | padrao: {DEFAULT_ENGINE}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nEncerrando.")
        server.shutdown()


if __name__ == "__main__":
    main()
