"""Read access to credit reports for the BIAN CustomerCreditRating surface.

Returns the raw stored BIAN camelCase documents — the BIAN API wire speaks the
storage shape directly (camelCase = Mongo field names), so no `from_storage`
translation. Credit reports are pulled by the agentic pipeline's `credit_puller`
node; this module exposes only the read path the BIAN Retrieve endpoints need,
which is why there is no `initiate` here (see the decision log for why
`POST /CustomerCreditRating/Initiate` is deferred).
"""
import logging

from db.mdb import coll
from db.storage_mapping import storage_key

logger = logging.getLogger(__name__)


def _k(runtime_path: str) -> str:
    return storage_key("credit_reports", runtime_path)


def get_credit_report_stored(report_id: str) -> dict | None:
    """Fetch one raw stored credit report by its `id` (CustomerCreditRatingReference)."""
    return coll("credit_reports").find_one({_k("id"): report_id})
