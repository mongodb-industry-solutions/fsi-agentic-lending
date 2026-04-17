"use client";

import { useState, useCallback, useEffect } from 'react';
import { spacing } from '@leafygreen-ui/tokens';
import { apiGet } from '../../lib/api';
import { formatCurrency, getAppDisplayName, GDS_LIMIT, TDS_LIMIT } from './utils';

const GDS_PCT_LABEL = `${(GDS_LIMIT * 100).toFixed(0)}%`;
const TDS_PCT_LABEL = `${(TDS_LIMIT * 100).toFixed(0)}%`;

export function HITLReviewCard({ applicationId, appDetail, queueData, onApprove, onDecline, addToast, liveAgentOutput = {} }) {
  const [showProvenance, setShowProvenance] = useState(false);
  const [showModify, setShowModify] = useState(false);
  const [fetchingContext, setFetchingContext] = useState(false);
  const [hitlContext, setHitlContext] = useState(null);
  const [modFields, setModFields] = useState({ rate: 4.89, conditions: '', requestDocs: false, loanAmount: '' });
  const [submitting, setSubmitting] = useState(false);

  const app = hitlContext?.application || appDetail || {};
  const activityTrail = hitlContext?.activity_trail || [];
  const appName = getAppDisplayName(app, queueData);
  const loanAmount = app.loan_amount ? formatCurrency(app.loan_amount) : (queueData?.amount || 'N/A');
  const product = app.product || queueData?.product || 'N/A';
  const riskScore = app.risk_score ?? null;
  const policyCitations = activityTrail.filter((a) =>
    a.action?.includes('policy') || a.action?.includes('escalat') || a.action?.includes('autonomy_gate') ||
    a.action?.includes('decision') || a.action?.includes('interrupt') || a.action?.includes('risk_score') ||
    a.action?.includes('intervention')
  );
  const recommendation = activityTrail.find((a) =>
    a.action?.includes('decision') || a.action?.includes('complete') || a.detail?.includes('recommend')
  );

  const fetchContext = useCallback(async () => {
    setFetchingContext(true);
    const ctx = await apiGet(`/hitl/${applicationId}/context`);
    setFetchingContext(false);
    if (ctx) {
      setHitlContext(ctx);
    } else {
      if (addToast) addToast({ type: 'warning', title: 'Context Unavailable', message: 'Could not retrieve HITL context from backend.' });
    }
  }, [applicationId, addToast]);

  useEffect(() => {
    if (applicationId) fetchContext();
  }, [applicationId, fetchContext]);

  const handleModifySubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    const loanAmountNum = modFields.loanAmount ? parseFloat(modFields.loanAmount.replace(/[^0-9.]/g, '')) : null;
    const details = {
      mode: 'modified',
      rate: `${modFields.rate.toFixed(3)}%`,
      conditions: modFields.conditions,
      requestDocs: modFields.requestDocs,
      ...(loanAmountNum ? { loanAmount: loanAmountNum } : {}),
    };
    if (addToast) {
      const parts = [`Rate: ${details.rate}`];
      if (loanAmountNum) parts.push(`Amount: $${loanAmountNum.toLocaleString()}`);
      if (modFields.conditions) parts.push(`Condition: ${modFields.conditions}`);
      if (modFields.requestDocs) parts.push('Additional docs requested');
      addToast({ type: 'info', title: 'Submitting Modifications', message: parts.join(' · ') });
    }
    try { await onApprove(details); } finally { setSubmitting(false); }
  };

  const handleApproveRecommended = async () => {
    if (submitting) return;
    setSubmitting(true);
    try { await onApprove({ mode: 'recommended', rate: recommendation?.detail?.match(/[\d.]+%/)?.[0] || 'as recommended' }); } finally { setSubmitting(false); }
  };

  const modSummary = showModify ? (() => {
    const parts = [];
    if (modFields.rate !== 4.89) parts.push(`Rate adjusted to ${modFields.rate.toFixed(3)}%`);
    if (modFields.loanAmount) parts.push(`Amount: $${modFields.loanAmount}`);
    if (modFields.conditions) parts.push(`Condition: ${modFields.conditions}`);
    if (modFields.requestDocs) parts.push('Additional docs: requested');
    return parts;
  })() : [];

  return (
    <div
      role="region"
      aria-label="Human-in-the-loop review"
      aria-live="polite"
      style={{
        padding: spacing[4],
        background: 'var(--bg-surface)',
        borderRadius: 8,
        border: '2px solid var(--hitl-amber)',
        animation: 'slideDown 0.3s ease-out',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2], marginBottom: spacing[3] }}>
        <span style={{
          padding: `${spacing[1]}px 10px`, borderRadius: 12,
          background: 'var(--hitl-amber-dim)', color: 'var(--hitl-amber)',
          fontWeight: 700, fontSize: 11,
        }}>
          Human Review Required
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>LangGraph interrupt()</span>
      </div>

      {/* 3-Part Agent Reasoning Card */}
      <div style={{
        marginBottom: 12, borderRadius: 8, overflow: 'hidden',
        border: '1px solid var(--border-base)',
      }}>
        {/* Part 1: Actions Taken */}
        <div style={{
          padding: '8px 10px',
          background: 'var(--bg-raised)',
          borderBottom: '1px solid var(--border-dim)',
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
            Actions Taken
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {activityTrail.filter((a) => a.action !== 'route' && a.action !== 'routing').slice(0, 5).map((entry, i) => (
              <div key={i}>
                {'\u2022'} <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--agent-cyan)' }}>{entry.agent}</span> {'\u2014'} {entry.detail?.slice(0, 120) || entry.action}
              </div>
            ))}
            {activityTrail.length === 0 && (
              <span style={{ color: 'var(--text-dim)' }}>Processing {product} for {appName} ({loanAmount})</span>
            )}
          </div>
        </div>

        {/* Part 2: Escalation Triggers */}
        {policyCitations.length > 0 && (
          <div style={{
            padding: '8px 10px',
            background: 'var(--danger-dim)',
            borderBottom: '1px solid var(--border-dim)',
          }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
              Escalation Triggers
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {policyCitations.map((c, i) => (
                <div key={i}>
                  {'\u2022'} <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9 }}>{c.agent}</span> {'\u2014'} {c.detail || c.action}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Part 2b: Trigger Analysis — specific thresholds */}
        {(() => {
          const purchasePrice = appDetail?.purchase_price || queueData?.purchase_price;
          const rawGds = liveAgentOutput.gds_ratio ?? appDetail?.gds_ratio;
          const rawTds = liveAgentOutput.tds_ratio ?? appDetail?.tds_ratio;
          const stressGdsVal = liveAgentOutput.stress_gds ?? appDetail?.stress_gds;
          const stressTdsVal = liveAgentOutput.stress_tds ?? appDetail?.stress_tds;
          // Backend escalates on effective ratio = max(raw, stress) vs 36% / 41%
          const effGds = [rawGds, stressGdsVal].filter((v) => v != null).length ? Math.max(...[rawGds, stressGdsVal].filter((v) => v != null)) : null;
          const effTds = [rawTds, stressTdsVal].filter((v) => v != null).length ? Math.max(...[rawTds, stressTdsVal].filter((v) => v != null)) : null;
          const riskTierVal = liveAgentOutput.risk_tier ?? appDetail?.risk_tier;
          const triggers = [
            { label: 'Purchase price', value: purchasePrice ? `$${Number(purchasePrice).toLocaleString()}` : null, threshold: '$500,000', triggered: purchasePrice > 500000 },
            { label: 'Effective GDS', value: effGds != null ? `${(effGds * 100).toFixed(1)}%` : null, threshold: '36%', triggered: effGds != null && effGds > 0.36 },
            { label: 'Effective TDS', value: effTds != null ? `${(effTds * 100).toFixed(1)}%` : null, threshold: '41%', triggered: effTds != null && effTds > 0.41 },
            { label: 'Risk tier', value: riskTierVal || null, threshold: 'A / B+ (auto)', triggered: riskTierVal && ['B', 'C'].includes(riskTierVal) },
          ].filter((t) => t.value != null);
          if (triggers.length === 0) return null;
          return (
            <div style={{
              padding: '8px 10px',
              background: 'var(--bg-base)',
              borderBottom: '1px solid var(--border-dim)',
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--hitl-amber)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                Threshold Analysis
              </div>
              {triggers.map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, fontSize: 10 }}>
                  <span style={{
                    width: 14, height: 14, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 8, fontWeight: 700, flexShrink: 0,
                    background: t.triggered ? 'var(--hitl-amber-dim)' : 'var(--success-dim)',
                    color: t.triggered ? 'var(--hitl-amber)' : 'var(--success)',
                    border: `1px solid ${t.triggered ? 'var(--hitl-amber)' : 'var(--success)'}`,
                  }}>
                    {t.triggered ? '!' : '\u2713'}
                  </span>
                  <span style={{ color: 'var(--text-secondary)', flex: 1 }}>
                    {t.label} <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>{t.value}</span>
                    {' '}<span style={{ color: 'var(--text-dim)' }}>vs {t.threshold}</span>
                  </span>
                  <span style={{
                    fontSize: 8, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                    background: t.triggered ? 'var(--hitl-amber-dim)' : 'var(--success-dim)',
                    color: t.triggered ? 'var(--hitl-amber)' : 'var(--success)',
                  }}>
                    {t.triggered ? 'TRIGGERED' : 'PASS'}
                  </span>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Part 3: Agent Recommendation */}
        <div style={{
          padding: '10px 12px',
          background: 'var(--mongo-dim)',
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--mongo)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
            Agent Recommendation
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 600, lineHeight: 1.5 }}>
            {recommendation?.detail || 'Review and make a decision.'}
          </div>
        </div>
      </div>

      {/* Risk Factor Table with ThresholdBars */}
      <div style={{
        padding: '10px 12px', marginBottom: spacing[3],
        background: 'var(--bg-raised)', borderRadius: 8,
        border: '1px solid var(--border-dim)',
      }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
          Risk Assessment
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(() => {
            const creditScore = liveAgentOutput.primary_credit_score ?? app.credit_reports?.[0]?.score;
            const gds = app.gds_ratio ?? liveAgentOutput.gds_ratio;
            const tds = app.tds_ratio ?? liveAgentOutput.tds_ratio;
            const stressGds = liveAgentOutput.stress_gds;
            const stressTds = liveAgentOutput.stress_tds;
            const riskTier = app.risk_tier ?? liveAgentOutput.risk_tier;

            const factors = [
              { label: 'Risk Score', value: riskScore != null ? `${riskScore}/100` : null, threshold: '65', pass: riskScore != null ? riskScore < 65 : null, color: riskScore != null && riskScore >= 65 ? 'var(--danger)' : 'var(--success)' },
              { label: 'Risk Tier', value: riskTier || null, threshold: 'A / B+', pass: riskTier === 'A' || riskTier === 'B+', color: ['C', 'D'].includes(riskTier) ? 'var(--danger)' : riskTier === 'B' ? 'var(--hitl-amber)' : 'var(--success)' },
              { label: 'Credit Score', value: creditScore != null ? String(creditScore) : null, threshold: '680', pass: creditScore != null ? creditScore >= 680 : null, color: creditScore != null && creditScore < 680 ? 'var(--hitl-amber)' : 'var(--success)' },
              { label: 'GDS Ratio', value: gds != null ? `${(gds * 100).toFixed(1)}%` : null, threshold: GDS_PCT_LABEL, pass: gds != null ? gds <= GDS_LIMIT : null, bar: gds, barThreshold: GDS_LIMIT },
              { label: 'TDS Ratio', value: tds != null ? `${(tds * 100).toFixed(1)}%` : null, threshold: TDS_PCT_LABEL, pass: tds != null ? tds <= TDS_LIMIT : null, bar: tds, barThreshold: TDS_LIMIT },
              ...(stressGds != null ? [{ label: 'Stress GDS', value: `${(stressGds * 100).toFixed(1)}%`, threshold: GDS_PCT_LABEL, pass: stressGds <= GDS_LIMIT, bar: stressGds, barThreshold: GDS_LIMIT }] : []),
              ...(stressTds != null ? [{ label: 'Stress TDS', value: `${(stressTds * 100).toFixed(1)}%`, threshold: TDS_PCT_LABEL, pass: stressTds <= TDS_LIMIT, bar: stressTds, barThreshold: TDS_LIMIT }] : []),
            ].filter((f) => f.value != null);

            return factors.map((f) => (
              <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 9, color: 'var(--text-dim)', width: 72, flexShrink: 0 }}>{f.label}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: f.color || (f.pass ? 'var(--success)' : f.pass === false ? 'var(--danger)' : 'var(--text-primary)'), width: 50, flexShrink: 0 }}>
                  {f.value}
                </span>
                {f.bar != null && (
                  <div style={{ flex: 1, height: 8, background: 'var(--bg-surface)', borderRadius: 4, position: 'relative', overflow: 'hidden', maxWidth: 120 }}>
                    <div style={{
                      position: 'absolute', top: 0, left: 0, height: '100%',
                      width: `${Math.min(f.bar / 0.6 * 100, 100)}%`,
                      background: f.pass ? 'var(--success)' : 'var(--danger)',
                      borderRadius: 4,
                      transition: 'width 0.5s cubic-bezier(0.33, 1, 0.68, 1)',
                    }} />
                    <div style={{
                      position: 'absolute', top: 0,
                      left: `${(f.barThreshold / 0.6) * 100}%`,
                      width: 1, height: '100%',
                      background: 'var(--text-primary)',
                    }} />
                  </div>
                )}
                <span style={{
                  fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 3,
                  background: f.pass ? 'var(--success-dim)' : f.pass === false ? 'var(--danger-dim)' : 'var(--bg-surface)',
                  color: f.pass ? 'var(--success)' : f.pass === false ? 'var(--danger)' : 'var(--text-dim)',
                }}>
                  {f.pass ? 'PASS' : f.pass === false ? 'FAIL' : '\u2014'}
                </span>
              </div>
            ));
          })()}
        </div>
      </div>

      {/* Key metrics row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing[3], marginBottom: spacing[3] }}>
        <div>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 2 }}>Risk Score</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 800, color: riskScore != null && riskScore >= 65 ? 'var(--danger)' : 'var(--hitl-amber)' }}>
            {riskScore != null ? riskScore : 'N/A'} {riskScore != null && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>/ 100</span>}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 2 }}>Loan Amount</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700 }}>{loanAmount}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 2 }}>Product</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--mongo)' }}>{product}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing[2], marginBottom: spacing[3], padding: 10, background: 'var(--bg-raised)', borderRadius: 8 }}>
        {[
          { label: 'Applicant', value: appName },
          { label: 'Status', value: app.status || 'review' },
          { label: 'Documents', value: app.documents?.length ?? 'N/A' },
        ].map((item) => (
          <div key={item.label}>
            <div style={{ fontSize: 8, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 1 }}>{item.label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600 }}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* Additional context from HITL endpoint */}
      {hitlContext && hitlContext.activity_trail?.length > 0 && (
        <div style={{
          padding: '10px 12px',
          background: 'var(--bg-raised)',
          borderRadius: 6,
          marginBottom: 12,
          animation: 'slideDown 0.3s ease-out',
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
            Agent Activity Trail ({hitlContext.activity_trail.length} entries)
          </div>
          {hitlContext.activity_trail.slice(0, 5).map((entry, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', flexShrink: 0, marginTop: 5 }} />
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-primary)' }}>{entry.agent}: {entry.action}</div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{entry.detail?.slice(0, 120)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Expandable provenance panel */}
      <button
        type="button"
        onClick={() => setShowProvenance(!showProvenance)}
        aria-expanded={showProvenance}
        aria-controls="provenance-panel"
        style={{
          width: '100%',
          padding: '6px 10px',
          marginBottom: showProvenance ? 0 : 12,
          background: 'var(--bg-raised)',
          border: '1px solid var(--border-dim)',
          borderRadius: showProvenance ? '6px 6px 0 0' : 6,
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-display)',
        }}
      >
        <span>Why this escalation?</span>
        <span style={{
          transform: showProvenance ? 'rotate(180deg)' : 'rotate(0)',
          transition: 'transform 0.2s',
          display: 'inline-block',
        }}>{'\u25BE'}</span>
      </button>
      {showProvenance && (
        <div id="provenance-panel" style={{
          padding: '10px 12px',
          background: 'var(--bg-raised)',
          border: '1px solid var(--border-dim)',
          borderTop: 'none',
          borderRadius: '0 0 6px 6px',
          marginBottom: 12,
        }}>
          {policyCitations.length > 0 ? policyCitations.map((rec, i) => (
            <div key={i} style={{ marginBottom: i < policyCitations.length - 1 ? 10 : 0 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                {rec.agent}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 2 }}>
                {rec.detail || rec.action}
              </div>
            </div>
          )) : (
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
              {fetchingContext ? 'Loading activity trail...' : 'No policy-related activity found in the trail.'}
            </div>
          )}
        </div>
      )}

      {/* Inline modification form */}
      {showModify && (
        <div style={{
          padding: 12,
          background: 'var(--bg-raised)',
          borderRadius: 6,
          border: '1px solid var(--border-base)',
          marginBottom: 12,
          animation: 'slideDown 0.3s ease-out',
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: spacing[2] }}>
            Modify Terms
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2], marginBottom: spacing[2] }}>
            <label htmlFor="hitl-rate" style={{ fontSize: 10, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Rate (%):</label>
            <input
              id="hitl-rate"
              type="range"
              min={3.0}
              max={12.0}
              step={0.125}
              value={modFields.rate}
              aria-label="Modified interest rate"
              onChange={(e) => setModFields((p) => ({ ...p, rate: +e.target.value }))}
              style={{ flex: 1, accentColor: 'var(--mongo)' }}
            />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--mongo)', minWidth: 45 }}>
              {modFields.rate.toFixed(3)}%
            </span>
          </div>
          <div style={{ marginBottom: spacing[2] }}>
            <label htmlFor="hitl-conditions" style={{ fontSize: 10, color: 'var(--text-secondary)', display: 'block', marginBottom: 3 }}>Additional Conditions:</label>
            <input
              id="hitl-conditions"
              type="text"
              placeholder="e.g., Require 6-month reserve verification"
              value={modFields.conditions}
              onChange={(e) => setModFields((p) => ({ ...p, conditions: e.target.value }))}
              style={{
                width: '100%', padding: '5px 8px', fontSize: 10,
                fontFamily: 'var(--font-body)',
                background: 'var(--bg-surface)', border: '1px solid var(--border-dim)',
                borderRadius: 6, color: 'var(--text-primary)', outline: 'none',
              }}
            />
          </div>
          <div style={{ marginBottom: spacing[2] }}>
            <label htmlFor="hitl-loanamt" style={{ fontSize: 10, color: 'var(--text-secondary)', display: 'block', marginBottom: 3 }}>Loan Amount Override:</label>
            <input
              id="hitl-loanamt"
              type="text"
              placeholder={app.loan_amount ? `Current: $${Number(app.loan_amount).toLocaleString()}` : 'e.g., 350000'}
              value={modFields.loanAmount}
              onChange={(e) => setModFields((p) => ({ ...p, loanAmount: e.target.value }))}
              style={{
                width: '100%', padding: '5px 8px', fontSize: 10,
                fontFamily: 'var(--font-mono)',
                background: 'var(--bg-surface)', border: '1px solid var(--border-dim)',
                borderRadius: 6, color: 'var(--text-primary)', outline: 'none',
              }}
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={modFields.requestDocs}
              onChange={(e) => setModFields((p) => ({ ...p, requestDocs: e.target.checked }))}
              style={{ accentColor: 'var(--mongo)' }}
            />
            Request additional documentation from borrower
          </label>

          {modSummary.length > 0 && (
            <div style={{
              marginTop: spacing[2], padding: '6px 8px',
              background: 'var(--agent-cyan-dim)', borderRadius: 6,
              border: '1px solid var(--agent-cyan)',
              fontSize: 9, color: 'var(--agent-cyan)', lineHeight: 1.5,
            }}>
              <span style={{ fontWeight: 700 }}>Modified Terms: </span>
              {modSummary.join(' · ')}
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: spacing[2], flexWrap: 'wrap' }}>
        {showModify ? (
          <button type="button" onClick={handleModifySubmit} disabled={submitting} style={{
            flex: '1 1 auto', padding: 10, borderRadius: 8, border: 'none',
            background: 'var(--agent-cyan)', color: '#fff', fontFamily: 'var(--font-display)',
            fontWeight: 700, fontSize: 11, cursor: submitting ? 'default' : 'pointer',
            opacity: submitting ? 0.6 : 1,
          }}>
            {submitting ? 'Submitting...' : 'Submit Modified Terms'}
          </button>
        ) : (
          <button type="button" onClick={handleApproveRecommended} disabled={submitting} style={{
            flex: '1 1 auto', padding: 10, borderRadius: 8, border: 'none',
            background: 'var(--mongo)', color: '#fff', fontFamily: 'var(--font-display)',
            fontWeight: 700, fontSize: 11, cursor: submitting ? 'default' : 'pointer',
            opacity: submitting ? 0.6 : 1,
          }}>
            {submitting ? 'Approving...' : 'Approve as Recommended'}
          </button>
        )}
        <button type="button" onClick={() => setShowModify(!showModify)} style={{
          flex: '1 1 auto', padding: 10, borderRadius: 8,
          border: `1px solid ${showModify ? 'var(--agent-cyan)' : 'var(--border-base)'}`,
          background: showModify ? 'var(--agent-cyan-dim)' : 'var(--bg-raised)',
          color: showModify ? 'var(--agent-cyan)' : 'var(--text-primary)',
          fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 11, cursor: 'pointer',
        }}>
          {showModify ? 'Back' : 'Modify & Approve'}
        </button>
        {showModify ? (
          // Compact icon-only refresh in modify mode to keep action row uncluttered.
          <button
            type="button"
            onClick={fetchContext}
            disabled={fetchingContext}
            aria-label={fetchingContext ? 'Refreshing context' : 'Refresh context'}
            title={fetchingContext ? 'Refreshing...' : 'Refresh context'}
            style={{
              flex: '0 0 auto', width: 36, padding: 10, borderRadius: 8,
              border: '1px solid var(--tool-blue)',
              background: fetchingContext ? 'var(--tool-blue-dim)' : 'transparent',
              color: 'var(--tool-blue)',
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12,
              cursor: fetchingContext ? 'default' : 'pointer',
              lineHeight: 1,
            }}
          >
            {fetchingContext ? '…' : '\u21BB'}
          </button>
        ) : (
          <button type="button" onClick={fetchContext} disabled={fetchingContext} style={{
            flex: '1 1 auto', padding: 10, borderRadius: 8,
            border: '1px solid var(--tool-blue)',
            background: fetchingContext ? 'var(--tool-blue-dim)' : 'transparent',
            color: 'var(--tool-blue)',
            fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 11,
            cursor: fetchingContext ? 'default' : 'pointer',
          }}>
            {fetchingContext ? 'Fetching...' : 'Refresh Context'}
          </button>
        )}
        <button type="button" onClick={() => onDecline?.()} disabled={submitting} style={{
          flex: '1 1 auto', padding: 10, borderRadius: 8,
          border: '1px solid var(--danger)', background: 'transparent',
          color: 'var(--danger)', fontFamily: 'var(--font-display)',
          fontWeight: 600, fontSize: 11, cursor: submitting ? 'default' : 'pointer',
          opacity: submitting ? 0.6 : 1,
        }}>
          Decline
        </button>
      </div>
    </div>
  );
}
