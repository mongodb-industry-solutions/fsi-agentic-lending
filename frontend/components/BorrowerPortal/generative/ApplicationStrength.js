"use client";

const RATING_COLORS = {
  Excellent: 'var(--success)',
  Good: 'var(--agent-cyan)',
  Fair: 'var(--hitl-amber)',
};

const OVERALL_MESSAGES = {
  Strong: 'Your application is tracking well. Continue to respond promptly to any requests.',
  Good: 'Your application is progressing. Providing any requested documents will help move things along.',
  Fair: 'Our team is reviewing your application. You may be asked for additional information.',
};

export default function ApplicationStrength({ data }) {
  if (!data || !data.factors) return null;

  const overallColor = data.overall === 'Strong' ? 'var(--success)'
    : data.overall === 'Good' ? 'var(--agent-cyan)' : 'var(--hitl-amber)';

  return (
    <div style={{
      background: 'var(--bg-base)', border: '1px solid var(--border-dim)',
      borderRadius: 8, padding: 12, fontSize: 12,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: overallColor, flexShrink: 0,
          }} />
          <span style={{
            fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-display)',
            color: 'var(--text-primary)', textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}>
            Application Strength
          </span>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 8px',
          borderRadius: 4, fontFamily: 'var(--font-display)',
          background: `${overallColor}18`, color: overallColor,
          border: `1px solid ${overallColor}33`,
        }}>
          {data.overall}
        </span>
      </div>

      {/* Factor bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.factors.map((factor, idx) => {
          const color = RATING_COLORS[factor.rating] || 'var(--text-dim)';
          return (
            <div key={factor.label} style={{
              animation: `genUISlideIn 0.3s ease ${idx * 80}ms both`,
            }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'baseline', marginBottom: 3,
              }}>
                <span style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 500 }}>
                  {factor.label}
                </span>
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '1px 6px',
                  borderRadius: 3, color,
                  background: `${color}15`,
                  fontFamily: 'var(--font-display)',
                }}>
                  {factor.rating}
                </span>
              </div>
              <div style={{
                height: 5, borderRadius: 3, background: 'var(--border-dim)',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', borderRadius: 3, background: color,
                  width: `${factor.value}%`,
                  transition: 'width 400ms ease',
                  animation: `progressFill 0.6s ease-out ${idx * 100}ms both`,
                }} />
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>
                {factor.detail}
              </div>
            </div>
          );
        })}
      </div>

      {/* Encouraging message */}
      <div style={{
        marginTop: 10, padding: '8px 10px', borderRadius: 6,
        background: `${overallColor}08`, border: `1px solid ${overallColor}18`,
        fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.5,
      }}>
        {OVERALL_MESSAGES[data.overall] || OVERALL_MESSAGES.Good}
      </div>
    </div>
  );
}
