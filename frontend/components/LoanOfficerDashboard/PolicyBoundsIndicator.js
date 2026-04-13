export function PolicyBoundsIndicator({ exceeded, policyCitations }) {
  const bounds = policyCitations?.length > 0
    ? policyCitations.map((c) => ({ rule: c.detail || c.action || c, marker: 'ESC' }))
    : [
        { rule: 'Auto-approve if score > 80 and GDS < 36%', marker: 'PASS' },
        { rule: 'Escalate if property value > $500,000', marker: 'ESC' },
        { rule: 'Auto-decline if GDS > 50% or score < 35', marker: 'FAIL' },
      ];

  return (
    <div style={{
      position: 'absolute', top: 12, left: 12, zIndex: 10,
      padding: '10px 12px', width: 240,
      background: 'var(--bg-overlay-alpha)',
      backdropFilter: 'blur(8px)',
      borderRadius: 8,
      border: `1px solid ${exceeded ? 'var(--hitl-amber)' : 'var(--tool-blue)'}`,
      animation: 'slideDown 0.3s ease-out',
    }}>
      <div style={{
        fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
        color: exceeded ? 'var(--hitl-amber)' : 'var(--tool-blue)', marginBottom: 6,
      }}>
        {exceeded ? 'Boundary Exceeded — Escalating' : 'Active Policy Bounds'}
      </div>
      {bounds.map((b, i) => (
        <div key={i} style={{
          fontSize: 9, color: 'var(--text-secondary)', lineHeight: 1.6,
          opacity: exceeded && i >= bounds.length - 1 ? 1 : 0.8,
        }}>
          <span style={{
            display: 'inline-block', fontFamily: 'var(--font-mono)', fontSize: 7, fontWeight: 700,
            padding: '1px 3px', borderRadius: 2, marginRight: 4,
            background: b.marker === 'PASS' ? 'var(--success-dim)' : b.marker === 'FAIL' ? 'var(--danger-dim)' : 'var(--hitl-amber-dim)',
            color: b.marker === 'PASS' ? 'var(--success)' : b.marker === 'FAIL' ? 'var(--danger)' : 'var(--hitl-amber)',
          }}>{b.marker}</span>
          {b.rule}
        </div>
      ))}
    </div>
  );
}
