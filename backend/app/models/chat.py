"""Chat session and message models for the RAG tutor."""
from __future__ import annotations

import json
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255), default="New conversation")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    messages: Mapped[list["Message"]] = relationship(
        back_populates="session", cascade="all, delete-orphan", order_by="Message.id"
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "message_count": len(self.messages),
        }


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("chat_sessions.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(16))  # user|assistant
    content: Mapped[str] = mapped_column(Text)
    # JSON-encoded list of citation dicts and concept ids that lit up.
    citations_json: Mapped[str | None] = mapped_column(Text)
    concepts_json: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    session: Mapped["ChatSession"] = relationship(back_populates="messages")

    @property
    def citations(self) -> list[dict]:
        return json.loads(self.citations_json) if self.citations_json else []

    @citations.setter
    def citations(self, value: list[dict]) -> None:
        self.citations_json = json.dumps(value)

    @property
    def concept_ids(self) -> list[int]:
        return json.loads(self.concepts_json) if self.concepts_json else []

    @concept_ids.setter
    def concept_ids(self, value: list[int]) -> None:
        self.concepts_json = json.dumps(value)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "role": self.role,
            "content": self.content,
            "citations": self.citations,
            "concept_ids": self.concept_ids,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
