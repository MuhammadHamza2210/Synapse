"""Synapse API — FastAPI application entry point."""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, chat, documents, graph, health, path, progress, study
from app.core.config import settings
from app.core.database import init_db
from app.realtime import manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    _recover_interrupted_documents()
    yield


def _recover_interrupted_documents() -> None:
    """Any document left 'processing' from a previous run was interrupted → mark error."""
    from sqlalchemy import update

    from app.core.database import SessionLocal
    from app.models.document import Document

    db = SessionLocal()
    try:
        db.execute(
            update(Document).where(Document.status == "processing").values(status="error")
        )
        db.commit()
    finally:
        db.close()


app = FastAPI(
    title=f"{settings.app_name} API",
    version=settings.app_version,
    description="AI Study/Research OS with a 3D Mind Palace — RAG over your own documents.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(progress.router, prefix="/api/progress", tags=["progress"])
app.include_router(documents.router, prefix="/api/documents", tags=["documents"])
app.include_router(graph.router, prefix="/api/graph", tags=["graph"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(study.router, prefix="/api/study", tags=["study"])
app.include_router(path.router, prefix="/api/path", tags=["path"])

# Real-time channel used to make graph nodes pulse when the tutor cites them.
app.add_api_websocket_route("/ws", manager.endpoint)


@app.get("/")
def root() -> dict:
    return {
        "name": settings.app_name,
        "docs": "/docs",
        "health": "/health",
    }
