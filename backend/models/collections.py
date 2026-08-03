"""
MongoDB collection definitions for Agentic Lending Platform.
6 core collections for the lending lifecycle.
"""

COLLECTIONS = {
    "borrowers": {
        "description": "Applicant identity and demographics",
        "indexes": [
            {"keys": [("application_id", 1), ("full_name", 1)]},
        ],
    },
    "applications": {
        "description": "Loan application state machine",
        "indexes": [
            {"keys": [("application_id", 1)], "unique": True},
            {"keys": [("status", 1), ("created_at", -1)]},
        ],
    },
    "documents": {
        "description": "Uploaded docs with extracted text and structured data",
        "indexes": [
            {"keys": [("application_id", 1), ("doc_type", 1)]},
        ],
    },
    "credit_reports": {
        "description": "Structured credit bureau data",
        "indexes": [
            {"keys": [("borrower_id", 1)]},
        ],
    },
    "underwriting_policies": {
        "description": "RAG-searchable underwriting policy text",
        "indexes": [
            {"keys": [("policy_id", 1)], "unique": True},
        ],
    },
    "agent_activity": {
        "description": "Agent actions log (supports change streams for SSE)",
        "indexes": [
            {"keys": [("application_id", 1), ("timestamp", -1)]},
        ],
    },
    "payments": {
        "description": "Time-series of loan payment history",
        "time_series": {
            "timeField": "timestamp",
            "metaField": "loan_id",
            "granularity": "hours",
        },
        "indexes": [
            {"keys": [("loan_id", 1), ("timestamp", -1)]},
        ],
    },
    "conversations": {
        "description": "Application Agent chat history (borrower PII — separate retention policy)",
        "indexes": [
            {"keys": [("application_id", 1)], "unique": True},
        ],
    },
    "interventions": {
        "description": "Pipeline-to-borrower action items (shared mailbox between pipeline and app agent)",
        "indexes": [
            {"keys": [("application_id", 1), ("status", 1)]},
            {"keys": [("application_id", 1), ("type", 1), ("status", 1)]},
            {"keys": [("created_at", -1)]},
        ],
    },
    "hitl_audit": {
        "description": "Immutable audit log of officer HITL decisions (no update/delete operations)",
        "indexes": [
            {"keys": [("application_id", 1), ("timestamp", -1)]},
            {"keys": [("officer_id", 1)]},
        ],
    },
    "officers": {
        "description": "Loan officer identities (currently a seeded singleton — the reviewing officer)",
        "indexes": [
            {"keys": [("officer_id", 1)], "unique": True},
        ],
    },
    "pipeline_locks": {
        "description": "Distributed pipeline concurrency locks (TTL-based)",
        "indexes": [
            {"keys": [("locked_at", 1)], "expireAfterSeconds": 600},
        ],
    },
}
