# LendFlow AI — Frontend

Next.js 15 (App Router, React 19) frontend with LeafyGreen UI, real-time SSE/WebSocket feeds, and three main screens.

## Prerequisites

- Node.js 22+

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Architecture

```
app/
├── layout.js           # Root layout, LeafyGreen provider, CSS custom properties
├── page.js             # Home page with tab navigation (Borrower / Officer / Demo)
└── providers.js        # Client-side providers

components/
├── BorrowerPortal/     # Borrower-facing: profile selection → form → status tracker → AI chat
├── LoanOfficerDashboard/
│   ├── LoanOfficerDashboard.js   # Main dashboard: phase orchestration, SSE/WS, HITL flow
│   ├── ApplicationQueue.js        # Real-time queue (WebSocket), filters, sort, review accent
│   ├── ApplicationDetail.js       # Full/compact app detail + Risk Pipeline Visualization
│   ├── AgentActivityLog.js        # SSE activity feed, search, color-coded by agent
│   ├── IntentPreview.js           # Planned steps with live status overlay
│   ├── DecisionSummary.js         # Post-decision view (timeline, audit trail, violations)
│   └── AutonomyDial.js            # Placeholder (not active)
├── DemoFlow/           # 5-scene scripted walkthrough
├── Header/             # App header
├── educational/        # ContextualBanner, InfoWizard
├── visualizations/     # Risk gauge, FICO ring, charts
├── DocumentViewer.js   # Split-pane PDF + JSON viewer
└── ErrorBoundary.js    # React error boundary

lib/
├── api.js              # API helpers (apiGet, apiPost, apiSSE, apiWebSocket, apiUpload)
├── leafygreen-tokens.js # Design token re-exports
├── data/               # Demo scene data, applicant profiles, capabilities
└── hooks/              # useDemoEngine, useCountUp, useScrollAnimation
```

## API Communication

All HTTP requests go through the Next.js proxy at `/api/backend/*` → FastAPI backend. Use helpers from `lib/api.js`:

| Helper | Transport | Use Case |
|--------|-----------|----------|
| `apiGet(path)` | REST | Fetch data |
| `apiPost(path, body)` | REST | Create/update |
| `apiUpload(path, formData)` | REST | File upload |
| `apiSSE(path, onEvent, onError)` | SSE | Status updates, agent activity, workflow streaming |
| `apiWebSocket(path, onMessage, onError)` | WebSocket | Application queue (Change Stream) |

## Real-Time Data Flows

- **Borrower Status**: SSE via `/applications/{id}/status` + `/applications/{id}/activity`
- **Officer Queue**: WebSocket via `/applications/ws` (MongoDB Change Stream)
- **Officer Workflow**: SSE via `/agent/{id}/run-stream` (starts graph + streams events for HITL detection)
- **Officer Activity Reconnect**: SSE via `/agent/{id}/stream` (activity-only, used after HITL resume)

## Styling

- **LeafyGreen UI** (`@leafygreen-ui/*`) — MongoDB design system components and tokens
- **CSS Custom Properties** — defined in root layout (`--text-primary`, `--bg-surface`, `--border-dim`, `--mongo`, `--hitl-amber`, `--success`, `--danger`, etc.)
- **Inline styles** — intentional for this demo to keep components self-contained
- **Fonts** — Euclid Circular A (display/body), Source Code Pro (mono)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_BACKEND_URL` | No | Backend URL for API proxy (default: `http://localhost:8000`) |
| `NEXT_PUBLIC_WS_BASE` | No | WebSocket URL (default: auto-detected) |
