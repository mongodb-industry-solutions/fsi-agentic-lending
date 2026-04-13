"""Unified Atlas Vector Search module.

Single source of truth for policy and document vector search.
Both agent pipeline tools and API routes should import from here.
"""
import logging
from db.mdb import get_db as _get_db
from services.embedding_service import embed_query as _embed_query

logger = logging.getLogger(__name__)

OFFICER_PROJECTION = {
    "_id": 0,
    "policy_id": 1,
    "title": 1,
    "content": 1,
    "score": {"$meta": "vectorSearchScore"},
}

BORROWER_SAFE_PROJECTION = {
    "_id": 0,
    "policy_id": 1,
    "title": 1,
    "section": 1,
    "content": 1,
    "category": 1,
    "score": {"$meta": "vectorSearchScore"},
}

_SEARCH_UNAVAILABLE_SENTINEL = {
    "policy_id": "SEARCH_UNAVAILABLE",
    "title": "Policy Search Unavailable",
    "content": "Vector search failed. Manual policy review required.",
    "score": 0,
}


def search_policies(query: str, limit: int = 5, projection: dict | None = None) -> list[dict]:
    """Search underwriting policies via Atlas Vector Search with Voyage AI embeddings.

    Args:
        query: The search query text.
        limit: Max results to return.
        projection: MongoDB $project stage. Defaults to officer-level fields.
    """
    db = _get_db()
    proj = projection if projection is not None else OFFICER_PROJECTION
    try:
        query_vector = _embed_query(query)
        pipeline = [
            {
                "$vectorSearch": {
                    "index": "policies_vector_idx",
                    "path": "embedding",
                    "queryVector": query_vector,
                    "numCandidates": 50,
                    "limit": limit,
                }
            },
            {"$project": proj},
        ]
        return list(db["underwriting_policies"].aggregate(pipeline))
    except Exception as e:
        logger.error(f"Policy vector search failed: {e}")
        return [{**_SEARCH_UNAVAILABLE_SENTINEL, "content": f"Vector search failed: {str(e)[:200]}. Manual policy review required."}]


def search_documents(query: str, application_id: str | None = None, limit: int = 5) -> list[dict]:
    """Search documents using Atlas Vector Search with Voyage AI embeddings."""
    db = _get_db()
    try:
        query_vector = _embed_query(query)
    except Exception as e:
        logger.error(f"Query embedding failed: {e}")
        return []

    vs_stage: dict = {
        "$vectorSearch": {
            "index": "documents_vector_idx",
            "path": "embedding",
            "queryVector": query_vector,
            "numCandidates": 50,
            "limit": limit,
        }
    }
    if application_id:
        vs_stage["$vectorSearch"]["filter"] = {"application_id": application_id}

    pipeline = [
        vs_stage,
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
    from services.application_service import serialize_doc
    return [serialize_doc(r) for r in db["documents"].aggregate(pipeline)]
