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


def test_attach_borrower_employment_uses_loan_order():
    """Employment is assigned by the loan's borrower_ids order, never by the
    customer fetch order (a `$in` lookup does not preserve input order)."""
    from services.application_service import _attach_borrower_employment

    app = {"borrower_ids": ["CUST-PRIMARY", "CUST-CO"]}
    # Deliberately out-of-order dict to prove lookup is keyed, not positional.
    by_id = {
        "CUST-CO": {"customer_id": "CUST-CO", "employment": {
            "job_title": "Registered Nurse",
            "employer": {"name": "Hospital"},
            "income": {"amount": 50000},
        }},
        "CUST-PRIMARY": {"customer_id": "CUST-PRIMARY", "employment": {
            "job_title": "Software Engineer",
            "employer": {"name": "TechNova"},
            "income": {"amount": 100000},
        }},
    }
    _attach_borrower_employment(app, by_id)
    assert app["income_summary"]["primary_employment"] == "Software Engineer · TechNova"
    assert app["income_summary"]["co_applicant_employment"] == "Registered Nurse"
    assert app["income_summary"]["co_applicant_gross"] == 50000


def test_attach_borrower_employment_solo_and_missing():
    """Solo applications get primary only; unresolvable customers are skipped."""
    from services.application_service import _attach_borrower_employment

    solo = {"borrower_ids": ["CUST-ONLY"], "income_summary": {"primary": 100000}}
    _attach_borrower_employment(solo, {"CUST-ONLY": {"customer_id": "CUST-ONLY", "employment": {
        "job_title": "Analyst", "income": {"amount": 100000}, "employer": {"name": None},
    }}})
    assert solo["income_summary"]["primary_employment"] == "Analyst"
    assert "co_applicant_gross" not in solo["income_summary"]

    empty = {"borrower_ids": ["CUST-NOPE"], "income_summary": {}}
    _attach_borrower_employment(empty, {})  # unresolvable -> untouched
    assert "primary_employment" not in empty["income_summary"]
