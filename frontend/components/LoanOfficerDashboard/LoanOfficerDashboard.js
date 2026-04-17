"use client";

import { useState, useRef, useEffect } from 'react';
import { spacing } from '@leafygreen-ui/tokens';
import Modal from '@leafygreen-ui/modal';
import ApplicationQueue from './ApplicationQueue';
import AgentActivityLog from './AgentActivityLog';
import IntentPreview from './IntentPreview';
import ApplicationDetail from './ApplicationDetail';
import DecisionSummary from './DecisionSummary';
import WorkflowCanvas from '../DemoFlow/WorkflowCanvas';
import NotificationToast, { useToasts } from '../NotificationToast/NotificationToast';
import { WORKFLOW_STAGES } from './constants';
import { getAppDisplayName } from './utils';
import { ModifiedParamsBadge } from './ModifiedParamsBadge';
import { PolicyBoundsIndicator } from './PolicyBoundsIndicator';
import { ManualWorkspace } from './ManualWorkspace';
import { HITLReviewCard } from './HITLReviewCard';
import { PolicyExplorer } from './PolicyExplorer';
import { PortfolioIntelligence } from './PortfolioIntelligence';
import { LiveUnderwritingResults } from './LiveUnderwritingResults';
import { StageProgressBar } from './StageProgressBar';
import { useLoanOfficerWorkflow } from './useLoanOfficerWorkflow';
import TechRail from './TechRail';

function AgentRailHeader({ agentStats, elapsedSeconds, hitlReached, applicationId }) {
  const isActive = applicationId && agentStats.totalReceived > 0;
  return (
    <div style={{
      padding: '8px 10px',
      borderBottom: '1px solid var(--border-dim)',
      background: 'var(--bg-base)',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-display)', fontWeight: 700,
            fontSize: 11, color: 'var(--text-primary)',
            textTransform: 'uppercase', letterSpacing: '0.5px',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            AI Agent Layer
            {hitlReached && (
              <span style={{
                fontSize: 7, fontWeight: 700, fontFamily: 'var(--font-mono)',
                padding: '1px 5px', borderRadius: 3,
                background: 'var(--hitl-amber)', color: '#fff',
              }}>
                AWAITING REVIEW
              </span>
            )}
          </div>
          <div style={{
            fontSize: 9, color: 'var(--text-dim)',
            fontFamily: 'var(--font-mono)', marginTop: 1,
          }}>
            LangGraph orchestration
          </div>
        </div>
        {/* Live pulse */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: hitlReached ? 'var(--hitl-amber)' : isActive ? 'var(--success)' : 'var(--border-base)',
            boxShadow: hitlReached ? '0 0 6px var(--hitl-amber)' : isActive ? '0 0 6px var(--success)' : 'none',
            animation: hitlReached ? 'none' : isActive ? 'pulse 1.5s infinite' : 'none',
          }} />
        </div>
      </div>
      {/* Aggregate stats */}
      {isActive && (
        <div aria-live="polite" style={{
          marginTop: 4, fontSize: 8, fontFamily: 'var(--font-mono)',
          color: 'var(--text-dim)', fontWeight: 600,
          display: 'flex', gap: 4, alignItems: 'center',
        }}>
          <span>3 agents</span>
          <span style={{ color: 'var(--border-base)' }}>{'\u00b7'}</span>
          <span>{agentStats.totalReceived} actions</span>
          {elapsedSeconds > 0 && (
            <>
              <span style={{ color: 'var(--border-base)' }}>{'\u00b7'}</span>
              <span>{elapsedSeconds < 60 ? `${elapsedSeconds}s` : `${Math.floor(elapsedSeconds / 60)}m ${elapsedSeconds % 60}s`}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const AGENT_TO_NODE = {
  supervisor: 'supervisor',
  doc_verifier: 'docVerifier',
  credit_puller: 'creditPuller',
  loan_app_agent: 'appAgent',
  loan_app: 'appAgent',
  underwriter: 'underwriter',
  hitl_gate: 'hitlGate',
};

export default function LoanOfficerDashboard({ active = true }) {
  const { toasts, addToast, removeToast } = useToasts();
  const [lastCorrelatedEvent, setLastCorrelatedEvent] = useState(null);
  const [agentStats, setAgentStats] = useState({ totalReceived: 0 });
  const [canvasHighlightNode, setCanvasHighlightNode] = useState(null);
  const [showWorkflowModal, setShowWorkflowModal] = useState(false);
  const highlightTimerRef = useRef(null);

  // Cleanup highlight timer on unmount
  useEffect(() => () => {
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
  }, []);

  const {
    selectedApp, setSelectedApp,
    workflowPhase, workflowStage,
    hitlReached, hitlStartTime, hitlResolutionTime, approved,
    planSettings,
    approvalDetails,
    liveAgentOutput,
    elapsedSeconds,
    liveApplications,
    selectedAppDetail,
    dashboardStats,
    stageTimestamps,
    handleProceed,
    handleManual,
    handleApprove,
    handleDecline,
    handleAgentEvent,
  } = useLoanOfficerWorkflow(addToast, active);

  const selectedAppData = liveApplications.find((a) => a.application_id === selectedApp);
  const appName = getAppDisplayName(selectedAppDetail, selectedAppData);
  const currentWorkflow = WORKFLOW_STAGES[workflowStage] || WORKFLOW_STAGES[WORKFLOW_STAGES.length - 1];
  const selectedAppStatus = selectedAppData?.status;

  const statusBadge = () => {
    if (!selectedApp) return null;
    if (approved && approvalDetails?.mode === 'declined') return { label: 'Declined', bg: 'var(--danger-dim)', color: 'var(--danger)' };
    if (approved) return { label: 'Approved', bg: 'var(--success-dim)', color: 'var(--success)' };
    if (hitlReached) return { label: 'Awaiting Review', bg: 'var(--hitl-amber-dim)', color: 'var(--hitl-amber)' };
    if (selectedAppStatus === 'error') return { label: 'Error', bg: 'var(--danger-dim)', color: 'var(--danger)' };
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
        gridTemplateColumns: `repeat(${Math.min(dashboardStats.length, 7)}, 1fr)`,
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
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 800, color: s.color, transition: 'all 0.5s cubic-bezier(0.33, 1, 0.68, 1)' }}>{s.value}</span>
              {s.trend && (
                <span style={{
                  fontSize: 12, fontWeight: 700,
                  color: s.trend === '\u2191'
                    ? (s.label === 'Pending Reviews' ? 'var(--danger)' : 'var(--success)')
                    : (s.label === 'Pending Reviews' ? 'var(--success)' : 'var(--text-dim)'),
                  animation: 'slideDown 0.3s ease-out',
                }}>
                  {s.trend}
                </span>
              )}
            </div>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {workflowPhase === 'executing' && !approved && elapsedSeconds > 0 && (
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                  color: 'var(--agent-cyan)',
                }}>
                  {Math.floor(elapsedSeconds / 60)}:{String(elapsedSeconds % 60).padStart(2, '0')}
                </span>
              )}
              {badge && (
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 12,
                  background: badge.bg, color: badge.color,
                }}>
                  {badge.label}
                </span>
              )}
            </div>
          </div>

          {/* Compact detail bar during executing/HITL */}
          {selectedApp && selectedAppDetail && (workflowPhase === 'executing' || hitlReached) && (
            <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--border-dim)', background: 'var(--bg-base)' }}>
              <ApplicationDetail appDetail={selectedAppDetail} compact />
            </div>
          )}

          {/* Stage Progress Bar */}
          {selectedApp && (workflowPhase === 'executing' || workflowPhase === 'preview') && (
            <StageProgressBar
              stage={workflowPhase === 'preview' ? -1 : workflowStage}
              hitlReached={hitlReached}
              approved={approved}
              approvalDetails={approvalDetails}
              stageTimestamps={stageTimestamps}
            />
          )}

          {/* Intent Preview (pre-action) */}
          {selectedApp && workflowPhase === 'preview' && (
            <div style={{ display: 'flex', flexDirection: 'column', borderBottom: '1px solid var(--border-dim)', background: 'var(--bg-base)', overflowY: 'auto', maxHeight: '60vh' }}>
              {selectedAppDetail && (
                <ApplicationDetail appDetail={selectedAppDetail} />
              )}
              <div style={{ padding: spacing[3] }}>
                <IntentPreview applicationId={selectedApp} onProceed={handleProceed} onManual={handleManual} />
              </div>
            </div>
          )}

          {/* Workflow status bar + modal */}
          {selectedApp && (workflowPhase === 'executing' || workflowPhase === 'preview') ? (
            <>
              <div style={{
                padding: '10px 14px',
                borderBottom: '1px solid var(--border-dim)',
                background: 'var(--bg-base)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {workflowPhase === 'executing' && !approved && (
                    <div style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: hitlReached ? 'var(--hitl-amber)' : 'var(--agent-cyan)',
                      boxShadow: `0 0 6px ${hitlReached ? 'var(--hitl-amber)' : 'var(--agent-cyan)'}`,
                      animation: 'pulse 1.5s infinite', flexShrink: 0,
                    }} />
                  )}
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                    {workflowPhase === 'preview'
                      ? 'Execution Plan'
                      : hitlReached
                        ? 'HITL Gate — Awaiting Decision'
                        : `Stage: ${currentWorkflow.label}`
                    }
                  </span>
                  {workflowPhase === 'executing' && (() => {
                    const parts = [];
                    if (liveAgentOutput.primary_credit_score) parts.push(`Credit ${liveAgentOutput.primary_credit_score}`);
                    if (liveAgentOutput.document_count) parts.push(`${liveAgentOutput.document_count} docs`);
                    if (liveAgentOutput.risk_score != null) parts.push(`Risk ${liveAgentOutput.risk_score}/100`);
                    if (liveAgentOutput.gds_ratio != null) parts.push(`GDS ${(liveAgentOutput.gds_ratio * 100).toFixed(1)}%`);
                    return parts.length > 0 ? (
                      <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                        {parts.join(' \u00b7 ')}
                      </span>
                    ) : null;
                  })()}
                </div>
                <button
                  type="button"
                  onClick={() => setShowWorkflowModal(true)}
                  style={{
                    padding: '4px 12px', borderRadius: 6,
                    border: '1px solid var(--border-base)',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-secondary)',
                    fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-display)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  View Workflow
                </button>
              </div>

              {/* Workflow Canvas Modal */}
              <Modal
                open={showWorkflowModal}
                setOpen={setShowWorkflowModal}
                size="large"
              >
                {showWorkflowModal && <div style={{ position: 'relative', height: '70vh', minHeight: 400 }}>
                  <WorkflowCanvas
                    activeNodes={workflowPhase === 'preview' ? [] : currentWorkflow.activeNodes}
                    activeEdges={workflowPhase === 'preview' ? [] : currentWorkflow.activeEdges}
                    pulsingNodes={workflowPhase === 'preview' ? [] : hitlReached ? ['hitlGate'] : currentWorkflow.pulsingNodes}
                    currentScene={workflowPhase === 'preview' ? 'origination' : currentWorkflow.currentScene}
                    highlightNode={canvasHighlightNode}
                    liveAgentOutput={liveAgentOutput}
                    hitlActive={hitlReached && !approved}
                    hitlStartTime={hitlStartTime}
                    hitlResolution={approved && hitlReached ? (approvalDetails?.mode === 'declined' ? 'declined' : 'approved') : null}
                    hitlResolutionTime={hitlResolutionTime}
                  />

                  {workflowPhase === 'executing' && (
                    <PolicyBoundsIndicator exceeded={hitlReached} />
                  )}

                  {workflowPhase === 'executing' && (
                    <LiveUnderwritingResults data={liveAgentOutput} />
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
                </div>}
              </Modal>
            </>
          ) : selectedApp && workflowPhase === 'manual' ? (
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <ManualWorkspace appDetail={selectedAppDetail} queueData={selectedAppData} onApprove={handleApprove} onDecline={handleDecline} addToast={addToast} />
            </div>
          ) : !selectedApp ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: spacing[4], flex: 1 }}>
              <div style={{
                padding: spacing[4], maxWidth: 560,
                border: '1px solid var(--border-dim)', borderRadius: 12,
                background: 'var(--bg-surface)',
              }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15, color: 'var(--text-primary)', marginBottom: 4 }}>
                  Agentic Lending Pipeline
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 16 }}>
                  LangGraph orchestration with MongoDB Atlas data layer
                </div>

                {/* 3-column architecture */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
                  {[
                    {
                      stage: 'Origination',
                      color: 'var(--agent-cyan)',
                      agents: [
                        { name: 'Doc Verifier', desc: 'Validates 10+ doc types' },
                        { name: 'Credit Puller', desc: 'Bureau pull (parallel)' },
                        { name: 'Loan App Agent', desc: 'LLM synthesis (Claude)' },
                      ],
                    },
                    {
                      stage: 'Underwriting',
                      color: 'var(--tool-blue)',
                      agents: [
                        { name: 'Underwriter', desc: '7-stage aggregation' },
                        { name: 'OSFI B-20', desc: 'Stress test + risk tiers' },
                        { name: 'Policy RAG', desc: 'Atlas Vector Search' },
                      ],
                    },
                    {
                      stage: 'Decision',
                      color: 'var(--hitl-amber)',
                      agents: [
                        { name: 'HITL Gate', desc: 'LangGraph interrupt()' },
                        { name: 'Auto-approve', desc: 'Tier A, <$500K' },
                        { name: 'Escalate', desc: 'GDS>36%, TDS>41%' },
                      ],
                    },
                  ].map((col) => (
                    <div key={col.stage} style={{
                      padding: '10px 10px', borderRadius: 8,
                      background: 'var(--bg-base)',
                      border: '1px solid var(--border-dim)',
                      borderTop: `2px solid ${col.color}`,
                    }}>
                      <div style={{
                        fontSize: 9, fontWeight: 700, color: col.color,
                        textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8,
                      }}>
                        {col.stage}
                      </div>
                      {col.agents.map((a) => (
                        <div key={a.name} style={{ marginBottom: 4 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                            {a.name}
                          </div>
                          <div style={{ fontSize: 9, color: 'var(--text-dim)', lineHeight: 1.3 }}>
                            {a.desc}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                {/* Capability badges */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                  {['6 Pipeline Agents', '1 Application Agent', '7 Intervention Types', '7 Generative UI Components', 'Atlas Vector Search', 'OSFI B-20 Compliance'].map((cap) => (
                    <span key={cap} style={{
                      fontSize: 9, fontWeight: 600, fontFamily: 'var(--font-mono)',
                      padding: '2px 8px', borderRadius: 10,
                      background: 'var(--bg-raised)', border: '1px solid var(--border-dim)',
                      color: 'var(--text-secondary)',
                    }}>
                      {cap}
                    </span>
                  ))}
                </div>

                {/* CTA */}
                {(() => {
                  const pendingCount = liveApplications.filter(
                    (a) => ['submitted', 'review', 'pending_review', 'processing', 'underwriting'].includes(a.status)
                  ).length;
                  return (
                    <div style={{ textAlign: 'center' }}>
                      {pendingCount > 0 ? (
                        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--mongo)' }}>
                          {pendingCount} application{pendingCount > 1 ? 's' : ''} in queue — select one to begin
                        </div>
                      ) : (
                        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                          Submit an application from the Borrower Portal to get started
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : null}

          {/* HITL Review panel */}
          {selectedApp && hitlReached && !approved && (
            <div style={{ padding: spacing[3], borderTop: '1px solid var(--border-dim)', background: 'var(--bg-base)', overflowY: 'auto', maxHeight: '40vh' }}>
              <HITLReviewCard
                applicationId={selectedApp}
                appDetail={selectedAppDetail}
                queueData={selectedAppData}
                onApprove={handleApprove}
                onDecline={handleDecline}
                addToast={addToast}
                liveAgentOutput={liveAgentOutput}
              />
            </div>
          )}

          {/* Decision Summary */}
          {selectedApp && approved && (
            <div style={{ padding: spacing[3], borderTop: '1px solid var(--border-dim)', background: 'var(--bg-base)', overflowY: 'auto', maxHeight: '40vh' }}>
              <DecisionSummary
                applicationId={selectedApp}
                appDetail={selectedAppDetail}
                approvalDetails={approvalDetails}
                appName={appName}
                onClose={() => setSelectedApp(null)}
              />
            </div>
          )}
        </div>

        {/* Agent Rail — "What the AI is doing" */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          width: 320,
          minWidth: 240,
          flexShrink: 0,
          overflow: 'hidden',
          borderLeft: `3px solid ${hitlReached && !approved ? 'var(--hitl-amber)' : 'var(--agent-cyan)'}`,
          transition: 'border-color 400ms ease',
        }}>
          <AgentRailHeader
            agentStats={agentStats}
            elapsedSeconds={elapsedSeconds}
            hitlReached={hitlReached && !approved}
            applicationId={selectedApp}
          />
          <AgentActivityLog
            onEvent={(entry) => {
              handleAgentEvent(entry);
              setLastCorrelatedEvent({ ...entry, _correlationTs: Date.now() });
              // Canvas highlight sync
              const agentName = (entry.agent || '').toLowerCase();
              const nodeId = AGENT_TO_NODE[agentName] || (agentName.includes('underwrit') ? 'underwriter' : agentName.includes('loan_app') ? 'appAgent' : agentName.includes('hitl') ? 'hitlGate' : null);
              if (nodeId) {
                setCanvasHighlightNode(nodeId);
                if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
                highlightTimerRef.current = setTimeout(() => setCanvasHighlightNode(null), 1500);
              }
            }}
            applicationId={selectedApp}
            applicationStatus={selectedAppDetail?.status}
            onStatsChange={setAgentStats}
            hitlReached={hitlReached && !approved}
            liveAgentOutput={liveAgentOutput}
          />
          <PolicyExplorer autoQuery={hitlReached && !approved ? 'GDS TDS stress test mortgage thresholds' : ''} />
          <PortfolioIntelligence />
        </div>

        {/* Tech Rail — "What MongoDB is doing" */}
        <TechRail
          applicationId={selectedApp}
          liveAgentOutput={liveAgentOutput}
          lastCorrelatedEvent={lastCorrelatedEvent}
        />
      </div>

      <NotificationToast toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
