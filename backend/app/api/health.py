"""Health and capability endpoints."""
from __future__ import annotations

from fastapi import APIRouter

from app.core.config import settings
from app.services.embeddings import embedding_backend
from app.services.llm import active_provider
from app.services.vectorstore import vectorstore_backend

router = APIRouter(tags=["system"])


@router.get("/health")
def health() -> dict:
    """Liveness probe + a summary of which optional backends are active."""
    provider, model = active_provider()
    return {
        "status": "ok",
        "app": settings.app_name,
        "version": settings.app_version,
        "capabilities": {
            "llm": provider or "offline",
            "model": model,
            "embeddings": embedding_backend(),
            "vector_store": vectorstore_backend(),
        },
    }
