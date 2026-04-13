"use client";

import FeatureBadge from '../FeatureBadge/FeatureBadge';
import { CAPABILITIES } from '../../lib/data/capabilities';

const CAP_BY_ID = Object.fromEntries(CAPABILITIES.map((c) => [c.id, c]));
const ORDER = ['document', 'changeStreams', 'aggregation', 'vectorSearch', 'graphLookup', 'timeSeries'];

export default function FeatureBar({ activeFeatures }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 16px',
        background: 'var(--bg-base)',
        borderBottom: '1px solid var(--border-dim)',
        flexWrap: 'wrap',
      }}
    >
      {ORDER.map((id) => {
        const cap = CAP_BY_ID[id];
        if (!cap) return null;
        const active = activeFeatures.includes(id);
        return (
          <FeatureBadge
            key={id}
            glyph={cap.glyph}
            label={cap.label}
            colorVar={cap.colorVar}
            active={active}
            small
          />
        );
      })}
      {activeFeatures.length >= 6 && (
        <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--mongo)', fontWeight: 600 }}>
          1 platform · 6 capabilities
        </span>
      )}
    </div>
  );
}
