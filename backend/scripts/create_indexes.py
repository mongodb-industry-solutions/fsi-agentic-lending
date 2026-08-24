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

from db.mdb import MongoDBConnector
from models.collections import COLLECTIONS


def main():
    db_connector = MongoDBConnector()
    db = db_connector.client[os.getenv("DATABASE_NAME", "lendflow")]

    # Migrate legacy time-series payments collection to a normal collection.
    # Time-series collections can't be converted in place, so drop it — payment
    # data is fully re-seeded by scripts.ingest_pdfs.
    coll_infos = {c["name"]: c for c in db.list_collections()}
    payments_info = coll_infos.get("payments")
    if payments_info and payments_info.get("type") == "timeseries":
        print("Dropping legacy time-series payments collection (will be re-seeded)...")
        db.drop_collection("payments")

    # Ensure standard collections exist (payments, conversations, interventions, etc.)
    for coll_name in COLLECTIONS:
        if coll_name not in db.list_collection_names():
            db.create_collection(coll_name)
            print(f"  Created collection: {coll_name}")

    # Create standard indexes
    for coll_name, coll_config in COLLECTIONS.items():
        for idx in coll_config.get("indexes", []):
            print(f"Creating index on {coll_name}: {idx['keys']}")
            db[coll_name].create_index(
                idx["keys"],
                unique=idx.get("unique", False),
            )

    # Create Atlas Vector Search indexes (manual embeddings via Voyage AI)
    print("\nCreating Atlas Vector Search indexes...")

    vector_indexes = [
        {
            "collection": "documents",
            "name": "documents_vector_idx",
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
                        "path": "application_id",
                    },
                ]
            },
        },
        {
            "collection": "underwriting_policies",
            "name": "policies_vector_idx",
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
        coll = db[idx_config["collection"]]
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
    seed_officer(db)
    print(f"  Seeded officer: {DEFAULT_OFFICER['full_name']} ({DEFAULT_OFFICER['title']})")

    print("\nDone! All collections and indexes created.")


if __name__ == "__main__":
    main()
