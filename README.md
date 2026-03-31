# ObsidianQuiz

Generate quizzes from your Obsidian notes automatically using AI. Connect your GitHub-hosted Obsidian vault, and ObsidianQuiz will read your recent note changes and create multiple choice and free text questions to test your knowledge.

## How it works

1. You push Obsidian notes to a GitHub repo
2. ObsidianQuiz fetches recent changes via the GitHub API
3. Claude generates quiz questions based on your note diffs
4. You take the quiz in the browser and get instant feedback
5. Free text answers are graded by AI with explanations

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, TypeScript, Tailwind CSS |
| Backend | Python, FastAPI |
| Database | Supabase (Postgres + Auth + RLS) |
| AI | Claude API (quiz generation + answer grading) |

## Prerequisites

- Python 3.11+
- Node.js 18+
- A [Supabase](https://supabase.com) project
- An [Anthropic API key](https://console.anthropic.com)
- A GitHub personal access token with `repo` scope
- An Obsidian vault pushed to a GitHub repository

## Quick start

```bash
# Clone the repo
git clone https://github.com/your-username/obsidianQuiz.git
cd obsidianQuiz

# Run the interactive setup (installs deps, configures env vars)
./setup.sh

# Start both servers
./start.sh
```

The setup script will prompt you for:
- Supabase project URL, anon key, service role key, and JWT secret
- Anthropic API key
- GitHub personal access token

It then creates the Python venv, installs all dependencies, and writes `backend/.env` and `frontend/.env.local`.

## Database setup

Run the schema against your Supabase project using the CLI:

```bash
supabase link --project-ref <your-project-ref>
supabase db query --linked -f supabase/schema.sql
```

Or paste the contents of `supabase/schema.sql` into the Supabase Dashboard SQL Editor.

This creates 5 tables (`profiles`, `quizzes`, `questions`, `attempts`, `answers`), row-level security policies, and a trigger that auto-creates a profile when a user signs up.

## Running locally

```bash
./start.sh
```

This starts:
- **Backend** at `http://localhost:8000` (FastAPI with hot reload)
- **Frontend** at `http://localhost:3000` (Next.js dev server)

The script waits for the backend health check before starting the frontend.

To run them separately:

```bash
# Backend
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm run dev -- --port 3000
```

## Project structure

```
obsidianQuiz/
  backend/
    app/
      main.py              # FastAPI app, CORS, router setup
      config.py             # Pydantic settings from .env
      dependencies.py       # JWT auth (ES256 via Supabase JWKS)
      routers/
        auth.py             # GET /auth/me
        profile.py          # GET/PUT /profile
        quizzes.py          # CRUD quizzes, trigger generation
        attempts.py         # Start attempts, submit answers
      services/
        github_service.py   # Fetch note diffs from GitHub
        quiz_generator.py   # Claude prompt + JSON parsing
        grader.py           # AI grading for free text answers
      models/               # Pydantic request/response schemas
      db/
        supabase_client.py  # Supabase Python client
    requirements.txt
    Procfile                # For Railway deployment
  frontend/
    app/
      page.tsx              # Landing page
      login/                # Email/password login
      signup/               # Registration
      dashboard/            # Quiz list + generation form
      profile/              # GitHub repo settings
      quizzes/[id]/         # Quiz detail
      quizzes/[id]/attempt/ # Question-by-question UI
      quizzes/[id]/results/ # Score + feedback
    lib/
      api.ts                # Typed fetch wrapper for backend
      supabase.ts           # Supabase browser client
    proxy.ts                # Auth guard (Next.js 16 proxy)
    next.config.ts          # Rewrites /api/* -> backend
  supabase/
    schema.sql              # Tables, RLS policies, triggers
  setup.sh                  # Interactive first-time setup
  start.sh                  # Start both dev servers
```

## API endpoints

All endpoints require a valid Supabase JWT in the `Authorization: Bearer` header.

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check (no auth) |
| GET | /auth/me | Current user profile |
| GET/PUT | /profile | Read/update repo settings |
| POST | /quizzes | Generate a new quiz |
| GET | /quizzes | List your quizzes |
| GET | /quizzes/:id | Quiz detail + status |
| GET | /quizzes/:id/questions | Questions (no answers) |
| DELETE | /quizzes/:id | Delete a quiz |
| POST | /quizzes/:id/attempts | Start an attempt |
| GET | /attempts/:id | Attempt status + score |
| POST | /attempts/:id/complete | Finish and calculate score |
| POST | /attempts/:id/answers | Submit an answer |
| GET | /attempts/:id/answers | All answers with feedback |

## Deployment

**Frontend** — deploy to [Vercel](https://vercel.com):
- Set root directory to `frontend/`
- Add env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `API_URL`

**Backend** — deploy to [Railway](https://railway.app):
- Set root directory to `backend/`
- Railway detects the `Procfile` automatically
- Add env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `ANTHROPIC_API_KEY`, `GITHUB_TOKEN`, `CORS_ORIGINS`

After deploying, update `API_URL` on Vercel to point to your Railway URL, and add your Vercel domain to `CORS_ORIGINS` on Railway.

## License

MIT
