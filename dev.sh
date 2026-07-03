set -uo pipefail
cd "$(dirname "$0")"

echo "→ ml-service (backend)  : http://localhost:8000"
( cd backend && python server.py ) &
BACK_PID=$!

cleanup() { echo; echo "Encerrando..."; kill "$BACK_PID" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

echo "→ frontend (Next.js)    : http://localhost:3000"
echo
cd frontend && npm run dev
