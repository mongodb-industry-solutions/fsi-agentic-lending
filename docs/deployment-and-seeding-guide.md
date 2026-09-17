# Staging Deployment & Collection-Mapping Guide

How to fix the deployed staging demo when collections "read empty" — and how the
pieces fit together.

> **TL;DR:** the shared `leafy_bank_bian` database is fully seeded; the demo
> collections live under a `lending` prefix (`lendingDocuments`, `loans`,
> `loanRepayments`, `lendingOfficers`, …). The app resolves logical collection
> names through `COLL_*` env overrides (`backend/db/collections_config.py`) and
> **defaults to plain names** (`documents`, `applications`, …) when no override
> is set. The deployed environment was missing those `COLL_*` overrides, so the
> app was reading non-existent plain-named collections and every read returned
> empty ("No documents found", empty chat checklist, …). **Set the `COLL_*`
> mapping (below) — no re-seeding needed.**

> **Companion:** the frontend also ships a bundled fallback snapshot
> (`frontend/public/data/documents.json`) so the document **display** (borrower
> "Supporting Documents", tracking panel, officer document list, View modal
> extracted data) works even while the mapping is misconfigured. It is a
> display-only resilience layer — the database remains the source of truth and
> is where PDFs, chat DocumentChecklist, vector search, and demo-upload read.

---

## 1. Root cause (verified)

A read-only probe of the deployed cluster (`leafy_bank_bian`) shows the demo's
data **is present**, under the umbrella's `lending` prefix:

| Logical name | Physical collection in `leafy_bank_bian` | Docs found |
| --- | --- | --- |
| `applications` | `loans` | 5 seed loans (`loansId` = `APP-2026-0000X`) |
| `documents` | `lendingDocuments` | **83** (69 belonging to the 5 seed apps; 14×4 apps + 13 for Sarah) |
| `payments` | `loanRepayments` | present |
| `credit_reports` | `creditReports` | present |
| `underwriting_policies` | `lendingUnderwritingPolicies` | present |
| `interventions` | `lendingInterventions` | present |
| `conversations` | `lendingConversations` | present |
| `agent_activity` | `lendingAgentActivity` | present |
| `hitl_audit` | `lendingHitlAudit` | present |
| `officers` | `lendingOfficers` | present |
| `pipeline_locks` | `lendingPipelineLocks` | present |
| `renewals` | `lendingRenewals` | present |
| `customers` | `customers` | shared party directory (same name) |
| `borrowers` | *(retired — folded into `customers`)* | — |

`backend/db/collections_config.py` resolves `logical -> physical` via
`COLL_<LOGICAL>` env vars, defaulting to the plain names above. Because the
deployed pods had **no `COLL_*` set**, the app queried `documents`/`applications`/
`payments`/… — collections that do not exist in `leafy_bank_bian` — so every
document/queue/chat read returned empty.

*Verified:* with `DATABASE_NAME=leafy_bank_bian` + the `COLL_*` mapping below,
`list_documents("APP-2026-00001")` returns the real **14 documents** (full
`extracted_text`, `structured_data`, `embedding`), and `coll("applications")`
resolves to `loans`.

---

## 2. Fix — set the `COLL_*` mapping in the deployed environment

Add to the backend container env (`environment/staging-combined.yaml` sidecar
`env:` — committed; also mirror in the K8s secret/configmap if env is sourced
there), and confirm `DATABASE_NAME=leafy_bank_bian`:

```yaml
- name: DATABASE_NAME
  value: leafy_bank_bian          # from the fsi-agentic-lending-secrets secret — confirm
- name: COLL_APPLICATIONS
  value: 'loans'
- name: COLL_BORROWERS
  value: 'customers'              # retired; folded into `customers` in leafy_bank_bian
- name: COLL_DOCUMENTS
  value: 'lendingDocuments'
- name: COLL_CREDIT_REPORTS
  value: 'creditReports'
- name: COLL_PAYMENTS
  value: 'loanRepayments'
- name: COLL_UNDERWRITING_POLICIES
  value: 'lendingUnderwritingPolicies'
- name: COLL_AGENT_ACTIVITY
  value: 'lendingAgentActivity'
- name: COLL_CONVERSATIONS
  value: 'lendingConversations'
- name: COLL_INTERVENTIONS
  value: 'lendingInterventions'
- name: COLL_HITL_AUDIT
  value: 'lendingHitlAudit'
- name: COLL_OFFICERS
  value: 'lendingOfficers'
- name: COLL_PIPELINE_LOCKS
  value: 'lendingPipelineLocks'
- name: COLL_RENEWALS
  value: 'lendingRenewals'
```

Staging already carries these in `environment/staging-combined.yaml`. **Production
should mirror the same block** if it points at a shared/`lending`-prefixed
database.

---

## 3. When you actually need to seed (only if a collection is empty)

If, *after* the mapping is correct, a named collection is still empty (count
verified as zero), re-seed it:

```bash
cd backend
uv run python -m scripts.create_indexes   # create missing collections + indexes (+ Atlas Search)
uv run python -m scripts.ingest_pdfs      # idempotent; self-heals "app with zero documents"
```

Prerequisites for extraction so documents get full `extracted_text` + `embedding`:
- An active AWS SSO session for Bedrock (`aws sso login`) — an expired token
  fails **silently** during extraction and yields a "seeded app with zero
  documents" state.
- `VOYAGE_API_KEY` set.
- The same `COLL_*` mapping + `DATABASE_NAME` applied to whichever environment
  runs the seed.

`ingest_pdfs` writes through the BIAN storage boundary (`to_storage`), so it
produces the correct camelCase shape in the mapped physical collections.

---

## 4. Verification

After the mapping is deployed:

1. `GET /api/backend/applications/APP-2026-00001/documents` → **14 documents**.
2. Chat: *"what documents do I still need?"* → the DocumentChecklist populates
   (backed by the real collection).
3. Officer → application detail → document search returns scored results
   (Atlas Vector Search on `lendingDocuments.embedding`).
4. Document View modal → **PDF preview** renders (backend serves the file by
   `filename`).
5. Sarah Williams → missing-`paystubs` intervention → **Upload Pay Stubs** runs
   real extraction + embedding.
6. Submit a new borrower application → pipeline doc verification + risk
   aggregation (`$lookup` on documents) completes.

Quick Mongo spot-checks (read-only):

```js
use leafy_bank_bian
db.lendingDocuments.countDocuments({ applicationId: "APP-2026-00001" }) // 14
db.lendingDocuments.countDocuments({})                                  // 83
db.loans.countDocuments({ loansId: /^APP-2026/ })                       // 5 seed loans
```

---

## 5. Gotchas

- **`COLL_*` is the configuration, not the data.** If reads are empty, first
  verify the mapping + `DATABASE_NAME` — do NOT assume you need to re-seed.
- **Different databases exist on the same cluster**: `leafy_bank_bian` (BIAN,
  `lending*` collections) and a legacy `fsi-agentic-lending` (plain snake_case
  names). Ensure `DATABASE_NAME` is the one the pods read, and that the secret
  value matches the config.
- **AWS SSO expiry = silent extraction failure** — re-run `aws sso login`, then
  re-run `ingest_pdfs` (self-heals apps with zero documents).
- **`seed_complete` guard** skips already-seeded apps; only the zero-documents
  corruption case auto-re-recovers.
- **Egress**: the deployed pod must reach the Atlas cluster (SaaS IP allow-list /
  VPC peering). A `serverSelectionTimeout` is the symptom.
- **PDFs are on disk, not in Mongo** — `GET /documents/{id}/pdf` resolves by
  `filename` from `docs/synthetic data/<profile>/` or `PDF_BASE_DIR`; the backend
  image must carry those PDFs.

---

## 6. Two-part fix summary

| Part | What it fixes | Ship vehicle |
| --- | --- | --- |
| **Root cause: `COLL_*` collection mapping** (`loans`, `lendingDocuments`, `loanRepayments`, …) | All DB reads — officer queue, documents, PDFs, chat checklist, vector search, demo-upload, pipeline | `environment/staging-combined.yaml` (+ production, + K8s secret if env is sourced there) |
| **Frontend fallback bundle** (`frontend/public/data/documents.json` + `lib/documents.js`) | Document **display** resilience while the mapping is misconfigured / DB unseeded | frontend commit/PR |
