"use client";

import { calcCanadianMonthlyPayment, formatCurrency } from './utils';

export default function RateComparison({ data }) {
  if (!data || !data.options) return null;

  const loanAmount = data.loan_amount || 450000;
  const options = data.options.map(opt => ({
    ...opt,
    monthly: calcCanadianMonthlyPayment(loanAmount, opt.rate, opt.amort_years),
  }));

  const lowestMonthly = Math.min(...options.map(o => o.monthly));

  return (
    <div style={{
      background: 'var(--bg-base)', border: '1px solid var(--border-dim)',
      borderRadius: 8, padding: 12, fontSize: 12,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: 'var(--voyage)', flexShrink: 0,
        }} />
        <span style={{
          fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-display)',
          color: 'var(--text-primary)', textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}>
          Rate Comparison
        </span>
      </div>

      {/* Rate cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {options.map((opt, idx) => {
          const diff = opt.monthly - lowestMonthly;
          return (
            <div key={opt.name} style={{
              padding: '10px 12px', borderRadius: 6,
              background: opt.recommended ? 'var(--mongo-dim)' : 'var(--bg-surface)',
              border: opt.recommended ? '1.5px solid var(--mongo)' : '1px solid var(--border-dim)',
              animation: `genUISlideIn 0.3s ease ${idx * 60}ms both`,
              position: 'relative',
            }}>
              {/* Recommended badge */}
              {opt.recommended && (
                <span style={{
                  position: 'absolute', top: -6, right: 8,
                  fontSize: 8, fontWeight: 700, padding: '2px 6px',
                  borderRadius: 3, background: 'var(--mongo)',
                  color: '#fff', textTransform: 'uppercase',
                  fontFamily: 'var(--font-display)', letterSpacing: '0.03em',
                }}>
                  Recommended
                </span>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{
                  fontSize: 12, fontWeight: 700, color: 'var(--text-primary)',
                  fontFamily: 'var(--font-display)',
                }}>
                  {opt.name}
                </span>
                <span style={{
                  fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-mono)',
                  color: opt.recommended ? 'var(--mongo)' : 'var(--text-primary)',
                }}>
                  {opt.rate.toFixed(2)}%
                </span>
              </div>

              <div style={{
                display: 'flex', gap: 12, marginTop: 6,
                fontSize: 10, color: 'var(--text-secondary)',
              }}>
                <div>
                  <div style={{ fontSize: 8, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 1 }}>Monthly</div>
                  <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{formatCurrency(opt.monthly)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 8, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 1 }}>Term</div>
                  <div style={{ fontWeight: 600 }}>{opt.term_years}yr</div>
                </div>
                <div>
                  <div style={{ fontSize: 8, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 1 }}>Stress Test</div>
                  <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{opt.stress_test_rate.toFixed(2)}%</div>
                </div>
                {diff > 0 && (
                  <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                    <div style={{ fontSize: 8, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 1 }}>vs best</div>
                    <div style={{ fontWeight: 600, color: 'var(--danger)', fontFamily: 'var(--font-mono)' }}>
                      +{formatCurrency(diff)}/mo
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{
        fontSize: 8, color: 'var(--text-dim)', marginTop: 8,
        fontStyle: 'italic', lineHeight: 1.4,
      }}>
        Rates subject to qualification. {loanAmount > 0 ? `Based on ${formatCurrency(loanAmount)} mortgage.` : ''}
      </div>
    </div>
  );
}
