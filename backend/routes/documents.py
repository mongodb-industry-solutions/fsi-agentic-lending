"""Document API routes."""
from fastapi import APIRouter, HTTPException
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


@router.post("/documents/search")
async def search_documents(req: VectorSearchRequest, app_id: str = None):
    """Semantic search across documents using Atlas Vector Search."""
    return vector_search_service.search_documents(req.query, app_id, req.limit)


@router.post("/policies/search")
async def search_policies(req: VectorSearchRequest):
    """Semantic search across underwriting policies."""
    return vector_search_service.search_policies(req.query, req.limit)
