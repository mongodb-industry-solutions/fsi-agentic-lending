"""Vector search service — thin compatibility layer.

All implementations now live in services.vector_search.
This module re-exports them for backward compatibility with routes/documents.py.
"""
from services.vector_search import search_documents, search_policies  # noqa: F401
