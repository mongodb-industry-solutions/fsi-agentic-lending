/**
 * Structured narrative copy from Challenge, MongoDB Platform, and Architecture tabs
 * (agentic-lending). Used by Next.js pages/components.
 */

export const challengeContent = {
  pageTitle: 'The Problem',
  pageIntro:
    'Traditional lending architectures are fragmented and complex. Every handoff is a system boundary.',

  heroStats: [
    {
      key: 'decisionTime',
      label: 'Average decision time',
      display: '45+',
      suffix: ' days',
      suffixAfter: true,
    },
    {
      key: 'systems',
      label: 'Systems in a typical stack',
      display: '5+',
      suffix: '',
      suffixAfter: false,
    },
    {
      key: 'costPerLoan',
      label: 'Cost per loan',
      display: '$8,500',
      suffix: '',
      suffixAfter: false,
    },
  ],

  problemPoints: [
    {
      id: 'lifecycle-overview',
      title: 'The lending lifecycle',
      body:
        'Every digital loan flows through 5 stages. Each stage consumes different structured and unstructured data — traditionally requiring separate databases for each type.',
    },
    {
      id: 'lifecycle-problem',
      title: 'Data sprawl',
      body:
        'Traditional architectures use separate databases for relational data, documents, time series, vectors, graphs, and event streams. That means 7+ databases, constant ETL, and data that is always slightly out of date.',
    },
    {
      id: 'fragmented-stack',
      title: 'The fragmented stack',
      body:
        '5–7 technology types in a typical lending architecture. Each connection is a data sync, ETL pipeline, or API gateway to build and maintain.',
    },
    {
      id: 'legacy-day1-intake',
      day: 'Day 1',
      label: 'Application intake',
      tech: 'Relational DB insert',
      cost: '2–4 hrs manual data entry per application',
    },
    {
      id: 'legacy-overnight',
      day: 'Day 1–2',
      label: 'Overnight credit pull',
      tech: 'Batch job',
      cost: '23 document types avg per mortgage file',
    },
    {
      id: 'legacy-doc-review',
      day: 'Day 2',
      label: 'Manual document review',
      tech: 'Separate document store',
      cost: 'Up to 8 hrs to draft a single credit memo',
    },
    {
      id: 'legacy-committee',
      day: 'Day 2–3',
      label: 'Committee underwriting',
      tech: 'Spreadsheet models',
      cost: 'Only 10% of files sampled for QC',
    },
    {
      id: 'legacy-approval',
      day: 'Day 3',
      label: 'Approval letter',
      tech: 'Final system',
      cost: '68% of applications abandoned before completion',
    },
  ],

  techDebtItems: [
    '7 different query languages and data models',
    '7 separate driver/ORM layers in the application',
    '7 independent failure modes and monitoring dashboards',
    '7 upgrade/patching cycles',
    '7 security surfaces to harden',
    'Data consistency across systems requires distributed transactions or eventual consistency workarounds',
    'Every new feature touches multiple systems',
  ],
};

export const mongoContent = {
  pageTitle: 'The Platform',
  pageIntro:
    'MongoDB provides every data capability a lending platform needs — in one database.',

  capabilitySummaries: {
    documentModel: {
      id: 'document',
      label: 'Document Model',
      oneLiner:
        'Store loan applications, extracted fields, embeddings, and validation in one document.',
      description:
        'Store loan applications, extracted document fields, embeddings, and validation results in a single flexible document. No rigid table schemas, no JOIN sprawl, no ETL. Schema flexibility for evolving data sources.',
    },
    aggregation: {
      id: 'aggregation',
      label: 'Aggregation Framework',
      oneLiner: 'Real-time risk scoring in a single pipeline execution.',
      description:
        'Real-time risk scoring in a single pipeline execution. $lookup credit data, $addFields DTI calculation, $setWindowFields rolling 90-day payment average, $switch risk tiering, $group factor aggregation, $merge materialized view. $unionWith for cross-product analytics.',
    },
    changeStreams: {
      id: 'changeStreams',
      label: 'Change Streams',
      oneLiner: 'Turn MongoDB into a real-time event engine.',
      description:
        'watch() with pipeline filters. Resume token mechanism for fault tolerance — if the application crashes, it picks up exactly where it left off. Atlas Stream Processing (same aggregation syntax) for tumbling/session windows.',
    },
    timeSeries: {
      id: 'timeSeries',
      label: '$setWindowFields',
      oneLiner: 'Rolling-window analytics over the payments collection.',
      description:
        'An Aggregation Framework stage that computes rolling windows — 90-day delinquency rates, payment trend derivatives, exponential moving averages — directly over the payments collection, right next to the loans they belong to. No separate columnar or analytics store: the flexible document model already holds payment history, and $setWindowFields brings windowed analytics straight to it, feeding Early Warning System signals.',
    },
    vectorSearch: {
      id: 'vectorSearch',
      label: 'Atlas Vector Search',
      oneLiner: 'Semantic search, RAG, and similarity matching natively in MongoDB.',
      description:
        'Paired with voyage-multimodal-3.5 (multimodal embeddings for text, document images, and PDFs): policy lookup by meaning, similar borrower profiling (cosine similarity), fraud pattern detection. Unified transformer — no modality gap. MongoDBAtlasVectorSearch via LangChain with pre-filtering. Sub-15ms across 10M+ documents.',
    },
  },

  unificationMessage: {
    headline: 'One database. Every data capability.',
    subline: 'From origination through servicing.',
  },
};

export const architectureContent = {
  pageTitle: 'The AI Layer',
  pageIntro:
    'LangGraph orchestrates a 6-agent pipeline (supervisor, doc verifier, credit puller, loan app, underwriter, HITL gate) plus a separate borrower-facing Application Agent — all backed by MongoDB for state persistence, vector search, and real-time streaming.',

  agentDescriptions: {
    supervisor: {
      name: 'Supervisor',
      responsibilities:
        'Orchestrator-worker pattern for the lending pipeline. Routes agents via LangGraph StateGraph with 4 autonomy levels: observe (nodes paused for officer approval, approved nodes bypass), suggest (final decision paused), bounded (escalations paused — default), and auto (fully autonomous). Supervisor-level retry logic (3× attempts) with safe_node timeout wrappers. Dispatches parallel execution of Document Verifier + Credit Puller via LangGraph Send().',
      productionNote:
        'Bounded autonomy is the default — agents act autonomously for standard checks while the HITL gate triggers on policy thresholds. Every agent interaction is logged to the agent_activity collection for full auditability.',
    },
    docVerifier: {
      name: 'Document Verifier',
      responsibilities:
        'Validates document completeness against 10 required types (pay stubs, tax returns, bank statements, IDs, etc.). Detects extraction errors and duplicates via filename + content hash matching. Cross-references borrower names across all submitted documents.',
      tools: [
        { glyph: 'File', label: 'MongoDB Query', colorVar: 'mongo' },
        { glyph: 'Beaker', label: 'Extraction Validation', colorVar: 'voyage' },
      ],
      collections: 'documents',
      capabilities: [
        '10-type coverage verification',
        'Duplicate detection (filename + content hash)',
        'Extraction error flagging (advisory interventions)',
        'Cross-document name verification',
        'Blocking intervention creation for missing docs',
      ],
      productionNote:
        'Runs in parallel with Credit Puller via LangGraph Send() for faster data gathering.',
    },
    creditPuller: {
      name: 'Credit Puller',
      responsibilities:
        'Pulls credit reports for all borrowers on the application — primary applicant and co-applicant. Extracts primary and co-applicant credit scores. Creates advisory intervention if no credit data is found for any borrower.',
      tools: [
        { glyph: 'CreditCard', label: 'Credit Bureau API', colorVar: 'tool-blue' },
        { glyph: 'File', label: 'MongoDB Query', colorVar: 'mongo' },
      ],
      collections: 'credit_reports',
      capabilities: [
        'Multi-borrower credit extraction',
        'Co-applicant score pairing',
        'Parallel execution with Document Verifier',
        'Advisory intervention on missing data',
      ],
    },
    loanAppAgent: {
      name: 'Loan Application Agent',
      responsibilities:
        'Synthesizes results from Document Verifier and Credit Puller into a unified assessment. Uses LLM (Bedrock Claude) to analyze combined document extractions and credit data. Extracts and validates combined gross income figures. Generates a structured verification summary for the underwriter.',
      tools: [
        { glyph: 'Beaker', label: 'Bedrock Claude (LLM)', colorVar: 'voyage' },
        { glyph: 'File', label: 'MongoDB Query', colorVar: 'mongo' },
      ],
      collections: 'applications, documents, credit_reports',
      capabilities: [
        'Multi-source data synthesis',
        'LLM-powered document analysis',
        'Income extraction and validation',
        'Structured verification summary',
      ],
    },
    underwritingAgent: {
      name: 'Underwriting Agent',
      responsibilities:
        'Risk scoring pipeline backed by MongoDB aggregation and Python computation. Calculates GDS/TDS ratios with OSFI B-20 stress testing (+2% qualifying rate). Detects insured mortgages (LTV > 80%) and applies tighter limits (GDS 35%/TDS 42% vs conventional 39%/44%). Classifies into risk tiers (A, B+, B, C, D). Makes 3-way decisions: approve, decline, or escalate to officer review. Uses Atlas Vector Search for underwriting policy RAG.',
      tools: [
        { glyph: 'Charts', label: 'Aggregation Pipeline', colorVar: 'agent-cyan' },
        { glyph: 'MagnifyingGlass', label: 'Atlas Vector Search', colorVar: 'voyage' },
        { glyph: 'File', label: 'MongoDB Query', colorVar: 'mongo' },
        { glyph: 'TimeSeries', label: '$setWindowFields', colorVar: 'voyage' },
      ],
      collections: 'applications, credit_reports, underwriting_policies, payments',
      capabilities: [
        'OSFI B-20 stress testing',
        'Insured vs conventional mortgage detection',
        'GDS/TDS ratio calculation',
        'Risk tier classification (A → D)',
        'Policy RAG via Vector Search',
        'Intervention creation (stress failure, missing data)',
      ],
    },
    applicationAgent: {
      name: 'Application Agent',
      responsibilities:
        'Conversational AI assistant for borrowers, operating independently from the pipeline. Stage-aware prompting calibrates tone by application status. Provides 8 borrower-safe tools with explicit projection allowlists — raw risk scores and internal data are never exposed. Renders 2 generative UI components (document checklist, closing timeline) inline in chat. Returns source citations with provenance badges.',
      tools: [
        { glyph: 'MagnifyingGlass', label: 'Policy RAG (Vector Search)', colorVar: 'voyage' },
        { glyph: 'File', label: 'Status + Documents Query', colorVar: 'mongo' },
        { glyph: 'Warning', label: 'Intervention Check', colorVar: 'hitl-amber' },
        { glyph: 'Charts', label: 'Document Checklist + Closing Timeline (generative UI)', colorVar: 'agent-cyan' },
      ],
      collections: 'applications, documents, interventions, underwriting_policies, conversations',
      capabilities: [
        'Stage-aware conversation (tone shifts by status)',
        '2 generative UI components (document checklist, closing timeline)',
        'Policy RAG with source citations',
        'Safety-filtered data (no raw risk scores to borrowers)',
        'Intervention awareness + re-evaluation triggers',
        'Tool transparency (context gathering display)',
      ],
    },
  },

  interventionSystem: {
    title: 'Intervention System',
    description:
      'Pipeline agents create typed interventions with dual context — internal details for officers (severity, risk flags, source node) and borrower-safe summaries for chat display. Blocking interventions pause the pipeline until the borrower resolves them; advisory interventions are informational.',
    types: [
      { type: 'missing_document', severity: 'blocking', source: 'Doc Verifier', desc: 'Required document types not submitted' },
      { type: 'stress_test_failure', severity: 'blocking', source: 'Underwriter', desc: 'OSFI B-20 stress test exceeds GDS/TDS limits' },
      { type: 'income_data_required', severity: 'blocking', source: 'Underwriter', desc: 'Combined income is zero or unavailable' },
      { type: 'credit_score_required', severity: 'blocking', source: 'Underwriter', desc: 'Primary credit score unavailable' },
      { type: 'credit_data_unavailable', severity: 'advisory', source: 'Credit Puller', desc: 'No credit reports retrieved for borrower' },
      { type: 'document_processing_error', severity: 'advisory', source: 'Doc Verifier', desc: 'Extraction errors in submitted documents' },
      { type: 'additional_info_required', severity: 'advisory', source: 'Underwriter', desc: 'Escalation due to policy conditions' },
    ],
    codeSample: `db.interventions.insertOne({
  application_id: "APP-2026-00001",
  type: "stress_test_failure",
  status: "pending",
  internal_context: {
    source_node: "underwriter",
    severity: "blocking",
    risk_flag: "stress_test_failure",
    stress_gds: 0.68, stress_tds: 0.72
  },
  borrower_context: {
    summary: "Your stress test ratios exceed guidelines.",
    action_required: "Consider a larger down payment or lower purchase price."
  }
})`,
  },

  generativeUI: {
    title: 'Generative UI',
    description:
      'The Application Agent renders interactive React components inline in chat. The backend detects trigger keywords, fetches borrower-safe data, and emits ui_component SSE events. The frontend maps component names to React components via a registry. The LLM receives a description of visible components so it complements rather than duplicates the visual.',
    components: [
      { name: 'DocumentChecklist', interactive: false, desc: 'Visual status badges for each required document type' },
      { name: 'ClosingTimeline', interactive: false, desc: 'Post-approval steps: rate lock → signing → funding' },
    ],
  },

  hitlExplanation: {
    title: 'Human-in-the-Loop',
    tiers: [
      { tier: 'Auto-approve', desc: 'Clean credit, low ratios, purchase < $500K — no interrupt' },
      { tier: 'Officer Review', desc: 'Purchase > $500K, GDS > 36%, TDS > 41%, risk tier B/C — interrupt()' },
      { tier: 'Auto-decline', desc: 'Risk score > 80, tier D, or stress test failure — no interrupt' },
    ],
    officerActions:
      'Officers can Approve, Decline, or Modify & Continue. Modifications support loan amount overrides, risk tier overrides, and additional conditions. Modify & Continue re-executes the pipeline with updated parameters.',
    persistence:
      'Every interrupt() persists full graph state to MongoDB via MongoDBSaver. Resume restores from checkpoint. All decisions logged to hitl_audit (immutable). Pipeline lock prevents concurrent execution.',
    codeSample: `def hitl_gate(state):
    # LangGraph interrupt pauses execution, persists to MongoDB
    decision = interrupt({
        "application_id": state["application_id"],
        "risk_score": state["risk_score"],
        "risk_tier": state["risk_tier"],
        "gds_ratio": state["gds_ratio"],
        "tds_ratio": state["tds_ratio"],
        "decision_reasoning": state["decision_reasoning"],
        "policy_citations": state.get("policy_citations", [])
    })
    # Officer resumes with approve / decline / modify_and_continue
    if decision["action"] == "approve":
        return Command(goto="complete", update={"approved": True})
    elif decision["action"] == "modify_and_continue":
        return Command(goto="underwriter", update=decision["overrides"])
    return Command(goto="complete", update={"approved": False})`,
  },

};
