"use client";

import { useCountUp } from '../../lib/hooks/useCountUp';

export default function StatCard({ label, value, suffix = '', color = 'var(--mongo)', change, animate = true }) {
  const isNumeric = typeof value === 'number';
  const animatedValue = useCountUp(isNumeric ? value : 0, 1200, animate && isNumeric);
  const displayValue = isNumeric ? animatedValue : value;

  return (
    <div style={{
      padding: '10px 14px',
      background: 'var(--bg-surface)',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border-dim)',
      borderLeft: `3px solid ${color}`,
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 800, color }}>
          {displayValue}{suffix}
        </span>
        {typeof change === 'string' && change.length > 0 && (
          <span style={{
            fontSize: 10, fontWeight: 600,
            color: change.startsWith('+') ? 'var(--success)' : change.startsWith('-') ? 'var(--danger)' : 'var(--text-dim)',
          }}>
            {change}
          </span>
        )}
      </div>
    </div>
  );
}
