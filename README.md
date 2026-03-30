# LendFlow AI — Agentic Lending Demo

End-to-end agentic lending platform demonstrating how MongoDB Atlas, LangGraph, and Voyage AI work together to automate the full loan lifecycle — from origination through management.

## Where MongoDB Shines

- **Document Model** — Loan applications, extracted fields, embeddings, and validation results in a single flexible document
- **Aggregation Framework** — 7-stage real-time risk scoring pipeline
- **$graphLookup** — Recursive fraud network detection across 3 hops
- **Change Streams** — Real-time event-driven workflow orchestration
- **Time Series Collections** — Payment history tracking with rolling delinquency analysis
- **Atlas Vector Search** — Policy RAG via voyage-multimodal-3.5 embeddings

## High Level Architecture

```
Borrower → [Application Agent] → [Underwriting Agent] → [HITL Gate] → [Funding] → [Renewal Agent]
                  │                       │                    │                         │
                  └───── MongoDB Atlas (Document Model + Vector Search + Change Streams) ─┘
```

Orchestration: LangGraph (interrupt/resume, MongoDBSaver checkpoints, MongoDBStore memory)
Observability: LangSmith (full trace capture, latency profiling)
AI Models: Claude 3.5 Sonnet (reasoning) + voyage-multimodal-3.5 (multimodal embeddings)

## Tech Stack

- [Next.js 15](https://nextjs.org) App Router for the frontend
- [MongoDB Atlas](https://www.mongodb.com/atlas/database) for the database
- [LeafyGreen UI](https://www.mongodb.design/) for MongoDB-branded components
- [FastAPI](https://fastapi.tiangolo.com/) + [LangGraph](https://langchain-ai.github.io/langgraph/) for the backend
- [LangSmith](https://smith.langchain.com/) for observability

## Prerequisites

Before you begin, ensure you have met the following requirements:

- Python 3.13 (but less than 3.14)
- Node.js 22 or higher
- uv (install via [uv's official documentation](https://docs.astral.sh/uv/getting-started/installation/))

## Run it Locally

### Backend

1. (Optional) Set your project description and author information in the `pyproject.toml` file:
   ```toml
   description = "LendFlow AI Agentic Lending"
   authors = ["Your Name <you@example.com>"]
   ```
2. Open the project in your preferred IDE.
3. Open the Terminal.
4. Ensure you are in the root project directory where the `makefile` is located.
5. Execute the following commands:
   ```bash
   make uv_init
   make uv_sync
   ```
6. Verify that the `.venv` folder has been generated within the `/backend` directory.

### Running Backend Locally

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Start the FastAPI development server:
   ```bash
   uv run uvicorn main:app --host 0.0.0.0 --port 8000
   ```
3. The backend API will be accessible at http://localhost:8000

**Note**: If port 8000 is already in use (e.g., by Docker containers), either stop the containers with `make clean` or use a different port like `--port 8001`.

### Frontend

1. Navigate to the `frontend` folder.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. The frontend will be accessible at http://localhost:3000

## Run with Docker

From the root directory:

1. Build and run:
   ```bash
   make build
   ```
2. Clean up:
   ```bash
   make clean
   ```

## Demo Screens

1. **Borrower Portal** — The loan applicant experience: application form, document upload, real-time status tracking with AI interventions
2. **Loan Officer Dashboard** — The officer workflow: application queue, agent activity log, autonomy dial (Observe → Suggest → Bounded → Full Auto), HITL review
3. **Demo Flow** — Scripted walkthrough of the 5-scene lending lifecycle: Origination → Decisioning → Approval → Funding → Management

## Git Hooks Setup (Recommended)

This repository includes a pre-commit hook that automatically scans for secrets and credentials before each commit, preventing accidental exposure of sensitive data.

**Setup (run once after cloning):**

```bash
chmod +x setup-hooks.sh
./setup-hooks.sh
```

This configures Git to use the `.githooks` directory and enables the pre-commit security scanner.

## Kanopy Deployment

For deploying to Kanopy (MongoDB's internal Kubernetes platform), see the [KANOPY_DEPLOYMENT_README.md](KANOPY_DEPLOYMENT_README.md) for detailed instructions.
