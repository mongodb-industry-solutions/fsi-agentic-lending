"use client";

import { useMemo, useState, useCallback, useEffect } from 'react';
import Badge from '@leafygreen-ui/badge';
import ExpandableCard from '@leafygreen-ui/expandable-card';
import Icon from '@leafygreen-ui/icon';
import { palette } from '@leafygreen-ui/palette';
import { spacing } from '@leafygreen-ui/tokens';
import { uiTokens } from '../../../lib/uiTokens';
import { APPROVAL_STEPS } from '../engine/demoScenes';
import { mergeCanvasState } from '../engine/canvasUtils';
import WorkflowCanvas from '../WorkflowCanvas';
import AnnotationOverlay from '../AnnotationOverlay';
import PipelineDrawer from '../PipelineDrawer';

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
        <div style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden', display: 'grid', gridTemplateColumns: '1fr' }}>
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ position: 'relative', flex: '1.4 1 0%', minHeight: 240, overflow: 'hidden' }}>
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
                <div style={{ marginBottom: spacing[200] }}><Icon glyph="Checkmark" size="xlarge" fill={palette.green.dark2} /></div>
                <div style={{ fontFamily: uiTokens.font, fontWeight: 800, fontSize: 22, color: 'var(--mongo)', marginBottom: spacing[100] }}>LOAN APPROVED</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {LOAN_TERMS.type} @ {LOAN_TERMS.apr} · {LOAN_TERMS.monthlyPayment}/mo
                </div>
              </div>

              <div style={{ padding: spacing[400], background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border-dim)', marginBottom: spacing[400] }}>
                <div style={{ fontFamily: uiTokens.font, fontWeight: 700, fontSize: 12, marginBottom: spacing[200] }}>Loan Terms</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[200] }}>
                  {Object.entries(LOAN_TERMS).map(([key, val]) => (
                    <div key={key}>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: spacing[50] }}>{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                      <div style={{ fontFamily: uiTokens.monoFont, fontSize: 12, fontWeight: 600, color: key === 'apr' || key === 'monthlyPayment' ? 'var(--mongo)' : 'var(--text-primary)' }}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>

              <ExpandableCard title="Repayment Schedule (300 months)" defaultOpen={false}>
                <div style={{ background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border-dim)', overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', padding: `${spacing[2]}px ${spacing[200]}px`, borderBottom: '1px solid var(--border-dim)', textTransform: 'uppercase' }}>
                    <span>Month</span><span>Payment</span><span>Principal</span><span>Interest</span><span>Balance</span>
                  </div>
                  {AMORTIZATION.map((row) => (
                    <div key={row.month} style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', fontSize: 11, padding: `7px ${spacing[200]}px`, borderBottom: '1px solid var(--border-dim)', fontFamily: uiTokens.monoFont }}>
                      <span>{row.month}</span>
                      <span>{row.payment}</span>
                      <span style={{ color: 'var(--mongo)' }}>{row.principal}</span>
                      <span style={{ color: 'var(--text-dim)' }}>{row.interest}</span>
                      <span>{row.balance}</span>
                    </div>
                  ))}
                </div>
              </ExpandableCard>

              <div style={{ marginTop: spacing[300] }}>
                <ExpandableCard title="Regulatory Disclosures (4/4 compliant)" defaultOpen={false}>
                  {DISCLOSURES.map((d) => (
                    <div key={d.rule} style={{ display: 'flex', alignItems: 'center', gap: spacing[200], padding: '7px 0', borderBottom: '1px solid var(--border-dim)', fontSize: 12 }}>
                      <span style={{ color: 'var(--success)', fontSize: 14 }}>✓</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{d.rule}</span>
                    </div>
                  ))}
                </ExpandableCard>
              </div>
            </div>
          </div>

          <PipelineDrawer
            steps={APPROVAL_STEPS}
            stepIndex={sceneStep}
            onEntryHover={handleTimelineHover}
            highlightNodeId={hoveredNode}
          />
        </div>
      </div>
    );
  }

  if (hitlDeclined) {
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
                <div style={{ marginBottom: spacing[200] }}><Icon glyph="XWithCircle" size="xlarge" fill={palette.red.base} /></div>
                <div style={{ fontFamily: uiTokens.font, fontWeight: 800, fontSize: 22, color: 'var(--danger)', marginBottom: spacing[100] }}>LOAN DECLINED</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Application {PAYLOAD.applicationId} — {PAYLOAD.applicant}
                </div>
              </div>
              <div style={{ padding: spacing[400], background: 'var(--danger-dim)', borderRadius: 8, border: '1px solid var(--danger)', marginBottom: spacing[400] }}>
                <div style={{ fontFamily: uiTokens.font, fontWeight: 700, fontSize: 12, color: 'var(--danger)', marginBottom: spacing[200] }}>Decision Summary</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  The loan officer has declined this application after manual review. The workflow state has been persisted to MongoDB via MongoDBSaver. An adverse action notice will be generated per Bank Act and FCAC requirements.
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing[300] }}>
                <div>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: spacing[50] }}>Risk Score</div>
                  <div style={{ fontFamily: uiTokens.monoFont, fontSize: 18, fontWeight: 700, color: 'var(--danger)' }}>{PAYLOAD.riskScore}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: spacing[50] }}>Loan Amount</div>
                  <div style={{ fontFamily: uiTokens.monoFont, fontSize: 18, fontWeight: 700 }}>{PAYLOAD.loanAmount}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: spacing[50] }}>Reason</div>
                  <div style={{ fontFamily: uiTokens.monoFont, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>{PAYLOAD.triggerReason}</div>
                </div>
              </div>
            </div>
          </div>
          <PipelineDrawer
            steps={APPROVAL_STEPS}
            stepIndex={sceneStep}
            onEntryHover={handleTimelineHover}
            highlightNodeId={hoveredNode}
          />
        </div>
      </div>
    );
  }

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
          <div style={{ padding: spacing[4], background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border-base)', boxShadow: uiTokens.shadowHover }}>
            <div style={{ padding: `${spacing[200]}px ${spacing[300]}px`, background: 'var(--hitl-amber-dim)', borderRadius: 8, marginBottom: spacing[500], display: 'flex', alignItems: 'center', gap: spacing[200] }}>
              <Icon glyph="Save" size={18} fill={palette.yellow.dark2} />
              <div>
                <div style={{ fontFamily: uiTokens.font, fontWeight: 700, fontSize: 12, color: 'var(--hitl-amber)' }}>State saved to MongoDB — MongoDBSaver</div>
                <div style={{ fontFamily: uiTokens.monoFont, fontSize: 10, color: 'var(--text-dim)', marginTop: spacing[50] }}>
                  checkpoint({CHECKPOINT_DATA.checkpointId}) · thread: {CHECKPOINT_DATA.thread} · step: {CHECKPOINT_DATA.step}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: spacing[400] }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing[200], marginBottom: spacing[200] }}>
                <div style={{ padding: `${spacing[150]}px ${spacing[300]}px`, background: 'var(--hitl-amber-dim)', color: 'var(--hitl-amber)', borderRadius: 8, fontSize: 12, fontWeight: 700, display: 'inline-block' }}>
                  Human Review Required
                </div>
                <Badge variant="yellow">Tier 2 — Officer Review</Badge>
              </div>
              <div style={{ fontFamily: uiTokens.font, fontWeight: 700, fontSize: 18 }}>LangGraph interrupt() triggered</div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: spacing[100] }}>{PAYLOAD.triggerReason}</div>
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing[200], marginBottom: spacing[500], padding: spacing[300], background: 'var(--bg-raised)', borderRadius: 8 }}>
              {[
                { label: 'Applicant', value: PAYLOAD.applicant },
                { label: 'Product', value: PAYLOAD.product },
                { label: 'GDS', value: PAYLOAD.gds },
                { label: 'LTV', value: `${PAYLOAD.ltv}%` },
              ].map((item) => (
                <div key={item.label}>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: spacing[50] }}>{item.label}</div>
                  <div style={{ fontFamily: uiTokens.monoFont, fontSize: 12, fontWeight: 600 }}>{item.value}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: spacing[300] }}>
              <button type="button" onClick={onApprove} onFocus={(e) => { e.currentTarget.style.boxShadow = uiTokens.focusRing; }} onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }} style={{ flex: 1, padding: spacing[300], borderRadius: 8, border: 'none', background: 'var(--mongo)', color: palette.white, fontFamily: uiTokens.font, fontWeight: 700, cursor: 'pointer', fontSize: 13, outline: 'none' }}>
                Approve Loan
              </button>
              <button type="button" onClick={() => setModifyMsg(true)} onFocus={(e) => { e.currentTarget.style.boxShadow = uiTokens.focusRing; }} onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }} style={{ flex: 1, padding: spacing[300], borderRadius: 8, border: '1px solid var(--border-base)', background: 'var(--bg-raised)', color: 'var(--text-primary)', fontFamily: uiTokens.font, fontWeight: 600, cursor: 'pointer', fontSize: 13, outline: 'none' }}>
                Modify Terms
              </button>
              <button type="button" onClick={onDecline} onFocus={(e) => { e.currentTarget.style.boxShadow = uiTokens.focusRing; }} onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }} style={{ flex: 1, padding: spacing[300], borderRadius: 8, border: '1px solid var(--danger)', background: 'transparent', color: 'var(--danger)', fontFamily: uiTokens.font, fontWeight: 600, cursor: 'pointer', fontSize: 13, outline: 'none' }}>
                Decline
              </button>
            </div>
            {modifyMsg && (
              <div style={{ marginTop: spacing[300], padding: `${spacing[200]}px ${spacing[300]}px`, background: 'var(--hitl-amber-dim)', borderRadius: 8, border: '1px solid var(--hitl-amber)', fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: spacing[200] }}>
                <Icon glyph="InfoWithCircle" size={14} />
                <span>Terms modification is not available in this demo. Approve or decline to continue.</span>
                <button
                  type="button"
                  onClick={() => setModifyMsg(false)}
                  onFocus={(e) => { e.currentTarget.style.boxShadow = uiTokens.focusRing; }}
                  onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', fontSize: 14, padding: spacing[100], outline: 'none' }}
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

        <PipelineDrawer
          steps={APPROVAL_STEPS}
          stepIndex={sceneStep}
          onEntryHover={handleTimelineHover}
          highlightNodeId={hoveredNode}
        />
      </div>
    </div>
  );
}
