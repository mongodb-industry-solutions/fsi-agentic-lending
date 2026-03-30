"""Document API routes."""
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pathlib import Path
from models.schemas import VectorSearchRequest
from services import document_service, vector_search_service

router = APIRouter(tags=["documents"])


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


PDF_DIRS = [
    Path(__file__).resolve().parent.parent.parent / "docs" / "synthetic data",
    Path(__file__).resolve().parent.parent.parent / "docs" / "uploads",
]


def _find_pdf(filename):
    for d in PDF_DIRS:
        p = d / filename
        if p.exists():
            return p
    return None


@router.get("/documents/{doc_id}/pdf")
async def serve_document_pdf(doc_id: str):
    """Serve the original PDF file for in-browser viewing."""
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
