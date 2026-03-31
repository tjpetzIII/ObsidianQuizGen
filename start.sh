#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
RESET='\033[0m'

info()    { echo -e "${CYAN}▸ $*${RESET}"; }
success() { echo -e "${GREEN}✓ $*${RESET}"; }
error()   { echo -e "${RED}✗ $*${RESET}" >&2; }
warn()    { echo -e "${YELLOW}⚠ $*${RESET}"; }

# ── Preflight checks ──────────────────────────────────────────────────────────
if [[ ! -f "$SCRIPT_DIR/backend/.env" ]]; then
  error "backend/.env not found. Run ./setup.sh first."
  exit 1
fi

if [[ ! -f "$SCRIPT_DIR/frontend/.env.local" ]]; then
  error "frontend/.env.local not found. Run ./setup.sh first."
  exit 1
fi

if [[ ! -d "$SCRIPT_DIR/backend/.venv" ]]; then
  error "Python venv not found. Run ./setup.sh first."
  exit 1
fi

# ── Read ports from env files ─────────────────────────────────────────────────
# API_URL in frontend/.env.local tells us where the backend lives
BACKEND_PORT=$(grep -E '^API_URL=' "$SCRIPT_DIR/frontend/.env.local" | grep -oE ':[0-9]+' | tr -d ':' || true)
BACKEND_PORT="${BACKEND_PORT:-8000}"

# Frontend port from CORS_ORIGINS in backend/.env
FRONTEND_PORT=$(grep -E '^CORS_ORIGINS=' "$SCRIPT_DIR/backend/.env" | grep -oE ':[0-9]+' | tr -d ':' || true)
FRONTEND_PORT="${FRONTEND_PORT:-3000}"

# ── Banner ────────────────────────────────────────────────────────────────────
echo
echo -e "${BOLD}${CYAN}  ObsidianQuiz${RESET}"
echo
info "Backend  → http://localhost:${BACKEND_PORT}"
info "Frontend → http://localhost:${FRONTEND_PORT}"
echo
echo -e "  Press ${BOLD}Ctrl+C${RESET} to stop."
echo

# ── Cleanup on exit ───────────────────────────────────────────────────────────
PIDS=()

cleanup() {
  echo
  info "Shutting down..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
  success "Stopped."
}
trap cleanup INT TERM EXIT

# ── Start backend ─────────────────────────────────────────────────────────────
cd "$SCRIPT_DIR/backend"
"$SCRIPT_DIR/backend/.venv/bin/uvicorn" app.main:app --reload --port "$BACKEND_PORT" 2>&1 \
  | sed "s/^/$(printf '\033[0;36m')[backend]$(printf '\033[0m') /" &
PIDS+=($!)

# Wait for backend to be ready before starting frontend
info "Waiting for backend..."
for i in {1..30}; do
  if curl -sf "http://localhost:${BACKEND_PORT}/health" >/dev/null 2>&1; then
    success "Backend is ready."
    break
  fi
  if [ "$i" -eq 30 ]; then
    error "Backend failed to start after 30s. Check logs above."
    exit 1
  fi
  sleep 1
done

# ── Start frontend ────────────────────────────────────────────────────────────
cd "$SCRIPT_DIR/frontend"
npm run dev -- --port "$FRONTEND_PORT" 2>&1 \
  | sed "s/^/$(printf '\033[0;35m')[frontend]$(printf '\033[0m') /" &
PIDS+=($!)

# ── Wait ──────────────────────────────────────────────────────────────────────
wait
