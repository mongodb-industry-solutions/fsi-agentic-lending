"use client";

import { useState } from 'react';
import { CAPABILITIES } from '../../lib/data/capabilities';

const colorMap = {
  mongo: { accent: 'var(--mongo)', dim: 'var(--mongo-dim)' },
  voyage: { accent: 'var(--voyage)', dim: 'var(--voyage-dim)' },
  'agent-cyan': { accent: 'var(--agent-cyan)', dim: 'var(--agent-cyan-dim)' },
  'tool-blue': { accent: 'var(--tool-blue)', dim: 'var(--tool-blue-dim)' },
  'hitl-amber': { accent: 'var(--hitl-amber)', dim: 'var(--hitl-amber-dim)' },
  danger: { accent: 'var(--danger)', dim: 'var(--danger-dim)' },
  success: { accent: 'var(--success)', dim: 'var(--success-dim)' },
};

export default function InfoChip({ capabilityId, children, label }) {
  const [expanded, setExpanded] = useState(false);
  const cap = CAPABILITIES.find((c) => c.id === capabilityId);
  if (!cap) return null;

  const colors = colorMap[cap.colorVar] || colorMap.mongo;
  const displayLabel = label || cap.label;
  const content = children || cap.oneLiner;
  const contentId = `infochip-${capabilityId}`;

  return (
    <span style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 8px',
          borderRadius: 10,
          border: `1px solid ${colors.accent}22`,
          background: colors.dim,
          color: colors.accent,
          fontFamily: 'var(--font-display)',
          fontSize: 10,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
        aria-expanded={expanded}
        aria-controls={contentId}
      >
        <span style={{ fontSize: 11 }}>{cap.icon}</span>
        {displayLabel}
        <span aria-hidden="true" style={{ fontSize: 8, transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'none' }}>▼</span>
      </button>
      {expanded && (
        <div
          id={contentId}
          role="region"
          aria-label={`${displayLabel} details`}
          style={{
            marginTop: 4,
            padding: '8px 10px',
            background: colors.dim,
            borderRadius: 'var(--radius-sm)',
            border: `1px solid ${colors.accent}22`,
            fontSize: 11,
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
            animation: 'slideDown 0.2s ease-out',
          }}
        >
          {content}
        </div>
      )}
    </span>
  );
}
