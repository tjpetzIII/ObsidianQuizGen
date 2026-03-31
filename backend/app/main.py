from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import auth, profile, quizzes, attempts

app = FastAPI(title="ObsidianQuiz API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(profile.router)
app.include_router(quizzes.router)
app.include_router(attempts.router)


@app.get("/health")
def health():
    return {"status": "ok"}
