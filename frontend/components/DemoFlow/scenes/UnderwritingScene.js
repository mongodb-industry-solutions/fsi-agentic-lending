"use client";

import { useMemo, useState, useCallback, useEffect } from 'react';
import Badge from '@leafygreen-ui/badge';
import ExpandableCard from '@leafygreen-ui/expandable-card';
import { UNDERWRITING_STEPS } from '../engine/demoScenes';
import { mergeCanvasState } from '../engine/canvasUtils';
import WorkflowCanvas from '../WorkflowCanvas';
import AnnotationOverlay from '../AnnotationOverlay';
import WhatIfSliders from '../panels/WhatIfSliders';
import PipelineDrawer from '../PipelineDrawer';
import StatCard from '../../visualizations/StatCard';
import { apiGet } from '../../../lib/api';
import { spacing } from '@leafygreen-ui/tokens';
import { palette } from '@leafygreen-ui/palette';
import { uiTokens } from '../../../lib/uiTokens';

const FACTORS = [
  { label: 'Income Stability', points: 42, color: 'var(--mongo)' },
  { label: 'Credit History', points: 35, color: 'var(--mongo)' },
  { label: 'Debt-to-Income', points: 28, color: 'var(--agent-cyan)' },
  { label: 'Credit Utilization', points: -12, color: 'var(--danger)' },
  { label: 'Hard Inquiries', points: -8, color: 'var(--hitl-amber)' },
];

const SIMILAR_BORROWERS = [
  { equifax: 778, gds: '0.29', product: '5yr Fixed', similarity: '94.2%', status: 'Performing' },
  { equifax: 791, gds: '0.33', product: '5yr Fixed', similarity: '91.8%', status: 'Performing' },
  { equifax: 765, gds: '0.31', product: '5yr Variable', similarity: '87.4%', status: 'Performing' },
];

const COMPLIANCE = [
  { rule: 'FCAC Adverse Action Notices', met: true },
  { rule: 'OSFI B-20 — Mortgage Underwriting', met: true },
  { rule: 'PIPEDA — Privacy Compliance', met: true },
  { rule: 'Full Audit Trail Available', met: true },
];

const FAIR_LENDING = [
  { metric: 'Demographic parity', result: 'PASS', color: 'var(--success)' },
  { metric: 'LDA search', result: 'No less discriminatory alternative found', color: 'var(--success)' },
  { metric: 'Proxy detection', result: '0 flagged variables', color: 'var(--success)' },
];

function FactorBars({ factors, revealCount }) {
  const visible = factors.slice(0, revealCount);
  const maxAbs = Math.max(...factors.map((f) => Math.abs(f.points)));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[200] }}>
      {visible.map((f) => {
        const width = (Math.abs(f.points) / maxAbs) * 100;
        const isNeg = f.points < 0;
        return (
          <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: spacing[200], animation: 'slideDown 220ms cubic-bezier(0.33, 1, 0.68, 1)' }}>
            <div style={{ width: 130, fontSize: 11, color: 'var(--text-secondary)', textAlign: 'right', flexShrink: 0 }}>{f.label}</div>
            <div style={{ flex: 1, height: 18, background: 'var(--bg-raised)', borderRadius: 8, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: isNeg ? undefined : 0, right: isNeg ? 0 : undefined, height: '100%', width: `${width}%`, background: f.color, borderRadius: 8, opacity: 0.7, transition: 'width 400ms cubic-bezier(0.33, 1, 0.68, 1)' }} />
            </div>
            <div style={{ width: 40, fontFamily: uiTokens.monoFont, fontSize: 11, fontWeight: 700, color: isNeg ? 'var(--danger)' : 'var(--mongo)', textAlign: 'right' }}>
              {isNeg ? '' : '+'}{f.points}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RiskRing({ score, maxScore = 100, tier, fico }) {
  const r = 44;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / maxScore);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: spacing[400] }}>
      <svg width={110} height={110} viewBox="0 0 110 110">
        <circle cx={55} cy={55} r={r} fill="none" stroke="var(--border-dim)" strokeWidth={7} />
        <circle cx={55} cy={55} r={r} fill="none" stroke="var(--mongo)" strokeWidth={7} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} transform="rotate(-90 55 55)" style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(0.33, 1, 0.68, 1)' }} />
        <text x={55} y={50} textAnchor="middle" fill="var(--text-primary)" fontFamily={uiTokens.monoFont} fontSize={24} fontWeight={800}>{score}</text>
        <text x={55} y={68} textAnchor="middle" fill="var(--text-dim)" fontFamily={uiTokens.monoFont} fontSize={10}>/ {maxScore}</text>
      </svg>
      <div>
        <div style={{ fontFamily: uiTokens.font, fontWeight: 700, fontSize: 14 }}>Risk Tier {tier}</div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Equifax {fico} · GDS 31.2% · LTV 80.0%</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[200], marginTop: spacing[200] }}>
          <div>
            <div style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Rate</div>
            <div style={{ fontFamily: uiTokens.monoFont, fontSize: 16, fontWeight: 800, color: 'var(--mongo)' }}>4.89%</div>
          </div>
          <div>
            <div style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Monthly</div>
            <div style={{ fontFamily: uiTokens.monoFont, fontSize: 16, fontWeight: 700 }}>$4,047</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UnderwritingScene({ sceneStep, currentStepData }) {
  const [hoveredNode, setHoveredNode] = useState(null);
  const [timelineHighlight, setTimelineHighlight] = useState(null);
  const [pipelineData, setPipelineData] = useState(null);

  useEffect(() => {
    apiGet('/applications/APP-2026-00001/risk-pipeline').then((data) => {
      if (data?.application_id) {
        setPipelineData(data);
      }
    });
  }, []);

  const displayRiskScore = pipelineData?.risk_score ?? 72;

  const handleNodeHover = useCallback((nodeId) => setHoveredNode(nodeId), []);
  const handleTimelineHover = useCallback((nodeId) => setTimelineHighlight(nodeId), []);

  const canvasState = useMemo(
    () => mergeCanvasState(UNDERWRITING_STEPS, sceneStep),
    [sceneStep],
  );

  const showFactors = sceneStep >= 1;
  const showCounterfactual = sceneStep >= 2;
  const showFraudResult = sceneStep >= 3;
  const showPaymentHistory = sceneStep >= 4;
  const showFinalScore = sceneStep >= 5;
  const showValidation = sceneStep >= 6;

  const factorRevealCount = showFactors
    ? (sceneStep >= 2 ? FACTORS.length : Math.min(4, FACTORS.length))
    : 0;

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
                currentScene="underwriting"
                onNodeHover={handleNodeHover}
                highlightNode={timelineHighlight}
              />
          </div>
          <AnnotationOverlay
            currentStep={currentStepData}
            sceneTitle="Underwriting"
            stepIndex={sceneStep}
            totalSteps={UNDERWRITING_STEPS.length}
          />
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', borderTop: '1px solid var(--border-dim)', padding: spacing[400] }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing[200], marginBottom: spacing[300] }}>
              <StatCard label="Risk Score" value={sceneStep >= 1 ? displayRiskScore : 0} suffix="/100" color="var(--hitl-amber)" />
              <StatCard label="Fraud Scan" value={sceneStep >= 4 ? 'CLEAR' : 'Pending'} color={sceneStep >= 4 ? 'var(--success)' : 'var(--text-dim)'} animate={false} />
              <StatCard label="Factors" value={sceneStep >= 1 ? 5 : 0} color="var(--agent-cyan)" />
            </div>
            {sceneStep < 0 && (
              <div style={{ padding: spacing[500], textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
                Awaiting underwriting agent...
              </div>
            )}

            {showFactors && (
            <div style={{ marginBottom: spacing[400], animation: 'slideDown 220ms cubic-bezier(0.33, 1, 0.68, 1)' }}>
              <div style={{ fontFamily: uiTokens.font, fontWeight: 700, fontSize: 13, marginBottom: spacing[200] }}>Decision Factor Analysis</div>
              <FactorBars factors={FACTORS} revealCount={factorRevealCount} />
              {!showCounterfactual && (
                <div style={{ marginTop: spacing[200], fontSize: 10, color: 'var(--text-dim)', textAlign: 'center', animation: 'subtlePulse 1.5s infinite' }}>
                  Aggregation pipeline running...
                </div>
              )}
            </div>
          )}

          {showCounterfactual && (
            <div style={{ animation: 'slideDown 220ms cubic-bezier(0.33, 1, 0.68, 1)' }}>
              <div style={{ padding: spacing[300], background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--agent-cyan-dim)', marginBottom: spacing[400] }}>
                <div style={{ fontFamily: uiTokens.font, fontWeight: 700, fontSize: 12, color: 'var(--agent-cyan)', marginBottom: spacing[200] }}>Counterfactual Analysis</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  If credit utilization were below <strong style={{ color: 'var(--text-primary)' }}>20%</strong>, the risk score would improve by <strong style={{ color: 'var(--mongo)' }}>18 points</strong> (72 → 90), moving from tier <strong>B+</strong> to <strong style={{ color: 'var(--mongo)' }}>A-</strong>, qualifying for <strong>4.29% APR</strong> (saving $239/mo).
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: spacing[200] }}>Powered by Atlas Vector Search — similar borrower profiling</div>
              </div>
              <WhatIfSliders />
            </div>
          )}

          {showFraudResult && (
            <div style={{ padding: spacing[300], background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--success)', marginBottom: spacing[400], animation: 'slideDown 220ms cubic-bezier(0.33, 1, 0.68, 1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing[200] }}>
                <span style={{ fontSize: 18, color: 'var(--success)' }}>✓</span>
                <div>
                  <div style={{ fontFamily: uiTokens.font, fontWeight: 700, fontSize: 12, color: 'var(--success)' }}>Fraud Scan: CLEAR</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>$graphLookup 3-hop scan — 2,847 entities, 0 suspicious links</div>
                </div>
              </div>
            </div>
          )}

          {showPaymentHistory && (
            <div style={{ padding: spacing[300], background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border-dim)', marginBottom: spacing[400], animation: 'slideDown 220ms cubic-bezier(0.33, 1, 0.68, 1)' }}>
              <div style={{ fontFamily: uiTokens.font, fontWeight: 700, fontSize: 12, marginBottom: spacing[150] }}>Payment History</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                36-month analysis via Time Series Collection
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: spacing[200], marginTop: spacing[200] }}>
                <div style={{ textAlign: 'center', padding: spacing[200], background: 'var(--bg-raised)', borderRadius: 8 }}>
                  <div style={{ fontFamily: uiTokens.monoFont, fontSize: 16, fontWeight: 800, color: 'var(--success)' }}>100%</div>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>On-time</div>
                </div>
                <div style={{ textAlign: 'center', padding: spacing[200], background: 'var(--bg-raised)', borderRadius: 8 }}>
                  <div style={{ fontFamily: uiTokens.monoFont, fontSize: 16, fontWeight: 800 }}>36</div>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Months</div>
                </div>
                <div style={{ textAlign: 'center', padding: spacing[200], background: 'var(--bg-raised)', borderRadius: 8 }}>
                  <div style={{ fontFamily: uiTokens.monoFont, fontSize: 16, fontWeight: 800, color: 'var(--mongo)' }}>0</div>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Anomalies</div>
                </div>
              </div>
            </div>
          )}

          {showFinalScore && (
            <div style={{ padding: spacing[400], background: 'var(--bg-surface)', borderRadius: 8, border: '2px solid var(--mongo)', marginBottom: spacing[400], animation: 'slideDown 220ms cubic-bezier(0.33, 1, 0.68, 1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing[200], marginBottom: spacing[300] }}>
                <div style={{ fontFamily: uiTokens.font, fontWeight: 800, fontSize: 14, color: 'var(--mongo)' }}>Risk Assessment Complete</div>
                {pipelineData && (
                  <span style={{
                    fontSize: 9,
                    fontWeight: 700,
                    padding: `${spacing[50]}px ${spacing[200]}px`,
                    borderRadius: 8,
                    background: palette.green.light3,
                    color: 'var(--success, #00c864)',
                  }}>
                    Live · 7-stage Aggregation
                  </span>
                )}
              </div>
              <RiskRing score={displayRiskScore} tier="B+" fico={784} />
            </div>
          )}

          {showValidation && (
            <div style={{ marginTop: spacing[300] }}>
              <ExpandableCard title="Compliance & Validation (7/7 PASS)" defaultOpen={false}>
                <div style={{ marginBottom: spacing[400] }}>
                  <div style={{ fontFamily: uiTokens.font, fontWeight: 700, fontSize: 13, marginBottom: spacing[200], display: 'flex', alignItems: 'center', gap: spacing[200] }}>
                    Similar Borrowers
                    <Badge variant="blue">Vector Search</Badge>
                  </div>
                  {SIMILAR_BORROWERS.map((b, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: spacing[150], padding: `${spacing[200]}px ${spacing[3]}px`, background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border-dim)', marginBottom: spacing[150], fontSize: 11 }}>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Equifax / GDS</div>
                        <div style={{ fontFamily: uiTokens.monoFont, fontWeight: 600 }}>{b.equifax} / {b.gds}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Similarity</div>
                        <div style={{ fontFamily: uiTokens.monoFont, fontWeight: 600, color: 'var(--voyage)' }}>{b.similarity}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Status</div>
                        <div style={{ fontWeight: 600, color: 'var(--success)' }}>{b.status}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ marginBottom: spacing[400] }}>
                  <div style={{ fontFamily: uiTokens.font, fontWeight: 700, fontSize: 13, marginBottom: spacing[200] }}>Fair Lending Analysis</div>
                  <div style={{ background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border-dim)', overflow: 'hidden' }}>
                    {FAIR_LENDING.map((fl) => (
                      <div key={fl.metric} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `${spacing[200]}px ${spacing[300]}px`, borderBottom: '1px solid var(--border-dim)', fontSize: 11 }}>
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{fl.metric}</span>
                        <span style={{ fontFamily: uiTokens.monoFont, fontWeight: 700, color: fl.color }}>{fl.result}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ fontFamily: uiTokens.font, fontWeight: 700, fontSize: 13, marginBottom: spacing[200] }}>Regulatory Compliance</div>
                  {COMPLIANCE.map((c) => (
                    <div key={c.rule} style={{ display: 'flex', alignItems: 'center', gap: spacing[200], padding: `${spacing[200]}px 0`, borderBottom: '1px solid var(--border-dim)', fontSize: 12 }}>
                      <Badge variant={c.met ? 'green' : 'red'}>{c.met ? 'Compliant' : 'Failed'}</Badge>
                      <span style={{ color: 'var(--text-secondary)' }}>{c.rule}</span>
                    </div>
                  ))}
                </div>
              </ExpandableCard>
            </div>
          )}
          </div>
        </div>

        <PipelineDrawer
          steps={UNDERWRITING_STEPS}
          stepIndex={sceneStep}
          onEntryHover={handleTimelineHover}
          highlightNodeId={hoveredNode}
        />
      </div>
    </div>
  );
}
