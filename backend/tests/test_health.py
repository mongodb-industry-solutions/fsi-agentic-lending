from unittest.mock import MagicMock, patch


def test_health_ok(client, mock_db):
    mock_db.command.return_value = {"ok": 1}
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


def test_health_mongo_down(client, mock_db):
    mock_db.command.side_effect = Exception("Connection refused")
    response = client.get("/")
    assert response.status_code == 503


def test_ready_ok(client, mock_db):
    mock_db.command.return_value = {"ok": 1}
    # Mock graph compilation
    with patch('agents.graph.get_graph') as mock_graph:
        mock_graph.return_value = MagicMock()
        response = client.get("/ready")
        assert response.status_code == 200
