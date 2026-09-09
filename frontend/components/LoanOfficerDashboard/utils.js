// Backend escalation thresholds (see backend underwriter / constants.js).
// Insured mortgages (LTV > 80%) use tighter limits (35% / 42%); these
// are the conventional thresholds used for HITL display/gating.
export const GDS_LIMIT = 0.36;
export const TDS_LIMIT = 0.41;

export function formatCurrency(amount) {
  if (amount == null) return 'N/A';
  return `$${Number(amount).toLocaleString('en-US')}`;
}

export function getAppDisplayName(detail, queueData) {
  if (detail?.borrower_names?.length) return detail.borrower_names.join(' & ');
  return queueData?.name || 'Application';
}

export function getRiskColor(score) {
  if (score == null) return 'var(--text-dim)';
  if (score <= 30) return 'var(--success)';
  if (score <= 50) return 'var(--mongo)';
  if (score <= 65) return 'var(--hitl-amber)';
  return 'var(--danger)';
}

// Floor-based human duration: "3m 5s", "1h 2s", "0s". Whole seconds only, so a
// live value never reads ahead of actual elapsed time.
export function formatDuration(ms) {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return '—';
  const totalSeconds = Math.floor(ms / 1000);
  const s = totalSeconds % 60;
  const m = Math.floor(totalSeconds / 60) % 60;
  const h = Math.floor(totalSeconds / 3600);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
