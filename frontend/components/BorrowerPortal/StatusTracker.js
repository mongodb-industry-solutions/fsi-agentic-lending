"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { spacing } from '@leafygreen-ui/tokens';
import { apiSSE, apiGet } from '../../lib/api';
import { STAGES, STATUS_TO_STAGE, mapEventToStageIdx } from './statusTrackerConstants';
import { SavingsSummary } from './SavingsSummary';
import { TimelineStageCard } from './TimelineStageCard';

function DeclineCard({ stageContext, onOpenChat }) {
  const reasoning = stageContext.decisionReasoning || '';
  const r = reasoning.toLowerCase();

  // Map decline keywords to actionable guidance
  const guidance = [];
  if (r.includes('stress test')) guidance.push('Consider increasing your down payment or choosing a less expensive property to improve your stress test results.');
  if (r.includes('income') || r.includes('zero')) guidance.push('Ensure all income documentation is uploaded and accurate, including employment letters, pay stubs, and tax notices.');
  if (r.includes('credit')) guidance.push('Review your credit report for errors and consider resolving any outstanding debts before reapplying.');
  if (r.includes('gds') || r.includes('tds') || r.includes('debt')) guidance.push('Reducing existing monthly debt payments will improve your debt service ratios.');
  if (r.includes('risk') && r.includes('threshold')) guidance.push('Your risk profile exceeded the automated approval threshold. A loan officer may be able to review your case manually.');
  if (guidance.length === 0) guidance.push('Contact a loan officer for personalized guidance on your application.');

  return (
    <div style={{
      padding: spacing[3],
      background: 'var(--bg-surface)',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--danger)',
      borderLeft: '4px solid var(--danger)',
      marginTop: spacing[3],
      animation: 'cardEnter 0.4s cubic-bezier(0.33, 1, 0.68, 1) both',
    }}>
      <div style={{
        fontFamily: 'var(--font-display)', fontWeight: 700,
        fontSize: 13, color: 'var(--danger)', marginBottom: spacing[2],
      }}>
        Application Not Approved
      </div>

      {/* Decline reasoning */}
      {reasoning && (
        <div style={{
          padding: '8px 10px', marginBottom: spacing[2],
          background: 'var(--danger-dim)', borderRadius: 'var(--radius-sm)',
          fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.5,
        }}>
          {reasoning}
        </div>
      )}

      {/* Key metrics at decline */}
      {(typeof stageContext.riskScore === 'number' || typeof stageContext.gds === 'number') && (
        <div style={{ display: 'flex', gap: spacing[2], marginBottom: spacing[2], flexWrap: 'wrap' }}>
          {typeof stageContext.riskScore === 'number' && (
            <div style={{ padding: '4px 8px', background: 'var(--bg-raised)', borderRadius: 4, fontSize: 9 }}>
              <span style={{ color: 'var(--text-dim)' }}>Risk Score: </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--danger)' }}>{stageContext.riskScore}/100</span>
            </div>
          )}
          {typeof stageContext.gds === 'number' && (
            <div style={{ padding: '4px 8px', background: 'var(--bg-raised)', borderRadius: 4, fontSize: 9 }}>
              <span style={{ color: 'var(--text-dim)' }}>GDS: </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{(stageContext.gds * 100).toFixed(1)}%</span>
            </div>
          )}
          {typeof stageContext.tds === 'number' && (
            <div style={{ padding: '4px 8px', background: 'var(--bg-raised)', borderRadius: 4, fontSize: 9 }}>
              <span style={{ color: 'var(--text-dim)' }}>TDS: </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{(stageContext.tds * 100).toFixed(1)}%</span>
            </div>
          )}
        </div>
      )}

      {/* Actionable guidance */}
      <div style={{
        fontSize: 10, fontWeight: 700, color: 'var(--text-primary)',
        textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6,
      }}>
        What You Can Do
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: spacing[3] }}>
        {guidance.map((tip, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, fontSize: 10, lineHeight: 1.5 }}>
            <span style={{
              fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 11,
              color: 'var(--mongo)', minWidth: 16,
            }}>
              {i + 1}
            </span>
            <span style={{ color: 'var(--text-secondary)' }}>{tip}</span>
          </div>
        ))}
      </div>

      {/* CTA */}
      {onOpenChat && (
        <button
          type="button"
          onClick={onOpenChat}
          style={{
            width: '100%', padding: '10px 16px',
            background: 'var(--mongo)', color: '#fff',
            border: 'none', borderRadius: 'var(--radius-md)',
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Speak with AI Assistant
        </button>
      )}
    </div>
  );
}

export default function StatusTracker({ onNotification, applicationId, applicationData, onOpenChat }) {
  const [activeStage, setActiveStage] = useState(0);
  const [timestamps, setTimestamps] = useState([]);
  const [expandedStage, setExpandedStage] = useState(null);
  const [sseConnected, setSseConnected] = useState(false);
  const [isDeclined, setIsDeclined] = useState(false);
  const [stampAnimated, setStampAnimated] = useState(false);
  const [activityEvents, setActivityEvents] = useState({});
  const [feedCollapsed, setFeedCollapsed] = useState(false);
  const [timelineCtx, setTimelineCtx] = useState(null);
  const stageContextRef = useRef({});
  const stageIdxRef = useRef(0);
  const activitySourceRef = useRef(null);

  const sendNotification = useCallback((stage, time, extra) => {
    if (onNotification) onNotification({ stage, time, ...extra });
  }, [onNotification]);

  const applyStatus = useCallback((status) => {
    if (!status) return;
    if (status === 'declined') setIsDeclined(true);
    const targetIdx = STATUS_TO_STAGE[status];
    if (targetIdx !== undefined && targetIdx >= 0 && targetIdx > stageIdxRef.current) {
      const now = new Date();
      const newTimestamps = [];
      while (stageIdxRef.current < targetIdx) {
        stageIdxRef.current++;
        newTimestamps.push(now);
        const s = STAGES[stageIdxRef.current];
        const ctx = stageContextRef.current;
        sendNotification({ ...s, type: s.getType ? s.getType(ctx) : 'clean', detail: s.getDetail ? s.getDetail(ctx) : '' }, now);
      }
      setActiveStage(targetIdx);
      setTimestamps((prev) => [...prev, ...newTimestamps]);
    }
  }, [sendNotification]);

  // SSE connection for real-time backend status, with REST polling fallback
  useEffect(() => {
    if (!applicationId) return;
    setIsDeclined(false);
    stageIdxRef.current = 0;
    setActiveStage(0);
    setTimestamps([]);
    setActivityEvents({});
    let sseAlive = false;
    let pollInterval = null;

    const source = apiSSE(
      `/applications/${applicationId}/status`,
      (event) => {
        sseAlive = true;
        setSseConnected(true);
        if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }

        if (event.type === 'status' && event.status) {
          if (process.env.NODE_ENV === 'development') console.log('[StatusTracker] Real-time status:', event.status);
          applyStatus(event.status);
        }
      }
    );

    apiGet(`/applications/${applicationId}`).then((app) => {
      if (app?.status) {
        setSseConnected(true);
        applyStatus(app.status);
      }
    }).catch(() => {});

    pollInterval = setInterval(() => {
      if (sseAlive) { clearInterval(pollInterval); pollInterval = null; return; }
      apiGet(`/applications/${applicationId}`).then((app) => {
        if (app?.status) {
          setSseConnected(true);
          applyStatus(app.status);
        }
      }).catch(() => {});
    }, 5000);

    return () => {
      source?.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [applicationId, applyStatus]);

  // SSE: agent activity feed
  useEffect(() => {
    if (!applicationId) return;

    const source = apiSSE(
      `/applications/${applicationId}/activity`,
      (data) => {
        if (data.type === 'connected' || data.type === 'error') return;

        const stageIdx = mapEventToStageIdx(data, stageIdxRef.current);
        if (stageIdx === null) return;

        const stageId = STAGES[stageIdx]?.id || 'received';
        setActivityEvents((prev) => {
          const existing = prev[stageId] || [];
          return { ...prev, [stageId]: [...existing, data] };
        });
      },
      () => {}
    );

    activitySourceRef.current = source;
    return () => {
      if (activitySourceRef.current) activitySourceRef.current.close();
    };
  }, [applicationId]);

  // Fetch timeline context from backend — debounced re-fetch as stages advance
  useEffect(() => {
    if (!applicationId) return;
    let ignore = false;
    const timer = setTimeout(() => {
      apiGet(`/applications/${applicationId}/timeline-context`).then(
        (data) => { if (!ignore && data) setTimelineCtx(data); }
      ).catch(() => {});
    }, activeStage === 0 ? 0 : 250);
    return () => { ignore = true; clearTimeout(timer); };
  }, [applicationId, activeStage]);

  // Build context object for stage template functions
  const stageContext = useMemo(() => {
    const app = timelineCtx?.application || {};
    const interventions = timelineCtx?.interventions || [];
    const summary = timelineCtx?.activity_summary || {};

    const docTypes = ['missing_document'];
    const creditTypes = ['credit_score_required', 'credit_data_unavailable'];
    const riskTypes = ['stress_test_failure', 'income_data_required'];
    const actionTypes = ['additional_info_required'];

    const active = interventions.filter((i) => i.status !== 'superseded');

    return {
      appId: applicationId,
      loanAmount: app.loan_amount,
      product: app.product,
      riskScore: app.risk_score,
      riskTier: app.risk_tier,
      gds: app.gds_ratio,
      tds: app.tds_ratio,
      creditScore: app.primary_credit_score,
      decisionReasoning: app.decision_reasoning,
      docCount: app.doc_count || 0,
      borrowerNames: app.borrower_names || [],
      approvedRate: app.approved_rate,
      monthlyPayment: app.monthly_payment,
      isDeclined,
      totalResolved: summary.issues_resolved || 0,
      docInterventions: active.filter((i) => docTypes.includes(i.type)),
      creditInterventions: active.filter((i) => creditTypes.includes(i.type)),
      riskInterventions: active.filter((i) => riskTypes.includes(i.type)),
      pendingInterventions: active.filter((i) => actionTypes.includes(i.type) && i.status === 'pending'),
    };
  }, [timelineCtx, applicationId, isDeclined]);
  stageContextRef.current = stageContext;

  const isComplete = activeStage >= STAGES.length - 1;
  const currentStage = STAGES[activeStage];

  const statusLabel = isDeclined ? 'Declined' : isComplete ? 'Complete' : 'Processing';
  const statusColor = isDeclined ? 'var(--danger)' : isComplete ? 'var(--success)' : 'var(--mongo)';

  const interventionsResolved = stageContext.totalResolved;

  const currentAgentStatus = currentStage?.getAgentStatus
    ? currentStage.getAgentStatus(stageContext)
    : 'Processing...';

  // Prefer backend data over stale form data for summary card
  const displayName = stageContext.borrowerNames?.length > 0
    ? stageContext.borrowerNames.join(' & ')
    : applicationData
      ? [applicationData.firstName, applicationData.coApplicantName ? `& ${applicationData.coApplicantName.split(' ')[0]}` : null, applicationData.lastName].filter(Boolean).join(' ')
      : 'Application';
  const displayAmount = stageContext.loanAmount || (applicationData ? Number(applicationData.loanAmount) : null);
  const displayProduct = stageContext.product || applicationData?.productType || '';

  const assistantColor = isComplete
    ? 'var(--success)'
    : 'var(--agent-cyan)';

  const assistantBg = isComplete
    ? 'var(--success-dim)'
    : 'var(--agent-cyan-dim)';

  if (!sseConnected) {
    return (
      <div style={{ flex: 1, overflowY: 'auto', padding: `20px ${spacing[4]}px` }}>
        <div style={{
          padding: spacing[3],
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-dim)',
          marginBottom: spacing[3],
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, color: 'var(--text-primary)' }}>
              {applicationData
                ? `${applicationData.firstName}${applicationData.coApplicantName ? ` & ${applicationData.coApplicantName.split(' ')[0]}` : ''} ${applicationData.lastName}`
                : 'Application Status'}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
              {applicationData
                ? `${applicationId || ''} · $${Number(applicationData.loanAmount).toLocaleString('en-US')} · ${applicationData.productType || ''}`
                : applicationId || 'Waiting for connection...'}
            </div>
          </div>
          <div style={{
            padding: '6px 14px',
            borderRadius: 20,
            background: 'var(--hitl-amber-dim)',
            color: 'var(--hitl-amber)',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 11,
          }}>
            Connecting
          </div>
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: `${spacing[6]}px 0`,
          gap: spacing[3],
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            border: '3px solid var(--border-dim)',
            borderTopColor: 'var(--mongo)',
            animation: 'spin 0.8s linear infinite',
          }} />
          <div style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: 13,
            color: 'var(--text-secondary)',
          }}>
            Connecting to backend...
          </div>
          <div style={{
            fontSize: 11,
            color: 'var(--text-dim)',
            textAlign: 'center',
            maxWidth: 300,
            lineHeight: 1.5,
          }}>
            Waiting for real-time status updates from the processing pipeline.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: `20px ${spacing[4]}px` }}>
      <span style={{ fontSize: 9, color: 'var(--mongo)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
        MongoDB Change Streams
      </span>
      {/* Summary card */}
      <div style={{
        padding: spacing[3],
        background: 'var(--bg-surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-dim)',
        marginBottom: spacing[3],
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, color: 'var(--text-primary)' }}>
            {displayName}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
            {[applicationId, displayAmount ? `$${Number(displayAmount).toLocaleString('en-US')}` : null, displayProduct].filter(Boolean).join(' \u00b7 ')}
          </div>
        </div>
        <div style={{
          padding: '6px 14px',
          borderRadius: 20,
          background: statusColor === 'var(--success)' ? 'var(--success-dim)' : statusColor === 'var(--danger)' ? 'var(--danger-dim)' : 'var(--mongo-dim)',
          color: statusColor,
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 11,
        }}>
          {statusLabel}
        </div>
      </div>

      {/* AI Assistant Status Card */}
      <div style={{
        padding: `12px ${spacing[3]}px`,
        background: assistantBg,
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${assistantColor}`,
        marginBottom: spacing[3],
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        {!isComplete && (
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: assistantColor,
            boxShadow: `0 0 8px ${assistantColor}`,
            animation: 'pulse 1.5s infinite',
            flexShrink: 0,
          }} />
        )}
        {isComplete && (
          <span style={{ fontSize: 14, flexShrink: 0 }}>✅</span>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12,
              color: assistantColor, marginBottom: 2,
            }}>
              {isComplete ? 'All Steps Complete' : 'AI Assistant'}
            </div>
            {interventionsResolved > 0 && (
              <span style={{
                padding: '1px 6px', borderRadius: 8,
                background: 'var(--success-dim)', color: 'var(--success)',
                fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)',
              }}>
                {interventionsResolved} issue{interventionsResolved !== 1 ? 's' : ''} resolved
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            {currentAgentStatus}
          </div>
        </div>
      </div>

      {/* Segmented progress rail */}
      <div style={{ display: 'flex', gap: 2, padding: `0 0 ${spacing[4]}px`, flexShrink: 0 }}>
        {STAGES.map((stage, i) => {
          const isSegComplete = i < activeStage;
          const isSegActive = i === activeStage;
          return (
            <div key={stage.id} style={{
              flex: 1, height: 4, borderRadius: 2,
              background: isSegComplete ? 'var(--mongo)' : isSegActive ? 'var(--hitl-amber)' : 'var(--border-dim)',
              transition: 'background 0.4s ease',
              animation: isSegActive ? 'pulse 1.5s infinite' : undefined,
            }} />
          );
        })}
      </div>

      {/* Timeline */}
      <div style={{ position: 'relative', paddingLeft: spacing[5] }}>
        <div style={{ position: 'absolute', left: 11, top: 0, bottom: 0, width: 2, background: 'var(--border-dim)', borderRadius: 1 }}>
          <div style={{
            position: 'absolute', top: 0, left: 0, width: '100%',
            height: `${Math.min(100, (activeStage / Math.max(STAGES.length - 1, 1)) * 100)}%`,
            background: 'var(--mongo)',
            borderRadius: 1,
            transition: 'height 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
          }} />
        </div>

        {STAGES.map((stage, i) => (
          <TimelineStageCard
            key={stage.id}
            stage={stage}
            stageContext={stageContext}
            index={i}
            activeStage={activeStage}
            timestamps={timestamps}
            expandedStage={expandedStage}
            activityEvents={activityEvents}
            isDeclined={isDeclined}
            stampAnimated={stampAnimated}
            onStampAnimated={() => setStampAnimated(true)}
            feedCollapsed={feedCollapsed}
            onToggleFeed={() => setFeedCollapsed((p) => !p)}
            onToggleExpand={setExpandedStage}
          />
        ))}
      </div>

      {/* Post-Approval Savings Summary */}
      {isComplete && !isDeclined && (
        <SavingsSummary stageContext={stageContext} />
      )}

      {/* Decline Experience Card */}
      {isDeclined && (
        <DeclineCard stageContext={stageContext} onOpenChat={onOpenChat} />
      )}
    </div>
  );
}
