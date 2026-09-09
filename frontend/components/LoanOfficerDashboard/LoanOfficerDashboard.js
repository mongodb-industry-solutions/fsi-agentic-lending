"use client";

import { useState, useRef, useEffect } from 'react';
import { spacing } from '@leafygreen-ui/tokens';
import Avatar from 'boring-avatars';
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
import { PipelineStepTracker } from './PipelineStepTracker';
import { useLoanOfficerWorkflow } from './useLoanOfficerWorkflow';
import TechRail from './TechRail';
import ApplicationTimingCard from './ApplicationTimingCard';
import SeedApplicationDetail from './SeedApplicationDetail';
import { getDemoSeedDetail } from '../../lib/data/seedDemoApps';

const OFFICER_AVATAR_COLORS = ['#00684A', '#00ED64', '#0498EC', '#016BF8', '#B45AF2'];

function OfficerIdentityCard({ officer }) {
  const name = officer?.full_name || 'Loan Officer';
  const title = officer?.title || 'Loan Officer';
  const nmls = officer?.nmls_id;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px',
      borderBottom: '1px solid var(--border-dim)',
      background: 'var(--bg-surface)',
      flexShrink: 0,
    }}>
      <Avatar size={34} name={officer?.avatar_seed || name} variant="beam" colors={OFFICER_AVATAR_COLORS} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13,
          color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {name}
        </div>
        <div style={{
          fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 5, marginTop: 1,
        }}>
          <span>{title}</span>
          {nmls && (
            <>
              <span style={{ color: 'var(--border-base)' }}>{'·'}</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>NMLS #{nmls}</span>
            </>
          )}
        </div>
      </div>
      <span style={{
        fontSize: 7, fontWeight: 700, fontFamily: 'var(--font-mono)',
        padding: '2px 6px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.5px',
        background: 'var(--success-dim)', color: 'var(--success)', flexShrink: 0,
      }}>
        On shift
      </span>
    </div>
  );
}

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
  const [diagramOpen, setDiagramOpen] = useState(false);
  const [showPipeline, setShowPipeline] = useState(false);
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
    officer,
    stageTimestamps,
    handleProceed,
    handleManual,
    handleApprove,
    handleDecline,
    handleAgentEvent,
    activityEvents,
    streamConnected,
    streamError,
  } = useLoanOfficerWorkflow(addToast, active);

  const selectedAppData = liveApplications.find((a) => a.application_id === selectedApp);
  const appName = getAppDisplayName(selectedAppDetail, selectedAppData);
  const currentWorkflow = WORKFLOW_STAGES[workflowStage] || WORKFLOW_STAGES[WORKFLOW_STAGES.length - 1];
  const selectedAppStatus = selectedAppData?.status;
  // Decorative APP-DEMO-* selection: renders the hardcoded seed detail and skips
  // the timing card (no backend record). `selectedAppData` resolves seeds because
  // the hook exposes `applicationsForDisplay` (seeds merged) as `liveApplications`.
  const isSeedSelection = !!selectedAppData?.demoSeed;

  const statusBadge = () => {
    if (!selectedApp) return null;
    // Seeds badge by their own queue status so e.g. the funded seed reads
    // "Funded" rather than the derived "Approved".
    if (isSeedSelection) {
      const seedBadges = {
        processing: { label: 'Processing', bg: 'var(--agent-cyan-dim)', color: 'var(--agent-cyan)' },
        review: { label: 'Awaiting Review', bg: 'var(--hitl-amber-dim)', color: 'var(--hitl-amber)' },
        funded: { label: 'Funded', bg: 'var(--success-dim)', color: 'var(--success)' },
      };
      return seedBadges[selectedAppStatus] || null;
    }
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
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17 }}>
                {selectedApp ? (selectedAppData?.name || appName) : 'Select an application'}
              </span>
              {selectedApp && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)' }}>
                  {selectedApp}
                </span>
              )}
              <ModifiedParamsBadge settings={planSettings} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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

          {/* Persistent total-time card — pinned above the scroll region so it
              survives decision and approval (unlike the old header timer) */}
          {selectedApp && !isSeedSelection && (
            <ApplicationTimingCard
              applicationId={selectedApp}
              detail={selectedAppDetail}
              status={selectedAppStatus}
              approved={approved}
            />
          )}

          {/* Main scrollable content region */}
          {selectedApp && isSeedSelection ? (
            <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-base)' }}>
              <SeedApplicationDetail
                app={getDemoSeedDetail(selectedApp)}
                officerName={officer?.full_name || 'Loan Officer'}
              />
            </div>
          ) : selectedApp && workflowPhase === 'preview' ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflowY: 'auto', background: 'var(--bg-base)' }}>
              {selectedAppDetail && (
                <ApplicationDetail appDetail={selectedAppDetail} />
              )}
              <div style={{ padding: spacing[3] }}>
                <IntentPreview applicationId={selectedApp} onProceed={handleProceed} onManual={handleManual} />
              </div>
            </div>
          ) : selectedApp && workflowPhase === 'executing' ? (() => {
            // Action-first: once a decision is pending (HITL) or made (approved),
            // that hero leads and the pipeline tracker collapses beneath it. While
            // the pipeline is still running, the tracker is the main content.
            const decided = (hitlReached && !approved) || approved;
            const tracker = (
              <PipelineStepTracker
                stage={workflowStage}
                hitlReached={hitlReached}
                approved={approved}
                approvalDetails={approvalDetails}
                stageTimestamps={stageTimestamps}
                liveAgentOutput={liveAgentOutput}
                activityEvents={activityEvents}
                onViewDiagram={() => setDiagramOpen(true)}
              />
            );
            return (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflowY: 'auto', background: 'var(--bg-base)' }}>
              {/* Key action — top and center */}
              {hitlReached && !approved && (
                <div style={{ padding: spacing[3] }}>
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
              {approved && (
                <div style={{ padding: spacing[3] }}>
                  <DecisionSummary
                    applicationId={selectedApp}
                    appDetail={selectedAppDetail}
                    approvalDetails={approvalDetails}
                    appName={appName}
                    officer={officer}
                    onClose={() => setSelectedApp(null)}
                  />
                </div>
              )}

              {/* Pipeline progress — primary while running, collapsed once decided */}
              {decided ? (
                <div style={{ padding: `0 ${spacing[3]}px ${spacing[3]}px` }}>
                  <button
                    type="button"
                    onClick={() => setShowPipeline((p) => !p)}
                    aria-expanded={showPipeline}
                    style={{
                      width: '100%', padding: '8px 12px',
                      background: 'var(--bg-raised)', border: '1px solid var(--border-dim)', borderRadius: 6,
                      cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'var(--font-display)',
                    }}
                  >
                    <span>Pipeline progress</span>
                    <span style={{ transform: showPipeline ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', display: 'inline-block' }}>{'▾'}</span>
                  </button>
                  {showPipeline && <div style={{ marginTop: spacing[2] }}>{tracker}</div>}
                </div>
              ) : tracker}
            </div>
            );
          })() : selectedApp && workflowPhase === 'manual' ? (
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <ManualWorkspace appDetail={selectedAppDetail} queueData={selectedAppData} onApprove={handleApprove} onDecline={handleDecline} addToast={addToast} />
            </div>
          ) : !selectedApp ? (
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: spacing[4], flex: 1, minHeight: 0, overflowY: 'auto' }}>
              <div style={{
                padding: spacing[4], maxWidth: 720, width: '100%',
                border: '1px solid var(--border-dim)', borderRadius: 12,
                background: 'var(--bg-surface)',
                display: 'flex', flexDirection: 'column',
                marginTop: spacing[3],
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
                  {['6 Pipeline Agents', '1 Application Agent', '7 Intervention Types', '2 Generative UI Components', 'Atlas Vector Search', 'OSFI B-20 Compliance'].map((cap) => (
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
          <OfficerIdentityCard officer={officer} />
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
            activityEvents={activityEvents}
            streamConnected={streamConnected}
            streamError={streamError}
          />
          <PolicyExplorer autoQuery={hitlReached && !approved ? 'GDS TDS stress test mortgage thresholds' : ''} />
          <PortfolioIntelligence />
        </div>

        {/* Tech Rail — "What MongoDB is doing" */}
        <TechRail
          applicationId={selectedApp}
          liveAgentOutput={liveAgentOutput}
          lastCorrelatedEvent={lastCorrelatedEvent}
          activityEvents={activityEvents}
          streamConnected={streamConnected}
        />
      </div>

      {/* Pipeline diagram — full node graph, opened on demand from the step tracker */}
      <Modal open={diagramOpen} setOpen={setDiagramOpen} size="large">
        <div style={{
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15,
          color: 'var(--text-primary)', marginBottom: 4,
        }}>
          Pipeline Diagram
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12 }}>
          {selectedApp ? `Stage: ${currentWorkflow.label}` : 'LangGraph orchestration'}
        </div>
        <div style={{
          position: 'relative', height: '62vh', minHeight: 360,
          borderRadius: 8, border: '1px solid var(--border-dim)',
          background: 'var(--bg-surface)', overflow: 'hidden',
        }}>
          <WorkflowCanvas
            fit="rail"
            activeNodes={currentWorkflow.activeNodes}
            activeEdges={currentWorkflow.activeEdges}
            pulsingNodes={hitlReached ? ['hitlGate'] : currentWorkflow.pulsingNodes}
            currentScene={currentWorkflow.currentScene}
            highlightNode={canvasHighlightNode}
            liveAgentOutput={liveAgentOutput}
            hitlActive={hitlReached && !approved}
            hitlStartTime={hitlStartTime}
            hitlResolution={approved && hitlReached ? (approvalDetails?.mode === 'declined' ? 'declined' : 'approved') : null}
            hitlResolutionTime={hitlResolutionTime}
          />
          <PolicyBoundsIndicator exceeded={hitlReached} />
        </div>
      </Modal>

      <NotificationToast toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
