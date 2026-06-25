"""Vector search over chunk embeddings.

Embeddings live in the ``chunks`` table as JSON. For the scale of a personal
knowledge base, loading them into a numpy matrix and computing cosine similarity
is fast and keeps the stack to a single SQLite file (no external service).
Swapping in ChromaDB later only touches this module.
"""
from __future__ import annotations

import json
from dataclasses import dataclass

import numpy as np
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.document import Chunk


@dataclass
class SearchHit:
    chunk: Chunk
    score: float


def vectorstore_backend() -> str:
    return "sqlite-cosine"


def search(
    db: Session,
    query_embedding: list[float],
    top_k: int = 6,
    document_ids: list[int] | None = None,
) -> list[SearchHit]:
    stmt = select(Chunk).where(Chunk.embedding.is_not(None))
    if document_ids:
        stmt = stmt.where(Chunk.document_id.in_(document_ids))
    chunks = list(db.scalars(stmt))
    if not chunks:
        return []

    q = np.asarray(query_embedding, dtype=np.float32)
    q_norm = float(np.linalg.norm(q))
    if q_norm == 0:
        return []
    q = q / q_norm

    matrix = np.asarray(
        [json.loads(c.embedding) for c in chunks], dtype=np.float32
    )
    norms = np.linalg.norm(matrix, axis=1)
    norms[norms == 0] = 1.0
    matrix = matrix / norms[:, None]

    scores = matrix @ q  # cosine, both sides normalised
    order = np.argsort(-scores)[:top_k]
    return [SearchHit(chunk=chunks[i], score=float(scores[i])) for i in order]
