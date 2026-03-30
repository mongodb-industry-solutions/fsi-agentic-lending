"use client";

import { useMemo, useState, useCallback } from 'react';
import { DECISIONING_STEPS } from '../engine/demoScenes';
import { mergeCanvasState } from '../engine/canvasUtils';
import WorkflowCanvas from '../WorkflowCanvas';
import AnnotationOverlay from '../AnnotationOverlay';
import WhatIfSliders from '../panels/WhatIfSliders';
import FraudGraph from '../panels/FraudGraph';
import DataSourceStrip from '../DataSourceStrip';
import PipelineTimeline from '../PipelineTimeline';
import StatCard from '../../visualizations/StatCard';
import FicoRing from '../../visualizations/FicoRing';

const FACTORS = [
  { label: 'Income Stability', points: 42, color: 'var(--mongo)' },
  { label: 'Credit History', points: 35, color: 'var(--mongo)' },
  { label: 'Debt-to-Income', points: 28, color: 'var(--agent-cyan)' },
  { label: 'Payment Regularity', points: 22, color: 'var(--tool-blue)' },
  { label: 'Cash Reserves', points: 15, color: 'var(--tool-blue)' },
  { label: 'Credit Utilization', points: -12, color: 'var(--danger)' },
  { label: 'Hard Inquiries', points: -8, color: 'var(--hitl-amber)' },
];

const CASH_FLOW_MONTHS = [
  { month: 'Jul', income: 11865, expenses: 8200 },
  { month: 'Aug', income: 11865, expenses: 8450 },
  { month: 'Sep', income: 11865, expenses: 7900 },
  { month: 'Oct', income: 12340, expenses: 8700 },
  { month: 'Nov', income: 11865, expenses: 8100 },
  { month: 'Dec', income: 14230, expenses: 9200 },
];

const SIMILAR_BORROWERS = [
  { fico: 778, dti: '0.29', product: '5yr Fixed', similarity: '94.2%', status: 'Performing' },
  { fico: 791, dti: '0.33', product: '5yr Fixed', similarity: '91.8%', status: 'Performing' },
  { fico: 765, dti: '0.31', product: '5yr Variable', similarity: '87.4%', status: 'Performing' },
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

const ADVERSE_ACTION_REASONS = [
  { code: 'AA-01', reason: 'High credit utilization (38% vs 30% threshold)', factor: 'Credit Utilization' },
  { code: 'AA-02', reason: 'Insufficient payment history (18 months vs 24 required)', factor: 'History Length' },
  { code: 'AA-03', reason: 'Recent hard inquiries exceed limit (3 in 90 days)', factor: 'Inquiries' },
];

function FactorBars({ factors, revealCount }) {
  const visible = factors.slice(0, revealCount);
  const maxAbs = Math.max(...factors.map((f) => Math.abs(f.points)));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {visible.map((f) => {
        const width = (Math.abs(f.points) / maxAbs) * 100;
        const isNeg = f.points < 0;
        return (
          <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 10, animation: 'slideDown 0.3s ease-out' }}>
            <div style={{ width: 130, fontSize: 11, color: 'var(--text-secondary)', textAlign: 'right', flexShrink: 0 }}>{f.label}</div>
            <div style={{ flex: 1, height: 18, background: 'var(--bg-raised)', borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: isNeg ? undefined : 0, right: isNeg ? 0 : undefined, height: '100%', width: `${width}%`, background: f.color, borderRadius: 4, opacity: 0.7, transition: 'width 0.6s ease-out' }} />
            </div>
            <div style={{ width: 40, fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: isNeg ? 'var(--danger)' : 'var(--mongo)', textAlign: 'right' }}>
              {isNeg ? '' : '+'}{f.points}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CashFlowCard() {
  const maxVal = Math.max(...CASH_FLOW_MONTHS.map((d) => d.income));
  return (
    <div style={{ padding: 12, background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--agent-cyan)', marginBottom: 16, animation: 'slideDown 0.3s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, color: 'var(--agent-cyan)' }}>
          Cash Flow Analysis
        </div>
        <span style={{ fontSize: 8, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: 'var(--agent-cyan-dim)', color: 'var(--agent-cyan)' }}>
          Open Banking + Aggregation
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 50, marginBottom: 6 }}>
        {CASH_FLOW_MONTHS.map((d, i) => {
          const incH = (d.income / maxVal) * 44;
          const expH = (d.expenses / maxVal) * 44;
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, justifyContent: 'flex-end', height: '100%' }}>
              <div style={{ display: 'flex', gap: 1, alignItems: 'flex-end', width: '100%', justifyContent: 'center' }}>
                <div style={{ width: '40%', height: incH, background: 'var(--success)', borderRadius: '2px 2px 0 0', opacity: 0.6, minHeight: 3 }} />
                <div style={{ width: '40%', height: expH, background: 'var(--danger)', borderRadius: '2px 2px 0 0', opacity: 0.4, minHeight: 3 }} />
              </div>
              <div style={{ fontSize: 7, color: 'var(--text-dim)', marginTop: 1 }}>{d.month}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, fontSize: 10 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: 'var(--text-dim)', fontSize: 8, textTransform: 'uppercase' }}>Avg Surplus</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--success)' }}>$3,918/mo</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: 'var(--text-dim)', fontSize: 8, textTransform: 'uppercase' }}>Stability</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--mongo)' }}>98.2%</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: 'var(--text-dim)', fontSize: 8, textTransform: 'uppercase' }}>Ratio</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--agent-cyan)' }}>1.47x</div>
        </div>
      </div>
      <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 6 }}>
        74% of consumers comfortable sharing open banking data for better rates
      </div>
    </div>
  );
}

function ChampionChallengerCard() {
  return (
    <div style={{ padding: 10, background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-dim)', marginBottom: 12, animation: 'slideDown 0.3s ease-out' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11, marginBottom: 6, color: 'var(--text-secondary)' }}>
        Champion / Challenger Models
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, fontSize: 10 }}>
        <div>
          <div style={{ fontSize: 8, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Champion</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--mongo)' }}>Score 72 (B+)</div>
        </div>
        <div>
          <div style={{ fontSize: 8, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Challenger</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--agent-cyan)' }}>Score 74 (B+)</div>
        </div>
        <div>
          <div style={{ fontSize: 8, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Delta / Status</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>+2 · <span style={{ color: 'var(--text-dim)' }}>Shadow</span></div>
        </div>
      </div>
    </div>
  );
}

function AdverseActionPreview() {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ padding: 10, background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--hitl-amber)', marginBottom: 12, animation: 'slideDown 0.3s ease-out' }}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        style={{ all: 'unset', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}
      >
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11, color: 'var(--hitl-amber)' }}>
          What if declined? — Adverse Action Preview
        </div>
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded && (
        <div style={{ marginTop: 8 }}>
          {ADVERSE_ACTION_REASONS.map((r) => (
            <div key={r.code} style={{ display: 'flex', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--border-dim)', fontSize: 10 }}>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--hitl-amber)', fontWeight: 700, flexShrink: 0 }}>{r.code}</span>
              <span style={{ color: 'var(--text-secondary)' }}>{r.reason}</span>
            </div>
          ))}
          <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 6 }}>
            FCAC-compliant reason codes auto-generated — addresses Canadian fair lending requirements
          </div>
        </div>
      )}
    </div>
  );
}

function RiskRing({ score, maxScore = 100, tier, fico }) {
  const r = 44;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / maxScore);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <svg width={110} height={110} viewBox="0 0 110 110">
        <circle cx={55} cy={55} r={r} fill="none" stroke="var(--border-dim)" strokeWidth={7} />
        <circle cx={55} cy={55} r={r} fill="none" stroke="var(--mongo)" strokeWidth={7} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} transform="rotate(-90 55 55)" style={{ transition: 'stroke-dashoffset 1s ease-out' }} />
        <text x={55} y={50} textAnchor="middle" fill="var(--text-primary)" fontFamily="var(--font-mono)" fontSize={24} fontWeight={800}>{score}</text>
        <text x={55} y={68} textAnchor="middle" fill="var(--text-dim)" fontFamily="var(--font-mono)" fontSize={10}>/ {maxScore}</text>
      </svg>
      <div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>Risk Tier {tier}</div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Equifax {fico} · GDS 31.2% · LTV 80.0%</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
          <div>
            <div style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Rate</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 800, color: 'var(--mongo)' }}>4.89%</div>
          </div>
          <div>
            <div style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Monthly</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700 }}>$4,047</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DecisioningScene({ sceneStep, currentStepData }) {
  const fraudTakeover = currentStepData?.id === 'd-4';
  const [hoveredNode, setHoveredNode] = useState(null);
  const [timelineHighlight, setTimelineHighlight] = useState(null);

  const handleNodeHover = useCallback((nodeId) => setHoveredNode(nodeId), []);
  const handleTimelineHover = useCallback((nodeId) => setTimelineHighlight(nodeId), []);

  const canvasState = useMemo(
    () => mergeCanvasState(DECISIONING_STEPS, sceneStep),
    [sceneStep],
  );

  const showFactors = sceneStep >= 1;
  const showCashFlow = sceneStep >= 2;
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
      <DataSourceStrip sceneKey="decisioning" sceneStep={sceneStep} totalSteps={DECISIONING_STEPS.length} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden' }}>
            {fraudTakeover ? (
              <FraudGraph fillContainer hopReveal={3} />
            ) : (
              <WorkflowCanvas
                activeNodes={canvasState.activeNodes}
                activeEdges={canvasState.activeEdges}
                pulsingNodes={canvasState.pulsingNodes}
                completedNodes={canvasState.completedNodes}
                currentScene="decisioning"
                onNodeHover={handleNodeHover}
                highlightNode={timelineHighlight}
              />
            )}
          </div>
          <AnnotationOverlay
            currentStep={currentStepData}
            sceneTitle="Decisioning"
            stepIndex={sceneStep}
            totalSteps={DECISIONING_STEPS.length}
          />
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', borderTop: '1px solid var(--border-dim)', padding: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
              <StatCard label="Risk Score" value={sceneStep >= 1 ? 72 : 0} suffix="/100" color="var(--hitl-amber)" />
              <StatCard label="Risk Tier" value={sceneStep >= 2 ? 'B+' : '—'} color="var(--tool-blue)" animate={false} />
              <StatCard label="Fraud Scan" value={sceneStep >= 4 ? 'CLEAR' : 'Pending'} color={sceneStep >= 4 ? 'var(--success)' : 'var(--text-dim)'} animate={false} />
              <StatCard label="Factors" value={sceneStep >= 1 ? 7 : 0} color="var(--agent-cyan)" />
            </div>
            {sceneStep < 0 && (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
                Awaiting underwriting agent...
              </div>
            )}

            {showFactors && (
            <div style={{ marginBottom: 16, animation: 'slideDown 0.3s ease-out' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Decision Factor Analysis</div>
              <FactorBars factors={FACTORS} revealCount={factorRevealCount} />
              {!showCashFlow && (
                <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-dim)', textAlign: 'center', animation: 'pulse 1.5s infinite' }}>
                  Aggregation pipeline running...
                </div>
              )}
            </div>
          )}

          {showCashFlow && <CashFlowCard />}

          {showCounterfactual && (
            <div style={{ animation: 'slideDown 0.3s ease-out' }}>
              <div style={{ padding: 14, background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--agent-cyan-dim)', marginBottom: 16 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, color: 'var(--agent-cyan)', marginBottom: 8 }}>Counterfactual Analysis</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  If credit utilization were below <strong style={{ color: 'var(--text-primary)' }}>20%</strong>, the risk score would improve by <strong style={{ color: 'var(--mongo)' }}>18 points</strong> (72 → 90), moving from tier <strong>B+</strong> to <strong style={{ color: 'var(--mongo)' }}>A-</strong>, qualifying for <strong>6.0% APR</strong> (saving $87/mo).
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 8 }}>Powered by Atlas Vector Search — similar borrower profiling</div>
              </div>
              <WhatIfSliders />
            </div>
          )}

          {showFraudResult && (
            <div style={{ padding: 12, background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--success)', marginBottom: 16, animation: 'slideDown 0.3s ease-out' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18, color: 'var(--success)' }}>✓</span>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, color: 'var(--success)' }}>Fraud Scan: CLEAR</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>$graphLookup 3-hop scan — 2,847 entities, 0 suspicious links</div>
                </div>
              </div>
            </div>
          )}

          {showPaymentHistory && (
            <div style={{ padding: 12, background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-dim)', marginBottom: 16, animation: 'slideDown 0.3s ease-out' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, marginBottom: 6 }}>Payment History</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                36-month analysis via Time Series Collection
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
                <div style={{ textAlign: 'center', padding: 8, background: 'var(--bg-raised)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 800, color: 'var(--success)' }}>100%</div>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>On-time</div>
                </div>
                <div style={{ textAlign: 'center', padding: 8, background: 'var(--bg-raised)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 800 }}>36</div>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Months</div>
                </div>
                <div style={{ textAlign: 'center', padding: 8, background: 'var(--bg-raised)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 800, color: 'var(--mongo)' }}>0</div>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Anomalies</div>
                </div>
              </div>
            </div>
          )}

          {showFinalScore && (
            <div style={{ padding: 16, background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '2px solid var(--mongo)', marginBottom: 16, animation: 'slideDown 0.3s ease-out' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, color: 'var(--mongo)', marginBottom: 12 }}>Risk Assessment Complete</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <RiskRing score={72} tier="B+" fico={784} />
                <FicoRing score={784} size={80} strokeWidth={6} />
              </div>
              <div style={{ marginTop: 12 }}>
                <ChampionChallengerCard />
                <AdverseActionPreview />
              </div>
            </div>
          )}

          {showValidation && (
            <>
              <div style={{ marginBottom: 16, animation: 'slideDown 0.3s ease-out' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                  Similar Borrowers
                  <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--voyage)', padding: '2px 8px', background: 'var(--voyage-dim)', borderRadius: 4 }}>Vector Search</span>
                </div>
                {SIMILAR_BORROWERS.map((b, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, padding: '10px 12px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-dim)', marginBottom: 6, fontSize: 11 }}>
                    <div>
                      <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Equifax / GDS</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{b.fico} / {b.dti}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Similarity</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--voyage)' }}>{b.similarity}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Status</div>
                      <div style={{ fontWeight: 600, color: 'var(--success)' }}>{b.status}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: 16, animation: 'slideDown 0.3s ease-out' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Fair Lending Analysis</div>
                <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-dim)', overflow: 'hidden' }}>
                  {FAIR_LENDING.map((fl) => (
                    <div key={fl.metric} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--border-dim)', fontSize: 11 }}>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{fl.metric}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: fl.color }}>{fl.result}</span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 4 }}>
                  Addresses fair lending compliance requirements — $2.5M+ settlement precedents
                </div>
              </div>

              <div style={{ animation: 'slideDown 0.3s ease-out' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Regulatory Compliance</div>
                {COMPLIANCE.map((c) => (
                  <div key={c.rule} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border-dim)', fontSize: 12 }}>
                    <span style={{ color: c.met ? 'var(--success)' : 'var(--danger)', fontSize: 14 }}>{c.met ? '✓' : '✕'}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{c.rule}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          </div>
        </div>

        <div style={{ borderLeft: '1px solid var(--border-dim)', display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--bg-base)', padding: 16 }}>
          <PipelineTimeline
            steps={DECISIONING_STEPS}
            stepIndex={sceneStep}
            onEntryHover={handleTimelineHover}
            highlightNodeId={hoveredNode}
          />
        </div>
      </div>
    </div>
  );
}
