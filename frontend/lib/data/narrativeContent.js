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
        'Real-time risk scoring in a single pipeline execution. $lookup credit data, $addFields DTI calculation, $setWindowFields rolling 90-day payment average, $switch risk tiering, $group factor aggregation, $merge materialized view. $unionWith for cross-product analytics. MongoDB 8.0 block processing for time series.',
    },
    graphLookup: {
      id: 'graphLookup',
      label: '$graphLookup',
      oneLiner: 'Recursive graph traversal within MongoDB — no separate graph database.',
      description:
        'Recursive graph traversal within MongoDB collections. Start with a suspect borrower, traverse linkedAccountIds up to 3 hops deep, flag high-risk connections. Index connectToField and use restrictSearchWithMatch to prune irrelevant branches.',
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
      label: 'Time Series Collections',
      oneLiner: 'Columnar storage for payment histories and credit score trends.',
      description:
        'Columnar storage with automatic bucketing, purpose-built for payment histories and credit score trends. Partition by loanMetadata (loanId, borrowerId, productType). Combined with $setWindowFields: rolling delinquency rates, payment trend derivatives, exponential moving averages. expireAfterSeconds for 7-year regulatory retention.',
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
    'LangGraph orchestrates agents that use LangChain tools backed by MongoDB.',

  agentDescriptions: {
    supervisor: {
      name: 'Supervisor',
      responsibilities:
        'For regulated workflows like lending, the orchestrator-worker pattern (supervisor) ensures every agent interaction flows through a documented, auditable path. The StateGraph API provides clearer workflow visualization — the graph structure maps directly to lending workflow diagrams.',
      productionNote:
        'Production agentic lending systems processing 1,000+ applications/hour use a supervisor that orchestrates specialized agents, each with access to domain-specific MongoDB tools, while maintaining a shared state graph for full auditability.',
    },
    loanAppAgent: {
      name: 'Loan Application Agent',
      responsibilities:
        'Multi-document ingestion (CRA notices, bank statements, pay stubs), identity verification, open banking data enrichment, and abandonment prevention.',
      tools: [
        { icon: '📋', label: 'creditBureau()', colorVar: 'tool-blue' },
        { icon: '🧬', label: 'voyage-multimodal-3.5', colorVar: 'voyage' },
        { icon: '📡', label: 'Change Streams', colorVar: 'success' },
        { icon: '🏦', label: 'Open Banking (Plaid)', colorVar: 'agent-cyan' },
      ],
      collections: 'loanApplications, loanDocuments',
      dataSources: [
        'Borrower Profiles',
        'CRA Notices / Bank Statements / Pay Stubs',
        'Communication Logs',
        'IDs',
      ],
      capabilities: [
        '23 document types classified',
        'Multi-channel intake',
        'Open Banking data enrichment',
      ],
    },
    underwritingAgent: {
      name: 'Underwriting Agent',
      responsibilities:
        'Cash flow underwriting, alternative data scoring, risk tiering, champion/challenger model evaluation, and explainable decisions.',
      tools: [
        { icon: '📊', label: 'Aggregation', colorVar: 'agent-cyan' },
        { icon: '🔎', label: 'Vector Search', colorVar: 'voyage' },
        { icon: '🕸', label: '$graphLookup', colorVar: 'danger' },
        { icon: '⏱', label: 'Time Series', colorVar: 'voyage' },
      ],
      collections: 'riskScores, creditReports',
      dataSources: [
        'Credit Reports',
        'Financial Scores',
        '3rd Party / Social Media',
        'Cash Flow Data',
      ],
      capabilities: [
        'Cash flow underwriting',
        'SHAP explainability',
        'Adverse action generation',
        'Champion/challenger evaluation',
      ],
    },
    renewalAgent: {
      name: 'Renewal Agent',
      responsibilities:
        'Early warning system monitoring, propensity-to-pay scoring, proactive intervention triggers, and multi-channel outreach for retention and collections.',
      tools: [
        { icon: '📡', label: 'Change Streams', colorVar: 'success' },
        { icon: '⏱', label: 'Time Series', colorVar: 'voyage' },
        { icon: '🔎', label: 'Vector Search', colorVar: 'voyage' },
      ],
      collections: 'renewalOffers, ewsAlerts, paymentPatterns',
      dataSources: [
        'Payment History',
        'Behavioral Signals',
        'External Events',
        'Similar Borrower Profiles',
      ],
      capabilities: [
        'Early Warning System',
        'Propensity-to-pay scoring',
        'Proactive restructuring',
        'Multi-channel outreach',
      ],
    },
  },

  hitlExplanation: {
    title: 'Human-in-the-loop',
    tiers: [
      { tier: 'Tier 1 (low risk)', desc: 'Auto-approve, no interrupt' },
      { tier: 'Tier 2 (medium)', desc: 'Junior officer review via interrupt()' },
      { tier: 'Tier 3 (high)', desc: 'Senior escalation via interrupt() with override' },
    ],
    persistence:
      'Every interrupt() persists state to MongoDB via MongoDBSaver. Every resume restores from checkpoint. Full audit trail.',
    codeSample: `def loan_approval_node(state):
    decision = interrupt({
        "loan_amount": state["loan_amount"],
        "risk_score": state["risk_score"],
        "underwriting_summary": state["underwriting_result"]
    })
    if decision["approved"]:
        return Command(goto="disburse", update={"terms": decision.get("modified_terms")})
    return Command(goto="reject", update={"rejection_reason": decision["reason"]})`,
  },

};
