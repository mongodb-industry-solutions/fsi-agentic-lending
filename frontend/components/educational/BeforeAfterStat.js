"use client";

export default function BeforeAfterStat({ before, after, beforeLabel = "Traditional", afterLabel = "With LendFlow AI" }) {
  return (
    <div role="group" aria-label={`Comparison: ${beforeLabel} vs ${afterLabel}`} style={{ display: 'inline-flex', gap: 16, padding: '6px 12px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-dim)', fontSize: 10 }}>
      <div>
        <div style={{ fontSize: 8, textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 2 }}>{beforeLabel}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--danger)' }}>{before}</div>
      </div>
      <div style={{ width: 1, background: 'var(--border-dim)' }} />
      <div>
        <div style={{ fontSize: 8, textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 2 }}>{afterLabel}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--mongo)' }}>{after}</div>
      </div>
    </div>
  );
}
