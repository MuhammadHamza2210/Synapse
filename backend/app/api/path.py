"""Learning Path endpoint."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.path import get_learning_path

router = APIRouter()


@router.get("")
def learning_path(db: Session = Depends(get_db)):
    return get_learning_path(db)
