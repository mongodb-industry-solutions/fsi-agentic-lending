"use client";

import { calcCanadianMonthlyPayment, formatCurrency } from './utils';

function DiffArrow({ current, alternative, lowerIsBetter = true }) {
  if (current === alternative) return null;
  const isBetter = lowerIsBetter ? alternative < current : alternative > current;
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, marginLeft: 4,
      color: isBetter ? 'var(--success)' : 'var(--danger)',
    }}>
      {isBetter ? '\u2193' : '\u2191'}
    </span>
  );
}

function MetricRow({ label, currentVal, altVal, format, lowerIsBetter = true }) {
  const fmtCurrent = format ? format(currentVal) : currentVal;
  const fmtAlt = format ? format(altVal) : altVal;

  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      padding: '3px 0', borderBottom: '1px solid var(--border-dim)',
      fontSize: 10,
    }}>
      <span style={{ flex: 1, color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ width: 80, textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>
        {fmtCurrent}
      </span>
      <span style={{ width: 80, textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>
        {fmtAlt}
        <DiffArrow current={currentVal} alternative={altVal} lowerIsBetter={lowerIsBetter} />
      </span>
    </div>
  );
}

export default function ScenarioComparison({ data }) {
  if (!data) return null;

  const purchasePrice = data.purchase_price || 600000;
  const income = data.combined_income || 120000;
  const propTax = data.annual_property_tax || 3000;
  const debt = data.existing_monthly_debt || 0;
  const rate = 4.99;
  const years = 25;

  // Current scenario
  const currentDown = data.down_payment || purchasePrice * 0.20;
  const currentLoan = purchasePrice - currentDown;
  const currentMonthly = calcCanadianMonthlyPayment(currentLoan, rate, years);
  const currentGds = ((currentMonthly + propTax / 12) / (income / 12)) * 100;
  const currentTds = ((currentMonthly + propTax / 12 + debt) / (income / 12)) * 100;
  const currentInterest = (currentMonthly * years * 12) - currentLoan;

  // Alternative: 25% down
  const altDownPct = currentDown / purchasePrice >= 0.25 ? 0.15 : 0.25;
  const altDown = purchasePrice * altDownPct;
  const altLoan = purchasePrice - altDown;
  const altMonthly = calcCanadianMonthlyPayment(altLoan, rate, years);
  const altGds = ((altMonthly + propTax / 12) / (income / 12)) * 100;
  const altTds = ((altMonthly + propTax / 12 + debt) / (income / 12)) * 100;
  const altInterest = (altMonthly * years * 12) - altLoan;

  const currentDownPct = Math.round((currentDown / purchasePrice) * 100);
  const altDownPctDisplay = Math.round(altDownPct * 100);

  return (
    <div style={{
      background: 'var(--bg-base)', border: '1px solid var(--border-dim)',
      borderRadius: 8, padding: 12, fontSize: 12,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--agent-cyan)', flexShrink: 0 }} />
        <span style={{
          fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-display)',
          color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          Scenario Comparison
        </span>
      </div>

      {/* Column headers */}
      <div style={{
        display: 'flex', alignItems: 'center', padding: '4px 0',
        borderBottom: '2px solid var(--border-dim)', marginBottom: 4,
      }}>
        <span style={{ flex: 1, fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Metric</span>
        <span style={{
          width: 80, textAlign: 'right', fontSize: 9, fontWeight: 700,
          color: 'var(--mongo)', textTransform: 'uppercase',
          fontFamily: 'var(--font-display)',
        }}>
          Current ({currentDownPct}%)
        </span>
        <span style={{
          width: 80, textAlign: 'right', fontSize: 9, fontWeight: 700,
          color: 'var(--agent-cyan)', textTransform: 'uppercase',
          fontFamily: 'var(--font-display)',
        }}>
          Alt ({altDownPctDisplay}%)
        </span>
      </div>

      <MetricRow label="Down Payment" currentVal={currentDown} altVal={altDown} format={formatCurrency} lowerIsBetter={false} />
      <MetricRow label="Loan Amount" currentVal={currentLoan} altVal={altLoan} format={formatCurrency} />
      <MetricRow label="Monthly Payment" currentVal={currentMonthly} altVal={altMonthly} format={formatCurrency} />
      <MetricRow label="GDS Ratio" currentVal={currentGds} altVal={altGds} format={v => `${v.toFixed(1)}%`} />
      <MetricRow label="TDS Ratio" currentVal={currentTds} altVal={altTds} format={v => `${v.toFixed(1)}%`} />
      <MetricRow label="Total Interest" currentVal={currentInterest} altVal={altInterest} format={formatCurrency} />

      <div style={{
        fontSize: 9, color: 'var(--text-dim)', marginTop: 8,
        lineHeight: 1.4, fontStyle: 'italic',
      }}>
        {altDownPct > currentDown / purchasePrice
          ? `Increasing your down payment to ${altDownPctDisplay}% would reduce your monthly payment by ${formatCurrency(currentMonthly - altMonthly)} and save ${formatCurrency(currentInterest - altInterest)} in total interest.`
          : `Reducing your down payment to ${altDownPctDisplay}% would increase your monthly payment by ${formatCurrency(altMonthly - currentMonthly)}.`
        }
      </div>
    </div>
  );
}
