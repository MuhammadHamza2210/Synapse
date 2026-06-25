"""Per-user learning-path progress (requires auth). Replaces the full key set."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import ProgressItem, User
from app.schemas import ProgressUpdate

router = APIRouter()


@router.get("")
def get_progress(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    keys = db.scalars(
        select(ProgressItem.key).where(ProgressItem.user_id == user.id)
    ).all()
    return {"keys": list(keys)}


@router.put("")
def put_progress(
    payload: ProgressUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Replace the user's completed-step set with the provided keys."""
    desired = set(payload.keys)
    existing = {
        item.key: item
        for item in db.scalars(
            select(ProgressItem).where(ProgressItem.user_id == user.id)
        )
    }
    # delete removed
    for key, item in existing.items():
        if key not in desired:
            db.delete(item)
    # add new
    for key in desired:
        if key not in existing:
            db.add(ProgressItem(user_id=user.id, key=key))
    db.commit()
    return {"keys": sorted(desired)}
