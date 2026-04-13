"use client";

import { useState, useEffect } from 'react';
import { apiGet } from '../../lib/api';

const PLAN_STEPS = [
  {
    id: 'docVerify',
    label: 'Document Verification',
    tool: 'voyage-multimodal-3.5',
    est: '~480ms',
    step: 1,
    description: 'Extract and embed CRA notices, bank statements, and pay stubs using multimodal AI',
    editable: { skipable: true, label: 'Run document verification' },
  },
  {
    id: 'creditPull',
    label: 'Credit Bureau Pull',
    tool: 'Equifax API',
    est: '~120ms',
    step: 2,
    description: 'Retrieve credit report and score from primary bureau',
    editable: { skipable: false },
  },
  {
    id: 'bankingEnrich',
    label: 'Open Banking Enrichment',
    tool: 'Plaid Connect',
    est: '~95ms',
    step: 3,
    description: 'Pull 12-month transaction history for cash flow analysis',
    editable: { skipable: true, label: 'Include banking data' },
  },
  {
    id: 'riskScore',
    label: 'Risk Scoring',
    tool: 'db.riskScores.aggregate()',
    est: '~18ms',
    step: 4,
    description: '7-stage aggregation pipeline covering GDS, LTV, credit depth, cash flow, employment stability, collateral, and comparable analysis',
    editable: {
      skipable: false,
      threshold: { label: 'Risk threshold', min: 50, max: 90, default: 65 },
    },
  },
  {
    id: 'policyRag',
    label: 'Policy Compliance Check',
    tool: 'Atlas Vector Search',
    est: '~12ms',
    step: 5,
    description: 'RAG query against institutional lending policies and regulatory requirements',
    editable: { skipable: false },
  },
  {
    id: 'fraudScan',
    label: 'Fraud Detection',
    tool: '$graphLookup',
    est: '~24ms',
    step: 6,
    description: '3-hop entity graph traversal across linked entities for anomaly detection',
    editable: {
      skipable: true,
      label: 'Run fraud scan',
      hops: { label: 'Graph depth', min: 1, max: 5, default: 3 },
    },
  },
];

export default function IntentPreview({ applicationId, onProceed, onManual }) {
  const [editing, setEditing] = useState(false);
  const [livePlan, setLivePlan] = useState(null);

  useEffect(() => {
    if (!applicationId) return;
    apiGet(`/applications/${applicationId}`).then((app) => {
      if (app) {
        setLivePlan([
          { label: 'Document Verification', tool: 'voyage-multimodal-3.5', est: '~480ms', status: app.status === 'submitted' ? 'pending' : 'complete' },
          { label: 'Credit Bureau Pull', tool: 'Equifax API', est: '~120ms', status: app.credit_reports?.length > 0 ? 'complete' : 'pending' },
          { label: 'Risk Scoring', tool: 'db.riskScores.aggregate()', est: '~18ms', status: app.status === 'underwriting' || app.status === 'review' ? 'complete' : 'pending' },
          { label: 'Policy Compliance', tool: 'Atlas Vector Search', est: '~12ms', status: app.status === 'review' ? 'complete' : 'pending' },
          { label: 'Decision', tool: 'LangGraph interrupt()', est: '—', status: app.status === 'approved' || app.status === 'declined' ? 'complete' : 'pending' },
        ]);
      }
    });
  }, [applicationId]);

  const planSteps = livePlan || PLAN_STEPS;

  const [settings, setSettings] = useState(() => {
    const s = {};
    PLAN_STEPS.forEach((step) => {
      s[step.id] = { enabled: true };
      if (step.editable.threshold) s[step.id].threshold = step.editable.threshold.default;
      if (step.editable.hops) s[step.id].hops = step.editable.hops.default;
    });
    return s;
  });

  const enabledCount = PLAN_STEPS.filter((s) => settings[s.id]?.enabled !== false).length;

  return (
    <div style={{
      padding: 16,
      background: 'var(--bg-surface)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--agent-cyan)',
      animation: 'slideDown 0.3s ease-out',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            padding: '4px 10px',
            borderRadius: 12,
            background: 'var(--agent-cyan-dim)',
            color: 'var(--agent-cyan)',
            fontWeight: 700,
            fontSize: 11,
          }}>
            ▶ Execution Plan
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
            {enabledCount} steps · Est. total ~750ms
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
        {planSteps.map((step, i) => {
          const stepSettings = settings[step.id] || {};
          const isDisabled = editing && step.editable?.skipable && !stepSettings.enabled;

          return (
            <div key={step.id} style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '8px 10px',
              background: isDisabled ? 'var(--bg-raised)' : 'var(--bg-base)',
              borderRadius: 'var(--radius-sm)',
              border: `1px solid ${isDisabled ? 'var(--border-dim)' : 'var(--border-base)'}`,
              opacity: isDisabled ? 0.5 : 1,
              transition: 'opacity 0.2s, background 0.2s',
            }}>
              <div style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: isDisabled ? 'var(--bg-raised)' : 'var(--agent-cyan-dim)',
                border: `1.5px solid ${isDisabled ? 'var(--border-dim)' : 'var(--agent-cyan)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 9,
                fontWeight: 700,
                color: isDisabled ? 'var(--text-dim)' : 'var(--agent-cyan)',
                flexShrink: 0,
                marginTop: 1,
              }}>
                {i + 1}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                    <span style={{
                      width: 18, height: 18, borderRadius: '50%',
                      background: step.status === 'complete' ? 'var(--success)' : 'var(--bg-raised)',
                      border: step.status === 'complete' ? 'none' : '1.5px solid var(--border-base)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 700,
                      color: step.status === 'complete' ? '#fff' : 'var(--text-dim)',
                      flexShrink: 0,
                    }}>{step.status === 'complete' ? '\u2713' : step.step}</span>
                    {step.label}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9,
                    color: 'var(--tool-blue)',
                    padding: '1px 5px',
                    background: 'var(--tool-blue-dim)',
                    borderRadius: 4,
                  }}>
                    {step.tool}
                  </span>
                  {step.status && (
                    <span style={{
                      fontSize: 9,
                      fontWeight: 700,
                      padding: '1px 5px',
                      borderRadius: 4,
                      background: step.status === 'complete' ? 'rgba(0,200,100,0.1)' : 'rgba(255,180,0,0.1)',
                      color: step.status === 'complete' ? 'var(--success, #00c864)' : 'var(--hitl-amber, #ffb400)',
                    }}>
                      {step.status === 'complete' ? '✓ done' : '● pending'}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {step.description}
                </div>

                {editing && step.editable && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
                    {step.editable.skipable && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={stepSettings.enabled}
                          onChange={(e) => setSettings((prev) => ({
                            ...prev,
                            [step.id]: { ...prev[step.id], enabled: e.target.checked },
                          }))}
                          style={{ accentColor: 'var(--agent-cyan)' }}
                        />
                        {step.editable.label}
                      </label>
                    )}
                    {step.editable.threshold && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-secondary)' }}>
                        {step.editable.threshold.label}:
                        <input
                          type="range"
                          min={step.editable.threshold.min}
                          max={step.editable.threshold.max}
                          value={stepSettings.threshold}
                          onChange={(e) => setSettings((prev) => ({
                            ...prev,
                            [step.id]: { ...prev[step.id], threshold: +e.target.value },
                          }))}
                          style={{ width: 80, accentColor: 'var(--agent-cyan)' }}
                        />
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600 }}>
                          {stepSettings.threshold}
                        </span>
                      </label>
                    )}
                    {step.editable.hops && stepSettings.enabled && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-secondary)' }}>
                        {step.editable.hops.label}:
                        <input
                          type="range"
                          min={step.editable.hops.min}
                          max={step.editable.hops.max}
                          value={stepSettings.hops}
                          onChange={(e) => setSettings((prev) => ({
                            ...prev,
                            [step.id]: { ...prev[step.id], hops: +e.target.value },
                          }))}
                          style={{ width: 60, accentColor: 'var(--agent-cyan)' }}
                        />
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600 }}>
                          {stepSettings.hops}-hop
                        </span>
                      </label>
                    )}
                  </div>
                )}
              </div>

              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                color: 'var(--text-dim)',
                flexShrink: 0,
                marginTop: 2,
              }}>
                {step.est}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" onClick={() => {
          if (onProceed) onProceed(settings);
        }} style={{
          flex: 2,
          padding: 10,
          borderRadius: 'var(--radius-md)',
          border: 'none',
          background: 'var(--mongo)',
          color: '#fff',
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 12,
          cursor: 'pointer',
        }}>
          ▶ Proceed
        </button>
        <button type="button" onClick={() => setEditing(!editing)} style={{
          flex: 1,
          padding: 10,
          borderRadius: 'var(--radius-md)',
          border: `1px solid ${editing ? 'var(--agent-cyan)' : 'var(--border-base)'}`,
          background: editing ? 'var(--agent-cyan-dim)' : 'var(--bg-raised)',
          color: editing ? 'var(--agent-cyan)' : 'var(--text-primary)',
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: 12,
          cursor: 'pointer',
        }}>
          {editing ? '✓ Done Editing' : '✎ Edit Parameters'}
        </button>
        <button type="button" onClick={onManual} style={{
          flex: 1,
          padding: 10,
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-base)',
          background: 'transparent',
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: 12,
          cursor: 'pointer',
        }}>
          Handle Manually
        </button>
      </div>
    </div>
  );
}
