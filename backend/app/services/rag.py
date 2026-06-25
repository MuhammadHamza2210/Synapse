"""Conversational RAG orchestrator.

A lightweight router decides how to answer each message:
  * grounded  — the question matches the user's documents → RAG with citations + pulse
  * general   — a real question with no relevant documents → answer from general
                knowledge, clearly flagged as not-from-your-library
  * chat      — small talk / identity / capability questions → natural conversation

It keeps short conversation memory so follow-ups ("explain more", "why?") work.
"""
from __future__ import annotations

import re

from sqlalchemy.orm import Session

from app.core.config import settings
from app.services import llm
from app.services.embeddings import embed_text, tokenize
from app.services.graph import concepts_in_text
from app.services.vectorstore import SearchHit, search

# A question is "grounded" only if it shares a keyword with the top passage AND has a
# minimum similarity — the lexical gate stops generic questions from being mis-grounded
# by the hashing embedding's spurious scores.
GROUND_MIN = 0.05

SYSTEM_PROMPT = (
    "You are Synapse, a study and research tutor. Using ONLY the numbered context "
    "passages, follow the user's instruction exactly — if they ask you to summarize, "
    "explain simply, compare, or list, do precisely that. Write a clear answer in your "
    "own words; do not copy passages verbatim. You may reference sources as [1], [2] "
    "where relevant. If the context does not contain the answer, say so plainly."
)

SYSTEM_GENERAL = (
    "You are Synapse, a warm, sharp AI study companion built into a personal knowledge "
    "app that turns the user's documents into a 3D knowledge graph. You answer questions "
    "about their uploaded documents with citations, and you can also chat naturally and "
    "answer general questions. Keep replies concise, friendly and well-structured, using "
    "light markdown when helpful. Never invent citations or pretend something came from "
    "their documents when it did not."
)

# (pattern, canned reply used only when no LLM is available)
SMALLTALK: list[tuple[re.Pattern, str]] = [
    (re.compile(r"\b(hi|hello|hey|yo|sup|howdy|good (morning|afternoon|evening))\b"),
     "Hey! 👋 I'm Synapse, your study companion. Ask me about your documents — or anything you're learning."),
    (re.compile(r"\bhow (are|r) (you|u)\b|how's it going|how are things|what'?s up"),
     "I'm doing great and ready to help! 😊 Ask me about your documents, or anything you're studying."),
    (re.compile(r"\b(thank|thanks|thx|appreciate)\b"),
     "You're welcome! 🙌 Happy to help — ask me anything else."),
    (re.compile(r"\bwho are you\b|\bwhat are you\b|your name"),
     "I'm **Synapse** — an AI study OS. I turn your documents into an explorable 3D knowledge graph and answer questions about them with citations. I can chat too!"),
    (re.compile(r"\bwhat can you do\b|\bhow do you work\b|\bhelp\b"),
     "I can: 📚 answer questions about your uploaded documents (with citations), 🧠 map them into a 3D Mind Palace, 🎴 build flashcards & quizzes, and 🗺️ plan a learning path. Try asking about something in your library!"),
    (re.compile(r"\b(bye|goodbye|see ya|see you|cya)\b"),
     "See you! 👋 Come back anytime to keep studying."),
]


def _build_context(hits: list[SearchHit]) -> str:
    blocks = []
    for i, hit in enumerate(hits, start=1):
        title = hit.chunk.document.title if hit.chunk.document else "document"
        page = f", p.{hit.chunk.page}" if hit.chunk.page else ""
        blocks.append(f"[{i}] (source: {title}{page})\n{hit.chunk.text}")
    return "\n\n".join(blocks)


def _extractive_answer(question: str, hits: list[SearchHit]) -> str:
    """Deterministic fallback used when no LLM key is configured.

    Picks the sentences from the retrieved passages most relevant to the question
    and stitches them into a short grounded answer with citation markers.
    """
    q_terms = set(re.findall(r"[a-z0-9]+", question.lower()))
    scored: list[tuple[float, int, str]] = []
    for i, hit in enumerate(hits, start=1):
        for sent in re.split(r"(?<=[.!?])\s+", hit.chunk.text):
            sent = sent.strip()
            if len(sent) < 30:
                continue
            terms = set(re.findall(r"[a-z0-9]+", sent.lower()))
            overlap = len(q_terms & terms)
            if overlap:
                scored.append((overlap / (1 + 0.01 * len(sent)), i, sent))
    scored.sort(key=lambda x: -x[0])
    top = scored[:4]
    if not top:
        return (
            "I couldn't find anything in your documents that answers that. "
            "Try ingesting more material or rephrasing the question."
        )
    lines = [f"- {sent} [{idx}]" for _, idx, sent in top]
    return (
        "Based on your documents:\n\n"
        + "\n".join(lines)
        + "\n\n_(Offline mode — run a local Ollama model for a fully written answer.)_"
    )


def build_user_prompt(question: str, hits: list[SearchHit]) -> str:
    return f"Context passages:\n\n{_build_context(hits)}\n\nQuestion: {question}"


def retrieve(
    db: Session,
    question: str,
    document_ids: list[int] | None = None,
) -> dict:
    """Run retrieval only: hits + citations + concepts that should pulse."""
    hits = search(db, embed_text(question), top_k=settings.top_k, document_ids=document_ids)
    if not hits:
        return {"hits": [], "citations": [], "concept_ids": []}

    citations = []
    for i, hit in enumerate(hits, start=1):
        c = hit.chunk.to_citation()
        c["marker"] = i
        c["score"] = round(hit.score, 4)
        citations.append(c)

    # concepts that pulse in 3D: from the question + only the strongest passages,
    # so a focused cluster lights up rather than the whole graph.
    top_score = hits[0].score
    strong = [h for h in hits if h.score >= max(0.12, top_score * 0.55)][:3]
    cited_text = question + " " + " ".join(h.chunk.text for h in strong)
    concept_ids = concepts_in_text(db, cited_text)[:16]

    return {"hits": hits, "citations": citations, "concept_ids": concept_ids}


def _concept_tokens(db: Session) -> set[str]:
    """The set of content words that make up the user's concept graph — the reliable
    vocabulary for deciding whether a question is actually about their documents."""
    from app.models.document import Concept

    tokens: set[str] = set()
    for (label,) in db.query(Concept.label).all():
        tokens.update(tokenize(label))
    return tokens


def classify(question: str, hits: list[SearchHit], concept_tokens: set[str]) -> str:
    """Route a message to 'chat', 'grounded' or 'general'."""
    q = question.strip().lower()
    for pattern, _ in SMALLTALK:
        if pattern.search(q):
            return "chat"
    # grounded only if the question references a real concept from the library AND the
    # vector search agrees — this avoids common words ("more", "who") false-grounding.
    if hits and hits[0].score >= GROUND_MIN:
        q_tokens = set(tokenize(question))
        if q_tokens & concept_tokens:
            return "grounded"
    return "general"


def _smalltalk_reply(question: str) -> str:
    q = question.lower()
    for pattern, reply in SMALLTALK:
        if pattern.search(q):
            return reply
    return "I'm here and ready to help! Ask me about your documents or anything you're studying."


def _history_block(history: list[tuple[str, str]] | None) -> str:
    if not history:
        return ""
    lines = [
        f"{'User' if role == 'user' else 'Synapse'}: {content}"
        for role, content in history[-6:]
    ]
    return "Recent conversation:\n" + "\n".join(lines) + "\n\n"


def plan(
    db: Session,
    question: str,
    history: list[tuple[str, str]] | None = None,
    document_ids: list[int] | None = None,
) -> dict:
    """Decide how to answer and return everything both endpoints need.

    Returns: route, system, user (LLM prompt), citations, concept_ids, fallback.
    """
    r = retrieve(db, question, document_ids)
    route = classify(question, r["hits"], _concept_tokens(db))

    if route == "grounded":
        return {
            "route": "grounded",
            "system": SYSTEM_PROMPT,
            "user": build_user_prompt(question, r["hits"]),
            "citations": r["citations"],
            "concept_ids": r["concept_ids"],
            "fallback": _extractive_answer(question, r["hits"]),
        }

    if route == "chat":
        return {
            "route": "chat",
            "system": SYSTEM_GENERAL,
            "user": _history_block(history) + f"User: {question}",
            "citations": [],
            "concept_ids": [],
            "fallback": _smalltalk_reply(question),
        }

    # general
    note = (
        "Nothing in the user's documents is relevant to this question. Answer from your "
        "own general knowledge, and make clear it is not from their library."
    )
    return {
        "route": "general",
        "system": SYSTEM_GENERAL,
        "user": _history_block(history) + note + f"\n\nUser: {question}",
        "citations": [],
        "concept_ids": [],
        "fallback": (
            "I couldn't find anything about that in your documents. With a local Ollama "
            "model running I can also answer general questions — or upload a document and ask again."
        ),
    }


def answer(
    db: Session,
    question: str,
    history: list[tuple[str, str]] | None = None,
    document_ids: list[int] | None = None,
) -> dict:
    p = plan(db, question, history, document_ids)
    provider, _ = llm.active_provider()
    text = llm.chat(p["system"], p["user"]) if provider else None
    mode = provider if text else ("extractive" if p["route"] == "grounded" else p["route"])
    if text is None:
        text = p["fallback"]
    return {
        "answer": text,
        "citations": p["citations"],
        "concept_ids": p["concept_ids"],
        "mode": mode,
        "route": p["route"],
    }
