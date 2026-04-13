"use client";

import { useState } from 'react';
import Icon from '@leafygreen-ui/icon';
import { spacing } from '@leafygreen-ui/tokens';
import { CAPABILITIES } from '../../lib/data/capabilities';
import { colorMap as rawColorMap, dimMap as rawDimMap } from '../../lib/data/colorMaps';
import { uiTokens } from '../../lib/uiTokens';

export default function InfoChip({ capabilityId, children, label }) {
  const [expanded, setExpanded] = useState(false);
  const cap = CAPABILITIES.find((c) => c.id === capabilityId);
  if (!cap) return null;

  const accent = rawColorMap[cap.colorVar] || rawColorMap.mongo;
  const dim = rawDimMap[cap.colorVar] || rawDimMap.mongo;
  const colors = { accent, dim };
  const displayLabel = label || cap.label;
  const content = children || cap.oneLiner;
  const contentId = `infochip-${capabilityId}`;

  return (
    <span style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        onFocus={(e) => { e.currentTarget.style.boxShadow = uiTokens.focusRing; }}
        onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: spacing[1],
          padding: `2px ${spacing[2]}px`,
          borderRadius: 8,
          border: `1px solid ${colors.accent}22`,
          background: colors.dim,
          color: colors.accent,
          fontFamily: uiTokens.font,
          fontSize: 10,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.2s',
          outline: 'none',
        }}
        aria-expanded={expanded}
        aria-controls={contentId}
      >
        <Icon glyph={cap.glyph} size={12} />
        {displayLabel}
        <span aria-hidden="true" style={{ fontSize: 8, transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'none' }}>▼</span>
      </button>
      {expanded && (
        <div
          id={contentId}
          role="region"
          aria-label={`${displayLabel} details`}
          style={{
            marginTop: spacing[1],
            padding: `${spacing[2]}px ${spacing[200]}px`,
            background: colors.dim,
            borderRadius: 8,
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
