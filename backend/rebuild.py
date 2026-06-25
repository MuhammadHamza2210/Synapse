"""Recompute the concept graph for all existing documents.

Run this once after upgrading so your current library benefits from the improved
concept extraction (cleaner concepts → better Mind Palace, flashcards, quizzes, and
learning path). Your documents are NOT touched — only concepts/edges are rebuilt.

    python rebuild.py

Tip: stop the API server first so it isn't writing at the same time.
"""
from __future__ import annotations

from app.core.database import SessionLocal, init_db
from app.models.document import Concept, Document, Edge
from app.services.graph import rebuild_graph
from app.services.study import clear_cache


def main() -> None:
    init_db()
    db = SessionLocal()
    try:
        docs = db.query(Document).count()
        before = db.query(Concept).count()
        rebuild_graph(db)
        clear_cache()
        after = db.query(Concept).count()
        edges = db.query(Edge).count()
        print(f"Rebuilt graph from {docs} document(s).")
        print(f"  concepts: {before} -> {after}   edges: {edges}")
        print("Done. Restart the API server to see the cleaner graph everywhere.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
