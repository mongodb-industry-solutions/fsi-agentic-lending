// Frontend-only demo applications that populate the loan officer queue so the
// dashboard looks already-populated. These are decorative: they never hit the
// backend (the `APP-DEMO-` prefix guarantees no collision with real IDs) and
// `demoSeed: true` is the flag consumers use to treat them as static records.
//
// Everything here is hardcoded for the demo. Timestamps are computed once at
// module load relative to now so the queue and detail views stay plausibly
// fresh on every page view.
//
// Two derived exports keep the rich blobs out of queue rendering:
//   - `SEED_DEMO_APPS`      — the lightweight queue-row projection the hook
//                              merges ahead of real apps (same shape it used to
//                              define inline).
//   - `SEED_DEMO_APP_DETAILS` — full per-seed detail, keyed by application_id,
//                              consumed by SeedApplicationDetail.
"use client";

const _now = Date.now();
const minAgo = (m) => new Date(_now - m * 60 * 1000).toISOString();
const hoursAgo = (h) => minAgo(h * 60);

const SEED_DEMO_RAW = [
  {
    application_id: 'APP-DEMO-0001',
    demoSeed: true,
    borrower_names: ['Emily Carter'],
    loan_amount: 512000,
    product: '5yr Fixed (25yr Amort)',
    status: 'processing',
    created_at: hoursAgo(2),
    risk_score: 41,
    risk_tier: 'A',
    decision_ms: 7200,
    purchase_price: 640000,
    down_payment: 128000,
    income_summary: {
      combined_gross: 172000,
      primary_gross: 172000,
      primary_employment: 'Chartered Accountant — PwC Canada',
    },
    property: { type: 'Condo', city: 'Toronto', province: 'ON', purchase_price: 640000, annual_tax: 4380 },
    documents: [
      { doc_type: 'identification', status: 'verified' },
      { doc_type: 'paystubs', status: 'verified' },
      { doc_type: 't4', status: 'verified' },
      { doc_type: 'notice_of_assessment', status: 'verified' },
      { doc_type: 'bank_statements', status: 'verified' },
      { doc_type: 'purchase_agreement', status: 'verified' },
      { doc_type: 'property_tax_notice', status: 'pending' },
    ],
    credit_reports: [{ score: 761, bureau: 'Equifax' }],
    gds_ratio: 0.285,
    tds_ratio: 0.361,
    stress_gds: 0.322,
    stress_tds: 0.406,
    ltv: 0.80,
    decisionContext: {
      recommended_action: null,
      recommendation_reason: null,
      recommended_conditions: [],
    },
    activity_trail: [
      { agent: 'supervisor', action: 'application_received', detail: 'Application received — routing to verification pipeline.', timestamp: minAgo(128) },
      { agent: 'doc_verifier', action: 'documents_verified', detail: 'Income confirmed at $172,000 per T4 + NOA. 6 of 7 documents verified.', timestamp: minAgo(119) },
      { agent: 'credit_puller', action: 'credit_pull', detail: 'Equifax — score 761, no derogatory marks.', timestamp: minAgo(116) },
      { agent: 'loan_app', action: 'profile_assembled', detail: 'Borrower profile assembled from verified documents.', timestamp: minAgo(111) },
      { agent: 'underwriter', action: 'risk_scoring', detail: 'Running GDS/TDS + OSFI B-20 stress test.', timestamp: minAgo(4) },
    ],
  },
  {
    application_id: 'APP-DEMO-0002',
    demoSeed: true,
    borrower_names: ['David Nguyen', 'Lena Nguyen'],
    loan_amount: 689000,
    product: 'Variable (5yr)',
    status: 'review',
    created_at: hoursAgo(4),
    risk_score: 63,
    risk_tier: 'B+',
    decision_ms: 9600,
    purchase_price: 815000,
    down_payment: 126000,
    income_summary: {
      combined_gross: 238500,
      primary_gross: 141000,
      primary_employment: 'Product Manager — Shopify',
      co_applicant_gross: 97500,
      co_applicant_employment: 'Registered Nurse — St. Joseph’s Health Centre',
    },
    property: { type: 'Semi-detached', city: 'Vancouver', province: 'BC', purchase_price: 815000, annual_tax: 7410 },
    documents: [
      { doc_type: 'identification', status: 'verified' },
      { doc_type: 'paystubs', status: 'verified' },
      { doc_type: 't4', status: 'verified' },
      { doc_type: 'notice_of_assessment', status: 'verified' },
      { doc_type: 'bank_statements', status: 'verified' },
      { doc_type: 'purchase_agreement', status: 'verified' },
      { doc_type: 'property_inspection', status: 'pending' },
    ],
    credit_reports: [
      { score: 714, bureau: 'Equifax' },
      { score: 688, bureau: 'TransUnion' },
    ],
    gds_ratio: 0.331,
    tds_ratio: 0.424,
    stress_gds: 0.374,
    stress_tds: 0.479,
    ltv: 0.845,
    decisionContext: {
      recommended_action: 'manual_review',
      recommendation_reason: 'Requested amount exceeds the $500K auto-approval cap and combined TDS breaches 41% under the B-20 stress test. Escalated to officer review.',
      recommended_conditions: [
        'Provide 12 months of combined bank statements',
        'Confirm second income continuity ≥ 2 years',
        'Reduce outstanding balances before closing',
      ],
    },
    activity_trail: [
      { agent: 'supervisor', action: 'application_received', detail: 'Application received — routing to verification pipeline.', timestamp: minAgo(248) },
      { agent: 'doc_verifier', action: 'documents_verified', detail: 'Both incomes confirmed. 6 of 7 documents verified.', timestamp: minAgo(240) },
      { agent: 'credit_puller', action: 'credit_pull', detail: 'Equifax 714 / TransUnion 688 — one 30-day delinquency on file.', timestamp: minAgo(235) },
      { agent: 'loan_app', action: 'profile_assembled', detail: 'Joint profile assembled with co-applicant income.', timestamp: minAgo(230) },
      { agent: 'underwriter', action: 'risk_scored', detail: 'GDS 33.1% · TDS 42.4% · stress TDS 47.9% — breaches 41% under B-20.', timestamp: minAgo(18) },
      { agent: 'hitl_gate', action: 'interrupt', detail: 'LangGraph interrupt() — pipeline paused. Awaiting officer decision.', timestamp: minAgo(2) },
    ],
  },
  {
    application_id: 'APP-DEMO-0003',
    demoSeed: true,
    borrower_names: ['Priya Sharma'],
    loan_amount: 358000,
    product: '5yr Fixed (25yr Amort)',
    status: 'funded',
    created_at: hoursAgo(26),
    risk_score: 26,
    risk_tier: 'A',
    decision_ms: 6100,
    purchase_price: 397000,
    down_payment: 39000,
    income_summary: {
      combined_gross: 124000,
      primary_gross: 124000,
      primary_employment: 'School Administrator — TDSB',
    },
    property: { type: 'Townhouse', city: 'North York', province: 'ON', purchase_price: 397000, annual_tax: 3560 },
    documents: [
      { doc_type: 'identification', status: 'verified' },
      { doc_type: 'paystubs', status: 'verified' },
      { doc_type: 't4', status: 'verified' },
      { doc_type: 'notice_of_assessment', status: 'verified' },
      { doc_type: 'bank_statements', status: 'verified' },
      { doc_type: 'purchase_agreement', status: 'verified' },
      { doc_type: 'property_tax_notice', status: 'verified' },
    ],
    credit_reports: [{ score: 798, bureau: 'Equifax' }],
    gds_ratio: 0.292,
    tds_ratio: 0.356,
    stress_gds: 0.328,
    stress_tds: 0.379,
    ltv: 0.902,
    decisionContext: {
      recommended_action: 'approve',
      recommendation_reason: 'Tier A within the auto-approve envelope (< $500K, risk 26, all ratios within B-20).',
      recommended_conditions: ['First payment draft aligned with payroll cycle'],
    },
    approvalDetails: {
      mode: 'auto',
      rate: '4.29%',
      conditions: ['First payment draft aligned with payroll cycle'],
    },
    activity_trail: [
      { agent: 'supervisor', action: 'application_received', detail: 'Application received — routing to verification pipeline.', timestamp: minAgo(1530) },
      { agent: 'doc_verifier', action: 'documents_verified', detail: 'All 7 documents verified. Income confirmed at $124,000.', timestamp: minAgo(1522) },
      { agent: 'credit_puller', action: 'credit_pull', detail: 'Equifax — score 798, clean bureau.', timestamp: minAgo(1518) },
      { agent: 'loan_app', action: 'profile_assembled', detail: 'Borrower profile assembled from verified documents.', timestamp: minAgo(1514) },
      { agent: 'underwriter', action: 'risk_scored', detail: 'GDS 29.2% · TDS 35.6% · stress TDS 37.9% — within B-20.', timestamp: minAgo(1508) },
      { agent: 'complete', action: 'pipeline_complete', detail: 'Auto-approved @ 4.29% · funded · ledger balance $358,000', timestamp: minAgo(1495) },
    ],
  },
];

// Queue-row projection — identical shape to the inline SEED_DEMO_APPS the hook
// used to merge, so `applicationsForDisplay` behavior is unchanged.
const QUEUE_FIELDS = [
  'application_id', 'demoSeed', 'borrower_names', 'loan_amount', 'product',
  'status', 'created_at', 'risk_score', 'risk_tier', 'decision_ms',
];

export const SEED_DEMO_APPS = SEED_DEMO_RAW.map((app) =>
  Object.fromEntries(QUEUE_FIELDS.map((key) => [key, app[key]]))
);

// Full detail keyed by application_id for the seed detail view.
const SEED_DEMO_APP_DETAILS = Object.fromEntries(
  SEED_DEMO_RAW.map((app) => [app.application_id, app])
);

export function isDemoSeed(id) {
  return !!SEED_DEMO_APP_DETAILS[id];
}

export function getDemoSeedDetail(id) {
  return SEED_DEMO_APP_DETAILS[id] || null;
}
