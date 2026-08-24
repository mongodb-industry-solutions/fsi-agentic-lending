"""Collection-name indirection.

Single source of truth for physical MongoDB collection names. Every runtime
call site resolves collection names through ``NAMES`` (attribute access, e.g.
``db[NAMES.applications]``) instead of hardcoded string literals.

Each logical name resolves to an env var override, defaulting to today's exact
physical name — so with no env set, behaviour is byte-for-byte unchanged. Later
migration steps rename a collection by setting ``COLL_<LOGICAL>`` (e.g.
``COLL_PAYMENTS=loanRepayments``) with no code edits.

Scope note: this layer resolves collection *names* only. The eventual
two-database split (leafy_bank_bian vs fsi-agentic-lending) is a follow-up that
will extend these entries with a target-database and teach ``get_db()`` to hand
out a second handle. Not in scope here.

LangGraph-managed collections (``checkpoints`` / ``checkpoint_writes``) are
deliberately absent — they are owned by the MongoDBSaver, not this app.
"""

import os

# logical name -> default physical name (today's collection name).
# Override at runtime via env var COLL_<LOGICAL-UPPERCASE>.
_DEFAULTS = {
    "applications": "applications",
    "borrowers": "borrowers",
    "credit_reports": "credit_reports",
    "payments": "payments",
    "renewals": "renewals",
    "documents": "documents",
    "underwriting_policies": "underwriting_policies",
    "agent_activity": "agent_activity",
    "conversations": "conversations",
    "interventions": "interventions",
    "hitl_audit": "hitl_audit",
    "officers": "officers",
    "pipeline_locks": "pipeline_locks",
}


def resolve(logical: str) -> str:
    """Resolve a logical collection name to its physical name."""
    if logical not in _DEFAULTS:
        raise KeyError(f"Unknown logical collection name: {logical!r}")
    return os.getenv(f"COLL_{logical.upper()}", _DEFAULTS[logical])


class _Names:
    """Attribute-access resolver: ``NAMES.applications`` -> physical name.

    Resolved on each access so env changes take effect without re-import
    (matters for tests that monkeypatch os.environ).
    """

    def __getattr__(self, logical: str) -> str:
        return resolve(logical)


NAMES = _Names()
