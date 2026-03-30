"""Document API routes."""
import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from models.schemas import VectorSearchRequest
from services import document_service, vector_search_service
from services.extraction_service import extract_from_pdf
from services.application_service import serialize_doc
from db.mdb import get_db

router = APIRouter(tags=["documents"])

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "docs" / "uploads"


@router.get("/applications/{app_id}/documents")
async def list_documents(app_id: str):
    """List all documents for an application."""
    return document_service.list_documents(app_id)


@router.get("/documents/{doc_id}")
async def get_document(doc_id: str):
    """Get a single document."""
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
    # Verify application exists
    db = get_db()
    app = db["applications"].find_one({"application_id": app_id})
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    # Save file to disk
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    file_path = UPLOAD_DIR / file.filename
    content = await file.read()
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
        "filename": file.filename,
        "extracted_text": extraction.get("text_summary", json.dumps(extraction, indent=2)),
        "structured_data": extraction,
        "status": "parsed" if "error" not in extraction else "error",
        "created_at": datetime.now(timezone.utc),
    }

    result = db["documents"].insert_one(doc_record)
    doc_record["_id"] = result.inserted_id

    return serialize_doc(doc_record)
