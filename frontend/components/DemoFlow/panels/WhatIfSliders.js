"use client";

/**
 * Interactive sliders: FICO (600-850), DTI (0.20-0.50).
 * Risk score, tier, rate and decision update locally to show what Aggregation + Vector Search enable.
 */
import { useState, useMemo } from 'react';

function scoreToTier(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'A-';
  if (score >= 70) return 'B+';
  if (score >= 60) return 'B';
  if (score >= 50) return 'C+';
  return 'C';
}

function tierToRate(tier) {
  const rates = { A: 5.75, 'A-': 6.0, B: 6.875, 'B+': 6.875, 'C+': 7.5, C: 8.25 };
  return rates[tier] ?? 6.875;
}

export default function WhatIfSliders() {
  const [fico, setFico] = useState(742);
  const [dti, setDti] = useState(0.31);

  const { score, tier, rate, decision } = useMemo(() => {
    // Simple formula: base 50, FICO contributes ~0.05 per point above 600, DTI penalizes
    const ficoContrib = Math.max(0, (fico - 600) / 250) * 40;
    const dtiPenalty = Math.max(0, (dti - 0.28) / 0.22) * 25;
    const score = Math.round(50 + ficoContrib - dtiPenalty);
    const clamped = Math.max(0, Math.min(100, score));
    const tier = scoreToTier(clamped);
    const rate = tierToRate(tier);
    const approved = clamped >= 65 && dti <= 0.43;
    return {
      score: clamped,
      tier,
      rate,
      decision: approved ? 'Approved' : 'Review Required',
    };
  }, [fico, dti]);

  return (
    <div style={{ padding: 12, background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--text-secondary)' }}>
      <div style={{ fontWeight: 700, marginBottom: 10 }}>Decision factors</div>
      <div style={{ marginBottom: 8 }}>Income Stability +42 · Credit History +35 · DTI +28 · Payment Regularity +22 · Credit Utilization −12 · Hard Inquiries −8 · Cash Reserves +15</div>

      <div style={{ marginTop: 16, marginBottom: 12, fontWeight: 600, color: 'var(--text-primary)' }}>What-if</div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', marginBottom: 4, fontSize: 11 }}>FICO: {fico}</label>
        <input
          type="range"
          min={600}
          max={850}
          value={fico}
          onChange={(e) => setFico(Number(e.target.value))}
          style={{ width: '100%', accentColor: 'var(--mongo)' }}
        />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', marginBottom: 4, fontSize: 11 }}>DTI: {(dti * 100).toFixed(0)}%</label>
        <input
          type="range"
          min={20}
          max={50}
          value={dti * 100}
          onChange={(e) => setDti(Number(e.target.value) / 100)}
          style={{ width: '100%', accentColor: 'var(--mongo)' }}
        />
      </div>

      <div style={{ marginTop: 12, padding: 10, background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', fontSize: 11 }}>
        <div style={{ color: 'var(--text-primary)' }}>
          Risk score: <strong>{score}/100</strong> ({tier}) · Rate: <strong>{rate}%</strong> APR
        </div>
        <div style={{ marginTop: 4, color: decision === 'Approved' ? 'var(--success)' : 'var(--hitl-amber)' }}>
          {decision}
        </div>
      </div>
      <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-dim)' }}>LangSmith trace available.</div>
    </div>
  );
}
