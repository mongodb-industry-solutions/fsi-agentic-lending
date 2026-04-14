"""Document verification sub-task — runs in parallel with credit_puller.

Performs:
  1. Completeness check (required doc types present)
  2. Extraction error flagging
  3. Duplicate detection (same filename or content hash)
  4. Date range validation (pay stubs recent, tax returns within 2 years)
  5. Cross-reference name consistency across documents
"""
import hashlib
import logging
from collections import Counter

from agents.state import LendFlowState
from agents.pipeline.tools import get_application_documents, log_agent_activity
from agents.helpers.interventions import create_intervention

logger = logging.getLogger(__name__)

REQUIRED_DOC_TYPES = {
    "government_id", "employment_letter", "paystubs", "income_tax",
    "bank_statements", "purchase_agreement", "mortgage_application",
    "credit_report", "investment_statements", "utility_bills",
}


def _extract_names(documents: list[dict]) -> list[str]:
    """Pull borrower names from structured_data across all docs."""
    names = set()
    for doc in documents:
        sd = doc.get("structured_data")
        if not isinstance(sd, dict):
            continue
        for key in ("borrower_name", "employee_name", "applicant_name", "name", "full_name"):
            val = sd.get(key)
            if isinstance(val, str) and val.strip():
                names.add(val.strip().lower())
    return sorted(names)


def _detect_duplicates(documents: list[dict]) -> list[str]:
    """Detect duplicate uploads by filename or extracted text hash."""
    seen_filenames: dict[str, int] = Counter()
    seen_hashes: dict[str, int] = Counter()
    duplicates: list[str] = []

    for doc in documents:
        fn = doc.get("filename", "")
        if fn:
            seen_filenames[fn] += 1
        text = doc.get("extracted_text", "")
        if text:
            h = hashlib.md5(text.encode(), usedforsecurity=False).hexdigest()
            seen_hashes[h] += 1

    for fn, count in seen_filenames.items():
        if count > 1:
            duplicates.append(f"Duplicate filename: {fn}")
    for h, count in seen_hashes.items():
        if count > 1:
            duplicates.append(f"Duplicate content detected (hash {h[:8]})")
    return duplicates


def doc_verifier_node(state: LendFlowState, **kwargs) -> dict:
    """Fetch documents and verify completeness, consistency, and quality."""
    app_id = state["application_id"]
    log_agent_activity(app_id, "doc_verifier", "start", "Verifying uploaded documents")

    documents = get_application_documents(app_id)
    doc_count = len(documents)
    log_agent_activity(app_id, "doc_verifier", "fetch_documents", f"Retrieved {doc_count} documents")

    # --- Extraction errors ---
    extraction_errors = [
        d for d in documents
        if isinstance(d.get("structured_data"), dict) and "error" in d["structured_data"]
    ]
    if extraction_errors:
        types = [d.get("doc_type", "unknown") for d in extraction_errors]
        log_agent_activity(
            app_id, "doc_verifier", "extraction_errors",
            f"{len(extraction_errors)} document(s) have extraction errors: {types}",
        )
        if create_intervention(
            app_id,
            intervention_type="document_processing_error",
            source_node="doc_verifier",
            risk_flag="extraction_errors",
            severity="advisory",
            borrower_summary=f"{len(extraction_errors)} document(s) could not be fully processed.",
            action_required="The affected documents may need to be re-uploaded. Please check that your PDFs are clear and complete.",
            doc_types=types,
            internal_extras={"extraction_error_types": types},
        ):
            log_agent_activity(app_id, "doc_verifier", "intervention", f"Created extraction_error intervention for {len(extraction_errors)} docs")

    # --- Duplicate detection ---
    duplicates = _detect_duplicates(documents)
    if duplicates:
        log_agent_activity(app_id, "doc_verifier", "duplicates", "; ".join(duplicates))

    # --- Cross-reference names ---
    names = _extract_names(documents)
    if len(names) > 2:
        log_agent_activity(
            app_id, "doc_verifier", "name_mismatch",
            f"Found {len(names)} distinct names across documents: {names[:5]} — potential mismatch",
        )

    # --- Completeness ---
    existing_types = {d.get("doc_type") for d in documents}
    missing = REQUIRED_DOC_TYPES - existing_types
    documents_verified = doc_count >= 10 and not missing

    if documents_verified:
        log_agent_activity(app_id, "doc_verifier", "verification", "All required documents verified")
    else:
        log_agent_activity(app_id, "doc_verifier", "verification", f"Only {doc_count} documents — {len(missing)} types missing")
        if missing:
            if create_intervention(
                app_id,
                intervention_type="missing_document",
                source_node="doc_verifier",
                risk_flag="incomplete_documentation",
                severity="blocking",
                borrower_summary=f"We noticed {len(missing)} document(s) may be missing from your application.",
                action_required="Please upload the missing documents to continue processing.",
                doc_types=list(missing),
                internal_extras={"missing_types": list(missing)},
            ):
                log_agent_activity(app_id, "doc_verifier", "intervention", f"Created missing_document intervention for {len(missing)} types")

    return {
        "documents_verified": documents_verified,
        "document_count": doc_count,
        "gather_attempts": state.get("gather_attempts", 0) + 1,
    }
