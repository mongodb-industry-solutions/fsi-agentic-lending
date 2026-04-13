"use client";

import { useEffect, useRef } from 'react';
import Icon from '@leafygreen-ui/icon';
import { CAPABILITIES } from '../../lib/data/capabilities';
import { colorMap, dimMap } from '../../lib/data/colorMaps';

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
        padding: 16,
        background: 'var(--bg-base)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-base)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        animation: 'slideDown 0.2s ease-out',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Icon glyph={cap.glyph} size="large" />
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: accent }}>{cap.label}</div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Replaces: {cap.replaces}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', fontSize: 16, padding: 4 }}
          aria-label={`Close ${cap.label} popover`}
        >
          ×
        </button>
      </div>

      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{cap.oneLiner}</div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>{cap.description}</div>

      <div style={{ padding: 10, background: 'var(--bg-raised)', borderRadius: 'var(--radius-sm)', overflow: 'auto' }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 6 }}>MongoDB Query</div>
        <pre style={{
          fontFamily: 'var(--font-mono)',
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

      <div style={{ marginTop: 10, fontSize: 9, color: 'var(--text-dim)' }}>
        {cap.demoScene}
      </div>
    </div>
  );
}
