"""BIAN CustomerCreditRating service-domain routes.

Mounted at the root (no `/api` prefix): `GET /CustomerCreditRating/{id}/Retrieve`
and `GET /CustomerCreditRating/{id}/ExternalReporting/{eid}/Retrieve`, per
BIAN v14. Read-only — credit reports are pulled by the agentic pipeline's
`credit_puller` node, so `POST /CustomerCreditRating/Initiate` is deferred.

Wire shape: camelCase = `creditReports` collection Mongo field names. Responses
return the raw stored document with `_id` stripped. No wire translation — the
wire speaks the storage names directly.
"""
import logging

from fastapi import APIRouter, HTTPException

from routes._bian_util import bian_response, strip
from services.credit_report_service import get_credit_report_stored

logger = logging.getLogger(__name__)

router = APIRouter(tags=["BIAN - CustomerCreditRating"])


@router.get("/CustomerCreditRating/{customercreditratingid}/Retrieve")
async def retrieve_customer_credit_rating(customercreditratingid: str):
    """Retrieve a bureau credit report by its `CustomerCreditRatingReference` (`id`)."""
    stored = get_credit_report_stored(customercreditratingid)
    if not stored:
        raise HTTPException(
            status_code=404,
            detail=f"CustomerCreditRating {customercreditratingid} not found",
        )
    return bian_response({"id": stored["id"], "creditReport": strip(stored)})


@router.get(
    "/CustomerCreditRating/{customercreditratingid}/ExternalReporting/{externalreportingid}/Retrieve"
)
async def retrieve_customer_credit_rating_external_reporting(
    customercreditratingid: str, externalreportingid: str
):
    """Retrieve the ExternalReporting behaviour qualifier (bureau detail).

    `externalreportingid` is conventional — the external-reporting record is an
    embedded sub-record of the credit rating, not a standalone document.
    """
    stored = get_credit_report_stored(customercreditratingid)
    if not stored:
        raise HTTPException(
            status_code=404,
            detail=f"CustomerCreditRating {customercreditratingid} not found",
        )
    external_reporting = stored.get("externalReporting")
    if not external_reporting:
        raise HTTPException(
            status_code=404,
            detail=f"No external reporting record for CustomerCreditRating {customercreditratingid}",
        )
    return bian_response({
        "id": customercreditratingid,
        "externalReportingId": externalreportingid,
        "externalReporting": external_reporting,
    })
