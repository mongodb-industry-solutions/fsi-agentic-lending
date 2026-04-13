"use client";

import Badge from '@leafygreen-ui/badge';
import { CAPABILITIES } from '../../lib/data/capabilities';
import { colorMap, dimMap } from '../../lib/data/colorMaps';

export default function TechBreadcrumb({ activatedCapabilities = [] }) {
  const activeSet = new Set(activatedCapabilities);
  const activeCount = CAPABILITIES.filter((c) => activeSet.has(c.id)).length;
  const allActive = activeCount === CAPABILITIES.length;

  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, padding: '4px 12px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-dim)' }}>
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
      <span style={{ marginLeft: 'auto' }}>
        <Badge variant={allActive ? 'green' : 'lightgray'}>
          {activeCount}/{CAPABILITIES.length}
        </Badge>
      </span>
    </div>
  );
}
