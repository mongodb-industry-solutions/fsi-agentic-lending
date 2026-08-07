"""Tests for the create_intervention helper."""
from unittest.mock import patch, MagicMock
from agents.helpers.interventions import create_intervention


@patch("agents.helpers.interventions.get_db")
def test_create_intervention_returns_true_on_success(mock_get_db):
    mock_col = MagicMock()
    mock_col.find_one.return_value = None  # no existing duplicate → proceed to insert
    mock_col.insert_one.return_value = MagicMock(inserted_id="abc123")
    mock_get_db.return_value = {"interventions": mock_col}

    result = create_intervention(
        "APP-TEST-001",
        intervention_type="missing_document",
        source_node="test",
        risk_flag="test_flag",
        severity="advisory",
        borrower_summary="Please upload docs.",
        action_required="Upload pay stubs.",
        doc_types=["paystubs"],
    )
    assert result is True
    mock_col.insert_one.assert_called_once()
    doc = mock_col.insert_one.call_args[0][0]
    assert doc["application_id"] == "APP-TEST-001"
    assert doc["type"] == "missing_document"
    assert "borrower_context" in doc
    assert "internal_context" in doc


@patch("agents.helpers.interventions.get_db")
def test_create_intervention_returns_false_on_error(mock_get_db):
    mock_col = MagicMock()
    mock_col.find_one.return_value = None  # no existing duplicate → reach insert_one
    mock_col.insert_one.side_effect = Exception("DB error")
    mock_get_db.return_value = {"interventions": mock_col}

    result = create_intervention(
        "APP-TEST-001",
        intervention_type="test",
        source_node="test",
        risk_flag="test",
        severity="advisory",
        borrower_summary="test",
        action_required="test",
    )
    assert result is False
