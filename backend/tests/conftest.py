import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient


@pytest.fixture
def mock_db():
    """Mock MongoDB database."""
    db = MagicMock()
    return db


@pytest.fixture
def client(mock_db):
    """FastAPI test client with mocked MongoDB."""
    with patch('db.mdb._instance', None), \
         patch('db.mdb._lock'), \
         patch('db.mdb.MongoDBConnector') as MockConnector:
        mock_connector = MagicMock()
        mock_connector.db = mock_db
        mock_connector.client = MagicMock()
        MockConnector.return_value = mock_connector

        # Also patch get_db to return mock_db
        with patch('db.mdb.get_db', return_value=mock_db):
            from main import app
            yield TestClient(app)
