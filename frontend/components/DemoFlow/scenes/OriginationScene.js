"use client";
import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { ORIGINATION_STEPS } from '../engine/demoScenes';
import { mergeCanvasState } from '../engine/canvasUtils';
import WorkflowCanvas from '../WorkflowCanvas';
import AnnotationOverlay from '../AnnotationOverlay';
import ApplicantCard from '../panels/ApplicantCard';
import DataSourceStrip from '../DataSourceStrip';
import PipelineTimeline from '../PipelineTimeline';
import StatCard from '../../visualizations/StatCard';
import { spacing } from '@leafygreen-ui/tokens';

const DOCUMENTS = [
  {
    type: 'CRA Notice',
    label: 'CRA Notice of Assessment',
    icon: '📄',
    fields: [
      { field: 'Document Type', value: 'CRA Notice of Assessment', confidence: 99.8 },
      { field: 'Tax Year', value: '2025', confidence: 99.9 },
      { field: 'Employer Name', value: 'TechNova Systems Inc.', confidence: 98.4 },
      { field: 'Business Number', value: '82345 6789 RT0001', confidence: 99.2 },
      { field: 'Total Income', value: '$128,500.00', confidence: 99.7 },
      { field: 'Federal Tax Deducted', value: '$25,700.00', confidence: 99.5 },
      { field: 'CPP Contributions', value: '$3,754.45', confidence: 99.3 },
      { field: 'EI Premiums', value: '$1,049.12', confidence: 99.1 },
      { field: 'Taxpayer Name', value: 'Marcus A. Delgado', confidence: 99.8 },
      { field: 'SIN (masked)', value: '***-***-482', confidence: 99.9 },
      { field: 'Province', value: 'Alberta', confidence: 98.7 },
      { field: 'Provincial Tax', value: '$12,850.00', confidence: 99.0 },
    ],
  },
  {
    type: 'Bank Statement',
    label: 'Bank Statement',
    icon: '🏦',
    fields: [
      { field: 'Document Type', value: 'Bank Statement', confidence: 99.4 },
      { field: 'Institution', value: 'TD Canada Trust', confidence: 98.9 },
      { field: 'Account Holder', value: 'Marcus A. Delgado', confidence: 99.6 },
      { field: 'Statement Period', value: 'Mar 2026', confidence: 99.2 },
      { field: 'Avg Monthly Balance', value: '$48,230.00', confidence: 97.8 },
      { field: 'Monthly Deposits', value: '$18,558.00', confidence: 98.1 },
      { field: 'Monthly Expenses', value: '$12,420.00', confidence: 97.5 },
      { field: 'Recurring Income', value: '$9,279.00 (bi-weekly)', confidence: 96.8 },
    ],
  },
  {
    type: 'Pay Stub',
    label: 'Pay Stub',
    icon: '💵',
    fields: [
      { field: 'Document Type', value: 'Pay Stub', confidence: 99.5 },
      { field: 'Pay Period', value: 'Mar 1–15, 2026', confidence: 99.1 },
      { field: 'Employer', value: 'TechNova Systems Inc.', confidence: 98.8 },
      { field: 'Gross Pay', value: '$5,354.17', confidence: 99.3 },
      { field: 'Net Pay', value: '$3,892.40', confidence: 99.0 },
      { field: 'YTD Earnings', value: '$16,062.51', confidence: 98.7 },
      { field: 'Federal Tax', value: '$1,070.83', confidence: 98.4 },
      { field: 'Provincial Tax', value: '$535.42', confidence: 97.9 },
    ],
  },
];

const OPEN_BANKING_DATA = {
  provider: 'Plaid',
  connected: true,
  income: [
    { month: 'Jul', value: 11865 }, { month: 'Aug', value: 11865 }, { month: 'Sep', value: 11865 },
    { month: 'Oct', value: 12340 }, { month: 'Nov', value: 11865 }, { month: 'Dec', value: 14230 },
  ],
  summary: {
    avgMonthlyIncome: '$12,338',
    recurringExpenses: '$8,420',
    monthlySurplus: '$3,918',
    accountBalance: '$34,820',
    incomeStability: '98.2%',
    cashFlowRatio: '1.47x',
  },
};

const VALIDATIONS = [
  { check: 'Name match: application vs CRA', pass: true, detail: 'Marcus Delgado ↔ Marcus A. Delgado' },
  { check: 'Income match: stated vs documented', pass: true, detail: '$128,500 ~ $128,500 (exact match)' },
  { check: 'Employer verified via BN lookup', pass: true, detail: 'BN 82345 6789 → TechNova Systems Inc. ✓' },
  { check: 'Income cross-ref: CRA vs Pay Stub vs Bank', pass: true, detail: 'All 3 sources within 2% variance' },
  { check: 'Policy RAG: GDS within limits', pass: true, detail: 'GDS 0.312 < max 0.39 per guideline' },
];

const STAT_ITEMS = [
  { label: 'Documents Processed', value: '3', color: 'var(--mongo)' },
  { label: 'Fields Extracted', value: '28', color: 'var(--agent-cyan)' },
  { label: 'Validations Passed', value: '5', color: 'var(--success)' },
  { label: 'Checkpoints', value: '1', color: 'var(--hitl-amber)' },
];

function AnimatedCounter({ target, active }) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!active) { setDisplay(0); return; }
    let start = null;
    const num = parseFloat(target);
    const step = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / 1200, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(num * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [active, target]);

  return active ? display : '—';
}

function ConfidenceBadge({ value }) {
  const color = value >= 99 ? 'var(--success)' : value >= 95 ? 'var(--mongo)' : 'var(--hitl-amber)';
  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        fontWeight: 700,
        padding: `${spacing[50]}px ${spacing[150]}px`,
        borderRadius: 4,
        background: value >= 99 ? 'var(--success-dim)' : value >= 95 ? 'var(--mongo-dim)' : 'var(--hitl-amber-dim)',
        color,
      }}
    >
      {value}%
    </span>
  );
}

function useProgressiveReveal(total, active, intervalMs = 150) {
  const [count, setCount] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!active) { setCount(0); return; }
    setCount(0);
    let current = 0;
    timerRef.current = setInterval(() => {
      current++;
      setCount(current);
      if (current >= total) clearInterval(timerRef.current);
    }, intervalMs);
    return () => clearInterval(timerRef.current);
  }, [active, total, intervalMs]);

  return count;
}

function DocumentTabSwitcher({ activeDoc, onSelect, sceneStep }) {
  return (
    <div style={{ display: 'flex', gap: spacing[100], marginBottom: 10 }}>
      {DOCUMENTS.map((doc, i) => {
        const available = i === 0 || sceneStep >= 3;
        const isActive = activeDoc === i;
        return (
          <button
            key={doc.type}
            type="button"
            onClick={() => available && onSelect(i)}
            style={{
              flex: 1,
              padding: `${spacing[150]}px ${spacing[200]}px`,
              borderRadius: 'var(--radius-sm)',
              border: isActive ? '2px solid var(--mongo)' : '1px solid var(--border-dim)',
              background: isActive ? 'var(--mongo-dim)' : available ? 'var(--bg-surface)' : 'var(--bg-raised)',
              cursor: available ? 'pointer' : 'default',
              opacity: available ? 1 : 0.4,
              fontSize: 10,
              fontWeight: 600,
              color: isActive ? 'var(--mongo)' : 'var(--text-secondary)',
              textAlign: 'center',
              transition: 'all 0.2s',
            }}
          >
            <span style={{ fontSize: 13, display: 'block', marginBottom: spacing[50] }}>{doc.icon}</span>
            {doc.type}
          </button>
        );
      })}
    </div>
  );
}

function OpenBankingCard() {
  const maxVal = Math.max(...OPEN_BANKING_DATA.income.map((d) => d.value));
  return (
    <div style={{ padding: spacing[300], background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--agent-cyan)', marginTop: spacing[300], animation: 'slideDown 0.3s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[200] }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, color: 'var(--agent-cyan)' }}>
          Open Banking Data
        </div>
        <span style={{ fontSize: 9, padding: `${spacing[50]}px ${spacing[200]}px`, borderRadius: 4, background: 'var(--agent-cyan-dim)', color: 'var(--agent-cyan)', fontWeight: 600 }}>
          Plaid Connected
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 40, marginBottom: spacing[200] }}>
        {OPEN_BANKING_DATA.income.map((d, i) => {
          const h = (d.value / maxVal) * 36;
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
              <div style={{ width: '100%', height: h, background: 'var(--agent-cyan)', borderRadius: '2px 2px 0 0', opacity: 0.6, minHeight: 3 }} />
              <div style={{ fontSize: 7, color: 'var(--text-dim)', marginTop: spacing[50] }}>{d.month}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing[150] }}>
        {Object.entries(OPEN_BANKING_DATA.summary).map(([key, val]) => (
          <div key={key} style={{ padding: `${spacing[100]}px ${spacing[150]}px`, background: 'var(--bg-raised)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: 8, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 1 }}>
              {key.replace(/([A-Z])/g, ' $1').trim()}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: 'var(--text-primary)' }}>{val}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: spacing[150] }}>
        Aggregation Framework + Atlas Vector Search — cash flow underwriting
      </div>
    </div>
  );
}

function AbandonmentIndicator() {
  return (
    <div style={{ display: 'flex', gap: spacing[200], marginTop: 10, animation: 'slideDown 0.3s ease-out' }}>
      <div style={{ flex: 1, padding: `${spacing[200]}px 10px`, background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--danger)', borderLeftWidth: 3 }}>
        <div style={{ fontSize: 8, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: spacing[50] }}>Traditional</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 800, color: 'var(--danger)' }}>18 min</div>
        <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>68% abandon</div>
      </div>
      <div style={{ flex: 1, padding: `${spacing[200]}px 10px`, background: 'var(--mongo-dim)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--mongo)', borderLeftWidth: 3 }}>
        <div style={{ fontSize: 8, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: spacing[50] }}>Agentic</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 800, color: 'var(--mongo)' }}>2.4 min</div>
        <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>12% abandon</div>
      </div>
    </div>
  );
}

export default function OriginationScene({ sceneStep, currentStepData }) {
  const started = sceneStep >= 0;
  const showExtraction = sceneStep >= 3;
  const showOpenBanking = sceneStep >= 4;
  const showProfile = sceneStep >= 5;
  const [activeDocIdx, setActiveDocIdx] = useState(0);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [timelineHighlight, setTimelineHighlight] = useState(null);

  const handleNodeHover = useCallback((nodeId) => setHoveredNode(nodeId), []);
  const handleTimelineHover = useCallback((nodeId) => setTimelineHighlight(nodeId), []);

  const hasExtraction = sceneStep >= 3;

  useEffect(() => {
    if (!hasExtraction) return;
    if (activeDocIdx === 0) {
      const t1 = setTimeout(() => setActiveDocIdx(1), 600);
      const t2 = setTimeout(() => setActiveDocIdx(2), 1200);
      const t3 = setTimeout(() => setActiveDocIdx(0), 1800);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }
  }, [hasExtraction]);

  const activeDoc = DOCUMENTS[activeDocIdx];
  const visibleFieldCount = useProgressiveReveal(activeDoc.fields.length, showExtraction, 120);

  const canvasState = useMemo(
    () => mergeCanvasState(ORIGINATION_STEPS, sceneStep),
    [sceneStep],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <DataSourceStrip sceneKey="origination" sceneStep={sceneStep} totalSteps={ORIGINATION_STEPS.length} />

      {started && (
        <div
          className="scene-stats-row"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing[300], padding: `${spacing[300]}px ${spacing[400]}px`, borderBottom: '1px solid var(--border-dim)' }}
        >
          {STAT_ITEMS.map((s) => (
            <div key={s.label} style={{ padding: '10px 14px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-dim)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: spacing[100], textTransform: 'uppercase', fontWeight: 600 }}>{s.label}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 800, color: s.color }}>
                <AnimatedCounter target={s.value} active={started} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <WorkflowCanvas
              activeNodes={canvasState.activeNodes}
              activeEdges={canvasState.activeEdges}
              pulsingNodes={canvasState.pulsingNodes}
              completedNodes={canvasState.completedNodes}
              currentScene="origination"
              onNodeHover={handleNodeHover}
              highlightNode={timelineHighlight}
            />
          </div>
          <AnnotationOverlay
            currentStep={currentStepData}
            sceneTitle="Origination"
            stepIndex={sceneStep}
            totalSteps={ORIGINATION_STEPS.length}
          />
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', borderTop: '1px solid var(--border-dim)', padding: spacing[400] }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing[200], marginBottom: spacing[300] }}>
              <StatCard label="Documents" value={sceneStep >= 2 ? 4 : sceneStep >= 0 ? 2 : 0} color="var(--agent-cyan)" />
              <StatCard label="Fields Extracted" value={sceneStep >= 3 ? 47 : sceneStep >= 1 ? 12 : 0} color="var(--mongo)" />
              <StatCard label="Validations" value={sceneStep >= 4 ? 23 : sceneStep >= 2 ? 8 : 0} color="var(--success)" />
              <StatCard label="Processing" value={sceneStep >= 0 ? 'Live' : '—'} color="var(--tool-blue)" animate={false} />
            </div>
            <ApplicantCard stepIndex={sceneStep} />

            {showExtraction && (
              <>
                <div style={{ marginTop: 14, marginBottom: spacing[200], fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', gap: spacing[150] }}>
                  Multi-Document Processing
                  <span style={{ fontSize: 9, padding: `${spacing[50]}px ${spacing[150]}px`, borderRadius: 4, background: 'var(--agent-cyan-dim)', color: 'var(--agent-cyan)', fontWeight: 600 }}>voyage-multimodal-3.5</span>
                </div>

                <DocumentTabSwitcher activeDoc={activeDocIdx} onSelect={setActiveDocIdx} sceneStep={sceneStep} />

                <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-dim)', overflow: 'hidden' }}>
                  {activeDoc.fields.slice(0, visibleFieldCount).map((f, i) => (
                    <div
                      key={f.field}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '130px 1fr auto',
                        gap: spacing[150],
                        padding: `${spacing[150]}px 10px`,
                        borderBottom: i < Math.min(visibleFieldCount, activeDoc.fields.length) - 1 ? '1px solid var(--border-dim)' : 'none',
                        fontSize: 10,
                        alignItems: 'center',
                        animation: 'slideDown 0.2s ease-out',
                      }}
                    >
                      <span style={{ color: 'var(--text-dim)', fontWeight: 600 }}>{f.field}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{f.value}</span>
                      <ConfidenceBadge value={f.confidence} />
                    </div>
                  ))}
                  {visibleFieldCount < activeDoc.fields.length && (
                    <div style={{ padding: `${spacing[150]}px 10px`, fontSize: 10, color: 'var(--text-dim)', textAlign: 'center', animation: 'pulse 1s infinite' }}>
                      Extracting {activeDoc.type}... {visibleFieldCount}/{activeDoc.fields.length}
                    </div>
                  )}
                </div>

                <AbandonmentIndicator />

                {visibleFieldCount >= activeDoc.fields.length && (
                  <>
                    <div style={{ marginTop: 14, marginBottom: spacing[150], fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12 }}>
                      Cross-Validation
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {VALIDATIONS.map((v) => (
                        <div key={v.check} style={{ display: 'flex', alignItems: 'flex-start', gap: spacing[150], padding: `${spacing[150]}px ${spacing[200]}px`, background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-dim)', fontSize: 10 }}>
                          <span style={{ color: v.pass ? 'var(--success)' : 'var(--danger)', fontSize: 12, flexShrink: 0 }}>{v.pass ? '✓' : '✕'}</span>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{v.check}</div>
                            <div style={{ color: 'var(--text-dim)', marginTop: 1 }}>{v.detail}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}

            {showOpenBanking && <OpenBankingCard />}

            {showProfile && (
              <div style={{ marginTop: 14, padding: 14, background: 'var(--mongo-dim)', borderRadius: 'var(--radius-md)', border: '1px solid var(--mongo)' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, color: 'var(--mongo)', marginBottom: spacing[200] }}>Profile Output — Ready for Decisioning</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[200], fontSize: 11 }}>
                  <div><div style={{ fontSize: 9, color: 'var(--text-dim)' }}>APPLICANTS</div><div style={{ fontWeight: 600 }}>Marcus & Sofia Delgado</div></div>
                  <div><div style={{ fontSize: 9, color: 'var(--text-dim)' }}>COMBINED INCOME</div><div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>$222,700</div></div>
                  <div><div style={{ fontSize: 9, color: 'var(--text-dim)' }}>EQUIFAX</div><div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>784</div></div>
                  <div><div style={{ fontSize: 9, color: 'var(--text-dim)' }}>GDS</div><div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>0.312</div></div>
                  <div><div style={{ fontSize: 9, color: 'var(--text-dim)' }}>DOCUMENTS</div><div style={{ fontWeight: 600 }}>14 verified (CRA, Bank, Pay Stubs, IDs)</div></div>
                  <div><div style={{ fontSize: 9, color: 'var(--text-dim)' }}>CASH FLOW</div><div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>1.47x ratio</div></div>
                  <div><div style={{ fontSize: 9, color: 'var(--text-dim)' }}>OPEN BANKING</div><div style={{ fontWeight: 600 }}>Plaid verified</div></div>
                  <div><div style={{ fontSize: 9, color: 'var(--text-dim)' }}>CHECKPOINT</div><div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>cp-1a2b3c</div></div>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: spacing[200], display: 'flex', gap: spacing[150] }}>
                  <span style={{ padding: `${spacing[50]}px ${spacing[150]}px`, background: 'var(--bg-raised)', borderRadius: 3 }}>Embedding stored</span>
                  <span style={{ padding: `${spacing[50]}px ${spacing[150]}px`, background: 'var(--bg-raised)', borderRadius: 3 }}>Checkpoint saved</span>
                  <span style={{ padding: `${spacing[50]}px ${spacing[150]}px`, background: 'var(--bg-raised)', borderRadius: 3 }}>Cash flow indexed</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ borderLeft: '1px solid var(--border-dim)', display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--bg-base)', padding: spacing[400] }}>
          <PipelineTimeline
            steps={ORIGINATION_STEPS}
            stepIndex={sceneStep}
            onEntryHover={handleTimelineHover}
            highlightNodeId={hoveredNode}
          />
        </div>
      </div>
    </div>
  );
}
