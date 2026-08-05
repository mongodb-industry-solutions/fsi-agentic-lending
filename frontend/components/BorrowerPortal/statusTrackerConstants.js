/**
 * Borrower-facing status milestones — Amazon-style high-level tracking.
 *
 * The borrower sees a small set of high-level milestones only. All internal
 * pipeline stages (document verification, credit pull, underwriting, officer
 * review, decision) roll up into a single "In Review" milestone — the borrower
 * is never shown the multi-step machinery or the agents behind it. The only
 * "agent" the borrower perceives is their Personal Lending Assistant (chat).
 *
 * Each stage exposes get* functions that receive a `ctx` built from the
 * borrower-safe timeline-context endpoint. Wording is neutral / single-assistant;
 * no agent names, no "AI pipeline", no "autonomous".
 */
export const STAGES = [
  {
    id: 'received',
    label: 'Application Received',
    icon: '1',
    getType: () => 'clean',
    getDetail: (ctx) => `Your application${ctx.appId ? ` ${ctx.appId}` : ''} has been received.`,
    getAgentStatus: () => 'Your application has been received and is queued for review.',
  },
  {
    id: 'in-review',
    label: 'In Review',
    icon: '2',
    getType: (ctx) => (ctx.pendingActions?.length > 0 ? 'action-required' : 'clean'),
    getDetail: (ctx) => {
      if (ctx.pendingActions?.length > 0) {
        return ctx.pendingActions[0].borrower_context?.summary
          || 'We need a little more information to continue your review.';
      }
      return 'We’re reviewing your documents, credit, and affordability.';
    },
    getInterventions: (ctx) => ctx.pendingActions || [],
    getAgentStatus: (ctx) => (ctx.pendingActions?.length > 0
      ? 'We need a little more information to continue your review.'
      : 'We’re reviewing your application.'),
  },
  {
    id: 'decision',
    label: 'Decision',
    icon: '3',
    getType: () => 'clean',
    getDetail: (ctx) => {
      if (ctx.isDeclined) {
        return `Application not approved.${ctx.declineReason ? ' ' + ctx.declineReason : ''}`;
      }
      const parts = ['Your mortgage has been approved.'];
      if (ctx.product) parts.push(`Product: ${ctx.product}.`);
      return parts.join(' ');
    },
    getAgentStatus: (ctx) => (ctx.isDeclined
      ? 'Your application was not approved.'
      : 'Great news — your loan has been approved!'),
  },
  {
    id: 'closing',
    label: 'Closing',
    icon: '4',
    getType: () => 'clean',
    getDetail: () => 'Your loan documents are being prepared for signing.',
    getAgentStatus: () => 'We’re preparing your closing documents.',
  },
  {
    id: 'funded',
    label: 'Funded',
    icon: '5',
    getType: () => 'clean',
    getDetail: (ctx) => (ctx.loanAmount
      ? `Your mortgage is now active. $${Number(ctx.loanAmount).toLocaleString()} disbursed.`
      : 'Your mortgage is now active.'),
    getAgentStatus: () => 'Your loan is now active.',
  },
];

// Map every backend status to a high-level milestone. The internal working
// statuses (processing / credit / underwriting / review / decision) all roll
// up into "In Review" so the borrower never sees the pipeline granularity.
export const STATUS_TO_STAGE = {
  submitted: 0,
  processing: 1,
  action_required: 1,
  credit: 1,
  underwriting: 1,
  review: 1,
  decision: 1,
  approved: 2,
  declined: 2,
  closing: 3,
  funded: 4,
  active: 4,
  error: -1,
};

export function formatTime(date) {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
