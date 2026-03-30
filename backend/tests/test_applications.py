from unittest.mock import MagicMock


def test_create_application(client, mock_db):
    mock_db["applications"].insert_one.return_value = MagicMock(inserted_id="test_id")
    mock_db["applications"].count_documents.return_value = 0
    mock_db["borrowers"].insert_one.return_value = MagicMock(inserted_id="borrower_id")

    response = client.post("/api/applications", json={
        "primary_name": "Test User",
        "loan_amount": 500000,
        "purchase_price": 600000,
        "down_payment": 100000,
        "property_address": "123 Test St",
        "combined_income": 150000,
        "primary_income": 150000,
    })
    assert response.status_code == 200
    assert "application_id" in response.json()


def test_get_application_invalid_id(client):
    response = client.get("/api/applications/invalid-id")
    assert response.status_code == 400


def test_get_application_not_found(client, mock_db):
    mock_db["applications"].find_one.return_value = None
    response = client.get("/api/applications/APP-2026-00001")
    assert response.status_code == 404


def test_list_applications(client, mock_db):
    mock_cursor = MagicMock()
    mock_cursor.sort.return_value = mock_cursor
    mock_cursor.__iter__ = MagicMock(return_value=iter([]))
    mock_db["applications"].find.return_value = mock_cursor
    response = client.get("/api/applications")
    assert response.status_code == 200
