"""Unified Atlas Vector Search module.

Single source of truth for policy and document vector search.
Both agent pipeline tools and API routes should import from here.
"""
import logging
import os
from db.mdb import coll
from db.storage_mapping import from_storage, storage_key
from services.embedding_service import embed_query as _embed_query

logger = logging.getLogger(__name__)


def _doc_k(runtime_path: str) -> str:
    return storage_key("documents", runtime_path)


def _pol_k(runtime_path: str) -> str:
    return storage_key("underwriting_policies", runtime_path)


# Atlas Search index names. They are rebuilt, not renamed, when the collections
# are renamed — see data/agentic/index-manifest.json in the migration repo.
DOCUMENTS_VECTOR_INDEX = os.getenv("DOCUMENTS_VECTOR_INDEX", "documents_vector_idx")
POLICIES_VECTOR_INDEX = os.getenv("POLICIES_VECTOR_INDEX", "policies_vector_idx")


def _policy_projection(*fields):
    projection = {_pol_k(f): 1 for f in fields}
    projection["_id"] = 0
    projection["score"] = {"$meta": "vectorSearchScore"}
    return projection


OFFICER_PROJECTION = _policy_projection("policy_id", "title", "content")

BORROWER_SAFE_PROJECTION = _policy_projection(
    "policy_id", "title", "section", "content", "category"
)

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
    proj = projection if projection is not None else OFFICER_PROJECTION
    try:
        query_vector = _embed_query(query)
        pipeline = [
            {
                "$vectorSearch": {
                    "index": POLICIES_VECTOR_INDEX,
                    "path": "embedding",
                    "queryVector": query_vector,
                    "numCandidates": 50,
                    "limit": limit,
                }
            },
            {"$project": proj},
        ]
        return [
            from_storage("underwriting_policies", r)
            for r in coll("underwriting_policies").aggregate(pipeline)
        ]
    except Exception as e:
        logger.error(f"Policy vector search failed: {e}")
        return [_SEARCH_UNAVAILABLE_SENTINEL]


def search_documents(query: str, application_id: str | None = None, limit: int = 5) -> list[dict]:
    """Search documents using Atlas Vector Search with Voyage AI embeddings."""
    try:
        query_vector = _embed_query(query)
    except Exception as e:
        logger.error(f"Query embedding failed: {e}")
        return []

    vs_stage: dict = {
        "$vectorSearch": {
            "index": DOCUMENTS_VECTOR_INDEX,
            "path": "embedding",
            "queryVector": query_vector,
            "numCandidates": 50,
            "limit": limit,
        }
    }
    if application_id:
        # ⚠️ This filter path must match the `filter` path declared in the Atlas
        # index definition. If the index is built on `applicationId` and this
        # sends `application_id` (or the reverse), every filtered search returns
        # ZERO results with no exception and nothing in the logs.
        vs_stage["$vectorSearch"]["filter"] = {_doc_k("application_id"): application_id}

    pipeline = [
        vs_stage,
        {
            "$project": {
                _doc_k("application_id"): 1,
                _doc_k("doc_type"): 1,
                _doc_k("filename"): 1,
                _doc_k("extracted_text"): {
                    "$substrCP": ["$" + _doc_k("extracted_text"), 0, 500]
                },
                "score": {"$meta": "vectorSearchScore"},
            }
        },
    ]
    from services.application_service import serialize_doc
    return [
        serialize_doc(from_storage("documents", r))
        for r in coll("documents").aggregate(pipeline)
    ]
