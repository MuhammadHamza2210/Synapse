"""Embeddings.

Default backend is a dependency-free hashing/TF embedding implemented with numpy,
so retrieval works on any machine with no model download and no API key. If
``sentence-transformers`` is installed it is used automatically for higher-quality
semantic embeddings.
"""
from __future__ import annotations

import hashlib
import math
import re
from functools import lru_cache

import numpy as np

from app.core.config import settings

_TOKEN_RE = re.compile(r"[a-z0-9]+")

# Lightweight stopword list — keeps the hashing embedding focused on content words.
_STOPWORDS = {
    "the", "a", "an", "and", "or", "but", "if", "then", "of", "to", "in", "on",
    "for", "with", "as", "by", "at", "from", "is", "are", "was", "were", "be",
    "been", "being", "it", "its", "this", "that", "these", "those", "we", "you",
    "they", "he", "she", "i", "not", "no", "do", "does", "did", "has", "have",
    "had", "can", "could", "would", "should", "will", "shall", "may", "might",
    "into", "than", "so", "such", "also", "which", "their", "there", "here",
}


def tokenize(text: str) -> list[str]:
    return [t for t in _TOKEN_RE.findall(text.lower()) if t not in _STOPWORDS and len(t) > 2]


@lru_cache(maxsize=1)
def _load_st_model():
    """Try to load sentence-transformers. Returns the model or None."""
    try:
        from sentence_transformers import SentenceTransformer

        return SentenceTransformer("all-MiniLM-L6-v2")
    except Exception:
        return None


def embedding_backend() -> str:
    return "sentence-transformers" if _load_st_model() is not None else "hashing-tf"


def _hash_token(token: str, dim: int) -> tuple[int, float]:
    """Map a token to a bucket index and a deterministic sign (+/-1)."""
    h = hashlib.md5(token.encode("utf-8")).digest()
    idx = int.from_bytes(h[:4], "little") % dim
    sign = 1.0 if h[4] & 1 else -1.0
    return idx, sign


def _hashing_embed(text: str) -> np.ndarray:
    dim = settings.embedding_dim
    vec = np.zeros(dim, dtype=np.float32)
    tokens = tokenize(text)
    if not tokens:
        return vec
    # term frequency with sub-linear damping
    counts: dict[str, int] = {}
    for tok in tokens:
        counts[tok] = counts.get(tok, 0) + 1
    for tok, count in counts.items():
        idx, sign = _hash_token(tok, dim)
        vec[idx] += sign * (1.0 + math.log(count))
    norm = float(np.linalg.norm(vec))
    if norm > 0:
        vec /= norm
    return vec


def embed_texts(texts: list[str]) -> list[list[float]]:
    model = _load_st_model()
    if model is not None:
        arr = model.encode(texts, normalize_embeddings=True)
        return [row.tolist() for row in np.asarray(arr, dtype=np.float32)]
    return [_hashing_embed(t).tolist() for t in texts]


def embed_text(text: str) -> list[float]:
    return embed_texts([text])[0]


def cosine(a: np.ndarray, b: np.ndarray) -> float:
    na = float(np.linalg.norm(a))
    nb = float(np.linalg.norm(b))
    if na == 0 or nb == 0:
        return 0.0
    return float(np.dot(a, b) / (na * nb))
