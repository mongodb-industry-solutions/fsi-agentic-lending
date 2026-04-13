"use client";

import Badge from '@leafygreen-ui/badge';
import { spacing } from '@leafygreen-ui/tokens';

function getStatusVariant(status) {
  const map = {
    submitted: 'blue',
    processing: 'blue',
    underwriting: 'blue',
    review: 'yellow',
    pending_review: 'yellow',
    approved: 'green',
    funded: 'green',
    active: 'green',
    declined: 'red',
    error: 'red',
  };
  return map[status] || 'lightgray';
}

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
    amount: typeof app.loan_amount === 'number' ? `$${app.loan_amount.toLocaleString('en-US')}` : (app.amount || ''),
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
      flex: '0 1 280px',
      minWidth: 200,
      maxWidth: 320,
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
        <div style={{ fontSize: 10, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
          {formatted.length} application{formatted.length !== 1 ? 's' : ''} · {formatted.filter((a) => a.status === 'review' || a.status === 'pending_review').length} pending review
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 6px', borderRadius: 8,
            background: 'var(--mongo-dim)', color: 'var(--mongo)',
            fontSize: 9, fontWeight: 700, marginLeft: 6,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--mongo)', animation: 'pulse 1.5s infinite' }} />
            Change Streams
          </span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {formatted.length === 0 && (
          <div style={{
            margin: spacing[3], padding: spacing[4], textAlign: 'center',
            border: '2px dashed var(--border-dim)', borderRadius: 8,
            background: '#FAFBFA',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              border: '2px dashed var(--border-dim)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 8px',
              fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
              color: 'var(--text-dim)', opacity: 0.5,
            }}>0</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 4 }}>
              No applications yet
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              Submit one from the Borrower Portal.
            </div>
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
                <Badge variant={getStatusVariant(app.status)}>
                  {app.statusLabel}
                </Badge>
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
