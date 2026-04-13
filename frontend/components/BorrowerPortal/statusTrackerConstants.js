export const AGENT_COLORS = {
  loan_app_agent: { color: 'var(--agent-cyan)', bg: 'var(--agent-cyan-dim)', label: 'Loan Agent' },
  underwriter: { color: 'var(--hitl-amber)', bg: 'var(--hitl-amber-dim)', label: 'Underwriter' },
  supervisor: { color: 'var(--voyage)', bg: 'var(--voyage-dim)', label: 'Supervisor' },
  default: { color: 'var(--text-dim)', bg: 'var(--bg-raised)', label: 'Agent' },
};

export function getAgentStyle(agentName) {
  return AGENT_COLORS[agentName] || AGENT_COLORS.default;
}

export const ACTION_TO_STAGE_MAP = {
  document_ingestion: 1,
  verification: 1,
  risk_assessment: 4,
  underwriting: 4,
  decision: 5,
  intervention: 6,
  autonomy_gate: 6,
  status_update: null,
};

export function mapEventToStageIdx(event, currentStageIdx) {
  if (event.action && ACTION_TO_STAGE_MAP[event.action] !== undefined) {
    return ACTION_TO_STAGE_MAP[event.action];
  }
  return currentStageIdx;
}

export const STAGES = [
  {
    id: 'received',
    label: 'Application Received',
    type: 'clean',
    detail: 'Your application APP-2026-00001 has been received and queued for processing.',
    icon: '1',
    delayMs: 0,
    agentStatus: 'Our AI assistant is reviewing your submission...',
    whatHappened: 'Your application was received and queued for processing. All required fields validated — personal information, employment details, and loan parameters confirmed complete.',
  },
  {
    id: 'docs',
    label: 'Document Verification',
    type: 'intervention',
    detail: 'AI detected 2 issues during document analysis and resolved both automatically.',
    icon: '2',
    delayMs: 3000,
    agentStatus: 'AI assistant detected document issues — resolving automatically...',
    agentStatusActive: 'Our AI assistant is verifying your documents...',
    whatHappened: 'Our AI verified your CRA tax notices, bank statements, and pay stubs. Two issues were detected and resolved without requiring any action from you.',
    interventions: [
      {
        issue: 'Bank statement pages 2-3 had insufficient image quality — text extraction failed on first attempt.',
        resolution: 'AI auto-enhanced the images using voyage-multimodal-3.5 and re-processed successfully on retry. All 247 transactions extracted.',
        icon: null,
      },
      {
        issue: 'Pay stub shows "M. Delgado" while credit report shows "Marcus Alejandro Delgado" — name mismatch flagged.',
        resolution: 'AI cross-referenced SIN and address across all documents to confirm identity match. Name variation logged as verified alias.',
        icon: null,
      },
    ],
  },
  {
    id: 'action-required',
    label: 'Additional Document Needed',
    type: 'action-required',
    detail: 'Your bank statement covers only 2 months. Our policy requires a minimum of 3 months. Please upload an additional statement.',
    icon: '3',
    delayMs: 4000,
    agentStatus: 'Waiting for you to upload an additional bank statement...',
    agentStatusActive: 'AI assistant identified a missing document requirement...',
    whatHappened: 'Our AI detected that your bank statement covered only January–February 2026, but policy §2.3.1 requires a minimum of 3 consecutive months. After you uploaded the December 2025 statement, the AI verified it in 320ms and resumed processing.',
    actionLabel: 'Upload December 2025 Bank Statement',
    actionDetail: 'Policy §2.3.1 requires 3 consecutive months of bank statements. Your current upload covers January–February 2026.',
  },
  {
    id: 'credit',
    label: 'Credit & Income Analysis',
    type: 'intervention',
    detail: 'AI investigated 2 discrepancies in your credit and income records and resolved both.',
    icon: '4',
    delayMs: 5000,
    agentStatus: 'AI assistant found discrepancies in your records — investigating...',
    agentStatusActive: 'Our AI assistant is analyzing your credit and income data...',
    whatHappened: 'Credit and income analysis identified two discrepancies that the AI investigated and resolved, preventing unnecessary score penalties and ensuring accurate income reporting.',
    interventions: [
      {
        issue: '3 hard inquiries detected within 180 days, which would trigger a -8pt score penalty under policy §4.2.1.',
        resolution: 'AI identified that 2 of the 3 inquiries were rate-shopping for an auto loan within a 14-day window. Per FCAC guidelines, these are combined into 1 inquiry — effective count reduced to 2, avoiding the penalty trigger.',
        icon: null,
      },
      {
        issue: 'Plaid monthly average ($18,150/mo) does not match combined T4 annualized income ($18,558/mo) — $408/mo discrepancy flagged.',
        resolution: 'AI found $4,900 in freelance deposits across the 12-month Plaid history (averaging $408/mo), fully explaining the gap. Combined income reconciled at $222,700/yr with $4,900 supplemental.',
        icon: null,
      },
    ],
  },
  {
    id: 'underwriting',
    label: 'Underwriting Risk Assessment',
    type: 'intervention',
    detail: 'Initial score: 68 (B). AI corrected a misclassified debt payment and improved the score to 72 (B+).',
    icon: '5',
    delayMs: 5000,
    agentStatus: 'AI assistant corrected a scoring error — recalculating your risk profile...',
    agentStatusActive: 'Our AI assistant is running the underwriting risk assessment...',
    whatHappened: 'The 7-stage aggregation pipeline initially scored your application at 68 (B tier). The AI identified that your car loan payment was classified at the full $620/mo amount, but verified Scotiabank records show the actual payment is $482/mo. After correction, GDS dropped from 33.8% to 31.2% and the composite score improved to 72 (B+).',
    interventions: [
      {
        issue: 'Car loan payment classified at full amount ($620/mo) instead of verified Scotiabank payment ($482/mo), inflating GDS to 33.8%.',
        resolution: 'AI verified actual payment through Scotiabank loan records. Corrected monthly payment from $620 to $482, reducing GDS from 33.8% to 31.2%. Additionally, comparable borrower analysis shows 92% successful repayment for similar profiles.',
        icon: null,
      },
    ],
    beforeAfter: {
      metrics: [
        { label: 'Risk Score', before: '68 (B)', after: '72 (B+)' },
        { label: 'GDS Ratio', before: '33.8%', after: '31.2%' },
        { label: 'Car Loan', before: '$620/mo', after: '$482/mo (verified)' },
      ],
    },
  },
  {
    id: 'decision',
    label: 'Decision Ready',
    type: 'clean',
    detail: 'Underwriting complete. Risk score: 72 (B+). 5 issues resolved by AI across the process.',
    icon: '6',
    delayMs: 3000,
    agentStatus: 'Analysis complete — preparing your results...',
    whatHappened: 'Underwriting completed with a risk score of 72 (B+ tier). Throughout the process, our AI assistant resolved 5 issues autonomously and flagged 1 for your action — preventing unnecessary score penalties, correcting income records, and ensuring accurate debt calculations. The proposed rate of 4.89% reflects your corrected profile.',
  },
  {
    id: 'review',
    label: 'Officer Review',
    type: 'clean',
    detail: 'A loan officer is reviewing your application and the AI assistant\'s intervention history.',
    icon: '7',
    delayMs: 4000,
    agentStatus: 'A loan officer is reviewing your application...',
    whatHappened: 'A senior loan officer reviewed the AI\'s assessment, including all 5 automated interventions. The officer verified the car loan correction, confirmed the FCAC rate-shopping consolidation, and approved the income reconciliation methodology.',
  },
  {
    id: 'approved',
    label: 'Approved',
    type: 'clean',
    detail: 'Congratulations! Your mortgage has been approved at 4.89% APR.',
    icon: '8',
    delayMs: 4000,
    agentStatus: 'Great news — your loan has been approved!',
    whatHappened: 'Your 5yr Fixed (25yr Amort) mortgage at 4.89% APR has been formally approved with a monthly payment of $4,047. Without the AI assistant\'s interventions, your application would have scored 68 (B tier) with a higher rate of 5.24%. The AI saved you an estimated $135/mo ($40,500 over the life of the loan).',
  },
  {
    id: 'closing',
    label: 'Closing & Document Signing',
    type: 'clean',
    detail: 'Your loan documents are being prepared for signing.',
    icon: '9',
    delayMs: 3000,
    agentStatus: 'Preparing your closing documents...',
    whatHappened: 'Your loan agreement, disclosure documents, and amortization schedule have been generated. E-signing completed and all conditions precedent satisfied.',
  },
  {
    id: 'active',
    label: 'Loan Active',
    type: 'clean',
    detail: 'Your mortgage is now active. $700,000 disbursed. First payment: May 1, 2026.',
    icon: '10',
    delayMs: 3000,
    agentStatus: 'Your loan is now active and being monitored.',
    whatHappened: 'EFT disbursement of $700,000 has been initiated to your designated account. Mortgage servicing has begun — your first payment of $4,047 is due May 1, 2026. Our AI assistant will continue to monitor your mortgage for refinancing opportunities.',
  },
];

export const STATUS_TO_STAGE = {
  submitted: 0,
  processing: 1,
  action_required: 2,
  credit: 3,
  underwriting: 4,
  decision: 5,
  review: 6,
  approved: 7,
  declined: 7,
  closing: 8,
  funded: 9,
  active: 9,
  error: -1,
};

export function formatTime(date) {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
