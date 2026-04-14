"use client";

const STATUS_STYLES = {
  complete: { dot: 'var(--success)', bg: 'var(--success)', textColor: 'var(--text-primary)' },
  active: { dot: 'var(--agent-cyan)', bg: 'var(--agent-cyan)', textColor: 'var(--text-primary)' },
  upcoming: { dot: 'var(--border-base)', bg: 'transparent', textColor: 'var(--text-dim)' },
};

export default function ClosingTimeline({ data }) {
  if (!data || !data.steps) return null;

  return (
    <div style={{
      background: 'var(--bg-base)', border: '1px solid var(--border-dim)',
      borderRadius: 8, padding: 12, fontSize: 12,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', flexShrink: 0 }} />
        <span style={{
          fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-display)',
          color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          Closing Timeline
        </span>
      </div>

      {/* Steps */}
      <div style={{ position: 'relative', paddingLeft: 20 }}>
        {/* Vertical line */}
        <div style={{
          position: 'absolute', left: 5, top: 4, bottom: 4,
          width: 2, background: 'var(--border-dim)', borderRadius: 1,
        }} />

        {data.steps.map((step, idx) => {
          const cfg = STATUS_STYLES[step.status] || STATUS_STYLES.upcoming;
          const isLast = idx === data.steps.length - 1;

          return (
            <div key={step.label} style={{
              position: 'relative', paddingBottom: isLast ? 0 : 14,
              animation: `genUISlideIn 0.3s ease ${idx * 80}ms both`,
            }}>
              {/* Dot */}
              <div style={{
                position: 'absolute', left: -17, top: 2,
                width: 12, height: 12, borderRadius: '50%',
                background: step.status === 'complete' ? cfg.dot : 'var(--bg-base)',
                border: step.status === 'complete' ? 'none' : `2px solid ${cfg.dot}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: step.status === 'active' ? 'pulse 1.5s infinite' : 'none',
                zIndex: 1,
              }}>
                {step.status === 'complete' && (
                  <span style={{ fontSize: 7, color: '#fff', fontWeight: 800 }}>{'\u2713'}</span>
                )}
              </div>

              {/* Content */}
              <div style={{
                padding: '2px 8px',
                borderRadius: 6,
                background: step.status === 'active' ? 'var(--agent-cyan-dim)' : 'transparent',
                border: step.status === 'active' ? '1px solid var(--agent-cyan)' : '1px solid transparent',
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 600, color: cfg.textColor,
                  fontFamily: 'var(--font-display)',
                }}>
                  {step.label}
                </div>
                <div style={{
                  fontSize: 9, color: step.status === 'upcoming' ? 'var(--text-dim)' : 'var(--text-secondary)',
                  lineHeight: 1.4, marginTop: 1,
                }}>
                  {step.detail}
                </div>
                {step.date && (
                  <div style={{
                    fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)',
                    marginTop: 2,
                  }}>
                    {step.date}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
