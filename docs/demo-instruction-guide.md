# Agentic Lending — Demo Instruction Guide

A field-ready walkthrough of the **Agentic Lending** platform demo: an agentic mortgage-lending showcase built on **MongoDB Atlas**, **LangGraph**, and **Voyage AI** that automates the full lifecycle — application intake, underwriting, decision, closing/funding, servicing, and renewal.

This guide reflects the build deployed on the **staging** branch: 4 frontend experiences (Borrower Portal, Loan Officer, Renewal, Demo Flow), a 6-agent LangGraph pipeline with human-in-the-loop (HITL) review, OSFI B-20 stress testing, and a **BIAN-aligned banking data model consolidated into a single MongoDB database** (`leafy_bank_bian`).

---

## 1. Purpose and Value Proposition

**The one-line story:** lending decisions that traditionally take *45+ days* are handled in *minutes* by autonomous AI agents — under policy control, with human review only where it matters — all on **one MongoDB data platform** that also hosts the bank's BIAN-aligned data model.

**Why this demo exists.** Mortgage origination is one of the most document-heavy, manually staged, tightly regulated processes in banking. This demo shows a production-realistic reference for how an agentic layer changes that — not a chatbot, but a **multi-agent pipeline** that gathers documents, pulls credit, stress-tests ratios, cites policy, scores risk, flags edge cases, and hands only the genuinely ambiguous decisions to a human loan officer.

**The five value propositions the demo lands:**

1. **Minutes, not 45+ days.** A full application — document verification, credit pull, GDS/TDS, OSFI B-20 stress test, policy RAG, risk tiering — completes in well under a minute of agent work. Real-time status streams live.
2. **Bounded autonomy with human-in-the-loop.** Agents act autonomously inside policy envelopes; the `hitl_gate` escalates on thresholds (purchase price > $500K, GDS > 36%, TDS > 41%, risk tier) and pauses via a LangGraph `interrupt()`. Officers approve, decline, or modify-and-continue — every decision audited.
3. **Regulatory rigor is engineered in.** OSFI B-20 stress testing (`max(contract + 2%, 5.25%)`), insured-vs-conventional limits, policy RAG citations — not generated prose.
4. **One platform for data + AI.** Transactional documents, vector search, aggregation analytics, change streams, and LangGraph checkpointing all live in **one MongoDB database** — no separate search index, no message broker, no warehouse for these workloads.
5. **A BIAN-aligned banking data model as the foundation.** The demo persists in BIAN camelCase shape inside the single shared `leafy_bank_bian` database (`loansId`, nested `assessment.*` underwriting block, `maintenance.statusHistory`, a shared `customers` party directory). This makes the demo a **bank-modernization playbook**, not just a single app: an agentic layer and a standardized (BIAN) data model coexist in the same database, and collections can be renamed without code changes via `COLL_*` indirection.

> **Demo positioning tip:** for a technical or program audience, lead with point 5 ("the whole thing runs on a BIAN-aligned data model in one database"). For an executive audience, lead with points 1–2 ("minutes vs 45+ days, with a human in the loop on the decisions that matter").

---

## 2. Functionality Overview

The app header offers four tabs plus a `?` education panel (InfoWizard) that documents the architecture, agents, and MongoDB features.

| Surface | What it is | Best used to show |
| --- | --- | --- |
| **Borrower Portal** | Applicant-facing flow: pick a demo profile → complete the mortgage form → live Amazon-style status tracking with a "Personal Lending Assistant" chat. | The end-user experience: zero agent complexity, high-level status only, instant answers, generative UI components in chat. |
| **Loan Officer** | Officer workspace: real-time queue, live pipeline execution, HITL review with AI recommendation + threshold analysis, decision summary, and full tech transparency. | Where the "AI does the work, the human does the judging" story lands. Also all MongoDB internals (change streams, aggregation, document model in BIAN shape). |
| **Renewal** | Standalone **Renewal Agent**: scans the portfolio for loans maturing in 3 months, streams its reasoning live, drafts a personalized renewal offer, and auto-renews on e-signature. | A second agentic workflow (servicing/renewal) that is fully self-contained and repeatable. |
| **Demo Flow** | 6-scene scripted walkthrough of the whole lifecycle (Origination → Underwriting → Approval → Closing → Funding → Servicing) on a custom Canvas-2D workflow graph. | A theatrical, pre-scripted alternative when time is short or you want a narrated "tech theatre" pass. |
| **InfoWizard (`?`)** | Educational overlay with architecture narrative, agent glyphs, capability deep-dives. | Answering "how does this actually work under the hood?" questions. |

**Who sees what is a deliberate design decision:**

- **The borrower sees a high-level, Amazon-style status** (Received → In Review → Decision → Closing → Funded). Internal stages — document verification, credit, underwriting, officer review — all roll up into **"In Review"**. There are no agent names, no risk scores, no GDS/TDS, no pipeline feed on the borrower side. The single AI identity is the **"Personal Lending Assistant"**.
- **The officer sees everything**: the multi-agent pipeline, risk metrics, thresholds, provenance, and the MongoDB operations behind each step.

### 2.1 Borrower Portal

- **Borrower Selection** — 5 seeded applicant profiles (see cheat sheet in §5), each a card with income stats, a 2-line narrative, risk-factor chips, and a pipeline-path hint.
- **Application form** — income, down payment, product, co-applicant fields with validation and a Canadian payment calculator.
- **Your Documents** — borrower-facing panel of the submitted document set and its status.
- **Status Tracker** — 5 high-level milestones, a single "Personal Lending Assistant" status line, an **"Action Needed"** callout when the officer requested something (with document upload), and on completion an **Approval Summary** (approved rate / monthly payment / loan amount) or a plain-language **DeclineCard**.
- **Personal Lending Assistant chat** — streaming markdown with generative UI components rendered inline (see below), source badges, reasoning disclosure, intervention cards, and suggested questions.

**Generative UI (2 components in chat):**

| Component | What it shows | When it triggers |
| --- | --- | --- |
| `DocumentChecklist` | Required vs. submitted documents with progress | Ask "what documents do I need?" / "document checklist" |
| `ClosingTimeline` | 4-step post-approval timeline (rate lock → doc prep → signing → funding) | After approval, ask about "closing" / "next steps" |

### 2.2 Loan Officer Dashboard

- **Application Queue** — real-time via WebSocket (backed by Change Streams), filterable (All / Pending Review / Processing / Completed), sortable by "Needs Attention". Pre-populated with the 5 seeded applications plus 3 decorative sample apps (`APP-DEMO-*`).
- **Persistent total-time card** — pinned "Total Time" for the selected application, broken into status stages; the clock **pauses while the pipeline waits on the borrower** (`action_required`) — a tangible "regulatory turnaround time" metric.
- **Pipeline Step Tracker** — one consolidated 3-stage tracker (**Origination / Underwriting / Decision Review**); each stage expands to real sub-steps and live metrics (risk score, GDS/TDS, credit score). A **"View diagram"** button opens the full agent node-graph in a modal.
- **HITL Review** — when the agent escalates: an **AI Recommendation hero** (recommended action, one-line reason, confidence, suggested conditions) plus the **Threshold Analysis** panel (purchase price vs $500K, effective GDS vs 36%, effective TDS vs 41%, risk tier vs auto-approve envelope) and full underwriting detail. Approve / Decline / **Modify-and-continue** (override amount/tier/conditions → forces re-underwriting).
- **Decision Summary** — provenance chain, per-agent audit trail, before/after comparison for modified decisions, attributed "Reviewed by Curtis Dean".
- **Agent Rail** (left): officer identity card, live AI-layer header, activity log (SSE feed with reasoning + latency), Policy Explorer (Atlas Vector Search with relevance bars), Portfolio Intelligence (payment trends, EWS signals, recent events).
- **Tech Rail** (right, collapsed by default): Change Stream console (ops/sec, cross-rail correlation), 7-stage Aggregation Pipeline visualizer (progressive reveal from live agent output), and the **Document Model inspector** — the spot to surface the **BIAN-shaped** storage (`loansId`, `assessment.*`, `maintenance.statusHistory`).

### 2.3 Renewal Dashboard

- **Renewal Queue** — loans maturing within 3 months, soonest-first, with maturity date and days remaining.
- **Run Renewal Agent** — streams its work **live** (scan → pull market rate + retention discount → recompute payment → draft Bedrock rationale → persist), each step tagged with technology (`MongoDB · renewals`, `AWS Bedrock · Claude`, …) and latency.
- **Offer vs current** — side-by-side rate/payment comparison with a monthly-delta callout and a rationale.
- **Send to borrower & e-sign → auto-renew** — records the signature and rolls the terms onto the loan (maturity pushes out 5 years). **Re-scan** restores renewed loans to `due` so the demo is repeatable.

### 2.4 Demo Flow

Six scenes (Origination, Underwriting, Approval, Closing, Funding, Servicing) over the **WorkflowCanvas** — a custom Canvas-2D graph with particle comet trails, an annotation bar, a developer console (reasoning / MongoDB ops / checkpoints), and a completion screen with a tech recap. Servicing focuses on Early Warning System signals and rolling analytics (`$setWindowFields`).

---

## 3. Target Audience

**Who presents it:** MongoDB field — Solutions/Sales Engineers, Solutions Architects, Account Executives, GAMs — and partners/GSIs running MongoDB–FSI demos.

**Who it is for (prospects):**

- **Financial institutions** — banks, credit unions, mortgage lenders, private/alternative lenders, fintech lenders, servicing platforms.
- **Programs modernizing lending** — origination & servicing platforms, cloud/data migration, enterprise data-model standardization (ESG/BIAN/ISO 20022 programs).
- **AI/agentic initiatives** in FS — GenAI chatbots are everywhere; this shows agentic *workflows* with guardrails.

**Tailoring cheat-sheet:**

| Audience | Lead with | Skip / downplay |
| --- | --- | --- |
| **Executive (CIO/CDO/Chief Lending Officer)** | Minutes vs 45+ days, human-in-the-loop, audit trail, one platform, regulatory compliance | Agent internals, aggregation stage details |
| **Architect / data platform** | BIAN data-model alignment, single-database consolidation, change streams, aggregation, vector search, schema flexibility, `COLL_*` indirection | — |
| **AI/ML engineering** | LangGraph multi-agent orchestration, `interrupt()`/resume, checkpoints, tool_use structured output, RAG citations, embeddings | UI polish |
| **Lending operations / risk** | OSFI B-20 stress test, GDS/TDS thresholds, intervention loop, officer decisioning UI | Mongo plumbing |
| **Partner / GSI** | The "modernization playbook": BIAN model + agentic layer on one DB; blueprint they can re-sell | — |

**Questions to tee up:** "How do you keep humans in control?" (HITL) · "How do you stay compliant while automating?" (OSFI B-20, policy RAG, audit) · "How do you consolidate 7 databases into one?" (BIAN/§6) · "How fast is real-time?" (change streams).

---

## 4. MongoDB Tech/Features Showcased

A technical audience will want the concrete feature list. Every item below is something you can point at in the running demo.

| MongoDB feature | What the demo does with it | Where you can point |
| --- | --- | --- |
| **Document Model** (flexible schema) | The whole loan "package" as one evolving document — status history, nested sub-records, polymorphic income sources; conversations and interventions as documents. | Tech Rail → Document Model inspector; `GET /applications/{id}/json` |
| **BIAN Data-Model Alignment** (staging) | A single shared database `leafy_bank_bian`; the app's API/frontend stay snake_case while storage is translated to **BIAN camelCase** at the persistence boundary: `application_id → loansId`, underwriting metrics → nested `assessment.*` (`grossDebtServiceRatio`, `riskScore`, …), `status_history → maintenance.statusHistory`, and borrowers → a shared `customers` party directory referenced by `borrower_ids:[{customerId, role}]`. Collection names are indirection-driven (`COLL_<LOGICAL>` env vars), so collections can be renamed with zero code edits. The mapping is round-trip-guaranteed and pinned by mapping tests against migration fixtures. | Document Model inspector; officer activity log provenance; the README's BIAN section |
| **Atlas Vector Search** | Policy RAG (15 Canadian mortgage rules, Voyage AI `voyage-multimodal-3.5` embeddings) cited in chat + officer decision; semantic document search. | Officer → Policy Explorer (relevance bars); chat citations; HITL "policy violations" |
| **Aggregation Framework** | The underwriter's 7-stage risk pipeline (`$match → $lookup ×2 → $addFields ×3 → $project`); portfolio stats; EWS signals; **rolling-window analytics via `$setWindowFields`** (90-day delinquency/payment trends). | Tech Rail → aggregation visualizer; officer metrics; Portfolio Intelligence payment trends |
| **Change Streams** | Real-time status + agent-activity SSE feeds, WebSocket application queue, live officer log — no polling. | Officer status/activity streaming; queue updating live; change-stream console (ops/sec) |
| **LangGraph `MongoDBSaver` checkpoints** | Graph state snapshots power HITL `interrupt()`/resume, modify-and-continue, and restart durability. | HITL review/resume; activity log "HITL gate" entry |
| **TTL indexes + immutable audit** | TTL-based distributed pipeline locks (`pipeline_locks`); `hitl_audit` is an append-only officer decision log; `status_history` is an audit trail baked into each app document. | Officer decision summary audit trail |
| **Reliability patterns** | `safe_node` retry wrapper (3×), node timeouts, circuit breaker, idempotent seeding, status-gated REST fallbacks when SSE is buffered. | Any resilience Q&A |

> **⚠️ Keep the messaging accurate on Time Series Collections.** `payments` (and `agent_activity`) are **standard collections**, not MongoDB Time Series collections — the migration to regular collections is already done, and rolling 90-day analytics run through the **Aggregation Framework's `$setWindowFields`** stage. If you want to mention MongoDB's time-series *capability* as a platform feature, keep it clearly apart from what this demo stores.

---

## 5. Step-by-Step Instructions for the Showcase

### 5.0 Before you start (preflight — 3 minutes)

- [ ] Open the staging app (`https://fsi-agentic-lending.industrysolutions.staging.corp.mongodb.com`) in a full-screen incognito window; it is **corporate-SSO gated** (Okta). Log in with your corp credentials *before* the audience joins.
- [ ] If the browser shows a leftover session: click **Reset Demo** in the header (appears once a demo session exists), confirm, and let the page reload. Or `POST /api/demo/reset` with header `X-Demo-Reset: confirm`.
- [ ] Confirm seed data is present: the **Borrower Portal** shows 5 profile cards and the **Loan Officer** queue shows 5 seeded applications + 3 decorative samples. If empty, seed via `cd backend && uv run python -m scripts.ingest_pdfs` (idempotent).
- [ ] Confirm the AI path is live: Bedrock (Claude) relies on an active AWS SSO session. A quick check is running one chat message or an agent run; if extraction silently fails, re-run `aws sso login`.
- [ ] Sound off, projector at 1080p, browser zoom comfortable, no screensaver/lock.

### 5.1 The 25–30 minute script

#### Part A — Borrower experience: "minutes, not 45 days" (6–7 min)

1. Start on **Borrower Portal** with the tab bar visible. Land the premise: *"Traditional mortgage origination takes 45+ days. This is that same journey, automated."*
2. Pick **Jane & John Doe** (the auto-approve path) — or **Marcus & Sofia Delgado** if you want the officer to be involved later. Click the card → the application form.
3. (Optional but quick) point out the amortization calculator and the co-applicant fields, then click **Apply** / submit. A submission overlay shows "Creating application → Attaching documents → Submitting for review."
4. As it submits, the app fires the real 6-agent pipeline (`/agent/{id}/run`). You land on the **tracking** view: left **Your Documents**, center **Status** (Amazon-style 5 milestones), right the **Personal Lending Assistant**.
5. Watch status move to **In Review** and the milestone timeline light up — *all internal agents (doc verification, credit, underwriting, officer review) collapse into one "In Review" for the borrower by design.*
6. Demo the assistant: type *"what documents do I still need?"* → the **DocumentChecklist** generative UI renders inline with the real required-vs-submitted state. If the case reaches approval later, ask *"what happens after I'm approved?"* → **ClosingTimeline**.
7. **For the "AI wow" beat**, switch to **Sarah Williams** (or use her from the start) to show the intervention loop:
   - Sarah submits with a missing paystub → pipeline detects it → status goes to a borrower action-required state and the tracker shows an **Action Needed** banner.
   - The chat surfaces an **InterventionCard** with "Upload Pay Stubs" → click upload → the pre-seeded PDF is extracted and embedded in real time.
   - Resolving the blocking intervention auto-triggers `/agent/{id}/re-evaluate` → the pipeline completes → Sarah is approved. *"The agent paused, asked the right person for the right thing, and resumed on its own."*
8. On an approval, show the outcome: **Approval Summary** (approved rate / monthly payment / loan amount). On a decline (Bob & Alice Johnson), show the plain-language **DeclineCard**.

#### Part B — Officer experience: "the human judges, the AI does the work" (7–8 min)

1. Switch to the **Loan Officer** tab. Frame: *"Same pipeline from the other side of the glass — this is what the officer sees."*
2. The **queue** is already live (WebSocket + Change Streams): the 5 seeded applications plus decorative samples. Point at the "Needs Attention" sort and the amber "Pending Review" accents.
3. Open an application **in review** (e.g. **Marcus & Sofia Delgado**, $875K purchase price). The center column leads with the **persistent Total-Time card** — status stages left-to-right, clock pausing whenever the case is waiting on the borrower (`action_required`).
4. Expand the **Pipeline Step Tracker** (Origination → Underwriting → Decision Review): live sub-steps and metrics (risk score, GDS/TDS, credit score) as the agents ran. Click **"View diagram"** to open the full agent node-graph modal — doc_verifier + credit_puller run in parallel (LangGraph `Send`).
5. When the case reaches the **HITL gate**, show the **HITL Review**:
   - **AI Recommendation hero** — the underwriter's recommended action + one-line reason + confidence + suggested conditions.
   - **Threshold Analysis** — each trigger vs its limit: purchase price vs $500K, effective GDS vs 36%, effective TDS vs 41%, risk tier vs the auto-approve envelope — with `TRIGGERED` / `PASS` pills.
   - Approve (optionally with conditions), **Decline with reason**, or **Modify-and-continue** (which resets data gathering and re-underwrites on the new terms).
6. After deciding, show the **Decision Summary**: provenance chain, audit trail, "Reviewed by Curtis Dean", and (for a modify) a before/after comparison.
7. **Technical beat (BIAN + MongoDB):** open the **Tech Rail** (far right, expand the collapsed strip) —
   - **Document Model inspector** → show the stored loan record in its **BIAN shape**: `loansId`, the nested `assessment.*` underwriting block, `maintenance.statusHistory`, `borrower_ids` referencing the shared `customers` directory. *"The application API speaks our snake_case; what's persisted speaks BIAN — same database (`leafy_bank_bian`), translated at the persistence boundary."*
   - **Aggregation visualizer** → the 7-stage risk pipeline with docs-in/out and latency per stage.
   - **Change Stream console** → ops/sec and change events correlated to the agent activity you just watched.
8. Back in the **Agent Rail**, show **Policy Explorer** (vector search over the 15 underwriting policies with relevance bars) and let the **activity log** recount the agent timeline — always a crowd-pleaser.

#### Part C — Renewal: a second agentic workflow (3–4 min)

1. Switch to the **Renewal** tab. Frame: *"Same platform, second job — servicing. Loans maturing in 3 months."*
2. Pick a loan marked **Due for renewal** → **Run Renewal Agent**. Its steps **stream live** with tech tags and latency: scan → pull market rate + retention discount → recompute payment → Bedrock **drafting…** rationale → persist.
3. Show the offer panel: current vs renewed rate/monthly payment with a "Saves $X / month" delta and the rationale.
4. **"Send to borrower & e-sign"** → simulated signature → the loan **auto-renews** (maturity +5 years). Click **Re-scan portfolio** to restore the renewed loans to `due` — the demo is intentionally repeatable.

#### Part D — Demo Flow (optional, 4–5 min, great as an encore)

1. Switch to **Demo Flow**; the 6 scenes play as a scripted walkthrough over the workflow canvas. Use Play/Step/Back to pace it.
2. When time is short, best beats: **Underwriting** (risk gauge + policy-RAG citations), **Servicing** (EWS signals + rolling `$setWindowFields` analytics), and the **completion screen's TechRecap**.

#### Close (1–2 min)

Recap with the §6 "why MongoDB" beats, tie back to the BIAN hook ("one database, a bank-standard data model, and an agentic layer — all in sync"), and open Q&A. Have the profile cheat-sheet (below) ready so a question about any path is a 5-second answer.

### 5.2 Profile cheat-sheet (the 5 seeded paths)

| Profile | Path shown | Single-line trigger |
| --- | --- | --- |
| Jane & John Doe | **Auto-Approve** | Clean credit (798/772), low ratios, < $500K → approved with no officer |
| Marcus & Sofia Delgado | **Officer Review → Approve** | $875K purchase price trips the $500K escalation → HITL |
| John Smith (solo) | **Borderline → Escalate** | Credit 695 + stress GDS > 36% → Tier C → officer |
| Bob & Alice Johnson | **Decline** | OSFI B-20 stress failure (GDS 68% vs 39% limit) |
| Sarah Williams (solo) | **Doc issue → Fix → Approve** | Missing paystubs → blocking intervention → upload via chat → re-evaluate |

Each profile has 14 synthetic PDF documents on disk (`docs/synthetic data/<profile-id>/`); Sarah intentionally seeds 13/14 so the paystub she "uploads" is real demo material.

### 5.3 Reset & repeat

- **Reset Demo** (header) wipes applications/documents/conversations created during the session and reloads to a clean state (seed data is untouched). The officer queue + Renewal re-scan keep the surface repeatable across meetings.
- Known constraints to avoid mid-demo: an expired AWS SSO session (Bedrock extraction fails), interrupted seed data (re-run `ingest_pdfs`), and buffered SSE on the officer feed (a REST fallback covers it — just wait for events).

---

## 6. MongoDB Advantages Summary (Why MongoDB)

Close with these. Each is demonstrably true of the running demo:

1. **One database instead of seven.** Transactional loan data, searchable/embedded documents, analytics, real-time events, and AI state all live in MongoDB Atlas. There is no separate vector DB, no Kafka for app events, no warehouse for these workloads — the "7 databases + ETL" slide this demo's InfoWizard compares against.
2. **Schema flexibility = the BIAN modernization path.** The bank keeps a standardized (BIAN) data model, and MongoDB stores it directly — the app translates at the storage boundary, and `COLL_*` indirection lets a migration rename collections with **zero code edits**. You can move a 30-year-old book of business and an agentic layer onto the same database.
3. **Document = the loan package.** One document carries the application, its status history (audit), nested risk assessment, and references to borrowers/documents — read it together, no joins across 8 tables.
4. **Search and RAG where the data lives.** Atlas Vector Search + Voyage AI embeddings give semantic policy lookup and document search at sub-15ms — citations come with scores, so the LLM's answers are traceable.
5. **Real-time out of the box.** Change Streams power the live queue, streaming status, and the officer activity feed without extra infrastructure.
6. **Analytics in-database.** The 7-stage aggregation pipeline and `$setWindowFields` rolling windows (EWS, payment trends) run in MongoDB — no data duplication for reporting.
7. **Durable, resumable AI.** LangGraph `MongoDBSaver` checkpoints make human-in-the-loop interruption/resume a data feature, not an integration project, and give you an immutable officer-decision audit log.

> **The closing one-liner:** *"MongoDB Atlas isn't just the storage for this demo — it's the reason the lending pipeline, the real-time experience, the scalable analytics, and the BIAN-standardized data model can all live as one system. That's the platform story."*

---

*Appendix — see the repo `README.md` for the full architecture, endpoints, collections, and the BIAN Data-Model Alignment section; `backend/tests/test_bian_mapping.py` documents the storage-mapping guarantees.*
