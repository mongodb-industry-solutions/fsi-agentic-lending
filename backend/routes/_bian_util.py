"""Shared helpers for the BIAN route modules.

`_bian_response` serializes via `MyJSONEncoder` (handles ObjectId/datetime) so
handlers can return raw stored documents without per-field conversion — same
pattern as the accounts/transactions/ledger services. `_strip` removes `_id`.
"""
import json

from fastapi.responses import Response

from encoder.json_encoder import MyJSONEncoder


def bian_response(envelope: dict) -> Response:
    return Response(
        content=json.dumps(envelope, cls=MyJSONEncoder),
        media_type="application/json",
    )


def strip(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc
