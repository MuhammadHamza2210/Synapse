"""Learning Path — an ordered study roadmap built from the concept graph.

Each cluster becomes a *module*. Modules are ordered by centrality (your largest /
most-connected topics first). Within a module, concepts are ordered by where they are
first introduced in the source text — concepts defined earlier are usually the
foundations later ones build on, which mirrors how textbooks are written.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.document import Document
from app.services.study import _SENT_RE, _word_re, get_clusters

HINT_MAX = 160


def _first_sentence(label: str, text: str) -> str | None:
    pat = _word_re(label)
    for sent in _SENT_RE.split(text):
        sent = sent.strip()
        if pat.search(sent):
            return (sent[:HINT_MAX] + "…") if len(sent) > HINT_MAX else sent
    return None


def _rationale(order: int, total: int) -> str:
    if order == 1:
        return "Start here — your most central topic. Master these foundations first."
    if order == total:
        return "Finish strong — the most specialised topic in your library."
    return "Build breadth — foundational concepts first, then how they connect."


def get_learning_path(db: Session) -> dict:
    clusters = get_clusters(db)
    docs = list(db.scalars(select(Document)))
    if not clusters or not docs:
        return {"modules": [], "total_modules": 0, "total_steps": 0}

    modules: list[dict] = []
    for c in clusters:
        labels: list[str] = c["concepts"]

        # representative document = the one mentioning the most of this cluster's concepts
        rep = max(
            docs,
            key=lambda d: sum(1 for l in labels if l.lower() in d.content.lower()),
        )
        content = rep.content
        low = content.lower()

        def position(label: str) -> int:
            i = low.find(label.lower())
            return i if i >= 0 else 10**9

        # earlier-introduced concepts first; ties keep salience order (labels already ranked)
        ordered = sorted(enumerate(labels), key=lambda il: (position(il[1]), il[0]))

        steps = [
            {
                "label": label,
                "hint": _first_sentence(label, content),
                "source": rep.title,
            }
            for _, label in ordered
        ]

        modules.append(
            {
                "cluster_id": c["id"],
                "title": c["title"],
                "concept_count": len(labels),
                "steps": steps,
            }
        )

    total = len(modules)
    for i, m in enumerate(modules, start=1):
        m["order"] = i
        m["rationale"] = _rationale(i, total)

    return {
        "modules": modules,
        "total_modules": total,
        "total_steps": sum(m["concept_count"] for m in modules),
    }
