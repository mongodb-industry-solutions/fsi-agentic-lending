#!/usr/bin/env python3
"""
Re-embed existing documents using true multimodal (PDF page image) embeddings.
Updates embedding, embedding_type, and embedding_pages in-place without
re-extracting via Bedrock or recreating borrowers/applications/policies.

Usage: uv run python -m scripts.reembed_documents
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv()

from db.mdb import MongoDBConnector, coll
from db.storage_mapping import from_storage, storage_key, to_storage
from services.embedding_service import embed_document

def _resolve_project_root() -> Path:
    """Resolve project root, handling both source layout and Docker flat layout."""
    two_up = Path(__file__).resolve().parent.parent
    if (two_up / "docs").is_dir():
        return two_up
    return two_up.parent

PROJECT_ROOT = _resolve_project_root()


def _build_pdf_dirs() -> list[Path]:
    """Match the same PDF search logic as backend/routes/documents.py."""
    base_override = os.environ.get("PDF_BASE_DIR")
    if base_override:
        base = Path(base_override).resolve()
        return [base / "synthetic data", base / "uploads", base]
    docs_root = PROJECT_ROOT / "docs"
    return [docs_root / "synthetic data", docs_root / "uploads"]


PDF_DIRS = _build_pdf_dirs()


def find_pdf(filename: str) -> Path | None:
    safe = Path(filename).name
    for d in PDF_DIRS:
        p = d / safe
        if p.exists():
            return p
    return None


def main():
    db_connector = MongoDBConnector()
    db = db_connector.client[os.getenv("DATABASE_NAME", "lendflow")]

    docs = [
        from_storage("documents", d)
        for d in coll("documents").find(
            {}, {"_id": 1, storage_key("documents", "filename"): 1,
                 storage_key("documents", "doc_type"): 1}
        )
    ]
    print(f"Found {len(docs)} documents in the database")
    print(f"PDF search directories: {[str(d) for d in PDF_DIRS]}\n")

    updated = 0
    skipped = 0
    failed = 0

    for doc in docs:
        doc_id = doc["_id"]
        filename = doc.get("filename", "")
        doc_type = doc.get("doc_type", "unknown")
        label = f"{filename} ({doc_type})"

        pdf_path = find_pdf(filename)
        if not pdf_path:
            print(f"  SKIP  {label} — PDF not found on disk")
            skipped += 1
            continue

        try:
            embedding, pages = embed_document(pdf_path)
            coll("documents").update_one(
                {"_id": doc_id},
                {"$set": to_storage("documents", {
                    "embedding": embedding,
                    "embedding_type": "multimodal",
                    "embedding_pages": pages,
                })},
            )
            print(f"  OK    {label} — {pages} pages embedded")
            updated += 1
        except Exception as e:
            print(f"  FAIL  {label} — {e}")
            failed += 1

    print(f"\nDone: {updated} updated, {skipped} skipped, {failed} failed")


if __name__ == "__main__":
    main()
