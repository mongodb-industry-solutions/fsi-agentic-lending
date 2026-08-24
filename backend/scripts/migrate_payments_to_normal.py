#!/usr/bin/env python3
"""
One-time migration: convert the `payments` time-series collection into a normal
collection, preserving all existing documents.

Time-series collections cannot be converted in place, so this reads every doc,
drops the collection, recreates it as a normal collection with the standard
(loan_id, timestamp DESC) index, and re-inserts the docs unchanged.

Usage: uv run python -m scripts.migrate_payments_to_normal
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv()

from pymongo import ASCENDING, DESCENDING
from db.mdb import MongoDBConnector


def main():
    db = MongoDBConnector().client[os.getenv("DATABASE_NAME", "lendflow")]

    info = next((x for x in db.list_collections() if x["name"] == "payments"), None)
    if not info:
        print("payments collection missing — nothing to migrate.")
        return
    if info.get("type") != "timeseries":
        print("payments is already a normal collection — nothing to do.")
        return

    docs = list(db["payments"].find({}))
    print(f"Backed up {len(docs)} payment docs")

    db.drop_collection("payments")
    print("Dropped time-series payments")

    db.create_collection("payments")
    db["payments"].create_index([("loan_id", ASCENDING), ("timestamp", DESCENDING)])
    print("Recreated payments as normal collection with (loan_id, timestamp DESC) index")

    if docs:
        res = db["payments"].insert_many(docs)
        print(f"Re-inserted {len(res.inserted_ids)} docs")

    info2 = next((x for x in db.list_collections() if x["name"] == "payments"), None)
    print(f"New type: {info2.get('type', 'collection')}")
    print(f"New count: {db['payments'].estimated_document_count()}")
    print(f"Loan ids: {sorted(db['payments'].distinct('loan_id'))}")
    print("Done.")


if __name__ == "__main__":
    main()
