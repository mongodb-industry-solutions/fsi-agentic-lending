"""BIAN ConsumerLoan service-domain routes.

Mounted at the root (no `/api` prefix) so URLs are exactly
`POST /ConsumerLoan/Initiate`, `GET /ConsumerLoan/{id}/Retrieve`, etc., per
BIAN v14. HTTP methods are BIAN-native: POST initiates, GET retrieves. These
run *alongside* the demo's native `/api/applications/*` routes — nothing native
is changed.

Wire shape: camelCase = `loans` collection Mongo field names, per the
payment-flow-full standard. Responses return the raw stored document with
`_id` stripped. No wire translation — the wire speaks the storage names
directly. See `.claude/outputs/plan-lending-bian-apis.md` and
umbrella `decisions.md` 2026-09-25.

Scope (6 mappable routes, 4 here): Initiate, Retrieve, Maintenance/Retrieve,
Disbursement/Retrieve. Update and Control are deferred — the demo has no
edit-terms service function and status transitions are agent/HITL-driven
(BIAN's 7-state apex maps ambiguously onto the 12-state operational machine).
"""
import logging

from fastapi import APIRouter, HTTPException

from api_models import ConsumerLoanInitiateRequest
from bian_api import adapt_initiate
from routes._bian_util import bian_response, strip
from services.application_service import create_application, get_application_stored

logger = logging.getLogger(__name__)

router = APIRouter(tags=["BIAN - ConsumerLoan"])


@router.post("/ConsumerLoan/Initiate")
async def initiate_consumer_loan(body: ConsumerLoanInitiateRequest):
    """Initiate a consumer loan facility (BIAN `ConsumerLoanFacility/Initiate`).

    Borrowers are registered in the shared party directory by name; the response
    returns the minted `loansId` and the BIAN-shaped (camelCase storage) facility.
    """
    app = create_application(adapt_initiate(body))
    stored = get_application_stored(app["application_id"])
    return bian_response({"loansId": stored["loansId"], "loan": strip(stored)})


@router.get("/ConsumerLoan/{consumerloanid}/Retrieve")
async def retrieve_consumer_loan(consumerloanid: str):
    """Retrieve a consumer loan facility by its `ConsumerLoanReference` (`loansId`)."""
    stored = get_application_stored(consumerloanid)
    if not stored:
        raise HTTPException(status_code=404, detail=f"ConsumerLoan {consumerloanid} not found")
    return bian_response({"loansId": stored["loansId"], "loan": strip(stored)})


@router.get("/ConsumerLoan/{consumerloanid}/Maintenance/{maintenanceid}/Retrieve")
async def retrieve_consumer_loan_maintenance(consumerloanid: str, maintenanceid: str):
    """Retrieve the Maintenance behaviour qualifier (status history + last update).

    `maintenanceid` is conventional — the maintenance record is an embedded
    sub-record of the loan facility, not a standalone document.
    """
    stored = get_application_stored(consumerloanid)
    if not stored:
        raise HTTPException(status_code=404, detail=f"ConsumerLoan {consumerloanid} not found")
    return bian_response({
        "loansId": consumerloanid,
        "maintenanceId": maintenanceid,
        "maintenance": stored.get("maintenance", {}),
    })


@router.get("/ConsumerLoan/{consumerloanid}/Disbursement/{disbursementid}/Retrieve")
async def retrieve_consumer_loan_disbursement(consumerloanid: str, disbursementid: str):
    """Retrieve the Disbursement behaviour qualifier.

    Disbursement is populated post-approval; an in-flight application has none,
    which is a 404 rather than an empty record.
    """
    stored = get_application_stored(consumerloanid)
    if not stored:
        raise HTTPException(status_code=404, detail=f"ConsumerLoan {consumerloanid} not found")
    disbursement = stored.get("disbursement")
    if not disbursement:
        raise HTTPException(
            status_code=404,
            detail=f"No disbursement record for ConsumerLoan {consumerloanid}",
        )
    return bian_response({
        "loansId": consumerloanid,
        "disbursementId": disbursementid,
        "disbursement": disbursement,
    })
