#!/usr/bin/env python3
"""
Export the seed documents into a frontend-only static bundle that the UI
falls back to when the backend database has no ``documents`` collection
(e.g. an unseeded ``leafy_bank_bian``). Display-only — no backend logic reads
it, and it deliberately ships WITHOUT full embeddings (only a small display
preview + dimension), so it stays ~170 KB instead of ~1.3 MB.

Usage: uv run python -m scripts.export_documents_bundle

Writes to ``frontend/public/data/documents.json``. Read-only against Mongo —
it never inserts/updates. Re-run after re-seeding a database to refresh the
bundle (the read normalizes via ``from_storage`` so it works whether the
source documents are stored in the legacy snake_case shape or the BIAN
camelCase shape).
"""

import json
import sys
from pathlib import Path

# Add backend/ to path for imports (matches other scripts).
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv  # noqa: E402
load_dotenv()

from db.mdb import coll  # noqa: E402
from db.storage_mapping import from_storage  # noqa: E402
from services.application_service import serialize_doc  # noqa: E402

_SEED_PREFIX = "seed-"
_PREVIEW_LEN = 10

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
_OUT_PATH = _REPO_ROOT / "frontend" / "public" / "data" / "documents.json"


def _to_export(database_doc: dict) -> dict:
    """Normalize a stored document to the runtime shape and project a slim
    display record with a stable, deterministic ``_id``."""
    doc = serialize_doc(from_storage("documents", database_doc))
    application_id = doc.get("application_id")
    doc_type = doc.get("doc_type") or "unknown"
    embedding = doc.get("embedding") or []
    return {
        "_id": f"{_SEED_PREFIX}{application_id}-{doc_type}",
        "application_id": application_id,
        "doc_type": doc_type,
        "filename": doc.get("filename"),
        "status": doc.get("status", "parsed"),
        "embedding_pages": doc.get("embedding_pages"),
        "embedding_type": doc.get("embedding_type", "multimodal"),
        # Display stub only — the full 1024-d vector is NOT shipped.
        "embedding_dim": len(embedding),
        "embedding_preview": [round(float(v), 6) for v in embedding[:_PREVIEW_LEN]],
        "created_at": doc.get("created_at"),
        "extracted_text": doc.get("extracted_text"),
        "structured_data": doc.get("structured_data"),
    }


def main() -> None:
    if not _OUT_PATH.parent.exists():
        _OUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    records = [_to_export(d) for d in coll("documents").find({})]
    records.sort(key=lambda r: (str(r["application_id"]), str(r["doc_type"])))

    _OUT_PATH.write_text(
        json.dumps(records, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    by_app: dict[str, int] = {}
    for r in records:
        by_app[r["application_id"]] = by_app.get(r["application_id"], 0) + 1
    print(f"Exported {len(records)} documents -> {_OUT_PATH}")
    for app_id in sorted(by_app):
        print(f"  {app_id}: {by_app[app_id]}")
    print(f"Bundle size: {_OUT_PATH.stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    main()
