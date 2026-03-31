#!/usr/bin/env bash
set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Helpers ───────────────────────────────────────────────────────────────────
info()    { echo -e "${CYAN}▸ $*${RESET}"; }
success() { echo -e "${GREEN}✓ $*${RESET}"; }
warn()    { echo -e "${YELLOW}⚠ $*${RESET}"; }
error()   { echo -e "${RED}✗ $*${RESET}" >&2; }
header()  { echo -e "\n${BOLD}$*${RESET}"; echo "$(printf '─%.0s' {1..50})"; }

prompt() {
  local var_name="$1"
  local label="$2"
  local default="${3:-}"
  local value

  if [[ -n "$default" ]]; then
    read -rp "  ${label} [${default}]: " value
    value="${value:-$default}"
  else
    read -rp "  ${label}: " value
    while [[ -z "$value" ]]; do
      error "This field is required."
      read -rp "  ${label}: " value
    done
  fi
  eval "$var_name=\"\$value\""
}

prompt_secret() {
  local var_name="$1"
  local label="$2"
  local value

  read -rsp "  ${label}: " value
  echo
  while [[ -z "$value" ]]; do
    error "This field is required."
    read -rsp "  ${label}: " value
    echo
  done
  eval "$var_name=\"\$value\""
}

# ── Banner ────────────────────────────────────────────────────────────────────
echo
echo -e "${BOLD}${CYAN}"
echo "  ╔═══════════════════════════════╗"
echo "  ║      ObsidianQuiz Setup       ║"
echo "  ╚═══════════════════════════════╝"
echo -e "${RESET}"
echo "  This script will:"
echo "  1. Check prerequisites"
echo "  2. Set up the Python backend"
echo "  3. Set up the Next.js frontend"
echo "  4. Configure environment variables"
echo "  5. Optionally start both dev servers"
echo

# ── Prerequisites ─────────────────────────────────────────────────────────────
header "Checking prerequisites"

check_cmd() {
  local cmd="$1"
  local name="${2:-$1}"
  local install_hint="${3:-}"
  if command -v "$cmd" &>/dev/null; then
    success "$name found: $(command -v "$cmd")"
  else
    error "$name not found."
    [[ -n "$install_hint" ]] && echo "  Install: $install_hint"
    exit 1
  fi
}

check_cmd python3 "Python 3" "https://python.org/downloads"
check_cmd node "Node.js" "https://nodejs.org"
check_cmd npm "npm" "bundled with Node.js"

PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
NODE_VERSION=$(node --version | sed 's/v//')

if python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3,11) else 1)' 2>/dev/null; then
  success "Python $PYTHON_VERSION (3.11+ required)"
else
  error "Python $PYTHON_VERSION detected. Python 3.11 or newer is required."
  exit 1
fi

if node -e 'process.exit(parseInt(process.version.slice(1)) >= 18 ? 0 : 1)' 2>/dev/null; then
  success "Node.js $NODE_VERSION (18+ required)"
else
  error "Node.js $NODE_VERSION detected. Node.js 18 or newer is required."
  exit 1
fi

# ── Environment variables ─────────────────────────────────────────────────────
header "Configuration"

echo -e "  ${YELLOW}You'll need the following from your Supabase project:${RESET}"
echo "  → Project Settings > API"
echo "    • Project URL"
echo "    • anon/public key"
echo "    • service_role key"
echo "    • JWT Secret"
echo
echo -e "  ${YELLOW}You'll also need:${RESET}"
echo "  → An Anthropic API key (console.anthropic.com)"
echo "  → A GitHub personal access token with 'repo' scope"
echo

BACKEND_ENV="$SCRIPT_DIR/backend/.env"
FRONTEND_ENV="$SCRIPT_DIR/frontend/.env.local"

# Load existing values as defaults if files already exist
load_env() {
  local file="$1"
  local key="$2"
  if [[ -f "$file" ]]; then
    grep -E "^${key}=" "$file" 2>/dev/null | cut -d'=' -f2- | tr -d '"' || true
  fi
}

EXISTING_SUPABASE_URL=$(load_env "$BACKEND_ENV" "SUPABASE_URL")
EXISTING_ANON_KEY=$(load_env "$FRONTEND_ENV" "NEXT_PUBLIC_SUPABASE_ANON_KEY")
EXISTING_API_URL=$(load_env "$FRONTEND_ENV" "API_URL")
EXISTING_FILE_PREFIX=$(load_env "$BACKEND_ENV" "FILE_PREFIX")

if [[ -f "$BACKEND_ENV" ]] || [[ -f "$FRONTEND_ENV" ]]; then
  warn "Existing .env files found — existing values will be used as defaults."
  echo
fi

echo -e "  ${BOLD}Supabase${RESET}"
prompt SUPABASE_URL    "Project URL (e.g. https://xxxx.supabase.co)" "$EXISTING_SUPABASE_URL"
prompt_secret SUPABASE_ANON_KEY         "Anon/public key"
prompt_secret SUPABASE_SERVICE_ROLE_KEY "Service role key"
prompt_secret SUPABASE_JWT_SECRET       "JWT Secret"

echo
echo -e "  ${BOLD}AI & GitHub${RESET}"
prompt_secret ANTHROPIC_API_KEY "Anthropic API key"
prompt_secret GITHUB_TOKEN      "GitHub personal access token (repo scope)"

echo
echo -e "  ${BOLD}Dev server URLs${RESET}"
prompt BACKEND_PORT "Backend port" "8000"
prompt FRONTEND_PORT "Frontend port" "3000"

BACKEND_URL="http://localhost:${BACKEND_PORT}"
FRONTEND_URL="http://localhost:${FRONTEND_PORT}"

# ── Write backend .env ────────────────────────────────────────────────────────
header "Writing backend/.env"

cat > "$BACKEND_ENV" <<EOF
SUPABASE_URL=${SUPABASE_URL}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
SUPABASE_JWT_SECRET=${SUPABASE_JWT_SECRET}
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
GITHUB_TOKEN=${GITHUB_TOKEN}
CORS_ORIGINS=${FRONTEND_URL}
EOF

success "Written: backend/.env"

# ── Write frontend .env.local ─────────────────────────────────────────────────
header "Writing frontend/.env.local"

cat > "$FRONTEND_ENV" <<EOF
NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
API_URL=${BACKEND_URL}
EOF

success "Written: frontend/.env.local"

# ── Backend setup ─────────────────────────────────────────────────────────────
header "Setting up Python backend"

VENV_DIR="$SCRIPT_DIR/backend/.venv"

if [[ -d "$VENV_DIR" ]]; then
  info "Virtual environment already exists, skipping creation."
else
  info "Creating virtual environment..."
  python3 -m venv "$VENV_DIR"
  success "Virtual environment created at backend/.venv"
fi

info "Installing Python dependencies..."
"$VENV_DIR/bin/pip" install --quiet --upgrade pip
"$VENV_DIR/bin/pip" install --quiet -r "$SCRIPT_DIR/backend/requirements.txt"
success "Python dependencies installed"

# ── Frontend setup ────────────────────────────────────────────────────────────
header "Setting up Next.js frontend"

if [[ -d "$SCRIPT_DIR/frontend/node_modules" ]]; then
  info "node_modules already exists, running npm install to sync..."
else
  info "Installing Node.js dependencies..."
fi

npm install --prefix "$SCRIPT_DIR/frontend" --silent
success "Node.js dependencies installed"

# ── Database reminder ─────────────────────────────────────────────────────────
header "Database setup"

echo -e "  ${YELLOW}Manual step required:${RESET}"
echo "  Run the SQL schema in your Supabase project to create tables and triggers."
echo
echo "  1. Open your Supabase project → SQL Editor"
echo "  2. Paste and run the contents of: ${BOLD}supabase/schema.sql${RESET}"
echo

read -rp "  Have you already run the schema? [y/N] " schema_done
schema_done="${schema_done:-N}"

if [[ ! "$schema_done" =~ ^[Yy]$ ]]; then
  warn "Don't forget to run supabase/schema.sql before using the app."
fi

# ── Launch ────────────────────────────────────────────────────────────────────
header "Done"

success "ObsidianQuiz is ready to run locally."
echo
echo "  To start manually:"
echo
echo -e "  ${BOLD}Backend:${RESET}"
echo "    cd backend"
echo "    source .venv/bin/activate"
echo "    uvicorn app.main:app --reload --port ${BACKEND_PORT}"
echo
echo -e "  ${BOLD}Frontend:${RESET}"
echo "    cd frontend"
echo "    npm run dev -- --port ${FRONTEND_PORT}"
echo

read -rp "  Start both dev servers now? [Y/n] " start_now
start_now="${start_now:-Y}"

if [[ "$start_now" =~ ^[Yy]$ ]]; then
  echo
  info "Starting backend on port ${BACKEND_PORT}..."
  info "Starting frontend on port ${FRONTEND_PORT}..."
  echo
  echo -e "  ${GREEN}Backend logs will appear below. Open ${BOLD}${FRONTEND_URL}${RESET}${GREEN} in your browser.${RESET}"
  echo -e "  Press ${BOLD}Ctrl+C${RESET} to stop both servers."
  echo

  # Start frontend in background, backend in foreground
  npm run dev --prefix "$SCRIPT_DIR/frontend" -- --port "$FRONTEND_PORT" &
  FRONTEND_PID=$!

  # Give frontend a moment to start
  sleep 1

  trap "kill $FRONTEND_PID 2>/dev/null; exit" INT TERM

  cd "$SCRIPT_DIR/backend"
  "$VENV_DIR/bin/uvicorn" app.main:app --reload --port "$BACKEND_PORT"

  wait "$FRONTEND_PID"
fi
