"""RAG chat endpoints."""
from __future__ import annotations

import json
import re
import time

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, get_db
from app.models.chat import ChatSession, Message
from app.realtime import manager
from app.schemas import ChatAnswer, ChatQuery, SessionOut
from app.services import llm, rag

router = APIRouter()


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


def _word_chunks(text: str):
    """Split text into small chunks so extractive answers also 'type' out."""
    for piece in re.findall(r"\S+\s*", text):
        yield piece


@router.get("/sessions", response_model=list[SessionOut])
def list_sessions(db: Session = Depends(get_db)):
    sessions = db.scalars(
        select(ChatSession).order_by(ChatSession.created_at.desc())
    ).all()
    return [s.to_dict() for s in sessions]


@router.post("/sessions", response_model=SessionOut, status_code=201)
def create_session(db: Session = Depends(get_db)):
    session = ChatSession(title="New conversation")
    db.add(session)
    db.commit()
    db.refresh(session)
    return session.to_dict()


@router.get("/sessions/{session_id}/messages")
def get_messages(session_id: int, db: Session = Depends(get_db)):
    session = db.get(ChatSession, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return [m.to_dict() for m in session.messages]


@router.delete("/sessions/{session_id}", status_code=204)
def delete_session(session_id: int, db: Session = Depends(get_db)):
    session = db.get(ChatSession, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    db.delete(session)
    db.commit()


@router.post("/query", response_model=ChatAnswer)
async def query(payload: ChatQuery, db: Session = Depends(get_db)):
    # resolve or create a session
    if payload.session_id is not None:
        session = db.get(ChatSession, payload.session_id)
        if session is None:
            raise HTTPException(status_code=404, detail="Session not found")
    else:
        session = ChatSession(title=payload.question[:48])
        db.add(session)
        db.flush()

    history = [(m.role, m.content) for m in session.messages]
    result = rag.answer(
        db, payload.question, history=history, document_ids=payload.document_ids
    )

    # persist the turn
    user_msg = Message(session_id=session.id, role="user", content=payload.question)
    assistant_msg = Message(
        session_id=session.id, role="assistant", content=result["answer"]
    )
    assistant_msg.citations = result["citations"]
    assistant_msg.concept_ids = result["concept_ids"]
    db.add_all([user_msg, assistant_msg])
    db.commit()

    # make the matching nodes pulse in the 3D Mind Palace
    if result["concept_ids"]:
        await manager.broadcast("concepts.pulse", {"concept_ids": result["concept_ids"]})

    return ChatAnswer(
        session_id=session.id,
        answer=result["answer"],
        citations=result["citations"],
        concept_ids=result["concept_ids"],
        mode=result["mode"],
    )


@router.post("/stream")
def query_stream(payload: ChatQuery):
    """Server-Sent Events: a `meta` event (citations + pulse), then `token` events,
    then a `done` event. Persists the turn once the stream completes."""

    def gen():
        db = SessionLocal()
        try:
            if payload.session_id is not None:
                session = db.get(ChatSession, payload.session_id)
                if session is None:
                    yield _sse({"type": "error", "detail": "Session not found"})
                    return
            else:
                session = ChatSession(title=payload.question[:48])
                db.add(session)
                db.flush()

            history = [(m.role, m.content) for m in session.messages]
            p = rag.plan(
                db, payload.question, history=history, document_ids=payload.document_ids
            )
            yield _sse(
                {
                    "type": "meta",
                    "session_id": session.id,
                    "citations": p["citations"],
                    "concept_ids": p["concept_ids"],
                }
            )

            parts: list[str] = []
            provider, _ = llm.active_provider()
            if provider:
                for tok in llm.chat_stream(p["system"], p["user"]):
                    parts.append(tok)
                    yield _sse({"type": "token", "text": tok})
            mode = provider if parts else (
                "extractive" if p["route"] == "grounded" else p["route"]
            )
            if not parts:
                for w in _word_chunks(p["fallback"]):
                    parts.append(w)
                    yield _sse({"type": "token", "text": w})
                    time.sleep(0.012)

            full = "".join(parts)
            db.add(Message(session_id=session.id, role="user", content=payload.question))
            assistant = Message(session_id=session.id, role="assistant", content=full)
            assistant.citations = p["citations"]
            assistant.concept_ids = p["concept_ids"]
            db.add(assistant)
            db.commit()

            yield _sse({"type": "done", "mode": mode, "session_id": session.id})
        finally:
            db.close()

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
