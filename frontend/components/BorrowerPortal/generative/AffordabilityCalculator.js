"use client";

import { useState, useMemo } from 'react';
import { calcCanadianMonthlyPayment, formatCurrency } from './utils';

const TERM_OPTIONS = [15, 20, 25, 30];

function GDSTDSGauge({ label, value, greenMax, amberMax, limit }) {
  const pct = Math.min((value / limit) * 100, 100);
  const color = value <= greenMax ? 'var(--success)' : value <= amberMax ? 'var(--hitl-amber)' : 'var(--danger)';

  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'var(--font-display)' }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color }}>{value.toFixed(1)}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'var(--border-dim)', overflow: 'hidden', position: 'relative' }}>
        {/* Zone markers */}
        <div style={{
          position: 'absolute', left: `${(greenMax / limit) * 100}%`, top: 0, bottom: 0,
          width: 1, background: 'var(--success)', opacity: 0.3,
        }} />
        <div style={{
          position: 'absolute', left: `${(amberMax / limit) * 100}%`, top: 0, bottom: 0,
          width: 1, background: 'var(--hitl-amber)', opacity: 0.3,
        }} />
        {/* Value bar */}
        <div style={{
          height: '100%', width: `${pct}%`, borderRadius: 3, background: color,
          transition: 'width 300ms ease, background 300ms ease',
          animation: 'progressFill 0.6s ease-out both',
        }} />
      </div>
      <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>
        Limit: {limit}%
      </div>
    </div>
  );
}

export default function AffordabilityCalculator({ data }) {
  const purchasePrice = data.purchase_price || 500000;
  const combinedIncome = data.combined_income || 100000;
  const annualPropertyTax = data.annual_property_tax || 3000;
  const existingDebt = data.existing_monthly_debt || 0;
  const initialDownPct = purchasePrice > 0 ? Math.round((data.down_payment || 0) / purchasePrice * 100) : 20;

  const [rate, setRate] = useState(4.99);
  const [termYears, setTermYears] = useState(25);
  const [downPct, setDownPct] = useState(Math.max(5, Math.min(50, initialDownPct)));

  const calculations = useMemo(() => {
    const downPayment = purchasePrice * (downPct / 100);
    const loanAmount = purchasePrice - downPayment;
    const monthly = calcCanadianMonthlyPayment(loanAmount, rate, termYears);
    const monthlyPropertyTax = annualPropertyTax / 12;
    const totalHousing = monthly + monthlyPropertyTax;
    const monthlyIncome = combinedIncome / 12;
    const gds = monthlyIncome > 0 ? (totalHousing / monthlyIncome) * 100 : 0;
    const tds = monthlyIncome > 0 ? ((totalHousing + existingDebt) / monthlyIncome) * 100 : 0;
    // Approximate: exact total requires per-period amortization (see PaymentSchedule)
    const totalInterest = (monthly * termYears * 12) - loanAmount;
    const ltv = purchasePrice > 0 ? (loanAmount / purchasePrice) * 100 : 0;
    const gdsLimit = ltv > 80 ? 35 : 39;
    const tdsLimit = ltv > 80 ? 42 : 44;

    return { loanAmount, monthly, gds, tds, totalInterest, downPayment, gdsLimit, tdsLimit };
  }, [rate, termYears, downPct, purchasePrice, combinedIncome, annualPropertyTax, existingDebt]);

  const sliderTrack = {
    width: '100%', height: 4, appearance: 'none', WebkitAppearance: 'none',
    background: 'var(--border-dim)', borderRadius: 2, outline: 'none',
    cursor: 'pointer',
  };

  return (
    <div style={{
      background: 'var(--bg-base)', border: '1px solid var(--border-dim)',
      borderRadius: 8, padding: 12, fontSize: 12,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: 'var(--mongo)', flexShrink: 0,
        }} />
        <span style={{
          fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-display)',
          color: 'var(--text-primary)', textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}>
          Affordability Calculator
        </span>
      </div>

      {/* Rate slider */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Interest Rate</span>
          <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--mongo)' }}>
            {rate.toFixed(2)}%
          </span>
        </div>
        <input
          type="range" min="3" max="8" step="0.01" value={rate}
          onChange={(e) => setRate(parseFloat(e.target.value))}
          style={sliderTrack}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-dim)' }}>
          <span>3%</span><span>8%</span>
        </div>
      </div>

      {/* Term selector */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4 }}>Amortization</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {TERM_OPTIONS.map(t => (
            <button
              key={t} type="button"
              onClick={() => setTermYears(t)}
              style={{
                flex: 1, padding: '4px 0', borderRadius: 6, fontSize: 11, fontWeight: 600,
                fontFamily: 'var(--font-display)', cursor: 'pointer',
                border: t === termYears ? '1.5px solid var(--mongo)' : '1px solid var(--border-dim)',
                background: t === termYears ? 'var(--mongo-dim)' : 'var(--bg-surface)',
                color: t === termYears ? 'var(--mongo)' : 'var(--text-secondary)',
                transition: 'all 150ms ease',
              }}
            >
              {t}yr
            </button>
          ))}
        </div>
      </div>

      {/* Down payment slider */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Down Payment</span>
          <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--mongo)' }}>
            {downPct}% ({formatCurrency(calculations.downPayment)})
          </span>
        </div>
        <input
          type="range" min="5" max="50" step="1" value={downPct}
          onChange={(e) => setDownPct(parseInt(e.target.value))}
          style={sliderTrack}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-dim)' }}>
          <span>5%</span><span>50%</span>
        </div>
      </div>

      {/* Results */}
      <div style={{
        background: 'var(--bg-surface)', borderRadius: 6, padding: 10, marginBottom: 10,
        border: '1px solid var(--border-dim)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <div>
            <div style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Monthly Payment
            </div>
            <div style={{
              fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-mono)',
              color: 'var(--text-primary)', lineHeight: 1.2,
            }}>
              {formatCurrency(calculations.monthly)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Interest
            </div>
            <div style={{
              fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-mono)',
              color: 'var(--text-secondary)',
            }}>
              {formatCurrency(calculations.totalInterest)}
            </div>
          </div>
        </div>
        <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>
          Loan: {formatCurrency(calculations.loanAmount)}
        </div>
      </div>

      {/* GDS / TDS gauges */}
      <GDSTDSGauge label="GDS (Gross Debt Service)" value={calculations.gds} greenMax={32} amberMax={calculations.gdsLimit} limit={50} />
      <GDSTDSGauge label="TDS (Total Debt Service)" value={calculations.tds} greenMax={40} amberMax={calculations.tdsLimit} limit={55} />

      {/* Disclaimer */}
      <div style={{
        fontSize: 8, color: 'var(--text-dim)', marginTop: 8, lineHeight: 1.4,
        fontStyle: 'italic',
      }}>
        Estimates only — actual terms determined during underwriting. Uses Canadian semi-annual compounding.
      </div>
    </div>
  );
}
