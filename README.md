# Agentic Lending Platform

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
│   │ • AI Chat    │  │ • Interventions    │  │ • Closing                │  │
│   │              │  │                    │  │ • Funding                │  │
│   └──────┬───────┘  └────────┬───────────┘  │ • Servicing              │  │
│          │                   │              └───────────────────────────┘  │
│          └───────────┬───────┘                                             │
│                      │  REST / SSE / WebSocket                             │
└──────────────────────┼─────────────────────────────────────────────────────┘
                       │
┌──────────────────────┼─────────────────────────────────────────────────────┐
│                      ▼       BACKEND (FastAPI)                             │
│                                                                             │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                    LangGraph Agent Pipeline                          │  │
│   │                                                                      │  │
│   │   ┌────────────┐     ┌─────────────┐     ┌──────────────┐          │  │
│   │   │ Supervisor │────▶│ Loan App    │────▶│ Underwriter  │          │  │
│   │   │ (routing)  │◀────│ Agent       │     │ Agent        │          │  │
│   │   │            │     │             │     │              │          │  │
│   │   │ Bounded    │     │ • Doc verify│     │ • 7-stage    │          │  │
│   │   │ autonomy   │     │ • Credit    │     │   aggregation│          │  │
│   │   │ (act within│     │   pull      │     │ • GDS/TDS    │          │  │
│   │   │  limits)   │     │ • Identity  │     │ • Stress test│          │  │
│   │   │            │     │   check     │     │ • Policy RAG │          │  │
│   │   │            │     │ • LLM       │     │ • Tool use   │          │  │
│   │   └─────┬──────┘     │   analysis  │     │ • Structured │          │  │
│   │         │            └─────────────┘     │   output     │          │  │
│   │         │                                └──────┬───────┘          │  │
│   │         │                                       │                  │  │
│   │         ▼                                       ▼                  │  │
│   │   ┌────────────┐                         ┌──────────────┐          │  │
│   │   │ HITL Gate  │◀────────────────────────│ Decision     │          │  │
│   │   │            │                         │ Logic        │          │  │
│   │   │ interrupt()│     Officer reviews:    │              │          │  │
│   │   │ + resume   │     • Approve           │ • Risk score │          │  │
│   │   │            │     • Decline           │ • OSFI B-20  │          │  │
│   │   │ MongoDBSaver     • Modify + continue │ • Policy     │          │  │
│   │   │ checkpoints│     • Override terms     │   thresholds │          │  │
│   │   └────────────┘                         └──────────────┘          │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│   ┌────────────┐  ┌────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│   │ Bedrock    │  │ LangSmith  │  │ Extraction   │  │ PDF Serve       │  │
│   │ Claude     │  │ @traceable │  │ Service      │  │ + Upload        │  │
│   │ Haiku 4    │  │ traces     │  │ (Converse    │  │                  │  │
│   │ + tool_use │  │            │  │  API + PDF)  │  │                  │  │
│   └────────────┘  └────────────┘  └──────────────┘  └──────────────────┘  │
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
│   └─────────────┘  └──────────────┘  └────────────────┘  └──────────────┘ │
│                                                                             │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                    │
│   │ Time Series  │  │ MongoDBSaver │  │ $graphLookup  │                    │
│   │ Collections  │  │ Checkpoints  │  │ (Fraud Net)   │                    │
│   │              │  │              │  │              │                    │
│   │ payments     │  │ checkpoints  │  │ Visual demo  │                    │
│   │ agent_activity│ │ chkpt_writes │  │ (future)     │                    │
│   │ + $setWindow │  │              │  │              │                    │
│   └──────────────┘  └──────────────┘  └──────────────┘                    │
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
                    │  Autonomy: Bounded                                │
                    │  • Autonomous for standard checks               │
                    │  • HITL gate on policy triggers and             │
                    │    high-risk decisions                           │
                    │                                                  │
                    │  Retry Check:                                    │
                    │  • last_error + retry_count < 3 → retry         │
                    │  • max retries → error terminal                  │
                    │                                                  │
                    │  Routing:                                        │
                    │  • docs not verified → loan_app                 │
                    │  • risk_score null → underwriter                │
                    │  • decision=escalate → hitl_gate                │
                    │  • decision=approve/decline → complete           │
                    └──┬───────────┬───────────┬──────────┬───────────┘
                       │           │           │          │
          ┌────────────▼──┐  ┌────▼────────┐  │  ┌───────▼───────┐
          │  LOAN APP     │  │ UNDERWRITER │  │  │   COMPLETE    │
          │  AGENT        │  │ AGENT       │  │  │               │
          │               │  │             │  │  │ Log pipeline  │
          │ 1. Fetch docs │  │ 1. Run 7-   │  │  │ complete      │
          │ 2. Verify IDs │  │    stage     │  │  │ Set completed │
          │ 3. Pull credit│  │    aggreg.   │  │  │ _at timestamp │
          │ 4. LLM analyze│  │ 2. GDS/TDS  │  │  └───────────────┘
          │ 5. Update     │  │ 3. Stress   │  │
          │    status     │  │    test     │  │
          └───────┬───────┘  │ 4. Policy   │  │
                  │          │    RAG      │  │
                  │          │ 5. Tool use │  │
                  │          │    (struct  │  │
                  │          │    output)  │  │
                  │          │ 6. Decision │  │
                  │          └──────┬──────┘  │
                  │                 │         │
                  │                 │    ┌────▼──────────┐
                  │                 │    │  HITL GATE    │
                  │                 │    │               │
                  │                 │    │ interrupt()   │
                  └────► SUPERVISOR ◄───│ ──► pause     │
                                        │               │
                                        │ Officer:      │
                                        │ • approve     │
                                        │ • decline     │
                                        │ • modify +    │
                                        │   continue    │
                                        │ • override    │
                                        │   terms       │
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
| **$graphLookup**          | Fraud network visualization (visual demo, backend implementation planned)                                                         | B     |

## Tech Stack

| Layer         | Technology                                                                                                           |
| ------------- | -------------------------------------------------------------------------------------------------------------------- |
| Frontend      | Next.js 15 (App Router), LeafyGreen UI, Euclid Circular A, custom `uiTokens` design tokens                           |
| Backend       | FastAPI, LangGraph, Python 3.13                                                                                      |
| Database      | MongoDB Atlas (7 collections + 3 LangGraph infra)                                                                    |
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

### OSFI B-20 Stress Test

Every application is stress-tested at `max(contract_rate + 2%, 5.25%)`. Explicit pass/fail with GDS/TDS at the stress rate. Failure → automatic decline with regulatory reason.

### Intervention Pipeline

Pipeline agents create typed interventions that surface as borrower-facing action cards in the AI chat:

- `stress_test_failure` — OSFI B-20 stress test failed (blocking)
- `income_data_required` — combined income is zero/missing (blocking)
- `credit_score_required` — primary credit score unavailable (blocking)
- `credit_data_unavailable` — credit bureau data not retrieved (advisory)
- `missing_document` / `additional_info_required` — document gaps

Interventions include separate `internal_context` (for officer/pipeline use) and `borrower_context` (safe to display in chat). Resolution flows through the chat endpoint.

### Application Agent (AI Chat)

Context-aware conversational assistant for borrowers:

- Streaming markdown responses via SSE with tool transparency (tool_call events during context gathering)
- Intervention awareness — surfaces pending action items as in-chat cards with urgency escalation (pulse animation + elapsed timer after 30s)
- Contextual suggested questions that adapt to application status phase
- Policy RAG citations surfaced as expandable reference cards below assistant messages
- Floating pre-application chat drawer available during profile selection and form phases
- Conversation persistence in MongoDB `conversations` collection
- Safety-filtered responses (PII, loan-specific guardrails)

### Officer Overrides (HITL)

Officers can:

- **Approve** with optional conditions
- **Decline** with reason (surfaces policy violations in Decision Summary)
- **Modify and continue** — override loan amount, risk tier, or add conditions. Sends `modify_and_continue` action with `overrides` and `conditions` to the backend, persists to MongoDB, resets HITL state, and reconnects to the SSE activity stream to resume the pipeline with re-underwriting.
- All decisions include `officer_id` for audit trail
- HITL context is auto-fetched when an application enters review (no manual "Request Context" step)

### Error Recovery

- `safe_node` wrapper catches agent errors → writes to state → supervisor retries (up to 3x)
- Bedrock calls retry with exponential backoff (throttle/timeout)
- Transient vs permanent error classification
- Application deduplication prevents double-execution

## Demo Screens

### 1. Borrower Portal

Phase-based flow: **profile selection → application form → real-time tracking**.

- **Borrower Selection** — seeded demo profiles with key stat badges (combined income, LTV ratio, credit score), a "How AI Helps" before/after comparison strip, and an interactive demo-flow explainer with expandable technology details per step.
- **Application Form** — co-applicant fields, amortization calculator, hybrid read-only / editable sections, client-side validation with inline error states via LeafyGreen `TextInput`.
- **Status Tracker** — 9-stage timeline driven by SSE (`/applications/{id}/status`) with live `ThinkingStrip` showing agent activity in real-time, confidence badges on completed stages (e.g., "N resolved by AI", "Document verified"), staggered before/after metric reveals, `completionBurst` animations, and a post-approval `SavingsSummary` card with animated count-up metrics.
- **Document Context** — document checklist with status polling, shimmer animation on processing documents, PDF + extracted JSON split-pane viewer.
- **Application Agent (AI Chat)** — streaming markdown responses with tool transparency (`ContextGathering` component shows each tool being invoked during context build), policy RAG citations as expandable reference cards, contextual suggested questions adapting to application status, intervention action cards with urgency escalation (pulse + elapsed timer after 30s), conversation history persistence.
- **Floating Chat Drawer** — pre-application chat bubble available during profile selection and form phases for general questions.
- **Intervention Pipeline** — backend agents create typed interventions (stress test failure, income data required, credit score required, credit data unavailable) that surface as borrower-facing action cards in the chat.
- **Demo Reset** — header button (visible when a session exists) resets the demo with confirmation modal.

### 2. Loan Officer Dashboard

Full-featured officer workspace with real-time data flows and human-in-the-loop decisioning.

- **Application Queue** — real-time via WebSocket + MongoDB Change Stream. Filterable by status (All / Pending Review / Processing / Completed), sortable (Newest First / Needs Attention), with amber accent on applications awaiting review and a review-count badge.
- **Application Detail** — comprehensive view of selected application: borrower info, income summary, loan terms, property details, risk assessment (score, tier, GDS/TDS), credit reports, and document list with status badges. Compact mode for inline display during processing. Includes expandable **Risk Pipeline Visualization** showing the 7-stage MongoDB aggregation pipeline with per-stage operator and description. **Document Search** panel for semantic search across application documents via Atlas Vector Search.
- **Live Underwriting Results** — real-time metrics overlay during processing, powered by captured `node_complete` SSE output. Shows document count, credit score, risk score with tier badge, GDS/TDS ratios, and stress test pass/fail as each pipeline stage completes.
- **Stage Progress Bar** — 4-stage progress indicator (Origination → Underwriting → Closing → HITL) with animated transitions, elapsed durations per stage, and stage-start timestamps. Sits between the compact detail bar and the workflow canvas.
- **Agent Activity Log** — real-time SSE feed of agent actions with search filtering, color-coded by agent, auto-scroll with manual override. Compact/detailed view mode toggle, action-type badges (DATA, COMPUTE, SEARCH, DECIDE, ALERT), pause/resume stream with buffer count badge, and entry count cap display.
- **Policy Explorer** — collapsible panel for Atlas Vector Search across lending policies (underwriting guidelines, OSFI B-20, etc.). Officers can query policy text and see relevant matches with relevance scores.
- **Portfolio Intelligence** — collapsible panel with lazy-loaded payment trends, Early Warning System (EWS) signals, and recent portfolio events. Auto-fetches a sample loan if no specific loan is selected, with retry-on-failure.
- **Intent Preview** — agent's planned execution steps with per-step expand/collapse editing, dependency connectors via CSS Module pseudo-selectors, data availability indicators ("3/3 inputs"), dynamically computed total estimate, visual hierarchy (green border for complete steps, strikethrough for disabled), and a proceed button to launch the pipeline.
- **HITL Review** — auto-fetched review context, structured risk factor rows with pass/fail badges, GDS/TDS ThresholdBar visualizations, restructured 3-part agent reasoning card. Approve/decline/modify actions with officer overrides (loan amount, risk tier, conditions). Modified terms trigger `modify_and_continue` with re-underwriting via SSE reconnection.
- **Decision Summary** — rich post-decision view with decision provenance chain (horizontal Agent → Officer → Final flow with timestamps), "Copy Audit Trail" button (serializes to JSON with inline "Copied!" feedback), before/after comparison for modified decisions highlighting changes in rate, amount, and conditions. Shows decision type, key metrics, policy violations for declines, stage timeline, and full expandable audit trail.
- **Dashboard Stats & Layout** — stats bar with trend arrows (↑/↓ computed from previous counts), average processing time metric, elapsed timer during execution. Improved idle state with mini pipeline sketch, dynamic pending application count, and contextual prompts.
- **Portfolio Stats** — fetched from `GET /portfolio/stats` on mount, merged into the dashboard stats bar (total portfolio value, active loans, delinquency rate).
- **Status-Aware Phase Initialization** — selecting an application reads its queue status to initialize the correct UI phase (preview, executing, HITL review, or decision summary) without race conditions. Uses refs to avoid spurious re-renders from unrelated queue updates.

### 3. Demo Flow

6-scene scripted walkthrough demonstrating the full lending lifecycle with a streamlined, enterprise-clarity design.

- **SceneNavBar** — scene navigation pills with progress connectors, capability counter Badge (`N/7 capabilities`), single-click speed cycle button, Play/Pause/Step/Back/Reset controls.
- **WorkflowCanvas** — animated node graph showing data flow between agents and MongoDB capabilities. Softened glow oscillations, single particle per active edge, no grid lines for a clean backdrop.
- **AnnotationOverlay** — compact step annotation bar with progress dots, agent name + description, clickable capability badges with educational popovers, and collapsible reasoning text.
- **PipelineDrawer** — slide-out activity log (right edge toggle, Escape to close, `aria-expanded` for accessibility) replacing the previous always-visible sidebar, freeing full-width for scene content.
- **Origination Scene** — multi-document extraction (CRA Notice, Bank Statement, Pay Stub) with progressive field reveal, tab switcher with aggregate confidence Badges, Open Banking headline metrics, and collapsible Cross-Validation and Profile Output via ExpandableCards.
- **Underwriting Scene** — risk ring SVG gauge, top-5 factor bars with positive/negative layout, counterfactual explainer, and consolidated Compliance & Validation ExpandableCard (7/7 pass). Fraud network visualization via `$graphLookup` with FraudGraph takeover.
- **Approval Scene** — HITL review card with Badge-based tier indicator, Approve/Modify/Decline controls, collapsible Repayment Schedule and Regulatory Disclosures via ExpandableCards. Post-approval loan terms grid with amortization summary.
- **Closing Scene** — Closing Timeline with workflow canvas: approval detection, closing package (TILA, RESPA), compliance checks (TILA / RESPA / OSFI), and e-sign completion before funding.
- **Funding Scene** — disbursement timeline with 4-step document evolution overview (colored dots + field counts), collapsible full Document Evolution ExpandableCard, and double-entry accounting table.
- **Servicing Scene** — portfolio stats grid (4-column), top-3 Early Warning System signals, live event feed (3.5s interval), and 4-step renewal intervention card. Real-time data fetched from `/portfolio/stats`.
- **Design System** — centralized `uiTokens.js` module with surface colors, borders, shadows, and transition curves. All transitions standardized to 150ms (fast) / 220ms (medium) with `cubic-bezier(0.33, 1, 0.68, 1)`. Data visualization transitions use 400–600ms with the same easing. `@media (prefers-reduced-motion: reduce)` respected globally.

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
uv run python -m scripts.ingest_pdfs       # Ingest 14 synthetic PDFs + seed payments
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

### REST (24 endpoints)

| Method | Path                                         | Description                                                                             |
| ------ | -------------------------------------------- | --------------------------------------------------------------------------------------- |
| POST   | `/api/applications`                          | Create loan application                                                                 |
| GET    | `/api/applications`                          | List applications (paginated: `?skip=0&limit=50`)                                       |
| GET    | `/api/applications/{id}`                     | Full application with documents + credit reports                                        |
| GET    | `/api/applications/{id}/documents`           | List documents                                                                          |
| GET    | `/api/applications/{id}/risk-pipeline`       | 7-stage aggregation results + stage descriptions                                        |
| GET    | `/api/documents/{id}/pdf`                    | Serve original PDF                                                                      |
| GET    | `/api/documents/{id}/json`                   | Full MongoDB document JSON                                                              |
| POST   | `/api/applications/{id}/documents/upload`    | Upload + extract document via Bedrock                                                   |
| POST   | `/api/documents/search`                      | Atlas Vector Search across documents (supports `application_id` filter)                 |
| POST   | `/api/policies/search`                       | Atlas Vector Search across policies                                                     |
| POST   | `/api/agent/{id}/run`                        | Trigger agent pipeline                                                                  |
| POST   | `/api/hitl/{id}/decision`                    | Officer decision (approve/decline/modify + overrides + officer_id)                      |
| GET    | `/api/hitl/{id}/context`                     | HITL review context (application + activity trail)                                      |
| POST   | `/api/chat/{id}/message`                     | Send chat message to Application Agent                                                  |
| POST   | `/api/chat/{id}/message/stream`              | Streaming chat (SSE with tool_call events + citations in done event)                    |
| GET    | `/api/chat/{id}/history`                     | Chat conversation history                                                               |
| GET    | `/api/chat/{id}/interventions`               | Pending interventions (borrower-safe fields)                                            |
| POST   | `/api/chat/{id}/interventions/{iid}/resolve` | Acknowledge/resolve an intervention                                                     |
| POST   | `/api/chat/general/message`                  | General chat (pre-application, used by FloatingChatDrawer)                              |
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
| GET `/api/agent/{id}/stream`          | Activity-only stream — used by AgentActivityLog for reconnection after HITL resume                                     |

### WebSocket (1 endpoint)

| Path                      | Description                                                                   |
| ------------------------- | ----------------------------------------------------------------------------- |
| WS `/api/applications/ws` | Real-time application queue (Change Stream, heartbeat, dead-client detection) |

## MongoDB Collections (9 + 3 infra)

| Collection              | Type            | Purpose                           | Key Feature                                                                    |
| ----------------------- | --------------- | --------------------------------- | ------------------------------------------------------------------------------ |
| `borrowers`             | Standard        | Applicant profiles                | Polymorphic income sources                                                     |
| `applications`          | Standard        | Loan state machine                | Status history with audit trail                                                |
| `documents`             | Standard        | Extracted PDF data                | Voyage AI embeddings for vector search                                         |
| `credit_reports`        | Standard        | Credit bureau data                | Per-borrower scoring, sorted by borrower order                                 |
| `underwriting_policies` | Standard        | Policy text for RAG               | Voyage AI embeddings, 15 Canadian mortgage rules                               |
| `conversations`         | Standard        | Application Agent chat history    | Per-application message persistence (borrower PII — separate retention policy) |
| `interventions`         | Standard        | Pipeline-to-borrower action items | Typed interventions created by pipeline agents, surfaced in chat               |
| `payments`              | **Time Series** | Payment history                   | $setWindowFields rolling 90-day analysis                                       |
| `agent_activity`        | **Time Series** | Agent action log                  | Real-time SSE streaming via Change Stream                                      |
| `checkpoints`           | LangGraph       | Graph state snapshots             | MongoDBSaver interrupt/resume                                                  |
| `checkpoint_writes`     | LangGraph       | Write-ahead log                   | Checkpoint durability                                                          |

## Security

- Pre-commit hook scans for secrets (`./setup-hooks.sh`)
- PDF uploads validated (content-type + `%PDF` magic bytes + filename sanitization via PurePosixPath)
- Route parameter validation (app_id regex, doc_id ObjectId, status enum)
- Doc_type allowlist against extraction prompts
- LLM hallucination guardrails in system prompts
- Officer identity (`officer_id`) on all HITL decisions

## Deployment

### Local Development

```bash
docker compose up    # Frontend :3000, Backend :8000
```

### Kubernetes (Kanopy)

Multi-container pod pattern (frontend + backend sidecar). See [KANOPY_DEPLOYMENT_README.md](KANOPY_DEPLOYMENT_README.md).

Environment configs: `environment/staging.yaml`, `environment/production.yaml`

Features: structured JSON logging, health/readiness probes (`/` and `/ready`), graceful Change Stream shutdown, SSE heartbeat (15s), idempotent data ingestion.

## Git Hooks

```bash
chmod +x setup-hooks.sh && ./setup-hooks.sh
```
