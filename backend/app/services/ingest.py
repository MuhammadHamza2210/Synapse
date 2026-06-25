"""Document ingestion: parse → chunk → embed → persist → update concept graph."""
from __future__ import annotations

import io

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.document import Chunk, Document
from app.services.embeddings import embed_texts
from app.services.graph import update_graph_for_document

# A "page" is a (page_number_or_None, text) pair.
Page = tuple[int | None, str]


def parse_upload(filename: str, data: bytes) -> tuple[str, list[Page]]:
    """Turn an uploaded file into a source_type and a list of pages."""
    name = (filename or "").lower()
    if name.endswith(".pdf"):
        return "pdf", _parse_pdf(data)
    # treat everything else as UTF-8 text (md, txt, csv, code, ...)
    text = data.decode("utf-8", errors="ignore")
    return "text", [(None, text)]


def _parse_pdf(data: bytes) -> list[Page]:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(data))
    pages: list[Page] = []
    for i, page in enumerate(reader.pages, start=1):
        try:
            text = page.extract_text() or ""
        except Exception:
            text = ""
        if text.strip():
            pages.append((i, text))
    return pages or [(1, "")]


def chunk_text(text: str, size: int, overlap: int) -> list[str]:
    """Split text into overlapping windows, preferring whitespace boundaries."""
    text = text.strip()
    if not text:
        return []
    if len(text) <= size:
        return [text]

    chunks: list[str] = []
    start = 0
    n = len(text)
    while start < n:
        end = min(start + size, n)
        # back off to the nearest whitespace so we don't cut words in half
        if end < n:
            window = text.rfind(" ", start + size - overlap, end)
            if window != -1 and window > start:
                end = window
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= n:
            break
        start = max(end - overlap, start + 1)
    return chunks


def build_chunks(pages: list[Page]) -> list[tuple[str, int | None]]:
    """Flatten pages into (chunk_text, page) tuples."""
    out: list[tuple[str, int | None]] = []
    for page_no, text in pages:
        for piece in chunk_text(text, settings.chunk_size, settings.chunk_overlap):
            out.append((piece, page_no))
    return out


def _populate(db: Session, document: Document, pages: list[Page]) -> None:
    """Chunk, embed and graph a document's pages onto an existing Document row."""
    import json

    full_text = "\n\n".join(t for _, t in pages)
    pieces = build_chunks(pages)

    document.content = full_text
    document.char_count = len(full_text)
    document.chunk_count = len(pieces)

    if pieces:
        vectors = embed_texts([p[0] for p in pieces])
        for idx, ((text, page), vector) in enumerate(zip(pieces, vectors)):
            db.add(
                Chunk(
                    document_id=document.id,
                    index=idx,
                    text=text,
                    page=page,
                    token_count=len(text.split()),
                    embedding=json.dumps(vector),
                )
            )
        db.flush()

    update_graph_for_document(db, document)


def ingest(
    db: Session,
    *,
    title: str,
    pages: list[Page],
    filename: str | None = None,
    source_type: str = "text",
) -> Document:
    """Synchronous full ingest (used by the seed script and tests)."""
    document = Document(
        title=title.strip() or (filename or "Untitled"),
        filename=filename,
        source_type=source_type,
        status="ready",
    )
    db.add(document)
    db.flush()  # assign document.id
    _populate(db, document, pages)
    db.commit()
    db.refresh(document)

    from app.services.study import clear_cache

    clear_cache()
    return document


def create_pending_document(
    db: Session,
    *,
    title: str,
    filename: str | None = None,
    source_type: str = "text",
) -> Document:
    """Create a placeholder Document in the 'processing' state and return it."""
    document = Document(
        title=title.strip() or (filename or "Untitled"),
        filename=filename,
        source_type=source_type,
        status="processing",
        content="",
        char_count=0,
        chunk_count=0,
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    return document


def process_document(
    document_id: int,
    *,
    filename: str | None = None,
    data: bytes | None = None,
    pages: list[Page] | None = None,
) -> None:
    """Background worker: parse (if needed), populate, and flip status to ready/error.

    Opens its own DB session because the request that scheduled it has finished.
    """
    db = SessionLocal()
    try:
        document = db.get(Document, document_id)
        if document is None:
            return
        try:
            if pages is None:
                source_type, pages = parse_upload(filename or document.filename or "upload", data or b"")
                document.source_type = source_type
            if not any(t.strip() for _, t in pages):
                document.status = "error"
                db.commit()
                return
            _populate(db, document, pages)
            document.status = "ready"
            db.commit()
        except Exception:
            db.rollback()
            doc = db.get(Document, document_id)
            if doc is not None:
                doc.status = "error"
                db.commit()
    finally:
        from app.services.study import clear_cache

        clear_cache()
        db.close()
