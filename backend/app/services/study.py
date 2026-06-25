"""Study tools — flashcards and quizzes generated per concept cluster.

A "cluster" is a connected component of the concept graph, which (because edges are
built from intra-document co-occurrence) maps naturally onto a topic. For each cluster
we gather the source passages that mention its concepts and turn them into:

  * flashcards  — a prompt on the front, a grounded answer on the back
  * quiz items  — multiple-choice questions with one correct answer + distractors

With an ANTHROPIC_API_KEY set, Claude writes higher-quality cards/questions from the
same grounded context. Without one, a deterministic generator uses definition lookups
and cloze deletion with distractors drawn from sibling concepts.
"""
from __future__ import annotations

import json
import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.document import Concept, Document, Edge
from app.services import llm

MIN_CLUSTER_SIZE = 2
_SENT_RE = re.compile(r"(?<=[.!?])\s+")

# simple in-process cache so repeated visits don't re-call the LLM
_cache: dict[tuple, list] = {}


# --------------------------------------------------------------------------- #
# Clustering
# --------------------------------------------------------------------------- #
def _union_find(concepts: list[Concept], edges: list[Edge]) -> dict[int, list[int]]:
    parent: dict[int, int] = {c.id: c.id for c in concepts}

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a: int, b: int) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb

    valid = set(parent)
    for e in edges:
        if e.source_id in valid and e.target_id in valid:
            union(e.source_id, e.target_id)

    groups: dict[int, list[int]] = {}
    for cid in parent:
        groups.setdefault(find(cid), []).append(cid)
    return groups


def get_clusters(db: Session) -> list[dict]:
    concepts = db.scalars(select(Concept)).all()
    if not concepts:
        return []
    by_id = {c.id: c for c in concepts}
    edges = db.scalars(select(Edge)).all()
    groups = _union_find(concepts, edges)

    clusters: list[dict] = []
    for members in groups.values():
        if len(members) < MIN_CLUSTER_SIZE:
            continue
        ranked = sorted(
            (by_id[m] for m in members), key=lambda c: c.salience, reverse=True
        )
        cluster_id = min(members)  # stable id for the component
        clusters.append(
            {
                "id": cluster_id,
                "title": " & ".join(c.label for c in ranked[:2]),
                "size": len(members),
                "concept_ids": [c.id for c in ranked],
                "concepts": [c.label for c in ranked[:10]],
                "salience": round(sum(c.salience for c in ranked), 1),
            }
        )
    clusters.sort(key=lambda c: c["salience"], reverse=True)
    return clusters


def _cluster_by_id(db: Session, cluster_id: int) -> dict | None:
    for c in get_clusters(db):
        if c["id"] == cluster_id:
            return c
    return None


# --------------------------------------------------------------------------- #
# Sentence + concept helpers
# --------------------------------------------------------------------------- #
def _word_re(label: str) -> re.Pattern:
    return re.compile(r"\b" + re.escape(label) + r"(es|s)?\b", re.IGNORECASE)


# concepts too generic to teach (belt-and-suspenders on top of the graph filter)
_STUDY_BLOCK = {
    "each", "ideas", "idea", "computes", "uses", "work", "works", "called", "found",
    "more", "this", "that", "his", "her", "its", "their", "them", "they", "thing",
}

_DEFN_HINT = re.compile(
    r"\b(is|are|was|were|refers? to|means|describes|consists|occurs|begins?|began)\b",
    re.IGNORECASE,
)


def _good_sentences(text: str) -> list[str]:
    """Split full document text into clean, complete sentences (no chunk fragments)."""
    text = re.sub(r"\s+", " ", text or "").strip()
    out: list[str] = []
    for s in _SENT_RE.split(text):
        s = s.strip()
        if 40 <= len(s) <= 300 and (s[0].isupper() or s[0].isdigit()):
            out.append(s)
    return out


def _corpus(db: Session, labels: list[str] | None) -> list[str]:
    """Complete, de-duplicated sentences from the documents relevant to the given
    concept labels (or every document when labels is None)."""
    lowered = [l.lower() for l in labels] if labels else None
    seen: set[str] = set()
    sentences: list[str] = []
    for (content,) in db.query(Document.content).all():
        if lowered and not any(l in (content or "").lower() for l in lowered):
            continue
        for s in _good_sentences(content):
            key = s.lower()
            if key not in seen:
                seen.add(key)
                sentences.append(s)
    return sentences


def _concept_sentences(label: str, sentences: list[str]) -> list[str]:
    """Complete sentences mentioning the concept, best (definitional, early) first."""
    pat = _word_re(label)
    hits = [s for s in sentences if pat.search(s)]

    def rank(s: str) -> tuple:
        m = pat.search(s)
        pos = m.start() if m else 999
        definitional = bool(_DEFN_HINT.match(s[m.end():].lstrip()[:18])) if m else False
        return (0 if definitional else 1, pos, len(s))

    return sorted(hits, key=rank)


def _study_labels(db: Session, concept_ids: list[int] | None) -> list[str]:
    """Study-worthy concept labels, most important first, with singular/plural
    duplicates collapsed (so "Cell" and "Cells" don't both appear)."""
    q = select(Concept).order_by(Concept.salience.desc())
    if concept_ids is not None:
        q = q.where(Concept.id.in_(concept_ids))
    labels: list[str] = []
    seen_norm: set[str] = set()
    for c in db.scalars(q):
        toks = c.label.lower().split()
        if len(c.label) < 4 or not any(t not in _STUDY_BLOCK for t in toks):
            continue
        norm = re.sub(r"(es|s)$", "", c.label.lower())
        if norm in seen_norm:
            continue
        seen_norm.add(norm)
        labels.append(c.label)
    return labels


# --------------------------------------------------------------------------- #
# Deterministic (offline) generators
# --------------------------------------------------------------------------- #
_FRONTS = ["What is {x}?", "Define {x}.", "Explain {x}.", "In your own words, what is {x}?"]


def _make_mcq(label: str, blanked: str, pool: list[str], seed: int) -> dict | None:
    distractors: list[str] = []
    n = len(pool)
    j = 0
    while len(distractors) < 3 and n:
        cand = pool[(seed * 3 + j) % n]
        if cand != label and cand not in distractors:
            distractors.append(cand)
        j += 1
        if j > n * 3:
            break
    if len(distractors) < 3:
        return None
    options = [label] + distractors
    rot = seed % 4
    options = options[-rot:] + options[:-rot] if rot else options
    return {
        "question": f"Fill in the blank: {blanked}",
        "options": options,
        "answer_index": options.index(label),
        "explanation": f"The correct answer is “{label}”.",
        "concept": label,
    }


def _build_cards_and_quiz(
    labels: list[str], sentences: list[str], distractor_pool: list[str], count: int
) -> tuple[list[dict], list[dict]]:
    csent = {l: _concept_sentences(l, sentences) for l in labels}
    teachable = [l for l in labels if csent[l]]

    used: set[str] = set()
    flashcards: list[dict] = []
    for i, label in enumerate(teachable[:count]):
        sentence = csent[label][0]
        used.add(sentence.lower())
        flashcards.append(
            {"front": _FRONTS[i % len(_FRONTS)].format(x=label), "back": sentence, "concept": label}
        )

    fc_concepts = {f["concept"] for f in flashcards}
    # quiz prefers concepts NOT on a flashcard so the two halves don't overlap
    order = [l for l in teachable if l not in fc_concepts] + [l for l in teachable if l in fc_concepts]
    quiz: list[dict] = []
    for i, label in enumerate(order):
        if len(quiz) >= count:
            break
        sentence = next((s for s in csent[label] if s.lower() not in used), None)
        if sentence is None and label in fc_concepts:
            continue  # would repeat the flashcard's sentence → skip
        sentence = sentence or csent[label][0]
        blanked = _word_re(label).sub("______", sentence, count=1)
        if "______" not in blanked:
            continue
        used.add(sentence.lower())
        q = _make_mcq(label, blanked, distractor_pool, i)
        if q:
            quiz.append(q)
    return flashcards, quiz


# --------------------------------------------------------------------------- #
# LLM generator (used when Ollama / Claude is available)
# --------------------------------------------------------------------------- #
def _llm_generate(title: str, labels: list[str], sentences: list[str], count: int) -> dict | None:
    context = "\n".join(f"- {s}" for s in sentences[:30])
    if not context.strip():
        return None
    system = (
        "You create study material as STRICT JSON only — no text outside the JSON. "
        "Use only the provided facts; never invent information."
    )
    user = (
        f"Topic: {title}\n"
        f"Important concepts: {', '.join(labels[:16])}\n\n"
        f"Facts you may use:\n{context}\n\n"
        f"Return ONLY JSON of this shape:\n"
        f'{{"flashcards":[{{"front":"clear question","back":"complete 1-2 sentence answer","concept":"X"}}],'
        f'"quiz":[{{"question":"...","options":["a","b","c","d"],"answer_index":0,"explanation":"...","concept":"X"}}]}}\n\n'
        f"Rules:\n"
        f"- Up to {count} flashcards and {count} quiz questions on the MOST IMPORTANT concepts.\n"
        f"- Never use the same concept in both a flashcard and a quiz question.\n"
        f"- Each flashcard back is a complete, self-contained explanation.\n"
        f"- Each quiz question has exactly 4 options, ONE correct (answer_index 0-3), with "
        f"plausible-but-wrong distractors that make the user think.\n"
        f"- Ignore filler words and pronouns; only teach real concepts."
    )
    raw = llm.chat(system, user, max_tokens=2200)
    if not raw:
        return None
    try:
        data = json.loads(raw[raw.find("{"): raw.rfind("}") + 1])
    except Exception:
        return None

    flashcards = [
        f
        for f in data.get("flashcards", [])
        if f.get("front") and f.get("back") and len(str(f["back"])) >= 20
    ][:count]
    fc_concepts = {str(f.get("concept", "")).lower() for f in flashcards}
    quiz = []
    for q in data.get("quiz", []):
        opts = q.get("options")
        if (
            isinstance(opts, list)
            and len(opts) == 4
            and isinstance(q.get("answer_index"), int)
            and 0 <= q["answer_index"] <= 3
            and str(q.get("concept", "")).lower() not in fc_concepts
        ):
            quiz.append(q)
    quiz = quiz[:count]
    if not flashcards and not quiz:
        return None
    return {"flashcards": flashcards, "quiz": quiz}


# --------------------------------------------------------------------------- #
# Public API
# --------------------------------------------------------------------------- #
MIXED_ID = 0  # synthetic cluster: study material drawn from ALL documents


def _resolve_target(db: Session, cluster_id: int) -> tuple[str, list[int] | None] | None:
    if cluster_id == MIXED_ID:
        return "Mixed — all topics", None
    cluster = _cluster_by_id(db, cluster_id)
    if cluster is None:
        return None
    return cluster["title"], cluster["concept_ids"]


def generate_study(db: Session, cluster_id: int, count: int = 8) -> dict:
    target = _resolve_target(db, cluster_id)
    if target is None:
        return {"cluster": None, "flashcards": [], "quiz": [], "mode": "missing"}
    title, concept_ids = target

    provider, _ = llm.active_provider()
    cache_key = (cluster_id, count, provider)
    if cache_key in _cache:
        return _cache[cache_key]

    labels = _study_labels(db, concept_ids)
    sentences = _corpus(db, labels if concept_ids is not None else None)
    all_labels = _study_labels(db, None)
    # tougher distractors: topically-related concepts first, then the rest
    distractors = labels + [l for l in all_labels if l not in labels]

    flashcards: list[dict] = []
    quiz: list[dict] = []
    mode = "extractive"

    if provider:
        generated = _llm_generate(title, labels, sentences, count)
        if generated and (generated["flashcards"] or generated["quiz"]):
            flashcards = generated["flashcards"]
            quiz = generated["quiz"]
            mode = provider

    if not flashcards or not quiz:
        fb_cards, fb_quiz = _build_cards_and_quiz(labels, sentences, distractors, count)
        flashcards = flashcards or fb_cards
        quiz = quiz or fb_quiz

    result = {
        "cluster": {"id": cluster_id, "title": title, "concepts": labels[:10]},
        "flashcards": flashcards,
        "quiz": quiz,
        "mode": mode,
    }
    _cache[cache_key] = result
    return result


def clear_cache() -> None:
    _cache.clear()
