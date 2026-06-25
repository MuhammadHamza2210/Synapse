"""Document, Chunk, Concept and Edge models — the knowledge base."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Document(Base):
    """A source document the user has ingested into their knowledge base."""

    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    filename: Mapped[str | None] = mapped_column(String(512))
    source_type: Mapped[str] = mapped_column(String(32), default="text")  # text|pdf|paste
    content: Mapped[str] = mapped_column(Text, default="")
    char_count: Mapped[int] = mapped_column(Integer, default=0)
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(32), default="ready")  # processing|ready|error
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    chunks: Mapped[list["Chunk"]] = relationship(
        back_populates="document", cascade="all, delete-orphan"
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "filename": self.filename,
            "source_type": self.source_type,
            "char_count": self.char_count,
            "chunk_count": self.chunk_count,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Chunk(Base):
    """A retrievable slice of a document, with its embedding vector."""

    __tablename__ = "chunks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    document_id: Mapped[int] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), index=True
    )
    index: Mapped[int] = mapped_column(Integer, default=0)  # order within the document
    text: Mapped[str] = mapped_column(Text, nullable=False)
    page: Mapped[int | None] = mapped_column(Integer)
    token_count: Mapped[int] = mapped_column(Integer, default=0)
    # Embedding stored as a JSON-encoded list of floats (works on plain SQLite).
    embedding: Mapped[str | None] = mapped_column(Text)

    document: Mapped["Document"] = relationship(back_populates="chunks")

    def to_citation(self) -> dict:
        return {
            "chunk_id": self.id,
            "document_id": self.document_id,
            "document_title": self.document.title if self.document else None,
            "page": self.page,
            "index": self.index,
            "snippet": (self.text[:280] + "…") if len(self.text) > 280 else self.text,
        }


class Concept(Base):
    """A node in the 3D Mind Palace — a salient concept extracted from documents."""

    __tablename__ = "concepts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    label: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    salience: Mapped[float] = mapped_column(Float, default=0.0)  # importance / size
    mentions: Mapped[int] = mapped_column(Integer, default=0)
    doc_count: Mapped[int] = mapped_column(Integer, default=0)
    category: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "label": self.label,
            "salience": round(self.salience, 4),
            "mentions": self.mentions,
            "doc_count": self.doc_count,
            "category": self.category,
        }


class Edge(Base):
    """A relationship between two concepts — an edge in the Mind Palace graph."""

    __tablename__ = "edges"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_id: Mapped[int] = mapped_column(
        ForeignKey("concepts.id", ondelete="CASCADE"), index=True
    )
    target_id: Mapped[int] = mapped_column(
        ForeignKey("concepts.id", ondelete="CASCADE"), index=True
    )
    weight: Mapped[float] = mapped_column(Float, default=1.0)
    kind: Mapped[str] = mapped_column(String(32), default="related")  # related|co-occurs

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "source": self.source_id,
            "target": self.target_id,
            "weight": round(self.weight, 4),
            "kind": self.kind,
        }
