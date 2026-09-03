"""Translate documents and query keys across the storage boundary.

``to_storage`` / ``from_storage`` convert whole documents. ``storage_key``
converts a single dotted path — use it for query filters, projections, sort
keys and aggregation stage keys, none of which are documents and so none of
which the document mappers can reach.

Round-trip guarantee: ``from_storage(c, to_storage(c, doc)) == doc`` for any
document the runtime produces. ``tests/test_bian_mapping.py`` enforces it.
"""

import copy

from db.bian_field_maps import (
    OPAQUE,
    OVERRIDES,
    PASSTHROUGH,
    to_camel,
    to_snake,
)

# Structural hooks own a field whose *value* shape differs between runtime and
# storage, not just its name. Wired explicitly at the bottom of this module.
#
# Ordering contract: a _TO_ hook runs BEFORE the camelCase pass and receives
# runtime (snake_case) input; a _FROM_ hook runs AFTER the snake_case pass, so
# it also sees snake_case keys. Both sides therefore speak snake_case.
_TO_HOOKS = {}
_FROM_HOOKS = {}


# --------------------------------------------------------------------------
# key translation
# --------------------------------------------------------------------------

def _reverse(mapping):
    return {v: k for k, v in mapping.items()}


def storage_key(collection: str, runtime_path: str) -> str:
    """Runtime dotted path -> storage dotted path.

    >>> storage_key("applications", "application_id")
    'loansId'
    >>> storage_key("applications", "property.annual_tax")
    'property.annualTax'
    """
    overrides = OVERRIDES.get(collection, {})
    if runtime_path in overrides:
        return overrides[runtime_path]
    if runtime_path in PASSTHROUGH:
        return PASSTHROUGH[runtime_path]
    return ".".join(to_camel(part) for part in runtime_path.split("."))


def runtime_key(collection: str, storage_path: str) -> str:
    """Storage dotted path -> runtime dotted path."""
    reverse = _reverse(OVERRIDES.get(collection, {}))
    if storage_path in reverse:
        return reverse[storage_path]
    reverse_passthrough = _reverse(PASSTHROUGH)
    if storage_path in reverse_passthrough:
        return reverse_passthrough[storage_path]
    return ".".join(to_snake(part) for part in storage_path.split("."))


def storage_filter(collection: str, query: dict) -> dict:
    """Translate the keys of a Mongo filter or projection.

    Operator keys ($in, $set, $gt, …) pass through untouched; their values are
    translated recursively when they are themselves documents.
    """
    out = {}
    for key, value in query.items():
        if key.startswith("$"):
            if isinstance(value, dict):
                out[key] = storage_filter(collection, value)
            elif isinstance(value, list):
                out[key] = [
                    storage_filter(collection, v) if isinstance(v, dict) else v
                    for v in value
                ]
            else:
                out[key] = value
            continue
        new_key = storage_key(collection, key)
        out[new_key] = (
            storage_filter(collection, value) if isinstance(value, dict) else value
        )
    return out


# --------------------------------------------------------------------------
# document translation
# --------------------------------------------------------------------------

def _set_path(doc, dotted, value):
    parts = dotted.split(".")
    node = doc
    for part in parts[:-1]:
        node = node.setdefault(part, {})
    node[parts[-1]] = value


def _pop_path(doc, dotted):
    """Read and remove a dotted path. Returns (found, value)."""
    parts = dotted.split(".")
    node = doc
    for part in parts[:-1]:
        if not isinstance(node, dict) or part not in node:
            return False, None
        node = node[part]
    if not isinstance(node, dict) or parts[-1] not in node:
        return False, None
    return True, node.pop(parts[-1])


def _prune_empty(doc, dotted):
    """Drop a now-empty parent left behind by _pop_path."""
    parts = dotted.split(".")[:-1]
    if not parts:
        return
    node = doc
    chain = [(None, None)]
    for part in parts:
        if not isinstance(node, dict) or part not in node:
            return
        chain.append((node, part))
        node = node[part]
    if isinstance(node, dict) and not node:
        parent, key = chain[-1]
        del parent[key]


def _convert(node, collection, translate, path=""):
    """Recursively rename keys, skipping opaque sub-trees and _id."""
    if isinstance(node, list):
        return [_convert(i, collection, translate, path) for i in node]
    if not isinstance(node, dict):
        return node
    out = {}
    for key, value in node.items():
        child = f"{path}.{key}" if path else key
        if key == "_id" or child in OPAQUE.get(collection, ()):
            out[key] = value
            continue
        out[translate(key)] = _convert(value, collection, translate, child)
    return out


def to_storage(collection: str, doc: dict) -> dict:
    """Runtime document -> BIAN storage document."""
    # Deep copy: _pop_path and the hooks mutate nested sub-documents, and a
    # shallow copy shares them with the caller's dict.
    doc = copy.deepcopy(doc)
    hooks = _TO_HOOKS.get(collection, {})
    held = {}
    for field, fn in hooks.items():
        if field in doc:
            held[field] = fn(doc.pop(field))

    # Mechanical rename of everything that stays in place.
    moves = {k: v for k, v in OVERRIDES.get(collection, {}).items() if k in doc}
    pending = {k: doc.pop(k) for k in moves}
    out = _convert(doc, collection, to_camel)
    for runtime_path, value in pending.items():
        _set_path(out, moves[runtime_path], _convert(value, collection, to_camel))
    for field, value in held.items():
        _set_path(out, storage_key(collection, field), value)
    return out


def from_storage(collection: str, doc: dict) -> dict:
    """BIAN storage document -> runtime document."""
    if doc is None:
        return None
    # Deep copy: see to_storage. Reading a document must never alter it.
    doc = copy.deepcopy(doc)
    hooks = _FROM_HOOKS.get(collection, {})
    moves = OVERRIDES.get(collection, {})

    held = {}
    for runtime_path, storage_path in moves.items():
        found, value = _pop_path(doc, storage_path)
        if found:
            held[runtime_path] = value
            _prune_empty(doc, storage_path)

    out = _convert(doc, collection, to_snake)
    for runtime_path, value in held.items():
        converted = _convert(value, collection, to_snake)
        fn = hooks.get(runtime_path)
        out[runtime_path] = fn(converted) if fn else converted
    for field, fn in hooks.items():
        if field in out and field not in held:
            out[field] = fn(out[field])
    return out


# --------------------------------------------------------------------------
# structural hooks
# --------------------------------------------------------------------------

def _to_borrower_ids(customer_ids):
    """['CUST-A', 'CUST-B'] -> [{customerId, role}, …]

    The runtime carries a flat list of customer references; the spec wants each
    borrower's role on the loan. Position is the only role signal available —
    the application form collects a primary applicant and an optional
    co-applicant, in that order.
    """
    return [
        {"customerId": cid, "role": "PRIMARY" if i == 0 else "CO_APPLICANT"}
        for i, cid in enumerate(customer_ids or [])
    ]


def _from_borrower_ids(entries):
    return [e["customer_id"] if isinstance(e, dict) else e for e in entries or []]


def _to_derogatory_items(raw):
    """Three source shapes -> one structured record.

    (a) object of free-text strings, (b) array of {type, amount, creditor,
    date}, (c) empty/absent. v4_34 declares `derogatoryItems: string?`, which
    holds neither populated shape; the structured form is a pending spec
    proposal (see data-prep-findings.md).
    """
    if not raw:
        return None
    if isinstance(raw, dict):
        if not any(raw.values()):
            return None
        return {
            "derogatoryMarks": raw.get("derogatory_marks"),
            "collectionsJudgments": raw.get("collections_judgments"),
            "bankruptcies": raw.get("bankruptcies"),
            "items": [],
        }
    if isinstance(raw, list):
        return {
            "derogatoryMarks": None,
            "collectionsJudgments": None,
            "bankruptcies": None,
            "items": [
                {
                    "type": i.get("type"),
                    "amount": i.get("amount"),
                    "creditor": i.get("creditor"),
                    "date": i.get("date"),
                }
                for i in raw
            ],
        }
    return {"derogatoryMarks": raw, "collectionsJudgments": None,
            "bankruptcies": None, "items": []}


def _from_derogatory_items(record):
    """Structured record -> whichever runtime shape it came from.

    Agent prompts and the officer UI read this as either a list of incidents or
    a summary object, so preserve the distinction rather than normalising.
    """
    if not record:
        return []
    if not isinstance(record, dict):
        return record
    if record.get("items"):
        return [
            {"type": i.get("type"), "amount": i.get("amount"),
             "creditor": i.get("creditor"), "date": i.get("date")}
            for i in record["items"]
        ]
    summary = {
        "derogatory_marks": record.get("derogatory_marks"),
        "collections_judgments": record.get("collections_judgments"),
        "bankruptcies": record.get("bankruptcies"),
    }
    return summary if any(summary.values()) else []


# Repayment status is an uppercase enum in storage, matching every other BIAN
# enum in the spec, but the dashboard and event feed compare the native
# lowercase values. This is a *value* translation — the key mappers cannot
# reach it.
_REPAYMENT_STATUS_TO = {"on_time": "ON_TIME", "late": "LATE", "missed": "MISSED"}
_REPAYMENT_STATUS_FROM = {v: k for k, v in _REPAYMENT_STATUS_TO.items()}


def _to_repayment_status(value):
    return _REPAYMENT_STATUS_TO.get((value or "").lower(), value)


def _from_repayment_status(value):
    return _REPAYMENT_STATUS_FROM.get(value, value)


_TO_HOOKS["payments"] = {"status": _to_repayment_status}
_FROM_HOOKS["payments"] = {"status": _from_repayment_status}
_TO_HOOKS["applications"] = {"borrower_ids": _to_borrower_ids}
_FROM_HOOKS["applications"] = {"borrower_ids": _from_borrower_ids}
_TO_HOOKS["credit_reports"] = {"derogatory_items": _to_derogatory_items}
_FROM_HOOKS["credit_reports"] = {"derogatory_items": _from_derogatory_items}
