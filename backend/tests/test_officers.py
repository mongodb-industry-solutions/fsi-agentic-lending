"""Tests for the loan officer endpoint + attribution helper."""
from unittest.mock import MagicMock, patch


def _collection_returning(officer_doc):
    """A mock collection whose find_one(...) returns officer_doc."""
    collection = MagicMock()
    collection.find_one.return_value = officer_doc
    return collection


def test_current_officer_from_db(client):
    doc = {
        "officerId": "officer-001",
        "fullName": "Curtis Dean",
        "title": "Loan Officer",
        "nmlsId": "1120394",
        "email": "curtis.dean@lendflow.example",
        "avatarSeed": "curtis-dean",
    }
    # Patch the exact binding the service uses (robust to import order).
    with patch("services.officer_service.coll", return_value=_collection_returning(doc)):
        response = client.get("/api/officers/current")
    assert response.status_code == 200
    data = response.json()
    assert data["officer_id"] == "officer-001"
    assert data["full_name"] == "Curtis Dean"
    assert data["title"] == "Loan Officer"


def test_current_officer_fallback_when_unseeded(client):
    # No seeded officer — endpoint must still return the default persona.
    with patch("services.officer_service.coll", return_value=_collection_returning(None)):
        response = client.get("/api/officers/current")
    assert response.status_code == 200
    data = response.json()
    assert data["full_name"] == "Curtis Dean"
    # Fallback must not leak the internal seed flag.
    assert "seed_complete" not in data
