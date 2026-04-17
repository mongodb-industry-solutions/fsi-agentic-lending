# LendFlow AI — Agentic Lending Platform

End-to-end agentic lending platform demonstrating how **MongoDB Atlas**, **LangGraph**, and **Voyage AI** work together to automate the full mortgage lifecycle — from application intake through loan servicing.

---

## Solution Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Next.js 15)                         │
│                                                                             │
│   ┌──────────────┐  ┌────────────────────┐  ┌───────────────────────────┐  │
│   │  Borrower    │  │  Loan Officer      │  │  Demo Flow               │  │
│   │  Portal      │  │  Dashboard         │  │  (6 Scenes)              │  │
│   │              │  │                    │  │                           │  │
│   │ • Selection  │  │ • Queue (WebSocket)│  │ • Origination            │  │
│   │ • Form+Valid │  │ • Activity (SSE)   │  │ • Underwriting           │  │
│   │ • Status(SSE)│  │ • HITL Review      │  │ • Approval               │  │
│   │ • AI Chat    │  │ • Intent Preview   │  │ • Closing                │  │
│   │   + Gen UI   │  │ • Decision Summary │  │ • Funding                │  │
│   │ • Tech       │  │ • Tech Rail        │  │ • Servicing              │  │
│   │   Theatre    │  │                    │  │                           │  │
│   └──────┬───────┘  └────────┬───────────┘  └───────────────────────────┘  │
│          │                   │                                              │
│          └───────────┬───────┘                                              │
│                      │  REST / SSE / WebSocket                              │
│              ┌───────┴────────┐                                             │
│              │ Custom Server  │  server.mjs — WebSocket proxy for K8s      │
│              │ (http-proxy)   │  /api/* upgrade → backend sidecar           │
│              └───────┬────────┘                                             │
└──────────────────────┼─────────────────────────────────────────────────────┘
                       │
┌──────────────────────┼─────────────────────────────────────────────────────┐
│                      ▼       BACKEND (FastAPI)                             │
│                                                                             │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                    LangGraph Agent Pipeline                          │  │
│   │                                                                      │  │
│   │   ┌────────────┐     ┌──────────────────────────┐                   │  │
│   │   │ Supervisor │────▶│ Parallel Gather           │                  │  │
│   │   │ (routing)  │◀────│  ├─ doc_verifier          │                  │  │
│   │   │            │     │  └─ credit_puller          │                  │  │
│   │   │ Bounded    │     └──────────────────────────┘                   │  │
│   │   │ autonomy   │                │                                   │  │
│   │   │ 4 modes:   │     ┌──────────▼───────────┐                      │  │
│   │   │ observe    │     │ Loan App Agent       │                      │  │
│   │   │ suggest    │     │ • Doc verify          │                      │  │
│   │   │ bounded    │     │ • Credit pull         │                      │  │
│   │   │ auto       │     │ • LLM analysis        │                      │  │
│   │   │            │     └──────────┬───────────┘                      │  │
│   │   │ Retry: 3x  │               │                                   │  │
│   │   │ safe_node   │    ┌──────────▼───────────┐                      │  │
│   │   │ wrapper     │    │ Underwriter Agent     │                      │  │
│   │   └─────┬──────┘    │ • 7-stage aggregation  │                      │  │
│   │         │            │ • GDS/TDS + stress test│                      │  │
│   │         │            │ • Policy RAG           │                      │  │
│   │         │            │ • Structured output    │                      │  │
│   │         │            │   (Bedrock tool_use)   │                      │  │
│   │         │            └──────────┬───────────┘                      │  │
│   │         │                       │                                   │  │
│   │         ▼                       ▼                                   │  │
│   │   ┌────────────┐         ┌──────────────┐                          │  │
│   │   │ HITL Gate  │◀────────│ Decision     │                          │  │
│   │   │            │         │ Logic        │                          │  │
│   │   │ interrupt()│         │              │                          │  │
│   │   │ + resume   │         │ • Risk score │                          │  │
│   │   │ via        │         │ • OSFI B-20  │                          │  │
│   │   │ Command()  │         │ • Policy     │                          │  │
│   │   │            │         │   thresholds │                          │  │
│   │   │ MongoDBSaver         └──────────────┘                          │  │
│   │   │ checkpoints│                                                   │  │
│   │   └──────┬─────┘   Officer actions:                                │  │
│   │          │          • Approve (+ conditions)                        │  │
│   │          │          • Decline (+ reason)                            │  │
│   │          │          • Modify & continue (override terms)            │  │
│   │          ▼                                                          │  │
│   │   ┌────────────┐                                                   │  │
│   │   │ COMPLETE   │  Log + set completed_at                           │  │
│   │   └────────────┘                                                   │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│   ┌────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│   │ Application│  │ Pipeline     │  │ Extraction   │  │ Circuit      │   │
│   │ Agent      │  │ Lock         │  │ Service      │  │ Breaker      │   │
│   │ (Chatbot)  │  │ (TTL-based)  │  │ (Bedrock     │  │              │   │
│   │ SSE stream │  │              │  │  Converse)   │  │              │   │
│   │ Generative │  │              │  │              │  │              │   │
│   │ UI (7 comp)│  │              │  │              │  │              │   │
│   └────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
│                                                                             │
│   ┌────────────┐  ┌────────────┐  ┌──────────────┐                       │
│   │ Bedrock    │  │ LangSmith  │  │ Voyage AI    │                       │
│   │ Claude     │  │ @traceable │  │ Multimodal   │                       │
│   │ Haiku 4    │  │ traces     │  │ Embeddings   │                       │
│   │ + tool_use │  │            │  │ (voyage-3.5) │                       │
│   └────────────┘  └────────────┘  └──────────────┘                       │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
┌────────────────────────────────────┼────────────────────────────────────────┐
│                                    ▼     MONGODB ATLAS                      │
│                                                                             │
│   ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  ┌──────────────┐ │
│   │ Document    │  │ Atlas Vector │  │ Aggregation    │  │ Change       │ │
│   │ Model       │  │ Search       │  │ Framework      │  │ Streams      │ │
│   │             │  │ (Voyage AI)  │  │                │  │              │ │
│   │ applications│  │              │  │ 7-stage risk   │  │ Real-time    │ │
│   │ borrowers   │  │ documents    │  │ scoring        │  │ WebSocket    │ │
│   │ documents   │  │ policies     │  │ pipeline       │  │ SSE feeds    │ │
│   │ credit_rpts │  │              │  │                │  │              │ │
│   │ interventions  └──────────────┘  └────────────────┘  └──────────────┘ │
│   │ conversations│                                                         │
│   └─────────────┘                                                          │
│                                                                             │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│   │ Time Series  │  │ MongoDBSaver │  │ Pipeline     │  │ HITL Audit   │ │
│   │ Collections  │  │ Checkpoints  │  │ Locks        │  │ Log          │ │
│   │              │  │              │  │              │  │              │ │
│   │ payments     │  │ checkpoints  │  │ TTL-based    │  │ Immutable    │ │
│   │ agent_activity│ │ chkpt_writes │  │ distributed  │  │ officer      │ │
│   │ + $setWindow │  │ chkpt_meta   │  │ concurrency  │  │ decisions    │ │
│   └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Agent Pipeline Flow

```
                    ┌─────────────────────────────────────────────────┐
                    │                 START                            │
                    └──────────────────────┬──────────────────────────┘
                                           │
                    ┌──────────────────────▼──────────────────────────┐
                    │              SUPERVISOR                          │
                    │                                                  │
                    │  Autonomy Modes:                                 │
                    │  • observe  — pauses before non-terminal nodes  │
                    │  • suggest  — requires officer approval         │
                    │  • bounded  — autonomous + HITL escalation      │
                    │  • auto     — fully autonomous                  │
                    │                                                  │
                    │  Retry: last_error + retry_count < 3 → retry    │
                    │  Blocking: pending blocking interventions →      │
                    │            pause (status=action_required)        │
                    │  Gather: gather_attempts counter prevents loops  │
                    │                                                  │
                    │  Routing:                                        │
                    │  • blocking interventions → complete (paused)    │
                    │  • not gathered → parallel (doc_verifier +      │
                    │                   credit_puller via Send)        │
                    │  • docs not verified → loan_app                 │
                    │  • risk_score null → underwriter                │
                    │  • decision=escalate → hitl_gate                │
                    │  • decision=approve/decline → complete           │
                    └──┬──────────┬────────────┬──────────┬───────────┘
                       │          │            │          │
          ┌────────────▼──┐  ┌───▼─────────┐  │  ┌───────▼───────┐
          │  PARALLEL     │  │ UNDERWRITER │  │  │   COMPLETE    │
          │  GATHER       │  │ AGENT       │  │  │               │
          │               │  │             │  │  │ Log pipeline  │
          │ doc_verifier  │  │ 1. Run 7-   │  │  │ complete      │
          │  + credit_    │  │    stage     │  │  │ Set completed │
          │    puller     │  │    aggreg.   │  │  │ _at timestamp │
          │  (via Send)   │  │ 2. GDS/TDS  │  │  └───────────────┘
          │               │  │ 3. Stress   │  │
          │ → loan_app    │  │    test     │  │
          └───────┬───────┘  │ 4. Policy   │  │
                  │          │    RAG      │  │
          ┌───────▼───────┐  │ 5. Tool use │  │
          │  LOAN APP     │  │    (struct  │  │
          │  AGENT        │  │    output)  │  │
          │               │  │ 6. Decision │  │
          │ 1. Fetch docs │  │ 7. Persist  │  │
          │ 2. Verify IDs │  │    metrics  │  │
          │ 3. Pull credit│  └──────┬──────┘  │
          │ 4. LLM analyze│         │         │
          │ 5. Update     │         │    ┌────▼──────────┐
          │    status     │         │    │  HITL GATE    │
          └───────┬───────┘         │    │               │
                  │                 │    │ interrupt()   │
                  │                 │    │ ──► pause     │
                  └────► SUPERVISOR ◄───│               │
                                        │ Officer:      │
                                        │ • approve     │
                                        │ • decline     │
                                        │ • modify +    │
                                        │   continue    │
                                        │   (override   │
                                        │    terms →    │
                                        │    re-gather  │
                                        │    + re-      │
                                        │    underwrite)│
                                        │               │
                                        │ resume via    │
                                        │ Command()     │
                                        └───────────────┘
```

## Where MongoDB Shines

| Capability                | How It's Used                                                                                                                     | Grade |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----- |
| **Document Model**        | Loan applications, interventions, and conversations grow through lifecycle stages — one document per entity, no schema migrations | A     |
| **Atlas Vector Search**   | Policy RAG via Voyage AI multimodal embeddings (voyage-multimodal-3.5) — `queryVector` with pre-computed embeddings               | A     |
| **Aggregation Framework** | 7-stage risk scoring pipeline ($match→$lookup×2→$addFields×3→$project)                                                            | A     |
| **Change Streams**        | Real-time WebSocket queue + SSE status/activity feeds, labeled in UI                                                              | A     |
| **Time Series**           | Payment history with $setWindowFields (rolling 90-day analysis), EWS signals                                                      | A-    |
| **MongoDBSaver**          | LangGraph checkpoint persistence for HITL interrupt/resume across restarts                                                        | A     |

## Tech Stack

| Layer         | Technology                                                                                                           |
| ------------- | -------------------------------------------------------------------------------------------------------------------- |
| Frontend      | Next.js 15 (App Router), React 19, LeafyGreen UI, custom server.mjs (WebSocket proxy for K8s)                        |
| Backend       | FastAPI, LangGraph 0.4+, Python 3.13 (managed by uv)                                                                |
| Database      | MongoDB Atlas (11 collections + 3 LangGraph infra)                                                                   |
| AI/ML         | AWS Bedrock Claude Haiku 4 (tool_use for structured output), Voyage AI multimodal embeddings (voyage-multimodal-3.5) |
| Observability | LangSmith (@traceable on all LLM calls + agent nodes)                                                                |
| Deployment    | Docker Compose (local), Kanopy/K8s (staging/prod)                                                                    |

## Agent Features

### Structured Output via Tool Use

The underwriter agent uses **Bedrock Converse API with tool definitions** to produce structured JSON analysis:

- Risk factors (array)
- Mitigating factors (array)
- Recommended conditions (array)
- Policy violations with policy_id references
- Confidence score (0-1)
- Narrative summary

### Autonomy Model

Four autonomy modes control agent behavior through the supervisor:

| Mode       | Behavior                                                              |
| ---------- | --------------------------------------------------------------------- |
| `observe`  | Pauses before every non-terminal node for officer review              |
| `suggest`  | Requires explicit officer approval before proceeding                  |
| `bounded`  | Acts autonomously within policy limits; HITL escalation on thresholds |
| `auto`     | Fully autonomous — no human gates                                     |

Default is `bounded`. HITL escalation triggers: high purchase price (>$500K), elevated GDS (>0.36) or TDS (>0.41) ratios, and other configurable thresholds.

### OSFI B-20 Stress Test

Every application is stress-tested at `max(contract_rate + 2%, 5.25%)`. LTV-aware: insured mortgages (LTV > 80%) use tighter limits (GDS 35%, TDS 42%) vs conventional (GDS 39%, TDS 44%). Explicit pass/fail with GDS/TDS at the stress rate. Failure → automatic decline with regulatory reason. Stress metrics (`stress_gds`, `stress_tds`, `stress_rate`, `gds_limit`, `tds_limit`, `is_insured`) are persisted to state and MongoDB.

### Intervention Pipeline

Pipeline agents create typed interventions that surface as borrower-facing action cards in the AI chat:

- `stress_test_failure` — OSFI B-20 stress test failed (blocking)
- `income_data_required` — combined income is zero/missing (blocking)
- `credit_score_required` — primary credit score unavailable (blocking)
- `missing_document` — required document types missing (blocking) — pipeline pauses until borrower uploads
- `credit_data_unavailable` — credit bureau data not retrieved (advisory)
- `document_processing_error` — PDF extraction failed (advisory)
- `additional_info_required` — escalation notification for officer review (advisory)

Interventions include separate `internal_context` (for officer/pipeline use) and `borrower_context` (safe to display in chat). **Blocking interventions pause the pipeline** — the supervisor detects pending blocking interventions and sets status to `action_required`, stopping execution until the borrower resolves them. When the last blocking intervention is resolved, the system auto-triggers `/agent/{id}/re-evaluate` to restart the pipeline. The `InterventionCard` in the chat UI renders "Upload Document" buttons for `missing_document` interventions, calling the demo-upload API endpoint to upload pre-seeded correction PDFs.

### Application Agent (AI Chat)

Context-aware conversational assistant with **Generative UI** — the agent renders interactive React components inline in chat messages alongside text responses:

- **Generative UI Components** — 7 interactive components rendered inline based on conversation context:
  - **AffordabilityCalculator** — sliders for rate, term, down payment with live GDS/TDS gauges (Canadian semi-annual compounding)
  - **DocumentChecklist** — real-time document status with progress bar
  - **ApplicationStrength** — qualitative factor assessment (borrower-safe, no raw scores)
  - **RateComparison** — Fixed 3yr/5yr/Variable with recommended badge and savings differential
  - **PaymentSchedule** — amortization table with monthly/annual toggle and P/I ratio
  - **ScenarioComparison** — side-by-side what-if with diff highlighting
  - **ClosingTimeline** — post-approval 4-step timeline
- **Architecture** — Backend detects components via keyword matching (`UI_TRIGGERS`) with status gates, emits `ui_component` SSE events with structured data, frontend maps to React via `ComponentRegistry`. LLM context injection tells the model which visuals are shown so text complements rather than duplicates.
- **Unified capability catalog** — single `COMPONENTS_CATALOG` (in `chatConstants.js`) drives welcome tiles, capability bar, capabilities panel, pre-render announcement and trigger keywords. Adding a component is one catalog entry.
- **WelcomeCard** — first-message greeting surface with capability tiles (varies for pre-app vs. submitted app), dismissible.
- **Capability Bar** — CSS-grid quick-action tiles with mini SVG icons; newly-unlocked actions animate in (`capabilityUnlock`) as status progresses.
- **Typing-ahead suggestions** — debounced 120ms ranked matcher (`getTypeAheadSuggestions`) surfaces best-matching catalog entries as you type.
- **Proactive "Try" pills** — when the last assistant message references a capability but didn't render it, a suggestion pill invites the borrower to open that component (`getProactiveComponentSuggestion`).
- **Stop button** — send button swaps to Stop while streaming; `abort()` cancels in-flight request via AbortController.
- **Component Announcement** — pre-render strip fades/morphs into the inline component using the `announcementMorph` keyframe.
- **Stage-aware prompt** — response tone and content calibrated by application status (pre-submission, processing, underwriting, review, approved, declined)
- **Tool transparency** — per-tool latency, result counts, source badges ("Your application", "Lending policies"), expandable reasoning disclosure
- **Context strip** — persistent bar showing borrower name, app ID, status, mortgage amount
- **Proactive system messages** — status change notifications injected as centered banners
- **Categorized suggested questions** — `{text, category}` pills with progressive decay (3 → 2 → 1 as conversation grows); intervention-driven questions persist
- Streaming markdown responses via SSE (fenced code blocks + safe `[text](url)` links), intervention cards with document upload, policy RAG citations, conversation persistence, safety filter

### Officer Overrides (HITL)

Officers can:

- **Approve** with optional conditions
- **Decline** with reason (surfaces policy violations in Decision Summary)
- **Modify and continue** — override loan amount, risk tier, or add conditions. Sends `modify_and_continue` action with `overrides` and `conditions` to the backend. On `loan_amount` override, `documents_verified`, `credit_pulled`, and `gather_attempts` reset to force fresh data gathering and re-underwriting.
- All decisions include `officer_id` for immutable audit trail (written to `hitl_audit` collection)
- HITL context is auto-fetched with risk metrics enriched from LangGraph checkpoint state
- Checkpoint validation: backend checks for pending interrupts before resuming; seeded apps without checkpoints get direct status updates

### Pipeline Lock Safety

TTL-based distributed locks in the `pipeline_locks` collection prevent concurrent pipeline execution per application. The `/run` endpoint uses a `lock_released` threading event to prevent double-release between timeout handler and finally block. HITL resume also acquires/releases the lock.

### Error Recovery

- `safe_node` wrapper catches agent errors → writes to state → supervisor retries (up to 3x)
- Node execution timeout (120s default) with `future.cancel()` to prevent thread pool exhaustion
- Bedrock calls retry with exponential backoff (throttle/timeout)
- Transient vs permanent error classification
- Application deduplication prevents double-execution
- Circuit breaker pattern for external service calls
- `atexit` handler shuts down the node executor on process exit

## Demo Screens

### 1. Borrower Portal

Phase-based flow: **profile selection → application form → real-time tracking**.

- **Borrower Selection** — 5 seeded profiles (auto-approve, officer review, borderline, decline, doc issue). Cards with stats, narrative, risk factors, pipeline hint badge.
- **Application Form** — co-applicant fields, amortization calculator, validation with LeafyGreen `TextInput`.
- **Status Tracker** — SSE-driven 10-stage timeline with live ThinkingStrip, confidence badges, metric reveals.
- **Outcome Cards** — ApprovalContextCard ("Why This Was Approved"), DeclineCard (structured reasons + actionable guidance), SavingsSummary (animated count-up metrics), approval details with closing timeline.
- **AI Chat with Generative UI** — streaming markdown with inline interactive components (affordability calculator, document checklist, rate comparison, payment schedule, application strength, scenario comparison, closing timeline). Unified `COMPONENTS_CATALOG` drives welcome tiles, capability bar, capabilities popover and trigger keywords. WelcomeCard, typing-ahead suggestions, proactive "Try" pills, Stop/abort, component pre-announcement morph. Tool transparency with per-tool timing, source badges, reasoning disclosure. Context strip, proactive status notifications. Policy RAG citations, intervention cards with document upload.
- **Technology Theatre** — collapsible "glass floor" with Change Stream console, Document Model viewer, AI Capabilities panel (tool cards glow when invoked).

### 2. Loan Officer Dashboard

Full-featured officer workspace with real-time data flows and human-in-the-loop decisioning. Dual-rail architecture on the right side.

- **Application Queue** — real-time via WebSocket + Change Stream, filterable and sortable, amber accent on review-needed apps.
- **Application Detail** — borrower info, risk assessment, credit reports, documents. Includes **Pipeline Explorer** (7-stage aggregation viz) and **Document Search** (Atlas Vector Search).
- **Compact Status Bar + Workflow Modal** — single-line stage/pulse/metrics strip with a "View Workflow" action that opens the full **Workflow Canvas** (Canvas 2D engine, parallel `doc_verifier`/`credit_puller` nodes, comet trails, HITL barrier drama) in a LeafyGreen Modal.
- **Empty-state Architecture Card** — when no application is selected, a 3-column (Origination / Underwriting / Decision) card lists each stage's agents with capability badges.
- **Live Underwriting Results** — real-time metrics overlay (risk score, GDS/TDS, credit score, stress test).
- **Agent Activity Log** — SSE feed with color-coded left-borders by action type, noise-action filter, deferred status-gated REST fallback, multi-line markdown-aware reasoning, metric summary strip, HITL gate entry, agent transition dividers, pause/resume.
- **Policy Explorer** — Atlas Vector Search with relevance bars, search provenance, term highlighting, HITL auto-search.
- **Portfolio Intelligence** — Payment trends (SVG trend line), severity-tiered EWS cards, events timeline.
- **Intent Preview** — agent's planned execution steps with dependency connectors and data readiness badges, aligned to the real pipeline (doc verify, credit pull, synthesis, risk score, policy RAG, decision gate).
- **HITL Review** — risk metrics from LangGraph checkpoint, explicit **Threshold Analysis** panel (price / effective GDS / effective TDS / risk tier vs. policy limits), approve/decline/modify with officer overrides and re-underwriting. GDS/TDS limits centralized in `LoanOfficerDashboard/utils.js` (`GDS_LIMIT`, `TDS_LIMIT`).
- **Decision Summary** — provenance chain, audit trail, before/after comparison for modified decisions.
- **Agent Rail** (320px) — branded "AI Agent Layer" header with live pulse and stats, cyan-to-amber border on HITL. Agent events highlight corresponding canvas nodes.
- **Tech Rail** (340px, collapsible) — Change Stream console (ops/sec, cross-rail correlation), Aggregation Pipeline visualizer, Document Model inspector.

### 3. Demo Flow

6-scene scripted walkthrough demonstrating the full lending lifecycle.

- **SceneNavBar** — scene navigation pills with progress connectors, capability counter Badge, single-click speed cycle, Play/Pause/Step/Back/Reset controls.
- **WorkflowCanvas** — Canvas 2D engine (21 nodes, 5 shape types) with multi-particle comet trails, layered glow, technology-aware tooltips, and HITL barrier drama. Shared between Demo Flow and Officer Dashboard.
- **AnnotationOverlay** — compact step annotation bar with progress dots, agent name, clickable capability badges with educational popovers, collapsible reasoning text.
- **PipelineDrawer** — slide-out activity log (right edge toggle, Escape to close, `aria-expanded`).
- **Origination** — multi-document extraction (CRA Notice, Bank Statement, Pay Stub) with progressive field reveal, tab switcher with aggregate confidence Badges, Open Banking headline metrics.
- **Underwriting** — risk ring SVG gauge, top-5 factor bars with positive/negative layout, counterfactual explainer, policy-RAG citations panel.
- **Approval** — HITL review card with Badge-based tier indicator, Approve/Modify/Decline controls, collapsible Repayment Schedule and Regulatory Disclosures.
- **Closing** — closing timeline with workflow canvas: approval detection, closing package (TILA, RESPA), compliance checks, e-sign completion.
- **Funding** — disbursement timeline with 4-step document evolution, double-entry accounting table.
- **Servicing** — portfolio stats grid, top-3 Early Warning System signals, live event feed, 4-step renewal intervention card. Real-time data from `/portfolio/stats`. Focus nodes: `timeSeries`, `changeStream`, `vectorSearch`, `mongoAtlas` (servicingAgent node retired from canvas).
- **Completion Screen** — full WorkflowCanvas with all nodes completed (green edges, checkmarks), `TechRecap` card with 5 collapsible sections (Performance Stats, Tech Stack, Cross-Lifecycle Intelligence, By the Numbers).

## Demo Borrower Profiles

5 seeded profiles exercise every pipeline decision path:

| Profile | Pipeline Path | Key Trigger | Province |
|---------|--------------|------------|----------|
| **Marcus & Sofia Delgado** | Officer Review → Approve | Purchase $875K > $500K threshold | AB |
| **Jane & John Doe** | Auto-Approve | Clean credit (798/772), low ratios, < $500K | BC |
| **John Smith** (solo) | Borderline → Officer Escalate | Credit 695 + stress GDS > 36% → Tier C | ON |
| **Bob & Alice Johnson** | Decline | Stress test failure (GDS 68% vs 39% limit) | ON |
| **Sarah Williams** (solo) | Doc Issue → Fix → Approve | Missing paystubs → blocking intervention → upload via chat → re-evaluate | ON |

Each profile has 14 synthetic PDF documents (government ID, employment letter, paystubs, tax notices, bank statements, purchase agreement, investment statements, property docs, mortgage application, utility bills, credit report, car loan, property tax, property inspection) in `docs/synthetic data/<profile-id>/`. PDFs are generated by `backend/scripts/generate_profile_pdfs.py` using `fpdf2`.

Sarah Williams demonstrates the **full intervention resolution loop**: pipeline detects missing paystubs → creates blocking intervention → pipeline pauses (`action_required` status) → borrower sees InterventionCard in chat with "Upload Pay Stubs" button → uploads pre-seeded PDF via demo-upload API → acknowledges intervention → pipeline re-evaluates → auto-approves.

## Prerequisites

- Python 3.13+
- Node.js 22+
- [uv](https://docs.astral.sh/uv/getting-started/installation/)
- MongoDB Atlas cluster (M10+ for Change Streams, or M0 without real-time features)
- AWS credentials with Bedrock access (Claude Haiku 4)
- Voyage AI API key (`VOYAGE_API_KEY`) for multimodal embeddings (voyage-multimodal-3.5)
- (Optional) LangSmith API key for observability

## Quick Start

### 1. Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env with your MongoDB URI, Bedrock model ID, etc.

make uv_init && make uv_sync

uv run python -m scripts.create_indexes    # Create collections + indexes
uv run python -m scripts.ingest_pdfs       # Seed 5 borrower profiles (70 PDFs + credit + payments + policies)
uv run uvicorn main:app --host 0.0.0.0 --port 8000
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

### 3. Docker

```bash
make build    # Build and start both services
make clean    # Stop and remove containers
```

### 4. Run Tests

```bash
cd backend
uv run pytest    # 15 tests (health, applications, documents, agent state)
```

## Environment Variables

### Backend (`backend/.env`)

| Variable                   | Required | Description                                      |
| -------------------------- | -------- | ------------------------------------------------ |
| `MONGODB_URI`              | Yes      | MongoDB Atlas connection string                  |
| `DATABASE_NAME`            | Yes      | Database name (default: `lendflow`)              |
| `CHATCOMPLETIONS_MODEL_ID` | Yes      | Bedrock inference profile ARN or model ID        |
| `VOYAGE_API_KEY`           | Yes      | Voyage AI API key for multimodal embeddings      |
| `AWS_REGION`               | No       | AWS region (default: `us-east-1`)                |
| `ORIGINS`                  | No       | CORS origins (default: `http://localhost:3000`)  |
| `CURRENT_5YR_FIXED_RATE`   | No       | Mortgage rate (default: `0.0489`)                |
| `DECLINE_RISK_SCORE`       | No       | Auto-decline threshold (default: `80`)           |
| `ESCALATE_PURCHASE_PRICE`  | No       | HITL escalation threshold (default: `500000`)    |
| `ESCALATE_GDS`             | No       | GDS ratio escalation threshold (default: `0.36`) |
| `ESCALATE_TDS`             | No       | TDS ratio escalation threshold (default: `0.41`) |
| `LANGCHAIN_TRACING_V2`     | No       | Enable LangSmith tracing (`true`)                |
| `LANGCHAIN_API_KEY`        | No       | LangSmith API key                                |
| `LANGCHAIN_PROJECT`        | No       | LangSmith project name                           |

### Frontend (`frontend/.env`)

| Variable                  | Required | Description                                                  |
| ------------------------- | -------- | ------------------------------------------------------------ |
| `NEXT_PUBLIC_BACKEND_URL` | No       | Backend URL for API proxy (default: `http://localhost:8000`) |
| `NEXT_PUBLIC_WS_BASE`     | No       | WebSocket URL (default: auto-detected)                       |

## API Endpoints

### REST (27 endpoints)

| Method | Path                                         | Description                                                                             |
| ------ | -------------------------------------------- | --------------------------------------------------------------------------------------- |
| POST   | `/api/applications`                          | Create loan application (supports demo session isolation via `profile_id` + `demo_session_id`) |
| GET    | `/api/applications`                          | List applications (paginated: `?skip=0&limit=50`)                                       |
| GET    | `/api/applications/{id}`                     | Full application with documents + credit reports                                        |
| GET    | `/api/applications/{id}/documents`           | List documents                                                                          |
| GET    | `/api/applications/{id}/timeline-context`    | Borrower-safe context for StatusTracker (interventions, activity summary, metrics)       |
| GET    | `/api/applications/{id}/risk-pipeline`       | 7-stage aggregation results + stage descriptions                                        |
| GET    | `/api/documents/{id}`                        | Get single document                                                                     |
| GET    | `/api/documents/{id}/pdf`                    | Serve original PDF                                                                      |
| GET    | `/api/documents/{id}/json`                   | Full MongoDB document JSON                                                              |
| POST   | `/api/applications/{id}/documents/upload`    | Upload + extract document via Bedrock (50MB limit, SHA-256 dedup)                       |
| POST   | `/api/documents/search`                      | Atlas Vector Search across documents (supports `application_id` filter)                 |
| POST   | `/api/policies/search`                       | Atlas Vector Search across policies                                                     |
| POST   | `/api/agent/{id}/run`                        | Trigger agent pipeline (with pipeline lock)                                             |
| POST   | `/api/agent/{id}/re-evaluate`                | Re-run pipeline after blocking interventions resolved                                   |
| POST   | `/api/hitl/{id}/decision`                    | Officer decision (approve/decline/modify + overrides + officer_id)                      |
| GET    | `/api/hitl/{id}/context`                     | HITL review context (application + activity + LangGraph checkpoint enrichment)          |
| POST   | `/api/chat/{id}/message`                     | Send chat message to Application Agent                                                  |
| POST   | `/api/chat/{id}/message/stream`              | Streaming chat (SSE with tool_call events + citations in done event)                    |
| GET    | `/api/chat/{id}/history`                     | Chat conversation history                                                               |
| GET    | `/api/chat/{id}/interventions`               | Pending interventions (borrower-safe fields)                                            |
| POST   | `/api/chat/{id}/interventions/{iid}/resolve` | Acknowledge/resolve an intervention (auto-triggers re-evaluate if last blocking)        |
| POST   | `/api/chat/general/message`                  | General chat (pre-application, no app context)                                          |
| GET    | `/api/portfolio/stats`                       | Portfolio-level aggregation (active loans, delinquency)                                 |
| GET    | `/api/portfolio/payments`                    | Payment trends with $setWindowFields                                                    |
| GET    | `/api/portfolio/ews`                         | Early Warning System signals from time-series (auto-samples a loan_id if none provided) |
| GET    | `/api/portfolio/events`                      | Recent events (payments + agent actions)                                                |
| POST   | `/api/demo/reset`                            | Reset demo state (requires `X-Demo-Reset: confirm` header)                              |

### SSE (4 endpoints)

| Path                                  | Description                                                                                                            |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| GET `/api/applications/{id}/activity` | Stream agent activity (Change Stream)                                                                                  |
| GET `/api/applications/{id}/status`   | Stream status changes (Change Stream)                                                                                  |
| GET `/api/agent/{id}/run-stream`      | Combined run + stream (LangGraph astream_events) — used by officer dashboard for workflow progression + HITL detection |
| GET `/api/agent/{id}/stream`          | Activity-only stream with backlog (last 50 events) — used for reconnection after HITL resume                           |

### WebSocket (1 endpoint)

| Path                      | Description                                                                            |
| ------------------------- | -------------------------------------------------------------------------------------- |
| WS `/api/applications/ws` | Real-time application queue (Change Stream, 15s heartbeat, 60s dead-client detection)  |

## MongoDB Collections (11 + 3 infra)

| Collection              | Type            | Purpose                           | Key Feature                                                                    |
| ----------------------- | --------------- | --------------------------------- | ------------------------------------------------------------------------------ |
| `borrowers`             | Standard        | Applicant profiles                | Polymorphic income sources                                                     |
| `applications`          | Standard        | Loan state machine                | Status history with audit trail                                                |
| `documents`             | Standard        | Extracted PDF data                | Voyage AI embeddings for vector search                                         |
| `credit_reports`        | Standard        | Credit bureau data                | Per-borrower scoring, sorted by borrower order                                 |
| `underwriting_policies` | Standard        | Policy text for RAG               | Voyage AI embeddings, 15 Canadian mortgage rules                               |
| `conversations`         | Standard        | Application Agent chat history    | Per-application message persistence (borrower PII — separate retention policy) |
| `interventions`         | Standard        | Pipeline-to-borrower action items | Typed interventions with dual context (internal + borrower)                    |
| `hitl_audit`            | Standard        | Officer decision audit log        | Immutable — no update/delete operations, indexed by officer_id                 |
| `pipeline_locks`        | Standard        | Distributed concurrency locks     | TTL-based (600s expiry) to prevent concurrent pipeline execution               |
| `payments`              | **Time Series** | Payment history                   | $setWindowFields rolling 90-day analysis                                       |
| `agent_activity`        | **Time Series** | Agent action log                  | Real-time SSE streaming via Change Stream                                      |
| `checkpoints`           | LangGraph       | Graph state snapshots             | MongoDBSaver interrupt/resume                                                  |
| `checkpoint_writes`     | LangGraph       | Write-ahead log                   | Checkpoint durability                                                          |
| `checkpoints_metadata`  | LangGraph       | Checkpoint metadata               | Graph state metadata                                                           |

## Backend Services

| Service                  | Purpose                                                       |
| ------------------------ | ------------------------------------------------------------- |
| `application_service.py` | CRUD, demo app upsert with session isolation, status updates  |
| `dashboard_service.py`   | Portfolio stats, EWS signals, payment trends, recent events   |
| `document_service.py`    | Document management, PDF path resolution                      |
| `extraction_service.py`  | PDF extraction via Bedrock Converse API (resilient — returns error dict on failure) |
| `embedding_service.py`   | Multimodal embeddings via Voyage AI (voyage-multimodal-3.5)   |
| `vector_search_service.py` | Atlas Vector Search queries for documents and policies      |
| `pipeline_lock.py`       | TTL-based distributed locking for pipeline concurrency        |
| `circuit_breaker.py`     | Circuit breaker pattern for external service calls            |

## Security

- Pre-commit hook scans for secrets (`./setup-hooks.sh`)
- PDF uploads validated (content-type + `%PDF` magic bytes + filename sanitization via PurePosixPath, 50MB limit)
- SHA-256 content deduplication on document uploads
- Route parameter validation (app_id regex, doc_id ObjectId, status enum)
- Doc_type allowlist against extraction prompts
- LLM hallucination guardrails in system prompts
- Safety filtering on streaming chat responses
- Officer identity (`officer_id`) on all HITL decisions with immutable audit log
- Borrower-safe context filtering (no `internal_context` exposed to chat)
- Pipeline lock prevents concurrent execution

## Deployment

### Local Development

```bash
docker compose up    # Frontend :3000, Backend :8000
```

### Kubernetes (Kanopy)

Multi-container pod pattern (frontend + backend sidecar). The frontend custom server (`server.mjs`) proxies WebSocket upgrades on `/api/*` paths to the backend sidecar via `http-proxy`. See [KANOPY_DEPLOYMENT_README.md](KANOPY_DEPLOYMENT_README.md).

Environment configs: `environment/staging-combined.yaml`, `environment/production-combined.yaml`

Features: structured JSON logging, health/readiness probes (`/` and `/ready`), graceful Change Stream shutdown, SSE heartbeat (15s), idempotent data ingestion.

## Git Hooks

```bash
chmod +x setup-hooks.sh && ./setup-hooks.sh
```
