"""Study endpoints — concept clusters, flashcards and quizzes."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.study import MIXED_ID, generate_study, get_clusters
from app.services.study import _study_labels

router = APIRouter()


@router.get("/clusters")
def clusters(db: Session = Depends(get_db)):
    cl = get_clusters(db)
    if not cl:
        return []
    # prepend a synthetic "Mixed" topic that draws from every document
    mixed_labels = _study_labels(db, None)
    mixed = {
        "id": MIXED_ID,
        "title": "🎲 Mixed — all topics",
        "size": len(mixed_labels),
        "concept_ids": [],
        "concepts": mixed_labels[:10],
        "salience": 0,
    }
    return [mixed] + cl


@router.get("/clusters/{cluster_id}")
def cluster_study(cluster_id: int, count: int = 8, db: Session = Depends(get_db)):
    count = max(3, min(count, 12))
    result = generate_study(db, cluster_id, count)
    if result["mode"] == "missing":
        raise HTTPException(status_code=404, detail="Cluster not found")
    return result
