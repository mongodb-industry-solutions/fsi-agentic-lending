import json
from datetime import datetime
from bson import ObjectId


class MyJSONEncoder(json.JSONEncoder):
    """Custom JSON encoder for ObjectId and datetime (BIAN response path).

    Mirrors the accounts/transactions/ledger services' encoder so BIAN
    responses serialize BSON types without per-call conversion.
    """
    def default(self, o):
        if isinstance(o, ObjectId):
            return str(o)
        if isinstance(o, datetime):
            return o.isoformat()
        return super().default(o)
