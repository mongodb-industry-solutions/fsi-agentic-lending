"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { spacing } from '@leafygreen-ui/tokens';
import { apiSSE } from '../../lib/api';
import { STAGES, STATUS_TO_STAGE, mapEventToStageIdx } from './statusTrackerConstants';
import { SavingsSummary } from './SavingsSummary';
import { TimelineStageCard } from './TimelineStageCard';

export default function StatusTracker({ onNotification, applicationId, applicationData }) {
  const [activeStage, setActiveStage] = useState(0);
  const [timestamps, setTimestamps] = useState([]);
  const [expandedStage, setExpandedStage] = useState(null);
  const [actionPaused, setActionPaused] = useState(false);
  const [actionUploading, setActionUploading] = useState(false);
  const [sseConnected, setSseConnected] = useState(false);
  const [isDeclined, setIsDeclined] = useState(false);
  const [stampAnimated, setStampAnimated] = useState(false);
  const [activityEvents, setActivityEvents] = useState({});
  const [feedCollapsed, setFeedCollapsed] = useState(false);
  const timerRef = useRef(null);
  const stageIdxRef = useRef(0);
  const activitySourceRef = useRef(null);

  const sendNotification = useCallback((stage, time, extra) => {
    if (onNotification) onNotification({ stage, time, ...extra });
  }, [onNotification]);

  const advanceStageLoop = useCallback(() => {
    stageIdxRef.current++;
    if (stageIdxRef.current >= STAGES.length) return;

    const stage = STAGES[stageIdxRef.current];
    const now = new Date();
    setActiveStage(stageIdxRef.current);
    setTimestamps((prev) => [...prev, now]);
    sendNotification(stage, now);

    if (stage.interventions) {
      stage.interventions.forEach((intv, idx) => {
        setTimeout(() => {
          sendNotification(
            { id: `${stage.id}-issue-${idx}`, label: `Issue Detected`, icon: null, detail: intv.issue },
            new Date(),
            { subType: 'intervention-issue', parentStage: stage.id }
          );
          setTimeout(() => {
            sendNotification(
              { id: `${stage.id}-fix-${idx}`, label: `Resolved by AI`, icon: null, detail: intv.resolution },
              new Date(),
              { subType: 'intervention-resolved', parentStage: stage.id }
            );
          }, 800);
        }, 600 + idx * 1600);
      });
    }

    if (stage.type === 'action-required') {
      setActionPaused(true);
      return;
    }

    if (stageIdxRef.current < STAGES.length - 1) {
      timerRef.current = setTimeout(advanceStageLoop, STAGES[stageIdxRef.current + 1].delayMs);
    }
  }, [sendNotification]);

  const advanceFromAction = useCallback(() => {
    if (!actionPaused) return;
    setActionUploading(true);
    sendNotification(
      { id: 'action-uploading', label: 'Document Uploading', icon: null, detail: 'Uploading December 2025 bank statement...' },
      new Date(),
      { subType: 'action-progress' }
    );
    setTimeout(() => {
      setActionUploading(false);
      setActionPaused(false);
      sendNotification(
        { id: 'action-complete', label: 'Document Received', icon: null, detail: 'Additional bank statement verified. Processing resumed.' },
        new Date(),
        { subType: 'action-resolved' }
      );
      stageIdxRef.current++;
      if (stageIdxRef.current < STAGES.length) {
        const now = new Date();
        setActiveStage(stageIdxRef.current);
        setTimestamps((prev) => [...prev, now]);
        sendNotification(STAGES[stageIdxRef.current], now);
        const nextStage = STAGES[stageIdxRef.current];
        if (nextStage.interventions) {
          nextStage.interventions.forEach((intv, idx) => {
            setTimeout(() => {
              sendNotification(
                { id: `${nextStage.id}-issue-${idx}`, label: `Issue Detected`, icon: null, detail: intv.issue },
                new Date(),
                { subType: 'intervention-issue', parentStage: nextStage.id }
              );
              setTimeout(() => {
                sendNotification(
                  { id: `${nextStage.id}-fix-${idx}`, label: `Resolved by AI`, icon: null, detail: intv.resolution },
                  new Date(),
                  { subType: 'intervention-resolved', parentStage: nextStage.id }
                );
              }, 800);
            }, 600 + idx * 1600);
          });
        }
        if (stageIdxRef.current < STAGES.length - 1) {
          timerRef.current = setTimeout(advanceStageLoop, STAGES[stageIdxRef.current + 1].delayMs);
        }
      }
    }, 2000);
  }, [actionPaused, sendNotification, advanceStageLoop]);

  useEffect(() => {
    if (sseConnected) return;

    stageIdxRef.current = 0;
    setTimestamps([new Date()]);
    sendNotification(STAGES[0], new Date());

    if (STAGES.length > 1) {
      timerRef.current = setTimeout(advanceStageLoop, STAGES[1].delayMs);
    }

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [sseConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  // SSE connection for real-time backend status
  useEffect(() => {
    if (!applicationId) return;

    const source = apiSSE(
      `/applications/${applicationId}/status`,
      (event) => {
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
        setSseConnected(true);

        if (event.type === 'status' && event.status) {
          if (process.env.NODE_ENV === 'development') console.log('[StatusTracker] Real-time status:', event.status);
          if (event.status === 'declined') {
            setIsDeclined(true);
          }
          const targetIdx = STATUS_TO_STAGE[event.status];
          if (targetIdx !== undefined && targetIdx >= 0 && targetIdx > stageIdxRef.current) {
            if (timerRef.current) clearTimeout(timerRef.current);
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
        }
      }
    );

    return () => source?.close();
  }, [applicationId]);

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
  const isActionStage = currentStage?.type === 'action-required' && actionPaused;

  const statusLabel = isDeclined ? 'Declined' : isComplete ? 'Complete' : isActionStage ? 'Action Needed' : 'Processing';
  const statusColor = isDeclined ? 'var(--danger)' : isComplete ? 'var(--success)' : isActionStage ? 'var(--hitl-amber)' : 'var(--mongo)';

  const estimatedRemaining = useMemo(() => {
    if (isComplete) return null;
    let remaining = 0;
    for (let i = activeStage + 1; i < STAGES.length; i++) {
      remaining += STAGES[i].delayMs;
    }
    if (isActionStage) remaining += 2000;
    const seconds = Math.ceil(remaining / 1000);
    if (seconds < 60) return `~${seconds}s remaining`;
    return `~${Math.ceil(seconds / 60)}min remaining`;
  }, [activeStage, isComplete, isActionStage]);

  const interventionsResolved = useMemo(() => {
    let count = 0;
    for (let i = 0; i <= activeStage && i < STAGES.length; i++) {
      const s = STAGES[i];
      if (i < activeStage && s.interventions) count += s.interventions.length;
      if (i < activeStage && s.type === 'action-required') count += 1;
    }
    return count;
  }, [activeStage]);

  const currentAgentStatus = isActionStage
    ? currentStage.agentStatus
    : actionUploading
      ? 'Processing your uploaded document...'
      : (currentStage?.agentStatusActive && activeStage === STAGES.indexOf(currentStage) && !isComplete)
        ? currentStage.agentStatusActive || currentStage.agentStatus
        : currentStage?.agentStatus;

  const assistantColor = isComplete
    ? 'var(--success)'
    : isActionStage
      ? 'var(--hitl-amber)'
      : 'var(--agent-cyan)';

  const assistantBg = isComplete
    ? 'var(--success-dim)'
    : isActionStage
      ? 'var(--hitl-amber-dim)'
      : 'var(--agent-cyan-dim)';

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: `20px ${spacing[4]}px` }}>
      {applicationId && !sseConnected && (
        <div style={{ padding: '6px 12px', background: 'var(--hitl-amber-dim)', borderRadius: 'var(--radius-sm)', fontSize: 10, color: 'var(--hitl-amber)', marginBottom: spacing[2] }}>
          Connecting to backend...
        </div>
      )}
      {sseConnected && (
        <span style={{ fontSize: 9, color: 'var(--mongo)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
          MongoDB Change Streams
        </span>
      )}
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
              : 'Marcus & Sofia Delgado'}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
            {applicationData
              ? `${applicationId || 'APP-2026-00001'} · $${Number(applicationData.loanAmount).toLocaleString('en-US')} · ${applicationData.productType || '5yr Fixed (25yr Amort)'}`
              : 'APP-2026-00001 · $875,000 · 5yr Fixed (25yr Amort)'}
          </div>
        </div>
        <div style={{
          padding: '6px 14px',
          borderRadius: 20,
          background: statusColor === 'var(--success)' ? 'var(--success-dim)' : statusColor === 'var(--danger)' ? 'var(--danger-dim)' : statusColor === 'var(--hitl-amber)' ? 'var(--hitl-amber-dim)' : 'var(--mongo-dim)',
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
        {!isComplete && !isActionStage && (
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: assistantColor,
            boxShadow: `0 0 8px ${assistantColor}`,
            animation: 'pulse 1.5s infinite',
            flexShrink: 0,
          }} />
        )}
        {isActionStage && (
          <span style={{ fontSize: 14, flexShrink: 0 }}>⚠</span>
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
              {isComplete ? 'All Steps Complete' : isActionStage ? 'Your Action Needed' : 'AI Assistant'}
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
        {estimatedRemaining && (
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'var(--text-dim)', whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            {estimatedRemaining}
          </div>
        )}
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
            actionPaused={actionPaused}
            actionUploading={actionUploading}
            feedCollapsed={feedCollapsed}
            onToggleFeed={() => setFeedCollapsed((p) => !p)}
            onToggleExpand={setExpandedStage}
            onAdvanceFromAction={advanceFromAction}
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
