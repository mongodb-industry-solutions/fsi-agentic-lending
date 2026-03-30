"""Vector search service — uses Atlas autoEmbed for semantic queries."""
from db.mdb import get_db as _get_db
from services.application_service import serialize_doc


def search_documents(query: str, application_id: str = None, limit: int = 5) -> list[dict]:
    """Search documents using Atlas Vector Search with autoEmbed.

    With autoEmbed, we pass queryString (text) instead of queryVector.
    Atlas handles text-to-vector conversion automatically.
    """
    db = _get_db()

    pipeline = [
        {
            "$vectorSearch": {
                "index": "documents_auto_embed_idx",
                "path": "extracted_text",
                "queryString": query,
                "numCandidates": 50,
                "limit": limit,
            }
        },
        {
            "$project": {
                "application_id": 1,
                "doc_type": 1,
                "filename": 1,
                "extracted_text": {"$substrCP": ["$extracted_text", 0, 500]},
                "score": {"$meta": "vectorSearchScore"},
            }
        },
    ]

    # Filter by application if specified
    if application_id:
        pipeline[0]["$vectorSearch"]["filter"] = {"application_id": application_id}

    results = db["documents"].aggregate(pipeline)
    return [serialize_doc(r) for r in results]


def search_policies(query: str, limit: int = 5) -> list[dict]:
    """Search underwriting policies using Atlas Vector Search with autoEmbed."""
    db = _get_db()

    pipeline = [
        {
            "$vectorSearch": {
                "index": "policies_auto_embed_idx",
                "path": "content",
                "queryString": query,
                "numCandidates": 50,
                "limit": limit,
            }
        },
        {
            "$project": {
                "policy_id": 1,
                "section": 1,
                "title": 1,
                "content": 1,
                "score": {"$meta": "vectorSearchScore"},
            }
        },
    ]

    results = db["underwriting_policies"].aggregate(pipeline)
    return [serialize_doc(r) for r in results]
