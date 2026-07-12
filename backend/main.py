"""FastAPI main application — AI TestGen Pro backend."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import init_db
from routes import analysis, url_inspect, testgen, automation, chat, history


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize DB tables on startup."""
    init_db()
    print("Database initialized")
    yield


app = FastAPI(
    title="AI TestGen Pro API",
    description="Backend API for AI-powered test case generation and automation.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow the Vite frontend (dev server)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://localhost:8081",
        "http://localhost:5173",
        "http://127.0.0.1:8080",
        "http://127.0.0.1:8081",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all route modules under /api
app.include_router(analysis.router, prefix="/api", tags=["Analysis"])
app.include_router(url_inspect.router, prefix="/api", tags=["URL Inspection"])
app.include_router(testgen.router, prefix="/api", tags=["Test Generation"])
app.include_router(automation.router, prefix="/api", tags=["Automation"])
app.include_router(chat.router, prefix="/api", tags=["Chat"])
app.include_router(history.router, prefix="/api", tags=["History"])


@app.get("/")
def root():
    return {
        "name": "AI TestGen Pro API",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health")
def health():
    return {"status": "ok"}
