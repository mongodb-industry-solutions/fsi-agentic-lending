# Agentic Lending — Frontend

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
├── BorrowerPortal/     # Borrower-facing screens
│   ├── BorrowerPortal.js       # Shell: phase orchestration (select → apply → track) + FloatingChatDrawer
│   ├── BorrowerSelection.js    # Profile picker + HowAIHelpsStrip + interactive DemoFlowCard
│   ├── ApplicationForm.js      # Loan form with validation
│   ├── StatusTracker.js        # Layout shell: SSE subscriptions + stage orchestration
│   ├── statusTrackerConstants.js # AGENT_COLORS, STAGES, ACTION_TO_STAGE_MAP, formatTime
│   ├── ActivityFeed.js         # ActivityItem, ThinkingStrip, ActivityFeed components
│   ├── SavingsSummary.js       # Post-approval animated count-up metrics
│   ├── TimelineStageCard.js    # Single stage card with interventions, actions, expandable details
│   ├── ApplicationAgent.js     # Layout shell: chat UI composition
│   ├── chatConstants.js        # API_BASE, STATUS_SUGGESTIONS, createWelcomeMessage
│   ├── ChatBubbles.js          # MessageBubble, StreamingBubble, TypingIndicator, ContextGathering, CitationCard
│   ├── InterventionCard.js     # Intervention display with urgency escalation timer
│   ├── SuggestedQuestions.js   # Contextual question pill buttons
│   ├── useApplicationChat.js   # Custom hook: chat state, message sending, SSE streaming, interventions
│   ├── DocumentUpload.js       # Document checklist + viewer integration
│   ├── DocumentContext.js      # Document panel with shimmer animation on processing docs
│   └── NotificationFeed.js     # Notification stream component
├── LoanOfficerDashboard/
│   ├── LoanOfficerDashboard.js   # Layout shell: imports + composes sub-components
│   ├── constants.js              # WORKFLOW_STAGES, NODE_TO_STAGE
│   ├── utils.js                  # formatCurrency, getAppDisplayName
│   ├── useLoanOfficerWorkflow.js # Custom hook: all state, SSE/WS, HITL logic, handlers
│   ├── ModifiedParamsBadge.js    # Badge showing modified loan parameters
│   ├── PolicyBoundsIndicator.js  # Visual indicator for policy bounds compliance
│   ├── ManualWorkspace.js        # Manual parameter editing workspace
│   ├── HITLReviewCard.js         # Human-in-the-loop review card
│   ├── PolicyExplorer.js         # Atlas Vector Search with relevance bars and provenance
│   ├── PortfolioIntelligence.js  # Payment trends, severity-tiered EWS, events timeline
│   ├── PortfolioIntelligence.module.css # CSS Module for timeline connectors
│   ├── LiveUnderwritingResults.js # Real-time underwriting metrics overlay
│   ├── StageProgressBar.js       # 3-stage workflow progress indicator
│   ├── ApplicationQueue.js        # Real-time queue (WebSocket), filters, sort, review accent
│   ├── ApplicationDetail.js       # Full/compact app detail + RiskPipelineViz + DocumentSearch
│   ├── AgentActivityLog.js        # SSE activity feed with action-typed borders, metric strip, HITL entry
│   ├── AgentActivityLog.module.css # CSS Module for entry hover/focus-visible
│   ├── IntentPreview.js           # Per-step expand/collapse, dependency connectors, data readiness
│   ├── IntentPreview.module.css   # CSS Module for connector pseudo-selectors (::after)
│   ├── DecisionSummary.js         # ProvenanceChain, audit trail copy, before/after comparison
│   └── AutonomyDial.js            # Placeholder (not active)
├── DemoFlow/           # 6-scene scripted walkthrough + WorkflowCanvas (Canvas 2D graph engine)
├── Header/             # App header with Demo Reset button
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
| `apiPost(path, body, extraHeaders?)` | REST | Create/update (optional custom headers) |
| `apiUpload(path, formData)` | REST | File upload |
| `apiSSE(path, onEvent, onError)` | SSE | Status updates, agent activity, workflow streaming |
| `apiWebSocket(path, onMessage, onError)` | WebSocket | Application queue (Change Stream) |

## Real-Time Data Flows

- **Borrower Status**: SSE via `/applications/{id}/status` + `/applications/{id}/activity`
- **Officer Queue**: WebSocket via `/applications/ws` (MongoDB Change Stream)
- **Officer Workflow**: SSE via `/agent/{id}/run-stream` (starts graph + streams events for HITL detection)
- **Officer Activity Reconnect**: SSE via `/agent/{id}/stream` (activity-only, used after HITL resume)

## Agentic UI Patterns

Components implementing agentic transparency and trust patterns:

| Component | Description |
|-----------|-------------|
| `ContextGathering` | Tool invocation transparency during LLM context build |
| `CitationCard` | Expandable policy RAG citations below messages |
| `ThinkingStrip` | Live agent activity indicator with pulse |
| `InterventionCard` | Action items with urgency escalation and document upload |
| `WorkflowCanvas` | Canvas 2D graph with multi-particle flow, HITL barrier drama, rich tooltips |
| `AgentRailHeader` | AI Agent Layer branding with live pulse and HITL state |
| `PolicyExplorer` | Atlas Vector Search with relevance bars and provenance |
| `PortfolioIntelligence` | Payment trends, severity-tiered EWS, events timeline |
| `LiveUnderwritingResults` | Real-time underwriting metrics overlay |

Custom `@keyframes` in `globals.css` for agentic animations. All respect `prefers-reduced-motion`. WorkflowCanvas uses JS-side `matchMedia` for Canvas 2D animations.

## Styling

- **LeafyGreen UI** (`@leafygreen-ui/*`) — MongoDB design system components and tokens
- **CSS Custom Properties** — defined in root layout (`--text-primary`, `--bg-surface`, `--border-dim`, `--mongo`, `--hitl-amber`, `--success`, `--danger`, `--success-dim`, `--danger-dim`, `--mongo-dim`, `--hitl-amber-dim`, etc.)
- **Inline styles** — intentional for this demo to keep components self-contained
- **CSS Modules** — used only for pseudo-selectors (`:hover`, `:focus-visible`, `::after`, `::before`) that can't be expressed inline
- **CSS `@keyframes`** — defined in `globals.css` for animations. Agentic patterns under "AGENTIC UI PATTERNS" section. All respect `prefers-reduced-motion`.
- **Fonts** — Euclid Circular A (display/body), Source Code Pro (mono)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_BACKEND_URL` | No | Backend URL for API proxy (default: `http://localhost:8000`) |
| `NEXT_PUBLIC_WS_BASE` | No | WebSocket URL (default: auto-detected) |
