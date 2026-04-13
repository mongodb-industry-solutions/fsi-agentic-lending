"use client";

import { useEffect, useRef } from 'react';
import Icon from '@leafygreen-ui/icon';
import { spacing } from '@leafygreen-ui/tokens';
import { CAPABILITIES } from '../../lib/data/capabilities';
import { colorMap, dimMap } from '../../lib/data/colorMaps';
import { uiTokens } from '../../lib/uiTokens';

export default function CapabilityPopover({ capabilityId, onClose = () => {}, style = {} }) {
  const ref = useRef(null);
  const cap = CAPABILITIES.find((c) => c.id === capabilityId);

  useEffect(() => {
    if (!cap) return;
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose, cap]);

  if (!cap) return null;

  const accent = colorMap[cap.colorVar] || colorMap.mongo;
  const dim = dimMap[cap.colorVar] || dimMap.mongo;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`${cap.label} details`}
      style={{
        position: 'fixed',
        zIndex: 100,
        width: 340,
        padding: spacing[3],
        background: 'var(--bg-base)',
        borderRadius: 8,
        border: '1px solid var(--border-base)',
        boxShadow: uiTokens.shadowElevated,
        animation: 'slideDown 0.2s ease-out',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2], marginBottom: spacing[200] }}>
        <Icon glyph={cap.glyph} size="large" />
        <div>
          <div style={{ fontFamily: uiTokens.font, fontWeight: 700, fontSize: 14, color: accent }}>{cap.label}</div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Replaces: {cap.replaces}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          onFocus={(e) => { e.currentTarget.style.boxShadow = uiTokens.focusRing; }}
          onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
          style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', fontSize: 16, padding: spacing[1], outline: 'none' }}
          aria-label={`Close ${cap.label} popover`}
        >
          ×
        </button>
      </div>

      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: spacing[150] }}>{cap.oneLiner}</div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: spacing[3] }}>{cap.description}</div>

      <div style={{ padding: spacing[200], background: 'var(--bg-raised)', borderRadius: 8, overflow: 'auto' }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: spacing[150] }}>MongoDB Query</div>
        <pre style={{
          fontFamily: uiTokens.monoFont,
          fontSize: 10,
          lineHeight: 1.5,
          color: 'var(--text-secondary)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          margin: 0,
        }}>
          {cap.code}
        </pre>
      </div>

      <div style={{ marginTop: spacing[200], fontSize: 9, color: 'var(--text-dim)' }}>
        {cap.demoScene}
      </div>
    </div>
  );
}
