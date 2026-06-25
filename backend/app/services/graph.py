"""Concept-graph construction — the data behind the 3D Mind Palace.

For each ingested document we extract salient concepts (significant single words and
bigrams) and connect concepts that co-occur within the same chunk. Concepts and edges
are upserted so the graph grows and strengthens as more documents are added.
"""
from __future__ import annotations

from collections import Counter
from itertools import combinations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.document import Chunk, Concept, Document, Edge
from app.services.embeddings import tokenize

MAX_CONCEPTS_PER_DOC = 12
MIN_COUNT = 2

# Words that look frequent but are never useful concepts (pronouns, generic verbs,
# filler nouns/adverbs). A phrase made only of these is rejected.
CONCEPT_BLOCKLIST = {
    "his", "her", "its", "their", "they", "them", "this", "that", "these", "those",
    "him", "she", "our", "your", "who", "whom", "whose", "what", "when", "where",
    "why", "how", "which",
    "computes", "uses", "used", "using", "use", "work", "works", "working", "refers",
    "refer", "called", "call", "found", "find", "occurs", "occur", "produces",
    "produce", "contains", "contain", "makes", "make", "made", "means", "mean",
    "adds", "add", "passes", "pass", "become", "becomes", "came", "come", "gives",
    "give", "given", "takes", "take", "need", "needs", "help", "helps", "allow",
    "allows", "include", "includes", "including", "involves", "involve", "lets",
    "begin", "began", "begins", "grew", "grow", "led", "leads", "spread",
    "ideas", "idea", "thing", "things", "way", "ways", "part", "parts", "number",
    "numbers", "time", "times", "kind", "kinds", "type", "types", "form", "forms",
    "example", "examples", "result", "results", "amount", "level", "levels",
    "first", "second", "third", "many", "some", "more", "most", "other", "others",
    "also", "then", "here", "there", "much", "such", "very", "well", "even",
    # prepositions / connectives that survive tokenisation
    "through", "across", "within", "without", "upon", "toward", "towards", "among",
    "between", "during", "before", "after", "while", "since", "until", "against",
    "about", "above", "below", "over", "under", "along", "around", "behind",
    "beyond", "near", "via", "onto", "into",
    # vague verbs / gerunds / adjectives
    "reduce", "reduces", "reducing", "reduced", "producing", "produced", "produce",
    "increase", "increases", "increasing", "decrease", "following", "follow",
    "creating", "providing", "applying", "requiring", "national", "various",
    "common", "similar", "different", "important", "possible", "available",
    "certain", "general", "specific", "single", "multiple", "several", "entire",
    "whole", "main", "basic", "particular", "significant",
}


def _is_meaningful(phrase: str) -> bool:
    words = phrase.split()
    if all(w in CONCEPT_BLOCKLIST for w in words):
        return False
    if len(words) == 1:
        w = words[0]
        if w in CONCEPT_BLOCKLIST or len(w) < 4 or (w.isdigit() and len(w) != 4):
            return False
    return True


def _candidate_scores(text: str) -> Counter:
    """Score candidate concept phrases (unigrams + bigrams) by frequency."""
    tokens = tokenize(text)
    scores: Counter = Counter()
    for tok in tokens:
        scores[tok] += 1
    # bigrams of adjacent content tokens carry more meaning → weight them up
    for a, b in zip(tokens, tokens[1:]):
        scores[f"{a} {b}"] += 1.6
    return scores


def _select_concepts(text: str) -> list[str]:
    scores = _candidate_scores(text)
    ranked = [
        phrase
        for phrase, score in scores.most_common(80)
        if score >= MIN_COUNT and _is_meaningful(phrase)
    ]
    # prefer bigrams, then drop unigrams already covered by a kept bigram
    bigrams = [p for p in ranked if " " in p]
    covered = {w for bg in bigrams for w in bg.split()}
    unigrams = [p for p in ranked if " " not in p and p not in covered]
    selected = (bigrams + unigrams)[:MAX_CONCEPTS_PER_DOC]
    return selected


def _display(label: str) -> str:
    return " ".join(w.capitalize() for w in label.split())


def _get_or_create_concept(db: Session, label: str) -> Concept:
    display = _display(label)
    concept = db.scalar(select(Concept).where(Concept.label == display))
    if concept is None:
        concept = Concept(label=display, salience=0.0, mentions=0, doc_count=0)
        db.add(concept)
        db.flush()
    return concept


def _strengthen_edge(db: Session, a_id: int, b_id: int) -> None:
    lo, hi = sorted((a_id, b_id))
    if lo == hi:
        return
    edge = db.scalar(
        select(Edge).where(Edge.source_id == lo, Edge.target_id == hi)
    )
    if edge is None:
        db.add(Edge(source_id=lo, target_id=hi, weight=1.0, kind="co-occurs"))
    else:
        edge.weight += 1.0


def update_graph_for_document(db: Session, document: Document) -> list[Concept]:
    """Extract concepts for one document and wire up co-occurrence edges."""
    labels = _select_concepts(document.content)
    if not labels:
        return []

    concept_by_label: dict[str, Concept] = {}
    for label in labels:
        concept = _get_or_create_concept(db, label)
        concept.doc_count += 1
        concept_by_label[label] = concept

    # count mentions per concept across the document's chunks, and co-occurrences
    chunks = db.scalars(
        select(Chunk).where(Chunk.document_id == document.id)
    ).all()
    chunk_texts = [c.text.lower() for c in chunks] or [document.content.lower()]

    for label, concept in concept_by_label.items():
        concept.mentions += sum(text.count(label) for text in chunk_texts)

    for text in chunk_texts:
        present = [c for lbl, c in concept_by_label.items() if lbl in text]
        for a, b in combinations(present, 2):
            _strengthen_edge(db, a.id, b.id)

    # salience = blend of how often mentioned and how widely it appears
    for concept in concept_by_label.values():
        concept.salience = concept.mentions * (1.0 + 0.25 * concept.doc_count)

    db.flush()
    return list(concept_by_label.values())


def rebuild_graph(db: Session) -> None:
    """Wipe and recompute the whole concept graph from the remaining documents.

    Concepts/edges are aggregates across documents, so the clean way to reflect a
    deletion is a rebuild — this keeps the Mind Palace, clusters and learning path
    in sync with whatever documents currently exist.
    """
    db.query(Edge).delete()
    db.query(Concept).delete()
    db.flush()
    for document in db.scalars(select(Document)):
        update_graph_for_document(db, document)
    db.commit()


def get_graph(db: Session, limit: int = 120) -> dict:
    """Return the full concept graph as {nodes, links} for the frontend."""
    concepts = db.scalars(
        select(Concept).order_by(Concept.salience.desc()).limit(limit)
    ).all()
    keep_ids = {c.id for c in concepts}
    edges = db.scalars(select(Edge)).all()
    links = [
        e.to_dict()
        for e in edges
        if e.source_id in keep_ids and e.target_id in keep_ids
    ]
    return {
        "nodes": [c.to_dict() for c in concepts],
        "links": links,
        "stats": {"concepts": len(concepts), "edges": len(links)},
    }


def concepts_in_text(db: Session, text: str) -> list[int]:
    """Return ids of existing concepts whose label appears in the given text."""
    lowered = text.lower()
    matches = db.scalars(select(Concept)).all()
    return [c.id for c in matches if c.label.lower() in lowered]
