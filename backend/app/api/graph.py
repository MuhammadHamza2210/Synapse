"""Concept-graph endpoints powering the 3D Mind Palace."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.graph import get_graph

router = APIRouter()


@router.get("")
def graph(limit: int = 120, db: Session = Depends(get_db)):
    return get_graph(db, limit=limit)
