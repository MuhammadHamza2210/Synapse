"""Pydantic request/response models for the API layer."""
from __future__ import annotations

from pydantic import BaseModel, Field


class PasteRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=512)
    text: str = Field(..., min_length=1)


class DocumentOut(BaseModel):
    id: int
    title: str
    filename: str | None = None
    source_type: str
    char_count: int
    chunk_count: int
    status: str
    created_at: str | None = None


class ChatQuery(BaseModel):
    question: str = Field(..., min_length=1)
    session_id: int | None = None
    document_ids: list[int] | None = None


class Citation(BaseModel):
    marker: int
    chunk_id: int
    document_id: int
    document_title: str | None = None
    page: int | None = None
    snippet: str
    score: float


class ChatAnswer(BaseModel):
    session_id: int
    answer: str
    citations: list[Citation]
    concept_ids: list[int]
    mode: str


class SessionOut(BaseModel):
    id: int
    title: str
    created_at: str | None = None
    message_count: int


# --- auth ---
class AuthRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=6, max_length=128)


class UserOut(BaseModel):
    id: int
    email: str
    created_at: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ProgressUpdate(BaseModel):
    keys: list[str] = Field(default_factory=list)
