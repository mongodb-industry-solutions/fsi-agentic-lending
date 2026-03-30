"use client";

const APPLICATIONS = [
  {
    id: 'APP-2026-00001',
    name: 'Marcus & Sofia Delgado',
    amount: '$875,000',
    product: '5yr Fixed',
    status: 'pending_review',
    statusLabel: 'Pending Review',
    statusColor: 'var(--hitl-amber)',
    score: 72,
    tier: 'B+',
    submitted: '10:14 AM',
  },
  {
    id: 'APP-2025-78298',
    name: 'Marcus Johnson',
    amount: '$420,000',
    product: '30yr Fixed',
    status: 'processing',
    statusLabel: 'Processing',
    statusColor: 'var(--agent-cyan)',
    score: null,
    tier: null,
    submitted: '9:47 AM',
  },
  {
    id: 'APP-2025-78215',
    name: 'Elena Rodriguez',
    amount: '$195,000',
    product: '15yr Fixed',
    status: 'approved',
    statusLabel: 'Approved',
    statusColor: 'var(--success)',
    score: 88,
    tier: 'A',
    submitted: '8:32 AM',
  },
  {
    id: 'APP-2025-78190',
    name: 'David Kim',
    amount: '$350,000',
    product: '30yr Fixed',
    status: 'funded',
    statusLabel: 'Funded',
    statusColor: 'var(--mongo)',
    score: 79,
    tier: 'B+',
    submitted: 'Yesterday',
  },
  {
    id: 'APP-2025-78143',
    name: 'Priya Patel',
    amount: '$510,000',
    product: 'ARM 7/1',
    status: 'processing',
    statusLabel: 'Underwriting',
    statusColor: 'var(--tool-blue)',
    score: null,
    tier: null,
    submitted: '7:55 AM',
  },
  {
    id: 'APP-2025-78091',
    name: 'James Wilson',
    amount: '$175,000',
    product: 'Personal',
    status: 'declined',
    statusLabel: 'Declined',
    statusColor: 'var(--danger)',
    score: 41,
    tier: 'D',
    submitted: 'Yesterday',
  },
];

export default function ApplicationQueue({ selectedId, onSelect, liveApplications = [] }) {
  // Merge live applications from backend with hardcoded demo data (deduplicated)
  const liveIds = new Set(liveApplications.map(a => a.application_id));
  const allApplications = [
    ...liveApplications.map(app => ({
      id: app.application_id,
      name: app.borrower_names?.join(' & ') || app.primary_name || 'Unknown',
      amount: `$${(app.loan_amount || 0).toLocaleString()}`,
      product: app.product || '',
      status: app.status || 'submitted',
      statusLabel: (app.status || 'submitted').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      statusColor: 'var(--agent-cyan)',
      score: null,
      tier: null,
      submitted: 'Live',
      isLive: true,
    })),
    ...APPLICATIONS.filter(app => !liveIds.has(app.id)),
  ];

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
          {allApplications.length} applications · {allApplications.filter((a) => a.status === 'pending_review').length} pending review
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {allApplications.map((app) => {
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
                  background: `color-mix(in srgb, ${app.statusColor} 12%, transparent)`,
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
                {app.score && <span>· Score: {app.score} ({app.tier})</span>}
                <span style={{ marginLeft: 'auto' }}>{app.submitted}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { APPLICATIONS };
