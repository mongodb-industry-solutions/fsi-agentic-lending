"use client";

const STATUS_CONFIG = {
  verified: { dot: 'var(--success)', label: 'Verified', icon: '\u2713' },
  processed: { dot: 'var(--success)', label: 'Processed', icon: '\u2713' },
  parsed: { dot: 'var(--success)', label: 'Verified', icon: '\u2713' },
  processing: { dot: 'var(--hitl-amber)', label: 'Processing', icon: null },
  error: { dot: 'var(--danger)', label: 'Error', icon: '\u2717' },
  missing: { dot: 'var(--text-dim)', label: 'Missing', icon: null },
};

export default function DocumentChecklist({ data }) {
  if (!data || !data.items) return null;
  const { items, complete, total } = data;
  const progressPct = total > 0 ? (complete / total) * 100 : 0;

  return (
    <div style={{
      background: 'var(--bg-base)', border: '1px solid var(--border-dim)',
      borderRadius: 8, padding: 12, fontSize: 12,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--tool-blue)', flexShrink: 0,
          }} />
          <span style={{
            fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-display)',
            color: 'var(--text-primary)', textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}>
            Document Checklist
          </span>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-mono)',
          color: progressPct === 100 ? 'var(--success)' : 'var(--text-secondary)',
        }}>
          {complete}/{total}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{
        height: 4, borderRadius: 2, background: 'var(--border-dim)',
        marginBottom: 10, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', borderRadius: 2,
          background: progressPct === 100 ? 'var(--success)' : 'var(--mongo)',
          width: `${progressPct}%`,
          transition: 'width 400ms ease',
          animation: 'progressFill 0.8s ease-out both',
        }} />
      </div>

      {/* Items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((item) => {
          const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.missing;
          const isMissing = item.status === 'missing';
          const isProcessing = item.status === 'processing';

          return (
            <div key={item.type} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '4px 6px', borderRadius: 4,
              background: isMissing && item.required ? 'var(--danger-dim)' : 'transparent',
            }}>
              {/* Status dot */}
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: cfg.dot, flexShrink: 0,
                animation: isProcessing ? 'pulse 1.5s infinite' : 'none',
              }}>
                {cfg.icon && (
                  <span style={{
                    fontSize: 6, color: '#fff', fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '100%', height: '100%', lineHeight: 1,
                  }}>
                    {cfg.icon}
                  </span>
                )}
              </div>

              {/* Label */}
              <span style={{
                flex: 1, fontSize: 11, color: 'var(--text-primary)',
                fontWeight: isMissing && item.required ? 600 : 400,
                minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {item.label}
              </span>

              {/* Required badge */}
              {isMissing && item.required && (
                <span style={{
                  fontSize: 8, fontWeight: 700, padding: '1px 4px',
                  borderRadius: 3, background: 'var(--danger)',
                  color: '#fff', textTransform: 'uppercase', flexShrink: 0,
                }}>
                  Required
                </span>
              )}
              {isMissing && !item.required && (
                <span style={{
                  fontSize: 8, fontWeight: 600, padding: '1px 4px',
                  borderRadius: 3, border: '1px solid var(--border-dim)',
                  color: 'var(--text-dim)', textTransform: 'uppercase', flexShrink: 0,
                }}>
                  Optional
                </span>
              )}
              {!isMissing && (
                <span style={{
                  fontSize: 8, fontWeight: 600, color: cfg.dot,
                  fontFamily: 'var(--font-mono)', flexShrink: 0,
                }}>
                  {cfg.label}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
