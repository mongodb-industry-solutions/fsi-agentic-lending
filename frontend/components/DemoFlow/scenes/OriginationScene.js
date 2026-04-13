"use client";
import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import Badge from '@leafygreen-ui/badge';
import ExpandableCard from '@leafygreen-ui/expandable-card';
import Icon from '@leafygreen-ui/icon';
import { spacing } from '@leafygreen-ui/tokens';
import { ORIGINATION_STEPS } from '../engine/demoScenes';
import { mergeCanvasState } from '../engine/canvasUtils';
import WorkflowCanvas from '../WorkflowCanvas';
import AnnotationOverlay from '../AnnotationOverlay';
import ApplicantCard from '../panels/ApplicantCard';
import PipelineDrawer from '../PipelineDrawer';
import StatCard from '../../visualizations/StatCard';
import { uiTokens } from '../../../lib/uiTokens';

const DOCUMENTS = [
  {
    type: 'CRA Notice',
    label: 'CRA Notice of Assessment',
    glyph: 'File',
    avgConfidence: 99.2,
    fields: [
      { field: 'Taxpayer Name', value: 'Marcus A. Delgado', confidence: 99.8 },
      { field: 'Total Income', value: '$128,500.00', confidence: 99.7 },
      { field: 'Employer Name', value: 'TechNova Systems Inc.', confidence: 98.4 },
      { field: 'Tax Year', value: '2025', confidence: 99.9 },
      { field: 'Province', value: 'Alberta', confidence: 98.7 },
    ],
  },
  {
    type: 'Bank Statement',
    label: 'Bank Statement',
    glyph: 'Building',
    avgConfidence: 98.5,
    fields: [
      { field: 'Account Holder', value: 'Marcus A. Delgado', confidence: 99.6 },
      { field: 'Avg Monthly Balance', value: '$48,230.00', confidence: 97.8 },
      { field: 'Monthly Deposits', value: '$18,558.00', confidence: 98.1 },
      { field: 'Monthly Expenses', value: '$12,420.00', confidence: 97.5 },
      { field: 'Recurring Income', value: '$9,279.00 (bi-weekly)', confidence: 96.8 },
    ],
  },
  {
    type: 'Pay Stub',
    label: 'Pay Stub',
    glyph: 'CreditCard',
    avgConfidence: 99.0,
    fields: [
      { field: 'Employer', value: 'TechNova Systems Inc.', confidence: 98.8 },
      { field: 'Gross Pay', value: '$5,354.17', confidence: 99.3 },
      { field: 'Net Pay', value: '$3,892.40', confidence: 99.0 },
      { field: 'Pay Period', value: 'Mar 1–15, 2026', confidence: 99.1 },
      { field: 'YTD Earnings', value: '$16,062.51', confidence: 98.7 },
    ],
  },
];

const OPEN_BANKING_DATA = {
  provider: 'Plaid',
  connected: true,
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
    <div style={{ display: 'flex', gap: spacing[100], marginBottom: spacing[200] }}>
      {DOCUMENTS.map((doc, i) => {
        const available = i === 0 || sceneStep >= 3;
        const isActive = activeDoc === i;
        return (
          <button
            key={doc.type}
            type="button"
            onClick={() => available && onSelect(i)}
            onFocus={(e) => { e.currentTarget.style.boxShadow = uiTokens.focusRing; }}
            onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
            style={{
              flex: 1,
              padding: `${spacing[150]}px ${spacing[200]}px`,
              borderRadius: 8,
              border: isActive ? '2px solid var(--mongo)' : '1px solid var(--border-dim)',
              background: isActive ? 'var(--mongo-dim)' : available ? 'var(--bg-surface)' : 'var(--bg-raised)',
              cursor: available ? 'pointer' : 'default',
              opacity: available ? 1 : 0.4,
              fontSize: 11,
              fontWeight: 600,
              color: isActive ? 'var(--mongo)' : 'var(--text-secondary)',
              textAlign: 'center',
              transition: '150ms cubic-bezier(0.33, 1, 0.68, 1)',
              outline: 'none',
            }}
          >
            <span style={{ display: 'block', marginBottom: spacing[50] }}><Icon glyph={doc.glyph} size={14} /></span>
            {doc.type}
            {available && <Badge variant="green" style={{ marginTop: spacing[1], display: 'block' }}>{doc.avgConfidence}%</Badge>}
          </button>
        );
      })}
    </div>
  );
}

const OB_HEADLINE_KEYS = ['avgMonthlyIncome', 'monthlySurplus', 'cashFlowRatio'];

function OpenBankingCard() {
  return (
    <div style={{ padding: spacing[300], background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--agent-cyan)', marginTop: spacing[300], animation: 'slideDown 220ms cubic-bezier(0.33, 1, 0.68, 1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[200] }}>
        <div style={{ fontFamily: uiTokens.font, fontWeight: 700, fontSize: 12, color: 'var(--agent-cyan)' }}>
          Open Banking Data
        </div>
        <Badge variant="blue">Plaid Connected</Badge>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing[150] }}>
        {OB_HEADLINE_KEYS.map((key) => (
          <div key={key} style={{ padding: `${spacing[100]}px ${spacing[150]}px`, background: 'var(--bg-raised)', borderRadius: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 1 }}>
              {key.replace(/([A-Z])/g, ' $1').trim()}
            </div>
            <div style={{ fontFamily: uiTokens.monoFont, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{OPEN_BANKING_DATA.summary[key]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OriginationScene({ sceneStep, currentStepData }) {
  const showExtraction = sceneStep >= 3;
  const showOpenBanking = sceneStep >= 4;
  const showProfile = sceneStep >= 5;
  const [activeDocIdx, setActiveDocIdx] = useState(0);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [timelineHighlight, setTimelineHighlight] = useState(null);

  const handleNodeHover = useCallback((nodeId) => setHoveredNode(nodeId), []);
  const handleTimelineHover = useCallback((nodeId) => setTimelineHighlight(nodeId), []);

  const activeDoc = DOCUMENTS[activeDocIdx];
  const visibleFieldCount = useProgressiveReveal(activeDoc.fields.length, showExtraction, 120);

  const canvasState = useMemo(
    () => mergeCanvasState(ORIGINATION_STEPS, sceneStep),
    [sceneStep],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden', display: 'grid', gridTemplateColumns: '1fr' }}>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ position: 'relative', flex: '1.4 1 0%', minHeight: 240, overflow: 'hidden' }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing[200], marginBottom: spacing[300] }}>
              <StatCard label="Documents" value={sceneStep >= 2 ? 4 : sceneStep >= 0 ? 2 : 0} color="var(--agent-cyan)" />
              <StatCard label="Fields Extracted" value={sceneStep >= 3 ? 47 : sceneStep >= 1 ? 12 : 0} color="var(--mongo)" />
              <StatCard label="Validations" value={sceneStep >= 4 ? 23 : sceneStep >= 2 ? 8 : 0} color="var(--success)" />
            </div>
            <ApplicantCard stepIndex={sceneStep} />

            {showExtraction && (
              <>
                <div style={{ marginTop: spacing[300], marginBottom: spacing[200], fontFamily: uiTokens.font, fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', gap: spacing[150] }}>
                  Multi-Document Processing
                  <span style={{ fontSize: 9, padding: `${spacing[50]}px ${spacing[150]}px`, borderRadius: 8, background: 'var(--agent-cyan-dim)', color: 'var(--agent-cyan)', fontWeight: 600 }}>voyage-multimodal-3.5</span>
                </div>

                <DocumentTabSwitcher activeDoc={activeDocIdx} onSelect={setActiveDocIdx} sceneStep={sceneStep} />

                <div style={{ background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border-dim)', overflow: 'hidden' }}>
                  {activeDoc.fields.slice(0, visibleFieldCount).map((f, i) => (
                    <div
                      key={f.field}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '130px 1fr',
                        gap: spacing[150],
                        padding: `${spacing[150]}px ${spacing[200]}px`,
                        borderBottom: i < Math.min(visibleFieldCount, activeDoc.fields.length) - 1 ? '1px solid var(--border-dim)' : 'none',
                        fontSize: 11,
                        alignItems: 'center',
                        animation: 'slideDown 220ms cubic-bezier(0.33, 1, 0.68, 1)',
                      }}
                    >
                      <span style={{ color: 'var(--text-dim)', fontWeight: 600 }}>{f.field}</span>
                      <span style={{ fontFamily: uiTokens.monoFont, color: 'var(--text-primary)' }}>{f.value}</span>
                    </div>
                  ))}
                  {visibleFieldCount < activeDoc.fields.length && (
                    <div style={{ padding: `${spacing[150]}px ${spacing[200]}px`, fontSize: 11, color: 'var(--text-dim)', textAlign: 'center', animation: 'subtlePulse 1.5s infinite' }}>
                      Extracting {activeDoc.type}... {visibleFieldCount}/{activeDoc.fields.length}
                    </div>
                  )}
                </div>

                {visibleFieldCount >= activeDoc.fields.length && (
                  <div style={{ marginTop: spacing[300] }}>
                    <ExpandableCard title="Cross-Validation (5/5 passed)" defaultOpen={false}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[100] }}>
                        {VALIDATIONS.map((v) => (
                          <div key={v.check} style={{ display: 'flex', alignItems: 'flex-start', gap: spacing[150], padding: `${spacing[150]}px ${spacing[200]}px`, background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border-dim)', fontSize: 11 }}>
                            <span style={{ color: v.pass ? 'var(--success)' : 'var(--danger)', fontSize: 12, flexShrink: 0 }}>{v.pass ? '✓' : '✕'}</span>
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{v.check}</div>
                              <div style={{ color: 'var(--text-dim)', marginTop: 1 }}>{v.detail}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ExpandableCard>
                  </div>
                )}
              </>
            )}

            {showOpenBanking && <OpenBankingCard />}

            {showProfile && (
              <div style={{ marginTop: spacing[300] }}>
                <ExpandableCard title="Applicant Profile Output" defaultOpen={false}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[200], fontSize: 11 }}>
                    <div><div style={{ fontSize: 11, color: 'var(--text-dim)' }}>APPLICANTS</div><div style={{ fontWeight: 600 }}>Marcus & Sofia Delgado</div></div>
                    <div><div style={{ fontSize: 11, color: 'var(--text-dim)' }}>COMBINED INCOME</div><div style={{ fontFamily: uiTokens.monoFont, fontWeight: 600 }}>$222,700</div></div>
                    <div><div style={{ fontSize: 11, color: 'var(--text-dim)' }}>EQUIFAX</div><div style={{ fontFamily: uiTokens.monoFont, fontWeight: 600 }}>784</div></div>
                    <div><div style={{ fontSize: 11, color: 'var(--text-dim)' }}>GDS</div><div style={{ fontFamily: uiTokens.monoFont, fontWeight: 600 }}>0.312</div></div>
                    <div><div style={{ fontSize: 11, color: 'var(--text-dim)' }}>DOCUMENTS</div><div style={{ fontWeight: 600 }}>14 verified</div></div>
                    <div><div style={{ fontSize: 11, color: 'var(--text-dim)' }}>CASH FLOW</div><div style={{ fontFamily: uiTokens.monoFont, fontWeight: 600 }}>1.47x ratio</div></div>
                  </div>
                </ExpandableCard>
              </div>
            )}
          </div>
        </div>

        <PipelineDrawer
          steps={ORIGINATION_STEPS}
          stepIndex={sceneStep}
          onEntryHover={handleTimelineHover}
          highlightNodeId={hoveredNode}
        />
      </div>
    </div>
  );
}
