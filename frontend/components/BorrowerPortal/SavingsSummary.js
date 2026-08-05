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

export function SavingsSummary({ stageContext = {} }) {
  const rate = typeof stageContext.approvedRate === 'number' ? stageContext.approvedRate : null;
  const payment = typeof stageContext.monthlyPayment === 'number' ? stageContext.monthlyPayment : null;
  const loanAmount = typeof stageContext.loanAmount === 'number' ? stageContext.loanAmount : null;

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
        Your Approval Summary
      </div>
      <div style={{
        fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.5,
        marginBottom: spacing[3],
      }}>
        Your mortgage is approved. Here are your key terms — your Personal Lending
        Assistant can explain any of them and walk you through the next steps.
      </div>
      <div style={{ display: 'flex', gap: spacing[2], flexWrap: 'wrap' }}>
        {rate !== null && <SavingsMetric label="Approved Rate" value={+(rate * 100).toFixed(2)} suffix="%" />}
        {payment !== null && <SavingsMetric label="Monthly Payment" value={payment} prefix="$" />}
        {loanAmount !== null && <SavingsMetric label="Loan Amount" value={loanAmount} prefix="$" />}
      </div>
    </div>
  );
}
