"""Delete lendingConversations docs written with the pre-migration snake_case key.

Before the storage-mapping fix, the chat routes upserted `application_id`
instead of `applicationId`. Those docs are invisible to the unique
`applicationId_1` index as `null`, so the *first* one blocks every later chat
upsert with E11000 dup key { applicationId: null }.

They hold no data worth keeping — a conversation re-creates on the next message.
"""
import logging

from db.mdb import coll

logging.basicConfig(level=logging.INFO)

c = coll("conversations")
legacy = {"applicationId": {"$exists": False}}
found = list(c.find(legacy, {"messages": 0}))
print(f"legacy docs: {len(found)}")
for d in found:
    print("  ", d.get("_id"), d.get("application_id"), d.get("phase"))
if found:
    print("deleted:", c.delete_many(legacy).deleted_count)
