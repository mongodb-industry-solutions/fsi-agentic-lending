# LendFlow AI — Agentic Lending Platform

End-to-end agentic lending platform demonstrating how **MongoDB Atlas**, **LangGraph**, and **Voyage AI** work together to automate the full mortgage lifecycle — from application intake through portfolio management.

---

## Solution Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Next.js 15)                         │
│                                                                             │
│   ┌──────────────┐  ┌────────────────────┐  ┌───────────────────────────┐  │
│   │  Borrower    │  │  Loan Officer      │  │  Demo Flow               │  │
│   │  Portal      │  │  Dashboard         │  │  (5 Scenes)              │  │
│   │              │  │                    │  │                           │  │
│   │ • Form       │  │ • Queue (WebSocket)│  │ • Origination            │  │
│   │ • Doc Upload │  │ • Activity (SSE)   │  │ • Decisioning            │  │
│   │ • Status(SSE)│  │ • Autonomy Dial    │  │ • Approval               │  │
│   │ • Viewer     │  │ • HITL Review      │  │ • Funding                │  │
│   └──────┬───────┘  └────────┬───────────┘  │ • Management             │  │
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
│   │   │ 4 autonomy │     │ • Doc verify│     │ • 7-stage    │          │  │
│   │   │ levels     │     │ • Credit    │     │   aggregation│          │  │
│   │   │ • observe  │     │   pull      │     │ • GDS/TDS    │          │  │
│   │   │ • suggest  │     │ • Identity  │     │ • Stress test│          │  │
│   │   │ • bounded  │     │   check     │     │ • Policy RAG │          │  │
│   │   │ • auto     │     │ • LLM       │     │ • Tool use   │          │  │
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
                    │  Autonomy Check:                                 │
                    │  • observe → gate every step                    │
                    │  • suggest → gate before decision               │
                    │  • bounded → gate on policy trigger             │
                    │  • auto → never gate                            │
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

| Capability | How It's Used | Grade |
|-----------|--------------|-------|
| **Document Model** | Loan applications grow through lifecycle stages — one document, no schema migrations | A |
| **Atlas Vector Search** | Policy RAG via Voyage AI multimodal embeddings (voyage-multimodal-3.5) — `queryVector` with pre-computed embeddings | A |
| **Aggregation Framework** | 7-stage risk scoring pipeline ($match→$lookup×2→$addFields×3→$project) | A |
| **Change Streams** | Real-time WebSocket queue + SSE status/activity feeds, labeled in UI | A |
| **Time Series** | Payment history with $setWindowFields (rolling 90-day analysis), EWS signals | A- |
| **MongoDBSaver** | LangGraph checkpoint persistence for HITL interrupt/resume across restarts | A |
| **$graphLookup** | Fraud network visualization (visual demo, backend implementation planned) | B |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), LeafyGreen UI, Euclid Circular A |
| Backend | FastAPI, LangGraph, Python 3.13 |
| Database | MongoDB Atlas (7 collections + 3 LangGraph infra) |
| AI/ML | AWS Bedrock Claude Haiku 4 (tool_use for structured output), Voyage AI multimodal embeddings (voyage-multimodal-3.5) |
| Observability | LangSmith (@traceable on all LLM calls + agent nodes) |
| Deployment | Docker Compose (local), Kanopy/K8s (staging/prod) |

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

### Officer Overrides
Officers can:
- Approve with conditions
- Decline with reason
- **Modify and continue** — override loan_amount or risk_tier, which persists to MongoDB and triggers re-underwriting
- All decisions include `officer_id` for audit trail

### Error Recovery
- `safe_node` wrapper catches agent errors → writes to state → supervisor retries (up to 3x)
- Bedrock calls retry with exponential backoff (throttle/timeout)
- Transient vs permanent error classification
- Application deduplication prevents double-execution

## Demo Screens

### 1. Borrower Portal
Application form with co-applicant fields, document upload (drag-drop with Bedrock Claude extraction), real-time status tracking via SSE with segmented progress rail, "APPROVED" celebration animation.

### 2. Loan Officer Dashboard
Application queue (real-time via WebSocket + MongoDB Change Stream with "Change Streams" badge), agent activity log (SSE), autonomy dial (4 levels), HITL review with approve/decline/modify + officer overrides, intent preview with proceed button.

### 3. Demo Flow
5-scene scripted walkthrough with WorkflowCanvas, capability popovers, educational InfoWizard, collapsible TechRecap. Split-pane document viewer (PDF + extracted JSON). Risk score gauge + FICO ring visualizations.

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

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | MongoDB Atlas connection string |
| `DATABASE_NAME` | Yes | Database name (default: `lendflow`) |
| `CHATCOMPLETIONS_MODEL_ID` | Yes | Bedrock inference profile ARN or model ID |
| `VOYAGE_API_KEY` | Yes | Voyage AI API key for multimodal embeddings |
| `AWS_REGION` | No | AWS region (default: `us-east-1`) |
| `ORIGINS` | No | CORS origins (default: `http://localhost:3000`) |
| `CURRENT_5YR_FIXED_RATE` | No | Mortgage rate (default: `0.0489`) |
| `DECLINE_RISK_SCORE` | No | Auto-decline threshold (default: `80`) |
| `ESCALATE_PURCHASE_PRICE` | No | HITL escalation threshold (default: `500000`) |
| `ESCALATE_GDS` | No | GDS ratio escalation threshold (default: `0.36`) |
| `ESCALATE_TDS` | No | TDS ratio escalation threshold (default: `0.41`) |
| `LANGCHAIN_TRACING_V2` | No | Enable LangSmith tracing (`true`) |
| `LANGCHAIN_API_KEY` | No | LangSmith API key |
| `LANGCHAIN_PROJECT` | No | LangSmith project name |

### Frontend (`frontend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_BACKEND_URL` | No | Backend URL for API proxy (default: `http://localhost:8000`) |
| `NEXT_PUBLIC_WS_BASE` | No | WebSocket URL (default: auto-detected) |

## API Endpoints

### REST (14 endpoints)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/applications` | Create loan application |
| GET | `/api/applications` | List applications (paginated: `?skip=0&limit=50`) |
| GET | `/api/applications/{id}` | Full application with documents + credit reports |
| GET | `/api/applications/{id}/documents` | List documents |
| GET | `/api/applications/{id}/risk-pipeline` | 7-stage aggregation results + stage descriptions |
| GET | `/api/documents/{id}/pdf` | Serve original PDF |
| GET | `/api/documents/{id}/json` | Full MongoDB document JSON |
| POST | `/api/applications/{id}/documents/upload` | Upload + extract document via Bedrock |
| POST | `/api/documents/search` | Atlas Vector Search across documents |
| POST | `/api/policies/search` | Atlas Vector Search across policies |
| POST | `/api/agent/{id}/run` | Trigger agent pipeline (accepts `?autonomy_level=`) |
| POST | `/api/hitl/{id}/decision` | Officer decision (approve/decline/modify + overrides + officer_id) |
| GET | `/api/hitl/{id}/context` | HITL review context (application + activity trail) |
| GET | `/api/portfolio/stats` | Portfolio-level aggregation (active loans, delinquency) |
| GET | `/api/portfolio/payments` | Payment trends with $setWindowFields |
| GET | `/api/portfolio/ews` | Early Warning System signals from time-series |
| GET | `/api/portfolio/events` | Recent events (payments + agent actions) |

### SSE (3 endpoints)
| Path | Description |
|------|-------------|
| GET `/api/applications/{id}/activity` | Stream agent activity (Change Stream) |
| GET `/api/applications/{id}/status` | Stream status changes (Change Stream) |
| GET `/api/agent/{id}/run-stream` | Combined run + stream (LangGraph astream_events) |

### WebSocket (1 endpoint)
| Path | Description |
|------|-------------|
| WS `/api/applications/ws` | Real-time application queue (Change Stream, heartbeat, dead-client detection) |

## MongoDB Collections (7 + 3 infra)

| Collection | Type | Purpose | Key Feature |
|-----------|------|---------|-------------|
| `borrowers` | Standard | Applicant profiles | Polymorphic income sources |
| `applications` | Standard | Loan state machine | Status history with audit trail |
| `documents` | Standard | Extracted PDF data | Voyage AI embeddings for vector search |
| `credit_reports` | Standard | Credit bureau data | Per-borrower scoring, sorted by borrower order |
| `underwriting_policies` | Standard | Policy text for RAG | Voyage AI embeddings, 15 Canadian mortgage rules |
| `payments` | **Time Series** | Payment history | $setWindowFields rolling 90-day analysis |
| `agent_activity` | **Time Series** | Agent action log | Real-time SSE streaming via Change Stream |
| `checkpoints` | LangGraph | Graph state snapshots | MongoDBSaver interrupt/resume |
| `checkpoint_writes` | LangGraph | Write-ahead log | Checkpoint durability |

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
