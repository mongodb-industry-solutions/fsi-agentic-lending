#!/usr/bin/env python3
"""
Create MongoDB collections, indexes, and Atlas Vector Search indexes.
Run once during initial setup.

Usage: uv run python -m scripts.create_indexes
"""
import os
import sys
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv()

from db.collections_config import resolve
from db.mdb import get_db
from db.storage_mapping import storage_key
from models.collections import COLLECTIONS


def main():
    db = get_db()

    # Migrate legacy time-series payments collection to a normal collection.
    # Time-series collections can't be converted in place, so drop it — payment
    # data is fully re-seeded by scripts.ingest_pdfs. Time-series also forbids
    # the unique index on loanRepaymentsId that idempotent upserts need.
    payments_name = resolve("payments")
    coll_infos = {c["name"]: c for c in db.list_collections()}
    payments_info = coll_infos.get(payments_name)
    if payments_info and payments_info.get("type") == "timeseries":
        print(f"Dropping legacy time-series {payments_name} collection (will be re-seeded)...")
        db.drop_collection(payments_name)

    # Ensure standard collections exist.
    existing = set(db.list_collection_names())
    for logical in COLLECTIONS:
        physical = resolve(logical)
        if physical not in existing:
            db.create_collection(physical)
            existing.add(physical)
            print(f"  Created collection: {db.name}.{physical}")

    # Create standard indexes. Index keys are declared in RUNTIME field names
    # and translated here, so they cannot drift from what the app queries.
    for logical, coll_config in COLLECTIONS.items():
        physical = resolve(logical)
        for idx in coll_config.get("indexes", []):
            keys = [(storage_key(logical, field), direction)
                    for field, direction in idx["keys"]]
            print(f"Creating index on {db.name}.{physical}: {keys}")
            db[physical].create_index(
                keys,
                unique=idx.get("unique", False),
                **({"expireAfterSeconds": idx["expireAfterSeconds"]}
                   if "expireAfterSeconds" in idx else {}),
            )

    # Create Atlas Vector Search indexes (manual embeddings via Voyage AI)
    print("\nCreating Atlas Vector Search indexes...")

    # ⚠️ The `filter` path below MUST match the filter key sent by
    # services.vector_search.search_documents. If they disagree, every filtered
    # vector search returns ZERO results with no error and nothing in the logs.
    vector_indexes = [
        {
            "collection": "documents",
            "name": os.getenv("DOCUMENTS_VECTOR_INDEX", "documents_vector_idx"),
            "definition": {
                "fields": [
                    {
                        "type": "vector",
                        "path": "embedding",
                        "numDimensions": 1024,
                        "similarity": "cosine",
                    },
                    {
                        "type": "filter",
                        "path": storage_key("documents", "application_id"),
                    },
                ]
            },
        },
        {
            "collection": "underwriting_policies",
            "name": os.getenv("POLICIES_VECTOR_INDEX", "policies_vector_idx"),
            "definition": {
                "fields": [
                    {
                        "type": "vector",
                        "path": "embedding",
                        "numDimensions": 1024,
                        "similarity": "cosine",
                    },
                ]
            },
        },
    ]

    for idx_config in vector_indexes:
        logical = idx_config["collection"]
        coll = db[resolve(logical)]
        try:
            coll.create_search_index({
                "name": idx_config["name"],
                "type": "vectorSearch",
                "definition": idx_config["definition"],
            })
            print(f"  Created vector index: {idx_config['name']} on {idx_config['collection']}")
        except Exception as e:
            if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
                print(f"  {idx_config['name']} already exists, skipping")
            else:
                print(f"  Warning: {e}")

    # Seed the singleton loan officer (idempotent upsert)
    print("\nSeeding loan officer...")
    from services.officer_service import seed_officer, DEFAULT_OFFICER
    seed_officer()
    print(f"  Seeded officer: {DEFAULT_OFFICER['full_name']} ({DEFAULT_OFFICER['title']})")

    print("\nDone! All collections and indexes created.")


if __name__ == "__main__":
    main()
