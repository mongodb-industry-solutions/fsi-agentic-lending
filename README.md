# LendFlow AI — Agentic Lending Platform

End-to-end agentic lending platform demonstrating how **MongoDB Atlas**, **LangGraph**, and **Voyage AI** work together to automate the full mortgage lifecycle — from application intake through portfolio management.

## Architecture

```
Borrower Portal ─────► FastAPI Backend ─────► MongoDB Atlas
                            │
Loan Officer Dashboard ◄──  │  ──► LangGraph Agent Pipeline
                            │         │
Demo Flow ◄────────────     │    Supervisor ──► Loan App Agent
                            │         │              │
                            │    Underwriter ◄───────┘
                            │         │
                            │    HITL Gate (interrupt/resume)
                            │         │
                            │    MongoDBSaver (checkpoints)
                            │
                       LangSmith (observability)
```

### Where MongoDB Shines

| Capability | How It's Used |
|-----------|--------------|
| **Document Model** | Loan applications, extracted fields, and validation in one flexible document |
| **Atlas Vector Search** | Policy RAG via Voyage AI automated embeddings (autoEmbed) |
| **Aggregation Framework** | Real-time risk scoring pipeline (GDS/TDS/stress test) |
| **$graphLookup** | Recursive fraud network detection across 3 hops |
| **Change Streams** | Real-time SSE + WebSocket feeds for status tracking and application queue |
| **Time Series Collections** | Agent activity logging with time-based queries |

### Agent System

The backend uses a **LangGraph supervisor pattern** with 4 autonomy levels:

| Level | Behavior |
|-------|----------|
| **Observe** | Every agent step pauses for officer approval |
| **Suggest** | Agent runs, pauses before final decision for review |
| **Bounded** | Auto-processes, escalates to officer only on policy triggers |
| **Full Auto** | Fully autonomous — no human intervention |

Agents: **Loan Application Agent** (document processing, credit pull) and **Underwriting Agent** (GDS/TDS calculation, stress test, risk scoring, policy RAG).

HITL uses LangGraph `interrupt()` with **MongoDBSaver** checkpoints — the officer can approve, decline, or modify terms and continue.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), LeafyGreen UI, Euclid Circular A |
| Backend | FastAPI, LangGraph, Python 3.13 |
| Database | MongoDB Atlas (Document Model, Vector Search, Change Streams, Time Series) |
| AI/ML | AWS Bedrock (Claude Haiku 4), Voyage AI (autoEmbed via Atlas) |
| Observability | LangSmith (auto-instrumented via @traceable) |
| Package Manager | uv (Python), npm (Node.js) |

## Demo Screens

### 1. Borrower Portal
Application form (pre-filled for Marcus & Sofia Delgado, $875K Calgary mortgage), document upload with drag-drop + Bedrock Claude extraction, real-time status tracking via SSE.

### 2. Loan Officer Dashboard
Application queue (real-time via WebSocket + MongoDB Change Stream), agent activity log (SSE), autonomy dial, HITL review with approve/decline/modify, intent preview.

### 3. Demo Flow
5-scene scripted walkthrough: Origination, Decisioning, Approval, Funding, Management. Includes WorkflowCanvas architecture visualization, capability popovers, educational InfoWizard panel.

## Prerequisites

- Python 3.13+
- Node.js 22+
- [uv](https://docs.astral.sh/uv/getting-started/installation/)
- MongoDB Atlas cluster (M10+ for Change Streams, or M0 without real-time features)
- AWS credentials with Bedrock access (Claude Haiku 4)
- (Optional) Voyage AI API key configured at Atlas project level for autoEmbed
- (Optional) LangSmith API key for observability

## Quick Start

### 1. Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env with your MongoDB URI, Bedrock model ID, etc.
```

Install dependencies:
```bash
make uv_init
make uv_sync
```

Create MongoDB collections and indexes:
```bash
uv run python -m scripts.create_indexes
```

Ingest the 14 synthetic borrower documents (uses Bedrock Claude):
```bash
uv run python -m scripts.ingest_pdfs
```

Start the API server:
```bash
uv run uvicorn main:app --host 0.0.0.0 --port 8000
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

The frontend works in two modes:
- **Standalone**: Demo flow + hardcoded data when backend is unavailable
- **Connected**: Real-time data, document upload, agent execution, SSE/WebSocket when backend is running

### 3. Docker (Alternative)

```bash
make build        # Build and start both services
make clean        # Stop and remove containers
```

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | MongoDB Atlas connection string |
| `DATABASE_NAME` | Yes | Database name (default: `lendflow`) |
| `APP_NAME` | No | Application name for connection pooling |
| `CHATCOMPLETIONS_MODEL_ID` | Yes | Bedrock inference profile ARN or model ID |
| `AWS_REGION` | No | AWS region (default: `us-east-1`) |
| `AWS_PROFILE` | No | AWS profile name |
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
| `NEXT_PUBLIC_WS_BASE` | No | WebSocket URL for production (default: auto-detected from hostname) |

## API Endpoints

### REST
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/applications` | Create loan application |
| GET | `/api/applications` | List all applications |
| GET | `/api/applications/{id}` | Get application with documents + credit reports |
| GET | `/api/applications/{id}/documents` | List documents |
| GET | `/api/documents/{id}/pdf` | Serve original PDF |
| GET | `/api/documents/{id}/json` | Full MongoDB document JSON |
| POST | `/api/applications/{id}/documents/upload` | Upload + extract document |
| POST | `/api/documents/search` | Vector search across documents |
| POST | `/api/policies/search` | Vector search across policies |
| POST | `/api/agent/{id}/run` | Trigger agent pipeline |
| POST | `/api/hitl/{id}/decision` | Submit officer decision (approve/decline/modify) |
| GET | `/api/hitl/{id}/context` | Get HITL review context |

### SSE (Server-Sent Events)
| Path | Description |
|------|-------------|
| GET `/api/applications/{id}/activity` | Stream agent activity |
| GET `/api/applications/{id}/status` | Stream status changes |
| GET `/api/agent/{id}/run-stream` | Combined run + stream (astream_events) |

### WebSocket
| Path | Description |
|------|-------------|
| WS `/api/applications/ws` | Real-time application queue (Change Stream) |

## Synthetic Data

14 PDF documents for a Canadian mortgage application (Marcus & Sofia Delgado, $875K Calgary home):

| Document | Content |
|----------|---------|
| Government IDs | Alberta IDs for both applicants |
| Employment Letters | TechNova Systems ($128.5K) + Covenant Health ($94.2K) |
| Pay Stubs (6) | 3 recent per applicant |
| CRA Tax Notices | Notices of Assessment (2023-2024) |
| Bank Statements | TD joint chequing, 3 months |
| Purchase Agreement | $875K Calgary home, 20% down |
| Investment Statements | TD Wealth ($182K) |
| Existing Property | Edmonton condo ($412K, rented $2.2K/mo) |
| Mortgage Application | Axiom Mortgage form |
| Utility Bills | EPCOR, ATCO, Shaw |
| Credit Reports | Equifax: Marcus 784, Sofia 761 |
| Car Loan | Scotiabank RAV4 ($18.2K remaining) |
| Property Tax | Calgary $6,815/yr |
| Property Inspection | PillarToPost — good condition |

## MongoDB Collections

| Collection | Purpose | Key Feature |
|-----------|---------|-------------|
| `borrowers` | Applicant profiles | Polymorphic income sources |
| `applications` | Loan state machine | Status history with audit trail |
| `documents` | Extracted PDF data | Atlas autoEmbed for vector search |
| `credit_reports` | Credit bureau data | Per-borrower scoring |
| `underwriting_policies` | Policy text for RAG | Atlas autoEmbed for semantic search |
| `agent_activity` | Agent action log | Time-series collection |

Plus 3 LangGraph infrastructure collections: `checkpoints`, `checkpoint_writes`, `store`.

## Security

- Pre-commit hook scans for secrets (`./setup-hooks.sh`)
- PDF uploads validated (content-type + magic bytes + filename sanitization)
- Route parameter validation (app_id regex, doc_id ObjectId)
- Application status enum enforcement

## Kanopy Deployment

See [KANOPY_DEPLOYMENT_README.md](KANOPY_DEPLOYMENT_README.md) for MongoDB's internal Kubernetes deployment.

## Git Hooks

```bash
chmod +x setup-hooks.sh
./setup-hooks.sh
```
