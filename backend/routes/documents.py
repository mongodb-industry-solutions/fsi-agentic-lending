"""Document API routes."""
import asyncio
import hashlib
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
from db.mdb import coll
from db.storage_mapping import storage_filter, storage_key, to_storage

logger = logging.getLogger(__name__)

router = APIRouter(tags=["documents"])

APP_ID_PATTERN = re.compile(r'^APP-[A-Z0-9-]{4,20}$')
_PROFILE_ID_PATTERN = re.compile(r'^[a-z0-9][a-z0-9-]{1,40}$')

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
MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50MB


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


def _synthetic_dir() -> Path:
    """Root of the per-profile seeded PDFs (docs/synthetic data/)."""
    base_override = os.environ.get("PDF_BASE_DIR")
    if base_override:
        return Path(base_override).resolve() / "synthetic data"
    return _PROJECT_ROOT / "docs" / "synthetic data"


def _build_pdf_dirs():
    """Build the list of directories to search for PDF files.

    Searches all profile subdirectories under synthetic data/ so PDFs are
    found regardless of which profile they belong to. Supports an optional
    PDF_BASE_DIR env var for custom locations (e.g. Docker volumes).
    """
    base_override = os.environ.get("PDF_BASE_DIR")
    if base_override:
        base = Path(base_override).resolve()
        dirs = [base / "uploads", base]  # base root for flat Docker layouts
    else:
        docs_root = _PROJECT_ROOT / "docs"
        dirs = [docs_root / "uploads"]

    synthetic = _synthetic_dir()

    # Add all profile subdirectories (marcus-delgado/, jane-doe/, etc.)
    if synthetic.is_dir():
        for d in sorted(synthetic.iterdir()):
            if d.is_dir():
                dirs.append(d)
    dirs.append(synthetic)  # fallback: root level
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


def _doc_application_id(doc) -> str | None:
    """Application id from a document record, in BIAN or legacy key shape."""
    for key in (storage_key("documents", "application_id"), "application_id"):
        if doc.get(key):
            return doc[key]
    return None


def _application_profile_id(app_id: str) -> str | None:
    """``profile_id`` for an application, in BIAN or legacy key shape."""
    app_key = storage_key("applications", "application_id")
    app = coll("applications").find_one(
        {"$or": [{app_key: app_id}, {"application_id": app_id}]},
        {storage_key("applications", "profile_id"): 1, "profile_id": 1},
    )
    if not app:
        return None
    # Read the raw keys rather than round-tripping through from_storage: a
    # pre-migration document has no BIAN keys for from_storage to map.
    return app.get(storage_key("applications", "profile_id")) or app.get("profile_id")


def _resolve_pdf_path(doc) -> Path | None:
    """Locate the PDF on disk for a document record.

    Seeded profiles share filenames (each has its own 12_car_loan_statement.pdf),
    so a filename-only lookup serves whichever profile directory sorts first —
    every borrower would get bob-johnson's PDF. Resolve through the profile
    directory of the document's own application instead.

    The filename search remains the fallback for genuine uploads, which live in
    docs/uploads/ and have unique names. A seeded document that reaches it is a
    bug (a missing profile_id), so that case is logged as a warning.
    """
    safe = PurePosixPath(doc["filename"]).name
    app_id = _doc_application_id(doc)
    if app_id:
        profile_id = _application_profile_id(app_id)
        if profile_id and _PROFILE_ID_PATTERN.match(profile_id):
            p = _synthetic_dir() / profile_id / safe
            if p.is_file():
                return p
            logger.warning(
                "PDF resolve: '%s' not under profile '%s' (app %s); "
                "falling back to filename search, which may serve another borrower's PDF",
                safe, profile_id, app_id,
            )
        elif not profile_id:
            logger.warning(
                "PDF resolve: application %s has no profile_id; falling back to "
                "filename search. Run scripts.backfill_profile_ids to repair.",
                app_id,
            )
    return _find_pdf(doc["filename"])


@router.get("/documents/{doc_id}/pdf")
async def serve_document_pdf(doc_id: str):
    """Serve the original PDF file for in-browser viewing."""
    _validate_doc_id(doc_id)
    doc = document_service.get_document(doc_id)
    if not doc or not doc.get("filename"):
        logger.warning("PDF serve: doc %s has no filename (doc=%s)", doc_id, bool(doc))
        raise HTTPException(status_code=404, detail="Document not found")

    pdf_path = _resolve_pdf_path(doc)
    if not pdf_path:
        logger.error(
            "PDF serve: file '%s' not on disk. Searched: %s",
            doc["filename"],
            [str(d) for d in PDF_DIRS],
        )
        raise HTTPException(status_code=404, detail="PDF file not found on disk")

    return FileResponse(
        str(pdf_path),
        media_type="application/pdf",
        filename=doc["filename"],
        content_disposition_type="inline",
    )


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
    app = coll("applications").find_one(
        {storage_key("applications", "application_id"): app_id}
    )
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    # Validate doc_type against allowlist
    if doc_type not in VALID_DOC_TYPES:
        doc_type = "unknown"

    # Validate file type
    if file.content_type not in ("application/pdf",):
        raise HTTPException(status_code=400, detail="Only PDF uploads are accepted")

    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"File too large ({len(content) / 1024 / 1024:.1f}MB). Maximum is 50MB.")
    if not content.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="File does not appear to be a valid PDF")

    # Check for existing document with same type to avoid duplicate extraction
    content_hash = hashlib.sha256(content).hexdigest()
    existing = coll("documents").find_one(storage_filter("documents", {
        "application_id": app_id,
        "doc_type": doc_type,
        "content_hash": content_hash,
        "status": {"$ne": "error"},
    }))
    if existing:
        return serialize_doc(existing)

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
        "content_hash": content_hash,
        "filename": safe_name,
        "extracted_text": text_for_display,
        "structured_data": extraction,
        "embedding": embedding,
        "embedding_type": "multimodal" if embedding else None,
        "embedding_pages": embedding_pages if embedding else 0,
        "status": "parsed" if "error" not in extraction else "error",
        "created_at": datetime.now(timezone.utc),
    }

    result = coll("documents").insert_one(to_storage("documents", doc_record))
    doc_record["_id"] = result.inserted_id

    return serialize_doc(doc_record)


# Reverse mapping: doc_type -> filename prefix (e.g., "paystubs" -> "03")
_DOC_TYPE_TO_PREFIX = {
    "government_id": "01", "employment_letter": "02", "paystubs": "03",
    "income_tax": "04", "bank_statements": "05", "purchase_agreement": "06",
    "investment_statements": "07", "other_property_docs": "08",
    "mortgage_application": "09", "utility_bills": "10", "credit_report": "11",
    "car_loan_statement": "12", "property_tax": "13", "property_inspection": "14",
}


@router.post("/applications/{app_id}/documents/demo-upload/{doc_type}")
async def demo_upload_document(app_id: str, doc_type: str):
    """Upload a pre-seeded correction document for demo purposes.

    Looks up the application's profile_id, finds the matching PDF in
    docs/synthetic data/{profile_id}/, and runs it through the real
    extraction + embedding pipeline.
    """
    _validate_app_id(app_id)
    db = get_db()
    app_key = storage_key("applications", "application_id")
    if not coll("applications").find_one(
        {"$or": [{app_key: app_id}, {"application_id": app_id}]}, {"_id": 1}
    ):
        raise HTTPException(status_code=404, detail="Application not found")

    profile_id = _application_profile_id(app_id)
    if not profile_id or not _PROFILE_ID_PATTERN.match(profile_id):
        raise HTTPException(status_code=400, detail="Application has no valid profile_id")

    if doc_type not in _DOC_TYPE_TO_PREFIX:
        raise HTTPException(status_code=400, detail=f"Unknown doc_type: {doc_type}")

    prefix = _DOC_TYPE_TO_PREFIX[doc_type]
    pdf_path = _synthetic_dir() / profile_id / f"{prefix}_{doc_type}.pdf"
    if not pdf_path.is_file():
        raise HTTPException(status_code=404, detail=f"No pre-seeded {doc_type} PDF found for profile {profile_id}")

    # Check for dedup
    content = pdf_path.read_bytes()
    content_hash = hashlib.sha256(content).hexdigest()
    existing = coll("documents").find_one(storage_filter("documents", {
        "application_id": app_id,
        "doc_type": doc_type,
        "content_hash": content_hash,
        "status": {"$ne": "error"},
    }))
    if existing:
        return serialize_doc(existing)

    # Extract via Bedrock Claude
    try:
        extraction = await asyncio.to_thread(extract_from_pdf, pdf_path, doc_type)
    except Exception as e:
        extraction = {"text_summary": f"Extraction failed: {str(e)}", "error": str(e)}

    text_for_display = extraction.get("text_summary", json.dumps(extraction, indent=2))

    # Generate multimodal embedding
    embedding = None
    embedding_pages = 0
    try:
        embedding, embedding_pages = await asyncio.to_thread(_embed_document, pdf_path)
    except Exception as e:
        logger.warning(f"Demo upload embedding failed: {e}")

    doc_record = {
        "application_id": app_id,
        "doc_type": doc_type,
        "content_hash": content_hash,
        "filename": pdf_path.name,
        "extracted_text": text_for_display,
        "structured_data": extraction,
        "embedding": embedding,
        "embedding_type": "multimodal" if embedding else None,
        "embedding_pages": embedding_pages if embedding else 0,
        "status": "parsed" if "error" not in extraction else "error",
        "created_at": datetime.now(timezone.utc),
    }

    result = coll("documents").insert_one(to_storage("documents", doc_record))
    doc_record["_id"] = result.inserted_id
    logger.info(f"Demo upload: {doc_type} for {app_id} (profile: {profile_id})")

    return serialize_doc(doc_record)
