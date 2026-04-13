import os
import threading
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()


class MongoDBConnector:
    """Singleton MongoDB connection manager.

    Provides access to the database via `get_db()`. The raw CRUD helpers
    that were previously defined here are unused — all code accesses
    collections directly via ``get_db()["collection_name"]``.
    """

    def __init__(self, uri=None, database_name=None, appname=None):
        self.uri = uri or os.getenv("MONGODB_URI")
        self.database_name = database_name or os.getenv("DATABASE_NAME")
        self.appname = appname or os.getenv("APP_NAME")
        self.client = MongoClient(
            self.uri,
            appname=self.appname,
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


def close_db():
    """Gracefully close the MongoDB connection pool."""
    global _instance
    if _instance is not None:
        _instance.close()
        _instance = None
