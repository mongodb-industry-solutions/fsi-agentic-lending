"use client";

export default function HITLOverlay({ onApprove, onDecline }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 480,
          width: '100%',
          padding: 28,
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border-base)',
        }}
      >
        <div style={{ marginBottom: 20 }}>
          <div style={{ padding: '6px 12px', background: 'var(--hitl-amber-dim)', color: 'var(--hitl-amber)', borderRadius: 20, fontSize: 12, fontWeight: 700, display: 'inline-block', marginBottom: 12 }}>
            ⏸ Human Review Required
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18 }}>
            LangGraph interrupt() triggered
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>Risk Score</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--hitl-amber)' }}>72 <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>/ 100</span></div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>Loan Amount</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>$285K</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>Proposed Rate</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--mongo)' }}>6.875%</div>
          </div>
        </div>
        <div style={{ padding: 12, background: 'var(--bg-overlay)', borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
          Applicant <strong>Sarah Chen</strong> qualifies for 30-year fixed at <strong>6.875% APR</strong>. Risk tier <strong>B+</strong>. 3 recent hard inquiries triggered review per policy §4.2.1.
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            type="button"
            onClick={onApprove}
            style={{
              flex: 1,
              padding: 14,
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: 'var(--mongo)',
              color: 'var(--bg-void)',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ✓ Approve Loan
          </button>
          <button
            type="button"
            onClick={onApprove}
            style={{
              flex: 1,
              padding: 14,
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-base)',
              background: 'var(--bg-raised)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ✎ Modify Terms
          </button>
          <button
            type="button"
            onClick={onDecline}
            style={{
              flex: 1,
              padding: 14,
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--danger)',
              background: 'transparent',
              color: 'var(--danger)',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ✕ Decline
          </button>
        </div>
        <div style={{ marginTop: 16, fontSize: 11, color: 'var(--text-dim)' }}>
          🍃 State saved to MongoDB — MongoDBSaver.checkpoint(cp-9a3f21) — workflow will resume from this point
        </div>
      </div>
    </div>
  );
}
