"""Tests for the loan officer endpoint + attribution helper."""
from unittest.mock import MagicMock, patch


def _db_returning(officer_doc):
    """A mock db whose db["officers"].find_one(...) returns officer_doc."""
    db = MagicMock()
    db.__getitem__.return_value.find_one.return_value = officer_doc
    return db


def test_current_officer_from_db(client):
    doc = {
        "officer_id": "officer-001",
        "full_name": "Curtis Dean",
        "title": "Loan Officer",
        "nmls_id": "1120394",
        "email": "curtis.dean@lendflow.example",
        "avatar_seed": "curtis-dean",
    }
    # Patch the exact binding the service uses (robust to import order).
    with patch("services.officer_service._get_db", return_value=_db_returning(doc)):
        response = client.get("/api/officers/current")
    assert response.status_code == 200
    data = response.json()
    assert data["officer_id"] == "officer-001"
    assert data["full_name"] == "Curtis Dean"
    assert data["title"] == "Loan Officer"


def test_current_officer_fallback_when_unseeded(client):
    # No seeded officer — endpoint must still return the default persona.
    with patch("services.officer_service._get_db", return_value=_db_returning(None)):
        response = client.get("/api/officers/current")
    assert response.status_code == 200
    data = response.json()
    assert data["full_name"] == "Curtis Dean"
    # Fallback must not leak the internal seed flag.
    assert "seed_complete" not in data
