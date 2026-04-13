export function formatCurrency(amount) {
  if (amount == null) return 'N/A';
  return `$${Number(amount).toLocaleString('en-US')}`;
}

export function getAppDisplayName(detail, queueData) {
  if (detail?.borrower_names?.length) return detail.borrower_names.join(' & ');
  return queueData?.name || 'Application';
}
