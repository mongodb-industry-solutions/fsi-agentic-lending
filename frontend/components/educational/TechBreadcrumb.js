"use client";

import { CAPABILITIES } from '../../lib/data/capabilities';

const colorMap = {
  mongo: 'var(--mongo)',
  voyage: 'var(--voyage)',
  'agent-cyan': 'var(--agent-cyan)',
  'tool-blue': 'var(--tool-blue)',
  'hitl-amber': 'var(--hitl-amber)',
  danger: 'var(--danger)',
  success: 'var(--success)',
};

const dimMap = {
  mongo: 'var(--mongo-dim)',
  voyage: 'var(--voyage-dim)',
  'agent-cyan': 'var(--agent-cyan-dim)',
  'tool-blue': 'var(--tool-blue-dim)',
  'hitl-amber': 'var(--hitl-amber-dim)',
  danger: 'var(--danger-dim)',
  success: 'var(--success-dim)',
};

export default function TechBreadcrumb({ activatedCapabilities = [] }) {
  const activeSet = new Set(activatedCapabilities);
  const activeCount = CAPABILITIES.filter((c) => activeSet.has(c.id)).length;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 12px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-dim)' }}>
      <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginRight: 6 }}>
        MongoDB
      </span>
      {CAPABILITIES.map((cap, i) => {
        const active = activeSet.has(cap.id);
        const accent = colorMap[cap.colorVar] || colorMap.mongo;
        const dim = dimMap[cap.colorVar] || dimMap.mongo;
        return (
          <span key={cap.id} style={{ display: 'inline-flex', alignItems: 'center' }}>
            <span
              title={cap.label}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                padding: '2px 6px',
                borderRadius: 8,
                fontSize: 9,
                fontWeight: 600,
                background: active ? dim : 'transparent',
                color: active ? accent : 'var(--text-dim)',
                opacity: active ? 1 : 0.35,
                transition: 'all 0.4s',
                border: active ? `1px solid ${accent}22` : '1px solid transparent',
              }}
            >
              <span style={{ fontSize: 10 }}>{cap.icon}</span>
              {cap.label}
            </span>
            {i < CAPABILITIES.length - 1 && (
              <span style={{ fontSize: 8, color: active ? accent : 'var(--text-dim)', margin: '0 1px', opacity: active ? 0.6 : 0.2 }}>→</span>
            )}
          </span>
        );
      })}
      <span style={{ marginLeft: 'auto', fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--mongo)', fontWeight: 700 }}>
        {activeCount}/{CAPABILITIES.length}
      </span>
    </div>
  );
}
