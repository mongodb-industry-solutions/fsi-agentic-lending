"use client";

const STATUS_COLORS = {
  submitted: 'var(--agent-cyan)',
  processing: 'var(--agent-cyan)',
  underwriting: 'var(--tool-blue)',
  review: 'var(--hitl-amber)',
  pending_review: 'var(--hitl-amber)',
  approved: 'var(--success)',
  funded: 'var(--mongo)',
  declined: 'var(--danger)',
  error: 'var(--danger)',
  active: 'var(--mongo)',
};

export default function ApplicationQueue({ selectedId, onSelect, applications = [] }) {
  const formatted = applications.map(app => ({
    id: app.application_id || app.id,
    name: app.borrower_names?.join(' & ') || app.name || 'Unknown',
    amount: typeof app.loan_amount === 'number' ? `$${app.loan_amount.toLocaleString()}` : (app.amount || ''),
    product: app.product || '',
    status: app.status || 'submitted',
    statusLabel: (app.status || 'submitted').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    statusColor: STATUS_COLORS[app.status] || 'var(--text-dim)',
    score: app.risk_score ?? app.score ?? null,
    tier: app.risk_tier ?? app.tier ?? null,
    submitted: app.created_at ? new Date(app.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
  }));

  return (
    <div style={{
      width: 280,
      borderRight: '1px solid var(--border-dim)',
      background: 'var(--bg-base)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-dim)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
          Application Queue
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
          {formatted.length} application{formatted.length !== 1 ? 's' : ''} · {formatted.filter((a) => a.status === 'review' || a.status === 'pending_review').length} pending review
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {formatted.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)', fontSize: 11 }}>
            No applications yet. Submit one from the Borrower Portal.
          </div>
        )}
        {formatted.map((app) => {
          const isSelected = app.id === selectedId;
          return (
            <button
              key={app.id}
              type="button"
              onClick={() => onSelect(app.id)}
              style={{
                all: 'unset',
                display: 'block',
                width: '100%',
                padding: '10px 16px',
                borderBottom: '1px solid var(--border-dim)',
                background: isSelected ? 'var(--mongo-dim)' : 'transparent',
                cursor: 'pointer',
                boxSizing: 'border-box',
                transition: 'background 0.15s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                <span style={{ fontWeight: 600, fontSize: 12, color: isSelected ? 'var(--mongo)' : 'var(--text-primary)' }}>
                  {app.name}
                </span>
                <span style={{
                  fontSize: 8,
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: 8,
                  color: app.statusColor,
                  background: `${app.statusColor}1a`,
                }}>
                  {app.statusLabel}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-dim)' }}>
                  {app.id}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                  {app.amount}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 3, fontSize: 9, color: 'var(--text-dim)' }}>
                <span>{app.product}</span>
                {app.score != null && <span>· Score: {app.score} ({app.tier})</span>}
                <span style={{ marginLeft: 'auto' }}>{app.submitted}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
