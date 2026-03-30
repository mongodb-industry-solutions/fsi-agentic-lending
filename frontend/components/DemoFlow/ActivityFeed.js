"use client";

/**
 * Combined agent reasoning + MongoDB ops + memory from steps 0..stepIndex
 */
export default function ActivityFeed({ steps, stepIndex }) {
  const entries = [];
  let rCount = 0;
  let oCount = 0;
  let mCount = 0;
  for (let i = 0; i <= stepIndex && i < steps.length; i++) {
    const s = steps[i];
    if (s.reasoning) {
      rCount++;
      entries.push({
        type: 'reason',
        cls: s.reasoning.agent.toLowerCase().replace(/\s+/g, '-').replace('$', ''),
        icon: s.reasoning.icon,
        agent: s.reasoning.agent,
        text: s.reasoning.text,
        timing: s.reasoning.timing,
      });
    }
    (s.ops || []).forEach((op) => {
      oCount++;
      entries.push({ type: 'op', verb: op.verb, collection: op.collection, latency: op.latency });
    });
    if (s.memory) {
      mCount++;
      entries.push({
        type: 'mem',
        memType: s.memory.type,
        title: s.memory.title,
        detail: s.memory.detail,
      });
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 8 }}>
          Agent Reasoning <span style={{ fontFamily: 'var(--font-mono)', padding: '2px 6px', background: 'var(--bg-overlay)', borderRadius: 4 }}>{rCount}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {entries.filter((e) => e.type === 'reason').map((e, i) => (
            <div
              key={`r-${i}`}
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                borderLeft: '3px solid var(--border-dim)',
                background: 'var(--bg-surface)',
                fontSize: 12,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontWeight: 700, fontSize: 11 }}>
                <span>{e.icon} {e.agent}</span>
                <span style={{ color: 'var(--text-dim)' }}>{e.timing}</span>
              </div>
              <div style={{ color: 'var(--text-secondary)' }}>{e.text}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ maxHeight: 200, overflow: 'auto' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 8 }}>
          MongoDB Ops <span style={{ fontFamily: 'var(--font-mono)' }}>{oCount}</span>
        </div>
        {entries.filter((e) => e.type === 'op').map((e, i) => (
          <div key={`o-${i}`} style={{ display: 'flex', gap: 8, padding: '6px 0', fontSize: 11, borderBottom: '1px solid var(--border-dim)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, minWidth: 72 }}>{e.verb}</span>
            <span style={{ flex: 1, color: 'var(--text-secondary)' }}>{e.collection}</span>
            <span style={{ color: 'var(--text-dim)' }}>{e.latency}</span>
          </div>
        ))}
      </div>
      <div style={{ maxHeight: 140, overflow: 'auto' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 8 }}>
          Memory & Checkpoints <span style={{ fontFamily: 'var(--font-mono)' }}>{mCount}</span>
        </div>
        {entries.filter((e) => e.type === 'mem').map((e, i) => (
          <div key={`m-${i}`} style={{ display: 'flex', gap: 10, padding: '8px 0', fontSize: 11, borderBottom: '1px solid var(--border-dim)' }}>
            <span>{e.memType === 'checkpoint' ? '💾' : '🧠'}</span>
            <div>
              <div style={{ fontWeight: 600 }}>{e.title}</div>
              <div style={{ color: 'var(--text-dim)', fontSize: 10 }}>{e.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
