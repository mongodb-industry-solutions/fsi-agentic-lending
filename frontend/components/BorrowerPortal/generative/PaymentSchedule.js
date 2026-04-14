"use client";

import { useState, useMemo } from 'react';
import { calcCanadianMonthlyPayment, formatCurrency } from './utils';

function calcAmortization(principal, annualRate, years) {
  if (principal <= 0 || annualRate <= 0 || years <= 0) return [];
  const semiAnnualRate = annualRate / 100 / 2;
  const effectiveMonthly = Math.pow(1 + semiAnnualRate, 1 / 6) - 1;
  const n = years * 12;
  const payment = calcCanadianMonthlyPayment(principal, annualRate, years);

  const schedule = [];
  let balance = principal;
  for (let m = 1; m <= Math.min(n, 360); m++) {
    const interest = balance * effectiveMonthly;
    const principalPaid = payment - interest;
    balance = Math.max(0, balance - principalPaid);
    schedule.push({
      month: m,
      payment: Math.round(payment),
      principal: Math.round(principalPaid),
      interest: Math.round(interest),
      balance: Math.round(balance),
    });
  }
  return schedule;
}

export default function PaymentSchedule({ data }) {
  const [viewMode, setViewMode] = useState('monthly');
  const loanAmount = data.loan_amount || 450000;
  const rate = data.rate ?? 4.99;
  const years = data.amort_years ?? 25;

  const schedule = useMemo(() => calcAmortization(loanAmount, rate, years), [loanAmount, rate, years]);

  if (schedule.length === 0) return null;

  const totalPaid = schedule.reduce((s, r) => s + r.payment, 0);
  const totalInterest = schedule.reduce((s, r) => s + r.interest, 0);
  const totalPrincipal = schedule.reduce((s, r) => s + r.principal, 0);

  const displayRows = viewMode === 'monthly'
    ? schedule.slice(0, 12)
    : Array.from({ length: Math.min(years, 10) }, (_, y) => {
      const yearRows = schedule.slice(y * 12, (y + 1) * 12);
      return {
        month: `Year ${y + 1}`,
        payment: yearRows.reduce((s, r) => s + r.payment, 0),
        principal: yearRows.reduce((s, r) => s + r.principal, 0),
        interest: yearRows.reduce((s, r) => s + r.interest, 0),
        balance: yearRows[yearRows.length - 1]?.balance || 0,
      };
    });

  const pillStyle = (active) => ({
    padding: '3px 8px', borderRadius: 10, fontSize: 9, fontWeight: 600,
    fontFamily: 'var(--font-display)', cursor: 'pointer',
    border: active ? '1px solid var(--mongo)' : '1px solid var(--border-dim)',
    background: active ? 'var(--mongo-dim)' : 'transparent',
    color: active ? 'var(--mongo)' : 'var(--text-dim)',
    transition: 'all 150ms ease',
  });

  return (
    <div style={{
      background: 'var(--bg-base)', border: '1px solid var(--border-dim)',
      borderRadius: 8, padding: 12, fontSize: 12,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--tool-blue)', flexShrink: 0 }} />
        <span style={{
          fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-display)',
          color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          Payment Schedule
        </span>
      </div>

      {/* Summary row */}
      <div style={{
        display: 'flex', gap: 8, marginBottom: 10,
      }}>
        {[
          { label: 'Total Paid', value: formatCurrency(totalPaid), color: 'var(--text-primary)' },
          { label: 'Interest', value: formatCurrency(totalInterest), color: 'var(--hitl-amber)' },
          { label: 'Principal', value: formatCurrency(totalPrincipal), color: 'var(--success)' },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, textAlign: 'center', padding: '6px 4px', borderRadius: 4, background: 'var(--bg-surface)' }}>
            <div style={{ fontSize: 8, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Toggle */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        <button type="button" onClick={() => setViewMode('monthly')} style={pillStyle(viewMode === 'monthly')}>Monthly</button>
        <button type="button" onClick={() => setViewMode('annual')} style={pillStyle(viewMode === 'annual')}>Annual</button>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, fontFamily: 'var(--font-mono)' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-dim)' }}>
              {['Period', 'Payment', 'Principal', 'Interest', 'Balance'].map(h => (
                <th key={h} style={{
                  padding: '4px 4px', textAlign: h === 'Period' ? 'left' : 'right',
                  fontSize: 8, fontWeight: 700, color: 'var(--text-dim)',
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                  fontFamily: 'var(--font-display)',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, idx) => {
              const total = row.principal + row.interest;
              const principalPct = total > 0 ? (row.principal / total) * 100 : 50;
              return (
                <tr key={idx} style={{
                  borderBottom: '1px solid var(--border-dim)',
                  animation: `genUISlideIn 0.2s ease ${idx * 30}ms both`,
                }}>
                  <td style={{ padding: '4px', color: 'var(--text-secondary)', fontSize: 9 }}>
                    {typeof row.month === 'string' ? row.month : `Mo ${row.month}`}
                  </td>
                  <td style={{ padding: '4px', textAlign: 'right', color: 'var(--text-primary)' }}>
                    {formatCurrency(row.payment)}
                  </td>
                  <td style={{ padding: '4px', textAlign: 'right', color: 'var(--success)' }}>
                    {formatCurrency(row.principal)}
                  </td>
                  <td style={{ padding: '4px', textAlign: 'right', color: 'var(--hitl-amber)' }}>
                    {formatCurrency(row.interest)}
                  </td>
                  <td style={{ padding: '4px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                    {formatCurrency(row.balance)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Principal vs Interest bar */}
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 8, color: 'var(--text-dim)', marginBottom: 3, textTransform: 'uppercase' }}>
          Overall split
        </div>
        <div style={{ height: 6, borderRadius: 3, display: 'flex', overflow: 'hidden' }}>
          <div style={{
            width: `${(totalPrincipal / totalPaid) * 100}%`, background: 'var(--success)',
            transition: 'width 400ms ease',
          }} />
          <div style={{
            flex: 1, background: 'var(--hitl-amber)',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: 'var(--text-dim)', marginTop: 2 }}>
          <span>Principal ({((totalPrincipal / totalPaid) * 100).toFixed(0)}%)</span>
          <span>Interest ({((totalInterest / totalPaid) * 100).toFixed(0)}%)</span>
        </div>
      </div>
    </div>
  );
}
