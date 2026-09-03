import os
import threading
from pymongo import MongoClient
from dotenv import load_dotenv

from db.collections_config import resolve

load_dotenv()


class MongoDBConnector:
    """Singleton MongoDB connection manager.

    Provides access to collections via `coll()`. The raw CRUD helpers that
    were previously defined here are unused.
    """

    def __init__(self, uri=None, database_name=None, appname=None):
        self.uri = uri or os.getenv("MONGODB_URI")
        self.database_name = database_name or os.getenv("DATABASE_NAME")
        self.appname = appname or os.getenv("APP_NAME")
        self.client = MongoClient(
            self.uri,
            appname=self.appname,
            # tz_aware: without it pymongo returns naive datetimes, FastAPI
            # serializes them with no offset ("2026-06-01T00:00:00"), and JS
            # `new Date()` reads an offset-less date-time as LOCAL time — so a
            # UTC-midnight payment renders as the previous day west of UTC.
            # Only surfaced once loanRepayments.timestamp became a real Date;
            # while it was an ISO string the "Z" was carried in the data.
            tz_aware=True,
            retryWrites=True,
            retryReads=True,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
            maxPoolSize=50,
        )
        self.db = self.client[self.database_name]

    def close(self):
        """Close the underlying MongoClient connection pool."""
        if self.client:
            self.client.close()


_instance = None
_lock = threading.Lock()

def get_db():
    """Get the singleton database instance (thread-safe)."""
    global _instance
    if _instance is None:
        with _lock:
            if _instance is None:
                _instance = MongoDBConnector()
    return _instance.db


def coll(logical: str):
    """Return the pymongo Collection for a logical name.

    Resolves the physical collection name (``COLL_<LOGICAL>``) in the single
    database named by ``DATABASE_NAME``. Prefer this over ``get_db()[name]``:
    it is the only place that knows a collection's physical name.
    """
    return get_db()[resolve(logical)]


def close_db():
    """Gracefully close the MongoDB connection pool."""
    global _instance
    if _instance is not None:
        _instance.close()
        _instance = None
