"""Document ingestion and management endpoints."""
from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.document import Document
from app.schemas import DocumentOut, PasteRequest
from app.services.ingest import create_pending_document, process_document

router = APIRouter()


@router.get("", response_model=list[DocumentOut])
def list_documents(db: Session = Depends(get_db)):
    docs = db.scalars(select(Document).order_by(Document.created_at.desc())).all()
    return [d.to_dict() for d in docs]


@router.get("/{document_id}")
def get_document(document_id: int, db: Session = Depends(get_db)):
    doc = db.get(Document, document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    data = doc.to_dict()
    data["preview"] = doc.content[:2000]
    return data


@router.post("/paste", response_model=DocumentOut, status_code=202)
def paste_document(
    payload: PasteRequest,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
):
    doc = create_pending_document(db, title=payload.title, source_type="paste")
    background.add_task(process_document, doc.id, pages=[(None, payload.text)])
    return doc.to_dict()


@router.post("/upload", response_model=DocumentOut, status_code=202)
async def upload_document(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    filename = file.filename or "upload"
    source_type = "pdf" if filename.lower().endswith(".pdf") else "text"
    title = filename.rsplit(".", 1)[0]
    # Return immediately with a "processing" document; heavy work runs in the
    # background so large files don't block the request.
    doc = create_pending_document(db, title=title, filename=filename, source_type=source_type)
    background.add_task(process_document, doc.id, filename=filename, data=data)
    return doc.to_dict()


@router.delete("/{document_id}", status_code=204)
def delete_document(document_id: int, db: Session = Depends(get_db)):
    doc = db.get(Document, document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    db.delete(doc)
    db.commit()

    # concepts/edges are aggregates across docs → rebuild so the Mind Palace and
    # learning path reflect the deletion, then drop cached study material.
    from app.services.graph import rebuild_graph
    from app.services.study import clear_cache

    rebuild_graph(db)
    clear_cache()
