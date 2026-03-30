"""Document API routes."""
import asyncio
import json
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
from db.mdb import get_db

router = APIRouter(tags=["documents"])

APP_ID_PATTERN = re.compile(r'^APP-[A-Z0-9]{8}$')

def _validate_app_id(app_id: str):
    if not APP_ID_PATTERN.match(app_id):
        raise HTTPException(status_code=400, detail=f"Invalid application ID format: {app_id}")

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "docs" / "uploads"

VALID_DOC_TYPES = set(EXTRACTION_PROMPTS.keys()) | {"unknown"}


def _validate_doc_id(doc_id: str):
    try:
        ObjectId(doc_id)
    except (InvalidId, Exception):
        raise HTTPException(status_code=400, detail=f"Invalid document ID format: {doc_id}")


@router.get("/applications/{app_id}/documents")
async def list_documents(app_id: str):
    """List all documents for an application."""
    return document_service.list_documents(app_id)


@router.get("/documents/{doc_id}")
async def get_document(doc_id: str):
    """Get a single document."""
    _validate_doc_id(doc_id)
    doc = document_service.get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


PDF_DIRS = [
    Path(__file__).resolve().parent.parent.parent / "docs" / "synthetic data",
    Path(__file__).resolve().parent.parent.parent / "docs" / "uploads",
]


def _find_pdf(filename):
    # Sanitize to prevent path traversal
    safe = PurePosixPath(filename).name
    for d in PDF_DIRS:
        p = d / safe
        if p.exists():
            return p
    return None


@router.get("/documents/{doc_id}/pdf")
async def serve_document_pdf(doc_id: str):
    """Serve the original PDF file for in-browser viewing."""
    _validate_doc_id(doc_id)
    doc = document_service.get_document(doc_id)
    if not doc or not doc.get("filename"):
        raise HTTPException(status_code=404, detail="Document not found")

    pdf_path = _find_pdf(doc["filename"])
    if not pdf_path:
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

    # Store in MongoDB
    doc_record = {
        "application_id": app_id,
        "doc_type": doc_type,
        "filename": safe_name,
        "extracted_text": extraction.get("text_summary", json.dumps(extraction, indent=2)),
        "structured_data": extraction,
        "status": "parsed" if "error" not in extraction else "error",
        "created_at": datetime.now(timezone.utc),
    }

    result = db["documents"].insert_one(doc_record)
    doc_record["_id"] = result.inserted_id

    return serialize_doc(doc_record)
