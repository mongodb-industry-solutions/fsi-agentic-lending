"use client";

import { useMemo, useState, useEffect, useCallback } from 'react';
import { FUNDING_STEPS } from '../engine/demoScenes';
import { mergeCanvasState } from '../engine/canvasUtils';
import WorkflowCanvas from '../WorkflowCanvas';
import AnnotationOverlay from '../AnnotationOverlay';
import DataSourceStrip from '../DataSourceStrip';
import PipelineTimeline from '../PipelineTimeline';
import { spacing } from '@leafygreen-ui/tokens';

const TIMELINE_EVENTS = [
  { icon: '📡', label: 'Change Stream fires', detail: 'watch() detects status → "approved"', status: 'active', feature: 'Change Streams' },
  { icon: '⚡', label: 'Funding workflow initiated', detail: 'Event-driven automation starts', status: 'active', feature: 'Change Streams' },
  { icon: '💰', label: 'Ledger entry created', detail: '$700,000 disbursed to borrower', status: 'funded', feature: 'Document Model' },
  { icon: '✅', label: 'Loan activated', detail: 'Live financial object in MongoDB', status: 'active', feature: 'Document Model' },
];

const ACCOUNTING = [
  { entry: 'Loan Disbursement', debit: '$700,000.00', credit: '—', balance: '$700,000.00', type: 'debit' },
  { entry: 'Escrow Reserve', debit: '$10,500.00', credit: '—', balance: '$710,500.00', type: 'debit' },
  { entry: 'Origination Fee', debit: '—', credit: '$7,000.00', balance: '$703,500.00', type: 'credit' },
];

const DOC_STAGES = [
  {
    label: 'Origination',
    color: 'var(--agent-cyan)',
    fields: `"applicationId": "APP-2026-00001",
"applicant": {
  "name": "Marcus & Sofia Delgado",
  "combinedIncome": 222700.00,
  "equifax": 784
},
"documents": [{ "type": "CRA_NOA", "verified": true }]`,
  },
  {
    label: 'Decisioning',
    color: 'var(--tool-blue)',
    fields: `"riskScore": 72,
"riskTier": "B+",
"rate": 4.89,
"fraudScan": "CLEAR",
"policyMatch": "5yr_fixed_standard"`,
  },
  {
    label: 'Approval',
    color: 'var(--hitl-amber)',
    fields: `"decision": "APPROVED",
"terms": {
  "type": "5yr Fixed (25yr Amort)",
  "apr": 4.89,
  "monthlyPayment": 4047
},
"disclosures": ["OSFI_B20", "FCAC", "PIPEDA"]`,
  },
  {
    label: 'Funding',
    color: 'var(--mongo)',
    fields: `"disbursement": {
  "amount": 700000.00,
  "date": "2026-03-30",
  "method": "EFT"
},
"balance": {
  "outstanding": 700000.00,
  "escrow": 10500.00
},
"status": "active"`,
  },
];

function SyntaxTokens({ text }) {
  const tokens = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Match key + colon + space (emit key colored, colon+space plain)
    const keyMatch = remaining.match(/^("([^"]+)")(:\s*)/);
    if (keyMatch) {
      tokens.push(<span key={key++} style={{ color: 'var(--agent-cyan)' }}>{keyMatch[1]}</span>);
      tokens.push(<span key={key++}>{keyMatch[3]}</span>);
      remaining = remaining.slice(keyMatch[0].length);
      continue;
    }
    // Match string value (after key was already consumed)
    const strMatch = remaining.match(/^"([^"]*)"/);
    if (strMatch) {
      tokens.push(<span key={key++} style={{ color: 'var(--mongo)' }}>{strMatch[0]}</span>);
      remaining = remaining.slice(strMatch[0].length);
      continue;
    }
    // Match number value
    const numMatch = remaining.match(/^(\d+\.?\d*)/);
    if (numMatch) {
      tokens.push(<span key={key++} style={{ color: 'var(--voyage)' }}>{numMatch[1]}</span>);
      remaining = remaining.slice(numMatch[0].length);
      continue;
    }
    // Match boolean value
    const boolMatch = remaining.match(/^(true|false)/);
    if (boolMatch) {
      tokens.push(<span key={key++} style={{ color: 'var(--hitl-amber)' }}>{boolMatch[1]}</span>);
      remaining = remaining.slice(boolMatch[0].length);
      continue;
    }
    // Default: consume one character
    tokens.push(<span key={key++}>{remaining[0]}</span>);
    remaining = remaining.slice(1);
  }

  return <>{tokens}</>;
}

function StatusBadge({ status }) {
  const colors = {
    approved: { bg: 'var(--hitl-amber-dim)', color: 'var(--hitl-amber)' },
    funded: { bg: 'var(--success-dim)', color: 'var(--success)' },
    active: { bg: 'var(--mongo-dim)', color: 'var(--mongo)' },
  };
  const c = colors[status] || colors.approved;
  return (
    <span style={{ padding: '4px 10px', borderRadius: 12, background: c.bg, color: c.color, fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
      {status}
    </span>
  );
}

export default function FundingScene({ sceneStep, currentStepData }) {
  const started = sceneStep >= 0;
  const [currentStatus, setCurrentStatus] = useState('approved');
  const [hoveredNode, setHoveredNode] = useState(null);
  const [timelineHighlight, setTimelineHighlight] = useState(null);

  const handleNodeHover = useCallback((nodeId) => setHoveredNode(nodeId), []);
  const handleTimelineHover = useCallback((nodeId) => setTimelineHighlight(nodeId), []);

  useEffect(() => {
    if (sceneStep >= 3) setCurrentStatus('active');
    else if (sceneStep >= 2) setCurrentStatus('funded');
    else setCurrentStatus('approved');
  }, [sceneStep]);

  const canvasState = useMemo(
    () => mergeCanvasState(FUNDING_STEPS, sceneStep),
    [sceneStep],
  );

  const visibleDocStages = DOC_STAGES.filter((_, i) => {
    if (i <= 2) return true;
    if (i === 3) return sceneStep >= 2;
    return false;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <DataSourceStrip sceneKey="funding" sceneStep={sceneStep} totalSteps={FUNDING_STEPS.length} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <WorkflowCanvas
              activeNodes={canvasState.activeNodes}
              activeEdges={canvasState.activeEdges}
              pulsingNodes={canvasState.pulsingNodes}
              completedNodes={canvasState.completedNodes}
              currentScene="funding"
              onNodeHover={handleNodeHover}
              highlightNode={timelineHighlight}
            />
          </div>
          <AnnotationOverlay
            currentStep={currentStepData}
            sceneTitle="Funding"
            stepIndex={sceneStep}
            totalSteps={FUNDING_STEPS.length}
          />
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', borderTop: '1px solid var(--border-dim)', padding: spacing[400] }}>
            <div style={{ display: 'flex', gap: spacing[200], marginBottom: 14 }}>
            <div style={{ flex: 1, padding: '8px 10px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--danger)', borderLeftWidth: 3 }}>
              <div style={{ fontSize: 8, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: spacing[50] }}>Traditional</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 800, color: 'var(--danger)' }}>T+3 to T+5</div>
              <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Batch settlement</div>
            </div>
            <div style={{ flex: 1, padding: '8px 10px', background: 'var(--mongo-dim)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--mongo)', borderLeftWidth: 3 }}>
              <div style={{ fontSize: 8, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: spacing[50] }}>Agentic</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 800, color: 'var(--mongo)' }}>Event-driven</div>
              <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Instant settlement</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: spacing[400] }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13 }}>Funding Timeline</div>
            <StatusBadge status={currentStatus} />
          </div>

          <div style={{ position: 'relative', paddingLeft: spacing[500], marginBottom: spacing[500] }}>
            <div style={{ position: 'absolute', left: 8, top: 0, bottom: 0, width: 2, background: 'var(--border-dim)' }} />
            {TIMELINE_EVENTS.map((event, i) => {
              const reached = sceneStep >= i;
              return (
                <div key={i} style={{ position: 'relative', paddingLeft: spacing[500], paddingBottom: spacing[400], opacity: reached ? 1 : 0.4, transition: 'opacity 0.4s' }}>
                  <div style={{ position: 'absolute', left: 0, top: 4, width: 16, height: 16, borderRadius: '50%', background: reached ? 'var(--bg-surface)' : 'var(--bg-raised)', border: `2px solid ${reached ? 'var(--mongo)' : 'var(--border-dim)'}`, zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8 }}>
                    {reached ? '✓' : ''}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 12, marginBottom: spacing[50] }}>{event.icon} {event.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{event.detail}</div>
                  <span style={{ fontSize: 9, color: 'var(--agent-cyan)', padding: '1px 6px', background: 'var(--bg-raised)', borderRadius: 3, marginTop: spacing[100], display: 'inline-block' }}>{event.feature}</span>
                </div>
              );
            })}
          </div>

          {sceneStep >= 1 && (
            <>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, marginBottom: spacing[200] }}>Accounting Entries</div>
              <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-dim)', overflow: 'hidden', marginBottom: spacing[400] }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', padding: '8px 10px', borderBottom: '1px solid var(--border-dim)', textTransform: 'uppercase' }}>
                  <span>Entry</span><span>Debit</span><span>Credit</span><span>Balance</span>
                </div>
                {ACCOUNTING.map((row) => (
                  <div key={row.entry} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', fontSize: 11, padding: '8px 10px', borderBottom: '1px solid var(--border-dim)', fontFamily: 'var(--font-mono)' }}>
                    <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500 }}>{row.entry}</span>
                    <span style={{ color: row.type === 'debit' ? 'var(--danger)' : 'var(--text-dim)' }}>{row.debit}</span>
                    <span style={{ color: row.type === 'credit' ? 'var(--success)' : 'var(--text-dim)' }}>{row.credit}</span>
                    <span style={{ fontWeight: 600 }}>{row.balance}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {sceneStep >= 1 && (
            <div style={{ padding: 10, background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-dim)', marginBottom: 14, animation: 'slideDown 0.3s ease-out' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11, marginBottom: spacing[150] }}>Funding Rails</div>
              <div style={{ display: 'flex', gap: spacing[150] }}>
                {[
                  { label: 'EFT (Payments Canada)', active: true },
                  { label: 'Wire', active: false },
                  { label: 'Real-Time Payments (RTP)', active: false },
                ].map((r) => (
                  <span key={r.label} style={{
                    fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 10,
                    background: r.active ? 'var(--mongo-dim)' : 'var(--bg-raised)',
                    color: r.active ? 'var(--mongo)' : 'var(--text-dim)',
                    border: r.active ? '1px solid var(--mongo)' : '1px solid var(--border-dim)',
                  }}>
                    {r.active && '✓ '}{r.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, marginBottom: spacing[100] }}>MongoDB Document Evolution</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: spacing[300], lineHeight: 1.6 }}>
            One document grows through each lifecycle stage. No ETL — just <strong style={{ color: 'var(--mongo)' }}>MongoDB&apos;s flexible document model</strong>.
          </div>

          {visibleDocStages.map((stage, i) => (
            <div key={stage.label} style={{ marginBottom: 10, animation: i === visibleDocStages.length - 1 && sceneStep >= 2 ? 'sceneEnter 0.4s ease-out' : undefined }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing[200], marginBottom: spacing[100] }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: stage.color }} />
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11, color: stage.color }}>{stage.label}</span>
                {i < visibleDocStages.length - 1 && (
                  <span style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>✓</span>
                )}
              </div>
              <pre
                style={{
                  padding: spacing[200],
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${i === visibleDocStages.length - 1 ? stage.color + '44' : 'var(--border-dim)'}`,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  lineHeight: 1.5,
                  overflowX: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  opacity: i === visibleDocStages.length - 1 ? 1 : 0.7,
                }}
              >
                <SyntaxTokens text={stage.fields} />
              </pre>
            </div>
          ))}

          {sceneStep >= 3 && (
            <div style={{ marginTop: spacing[300], padding: 14, background: 'var(--mongo-dim)', borderRadius: 'var(--radius-md)', border: '1px solid var(--mongo)', textAlign: 'center' }}>
              <div style={{ fontSize: 20, marginBottom: spacing[150] }}>🍃</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: 'var(--mongo)', marginBottom: spacing[100] }}>One Document. One Platform.</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: spacing[200] }}>
                Application → Risk → Decision → Disbursement — all in a single MongoDB document. Zero data shipping.
              </div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--mongo)', fontWeight: 600 }}>
                Zero schema migrations. The loan document grew from 12 fields (origination) to 47 fields (funded) — all in one collection.
              </div>
            </div>
          )}
          </div>
        </div>

        <div style={{ borderLeft: '1px solid var(--border-dim)', display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--bg-base)', padding: spacing[400] }}>
          <PipelineTimeline
            steps={FUNDING_STEPS}
            stepIndex={sceneStep}
            onEntryHover={handleTimelineHover}
            highlightNodeId={hoveredNode}
          />
        </div>
      </div>
    </div>
  );
}
