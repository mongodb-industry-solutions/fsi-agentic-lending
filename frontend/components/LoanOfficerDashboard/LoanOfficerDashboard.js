"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import ApplicationQueue from './ApplicationQueue';
import AgentActivityLog from './AgentActivityLog';
import IntentPreview from './IntentPreview';
import AutonomyDial from './AutonomyDial';
import WorkflowCanvas from '../DemoFlow/WorkflowCanvas';
import NotificationToast, { useToasts } from '../NotificationToast/NotificationToast';
import BeforeAfterStat from '../educational/BeforeAfterStat';
import { apiPost, apiGet, apiSSE, apiWebSocket } from '../../lib/api';

const WORKFLOW_STAGES = [
  {
    label: 'Origination',
    currentScene: 'origination',
    activeNodes: ['supervisor', 'appAgent', 'voyageEmbed', 'creditAPI', 'mongoAtlas'],
    activeEdges: [['supervisor', 'appAgent'], ['appAgent', 'voyageEmbed'], ['appAgent', 'creditAPI']],
    pulsingNodes: ['appAgent'],
  },
  {
    label: 'Decisioning',
    currentScene: 'decisioning',
    activeNodes: ['supervisor', 'underwriter', 'aggregation', 'vectorSearch', 'graphLookup', 'mongoAtlas'],
    activeEdges: [['supervisor', 'underwriter'], ['underwriter', 'aggregation'], ['underwriter', 'vectorSearch'], ['underwriter', 'graphLookup']],
    pulsingNodes: ['underwriter'],
  },
  {
    label: 'HITL Review',
    currentScene: 'approval',
    activeNodes: ['underwriter', 'hitlGate', 'checkpoint', 'mongoAtlas'],
    activeEdges: [['underwriter', 'hitlGate'], ['hitlGate', 'checkpoint'], ['checkpoint', 'mongoAtlas']],
    pulsingNodes: ['hitlGate'],
  },
];

const PAYLOAD = {
  applicant: 'Marcus & Sofia Delgado',
  applicationId: 'APP-2026-00001',
  loanAmount: '$875,000',
  product: '5yr Fixed',
  riskScore: 72,
  riskTier: 'B+',
  proposedRate: '4.89%',
  monthlyPayment: '$4,047',
  dti: 0.312,
  ltv: 80.0,
  triggerReason: 'Combined GDS ratio 31.2% within tolerance but property value exceeds $500K threshold per policy §3.1.4',
};

const PROVENANCE_RECORDS = [
  {
    source: 'Credit Report — Equifax',
    finding: '3 hard inquiries within last 180 days',
    policy: '§4.2.1',
    rule: 'Applications with ≥3 hard inquiries within 180 days require mandatory officer review',
  },
  {
    source: 'Risk Score — Aggregation Pipeline',
    finding: 'Score 72/100 (B+ tier) on loan amount $875,000',
    policy: '§3.1.4',
    rule: 'Property value exceeding $500,000 requires officer sign-off',
  },
  {
    source: 'GDS Calculation — Cash Flow Analysis',
    finding: 'GDS ratio at 31.2% with recent credit activity',
    policy: '§3.2.1',
    rule: 'GDS between 28-36% combined with recent inquiry activity flagged for review',
  },
];

const ADDITIONAL_CONTEXT = [
  { label: 'Employment Verification', value: 'Marcus: 8+ years at TechNova Systems Inc. · Sofia: 9+ years at Covenant Health', icon: '💼' },
  { label: 'Savings Reserves', value: '12 months of payments ($49,104) in verified savings + RRSP + investments', icon: '🏦' },
  { label: 'Existing Property', value: 'Edmonton condo at 10180 104 St NW — rented at $2,200/mo, mortgage $231,450 remaining', icon: '📊' },
];

const POLICY_BOUNDS = [
  { rule: 'Auto-approve if score > 80 and GDS < 36%', icon: '✓' },
  { rule: 'Escalate if property value > $500,000', icon: '🔒' },
  { rule: 'Escalate on ≥3 hard inquiries in 180 days', icon: '🔒' },
  { rule: 'Auto-decline if GDS > 50% or score < 35', icon: '✕' },
];

const AUDIT_STAGES = [
  { label: 'Origination', duration: '3.8s', decisions: ['Routed to Loan Application Agent', 'Selected Equifax per policy §2.1.3', 'Multimodal embed: CRA notices + bank statements'] },
  { label: 'Decisioning', duration: '4.1s', decisions: ['7-stage aggregation pipeline: scored 72 (B+)', 'Policy RAG matched 3 rules (§4.2.1, §3.1.4, §3.2.1)', '$graphLookup fraud scan: 2,847 entities, 0 signals'] },
  { label: 'HITL Review', duration: '1.5s', decisions: ['3 policy triggers detected — normally escalates', 'Full Auto override: auto-applied conditional approval', 'Rate set at 4.89% per B+ tier schedule'] },
];

// ─── Scenario data for non-primary applications ───

const ELENA_AUDIT = {
  name: 'Elena Rodriguez',
  appId: 'APP-2025-78215',
  amount: '$195,000',
  product: '15yr Fixed',
  score: 88,
  tier: 'A',
  rate: '5.625%',
  mode: 'Act Within Limits',
  stages: [
    { label: 'Origination', duration: '2.9s', status: 'passed', note: 'All documents verified, no discrepancies' },
    { label: 'Decisioning', duration: '3.2s', status: 'passed', note: 'Score 88 A-tier — all thresholds cleared' },
    { label: 'HITL Review', duration: '0s', status: 'skipped', note: 'No policy triggers — auto-approved within bounds' },
  ],
  decisions: [
    'Credit score 780, 12-year history, 0 derogatory marks',
    'DTI 24% — well within auto-approve threshold of 36%',
    'Loan amount $195K below $250K officer review threshold',
    'Auto-approved per bounded policy — no escalation needed',
  ],
  totalTokens: 4120,
  totalCost: '$0.035',
  totalLatency: '6.1s',
};

const JAMES_DECLINE = {
  name: 'James Wilson',
  appId: 'APP-2025-78091',
  amount: '$175,000',
  product: 'Personal Loan',
  score: 41,
  tier: 'D',
  violations: [
    { policy: '§5.1.1', label: 'DTI ratio at 54% exceeds maximum threshold of 50%', severity: 'critical' },
    { policy: '§5.2.3', label: '2 derogatory marks within last 24 months', severity: 'critical' },
    { policy: '§3.3.1', label: 'Insufficient verified income — stated income exceeds Plaid deposits by 28%', severity: 'high' },
    { policy: '§4.1.2', label: 'Employment tenure < 1 year at current employer', severity: 'moderate' },
  ],
  agentNote: 'Application auto-declined by underwriting agent. Score of 41 (D-tier) falls below minimum threshold of 50 for all loan products. 2 critical policy violations prevent manual override without VP-level exception.',
  declinedAt: '9:12 AM',
};

const PRIYA_PROGRESS = {
  name: 'Priya Patel',
  appId: 'APP-2025-78143',
  amount: '$510,000',
  product: 'ARM 7/1',
  currentStage: 1,
  completedStages: [
    { label: 'Origination', duration: '4.2s', note: '5 documents processed, 2 flagged for multi-page extraction' },
  ],
  activeStage: { label: 'Decisioning', elapsed: '2.1s', progress: 60, currentOp: 'Running 7-stage aggregation pipeline...' },
  logEntries: [
    { agent: 'Supervisor', action: 'Routing to Loan Application Agent', time: '7:55 AM' },
    { agent: 'Voyage AI', action: 'Multimodal embedding: tax returns (3 pages)', time: '7:55 AM' },
    { agent: 'Loan App Agent', action: 'Credit bureau pull: TransUnion', time: '7:56 AM' },
    { agent: 'Supervisor', action: 'Routing to Underwriting Agent', time: '7:56 AM' },
    { agent: 'Underwriting Agent', action: 'Aggregation pipeline: 7-stage risk scoring...', time: '7:57 AM' },
  ],
};

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
      ⚙ {mods.join(' · ')}
    </div>
  );
}

// ─── Observe Mode Confirmation Bar ───

function ObserveConfirmBar({ currentStage, nextLabel, onContinue, onTakeOver }) {
  return (
    <div style={{
      position: 'absolute', top: 12, left: 12, right: 12, zIndex: 10,
      padding: '10px 14px',
      background: 'var(--bg-overlay-alpha)',
      backdropFilter: 'blur(8px)',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--agent-cyan)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      animation: 'slideDown 0.3s ease-out',
    }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
          👁 Observe Mode — Stage complete: {WORKFLOW_STAGES[currentStage].label}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
          {nextLabel ? `Ready to advance to ${nextLabel}. Confirm to continue.` : 'All stages complete. Proceed to officer review.'}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" onClick={onTakeOver} style={{
          padding: '6px 12px', borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-base)', background: 'transparent',
          color: 'var(--text-secondary)', fontFamily: 'var(--font-display)',
          fontWeight: 600, fontSize: 10, cursor: 'pointer',
        }}>
          Take Over
        </button>
        <button type="button" onClick={onContinue} style={{
          padding: '6px 14px', borderRadius: 'var(--radius-sm)',
          border: 'none', background: 'var(--mongo)', color: '#fff',
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 10, cursor: 'pointer',
        }}>
          {nextLabel ? `Continue to ${nextLabel}` : 'Proceed to Review'} →
        </button>
      </div>
    </div>
  );
}

// ─── Policy Bounds Indicator (Bounded mode) ───

function PolicyBoundsIndicator({ exceeded }) {
  return (
    <div style={{
      position: 'absolute', top: 12, left: 12, zIndex: 10,
      padding: '10px 12px', width: 240,
      background: 'var(--bg-overlay-alpha)',
      backdropFilter: 'blur(8px)',
      borderRadius: 'var(--radius-md)',
      border: `1px solid ${exceeded ? 'var(--hitl-amber)' : 'var(--tool-blue)'}`,
      animation: 'slideDown 0.3s ease-out',
    }}>
      <div style={{
        fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
        color: exceeded ? 'var(--hitl-amber)' : 'var(--tool-blue)', marginBottom: 6,
      }}>
        {exceeded ? '⚠ Boundary Exceeded — Escalating' : '🔒 Active Policy Bounds'}
      </div>
      {POLICY_BOUNDS.map((b, i) => (
        <div key={i} style={{
          fontSize: 9, color: 'var(--text-secondary)', lineHeight: 1.6,
          opacity: exceeded && i >= 2 ? 1 : 0.8,
        }}>
          <span style={{ marginRight: 4, color: exceeded && i === 2 ? 'var(--hitl-amber)' : 'var(--text-dim)' }}>{b.icon}</span>
          {b.rule}
          {exceeded && i === 2 && (
            <span style={{ marginLeft: 4, fontSize: 8, fontWeight: 700, color: 'var(--hitl-amber)' }}>← TRIGGERED</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Full Auto Audit Summary Card ───

function AutoAuditSummary({ stageTimestamps, approvalDetails, onRollback, onAccept }) {
  const stageDurations = AUDIT_STAGES.map((s, i) => {
    const ts = stageTimestamps || [];
    const start = ts[i] || 0;
    const end = ts[i + 1] || ts[ts.length - 1] || Date.now();
    const dur = start ? ((end - start) / 1000).toFixed(1) : s.duration.replace('s', '');
    return { ...s, computedDuration: `${dur}s` };
  });

  const totalTokens = 6269;
  const totalCost = '$0.053';
  const totalLatency = stageDurations.reduce((sum, s) => sum + parseFloat(s.computedDuration), 0).toFixed(1);

  return (
    <div style={{
      padding: 16, background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)',
      border: '2px solid var(--success)', animation: 'slideDown 0.3s ease-out',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            padding: '4px 10px', borderRadius: 12,
            background: 'var(--success-dim)', color: 'var(--success)',
            fontWeight: 700, fontSize: 11,
          }}>
            ✅ Autonomous Approval Complete
          </span>
        </div>
        <span style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
          Full Auto · {PAYLOAD.applicationId}
        </span>
      </div>

      {/* Stage timeline */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
          Stage Timeline
        </div>
        {stageDurations.map((stage, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10,
            paddingLeft: 8, borderLeft: '2px solid var(--success)',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {stage.label}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--mongo)', fontWeight: 700 }}>
                  {stage.computedDuration}
                </span>
              </div>
              {stage.decisions.map((d, j) => (
                <div key={j} style={{ fontSize: 9, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  • {d}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Approval detail */}
      <div style={{
        padding: '8px 10px', background: 'var(--success-dim)', borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--success)', marginBottom: 12, fontSize: 11,
      }}>
        <span style={{ fontWeight: 700, color: 'var(--success)' }}>Decision: </span>
        <span style={{ color: 'var(--text-primary)' }}>
          Approved {PAYLOAD.product} @ {approvalDetails?.rate || PAYLOAD.proposedRate} for {PAYLOAD.applicant} ({PAYLOAD.loanAmount})
        </span>
      </div>

      {/* Cost summary */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14,
        padding: '8px 10px', background: 'var(--bg-raised)', borderRadius: 'var(--radius-sm)',
      }}>
        <div>
          <div style={{ fontSize: 8, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>Tokens</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--voyage)' }}>{totalTokens.toLocaleString()}</div>
        </div>
        <div>
          <div style={{ fontSize: 8, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>Cost</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--mongo)' }}>{totalCost}</div>
        </div>
        <div>
          <div style={{ fontSize: 8, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>Total Time</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--agent-cyan)' }}>{totalLatency}s</div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={onAccept} style={{
          flex: 2, padding: 10, borderRadius: 'var(--radius-md)', border: 'none',
          background: 'var(--success)', color: '#fff',
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11, cursor: 'pointer',
        }}>
          ✓ Accept & Close
        </button>
        <button type="button" onClick={onRollback} style={{
          flex: 1, padding: 10, borderRadius: 'var(--radius-md)',
          border: '1px solid var(--danger)', background: 'transparent',
          color: 'var(--danger)', fontFamily: 'var(--font-display)',
          fontWeight: 600, fontSize: 11, cursor: 'pointer',
        }}>
          ↩ Rollback to Review
        </button>
      </div>
    </div>
  );
}

// ─── Elena Audit Summary (completed, auto-approved) ───

function ElenaAuditView() {
  return (
    <div style={{ padding: 20, overflowY: 'auto', height: '100%' }}>
      <div style={{
        padding: 16, background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--success)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{
            padding: '4px 10px', borderRadius: 12,
            background: 'var(--success-dim)', color: 'var(--success)',
            fontWeight: 700, fontSize: 11,
          }}>
            ✅ Auto-Approved
          </span>
          <span style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
            {ELENA_AUDIT.mode} · 8:32 AM
          </span>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14,
          padding: 10, background: 'var(--bg-raised)', borderRadius: 'var(--radius-sm)',
        }}>
          {[
            { label: 'Score', value: `${ELENA_AUDIT.score} (${ELENA_AUDIT.tier})`, color: 'var(--success)' },
            { label: 'Rate', value: ELENA_AUDIT.rate, color: 'var(--mongo)' },
            { label: 'Amount', value: ELENA_AUDIT.amount },
            { label: 'Product', value: ELENA_AUDIT.product },
          ].map((m) => (
            <div key={m.label}>
              <div style={{ fontSize: 8, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 1 }}>{m.label}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: m.color || 'var(--text-primary)' }}>{m.value}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
          Stage Audit
        </div>
        {ELENA_AUDIT.stages.map((s, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6,
            padding: '6px 10px', background: 'var(--bg-raised)', borderRadius: 'var(--radius-sm)',
          }}>
            <span style={{
              fontSize: 10, fontWeight: 700,
              color: s.status === 'passed' ? 'var(--success)' : s.status === 'skipped' ? 'var(--text-dim)' : 'var(--agent-cyan)',
            }}>
              {s.status === 'passed' ? '✓' : s.status === 'skipped' ? '—' : '⏳'}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-primary)' }}>{s.label}</div>
              <div style={{ fontSize: 9, color: 'var(--text-secondary)' }}>{s.note}</div>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--mongo)' }}>{s.duration}</span>
          </div>
        ))}

        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 12, marginBottom: 6 }}>
          Key Decisions
        </div>
        {ELENA_AUDIT.decisions.map((d, i) => (
          <div key={i} style={{ fontSize: 9, color: 'var(--text-secondary)', lineHeight: 1.6 }}>• {d}</div>
        ))}

        <div style={{
          display: 'flex', gap: 12, marginTop: 12, padding: '6px 10px',
          background: 'var(--bg-raised)', borderRadius: 'var(--radius-sm)', fontSize: 9, color: 'var(--text-dim)',
        }}>
          <span>Tokens: <span style={{ fontWeight: 700, color: 'var(--voyage)' }}>{ELENA_AUDIT.totalTokens.toLocaleString()}</span></span>
          <span>Cost: <span style={{ fontWeight: 700, color: 'var(--mongo)' }}>{ELENA_AUDIT.totalCost}</span></span>
          <span>Time: <span style={{ fontWeight: 700, color: 'var(--agent-cyan)' }}>{ELENA_AUDIT.totalLatency}</span></span>
        </div>
      </div>
    </div>
  );
}

// ─── James Decline Card ───

function JamesDeclineView() {
  return (
    <div style={{ padding: 20, overflowY: 'auto', height: '100%' }}>
      <div style={{
        padding: 16, background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--danger)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{
            padding: '4px 10px', borderRadius: 12,
            background: 'var(--danger-dim)', color: 'var(--danger)',
            fontWeight: 700, fontSize: 11,
          }}>
            ✕ Application Declined
          </span>
          <span style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
            Auto-declined · {JAMES_DECLINE.declinedAt}
          </span>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14,
          padding: 10, background: 'var(--bg-raised)', borderRadius: 'var(--radius-sm)',
        }}>
          {[
            { label: 'Score', value: `${JAMES_DECLINE.score} (${JAMES_DECLINE.tier})`, color: 'var(--danger)' },
            { label: 'Amount', value: JAMES_DECLINE.amount },
            { label: 'Product', value: JAMES_DECLINE.product },
            { label: 'Status', value: 'Declined', color: 'var(--danger)' },
          ].map((m) => (
            <div key={m.label}>
              <div style={{ fontSize: 8, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 1 }}>{m.label}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: m.color || 'var(--text-primary)' }}>{m.value}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
          Policy Violations
        </div>
        {JAMES_DECLINE.violations.map((v, i) => (
          <div key={i} style={{
            padding: '6px 10px', marginBottom: 6,
            background: v.severity === 'critical' ? 'var(--danger-dim)' : 'var(--bg-raised)',
            borderRadius: 'var(--radius-sm)',
            border: `1px solid ${v.severity === 'critical' ? 'var(--danger)' : 'var(--border-dim)'}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 700,
                padding: '1px 4px', borderRadius: 3,
                background: v.severity === 'critical' ? 'var(--danger)' : v.severity === 'high' ? 'var(--hitl-amber)' : 'var(--text-dim)',
                color: '#fff',
              }}>
                {v.severity.toUpperCase()}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-dim)' }}>{v.policy}</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 3 }}>{v.label}</div>
          </div>
        ))}

        <div style={{
          padding: '10px 12px', marginTop: 8,
          background: 'var(--bg-raised)', borderRadius: 'var(--radius-sm)',
          borderLeft: '2px solid var(--danger)',
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
            Agent Assessment
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {JAMES_DECLINE.agentNote}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Priya In-Progress View ───

function PriyaProgressView() {
  return (
    <div style={{ padding: 20, overflowY: 'auto', height: '100%' }}>
      <div style={{
        padding: 16, background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--tool-blue)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{
            padding: '4px 10px', borderRadius: 12,
            background: 'var(--tool-blue-dim)', color: 'var(--tool-blue)',
            fontWeight: 700, fontSize: 11,
          }}>
            ⏳ Processing — Underwriting
          </span>
          <span style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
            {PRIYA_PROGRESS.appId}
          </span>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14,
          padding: 10, background: 'var(--bg-raised)', borderRadius: 'var(--radius-sm)',
        }}>
          {[
            { label: 'Amount', value: PRIYA_PROGRESS.amount },
            { label: 'Product', value: PRIYA_PROGRESS.product },
            { label: 'Current Stage', value: 'Decisioning', color: 'var(--tool-blue)' },
          ].map((m) => (
            <div key={m.label}>
              <div style={{ fontSize: 8, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 1 }}>{m.label}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: m.color || 'var(--text-primary)' }}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* Stage progress */}
        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
          Stage Progress
        </div>
        {PRIYA_PROGRESS.completedStages.map((s, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6,
            padding: '6px 10px', background: 'var(--bg-raised)', borderRadius: 'var(--radius-sm)',
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--success)' }}>✓</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-primary)' }}>{s.label}</div>
              <div style={{ fontSize: 9, color: 'var(--text-secondary)' }}>{s.note}</div>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--mongo)' }}>{s.duration}</span>
          </div>
        ))}

        {/* Active stage with progress bar */}
        <div style={{
          padding: '8px 10px', marginBottom: 10,
          background: 'var(--tool-blue-dim)', borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--tool-blue)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--tool-blue)' }}>
              ⏳ {PRIYA_PROGRESS.activeStage.label}
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-dim)' }}>
              {PRIYA_PROGRESS.activeStage.elapsed} elapsed
            </span>
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginBottom: 6 }}>
            {PRIYA_PROGRESS.activeStage.currentOp}
          </div>
          <div style={{ height: 3, borderRadius: 2, background: 'var(--bg-raised)', overflow: 'hidden' }}>
            <div style={{
              width: `${PRIYA_PROGRESS.activeStage.progress}%`,
              height: '100%', borderRadius: 2,
              background: 'var(--tool-blue)',
              transition: 'width 0.3s',
            }} />
          </div>
        </div>

        {/* Recent log entries */}
        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
          Recent Activity
        </div>
        {PRIYA_PROGRESS.logEntries.map((e, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4,
            padding: '4px 8px', fontSize: 9, color: 'var(--text-secondary)',
          }}>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)', minWidth: 100 }}>{e.agent}</span>
            <span style={{ flex: 1 }}>{e.action}</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', fontSize: 8 }}>{e.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Manual Review Workspace ───

function ManualWorkspace({ onApprove, onDecline, addToast }) {
  const [rate, setRate] = useState(4.89);
  const [conditions, setConditions] = useState('');
  const [decided, setDecided] = useState(null);

  const handleApprove = () => {
    setDecided('approved');
    onApprove({ mode: 'manual', rate: `${rate.toFixed(3)}%`, conditions });
  };

  const handleDecline = () => {
    setDecided('declined');
    onDecline?.();
    if (addToast) addToast({ type: 'warning', icon: '✕', title: 'Application Declined', message: `${PAYLOAD.applicant} — manually declined by officer.` });
  };

  if (decided === 'approved') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ padding: 20, background: 'var(--success-dim)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--success)', textAlign: 'center', maxWidth: 360 }}>
          <div style={{ fontSize: 24, marginBottom: 4 }}>✅</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: 'var(--success)' }}>MANUALLY APPROVED</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
            {PAYLOAD.product} @ {rate.toFixed(3)}% · {PAYLOAD.applicant}
            {conditions && <><br/>Conditions: {conditions}</>}
          </div>
        </div>
      </div>
    );
  }

  if (decided === 'declined') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ padding: 20, background: 'var(--danger-dim)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--danger)', textAlign: 'center', maxWidth: 360 }}>
          <div style={{ fontSize: 24, marginBottom: 4 }}>✕</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: 'var(--danger)' }}>DECLINED</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
            {PAYLOAD.applicant} — {PAYLOAD.loanAmount} {PAYLOAD.product}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div style={{ width: '100%', maxWidth: 460, padding: 20 }}>
        {/* Header */}
        <div style={{
          padding: '8px 10px', marginBottom: 12,
          background: 'var(--bg-raised)', borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-dim)',
          fontSize: 10, color: 'var(--hitl-amber)', fontWeight: 600,
        }}>
          ⚠ Agent activity log paused — manual review in progress
        </div>

        {/* Applicant card */}
        <div style={{
          padding: 14, marginBottom: 14,
          background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-base)',
        }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
            {PAYLOAD.applicant}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {[
              { label: 'Amount', value: PAYLOAD.loanAmount },
              { label: 'Product', value: PAYLOAD.product },
              { label: 'GDS', value: PAYLOAD.dti },
              { label: 'LTV', value: `${PAYLOAD.ltv}%` },
            ].map((item) => (
              <div key={item.label}>
                <div style={{ fontSize: 8, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 1 }}>{item.label}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600 }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Decision form */}
        <div style={{
          padding: 14,
          background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-base)',
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
            Officer Decision
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <label style={{ fontSize: 10, color: 'var(--text-secondary)', whiteSpace: 'nowrap', minWidth: 50 }}>Rate (%):</label>
            <input type="range" min={5.0} max={9.0} step={0.125} value={rate}
              onChange={(e) => setRate(+e.target.value)}
              style={{ flex: 1, accentColor: 'var(--mongo)' }}
            />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--mongo)', minWidth: 55 }}>
              {rate.toFixed(3)}%
            </span>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 10, color: 'var(--text-secondary)', display: 'block', marginBottom: 3 }}>Conditions:</label>
            <input type="text" placeholder="e.g., Require 6-month reserve verification"
              value={conditions} onChange={(e) => setConditions(e.target.value)}
              style={{
                width: '100%', padding: '6px 8px', fontSize: 10, fontFamily: 'var(--font-body)',
                background: 'var(--bg-raised)', border: '1px solid var(--border-dim)',
                borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={handleApprove} style={{
              flex: 1, padding: 10, borderRadius: 'var(--radius-md)', border: 'none',
              background: 'var(--mongo)', color: '#fff',
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11, cursor: 'pointer',
            }}>
              ✓ Approve
            </button>
            <button type="button" onClick={handleDecline} style={{
              flex: 1, padding: 10, borderRadius: 'var(--radius-md)',
              border: '1px solid var(--danger)', background: 'transparent',
              color: 'var(--danger)', fontFamily: 'var(--font-display)',
              fontWeight: 600, fontSize: 11, cursor: 'pointer',
            }}>
              ✕ Decline
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── HITL Review Card ───

function HITLReviewCard({ onApprove, addToast }) {
  const [showProvenance, setShowProvenance] = useState(false);
  const [showModify, setShowModify] = useState(false);
  const [fetchingContext, setFetchingContext] = useState(false);
  const [extraContext, setExtraContext] = useState(null);
  const [modFields, setModFields] = useState({ rate: 4.89, conditions: '', requestDocs: false });

  const handleRequestContext = () => {
    setFetchingContext(true);
    if (addToast) addToast({ type: 'info', icon: '🔎', title: 'Fetching Context', message: 'Agent is retrieving additional applicant data...' });
    setTimeout(() => {
      setFetchingContext(false);
      setExtraContext(ADDITIONAL_CONTEXT);
      if (addToast) addToast({ type: 'success', icon: '📋', title: 'Context Retrieved', message: '3 additional data points available for review.' });
    }, 2000);
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
      addToast({ type: 'success', icon: '✅', title: 'Approved with Modifications', message: parts.join(' · ') });
    }
    onApprove(details);
  };

  const handleApproveRecommended = () => {
    onApprove({ mode: 'recommended', rate: PAYLOAD.proposedRate });
  };

  const modSummary = showModify ? (() => {
    const parts = [];
    if (modFields.rate !== 4.89) parts.push(`Rate adjusted to ${modFields.rate.toFixed(3)}%`);
    if (modFields.conditions) parts.push(`Condition: ${modFields.conditions}`);
    if (modFields.requestDocs) parts.push('Additional docs: requested');
    return parts;
  })() : [];

  return (
    <div style={{
      padding: 20,
      background: 'var(--bg-surface)',
      borderRadius: 'var(--radius-lg)',
      border: '2px solid var(--hitl-amber)',
      animation: 'slideDown 0.3s ease-out',
    }}>
      {/* Header badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{
          padding: '4px 10px', borderRadius: 12,
          background: 'var(--hitl-amber-dim)', color: 'var(--hitl-amber)',
          fontWeight: 700, fontSize: 11,
        }}>
          ⏸ Human Review Required
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>LangGraph interrupt()</span>
      </div>

      {/* What the agent attempted */}
      <div style={{
        padding: '8px 10px',
        background: 'var(--bg-raised)',
        borderRadius: 'var(--radius-sm)',
        marginBottom: 12,
        fontSize: 11,
        color: 'var(--text-secondary)',
        lineHeight: 1.5,
      }}>
        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Agent attempted: </span>
        Auto-approve 5yr Fixed at 4.89% for Marcus & Sofia Delgado ($875,000). Workflow halted because 3 policy constraints were triggered during underwriting.
      </div>

      {/* Constraint violated */}
      <div style={{
        padding: '8px 10px',
        background: 'var(--danger-dim)',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--danger)',
        marginBottom: 12,
      }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
          Constraints Triggered
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <div>• <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9 }}>§4.2.1</span> — 3 hard inquiries in 180 days</div>
          <div>• <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9 }}>§3.1.4</span> — Property value exceeding $500K threshold</div>
          <div>• <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9 }}>§3.2.1</span> — GDS at 31.2% with recent credit activity</div>
        </div>
      </div>

      {/* Agent recommendation */}
      <div style={{
        padding: '10px 12px',
        background: 'var(--mongo-dim)',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--mongo)',
        marginBottom: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--mongo)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Agent Recommendation
          </div>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
            padding: '2px 6px', borderRadius: 4,
            background: extraContext ? 'var(--success-dim)' : 'var(--hitl-amber-dim)',
            color: extraContext ? 'var(--success)' : 'var(--hitl-amber)',
          }}>
            {extraContext ? '85% confidence' : '78% confidence'}
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 600 }}>
          Approve with conditions: rate +25bps (5.14%), require 6-month reserve verification
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 3 }}>
          Strong employment history and savings offset inquiry risk. Conditions mitigate remaining exposure.
        </div>
      </div>

      {/* Key metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 2 }}>Risk Score</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 800, color: 'var(--hitl-amber)' }}>
            {PAYLOAD.riskScore} <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>/ 100</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 2 }}>Loan Amount</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700 }}>{PAYLOAD.loanAmount}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 2 }}>Rate</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: 'var(--mongo)' }}>{PAYLOAD.proposedRate}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12, padding: 10, background: 'var(--bg-raised)', borderRadius: 'var(--radius-md)' }}>
        {[
          { label: 'Applicant', value: PAYLOAD.applicant },
          { label: 'Product', value: PAYLOAD.product },
          { label: 'GDS', value: PAYLOAD.dti },
          { label: 'LTV', value: `${PAYLOAD.ltv}%` },
        ].map((item) => (
          <div key={item.label}>
            <div style={{ fontSize: 8, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 1 }}>{item.label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600 }}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* Additional context (if fetched) */}
      {extraContext && (
        <div style={{
          padding: '10px 12px',
          background: 'var(--bg-raised)',
          borderRadius: 'var(--radius-sm)',
          marginBottom: 12,
          animation: 'slideDown 0.3s ease-out',
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
            Additional Context Retrieved
          </div>
          {extraContext.map((ctx) => (
            <div key={ctx.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 12 }}>{ctx.icon}</span>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-primary)' }}>{ctx.label}</div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{ctx.value}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Expandable provenance panel */}
      <button
        type="button"
        onClick={() => setShowProvenance(!showProvenance)}
        style={{
          width: '100%',
          padding: '6px 10px',
          marginBottom: showProvenance ? 0 : 12,
          background: 'var(--bg-raised)',
          border: '1px solid var(--border-dim)',
          borderRadius: showProvenance ? 'var(--radius-sm) var(--radius-sm) 0 0' : 'var(--radius-sm)',
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
        }}>▾</span>
      </button>
      {showProvenance && (
        <div style={{
          padding: '10px 12px',
          background: 'var(--bg-raised)',
          border: '1px solid var(--border-dim)',
          borderTop: 'none',
          borderRadius: '0 0 var(--radius-sm) var(--radius-sm)',
          marginBottom: 12,
        }}>
          {PROVENANCE_RECORDS.map((rec, i) => (
            <div key={i} style={{ marginBottom: i < PROVENANCE_RECORDS.length - 1 ? 10 : 0 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                {rec.source}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 2 }}>
                Finding: {rec.finding}
              </div>
              <div style={{
                fontSize: 9,
                fontFamily: 'var(--font-mono)',
                color: 'var(--hitl-amber)',
                padding: '3px 6px',
                background: 'var(--hitl-amber-dim)',
                borderRadius: 3,
                display: 'inline-block',
              }}>
                {rec.policy}: &ldquo;{rec.rule}&rdquo;
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Inline modification form */}
      {showModify && (
        <div style={{
          padding: '12px',
          background: 'var(--bg-raised)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-base)',
          marginBottom: 12,
          animation: 'slideDown 0.3s ease-out',
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
            Modify Terms
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <label style={{ fontSize: 10, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Rate (%):</label>
            <input
              type="range"
              min={6.0}
              max={8.5}
              step={0.125}
              value={modFields.rate}
              onChange={(e) => setModFields((p) => ({ ...p, rate: +e.target.value }))}
              style={{ flex: 1, accentColor: 'var(--mongo)' }}
            />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--mongo)', minWidth: 45 }}>
              {modFields.rate.toFixed(3)}%
            </span>
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 10, color: 'var(--text-secondary)', display: 'block', marginBottom: 3 }}>Additional Conditions:</label>
            <input
              type="text"
              placeholder="e.g., Require 6-month reserve verification"
              value={modFields.conditions}
              onChange={(e) => setModFields((p) => ({ ...p, conditions: e.target.value }))}
              style={{
                width: '100%',
                padding: '5px 8px',
                fontSize: 10,
                fontFamily: 'var(--font-body)',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-dim)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                outline: 'none',
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

          {/* Modified terms summary */}
          {modSummary.length > 0 && (
            <div style={{
              marginTop: 8, padding: '6px 8px',
              background: 'var(--agent-cyan-dim)', borderRadius: 'var(--radius-sm)',
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
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {showModify ? (
          <button type="button" onClick={handleModifySubmit} style={{
            flex: '1 1 auto', padding: 10, borderRadius: 'var(--radius-md)', border: 'none',
            background: 'var(--agent-cyan)', color: '#fff', fontFamily: 'var(--font-display)',
            fontWeight: 700, fontSize: 11, cursor: 'pointer',
          }}>
            ✓ Submit Modified Terms
          </button>
        ) : (
          <button type="button" onClick={handleApproveRecommended} style={{
            flex: '1 1 auto', padding: 10, borderRadius: 'var(--radius-md)', border: 'none',
            background: 'var(--mongo)', color: '#fff', fontFamily: 'var(--font-display)',
            fontWeight: 700, fontSize: 11, cursor: 'pointer',
          }}>
            ✓ Approve as Recommended
          </button>
        )}
        <button type="button" onClick={() => setShowModify(!showModify)} style={{
          flex: '1 1 auto', padding: 10, borderRadius: 'var(--radius-md)',
          border: `1px solid ${showModify ? 'var(--agent-cyan)' : 'var(--border-base)'}`,
          background: showModify ? 'var(--agent-cyan-dim)' : 'var(--bg-raised)',
          color: showModify ? 'var(--agent-cyan)' : 'var(--text-primary)',
          fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 11, cursor: 'pointer',
        }}>
          {showModify ? '← Back' : '✎ Modify & Approve'}
        </button>
        <button type="button" onClick={handleRequestContext} disabled={fetchingContext || !!extraContext} style={{
          flex: '1 1 auto', padding: 10, borderRadius: 'var(--radius-md)',
          border: '1px solid var(--tool-blue)',
          background: fetchingContext ? 'var(--tool-blue-dim)' : 'transparent',
          color: extraContext ? 'var(--text-dim)' : 'var(--tool-blue)',
          fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 11,
          cursor: fetchingContext || extraContext ? 'default' : 'pointer',
          opacity: extraContext ? 0.5 : 1,
        }}>
          {fetchingContext ? '⏳ Fetching...' : extraContext ? '✓ Context Loaded' : '🔎 Request More Context'}
        </button>
        <button type="button" style={{
          flex: '1 1 auto', padding: 10, borderRadius: 'var(--radius-md)',
          border: '1px solid var(--danger)', background: 'transparent',
          color: 'var(--danger)', fontFamily: 'var(--font-display)',
          fontWeight: 600, fontSize: 11, cursor: 'pointer',
        }}>
          ✕ Decline
        </button>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───

export default function LoanOfficerDashboard() {
  const [selectedApp, setSelectedApp] = useState('APP-2026-00001');
  const [autonomyLevel, setAutonomyLevel] = useState('suggest');
  const [workflowPhase, setWorkflowPhase] = useState('preview');
  const [workflowStage, setWorkflowStage] = useState(0);
  const [hitlReached, setHitlReached] = useState(false);
  const [approved, setApproved] = useState(false);
  const [planSettings, setPlanSettings] = useState(null);
  const [approvalDetails, setApprovalDetails] = useState(null);
  const timerRef = useRef(null);
  const stageTimestampsRef = useRef([]);
  const { toasts, addToast, removeToast } = useToasts();
  const [liveApplications, setLiveApplications] = useState([]);

  const isPrimaryApp = selectedApp === 'APP-2026-00001';
  const showPreview = isPrimaryApp && workflowPhase === 'preview' && (autonomyLevel === 'observe' || autonomyLevel === 'suggest');

  // Real-time application queue via WebSocket + MongoDB Change Stream
  const snapshotReceived = useRef(false);
  useEffect(() => {
    snapshotReceived.current = false;
    const ws = apiWebSocket('/applications/ws', {
      onMessage: (data) => {
        if (data.type === 'snapshot') {
          // Initial load — full list from backend (including empty queue)
          snapshotReceived.current = true;
          setLiveApplications(data.applications ?? []);
        } else if (data.type === 'change' && snapshotReceived.current) {
          // Real-time update — insert or update a single application
          const app = data.application;
          if (app) {
            setLiveApplications((prev) => {
              const idx = prev.findIndex((a) => a.application_id === app.application_id);
              if (idx >= 0) {
                // Update existing
                const next = [...prev];
                next[idx] = app;
                return next;
              }
              // Insert new at top
              return [app, ...prev];
            });
          }
        }
      },
    });

    return () => ws.close();
  }, []);

  // Reactive dashboard stats
  const dashboardStats = useMemo(() => {
    const autoRates = { observe: '32%', suggest: '73%', bounded: '81%', auto: '91%' };
    const avgTimes = { observe: '8.4 min', suggest: '4.2 min', bounded: '3.1 min', auto: '1.8 min' };
    return [
      { label: 'Applications Today', value: '12', color: 'var(--mongo)' },
      { label: 'Avg Processing Time', value: avgTimes[autonomyLevel] || '4.2 min', color: 'var(--agent-cyan)' },
      { label: 'Auto-Decisioning Rate', value: autoRates[autonomyLevel] || '73%', color: 'var(--success)' },
      { label: 'Pending Reviews', value: approved ? '2' : '3', color: 'var(--hitl-amber)' },
    ];
  }, [autonomyLevel, approved]);

  // Reset when selected app or autonomy changes
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    stageTimestampsRef.current = [];

    if (selectedApp !== 'APP-2026-00001') {
      setWorkflowPhase('idle');
      setWorkflowStage(0);
      setHitlReached(false);
      setApproved(false);
      setPlanSettings(null);
      setApprovalDetails(null);
      return;
    }

    setWorkflowStage(0);
    setHitlReached(false);
    setApproved(false);
    setPlanSettings(null);
    setApprovalDetails(null);

    if (autonomyLevel === 'bounded' || autonomyLevel === 'auto') {
      setWorkflowPhase('executing');
    } else {
      setWorkflowPhase('preview');
    }
  }, [selectedApp, autonomyLevel]);

  // Auto-advance through workflow stages when executing (suggest, bounded, auto)
  useEffect(() => {
    if (workflowPhase !== 'executing' || !isPrimaryApp) return;

    stageTimestampsRef.current = [Date.now()];
    let stage = workflowStage;
    const advance = () => {
      stage++;
      stageTimestampsRef.current.push(Date.now());
      if (stage >= WORKFLOW_STAGES.length) {
        setHitlReached(true);
        if (autonomyLevel === 'auto') {
          addToast({ type: 'info', icon: '🚀', title: 'Full Auto', message: 'Agent auto-approved application per Full Auto policy.' });
          setTimeout(() => {
            setApproved(true);
            setApprovalDetails({ mode: 'auto', rate: PAYLOAD.proposedRate });
          }, 1500);
        } else {
          addToast({ type: 'warning', icon: '✋', title: 'HITL Review Required', message: 'Agent workflow paused. APP-2026-00001 awaiting your decision.' });
        }
        return;
      }
      setWorkflowStage(stage);
      addToast({ type: 'info', icon: '⚙️', title: `Stage: ${WORKFLOW_STAGES[stage].label}`, message: `Processing ${WORKFLOW_STAGES[stage].label.toLowerCase()} for Marcus & Sofia Delgado.` });
      timerRef.current = setTimeout(advance, 4000);
    };

    addToast({ type: 'info', icon: '▶', title: 'Workflow Started', message: `Processing ${WORKFLOW_STAGES[0].label.toLowerCase()} for Marcus & Sofia Delgado.` });
    timerRef.current = setTimeout(advance, 4000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [workflowPhase]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleProceed = useCallback((settings) => {
    setPlanSettings(settings || null);
    if (autonomyLevel === 'observe') {
      setWorkflowPhase('observe-step');
      stageTimestampsRef.current = [Date.now()];
      addToast({ type: 'info', icon: '👁', title: 'Observe Mode', message: `Processing ${WORKFLOW_STAGES[0].label.toLowerCase()}. Waiting for your confirmation to advance.` });
    } else {
      setWorkflowPhase('executing');
    }
  }, [autonomyLevel, addToast]);

  const handleObserveAdvance = useCallback(() => {
    const nextStage = workflowStage + 1;
    stageTimestampsRef.current.push(Date.now());
    if (nextStage >= WORKFLOW_STAGES.length) {
      setHitlReached(true);
      addToast({ type: 'warning', icon: '✋', title: 'HITL Review Required', message: 'All stages complete. APP-2026-00001 awaiting your decision.' });
      return;
    }
    setWorkflowStage(nextStage);
    addToast({ type: 'info', icon: '👁', title: `Stage: ${WORKFLOW_STAGES[nextStage].label}`, message: `Processing ${WORKFLOW_STAGES[nextStage].label.toLowerCase()}. Confirm to advance.` });
  }, [workflowStage, addToast]);

  const handleManual = useCallback(() => {
    setWorkflowPhase('manual');
    addToast({ type: 'info', icon: '👤', title: 'Manual Mode', message: 'Agent bypassed. You are handling this application directly.' });
  }, [addToast]);

  const handleApprove = useCallback(async (details) => {
    setApproved(true);
    setApprovalDetails(details || { mode: 'recommended', rate: PAYLOAD.proposedRate });
    const rate = details?.rate || PAYLOAD.proposedRate;
    const suffix = details?.conditions ? ` · Conditions: ${details.conditions}` : '';
    addToast({ type: 'success', icon: '✅', title: 'Loan Approved', message: `${PAYLOAD.product} @ ${rate} for ${PAYLOAD.applicant}.${suffix}` });

    // Also submit to backend if we have a matching live application
    const liveApp = liveApplications.find((a) => a.application_id === selectedApp);
    const appId = liveApp?.application_id || selectedApp;
    if (appId) {
      await apiPost(`/hitl/${appId}/decision`, {
        action: 'approve',
        officer_notes: details?.conditions || 'Approved after manual review',
      });
    }
  }, [addToast, selectedApp, liveApplications]);

  const handleRollback = useCallback(() => {
    setApproved(false);
    setApprovalDetails(null);
    addToast({ type: 'warning', icon: '↩', title: 'Rollback', message: 'Autonomous approval reverted. Application routed to officer review.' });
  }, [addToast]);

  const handleAcceptAudit = useCallback(() => {
    addToast({ type: 'success', icon: '✓', title: 'Audit Accepted', message: 'Autonomous decision confirmed. Workflow closed.' });
  }, [addToast]);

  const handleAgentEvent = useCallback(() => {}, []);

  const currentWorkflow = WORKFLOW_STAGES[workflowStage] || WORKFLOW_STAGES[WORKFLOW_STAGES.length - 1];
  const selectedAppData = liveApplications.find((a) => a.application_id === selectedApp);

  const isScenarioApp = false;

  const statusBadge = () => {
    if (!isPrimaryApp) return null;
    if (approved) return { label: '✓ Approved', bg: 'var(--success-dim)', color: 'var(--success)' };
    if (hitlReached) return { label: '⏸ Awaiting Review', bg: 'var(--hitl-amber-dim)', color: 'var(--hitl-amber)' };
    if (workflowPhase === 'preview') return { label: '📋 Plan Ready', bg: 'var(--agent-cyan-dim)', color: 'var(--agent-cyan)' };
    if (workflowPhase === 'manual') return { label: '👤 Manual Mode', bg: 'var(--bg-raised)', color: 'var(--text-secondary)' };
    if (workflowPhase === 'observe-step') return { label: `👁 Observe: ${currentWorkflow.label}`, bg: 'var(--agent-cyan-dim)', color: 'var(--agent-cyan)' };
    return { label: `Processing: ${currentWorkflow.label}`, bg: 'var(--agent-cyan-dim)', color: 'var(--agent-cyan)' };
  };

  const badge = statusBadge();

  const nextStageName = workflowStage + 1 < WORKFLOW_STAGES.length
    ? WORKFLOW_STAGES[workflowStage + 1].label
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 52px)', background: 'var(--bg-void)' }}>
      <BeforeAfterStat before="$8,500/loan" after="$2,100/loan" />

      {/* Stats bar + Autonomy Dial */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 12,
        padding: '12px 20px',
        borderBottom: '1px solid var(--border-dim)',
        background: 'var(--bg-base)',
      }}>
        {dashboardStats.map((s) => (
          <div key={s.label} style={{ padding: '8px 12px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-dim)' }}>
            <div style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 800, color: s.color, transition: 'all 0.5s ease' }}>{s.value}</div>
          </div>
        ))}
        <AutonomyDial value={autonomyLevel} onChange={setAutonomyLevel} />
      </div>

      {/* Main content */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <ApplicationQueue selectedId={selectedApp} onSelect={setSelectedApp} applications={liveApplications} />

        {/* Center: Workflow Monitor */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
          {/* App header */}
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-dim)', background: 'var(--bg-base)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>
                {selectedAppData?.name || 'Select an application'}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)' }}>
                {selectedApp}
              </span>
              {isPrimaryApp && <ModifiedParamsBadge settings={planSettings} />}
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
          {showPreview && (
            <div style={{ padding: 16, borderBottom: '1px solid var(--border-dim)', background: 'var(--bg-base)', overflowY: 'auto', maxHeight: '50vh' }}>
              <IntentPreview onProceed={handleProceed} onManual={handleManual} />
            </div>
          )}

          {/* Workflow Canvas + overlays */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            {/* Primary app: executing or observe-step with canvas */}
            {isPrimaryApp && (workflowPhase === 'executing' || workflowPhase === 'observe-step' || workflowPhase === 'preview') ? (
              <>
                <WorkflowCanvas
                  activeNodes={workflowPhase === 'preview' ? [] : currentWorkflow.activeNodes}
                  activeEdges={workflowPhase === 'preview' ? [] : currentWorkflow.activeEdges}
                  pulsingNodes={workflowPhase === 'preview' ? [] : hitlReached ? ['hitlGate'] : currentWorkflow.pulsingNodes}
                  currentScene={workflowPhase === 'preview' ? 'origination' : currentWorkflow.currentScene}
                />

                {/* Observe mode confirmation bar */}
                {workflowPhase === 'observe-step' && !hitlReached && (
                  <ObserveConfirmBar
                    currentStage={workflowStage}
                    nextLabel={nextStageName}
                    onContinue={handleObserveAdvance}
                    onTakeOver={handleManual}
                  />
                )}

                {/* Bounded mode policy bounds indicator */}
                {autonomyLevel === 'bounded' && workflowPhase === 'executing' && (
                  <PolicyBoundsIndicator exceeded={hitlReached} />
                )}

                {/* Bottom info bar */}
                <div style={{
                  position: 'absolute', bottom: 12, left: 12, right: 12,
                  padding: '10px 14px',
                  background: 'var(--bg-overlay-alpha)',
                  backdropFilter: 'blur(8px)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-dim)',
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)', marginRight: 6 }}>
                    {workflowPhase === 'preview'
                      ? '📋 Execution Plan'
                      : workflowPhase === 'observe-step'
                        ? hitlReached ? '✋ HITL Gate' : `👁 Observe: ${currentWorkflow.label}`
                        : hitlReached
                          ? '✋ HITL Gate'
                          : `Stage: ${currentWorkflow.label}`
                    }
                  </span>
                  {workflowPhase === 'preview'
                    ? 'Agent has generated an execution plan. Review and approve above to begin processing.'
                    : workflowPhase === 'observe-step' && !hitlReached
                      ? 'Observe mode — agent processes each stage but waits for your confirmation before advancing.'
                      : hitlReached && !approved
                        ? 'Agent workflow paused. All state persisted to MongoDB via MongoDBSaver. Awaiting officer decision.'
                        : approved
                          ? 'Loan approved. Workflow resuming — funding engine activated.'
                          : `Agents are processing this application through the ${currentWorkflow.label.toLowerCase()} stage.`
                  }
                </div>
              </>
            ) : isPrimaryApp && workflowPhase === 'manual' ? (
              <ManualWorkspace onApprove={handleApprove} addToast={addToast} />
            ) : selectedApp === 'APP-2025-78215' ? (
              <ElenaAuditView />
            ) : selectedApp === 'APP-2025-78091' ? (
              <JamesDeclineView />
            ) : selectedApp === 'APP-2025-78143' ? (
              <PriyaProgressView />
            ) : !isPrimaryApp ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)', fontSize: 13 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>
                    {selectedAppData?.name} — {selectedAppData?.statusLabel}
                  </div>
                  <div style={{ fontSize: 11, marginTop: 4 }}>
                    {selectedAppData?.amount} · {selectedAppData?.product}
                    {selectedAppData?.score && ` · Score: ${selectedAppData.score} (${selectedAppData.tier})`}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* HITL Review panel */}
          {isPrimaryApp && hitlReached && !approved && autonomyLevel !== 'auto' && (
            <div style={{ padding: 16, borderTop: '1px solid var(--border-dim)', background: 'var(--bg-base)', overflowY: 'auto', maxHeight: '55vh' }}>
              <HITLReviewCard onApprove={handleApprove} addToast={addToast} />
            </div>
          )}

          {/* Approved card — standard (non-auto) */}
          {isPrimaryApp && approved && approvalDetails?.mode !== 'auto' && (
            <div style={{ padding: 16, borderTop: '1px solid var(--border-dim)', background: 'var(--bg-base)', textAlign: 'center' }}>
              <div style={{ padding: 14, background: 'var(--success-dim)', borderRadius: 'var(--radius-md)', border: '1px solid var(--success)' }}>
                <div style={{ fontSize: 24, marginBottom: 4 }}>✅</div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: 'var(--success)' }}>LOAN APPROVED</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {PAYLOAD.product} @ {approvalDetails?.rate || PAYLOAD.proposedRate} · {PAYLOAD.monthlyPayment}/mo · Workflow resumed from checkpoint
                  {approvalDetails?.conditions && (
                    <><br/>Conditions: {approvalDetails.conditions}</>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Full Auto audit summary */}
          {isPrimaryApp && approved && approvalDetails?.mode === 'auto' && (
            <div style={{ padding: 16, borderTop: '1px solid var(--border-dim)', background: 'var(--bg-base)', overflowY: 'auto', maxHeight: '55vh' }}>
              <AutoAuditSummary
                stageTimestamps={stageTimestampsRef.current}
                approvalDetails={approvalDetails}
                onRollback={handleRollback}
                onAccept={handleAcceptAudit}
              />
            </div>
          )}
        </div>

        <AgentActivityLog
          autoPlay={!liveApplications.find((a) => a.application_id === selectedApp) && isPrimaryApp && (workflowPhase === 'executing' || workflowPhase === 'observe-step')}
          onEvent={handleAgentEvent}
          applicationId={liveApplications.find((a) => a.application_id === selectedApp)?.application_id || null}
        />
      </div>

      <NotificationToast toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
