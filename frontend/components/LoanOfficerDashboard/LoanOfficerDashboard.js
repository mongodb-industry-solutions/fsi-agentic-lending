"use client";

import { useState } from 'react';
import { spacing } from '@leafygreen-ui/tokens';
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

export default function LoanOfficerDashboard({ active = true }) {
  const { toasts, addToast, removeToast } = useToasts();
  const [lastCorrelatedEvent, setLastCorrelatedEvent] = useState(null);
  const [agentStats, setAgentStats] = useState({ totalReceived: 0 });

  const {
    selectedApp, setSelectedApp,
    workflowPhase, workflowStage,
    hitlReached, approved,
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

          {/* Workflow Canvas + overlays */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: '35vh' }}>
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
                        : (() => {
                            const parts = [];
                            if (liveAgentOutput.primary_credit_score) parts.push(`Credit score ${liveAgentOutput.primary_credit_score}`);
                            if (liveAgentOutput.document_count) parts.push(`${liveAgentOutput.document_count} docs verified`);
                            if (liveAgentOutput.risk_score != null) parts.push(`Risk ${liveAgentOutput.risk_score}/100`);
                            if (liveAgentOutput.gds_ratio != null) parts.push(`GDS ${(liveAgentOutput.gds_ratio * 100).toFixed(1)}%`);
                            if (parts.length > 0) {
                              return `${parts.join(' \u00b7 ')}. Running ${currentWorkflow.label.toLowerCase()} stage...`;
                            }
                            return `Agents are processing this application through the ${currentWorkflow.label.toLowerCase()} stage.`;
                          })()
                  }
                </div>
              </>
            ) : selectedApp && workflowPhase === 'manual' ? (
              <ManualWorkspace appDetail={selectedAppDetail} queueData={selectedAppData} onApprove={handleApprove} onDecline={handleDecline} addToast={addToast} />
            ) : !selectedApp ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <div style={{
                  textAlign: 'center', padding: spacing[5],
                  border: '2px dashed var(--border-dim)', borderRadius: 12,
                  background: 'var(--bg-void)', maxWidth: 380,
                }}>
                  {/* Mini pipeline sketch */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 16 }}>
                    {['Origination', 'Underwriting', 'HITL'].map((label, i) => (
                      <div key={label} style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div style={{
                            width: 24, height: 24, borderRadius: '50%',
                            border: '2px dashed var(--border-base)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 9, fontWeight: 700, color: 'var(--text-dim)',
                          }}>
                            {i + 1}
                          </div>
                          <div style={{ fontSize: 8, color: 'var(--text-dim)', marginTop: 3, fontFamily: 'var(--font-display)', fontWeight: 600 }}>
                            {label}
                          </div>
                        </div>
                        {i < 2 && (
                          <div style={{ width: 28, height: 1, background: 'var(--border-base)', margin: '0 4px', marginBottom: 16 }} />
                        )}
                      </div>
                    ))}
                  </div>

                  {(() => {
                    const pendingCount = liveApplications.filter(
                      (a) => ['submitted', 'review', 'pending_review', 'processing', 'underwriting'].includes(a.status)
                    ).length;
                    return (
                      <>
                        {pendingCount > 0 && (
                          <div style={{
                            fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700,
                            color: 'var(--mongo)', marginBottom: 4,
                          }}>
                            {pendingCount} application{pendingCount > 1 ? 's' : ''} in queue
                          </div>
                        )}
                        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-dim)', fontSize: 13 }}>
                          {pendingCount > 0 ? 'Select one from the queue to begin' : 'No applications in queue'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                          {pendingCount === 0 ? 'Submit an application from the Borrower Portal to get started' : 'Review the plan, adjust parameters, then run the agent pipeline'}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            ) : null}
          </div>

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
            }}
            applicationId={selectedApp}
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
