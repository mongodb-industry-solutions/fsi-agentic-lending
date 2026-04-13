"use client";

import { useMemo, useState, useCallback, useEffect } from 'react';
import { spacing } from '@leafygreen-ui/tokens';
import { APPROVAL_STEPS } from '../engine/demoScenes';
import { mergeCanvasState } from '../engine/canvasUtils';
import WorkflowCanvas from '../WorkflowCanvas';
import AnnotationOverlay from '../AnnotationOverlay';
import DataSourceStrip from '../DataSourceStrip';
import PipelineTimeline from '../PipelineTimeline';

const CHECKPOINT_DATA = {
  checkpointId: 'cp-7g8h9i',
  thread: 'thr-00001',
  step: 'hitl_gate',
  savedAt: '2026-03-30T14:23:01.520Z',
};

const PAYLOAD = {
  applicant: 'Marcus & Sofia Delgado',
  applicationId: 'APP-2026-00001',
  loanAmount: '$875,000',
  product: '5yr Fixed (25yr Amort)',
  riskScore: 72,
  riskTier: 'B+',
  proposedRate: '4.89%',
  monthlyPayment: '$4,047',
  gds: 0.312,
  ltv: 80.0,
  triggerReason: 'Property value exceeds $500K — officer review required per policy §3.1.4',
};

const LOAN_TERMS = {
  type: '5yr Fixed (25yr Amortization)',
  apr: '4.89%',
  monthlyPayment: '$4,047',
  totalInterest: '$514,100',
  totalCost: '$1,214,100',
  firstPayment: 'May 1, 2026',
  maturity: 'April 30, 2051',
};

const AMORTIZATION = [
  { month: 1, payment: '$4,047.39', principal: '$1,194.89', interest: '$2,852.50', balance: '$698,805.11' },
  { month: 2, payment: '$4,047.39', principal: '$1,199.76', interest: '$2,847.63', balance: '$697,605.35' },
  { month: 3, payment: '$4,047.39', principal: '$1,204.65', interest: '$2,842.74', balance: '$696,400.70' },
  { month: 6, payment: '$4,047.39', principal: '$1,219.42', interest: '$2,827.97', balance: '$692,784.08' },
  { month: 12, payment: '$4,047.39', principal: '$1,249.39', interest: '$2,798.00', balance: '$685,341.22' },
  { month: 24, payment: '$4,047.39', principal: '$1,312.26', interest: '$2,735.13', balance: '$669,470.48' },
];

const DISCLOSURES = [
  { rule: 'OSFI B-20 — Residential Mortgage Underwriting', met: true },
  { rule: 'FCAC — Financial Consumer Agency of Canada', met: true },
  { rule: 'PIPEDA — Personal Information Protection', met: true },
  { rule: 'Bank Act — Mortgage Lending Standards', met: true },
];

export default function ApprovalScene({ sceneStep, hitlApproved, hitlDeclined, onApprove, onDecline, currentStepData }) {
  const [hoveredNode, setHoveredNode] = useState(null);
  const [timelineHighlight, setTimelineHighlight] = useState(null);
  const [modifyMsg, setModifyMsg] = useState(false);

  useEffect(() => {
    setModifyMsg(false);
  }, [hitlApproved, hitlDeclined]);

  const handleNodeHover = useCallback((nodeId) => setHoveredNode(nodeId), []);
  const handleTimelineHover = useCallback((nodeId) => setTimelineHighlight(nodeId), []);

  const canvasState = useMemo(
    () => mergeCanvasState(APPROVAL_STEPS, sceneStep),
    [sceneStep],
  );

  if (hitlApproved) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <DataSourceStrip sceneKey="approval" sceneStep={sceneStep} totalSteps={APPROVAL_STEPS.length} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', flex: 1, minHeight: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <WorkflowCanvas
                activeNodes={canvasState.activeNodes}
                activeEdges={canvasState.activeEdges}
                pulsingNodes={canvasState.pulsingNodes}
                completedNodes={canvasState.completedNodes}
                currentScene="approval"
                onNodeHover={handleNodeHover}
                highlightNode={timelineHighlight}
              />
            </div>
            <AnnotationOverlay
              currentStep={currentStepData}
              sceneTitle="Approval"
              stepIndex={sceneStep}
              totalSteps={APPROVAL_STEPS.length}
            />
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', borderTop: '1px solid var(--border-dim)', padding: spacing[400] }}>
              <div style={{ textAlign: 'center', marginBottom: spacing[400] }}>
                <div style={{ fontSize: 36, marginBottom: spacing[200] }}>✅</div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: 'var(--mongo)', marginBottom: spacing[100] }}>LOAN APPROVED</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {LOAN_TERMS.type} @ {LOAN_TERMS.apr} · {LOAN_TERMS.monthlyPayment}/mo
                </div>
              </div>

              <div style={{ padding: spacing[400], background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-dim)', marginBottom: spacing[400] }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, marginBottom: 10 }}>Loan Terms</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {Object.entries(LOAN_TERMS).map(([key, val]) => (
                    <div key={key}>
                      <div style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: spacing[50] }}>{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: key === 'apr' || key === 'monthlyPayment' ? 'var(--mongo)' : 'var(--text-primary)' }}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, marginBottom: 10 }}>Repayment Schedule Preview</div>
              <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-dim)', overflow: 'hidden', marginBottom: spacing[400] }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', padding: '8px 10px', borderBottom: '1px solid var(--border-dim)', textTransform: 'uppercase' }}>
                  <span>Month</span><span>Payment</span><span>Principal</span><span>Interest</span><span>Balance</span>
                </div>
                {AMORTIZATION.map((row) => (
                  <div key={row.month} style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', fontSize: 10, padding: '7px 10px', borderBottom: '1px solid var(--border-dim)', fontFamily: 'var(--font-mono)' }}>
                    <span>{row.month}</span>
                    <span>{row.payment}</span>
                    <span style={{ color: 'var(--mongo)' }}>{row.principal}</span>
                    <span style={{ color: 'var(--text-dim)' }}>{row.interest}</span>
                    <span>{row.balance}</span>
                  </div>
                ))}
                <button type="button" style={{
                  width: '100%', padding: `${spacing[150]}px 0`, fontSize: 10,
                  color: 'var(--mongo)', fontWeight: 600, fontFamily: 'var(--font-mono)',
                  background: 'none', border: 'none', borderTop: '1px solid var(--border-dim)',
                  cursor: 'pointer',
                }}>
                  View full 300-month schedule →
                </button>
              </div>

              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, marginBottom: 10 }}>Regulatory Disclosures</div>
              {DISCLOSURES.map((d) => (
                <div key={d.rule} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--border-dim)', fontSize: 12 }}>
                  <span style={{ color: 'var(--success)', fontSize: 14 }}>✓</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{d.rule}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ borderLeft: '1px solid var(--border-dim)', display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--bg-base)', padding: spacing[400] }}>
            <PipelineTimeline
              steps={APPROVAL_STEPS}
              stepIndex={sceneStep}
              onEntryHover={handleTimelineHover}
              highlightNodeId={hoveredNode}
            />
          </div>
        </div>
      </div>
    );
  }

  if (hitlDeclined) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <DataSourceStrip sceneKey="approval" sceneStep={sceneStep} totalSteps={APPROVAL_STEPS.length} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', flex: 1, minHeight: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <WorkflowCanvas
                activeNodes={canvasState.activeNodes}
                activeEdges={canvasState.activeEdges}
                pulsingNodes={canvasState.pulsingNodes}
                completedNodes={canvasState.completedNodes}
                currentScene="approval"
                onNodeHover={handleNodeHover}
                highlightNode={timelineHighlight}
              />
            </div>
            <AnnotationOverlay
              currentStep={currentStepData}
              sceneTitle="Approval"
              stepIndex={sceneStep}
              totalSteps={APPROVAL_STEPS.length}
            />
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', borderTop: '1px solid var(--border-dim)', padding: spacing[400] }}>
              <div style={{ textAlign: 'center', marginBottom: spacing[400] }}>
                <div style={{ fontSize: 36, marginBottom: spacing[200] }}>❌</div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: 'var(--danger)', marginBottom: spacing[100] }}>LOAN DECLINED</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Application {PAYLOAD.applicationId} — {PAYLOAD.applicant}
                </div>
              </div>
              <div style={{ padding: spacing[400], background: 'var(--danger-dim)', borderRadius: 'var(--radius-md)', border: '1px solid var(--danger)', marginBottom: spacing[400] }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, color: 'var(--danger)', marginBottom: spacing[200] }}>Decision Summary</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  The loan officer has declined this application after manual review. The workflow state has been persisted to MongoDB via MongoDBSaver. An adverse action notice will be generated per Bank Act and FCAC requirements.
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing[300] }}>
                <div>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: spacing[50] }}>Risk Score</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: 'var(--danger)' }}>{PAYLOAD.riskScore}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: spacing[50] }}>Loan Amount</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700 }}>{PAYLOAD.loanAmount}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: spacing[50] }}>Reason</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>{PAYLOAD.triggerReason}</div>
                </div>
              </div>
            </div>
          </div>
          <div style={{ borderLeft: '1px solid var(--border-dim)', display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--bg-base)', padding: spacing[400] }}>
            <PipelineTimeline
              steps={APPROVAL_STEPS}
              stepIndex={sceneStep}
              onEntryHover={handleTimelineHover}
              highlightNodeId={hoveredNode}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <DataSourceStrip sceneKey="approval" sceneStep={sceneStep} totalSteps={APPROVAL_STEPS.length} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', flex: 1, minHeight: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <WorkflowCanvas
              activeNodes={canvasState.activeNodes}
              activeEdges={canvasState.activeEdges}
              pulsingNodes={canvasState.pulsingNodes}
              completedNodes={canvasState.completedNodes}
              currentScene="approval"
              onNodeHover={handleNodeHover}
              highlightNode={timelineHighlight}
            />
          </div>
          <AnnotationOverlay
            currentStep={currentStepData}
            sceneTitle="Approval"
            stepIndex={sceneStep}
            totalSteps={APPROVAL_STEPS.length}
          />
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', borderTop: '1px solid var(--border-dim)', padding: spacing[400] }}>
            <div style={{ padding: spacing[300], background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-dim)', marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[200] }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12 }}>Routing Decision</div>
              <span style={{ fontSize: 9, fontWeight: 600, padding: `${spacing[50]}px ${spacing[200]}px`, borderRadius: 4, background: 'var(--mongo-dim)', color: 'var(--mongo)' }}>
                Auto-decisioning rate: 70–83%
              </span>
            </div>
            {[
              { tier: 1, label: 'Low Risk (score > 85)', action: 'Auto-approve — no human review', active: false },
              { tier: 2, label: 'Medium Risk (score 60–85)', action: 'Junior officer review', active: true },
              { tier: 3, label: 'High Risk (score < 60)', action: 'Senior underwriter escalation', active: false },
            ].map((t) => (
              <div key={t.tier} style={{ display: 'flex', alignItems: 'center', gap: spacing[200], padding: `${spacing[150]}px ${spacing[200]}px`, borderRadius: 'var(--radius-sm)', background: t.active ? 'var(--hitl-amber-dim)' : 'transparent', border: t.active ? '1px solid var(--hitl-amber)' : '1px solid transparent', marginBottom: spacing[100] }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: t.active ? 'var(--hitl-amber)' : 'var(--text-dim)', flexShrink: 0 }}>
                  Tier {t.tier}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-secondary)', flex: 1 }}>{t.label}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: t.active ? 'var(--hitl-amber)' : 'var(--text-dim)' }}>
                  {t.action} {t.active && '← THIS APPLICATION'}
                </span>
              </div>
            ))}
          </div>

          <div style={{ padding: 28, background: 'var(--bg-surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-base)', boxShadow: '0 12px 40px rgba(0,0,0,0.06)' }}>
            <div style={{ padding: '10px 14px', background: 'var(--hitl-amber-dim)', borderRadius: 'var(--radius-md)', marginBottom: spacing[500], display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>💾</span>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, color: 'var(--hitl-amber)' }}>State saved to MongoDB — MongoDBSaver</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)', marginTop: spacing[50] }}>
                  checkpoint({CHECKPOINT_DATA.checkpointId}) · thread: {CHECKPOINT_DATA.thread} · step: {CHECKPOINT_DATA.step}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: spacing[500] }}>
              <div style={{ padding: `${spacing[150]}px ${spacing[300]}px`, background: 'var(--hitl-amber-dim)', color: 'var(--hitl-amber)', borderRadius: 20, fontSize: 12, fontWeight: 700, display: 'inline-block', marginBottom: spacing[300] }}>
                ⏸ Human Review Required
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18 }}>LangGraph interrupt() triggered</div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: spacing[100] }}>{PAYLOAD.triggerReason}</div>
            </div>

            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6, padding: 10, background: 'var(--bg-raised)', borderRadius: 'var(--radius-sm)', marginBottom: spacing[400] }}>
              The agent workflow is paused at this node. All state is persisted to MongoDB via MongoDBSaver. The loan officer reviews and decides.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing[400], marginBottom: spacing[400] }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: spacing[100] }}>Risk Score</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--hitl-amber)' }}>{PAYLOAD.riskScore} <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>/ 100</span></div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: spacing[100] }}>Loan Amount</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{PAYLOAD.loanAmount}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: spacing[100] }}>Proposed Rate</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--mongo)' }}>{PAYLOAD.proposedRate}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing[200], marginBottom: spacing[500], padding: spacing[300], background: 'var(--bg-raised)', borderRadius: 'var(--radius-md)' }}>
              {[
                { label: 'Applicant', value: PAYLOAD.applicant },
                { label: 'Product', value: PAYLOAD.product },
                { label: 'GDS', value: PAYLOAD.gds },
                { label: 'LTV', value: `${PAYLOAD.ltv}%` },
              ].map((item) => (
                <div key={item.label}>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: spacing[50] }}>{item.label}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600 }}>{item.value}</div>
                </div>
              ))}
            </div>

            <div style={{ padding: spacing[300], background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-dim)', marginBottom: spacing[400] }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, marginBottom: spacing[200] }}>Generated Loan Terms</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: spacing[200], fontSize: 11 }}>
                <div><div style={{ fontSize: 9, color: 'var(--text-dim)' }}>TYPE</div><div style={{ fontWeight: 600 }}>5yr Fixed (25yr)</div></div>
                <div><div style={{ fontSize: 9, color: 'var(--text-dim)' }}>APR</div><div style={{ fontWeight: 600, color: 'var(--mongo)' }}>4.89%</div></div>
                <div><div style={{ fontSize: 9, color: 'var(--text-dim)' }}>MONTHLY</div><div style={{ fontWeight: 600 }}>$4,047</div></div>
                <div><div style={{ fontSize: 9, color: 'var(--text-dim)' }}>TOTAL INTEREST</div><div style={{ fontWeight: 600 }}>$514,100</div></div>
                <div><div style={{ fontSize: 9, color: 'var(--text-dim)' }}>FIRST PAYMENT</div><div style={{ fontWeight: 600 }}>May 1, 2026</div></div>
                <div><div style={{ fontSize: 9, color: 'var(--text-dim)' }}>MATURITY</div><div style={{ fontWeight: 600 }}>Apr 2051</div></div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: spacing[400] }}>
              <button type="button" onClick={onApprove} style={{ flex: 1, padding: 14, borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--mongo)', color: '#ffffff', fontFamily: 'var(--font-display)', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                ✓ Approve Loan
              </button>
              <button type="button" onClick={() => setModifyMsg(true)} style={{ flex: 1, padding: 14, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-base)', background: 'var(--bg-raised)', color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                ✎ Modify Terms
              </button>
              <button type="button" onClick={onDecline} style={{ flex: 1, padding: 14, borderRadius: 'var(--radius-md)', border: '1px solid var(--danger)', background: 'transparent', color: 'var(--danger)', fontFamily: 'var(--font-display)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                ✕ Decline
              </button>
            </div>
            {modifyMsg && (
              <div style={{ marginTop: spacing[300], padding: '10px 14px', background: 'var(--hitl-amber-dim)', borderRadius: 'var(--radius-md)', border: '1px solid var(--hitl-amber)', fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: spacing[200] }}>
                <span style={{ fontSize: 14 }}>ℹ️</span>
                <span>Terms modification is not available in this demo. Approve or decline to continue.</span>
                <button
                  type="button"
                  onClick={() => setModifyMsg(false)}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', fontSize: 14, padding: spacing[100] }}
                  aria-label="Dismiss"
                >
                  ×
                </button>
              </div>
            )}

            <div style={{ marginTop: spacing[400], fontSize: 11, color: 'var(--text-dim)', textAlign: 'center' }}>
              Workflow will resume from this checkpoint — no data lost
            </div>
          </div>
          </div>
        </div>

        <div style={{ borderLeft: '1px solid var(--border-dim)', display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--bg-base)', padding: spacing[400] }}>
          <PipelineTimeline
            steps={APPROVAL_STEPS}
            stepIndex={sceneStep}
            onEntryHover={handleTimelineHover}
            highlightNodeId={hoveredNode}
          />
        </div>
      </div>
    </div>
  );
}
