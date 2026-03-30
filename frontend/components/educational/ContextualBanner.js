"use client";

import { useState, useCallback, useEffect } from 'react';

const BANNER_KEY_PREFIX = 'lendflow-banner-';

export default function ContextualBanner({ id, children, accentColor = 'var(--mongo)', dimColor = 'var(--mongo-dim)', icon }) {
  const [dismissed, setDismissed] = useState(null);

  useEffect(() => {
    try { setDismissed(!!localStorage.getItem(BANNER_KEY_PREFIX + id)); }
    catch { setDismissed(false); }
  }, [id]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try { localStorage.setItem(BANNER_KEY_PREFIX + id, '1'); } catch {}
  }, [id]);

  if (dismissed === null || dismissed) return null;

  return (
    <div
      role="note"
      aria-label="Contextual information"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        background: dimColor,
        borderLeft: `3px solid ${accentColor}`,
        borderRadius: 'var(--radius-sm)',
        fontSize: 11,
        color: 'var(--text-secondary)',
        lineHeight: 1.5,
        marginBottom: 12,
      }}
    >
      {icon && <span style={{ fontSize: 14, flexShrink: 0 }}>{icon}</span>}
      <div style={{ flex: 1 }}>{children}</div>
      <button
        type="button"
        onClick={dismiss}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', fontSize: 14, padding: 4, flexShrink: 0 }}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
