"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { spacing } from '@leafygreen-ui/tokens';
import ApplicationQueue from './ApplicationQueue';
import AgentActivityLog from './AgentActivityLog';
import IntentPreview from './IntentPreview';
import WorkflowCanvas from '../DemoFlow/WorkflowCanvas';
import NotificationToast, { useToasts } from '../NotificationToast/NotificationToast';
import { apiPost, apiGet, apiSSE, apiWebSocket } from '../../lib/api';

const WORKFLOW_STAGES = [
  {
    label: 'Origination',
    currentScene: 'origination',
    activeNodes: ['supervisor', 'appAgent', 'voyageEmbed', 'creditAPI', 'mongoAtlas'],
    activeEdges: [['supervisor', 'appAgent'], ['appAgent', 'voyageEmbed'], ['appAgent', 'creditAPI']],
    pulsingNodes: ['appAgent'],
    nodeKey: 'loan_app',
  },
  {
    label: 'Decisioning',
    currentScene: 'decisioning',
    activeNodes: ['supervisor', 'underwriter', 'aggregation', 'vectorSearch', 'graphLookup', 'mongoAtlas'],
    activeEdges: [['supervisor', 'underwriter'], ['underwriter', 'aggregation'], ['underwriter', 'vectorSearch'], ['underwriter', 'graphLookup']],
    pulsingNodes: ['underwriter'],
    nodeKey: 'underwriter',
  },
  {
    label: 'HITL Review',
    currentScene: 'approval',
    activeNodes: ['underwriter', 'hitlGate', 'checkpoint', 'mongoAtlas'],
    activeEdges: [['underwriter', 'hitlGate'], ['hitlGate', 'checkpoint'], ['checkpoint', 'mongoAtlas']],
    pulsingNodes: ['hitlGate'],
    nodeKey: 'hitl_gate',
  },
];

const NODE_TO_STAGE = {};
WORKFLOW_STAGES.forEach((s, i) => { NODE_TO_STAGE[s.nodeKey] = i; });

function formatCurrency(amount) {
  if (amount == null) return 'N/A';
  return `$${Number(amount).toLocaleString('en-US')}`;
}

function getAppDisplayName(detail, queueData) {
  if (detail?.borrower_names?.length) return detail.borrower_names.join(' & ');
  return queueData?.name || 'Application';
}

// ─── Modified Parameters Badge ───

function ModifiedParamsBadge({ settings }) {
  if (!settings) return null;
  const mods = [];
  if (settings.docVerify && !settings.docVerify.enabled) mods.push('Doc verify: off');
  if (settings.bankingEnrich && !settings.bankingEnrich.enabled) mods.push('Banking: off');
  if (settings.fraudScan && !settings.fraudScan.enabled) mods.push('Fraud scan: off');
  if (settings.riskScore && settings.riskScore.threshold !== 65) mods.push(`Risk threshold: ${settings.riskScore.threshold}`);
  if (settings.fraudScan && settings.fraudScan.enabled && settings.fraudScan.hops !== 3) mods.push(`Graph depth: ${settings.fraudScan.hops}`);
  if (mods.length === 0) return null;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 8,
      background: 'var(--hitl-amber-dim)', color: 'var(--hitl-amber)',
      fontSize: 9, fontWeight: 600, fontFamily: 'var(--font-mono)',
    }}>
      {mods.join(' · ')}
    </div>
  );
}

// ─── Policy Bounds Indicator (shown during bounded execution) ───

function PolicyBoundsIndicator({ exceeded, policyCitations }) {
  const bounds = policyCitations?.length > 0
    ? policyCitations.map((c) => ({ rule: c.detail || c.action || c, marker: 'ESC' }))
    : [
        { rule: 'Auto-approve if score > 80 and GDS < 36%', marker: 'PASS' },
        { rule: 'Escalate if property value > $500,000', marker: 'ESC' },
        { rule: 'Auto-decline if GDS > 50% or score < 35', marker: 'FAIL' },
      ];

  return (
    <div style={{
      position: 'absolute', top: 12, left: 12, zIndex: 10,
      padding: '10px 12px', width: 240,
      background: 'var(--bg-overlay-alpha)',
      backdropFilter: 'blur(8px)',
      borderRadius: 8,
      border: `1px solid ${exceeded ? 'var(--hitl-amber)' : 'var(--tool-blue)'}`,
      animation: 'slideDown 0.3s ease-out',
    }}>
      <div style={{
        fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
        color: exceeded ? 'var(--hitl-amber)' : 'var(--tool-blue)', marginBottom: 6,
      }}>
        {exceeded ? 'Boundary Exceeded — Escalating' : 'Active Policy Bounds'}
      </div>
      {bounds.map((b, i) => (
        <div key={i} style={{
          fontSize: 9, color: 'var(--text-secondary)', lineHeight: 1.6,
          opacity: exceeded && i >= bounds.length - 1 ? 1 : 0.8,
        }}>
          <span style={{
            display: 'inline-block', fontFamily: 'var(--font-mono)', fontSize: 7, fontWeight: 700,
            padding: '1px 3px', borderRadius: 2, marginRight: 4,
            background: b.marker === 'PASS' ? 'var(--success-dim)' : b.marker === 'FAIL' ? 'var(--danger-dim)' : 'var(--hitl-amber-dim)',
            color: b.marker === 'PASS' ? 'var(--success)' : b.marker === 'FAIL' ? 'var(--danger)' : 'var(--hitl-amber)',
          }}>{b.marker}</span>
          {b.rule}
        </div>
      ))}
    </div>
  );
}

// ─── Manual Review Workspace ───

function ManualWorkspace({ appDetail, queueData, onApprove, onDecline, addToast }) {
  const [rate, setRate] = useState(4.89);
  const [conditions, setConditions] = useState('');
  const [decided, setDecided] = useState(null);

  const appName = getAppDisplayName(appDetail, queueData);
  const product = appDetail?.product || queueData?.product || '';
  const loanAmount = appDetail?.loan_amount ? formatCurrency(appDetail.loan_amount) : (queueData?.amount || '');

  const handleApprove = () => {
    setDecided('approved');
    onApprove({ mode: 'manual', rate: `${rate.toFixed(3)}%`, conditions });
  };

  const handleDecline = () => {
    setDecided('declined');
    onDecline?.();
    if (addToast) addToast({ type: 'warning', icon: '✕', title: 'Application Declined', message: `${appName} — manually declined by officer.` });
  };

  if (decided === 'approved') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ padding: 20, background: 'var(--success-dim)', borderRadius: 8, border: '1px solid var(--success)', textAlign: 'center', maxWidth: 360 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 4px', fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800, color: 'var(--success)' }}>&#10003;</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: 'var(--success)' }}>MANUALLY APPROVED</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
            {product} @ {rate.toFixed(3)}% · {appName}
            {conditions && <><br/>Conditions: {conditions}</>}
          </div>
        </div>
      </div>
    );
  }

  if (decided === 'declined') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ padding: 20, background: 'var(--danger-dim)', borderRadius: 8, border: '1px solid var(--danger)', textAlign: 'center', maxWidth: 360 }}>
          <div style={{ fontSize: 24, marginBottom: 4 }}>✕</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: 'var(--danger)' }}>DECLINED</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
            {appName} — {loanAmount} {product}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div style={{ width: '100%', maxWidth: 460, padding: 20 }}>
        <div style={{
          padding: '8px 10px', marginBottom: 12,
          background: 'var(--bg-raised)', borderRadius: 8,
          border: '1px solid var(--border-dim)',
          fontSize: 10, color: 'var(--hitl-amber)', fontWeight: 600,
        }}>
          Agent activity log paused — manual review in progress
        </div>

        <div style={{
          padding: spacing[3], marginBottom: spacing[3],
          background: 'var(--bg-surface)', borderRadius: 8,
          border: '1px solid var(--border-base)',
        }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, marginBottom: spacing[2] }}>
            {appName}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: spacing[2] }}>
            {[
              { label: 'Amount', value: loanAmount },
              { label: 'Product', value: product },
            ].map((item) => (
              <div key={item.label}>
                <div style={{ fontSize: 8, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 1 }}>{item.label}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600 }}>{item.value || 'N/A'}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{
          padding: spacing[3],
          background: 'var(--bg-surface)', borderRadius: 8,
          border: '1px solid var(--border-base)',
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
            Officer Decision
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2], marginBottom: 10 }}>
            <label htmlFor="rate-slider" style={{ fontSize: 10, color: 'var(--text-secondary)', whiteSpace: 'nowrap', minWidth: 50 }}>Rate (%):</label>
            <input id="rate-slider" type="range" min={5.0} max={9.0} step={0.125} value={rate}
              aria-label="Interest rate percentage"
              onChange={(e) => setRate(+e.target.value)}
              style={{ flex: 1, accentColor: 'var(--mongo)' }}
            />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--mongo)', minWidth: 55 }}>
              {rate.toFixed(3)}%
            </span>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label htmlFor="conditions-input" style={{ fontSize: 10, color: 'var(--text-secondary)', display: 'block', marginBottom: 3 }}>Conditions:</label>
            <input id="conditions-input" type="text" placeholder="e.g., Require 6-month reserve verification"
              value={conditions} onChange={(e) => setConditions(e.target.value)}
              style={{
                width: '100%', padding: '6px 8px', fontSize: 10, fontFamily: 'var(--font-body)',
                background: 'var(--bg-raised)', border: '1px solid var(--border-dim)',
                borderRadius: 6, color: 'var(--text-primary)', outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: spacing[2] }}>
            <button type="button" onClick={handleApprove} style={{
              flex: 1, padding: 10, borderRadius: 8, border: 'none',
              background: 'var(--mongo)', color: '#fff',
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11, cursor: 'pointer',
            }}>
              Approve
            </button>
            <button type="button" onClick={handleDecline} style={{
              flex: 1, padding: 10, borderRadius: 8,
              border: '1px solid var(--danger)', background: 'transparent',
              color: 'var(--danger)', fontFamily: 'var(--font-display)',
              fontWeight: 600, fontSize: 11, cursor: 'pointer',
            }}>
              Decline
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── HITL Review Card (wired to backend) ───

function HITLReviewCard({ applicationId, appDetail, queueData, onApprove, onDecline, addToast }) {
  const [showProvenance, setShowProvenance] = useState(false);
  const [showModify, setShowModify] = useState(false);
  const [fetchingContext, setFetchingContext] = useState(false);
  const [hitlContext, setHitlContext] = useState(null);
  const [modFields, setModFields] = useState({ rate: 4.89, conditions: '', requestDocs: false });

  const app = hitlContext?.application || appDetail || {};
  const activityTrail = hitlContext?.activity_trail || [];
  const appName = getAppDisplayName(app, queueData);
  const loanAmount = app.loan_amount ? formatCurrency(app.loan_amount) : (queueData?.amount || 'N/A');
  const product = app.product || queueData?.product || 'N/A';
  const riskScore = app.risk_score ?? null;
  const policyCitations = activityTrail.filter((a) =>
    a.action?.includes('policy') || a.action?.includes('escalat') || a.action?.includes('autonomy_gate')
  );
  const recommendation = activityTrail.find((a) =>
    a.action?.includes('decision') || a.action?.includes('complete') || a.detail?.includes('recommend')
  );

  const handleRequestContext = async () => {
    setFetchingContext(true);
    if (addToast) addToast({ type: 'info', title: 'Fetching Context', message: 'Retrieving HITL review package from backend...' });
    const ctx = await apiGet(`/hitl/${applicationId}/context`);
    setFetchingContext(false);
    if (ctx) {
      setHitlContext(ctx);
      const count = (ctx.activity_trail?.length || 0) + (ctx.application?.documents?.length || 0);
      if (addToast) addToast({ type: 'success', title: 'Context Retrieved', message: `${count} data points available for review.` });
    } else {
      if (addToast) addToast({ type: 'warning', title: 'Context Unavailable', message: 'Could not retrieve HITL context from backend.' });
    }
  };

  const handleModifySubmit = () => {
    const details = {
      mode: 'modified',
      rate: `${modFields.rate.toFixed(3)}%`,
      conditions: modFields.conditions,
      requestDocs: modFields.requestDocs,
    };
    if (addToast) {
      const parts = [`Rate: ${details.rate}`];
      if (modFields.conditions) parts.push(`Condition: ${modFields.conditions}`);
      if (modFields.requestDocs) parts.push('Additional docs requested');
      addToast({ type: 'success', title: 'Approved with Modifications', message: parts.join(' · ') });
    }
    onApprove(details);
  };

  const handleApproveRecommended = () => {
    onApprove({ mode: 'recommended', rate: recommendation?.detail?.match(/[\d.]+%/)?.[0] || 'as recommended' });
  };

  const modSummary = showModify ? (() => {
    const parts = [];
    if (modFields.rate !== 4.89) parts.push(`Rate adjusted to ${modFields.rate.toFixed(3)}%`);
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

      {/* Agent activity summary */}
      <div style={{
        padding: '8px 10px',
        background: 'var(--bg-raised)',
        borderRadius: 6,
        marginBottom: 12,
        fontSize: 11,
        color: 'var(--text-secondary)',
        lineHeight: 1.5,
      }}>
        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Agent attempted: </span>
        {recommendation?.detail
          ? recommendation.detail.slice(0, 200)
          : `Process ${product} for ${appName} (${loanAmount}). Workflow halted — policy constraints triggered during underwriting.`
        }
      </div>

      {/* Constraints triggered */}
      {policyCitations.length > 0 && (
        <div style={{
          padding: '8px 10px',
          background: 'var(--danger-dim)',
          borderRadius: 6,
          border: '1px solid var(--danger)',
          marginBottom: 12,
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
            Constraints Triggered
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {policyCitations.map((c, i) => (
              <div key={i}>
                {'\u2022'} <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9 }}>{c.agent}</span> — {c.detail || c.action}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Agent recommendation */}
      {recommendation && (
        <div style={{
          padding: '10px 12px',
          background: 'var(--mongo-dim)',
          borderRadius: 6,
          border: '1px solid var(--mongo)',
          marginBottom: 12,
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--mongo)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
            Agent Recommendation
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 600 }}>
            {recommendation.detail?.slice(0, 200) || 'Review and make a decision.'}
          </div>
        </div>
      )}

      {/* Key metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing[3], marginBottom: spacing[3] }}>
        <div>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 2 }}>Risk Score</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 800, color: riskScore != null && riskScore < 50 ? 'var(--danger)' : 'var(--hitl-amber)' }}>
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
              Click &ldquo;Request More Context&rdquo; to load the full activity trail from the backend.
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
          <button type="button" onClick={handleModifySubmit} style={{
            flex: '1 1 auto', padding: 10, borderRadius: 8, border: 'none',
            background: 'var(--agent-cyan)', color: '#fff', fontFamily: 'var(--font-display)',
            fontWeight: 700, fontSize: 11, cursor: 'pointer',
          }}>
            Submit Modified Terms
          </button>
        ) : (
          <button type="button" onClick={handleApproveRecommended} style={{
            flex: '1 1 auto', padding: 10, borderRadius: 8, border: 'none',
            background: 'var(--mongo)', color: '#fff', fontFamily: 'var(--font-display)',
            fontWeight: 700, fontSize: 11, cursor: 'pointer',
          }}>
            Approve as Recommended
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
        <button type="button" onClick={handleRequestContext} disabled={fetchingContext || !!hitlContext} style={{
          flex: '1 1 auto', padding: 10, borderRadius: 8,
          border: '1px solid var(--tool-blue)',
          background: fetchingContext ? 'var(--tool-blue-dim)' : 'transparent',
          color: hitlContext ? 'var(--text-dim)' : 'var(--tool-blue)',
          fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 11,
          cursor: fetchingContext || hitlContext ? 'default' : 'pointer',
          opacity: hitlContext ? 0.5 : 1,
        }}>
          {fetchingContext ? 'Fetching...' : hitlContext ? 'Context Loaded' : 'Request More Context'}
        </button>
        <button type="button" onClick={() => onDecline?.()} style={{
          flex: '1 1 auto', padding: 10, borderRadius: 8,
          border: '1px solid var(--danger)', background: 'transparent',
          color: 'var(--danger)', fontFamily: 'var(--font-display)',
          fontWeight: 600, fontSize: 11, cursor: 'pointer',
        }}>
          Decline
        </button>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───

export default function LoanOfficerDashboard() {
  const [selectedApp, setSelectedApp] = useState(null);
  const [workflowPhase, setWorkflowPhase] = useState('idle');
  const [workflowStage, setWorkflowStage] = useState(0);
  const [hitlReached, setHitlReached] = useState(false);
  const [approved, setApproved] = useState(false);
  const [planSettings, setPlanSettings] = useState(null);
  const [approvalDetails, setApprovalDetails] = useState(null);
  const sseRef = useRef(null);
  const { toasts, addToast, removeToast } = useToasts();
  const [liveApplications, setLiveApplications] = useState([]);
  const [selectedAppDetail, setSelectedAppDetail] = useState(null);

  // Real-time application queue via WebSocket + MongoDB Change Stream
  const snapshotReceived = useRef(false);
  useEffect(() => {
    snapshotReceived.current = false;
    const ws = apiWebSocket('/applications/ws', {
      onMessage: (data) => {
        if (data.type === 'snapshot') {
          snapshotReceived.current = true;
          setLiveApplications(data.applications ?? []);
        } else if (data.type === 'change' && snapshotReceived.current) {
          const app = data.application;
          if (app) {
            setLiveApplications((prev) => {
              const idx = prev.findIndex((a) => a.application_id === app.application_id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = app;
                return next;
              }
              return [app, ...prev];
            });
          }
        }
      },
    });

    return () => ws.close();
  }, []);

  // Fetch selected application detail from backend
  useEffect(() => {
    if (!selectedApp) {
      setSelectedAppDetail(null);
      return;
    }
    apiGet(`/applications/${selectedApp}`).then((data) => {
      setSelectedAppDetail(data);
    });
  }, [selectedApp]);

  // Dashboard stats derived from real data
  const dashboardStats = useMemo(() => {
    const pendingCount = liveApplications.filter(
      (a) => ['review', 'pending_review'].includes(a.status)
    ).length;
    const approvedCount = liveApplications.filter((a) => a.status === 'approved').length;
    return [
      { label: 'Applications', value: String(liveApplications.length), color: 'var(--mongo)' },
      { label: 'Processing', value: String(liveApplications.filter((a) => a.status === 'processing' || a.status === 'underwriting').length), color: 'var(--agent-cyan)' },
      { label: 'Approved', value: String(approvedCount), color: 'var(--success)' },
      { label: 'Pending Reviews', value: String(pendingCount), color: 'var(--hitl-amber)' },
    ];
  }, [liveApplications]);

  // Clean up SSE on unmount
  useEffect(() => {
    return () => { if (sseRef.current) { sseRef.current.close(); sseRef.current = null; } };
  }, []);

  // Reset when selected app changes
  useEffect(() => {
    if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }
    setWorkflowStage(0);
    setHitlReached(false);
    setApproved(false);
    setPlanSettings(null);
    setApprovalDetails(null);

    if (!selectedApp) {
      setWorkflowPhase('idle');
      return;
    }

    setWorkflowPhase('preview');
  }, [selectedApp]);

  // SSE-driven workflow stage progression
  const startWorkflowSSE = useCallback((appId) => {
    if (sseRef.current) sseRef.current.close();

    setWorkflowStage(0);
    setHitlReached(false);
    setApproved(false);
    setWorkflowPhase('executing');

    const source = apiSSE(
      `/agent/${appId}/stream`,
      (event) => {
        if (event.type === 'agent_step' || event.type === 'node_start') {
          const agentName = event.agent || event.name || '';
          const stageIdx = NODE_TO_STAGE[agentName];
          if (stageIdx !== undefined) {
            setWorkflowStage(stageIdx);
          }
        }

        if (event.type === 'node_complete' && event.agent === 'hitl_gate') {
          setHitlReached(true);
          addToast({ type: 'warning', title: 'HITL Review Required', message: `${appId} awaiting your decision.` });
        }

        if (event.type === 'hitl_waiting') {
          setHitlReached(true);
          addToast({ type: 'warning', title: 'HITL Review Required', message: `${appId} awaiting your decision.` });
        }

        if (event.type === 'complete') {
          setApproved(true);
          setApprovalDetails({ mode: 'auto' });
          addToast({ type: 'success', title: 'Pipeline Complete', message: `Agent pipeline completed for ${appId}.` });
        }
      }
    );

    sseRef.current = source;
  }, [addToast]);

  const handleProceed = useCallback((settings) => {
    if (!selectedApp) return;
    setPlanSettings(settings || null);
    apiPost(`/agent/${selectedApp}/run?autonomy_level=bounded`);
    startWorkflowSSE(selectedApp);
    addToast({ type: 'info', title: 'Workflow Started', message: `Processing ${selectedApp} with bounded autonomy.` });
  }, [selectedApp, addToast, startWorkflowSSE]);

  const handleManual = useCallback(() => {
    setWorkflowPhase('manual');
    addToast({ type: 'info', title: 'Manual Mode', message: 'Agent bypassed. You are handling this application directly.' });
  }, [addToast]);

  const selectedAppData = liveApplications.find((a) => a.application_id === selectedApp);
  const appName = getAppDisplayName(selectedAppDetail, selectedAppData);

  const handleApprove = useCallback(async (details) => {
    setApproved(true);
    setApprovalDetails(details || { mode: 'recommended' });
    const rate = details?.rate || '';
    const suffix = details?.conditions ? ` · Conditions: ${details.conditions}` : '';
    addToast({ type: 'success', title: 'Loan Approved', message: `${rate ? `@ ${rate} ` : ''}for ${appName}.${suffix}` });

    if (selectedApp) {
      await apiPost(`/hitl/${selectedApp}/decision`, {
        action: 'approve',
        officer_notes: details?.conditions || 'Approved after manual review',
      });
    }
  }, [addToast, selectedApp, appName]);

  const handleDecline = useCallback(async () => {
    setApproved(true);
    setApprovalDetails({ mode: 'declined' });
    addToast({ type: 'warning', title: 'Application Declined', message: `${appName} — declined after manual review.` });

    if (selectedApp) {
      await apiPost(`/hitl/${selectedApp}/decision`, {
        action: 'decline',
        officer_notes: 'Declined after manual review',
      });
    }
  }, [addToast, selectedApp, appName]);

  const handleAgentEvent = useCallback(() => {}, []);

  const currentWorkflow = WORKFLOW_STAGES[workflowStage] || WORKFLOW_STAGES[WORKFLOW_STAGES.length - 1];

  const statusBadge = () => {
    if (!selectedApp) return null;
    if (approved && approvalDetails?.mode === 'declined') return { label: 'Declined', bg: 'var(--danger-dim)', color: 'var(--danger)' };
    if (approved) return { label: 'Approved', bg: 'var(--success-dim)', color: 'var(--success)' };
    if (hitlReached) return { label: 'Awaiting Review', bg: 'var(--hitl-amber-dim)', color: 'var(--hitl-amber)' };
    if (workflowPhase === 'preview') return { label: 'Plan Ready', bg: 'var(--agent-cyan-dim)', color: 'var(--agent-cyan)' };
    if (workflowPhase === 'manual') return { label: 'Manual Mode', bg: 'var(--bg-raised)', color: 'var(--text-secondary)' };
    if (workflowPhase === 'executing') return { label: `Processing: ${currentWorkflow.label}`, bg: 'var(--agent-cyan-dim)', color: 'var(--agent-cyan)' };
    return null;
  };

  const badge = statusBadge();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 52px)', background: 'var(--bg-void)' }}>
      {/* Stats bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: spacing[3],
        padding: `12px ${spacing[5]}px`,
        borderBottom: '1px solid var(--border-dim)',
        background: 'var(--bg-base)',
      }}>
        {dashboardStats.map((s) => (
          <div key={s.label} style={{
            padding: spacing[2],
            background: 'var(--bg-surface)',
            borderRadius: 8,
            border: '1px solid var(--border-dim)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          }}>
            <div style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 2, letterSpacing: '0.5px' }}>{s.label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 800, color: s.color, transition: 'all 0.5s cubic-bezier(0.33, 1, 0.68, 1)' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Main content */}
      <div className="officer-layout" style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <ApplicationQueue selectedId={selectedApp} onSelect={setSelectedApp} applications={liveApplications} />

        {/* Center: Workflow Monitor */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
          {/* App header */}
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-dim)', background: 'var(--bg-base)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2], flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>
                {selectedApp ? (selectedAppData?.name || appName) : 'Select an application'}
              </span>
              {selectedApp && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)' }}>
                  {selectedApp}
                </span>
              )}
              <ModifiedParamsBadge settings={planSettings} />
            </div>
            {badge && (
              <span style={{
                fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 12,
                background: badge.bg, color: badge.color,
              }}>
                {badge.label}
              </span>
            )}
          </div>

          {/* Intent Preview (pre-action) */}
          {selectedApp && workflowPhase === 'preview' && (
            <div style={{ padding: spacing[3], borderBottom: '1px solid var(--border-dim)', background: 'var(--bg-base)', overflowY: 'auto', maxHeight: '50vh' }}>
              <IntentPreview applicationId={selectedApp} onProceed={handleProceed} onManual={handleManual} />
            </div>
          )}

          {/* Workflow Canvas + overlays */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            {selectedApp && (workflowPhase === 'executing' || workflowPhase === 'preview') ? (
              <>
                <WorkflowCanvas
                  activeNodes={workflowPhase === 'preview' ? [] : currentWorkflow.activeNodes}
                  activeEdges={workflowPhase === 'preview' ? [] : currentWorkflow.activeEdges}
                  pulsingNodes={workflowPhase === 'preview' ? [] : hitlReached ? ['hitlGate'] : currentWorkflow.pulsingNodes}
                  currentScene={workflowPhase === 'preview' ? 'origination' : currentWorkflow.currentScene}
                />

                {workflowPhase === 'executing' && (
                  <PolicyBoundsIndicator exceeded={hitlReached} />
                )}

                <div style={{
                  position: 'absolute', bottom: 12, left: 12, right: 12,
                  padding: '10px 14px',
                  background: 'var(--bg-overlay-alpha)',
                  backdropFilter: 'blur(8px)',
                  borderRadius: 8,
                  border: '1px solid var(--border-dim)',
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)', marginRight: 6 }}>
                    {workflowPhase === 'preview'
                      ? 'Execution Plan'
                      : hitlReached
                        ? 'HITL Gate'
                        : `Stage: ${currentWorkflow.label}`
                    }
                  </span>
                  {workflowPhase === 'preview'
                    ? 'Agent has generated an execution plan. Review and approve above to begin processing.'
                    : hitlReached && !approved
                      ? 'Agent workflow paused. All state persisted to MongoDB via MongoDBSaver. Awaiting officer decision.'
                      : approved
                        ? 'Decision recorded. Workflow resuming from checkpoint.'
                        : `Agents are processing this application through the ${currentWorkflow.label.toLowerCase()} stage.`
                  }
                </div>
              </>
            ) : selectedApp && workflowPhase === 'manual' ? (
              <ManualWorkspace appDetail={selectedAppDetail} queueData={selectedAppData} onApprove={handleApprove} onDecline={handleDecline} addToast={addToast} />
            ) : !selectedApp ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <div style={{
                  textAlign: 'center', padding: spacing[5],
                  border: '2px dashed var(--border-dim)', borderRadius: 8,
                  background: '#FAFBFA',
                }}>
                  <div style={{ width: 48, height: 48, borderRadius: 8, border: '2px dashed var(--border-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', opacity: 0.5 }}>APP</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-dim)', fontSize: 13 }}>
                    Select an application from the queue
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                    Submit one from the Borrower Portal to get started
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* HITL Review panel */}
          {selectedApp && hitlReached && !approved && (
            <div style={{ padding: spacing[3], borderTop: '1px solid var(--border-dim)', background: 'var(--bg-base)', overflowY: 'auto', maxHeight: '55vh' }}>
              <HITLReviewCard
                applicationId={selectedApp}
                appDetail={selectedAppDetail}
                queueData={selectedAppData}
                onApprove={handleApprove}
                onDecline={handleDecline}
                addToast={addToast}
              />
            </div>
          )}

          {/* Approved / Declined card */}
          {selectedApp && approved && (
            <div style={{ padding: spacing[3], borderTop: '1px solid var(--border-dim)', background: 'var(--bg-base)', textAlign: 'center' }}>
              <div style={{
                padding: spacing[3],
                background: approvalDetails?.mode === 'declined' ? 'var(--danger-dim)' : 'var(--success-dim)',
                borderRadius: 8,
                border: `1px solid ${approvalDetails?.mode === 'declined' ? 'var(--danger)' : 'var(--success)'}`,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  border: `2px solid ${approvalDetails?.mode === 'declined' ? 'var(--danger)' : 'var(--success)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 4px',
                  fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800,
                  color: approvalDetails?.mode === 'declined' ? 'var(--danger)' : 'var(--success)',
                }}>
                  {approvalDetails?.mode === 'declined' ? '\u2715' : '\u2713'}
                </div>
                <div style={{
                  fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16,
                  color: approvalDetails?.mode === 'declined' ? 'var(--danger)' : 'var(--success)',
                }}>
                  {approvalDetails?.mode === 'declined' ? 'DECLINED' : 'LOAN APPROVED'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {appName} — {selectedAppDetail?.product || selectedAppData?.product || ''}
                  {approvalDetails?.rate && ` @ ${approvalDetails.rate}`}
                  {approvalDetails?.conditions && <><br/>Conditions: {approvalDetails.conditions}</>}
                </div>
              </div>
            </div>
          )}
        </div>

        <AgentActivityLog
          onEvent={handleAgentEvent}
          applicationId={selectedApp}
        />
      </div>

      <NotificationToast toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
