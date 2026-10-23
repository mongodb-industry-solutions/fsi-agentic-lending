"""Collection-name indirection.

Single source of truth for physical MongoDB collection names. Every runtime
call site resolves collections through ``coll()`` in ``db.mdb`` (which consults
this module) instead of hardcoded string literals.

Each logical name resolves to an env var override, defaulting to today's exact
physical name — so with no env set, behaviour is byte-for-byte unchanged. A
migration step renames a collection by setting ``COLL_<LOGICAL>`` (e.g.
``COLL_PAYMENTS=loanRepayments``) with no code edits.

One database
------------
Every collection — BIAN banking records *and* this demo's agentic
infrastructure — lives in the single consolidated database named by
``DATABASE_NAME`` (``leafy_bank_bian``). This follows the standing umbrella
decision (`.claude/memory/decisions.md`) and the document-intelligence
precedent, where all 15 collections moved into ``leafy_bank_bian`` under a
name prefix. The agentic collections carry a ``lending`` prefix for exactly
that reason: generic names collide in a shared database.

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
    "customers": "customers",
}

# `borrowers` is retired by the BIAN migration (folded into `customers`) and
# kept above only so legacy seed scripts resolve while they are being reworked.


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
