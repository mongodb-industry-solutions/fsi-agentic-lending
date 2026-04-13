"""Document API routes."""
import asyncio
import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from models.schemas import VectorSearchRequest
from services import document_service, vector_search_service
from services.extraction_service import extract_from_pdf, EXTRACTION_PROMPTS
from services.application_service import serialize_doc
from services.embedding_service import embed_document as _embed_document
from db.mdb import get_db

logger = logging.getLogger(__name__)

router = APIRouter(tags=["documents"])

APP_ID_PATTERN = re.compile(r'^APP-[A-Z0-9-]{4,20}$')

def _validate_app_id(app_id: str):
    if not APP_ID_PATTERN.match(app_id):
        raise HTTPException(status_code=400, detail=f"Invalid application ID format: {app_id}")

def _resolve_project_root() -> Path:
    """Resolve project root, handling both source layout and Docker flat layout.

    Source repo:  fsi-agentic-lending/backend/routes/documents.py  (3 up)
    Docker image: /app/routes/documents.py                         (2 up)
    """
    two_up = Path(__file__).resolve().parent.parent
    if (two_up / "docs").is_dir():
        return two_up
    return two_up.parent

_PROJECT_ROOT = _resolve_project_root()
UPLOAD_DIR = _PROJECT_ROOT / "docs" / "uploads"

VALID_DOC_TYPES = set(EXTRACTION_PROMPTS.keys()) | {"unknown"}


def _validate_doc_id(doc_id: str):
    try:
        ObjectId(doc_id)
    except (InvalidId, Exception):
        raise HTTPException(status_code=400, detail=f"Invalid document ID format: {doc_id}")


@router.get("/applications/{app_id}/documents")
async def list_documents(app_id: str):
    """List all documents for an application."""
    _validate_app_id(app_id)
    return document_service.list_documents(app_id)


@router.get("/documents/debug/pdf-paths")
async def debug_pdf_paths():
    """Dev-only diagnostic: show resolved PDF directories and file counts."""
    if os.environ.get("ENV", "development").lower() in ("production", "prod"):
        raise HTTPException(status_code=404, detail="Not found")
    result = []
    for d in PDF_DIRS:
        exists = d.exists()
        pdfs = sorted(p.name for p in d.glob("*.pdf")) if exists else []
        result.append({"path": str(d), "exists": exists, "pdf_count": len(pdfs), "files": pdfs})
    return {"pdf_dirs": result, "project_root": str(_PROJECT_ROOT)}


@router.get("/documents/{doc_id}")
async def get_document(doc_id: str):
    """Get a single document."""
    _validate_doc_id(doc_id)
    doc = document_service.get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


def _build_pdf_dirs():
    """Build the list of directories to search for PDF files.

    Supports an optional PDF_BASE_DIR env var for custom locations (e.g. Docker
    volumes). Falls back to resolving relative to this source file.
    """
    base_override = os.environ.get("PDF_BASE_DIR")
    if base_override:
        base = Path(base_override).resolve()
        dirs = [base / "synthetic data", base / "uploads", base]
    else:
        docs_root = _PROJECT_ROOT / "docs"
        dirs = [docs_root / "synthetic data", docs_root / "uploads"]
    return dirs


PDF_DIRS = _build_pdf_dirs()

for _d in PDF_DIRS:
    _count = len(list(_d.glob("*.pdf"))) if _d.exists() else -1
    logger.info("PDF directory: %s  (exists=%s, pdf_count=%s)", _d, _d.exists(), _count if _count >= 0 else "N/A")


def _find_pdf(filename):
    safe = PurePosixPath(filename).name
    for d in PDF_DIRS:
        p = d / safe
        if p.exists():
            logger.debug("_find_pdf: found %s at %s", filename, p)
            return p
        logger.debug("_find_pdf: not at %s", p)
    logger.warning("_find_pdf: '%s' not found in any PDF_DIRS", filename)
    return None


@router.get("/documents/{doc_id}/pdf")
async def serve_document_pdf(doc_id: str):
    """Serve the original PDF file for in-browser viewing."""
    _validate_doc_id(doc_id)
    doc = document_service.get_document(doc_id)
    if not doc or not doc.get("filename"):
        logger.warning("PDF serve: doc %s has no filename (doc=%s)", doc_id, bool(doc))
        raise HTTPException(status_code=404, detail="Document not found")

    pdf_path = _find_pdf(doc["filename"])
    if not pdf_path:
        logger.error(
            "PDF serve: file '%s' not on disk. Searched: %s",
            doc["filename"],
            [str(d) for d in PDF_DIRS],
        )
        raise HTTPException(status_code=404, detail="PDF file not found on disk")

    return FileResponse(str(pdf_path), media_type="application/pdf", filename=doc["filename"])


@router.get("/documents/{doc_id}/json")
async def get_document_json(doc_id: str):
    """Return the full MongoDB document with all extracted data."""
    _validate_doc_id(doc_id)
    doc = document_service.get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.post("/documents/search")
async def search_documents(req: VectorSearchRequest, app_id: str = None):
    """Semantic search across documents using Atlas Vector Search."""
    return vector_search_service.search_documents(req.query, app_id, req.limit)


@router.post("/policies/search")
async def search_policies(req: VectorSearchRequest):
    """Semantic search across underwriting policies."""
    return vector_search_service.search_policies(req.query, req.limit)


@router.post("/applications/{app_id}/documents/upload")
async def upload_document(
    app_id: str,
    file: UploadFile = File(...),
    doc_type: str = Form("unknown"),
):
    """Upload a document, extract data via Bedrock Claude, store in MongoDB."""
    _validate_app_id(app_id)
    # Verify application exists
    db = get_db()
    app = db["applications"].find_one({"application_id": app_id})
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    # Validate doc_type against allowlist
    if doc_type not in VALID_DOC_TYPES:
        doc_type = "unknown"

    # Validate file type
    if file.content_type not in ("application/pdf",):
        raise HTTPException(status_code=400, detail="Only PDF uploads are accepted")

    content = await file.read()
    if not content.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="File does not appear to be a valid PDF")

    # Sanitize filename and save file to disk
    safe_name = PurePosixPath(file.filename).name  # strips directory components
    safe_name = f"{app_id}_{uuid.uuid4().hex[:8]}_{safe_name}"
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    file_path = UPLOAD_DIR / safe_name
    file_path.write_bytes(content)

    # Extract via Bedrock Claude (run in thread to not block event loop)
    try:
        extraction = await asyncio.to_thread(extract_from_pdf, file_path, doc_type)
    except Exception as e:
        extraction = {"text_summary": f"Extraction failed: {str(e)}", "error": str(e)}

    # Generate multimodal embedding from PDF page images
    text_for_display = extraction.get("text_summary", json.dumps(extraction, indent=2))
    embedding = None
    embedding_pages = 0
    try:
        embedding, embedding_pages = await asyncio.to_thread(_embed_document, file_path)
    except Exception as e:
        logger.warning(f"Multimodal embedding generation failed: {e}")

    # Store in MongoDB
    doc_record = {
        "application_id": app_id,
        "doc_type": doc_type,
        "filename": safe_name,
        "extracted_text": text_for_display,
        "structured_data": extraction,
        "embedding": embedding,
        "embedding_type": "multimodal" if embedding else None,
        "embedding_pages": embedding_pages if embedding else 0,
        "status": "parsed" if "error" not in extraction else "error",
        "created_at": datetime.now(timezone.utc),
    }

    result = db["documents"].insert_one(doc_record)
    doc_record["_id"] = result.inserted_id

    return serialize_doc(doc_record)
