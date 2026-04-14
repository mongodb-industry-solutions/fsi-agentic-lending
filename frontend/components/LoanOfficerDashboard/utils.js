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
