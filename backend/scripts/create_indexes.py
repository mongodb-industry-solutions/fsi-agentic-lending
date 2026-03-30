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

    # Create time-series collection for agent_activity
    print("Creating agent_activity time-series collection...")
    ts_config = COLLECTIONS["agent_activity"]["time_series"]
    try:
        db.create_collection(
            "agent_activity",
            timeseries={
                "timeField": ts_config["timeField"],
                "metaField": ts_config["metaField"],
                "granularity": ts_config["granularity"],
            },
        )
        print("  Created agent_activity time-series collection")
    except Exception as e:
        if "already exists" in str(e):
            print("  agent_activity already exists, skipping")
        else:
            raise

    # Create time-series collection for payments
    print("Creating payments time-series collection...")
    ts_payments_config = COLLECTIONS["payments"]["time_series"]
    try:
        db.create_collection(
            "payments",
            timeseries={
                "timeField": ts_payments_config["timeField"],
                "metaField": ts_payments_config["metaField"],
                "granularity": ts_payments_config["granularity"],
            },
        )
        print("  Created payments time-series collection")
    except Exception as e:
        if "already exists" in str(e):
            print("  payments already exists, skipping")
        else:
            raise

    # Create standard indexes
    for coll_name, coll_config in COLLECTIONS.items():
        for idx in coll_config.get("indexes", []):
            print(f"Creating index on {coll_name}: {idx['keys']}")
            db[coll_name].create_index(
                idx["keys"],
                unique=idx.get("unique", False),
            )

    # Create Atlas Vector Search indexes with autoEmbed
    # These use the Atlas Search API, not standard createIndex
    print("\nCreating Atlas Vector Search indexes (autoEmbed)...")

    auto_embed_indexes = [
        {
            "collection": "documents",
            "name": "documents_auto_embed_idx",
            "field_path": "extracted_text",
        },
        {
            "collection": "underwriting_policies",
            "name": "policies_auto_embed_idx",
            "field_path": "content",
        },
    ]

    for idx_config in auto_embed_indexes:
        coll = db[idx_config["collection"]]
        try:
            coll.create_search_index({
                "name": idx_config["name"],
                "type": "vectorSearch",
                "definition": {
                    "fields": [
                        {
                            "type": "autoEmbed",
                            "path": idx_config["field_path"],
                            "model": "voyage-ai/voyage-4",
                            "numDimensions": 1024,
                            "similarity": "cosine",
                        }
                    ]
                }
            })
            print(f"  Created autoEmbed index: {idx_config['name']} on {idx_config['collection']}.{idx_config['field_path']}")
        except Exception as e:
            if "already exists" in str(e) or "duplicate" in str(e).lower():
                print(f"  {idx_config['name']} already exists, skipping")
            else:
                print(f"  Warning: {e}")

    print("\nDone! All collections and indexes created.")


if __name__ == "__main__":
    main()
