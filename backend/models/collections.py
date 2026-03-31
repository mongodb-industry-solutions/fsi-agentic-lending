"""
MongoDB collection definitions for LendFlow AI.
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
        "description": "Time-series of agent actions (time-series collection)",
        "time_series": {
            "timeField": "timestamp",
            "metaField": "application_id",
            "granularity": "seconds",
        },
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
            {"keys": [("created_at", -1)]},
        ],
    },
}
