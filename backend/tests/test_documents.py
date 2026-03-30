from unittest.mock import MagicMock


def test_get_document_invalid_id(client):
    response = client.get("/api/documents/not-a-valid-objectid")
    assert response.status_code == 400


def test_upload_rejects_non_pdf(client, mock_db):
    mock_db["applications"].find_one.return_value = {"application_id": "APP-2026-00001"}
    response = client.post(
        "/api/applications/APP-2026-00001/documents/upload",
        files={"file": ("test.txt", b"not a pdf", "text/plain")},
        data={"doc_type": "unknown"},
    )
    assert response.status_code == 400
    assert "PDF" in response.json()["detail"]


def test_upload_rejects_fake_pdf(client, mock_db):
    mock_db["applications"].find_one.return_value = {"application_id": "APP-2026-00001"}
    response = client.post(
        "/api/applications/APP-2026-00001/documents/upload",
        files={"file": ("test.pdf", b"not really a pdf", "application/pdf")},
        data={"doc_type": "unknown"},
    )
    assert response.status_code == 400
    assert "valid PDF" in response.json()["detail"]
