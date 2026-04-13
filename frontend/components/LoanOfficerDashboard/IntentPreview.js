"use client";

import { useState, useEffect, useMemo } from 'react';
import { apiGet } from '../../lib/api';
import styles from './IntentPreview.module.css';

const PLAN_STEPS = [
  {
    id: 'docVerify',
    label: 'Document Verification',
    tool: 'voyage-multimodal-3.5',
    est: '~480ms',
    step: 1,
    description: 'Extract and embed CRA notices, bank statements, and pay stubs using multimodal AI',
    editable: { skipable: true, label: 'Run document verification' },
    dependsOn: [],
  },
  {
    id: 'creditPull',
    label: 'Credit Bureau Pull',
    tool: 'Equifax API',
    est: '~120ms',
    step: 2,
    description: 'Retrieve credit report and score from primary bureau',
    editable: { skipable: false },
    dependsOn: [],
  },
  {
    id: 'bankingEnrich',
    label: 'Open Banking Enrichment',
    tool: 'Plaid Connect',
    est: '~95ms',
    step: 3,
    description: 'Pull 12-month transaction history for cash flow analysis',
    editable: { skipable: true, label: 'Include banking data' },
    dependsOn: [],
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
    dependsOn: ['docVerify', 'creditPull', 'bankingEnrich'],
  },
  {
    id: 'policyRag',
    label: 'Policy Compliance Check',
    tool: 'Atlas Vector Search',
    est: '~12ms',
    step: 5,
    description: 'RAG query against institutional lending policies and regulatory requirements',
    editable: { skipable: false },
    dependsOn: ['riskScore'],
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
    dependsOn: ['creditPull'],
  },
];

function parseEstMs(estString) {
  if (!estString) return 0;
  const match = estString.match(/~?(\d+(?:\.\d+)?)\s*(ms|s)/i);
  if (!match) return 0;
  const val = parseFloat(match[1]);
  return match[2].toLowerCase() === 's' ? val * 1000 : val;
}

function getInputReadiness(step, livePlan) {
  if (!step.dependsOn || step.dependsOn.length === 0) return null;
  if (!livePlan) return { ready: 0, total: step.dependsOn.length };
  const ready = step.dependsOn.filter((dep) => livePlan[dep] === 'complete').length;
  return { ready, total: step.dependsOn.length };
}

export default function IntentPreview({ applicationId, onProceed, onManual }) {
  const [expandedSteps, setExpandedSteps] = useState(new Set());
  const [livePlan, setLivePlan] = useState(null);

  useEffect(() => {
    if (!applicationId) return;
    apiGet(`/applications/${applicationId}`).then((app) => {
      if (app) {
        const s = app.status || 'submitted';
        const hasDocs = s !== 'submitted';
        const hasCredit = app.credit_reports?.length > 0;
        const hasRisk = s === 'underwriting' || s === 'review' || s === 'approved' || s === 'declined';
        const hasPolicy = s === 'review' || s === 'approved' || s === 'declined';
        const statusMap = {
          docVerify: hasDocs ? 'complete' : 'pending',
          creditPull: hasCredit ? 'complete' : 'pending',
          bankingEnrich: hasDocs ? 'complete' : 'pending',
          riskScore: hasRisk ? 'complete' : 'pending',
          policyRag: hasPolicy ? 'complete' : 'pending',
          fraudScan: hasPolicy ? 'complete' : 'pending',
        };
        setLivePlan(statusMap);
      }
    });
  }, [applicationId]);

  const planSteps = PLAN_STEPS.map((step) => ({
    ...step,
    status: livePlan?.[step.id] || null,
  }));

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

  const totalEstMs = useMemo(() => {
    return PLAN_STEPS
      .filter((s) => settings[s.id]?.enabled !== false)
      .reduce((sum, s) => sum + parseEstMs(s.est), 0);
  }, [settings]);

  const toggleStep = (stepId) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  };

  const hasEditableControls = (step) => {
    return step.editable?.skipable || step.editable?.threshold || step.editable?.hops;
  };

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
            {'\u25B6'} Execution Plan
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
            {enabledCount} steps {'\u00b7'} Est. total ~{totalEstMs}ms
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
        {planSteps.map((step, i) => {
          const stepSettings = settings[step.id] || {};
          const isDisabled = step.editable?.skipable && !stepSettings.enabled;
          const isExpanded = expandedSteps.has(step.id);
          const isLast = i === planSteps.length - 1;
          const readiness = getInputReadiness(step, livePlan);

          const connectorClass = [
            styles.connector,
            isDisabled ? styles.connectorDisabled : '',
            isLast ? styles.connectorLast : '',
          ].filter(Boolean).join(' ');

          return (
            <div
              key={step.id}
              className={connectorClass}
              style={{
                padding: '8px 10px',
                background: isDisabled ? 'var(--bg-raised)' : 'var(--bg-base)',
                borderRadius: 'var(--radius-sm)',
                border: `1px solid ${isDisabled ? 'var(--border-dim)' : 'var(--border-base)'}`,
                borderLeft: step.status === 'complete' ? '3px solid var(--success)' : undefined,
                opacity: isDisabled ? 0.45 : 1,
                transition: 'opacity 0.2s, background 0.2s, border 0.2s',
                cursor: hasEditableControls(step) ? 'pointer' : 'default',
              }}
              onClick={() => hasEditableControls(step) && toggleStep(step.id)}
              role={hasEditableControls(step) ? 'button' : undefined}
              tabIndex={hasEditableControls(step) ? 0 : undefined}
              onKeyDown={(e) => {
                if (hasEditableControls(step) && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  toggleStep(step.id);
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: step.status === 'complete' ? 'var(--success)' : isDisabled ? 'var(--bg-raised)' : 'var(--agent-cyan-dim)',
                  border: step.status === 'complete' ? 'none' : `1.5px solid ${isDisabled ? 'var(--border-dim)' : 'var(--agent-cyan)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 700,
                  color: step.status === 'complete' ? '#fff' : isDisabled ? 'var(--text-dim)' : 'var(--agent-cyan)',
                  flexShrink: 0, marginTop: 1,
                }}>
                  {step.status === 'complete' ? '\u2713' : i + 1}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: 12, fontWeight: 600,
                      color: isDisabled ? 'var(--text-dim)' : 'var(--text-primary)',
                      textDecoration: isDisabled ? 'line-through' : 'none',
                    }}>
                      {step.label}
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 9,
                      color: 'var(--tool-blue)', padding: '1px 5px',
                      background: 'var(--tool-blue-dim)', borderRadius: 4,
                    }}>
                      {step.tool}
                    </span>
                    {readiness && (
                      <span style={{
                        fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                        background: readiness.ready === readiness.total ? 'var(--success-dim)' : 'var(--hitl-amber-dim)',
                        color: readiness.ready === readiness.total ? 'var(--success)' : 'var(--hitl-amber)',
                        fontFamily: 'var(--font-mono)',
                      }}>
                        {readiness.ready}/{readiness.total} inputs
                      </span>
                    )}
                    {step.status && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                        background: step.status === 'complete' ? 'rgba(0,200,100,0.1)' : 'rgba(255,180,0,0.1)',
                        color: step.status === 'complete' ? 'var(--success, #00c864)' : 'var(--hitl-amber, #ffb400)',
                      }}>
                        {step.status === 'complete' ? '\u2713 done' : '\u25CF pending'}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {step.description}
                  </div>

                  {isExpanded && hasEditableControls(step) && (
                    <div
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, marginTop: 8,
                        paddingTop: 8, borderTop: '1px solid var(--border-dim)', flexWrap: 'wrap',
                        animation: 'slideDown 0.2s ease-out',
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
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

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginTop: 2 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-dim)' }}>
                    {step.est}
                  </span>
                  {hasEditableControls(step) && (
                    <span style={{
                      fontSize: 10, color: 'var(--text-dim)',
                      transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)',
                      transition: 'transform 0.2s',
                      display: 'inline-block',
                    }}>{'\u25BE'}</span>
                  )}
                </div>
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
          {'\u25B6'} Proceed
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
