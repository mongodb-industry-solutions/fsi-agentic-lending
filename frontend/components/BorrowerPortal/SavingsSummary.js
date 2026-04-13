"use client";

import { spacing } from '@leafygreen-ui/tokens';
import { useCountUp } from '../../lib/hooks/useCountUp';

export function SavingsMetric({ label, value, prefix = '', suffix = '' }) {
  const num = typeof value === 'number' ? value : 0;
  const animated = useCountUp(num, 1200, true);
  return (
    <div style={{
      flex: 1, padding: spacing[2],
      background: 'var(--bg-raised)', borderRadius: 6,
      textAlign: 'center',
    }}>
      <div style={{
        fontSize: 8, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.05em', color: 'var(--text-dim)', marginBottom: 4,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 800,
        color: 'var(--success)',
      }}>
        {prefix}{animated.toLocaleString('en-US')}{suffix}
      </div>
    </div>
  );
}

export function SavingsSummary({ interventionsResolved }) {
  return (
    <div style={{
      padding: spacing[3],
      background: 'var(--success-dim)',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--success)',
      marginTop: spacing[3],
      animation: 'cardEnter 0.4s cubic-bezier(0.33, 1, 0.68, 1) both',
    }}>
      <div style={{
        fontFamily: 'var(--font-display)', fontWeight: 700,
        fontSize: 13, color: 'var(--success)', marginBottom: spacing[2],
      }}>
        AI Impact Summary
      </div>
      <div style={{
        fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.5,
        marginBottom: spacing[3],
      }}>
        Without AI intervention, your application would have scored 68 (B tier) with a higher rate of 5.24%.
      </div>
      <div style={{ display: 'flex', gap: spacing[2] }}>
        <SavingsMetric label="Issues Resolved" value={interventionsResolved} />
        <SavingsMetric label="Score Improvement" value={4} prefix="+" suffix=" pts" />
        <SavingsMetric label="Rate Improvement" value={35} prefix="-" suffix=" bps" />
        <SavingsMetric label="Lifetime Savings" value={40500} prefix="$" />
      </div>
    </div>
  );
}
