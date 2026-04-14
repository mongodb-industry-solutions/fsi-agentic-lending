"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { spacing } from '@leafygreen-ui/tokens';
import { apiSSE, apiGet } from '../../lib/api';
import { STAGES, STATUS_TO_STAGE, mapEventToStageIdx } from './statusTrackerConstants';
import { SavingsSummary } from './SavingsSummary';
import { TimelineStageCard } from './TimelineStageCard';

export default function StatusTracker({ onNotification, applicationId, applicationData }) {
  const [activeStage, setActiveStage] = useState(0);
  const [timestamps, setTimestamps] = useState([]);
  const [expandedStage, setExpandedStage] = useState(null);
  const [sseConnected, setSseConnected] = useState(false);
  const [isDeclined, setIsDeclined] = useState(false);
  const [stampAnimated, setStampAnimated] = useState(false);
  const [activityEvents, setActivityEvents] = useState({});
  const [feedCollapsed, setFeedCollapsed] = useState(false);
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
        sendNotification(STAGES[stageIdxRef.current], now);
      }
      setActiveStage(targetIdx);
      setTimestamps((prev) => [...prev, ...newTimestamps]);
    }
  }, [sendNotification]);

  // SSE connection for real-time backend status, with REST polling fallback
  useEffect(() => {
    if (!applicationId) return;
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

  const isComplete = activeStage >= STAGES.length - 1;
  const currentStage = STAGES[activeStage];

  const statusLabel = isDeclined ? 'Declined' : isComplete ? 'Complete' : 'Processing';
  const statusColor = isDeclined ? 'var(--danger)' : isComplete ? 'var(--success)' : 'var(--mongo)';

  const interventionsResolved = useMemo(() => {
    let count = 0;
    for (let i = 0; i <= activeStage && i < STAGES.length; i++) {
      const s = STAGES[i];
      if (i < activeStage && s.interventions) count += s.interventions.length;
      if (i < activeStage && s.type === 'action-required') count += 1;
    }
    return count;
  }, [activeStage]);

  const currentAgentStatus = (currentStage?.agentStatusActive && !isComplete)
    ? currentStage.agentStatusActive || currentStage.agentStatus
    : currentStage?.agentStatus;

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
            {applicationData
              ? `${applicationData.firstName}${applicationData.coApplicantName ? ` & ${applicationData.coApplicantName.split(' ')[0]}` : ''} ${applicationData.lastName}`
              : 'Application Status'}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
            {applicationData
              ? `${applicationId || ''} · $${Number(applicationData.loanAmount).toLocaleString('en-US')} · ${applicationData.productType || ''}`
              : applicationId || ''}
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
        <SavingsSummary interventionsResolved={interventionsResolved} />
      )}
    </div>
  );
}
