from unittest.mock import MagicMock, patch

import pytest

import routes.documents as documents_route


@pytest.fixture
def synthetic_profiles(tmp_path):
    """A synthetic-data tree where every profile shares the same filenames.

    This collision is the whole point: a filename-only lookup cannot tell these
    apart, so each file's bytes identify the profile it came from.
    """
    root = tmp_path / "synthetic data"
    for profile in ("bob-johnson", "jane-doe", "sarah-williams"):
        d = root / profile
        d.mkdir(parents=True)
        (d / "05_bank_statements.pdf").write_bytes(f"%PDF-{profile}".encode())
    with patch.object(documents_route, "_synthetic_dir", return_value=root):
        yield root


def _patch_profile(profile_id):
    """Stub the application -> profile_id lookup (no database in unit tests)."""
    return patch.object(
        documents_route, "_application_profile_id", return_value=profile_id
    )


def test_resolve_pdf_path_uses_own_profile_not_first_sorted(synthetic_profiles):
    """Regression: every borrower used to be served bob-johnson's PDF.

    bob-johnson sorts first under synthetic data/, so the filename-only search
    returned it for everyone. Resolution must follow the document's own profile.
    """
    doc = {"filename": "05_bank_statements.pdf", "applicationId": "APP-2026-00005"}
    with _patch_profile("sarah-williams"):
        path = documents_route._resolve_pdf_path(doc)

    assert path is not None
    assert path.parent.name == "sarah-williams"
    assert path.read_bytes() == b"%PDF-sarah-williams"


def test_resolve_pdf_path_reads_legacy_application_id(synthetic_profiles):
    """Pre-BIAN documents key on application_id rather than applicationId."""
    doc = {"filename": "05_bank_statements.pdf", "application_id": "APP-2026-00002"}
    with _patch_profile("jane-doe"):
        path = documents_route._resolve_pdf_path(doc)

    assert path is not None
    assert path.parent.name == "jane-doe"


def test_resolve_pdf_path_rejects_traversal_in_filename(synthetic_profiles):
    """A filename may not escape its profile directory."""
    doc = {
        "filename": "../bob-johnson/05_bank_statements.pdf",
        "applicationId": "APP-2026-00005",
    }
    with _patch_profile("sarah-williams"), \
         patch.object(documents_route, "_find_pdf", return_value=None):
        path = documents_route._resolve_pdf_path(doc)

    # Stripped to a bare name, so it resolves inside the owning profile.
    assert path is None or path.parent.name == "sarah-williams"


def test_resolve_pdf_path_falls_back_when_profile_missing(synthetic_profiles):
    """Without a profile_id the filename search is all that is left."""
    doc = {"filename": "receipt.pdf", "applicationId": "APP-UPLOAD"}
    sentinel = synthetic_profiles / "bob-johnson" / "05_bank_statements.pdf"
    with _patch_profile(None), \
         patch.object(documents_route, "_find_pdf", return_value=sentinel) as find:
        path = documents_route._resolve_pdf_path(doc)

    assert path == sentinel
    find.assert_called_once_with("receipt.pdf")


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
