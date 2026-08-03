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

/**
 * Stage definitions — static skeleton with dynamic content generators.
 *
 * Each stage has get* functions that receive a `ctx` object built from
 * real backend data (timeline-context endpoint + SSE events).
 * Functions return sensible defaults when ctx has no data.
 */
export const STAGES = [
  {
    id: 'received',
    label: 'Application Received',
    icon: '1',
    getType: () => 'clean',
    getDetail: (ctx) => `Your application ${ctx.appId || ''} has been received and queued for processing.`,
    getAgentStatus: () => 'Our AI assistant is reviewing your submission...',
  },
  {
    id: 'docs',
    label: 'Document Verification',
    icon: '2',
    getType: (ctx) => ctx.docInterventions?.length > 0 ? 'intervention' : 'clean',
    getDetail: (ctx) => {
      const docs = ctx.docCount || 0;
      const issues = ctx.docInterventions?.length || 0;
      if (issues > 0) return `AI detected ${issues} issue${issues !== 1 ? 's' : ''} during document analysis and resolved ${issues === 1 ? 'it' : 'them'} automatically.`;
      if (docs > 0) return `${docs} documents verified successfully.`;
      return 'Verifying your documents...';
    },
    getInterventions: (ctx) => ctx.docInterventions || [],
    getAgentStatus: (ctx) => (ctx.docInterventions?.length > 0)
      ? 'AI assistant detected document issues — resolving automatically...'
      : 'Our AI assistant is verifying your documents...',
  },
  {
    id: 'action-required',
    label: 'Additional Documents',
    icon: '3',
    getType: (ctx) => ctx.pendingInterventions?.length > 0 ? 'action-required' : 'clean',
    getDetail: (ctx) => {
      const pending = ctx.pendingInterventions || [];
      if (pending.length > 0) return pending[0].borrower_context?.summary || 'Additional documentation may be required.';
      return 'No additional documents needed.';
    },
    getInterventions: (ctx) => ctx.pendingInterventions || [],
    getAgentStatus: (ctx) => (ctx.pendingInterventions?.length > 0)
      ? 'Waiting for additional documentation...'
      : 'All document requirements satisfied.',
  },
  {
    id: 'credit',
    label: 'Credit & Income Analysis',
    icon: '4',
    getType: (ctx) => ctx.creditInterventions?.length > 0 ? 'intervention' : 'clean',
    getDetail: (ctx) => {
      if (ctx.creditInterventions?.length > 0) return `AI investigated ${ctx.creditInterventions.length} discrepanc${ctx.creditInterventions.length !== 1 ? 'ies' : 'y'} in your credit and income records.`;
      return 'Reviewing your credit and income against your submitted records.';
    },
    getInterventions: (ctx) => ctx.creditInterventions || [],
    getAgentStatus: () => 'Our AI assistant is analyzing your credit and income data...',
  },
  {
    id: 'underwriting',
    label: 'Underwriting Risk Assessment',
    icon: '5',
    getType: (ctx) => ctx.riskInterventions?.length > 0 ? 'intervention' : 'clean',
    getDetail: (ctx) => {
      if (ctx.riskInterventions?.length > 0) return 'AI resolved a data issue and is finalizing your affordability assessment.';
      return 'Assessing your affordability against our lending criteria.';
    },
    getInterventions: (ctx) => ctx.riskInterventions || [],
    // Quantitative underwriting metrics (risk score, tier, GDS/TDS) are officer-only
    // and intentionally not surfaced to the borrower — no getMetrics here.
    getAgentStatus: (ctx) => (ctx.riskInterventions?.length > 0)
      ? 'AI assistant corrected a scoring issue — recalculating...'
      : 'Our AI assistant is running the underwriting risk assessment...',
  },
  {
    id: 'decision',
    label: 'Decision Ready',
    icon: '6',
    getType: () => 'clean',
    getDetail: (ctx) => {
      const resolved = ctx.totalResolved || 0;
      let msg = 'Your assessment is complete and your decision is being prepared.';
      if (resolved > 0) msg += ` ${resolved} issue${resolved !== 1 ? 's' : ''} resolved automatically by AI along the way.`;
      return msg;
    },
    getAgentStatus: () => 'Analysis complete — preparing your results...',
  },
  {
    id: 'review',
    label: 'Officer Review',
    icon: '7',
    getType: () => 'clean',
    getDetail: () => 'A loan officer is reviewing your application and the AI assistant\'s work.',
    getAgentStatus: () => 'A loan officer is reviewing your application...',
  },
  {
    id: 'approved',
    label: 'Approved',
    icon: '8',
    getType: () => 'clean',
    getDetail: (ctx) => {
      if (ctx.isDeclined) {
        return `Application declined.${ctx.declineReason ? ' ' + ctx.declineReason : ''}`;
      }
      const parts = ['Congratulations! Your mortgage has been approved.'];
      if (ctx.product) parts.push(`Product: ${ctx.product}.`);
      return parts.join(' ');
    },
    getAgentStatus: (ctx) => ctx.isDeclined
      ? 'Your application has been declined.'
      : 'Great news — your loan has been approved!',
  },
  {
    id: 'closing',
    label: 'Closing & Document Signing',
    icon: '9',
    getType: () => 'clean',
    getDetail: () => 'Your loan documents are being prepared for signing.',
    getAgentStatus: () => 'Preparing your closing documents...',
  },
  {
    id: 'active',
    label: 'Loan Active',
    icon: '10',
    getType: () => 'clean',
    getDetail: (ctx) => {
      if (ctx.loanAmount) return `Your mortgage is now active. $${Number(ctx.loanAmount).toLocaleString()} disbursed.`;
      return 'Your mortgage is now active.';
    },
    getAgentStatus: () => 'Your loan is now active and being monitored.',
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
