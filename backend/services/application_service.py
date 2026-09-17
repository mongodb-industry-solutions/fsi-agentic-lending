"""Application service — handles CRUD and aggregation for loan applications.

Runtime shape is this demo's native snake_case. Documents are translated to the
BIAN `loans` / `creditReports` shape at the storage boundary (`db.storage_mapping`).
Query filters, projections and sort keys go through `_k()` / `_cr_k()`, which the
document mappers cannot reach.
"""
import logging
import os
from datetime import datetime, timezone
from bson import ObjectId
from db.mdb import coll, get_db as _get_db
from db.storage_mapping import from_storage, storage_filter, storage_key, to_storage
from models.schemas import ApplicationStatus, to_bian_status
from services import customer_service

logger = logging.getLogger(__name__)


def _k(runtime_path: str) -> str:
    """Runtime field path -> storage path on the `loans` collection."""
    return storage_key("applications", runtime_path)


def _cr_k(runtime_path: str) -> str:
    """Runtime field path -> storage path on the `creditReports` collection."""
    return storage_key("credit_reports", runtime_path)


def serialize_doc(doc):
    """Convert MongoDB document to JSON-serializable dict."""
    if doc is None:
        return None
    doc = dict(doc)
    if "_id" in doc:
        doc["_id"] = str(doc["_id"])
    # borrower_ids / borrower_id are customerId strings since the BIAN
    # migration; str() is retained only to absorb any legacy ObjectId.
    if "borrower_ids" in doc:
        doc["borrower_ids"] = [str(bid) for bid in doc["borrower_ids"]]
    if "borrower_id" in doc:
        doc["borrower_id"] = str(doc["borrower_id"])
    for key, value in list(doc.items()):
        if isinstance(value, datetime):
            doc[key] = value.isoformat()
        elif isinstance(value, list):
            new_list = []
            for item in value:
                if isinstance(item, dict):
                    item = dict(item)
                    for k, v in list(item.items()):
                        if isinstance(v, datetime):
                            item[k] = v.isoformat()
                new_list.append(item)
            doc[key] = new_list
    return doc


def history_entry(status: str, timestamp, detail: str = "") -> dict:
    """A `maintenance.statusHistory[]` entry in STORAGE shape.

    Mirrors the top-level pair: `status` is the BIAN projection, `statusSource`
    the operational value. Written through one helper so entries created at
    runtime match the ones produced by the data migration — otherwise the
    officer timeline renders a mix of `UNDER_REVIEW` and `underwriting`.
    """
    return {
        "status": to_bian_status(status),
        "statusSource": status,
        "timestamp": timestamp,
        "detail": detail,
    }


def read_loan(stored: dict) -> dict:
    """Storage `loans` document -> runtime application shape.

    `statusSource` carries the operational 12-state value and wins over the
    BIAN `status` projection, which collapses four in-flight states onto
    UNDER_REVIEW. Documents written before the migration have no statusSource,
    so the stored `status` is the fallback.

    Applies to history entries too: without this the officer timeline renders
    UNDER_REVIEW four times in a row instead of processing -> underwriting ->
    review -> action_required.
    """
    app = from_storage("applications", stored)
    source = app.pop("status_source", None)
    if source:
        app["status"] = source
    history = app.get("status_history")
    if isinstance(history, list):
        app["status_history"] = [_unwrap_status(e) for e in history]
    return app


def _unwrap_status(entry):
    if not isinstance(entry, dict):
        return entry
    entry = dict(entry)
    source = entry.pop("status_source", None)
    if source:
        entry["status"] = source
    return entry


def create_application(data: dict, profile_id: str = None, demo_session_id: str = None) -> dict:
    """Create a new loan application, registering its borrowers as customers."""
    now = datetime.now(timezone.utc)

    # Borrowers are customers in the shared party directory, keyed by a
    # deterministic customerId. A repeat applicant resolves to the existing
    # entry rather than creating a second identity (playbook rule: never
    # duplicate identities).
    borrower_names = [data["primary_name"]]
    if data.get("co_applicant_name"):
        borrower_names.append(data["co_applicant_name"])
    borrower_ids = [customer_service.upsert_customer(n, now) for n in borrower_names]

    oid = ObjectId()
    application_id = f"APP-{str(oid)[-8:].upper()}"

    application = {
        "application_id": application_id,
        "borrower_ids": borrower_ids,
        "borrower_names": borrower_names,
        "loan_amount": data["loan_amount"],
        "purchase_price": data["purchase_price"],
        "down_payment": data["down_payment"],
        "product": data.get("product", "5yr Fixed (25yr Amort)"),
        "property": {
            "address": data["property_address"],
            "type": data.get("property_type", "Detached Home"),
            "purchase_price": data["purchase_price"],
            "annual_tax": data.get("annual_property_tax", 0),
        },
        "income_summary": {
            "combined_gross": data["combined_income"],
            "primary": data["primary_income"],
            "co_applicant": data.get("co_applicant_income", 0),
        },
        "existing_monthly_debt": data.get("existing_monthly_debt", 0),
        "status": "submitted",
        "status_history": [
            {"status": "submitted", "timestamp": now, "detail": "Application received"}
        ],
        "created_at": now,
        "updated_at": now,
    }

    if profile_id:
        application["profile_id"] = profile_id
    if demo_session_id:
        application["demo_session_id"] = demo_session_id

    stored = to_storage("applications", application)
    stored["status"] = to_bian_status(application["status"])
    stored["statusSource"] = application["status"]
    stored["maintenance"] = {
        "statusHistory": [history_entry("submitted", now, "Application received")],
        "updatedAt": now,
    }
    coll("applications").insert_one(stored)
    logger.info(f"Created application {application_id}")

    # The reverse link the old `borrowers.application_id` provided now lives
    # only on the loan (`borrowerIds[]`); customers are shared across
    # applications and must not carry one application's id.
    return serialize_doc(application)


def get_application(application_id: str) -> dict | None:
    """Get full application with related documents and credit reports."""
    stored = coll("applications").find_one({_k("application_id"): application_id})
    if not stored:
        return None
    logger.info(f"Fetched application {application_id}")

    app = serialize_doc(from_storage("applications", stored))

    # Attach documents
    docs = coll("documents").find(storage_filter("documents", {"application_id": application_id}))
    app["documents"] = [serialize_doc(d) for d in docs]

    # Attach credit reports — borrower ids are customerId strings.
    if app.get("borrower_ids"):
        reports = coll("credit_reports").find(
            {_cr_k("borrower_id"): {"$in": app["borrower_ids"]}}
        )
        app["credit_reports"] = [
            serialize_doc(from_storage("credit_reports", r)) for r in reports
        ]

    # The retired `borrowers` collection no longer exists in leafy_bank_bian;
    # borrower employment detail now lives on the shared `customers` directory
    # entries (tagged `sourceSystem: fsi-agentic-lending`). Enrich the loan's
    # income summary from those entries — additive and guarded, so a missing or
    # unresolvable customer never fails the endpoint (positional: PRIMARY at
    # [0], CO_APPLICANT at [1], same convention the storage boundary uses).
    try:
        borrower_ids = app.get("borrower_ids") or []
        if borrower_ids:
            fetched = customer_service.get_customers(borrower_ids)
            by_id = {c.get("customer_id"): c for c in fetched}
            _attach_borrower_employment(app, by_id)
    except Exception:
        logger.exception("Failed to enrich borrower employment from customers for %s", application_id)

    return app


def _attach_borrower_employment(app: dict, borrowers_by_id: dict) -> None:
    """Fill ``income_summary.primary_employment`` / ``co_applicant_*`` from the
    shared ``customers`` directory.

    ``borrowers_by_id`` maps customerId -> customer (runtime shape). The loan's
    ``borrower_ids`` ORDER is the source of truth (PRIMARY at index 0,
    CO_APPLICANT at index 1) — a ``$in`` lookup returns DB order, not input
    order, so indices must be taken from the loan's own array, never from the
    fetch order. Additive; never mutates anything but ``income_summary``.
    """
    if not borrowers_by_id:
        return
    borrower_ids = app.get("borrower_ids") or []
    ordered = [borrowers_by_id[bid] for bid in borrower_ids if borrowers_by_id.get(bid)]
    if not ordered:
        return

    income = app.setdefault("income_summary", {})
    primary_emp = ordered[0].get("employment") or {}
    primary_job = primary_emp.get("job_title")
    if primary_job:
        employer = (primary_emp.get("employer") or {}).get("name")
        income["primary_employment"] = f"{primary_job} · {employer}" if employer else primary_job

    if len(ordered) > 1:
        co_emp = ordered[1].get("employment") or {}
        co_job = co_emp.get("job_title")
        if co_job:
            income["co_applicant_employment"] = co_job
        co_income = (co_emp.get("income") or {}).get("amount")
        if co_income is not None:
            income["co_applicant_gross"] = co_income


def list_applications(skip: int = 0, limit: int = 50) -> list[dict]:
    """List all applications (summary view). Excludes seed template apps."""
    projection = {
        _k(f): 1
        for f in (
            "application_id", "borrower_names", "loan_amount",
            "product", "created_at", "updated_at",
        )
    }
    # statusSource, not status: the operational 12-state value is what the
    # officer list renders.
    projection["statusSource"] = 1
    apps = coll("applications").find(
        {_k("seed_complete"): {"$ne": True}}, projection
    ).sort(_k("created_at"), -1).skip(skip).limit(limit)
    result = [serialize_doc(read_loan(a)) for a in apps]
    logger.info(f"Listed {len(result)} applications")
    return result


SEED_APPLICATION_IDS = {
    "marcus-delgado": "APP-2026-00001",
    "jane-doe": "APP-2026-00002",
    "john-smith": "APP-2026-00003",
    "bob-johnson": "APP-2026-00004",
    "sarah-williams": "APP-2026-00005",
}


def _patch_structured_data_names(structured_data: dict, source_names: list[str], target_names: list[str]) -> dict:
    """Patch person names in structured_data when cloning docs across profiles.

    Replaces source borrower names with target borrower names in the ``persons``
    array (used by government_id, employment_letter, credit_report, etc.).
    Returns a new dict — does not mutate the input.
    """
    if not structured_data or not source_names or not target_names:
        return structured_data
    patched = dict(structured_data)
    persons = patched.get("persons")
    if isinstance(persons, list):
        new_persons = []
        for person in persons:
            person = dict(person)  # shallow copy to avoid mutating source
            if "full_name" in person:
                for si, sname in enumerate(source_names):
                    if si < len(target_names) and person["full_name"] == sname:
                        person["full_name"] = target_names[si]
                        break
            new_persons.append(person)
        patched["persons"] = new_persons
    return patched


def clone_demo_documents(source_app_id: str, target_app_id: str) -> int:
    """Clone all documents from a seeded application to a new application.

    When cloning across profiles, patches ``structured_data.persons[].full_name``
    to match the target application's borrower names.
    """
    source_docs = [from_storage("documents", d) for d in coll("documents")
        .find(storage_filter("documents", {"application_id": source_app_id}))]
    if not source_docs:
        logger.warning(f"No source documents found for {source_app_id}")
        return 0

    # Look up borrower names for name-patching when cloning across profiles
    loans = coll("applications")
    source_app = loans.find_one({_k("application_id"): source_app_id}, {_k("borrower_names"): 1})
    target_app = loans.find_one({_k("application_id"): target_app_id}, {_k("borrower_names"): 1})
    source_names = source_app.get(_k("borrower_names"), []) if source_app else []
    target_names = target_app.get(_k("borrower_names"), []) if target_app else []
    needs_patch = source_names and target_names and source_names != target_names

    now = datetime.now(timezone.utc)
    clones = []
    for doc in source_docs:
        clone = {k: v for k, v in doc.items() if k not in ("_id", "content_hash")}
        clone["application_id"] = target_app_id
        clone["created_at"] = now
        if needs_patch and clone.get("structured_data"):
            clone["structured_data"] = _patch_structured_data_names(
                clone["structured_data"], source_names, target_names
            )
        clones.append(clone)
    if clones:
        coll("documents").insert_many([to_storage("documents", c) for c in clones])
    logger.info(f"Cloned {len(clones)} documents from {source_app_id} to {target_app_id}")
    return len(clones)


def clone_demo_credit_reports(source_app_id: str, target_app_id: str) -> int:
    """Clone credit reports from a seeded application's borrowers to a new application's borrowers.

    Reports are linked by borrower_id (a customerId string). A demo application
    for a different profile has different borrowers, so reports are copied and
    re-linked positionally.
    """
    loans = coll("applications")
    source_app = loans.find_one({_k("application_id"): source_app_id}, {_k("borrower_ids"): 1})
    target_app = loans.find_one({_k("application_id"): target_app_id}, {_k("borrower_ids"): 1})
    if not source_app or not target_app:
        return 0

    source_bids = from_storage("applications", source_app).get("borrower_ids", [])
    target_bids = from_storage("applications", target_app).get("borrower_ids", [])
    if not source_bids or not target_bids:
        return 0

    source_reports = [
        from_storage("credit_reports", r)
        for r in coll("credit_reports").find({_cr_k("borrower_id"): {"$in": source_bids}})
    ]
    if not source_reports:
        logger.warning(f"No source credit reports found for {source_app_id}")
        return 0

    now = datetime.now(timezone.utc)
    # Build a mapping: source borrower_id → target borrower_id (positional)
    bid_map = {}
    for i, sbid in enumerate(source_bids):
        if i < len(target_bids):
            bid_map[sbid] = target_bids[i]

    clones = []
    for report in source_reports:
        new_bid = bid_map.get(report["borrower_id"])
        if not new_bid:
            continue
        clone = {k: v for k, v in report.items() if k != "_id"}
        clone["borrower_id"] = new_bid
        clone["cloned_at"] = now
        # creditReports.id is required and unique per report; the source has no
        # identifier, so derive one that stays stable for this clone.
        clone["id"] = f"CR-{new_bid}-{ObjectId()}"
        clones.append(to_storage("credit_reports", clone))

    if clones:
        coll("credit_reports").insert_many(clones)
    logger.info(f"Cloned {len(clones)} credit reports from {source_app_id} to {target_app_id}")
    return len(clones)


def _cloned_reports_for(borrower_ids: list[str]) -> dict:
    """Filter matching only the credit reports THIS APP cloned, for these borrowers.

    Two reasons a plain `{borrowerId: {$in: ...}}` delete is wrong:

    1. `creditReports` is keyed by borrower, not by application, and
       `customer_service.mint_customer_id` is deterministic on the borrower's
       name — so a demo application for "Jane Doe" resolves to the SAME
       customerId as the seeded one. Deleting by borrower alone wipes the
       seeded application's migrated reports, and nothing re-seeds them: every
       later clone logs "No source credit reports found" and the pipeline
       underwrites with no credit data. Confirmed empirically — a reload
       reported `inserted=29`, meaning all 29 migrated reports were absent.

    2. `clonedAtSource` is NOT the provenance marker it looks like. 21 of the
       29 migrated reports already carry `cloned_at` in the source dump
       (`repos/lending/dump/fsi-agentic-lending.credit_reports.json`) because
       they were clones in the pre-migration demo. Keying off it would delete
       21 migrated reports.

    The id shape is the honest discriminator. `clone_demo_credit_reports`
    derives `CR-{customerId}-{ObjectId()}`; `transform.py` emits `CR-{oid}`.
    Only a post-migration clone has `CR-CUST-` at the front, and the anchored
    prefix lets the unique `id` index serve the match.
    """
    return {
        _cr_k("borrower_id"): {"$in": borrower_ids},
        _cr_k("id"): {"$regex": "^CR-CUST-"},
    }


def _reset_application_state(app_id: str) -> None:
    """Wipe all transient and cloned state for an application."""
    db = _get_db()
    now = datetime.now(timezone.utc)

    # Get borrower IDs for credit report cleanup
    stored = coll("applications").find_one(
        {_k("application_id"): app_id}, {_k("borrower_ids"): 1}
    )
    borrower_ids = from_storage("applications", stored).get("borrower_ids", []) if stored else []

    coll("applications").update_one(
        {_k("application_id"): app_id},
        {
            "$set": {
                "status": to_bian_status("submitted"),
                "statusSource": "submitted",
                _k("updated_at"): now,
                _k("status_history"): [
                    history_entry("submitted", now, "Application received (demo reset)")
                ],
                "maintenance.updatedAt": now,
            },
            # The whole assessment sub-record goes, rather than ten field paths.
            "$unset": {"assessment": ""},
        },
    )
    coll("documents").delete_many(storage_filter("documents", {"application_id": app_id}))
    if borrower_ids:
        coll("credit_reports").delete_many(_cloned_reports_for(borrower_ids))
    coll("conversations").delete_many(storage_filter("conversations", {"application_id": app_id}))
    coll("interventions").delete_many(storage_filter("interventions", {"application_id": app_id}))
    db["checkpoints"].delete_many({"thread_id": app_id})
    db["checkpoint_writes"].delete_many({"thread_id": app_id})
    coll("pipeline_locks").delete_many({"_id": app_id})
    try:
        coll("agent_activity").delete_many(storage_filter("agent_activity", {"application_id": app_id}))
    except Exception as e:
        logger.warning(f"Could not delete agent_activity for {app_id}: {e}")
    logger.info(f"Reset application state for {app_id}")


def upsert_demo_application(profile_id: str, demo_session_id: str, data: dict) -> dict:
    """Create or reset a session-isolated demo application.

    If an application already exists for (profile_id, demo_session_id), reset it.
    Otherwise create a new one and clone documents from the seeded profile.

    Returns the clone counts so the caller can fail loudly when documents could
    not be attached — a submit that ships an app with zero documents is broken
    (the borrower just saw those docs on the apply page), and a silent empty
    clone is how a wrong DATABASE_NAME / COLL_* mapping shows up as
    "No documents found" in the tracking pane.
    """
    existing = coll("applications").find_one(storage_filter("applications", {
        "profile_id": profile_id,
        "demo_session_id": demo_session_id,
    }))

    if existing:
        existing = from_storage("applications", existing)
        app_id = existing["application_id"]
        profile = existing.get("profile_id")
        _reset_application_state(app_id)
        # Re-clone seed data after reset
        seed_app_id = SEED_APPLICATION_IDS.get(profile) or SEED_APPLICATION_IDS.get("marcus-delgado")
        docs_attached = 0
        credit_reports_attached = 0
        if seed_app_id:
            docs_attached = clone_demo_documents(seed_app_id, app_id)
            credit_reports_attached = clone_demo_credit_reports(seed_app_id, app_id)
        logger.info(f"Reset existing demo application {app_id} for session {demo_session_id[:8]}")
        return {
            "application_id": app_id,
            "status": "submitted",
            "reset": True,
            "documents_attached": docs_attached,
            "credit_reports_attached": credit_reports_attached,
        }

    app = create_application(data, profile_id=profile_id, demo_session_id=demo_session_id)
    app_id = app["application_id"]

    # Clone seed data — fall back to default seed if profile not explicitly mapped
    seed_app_id = SEED_APPLICATION_IDS.get(profile_id) or SEED_APPLICATION_IDS.get("marcus-delgado")
    docs_attached = 0
    credit_reports_attached = 0
    if seed_app_id:
        docs_attached = clone_demo_documents(seed_app_id, app_id)
        credit_reports_attached = clone_demo_credit_reports(seed_app_id, app_id)

    return {
        "application_id": app_id,
        "status": "submitted",
        "reset": False,
        "documents_attached": docs_attached,
        "credit_reports_attached": credit_reports_attached,
    }


def reset_all_demo_data() -> dict:
    """Wipe all demo-created applications and related data. Preserves seeded data."""
    db = _get_db()
    # Restore renewals to pristine "due" state. They live in their own collection,
    # independent of the origination apps, so the wipe below never touches them.
    try:
        from scripts.seed_renewals import seed_renewals
        seed_renewals(reset=True)
        coll("agent_activity").delete_many({"agent": "renewal_agent"})
    except Exception as e:
        logger.warning(f"Could not reset renewals: {e}")

    # Single predicate for "non-seed app" — used for both the find and the final
    # delete so they can't drift out of sync.
    seed_ids = list(SEED_APPLICATION_IDS.values())
    non_seed_filter = storage_filter("applications", {
        "seed_complete": {"$ne": True}, "application_id": {"$nin": seed_ids},
    })
    demo_apps = [
        from_storage("applications", a)
        for a in coll("applications").find(
            non_seed_filter, {_k("application_id"): 1, _k("borrower_ids"): 1}
        )
    ]
    if not demo_apps:
        return {
            "deleted_applications": 0,
            "deleted_documents": 0,
            "deleted_conversations": 0,
            "deleted_interventions": 0,
            "deleted_credit_reports": 0,
            "deleted_borrowers": 0,
        }

    app_ids = [a["application_id"] for a in demo_apps]
    borrower_ids = [bid for a in demo_apps for bid in a.get("borrower_ids", [])]

    docs_del = coll("documents").delete_many(storage_filter("documents", {"application_id": {"$in": app_ids}}))
    convs_del = coll("conversations").delete_many(storage_filter("conversations", {"application_id": {"$in": app_ids}}))
    intv_del = coll("interventions").delete_many(storage_filter("interventions", {"application_id": {"$in": app_ids}}))
    db["checkpoints"].delete_many({"thread_id": {"$in": app_ids}})
    db["checkpoint_writes"].delete_many({"thread_id": {"$in": app_ids}})
    coll("pipeline_locks").delete_many({"_id": {"$in": app_ids}})
    try:
        coll("agent_activity").delete_many(storage_filter("agent_activity", {"application_id": {"$in": app_ids}}))
    except Exception as e:
        logger.warning(f"Could not delete agent_activity: {e}")
    cr_del_count = 0
    if borrower_ids:
        cr_del = coll("credit_reports").delete_many(
            _cloned_reports_for(borrower_ids)
        )
        cr_del_count = cr_del.deleted_count
    # Customers are NOT deleted. They live in the shared party directory and may
    # be referenced by other Leafy Bank services; a lending demo reset has no
    # business removing a bank customer.
    br_del_count = 0
    result = coll("applications").delete_many(non_seed_filter)
    logger.info(f"Reset demo: deleted {result.deleted_count} applications, {docs_del.deleted_count} documents, {convs_del.deleted_count} conversations, {intv_del.deleted_count} interventions")
    return {
        "deleted_applications": result.deleted_count,
        "deleted_documents": docs_del.deleted_count,
        "deleted_conversations": convs_del.deleted_count,
        "deleted_interventions": intv_del.deleted_count,
        "deleted_credit_reports": cr_del_count,
        "deleted_borrowers": br_del_count,
    }


_VALID_TRANSITIONS = {
    "submitted": {"processing", "action_required", "error"},
    "processing": {"underwriting", "review", "approved", "declined", "action_required", "error"},
    "action_required": {"processing", "error"},  # processing: re-evaluate after borrower resolves
    "underwriting": {"review", "approved", "declined", "error"},
    "review": {"processing", "approved", "declined", "error", "hitl_error"},
    "approved": {"closing", "error"},
    "closing": {"funded", "error"},
    "funded": {"active", "error"},
    "active": {"error"},
    "declined": {"processing", "error"},  # Allow re-processing after decline override
    "error": {"processing", "submitted"},  # Allow retry
}


def update_application_status(application_id: str, status: str, detail: str = "") -> bool:
    """Update application status and append to history."""
    try:
        ApplicationStatus(status)
    except ValueError:
        raise ValueError(f"Invalid application status: {status}")

    # Validate transition (warn but don't block for demo flexibility)
    current = coll("applications").find_one(
        {_k("application_id"): application_id}, {"statusSource": 1, "status": 1}
    )
    current_status = (current.get("statusSource") or current.get("status")) if current else None
    if current_status and current_status != status:
        allowed = _VALID_TRANSITIONS.get(current_status, set())
        if status not in allowed:
            logger.warning(
                f"Unusual status transition for {application_id}: {current_status} → {status} "
                f"(allowed: {allowed}). Proceeding anyway."
            )

    logger.info(f"Updating application {application_id} status to '{status}'")
    now = datetime.now(timezone.utc)
    result = coll("applications").update_one(
        {_k("application_id"): application_id},
        {
            # Both fields move together: statusSource is the operational value
            # every read path uses, status is the BIAN projection.
            "$set": {
                "status": to_bian_status(status),
                "statusSource": status,
                _k("status_detail"): detail,
                _k("updated_at"): now,
                "maintenance.updatedAt": now,
            },
            "$push": {
                _k("status_history"): {
                    "$each": [history_entry(status, now, detail)],
                    "$slice": -50,
                }
            },
        },
    )
    return result.modified_count > 0
