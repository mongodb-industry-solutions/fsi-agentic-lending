"""Customer identity — minting and upsert against the shared BIAN directory.

Replaces the retired `borrowers` collection. Borrowers were per-application
party records with an ObjectId identity; customers are deduplicated people in
`leafy_bank_bian.customers` (BIAN PartyReferenceDataDirectoryEntry) with a
string `customerId`.

⚠️ MIRROR of the ID and synthesis rules in the umbrella repo's
`bian-data-model/migration/lending/transform.py`. Both must produce byte-
identical output for the same name, or a borrower created at runtime will
duplicate the same human migrated by the data prep. `tests/test_bian_mapping.py`
pins the formula against the migrated fixtures. **Change one, change both.**
"""

import hashlib
import logging
import re
from datetime import datetime, timezone

from db.mdb import coll
from db.storage_mapping import from_storage

logger = logging.getLogger(__name__)

_WHITESPACE = re.compile(r"\s+")


def _name_parts(full_name: str) -> tuple[str, str]:
    """('Marcus Alejandro Delgado') -> ('marcus', 'delgado')

    Deliberately first+last, ignoring middle names. The source data holds
    'Marcus Delgado' and 'Marcus Alejandro Delgado' as separate borrower
    records for one human, so keying on the whole name double-counts people.
    """
    parts = _WHITESPACE.sub(" ", (full_name or "").strip()).lower().split()
    if not parts:
        return "", ""
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], parts[-1]


def mint_customer_id(full_name: str) -> str:
    """Deterministic CUST-<hex> for a name. Same name always yields the same id.

    Name is the only dedup key available: the migrated population carries
    neither dateOfBirth nor nationalId on 27 of 29 source records.
    """
    first, last = _name_parts(full_name)
    digest = hashlib.sha1(f"{first} {last}".encode()).hexdigest()
    return "CUST-" + digest[:10].upper()


def _synth_contact(customer_id: str, first: str, last: str) -> tuple[str, str]:
    """Deterministic, deliberately non-routable contact points.

    `customers` requires an email and a phone; a loan application collects
    neither. example.com (RFC 2606) and the +1-555 fictitious range make it
    obvious at a glance that these are synthesised rather than captured.
    """
    local = ".".join(x for x in (first, last) if x) or customer_id.lower()
    digits = int(hashlib.sha1(customer_id.encode()).hexdigest()[:7], 16) % 10_000_000
    return f"{local}@example.com", f"+1555{digits:07d}"


def build_customer(full_name: str, now: datetime) -> dict:
    """Minimal spec-valid customers document for a newly-seen borrower.

    Required fields with no source are synthesised. Nothing is invented where
    the spec permits emptiness: `kyc.documents`, `consents` and
    `contact.addresses` are empty arrays, so no verification, consent or
    address is fabricated.
    """
    customer_id = mint_customer_id(full_name)
    first, last = _name_parts(full_name)
    email, phone = _synth_contact(customer_id, first, last)
    display = _WHITESPACE.sub(" ", (full_name or "").strip()).split()
    timestamp = now.isoformat()

    identification = {
        "legalName": full_name,
        "fullName": full_name,
        "firstName": display[0] if display else None,
        "lastName": display[-1] if len(display) > 1 else None,
    }
    return {
        "customerId": customer_id,
        "status": "ACTIVE",
        "type": "INDIVIDUAL",
        "segment": "RETAIL",
        "since": timestamp[:10],
        "rmId": None,
        "identification": {k: v for k, v in identification.items() if v is not None},
        "contact": {
            "email": email,
            "phone": phone,
            "preferredLanguage": "en",
            "preferredChannel": "EMAIL",
            "addresses": [],
        },
        "kyc": {
            "status": "PENDING",
            "level": "BASIC",
            "riskRating": "MEDIUM",
            "documents": [],
        },
        "consents": [],
        "createdAt": timestamp,
        "updatedAt": timestamp,
        "createdBy": "lending-service",
        "version": 1,
        "sourceSystem": "fsi-agentic-lending",
    }


def upsert_customer(full_name: str, now: datetime | None = None) -> str:
    """Return the customerId for a name, creating the directory entry if new.

    `$setOnInsert` throughout: an existing customer — migrated, or created by
    another Leafy Bank service — is never overwritten by a loan application.
    This service is not the owner of the party master.
    """
    now = now or datetime.now(timezone.utc)
    doc = build_customer(full_name, now)
    customer_id = doc.pop("customerId")
    coll("customers").update_one(
        {"customerId": customer_id},
        {"$setOnInsert": {"customerId": customer_id, **doc}},
        upsert=True,
    )
    return customer_id


def get_customers(customer_ids: list[str]) -> list[dict]:
    """Fetch customers by id, in runtime (snake_case) shape."""
    if not customer_ids:
        return []
    cursor = coll("customers").find({"customerId": {"$in": list(customer_ids)}})
    return [from_storage("customers", d) for d in cursor]
