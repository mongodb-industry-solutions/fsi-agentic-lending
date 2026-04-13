"use client";

import { useState, useEffect, useRef } from 'react';
import { spacing } from '@leafygreen-ui/tokens';
import { apiSSE } from '../../lib/api';

const STAGE_ORDER = [
  { key: 'submitted', label: 'Submitted' },
  { key: 'processing', label: 'Document Verification' },
  { key: 'underwriting', label: 'Underwriting' },
  { key: 'review', label: 'Officer Review' },
  { key: 'decision', label: 'Decision' },
  { key: 'funded', label: 'Funded' },
  { key: 'active', label: 'Loan Active' },
];

const TERMINAL_LABELS = {
  approved: 'Approved',
  declined: 'Declined',
  error: 'Error',
};

const AGENT_COLORS = {
  loan_app_agent: { color: 'var(--agent-cyan)', bg: 'var(--agent-cyan-dim)', label: 'Loan Agent' },
  underwriter: { color: 'var(--hitl-amber)', bg: 'var(--hitl-amber-dim)', label: 'Underwriter' },
  supervisor: { color: 'var(--voyage)', bg: 'var(--voyage-dim)', label: 'Supervisor' },
  default: { color: 'var(--text-dim)', bg: 'var(--bg-raised)', label: 'Agent' },
};

function getAgentStyle(agentName) {
  return AGENT_COLORS[agentName] || AGENT_COLORS.default;
}

function getStageState(stageKey, currentStatus) {
  if (!currentStatus) return 'future';

  const currentIdx = STAGE_ORDER.findIndex((s) => s.key === currentStatus);
  const stageIdx = STAGE_ORDER.findIndex((s) => s.key === stageKey);

  if (currentStatus === 'approved' || currentStatus === 'declined' || currentStatus === 'error') {
    if (stageIdx < STAGE_ORDER.findIndex((s) => s.key === 'decision')) return 'done';
    if (stageKey === 'decision') return 'done';
    return 'future';
  }

  if (stageIdx < currentIdx) return 'done';
  if (stageIdx === currentIdx) return 'active';
  return 'future';
}

function StageIndicator({ state }) {
  if (state === 'done') {
    return (
      <div style={{
        width: 14, height: 14, borderRadius: '50%',
        background: 'var(--mongo)', flexShrink: 0,
      }} />
    );
  }

  if (state === 'active') {
    return (
      <div style={{
        width: 14, height: 14, borderRadius: '50%',
        background: 'transparent', border: '2.5px solid var(--mongo)',
        position: 'relative', flexShrink: 0,
        animation: 'statusPulse 2s cubic-bezier(0.33, 1, 0.68, 1) infinite',
      }}>
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 5, height: 5, borderRadius: '50%', background: 'var(--mongo)',
        }} />
      </div>
    );
  }

  return (
    <div style={{
      width: 14, height: 14, borderRadius: '50%',
      border: '1.5px solid var(--border-dim)', flexShrink: 0,
    }} />
  );
}

function ActivityItem({ event }) {
  const agentStyle = getAgentStyle(event.agent);
  const time = event.timestamp
    ? new Date(event.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '';

  return (
    <div style={{
      display: 'flex', gap: 6, alignItems: 'flex-start',
      padding: `4px 0`,
      animation: 'cardEnter 0.3s cubic-bezier(0.4, 0, 0.2, 1) both',
    }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 9,
        color: 'var(--text-dim)', flexShrink: 0, marginTop: 1,
        minWidth: 58,
      }}>
        {time}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 1 }}>
          <span style={{
            fontSize: 8, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.04em', color: agentStyle.color,
            padding: '1px 5px', borderRadius: 4,
            background: agentStyle.bg,
          }}>
            {agentStyle.label}
          </span>
          {event.action && (
            <span style={{
              fontSize: 8, color: 'var(--text-dim)', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.03em',
            }}>
              {event.action}
            </span>
          )}
        </div>
        <div style={{
          fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4,
        }}>
          {event.detail}
        </div>
      </div>
    </div>
  );
}

function ActivityFeed({ events, collapsed, onToggle }) {
  const feedRef = useRef(null);

  useEffect(() => {
    if (feedRef.current && !collapsed) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [events.length, collapsed]);

  if (events.length === 0) return null;

  return (
    <div style={{
      marginTop: spacing[2],
      borderTop: '1px solid var(--border-dim)',
      paddingTop: spacing[2],
    }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', cursor: 'pointer',
          padding: `2px 0`, width: '100%', textAlign: 'left',
          font: 'inherit',
        }}
      >
        <span style={{
          fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.05em', color: 'var(--agent-cyan)',
          fontFamily: 'var(--font-display)',
        }}>
          Live Activity
        </span>
        <span style={{
          fontSize: 8, fontWeight: 700, fontFamily: 'var(--font-mono)',
          padding: '1px 5px', borderRadius: 4,
          background: 'var(--agent-cyan-dim)',
          color: 'var(--agent-cyan)',
        }}>
          {events.length}
        </span>
        <span style={{
          fontSize: 10, color: 'var(--text-dim)',
          transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
          transition: 'transform 150ms ease',
          marginLeft: 'auto',
        }}>
          {'\u25BE'}
        </span>
      </button>

      {!collapsed && (
        <div
          ref={feedRef}
          style={{
            maxHeight: 200, overflowY: 'auto', marginTop: 4,
            paddingRight: 2,
          }}
        >
          {events.map((ev) => (
            <ActivityItem key={ev._key} event={ev} />
          ))}
        </div>
      )}
    </div>
  );
}

function StageRow({ label, state, timestamp, activityEvents, feedCollapsed, onToggleFeed }) {
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center',
        gap: spacing[3], padding: `${spacing[2]}px 0`,
      }}>
        <StageIndicator state={state} />
        <div style={{
          flex: 1, fontSize: 13,
          fontWeight: state === 'active' ? 600 : 400,
          color: state === 'future' ? 'var(--text-dim)' : 'var(--text-primary)',
          fontFamily: 'var(--font-display)',
        }}>
          {label}
        </div>
        {timestamp && (
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'var(--text-dim)', flexShrink: 0,
          }}>
            {new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
        {state === 'active' && !timestamp && (
          <div style={{
            fontSize: 10, color: 'var(--mongo)', fontWeight: 600, flexShrink: 0,
          }}>
            In Progress
          </div>
        )}
      </div>

      {(state === 'active' || state === 'done') && activityEvents.length > 0 && (
        <div style={{ paddingLeft: 26 }}>
          <ActivityFeed
            events={activityEvents}
            collapsed={state === 'done' ? true : feedCollapsed}
            onToggle={onToggleFeed}
          />
        </div>
      )}
    </div>
  );
}

const STATUS_TO_STAGE = {
  submitted: 'submitted',
  processing: 'processing',
  underwriting: 'underwriting',
  review: 'review',
  approved: 'decision',
  declined: 'decision',
  funded: 'funded',
  active: 'active',
  error: 'decision',
};

const ACTION_TO_STAGE = {
  document_ingestion: 'processing',
  verification: 'processing',
  risk_assessment: 'underwriting',
  underwriting: 'underwriting',
  decision: 'decision',
  intervention: 'review',
  autonomy_gate: 'review',
  status_update: null,
};

function mapEventToStage(event, currentStatus) {
  if (event.action && ACTION_TO_STAGE[event.action] !== undefined) {
    return ACTION_TO_STAGE[event.action];
  }
  return STATUS_TO_STAGE[currentStatus] || 'processing';
}

export default function StatusPane({ applicationId, applicationData }) {
  const [status, setStatus] = useState('submitted');
  const [timestamps, setTimestamps] = useState(() => ({ submitted: new Date().toISOString() }));
  const [connected, setConnected] = useState(false);
  const [activityEvents, setActivityEvents] = useState({});
  const [feedCollapsed, setFeedCollapsed] = useState(false);
  const sourceRef = useRef(null);
  const activityRef = useRef(null);
  const statusRef = useRef('submitted');
  const activityIdCounter = useRef(0);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // SSE: application status
  useEffect(() => {
    if (!applicationId) return;
    setConnected(false);

    const source = apiSSE(
      `/applications/${applicationId}/status`,
      (data) => {
        if (data.status) {
          setStatus(data.status);
        }
        const ts = data.updated_at || data.timestamp;
        if (ts && data.status) {
          setTimestamps((prev) => ({ ...prev, [data.status]: ts }));
        }
      },
      () => setConnected(false)
    );

    sourceRef.current = source;
    source.onopen = () => setConnected(true);

    return () => {
      if (sourceRef.current) sourceRef.current.close();
    };
  }, [applicationId]);

  // SSE: agent activity
  useEffect(() => {
    if (!applicationId) return;

    const source = apiSSE(
      `/applications/${applicationId}/activity`,
      (data) => {
        if (data.type === 'connected') return;
        if (data.type === 'error') return;

        const stage = mapEventToStage(data, statusRef.current);
        if (!stage) return;

        const keyed = { ...data, _key: ++activityIdCounter.current };
        setActivityEvents((prev) => {
          const existing = prev[stage] || [];
          return { ...prev, [stage]: [...existing, keyed] };
        });
      },
      () => {}
    );

    activityRef.current = source;
    return () => {
      if (activityRef.current) activityRef.current.close();
    };
  }, [applicationId]);

  const terminalLabel = status && TERMINAL_LABELS[status] ? TERMINAL_LABELS[status] : null;

  return (
    <div style={{
      width: 340, flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      borderRight: '1px solid var(--border-dim)',
      background: 'var(--bg-surface)', overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{ padding: `${spacing[5]}px ${spacing[5]}px ${spacing[4]}px` }}>
        <div style={{
          fontFamily: 'var(--font-display)', fontWeight: 800,
          fontSize: 16, color: 'var(--text-primary)',
          marginBottom: spacing[1],
        }}>
          Application Status
        </div>
        {applicationId && (
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 11,
            color: 'var(--text-dim)', marginBottom: spacing[3],
          }}>
            {applicationId}
          </div>
        )}

        {applicationData && (
          <div style={{
            padding: spacing[3],
            background: 'var(--bg-raised, var(--bg-surface))',
            borderRadius: 8, border: '1px solid var(--border-dim)',
            marginBottom: spacing[2],
          }}>
            <div style={{
              fontFamily: 'var(--font-display)', fontWeight: 600,
              fontSize: 13, color: 'var(--text-primary)', marginBottom: 2,
            }}>
              {applicationData.firstName} {applicationData.lastName}
              {applicationData.coApplicantName ? ` & ${applicationData.coApplicantName}` : ''}
            </div>
            <div style={{
              fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2,
            }}>
              {applicationData.productType}
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 12,
              fontWeight: 600, color: 'var(--text-primary)',
            }}>
              ${Number(applicationData.loanAmount).toLocaleString('en-US')}
            </div>
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border-dim)', margin: `0 ${spacing[5]}px` }} />

      {/* Stage list */}
      <div style={{ padding: `${spacing[4]}px ${spacing[5]}px`, flex: 1 }}>
        {STAGE_ORDER.map((stage) => {
          const state = getStageState(stage.key, status);
          const label = stage.key === 'decision' && terminalLabel ? terminalLabel : stage.label;
          const stageEvents = activityEvents[stage.key] || [];
          return (
            <StageRow
              key={stage.key}
              label={label}
              state={state}
              timestamp={timestamps[stage.key]}
              activityEvents={stageEvents}
              feedCollapsed={feedCollapsed}
              onToggleFeed={() => setFeedCollapsed((p) => !p)}
            />
          );
        })}

        {status === 'error' && (
          <div style={{
            marginTop: spacing[3], padding: spacing[3], borderRadius: 8,
            border: '1px solid var(--danger, #d32f2f)',
            background: 'rgba(211, 47, 47, 0.06)',
            fontSize: 12, color: 'var(--danger, #d32f2f)', fontWeight: 500,
          }}>
            An error occurred during processing. Please contact support.
          </div>
        )}
      </div>

      {/* SSE connection indicator */}
      <div style={{
        padding: `${spacing[3]}px ${spacing[5]}px`,
        borderTop: '1px solid var(--border-dim)',
        display: 'flex', alignItems: 'center',
        gap: spacing[2], fontSize: 10, color: 'var(--text-dim)',
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: connected ? 'var(--success, #00a854)' : 'var(--danger, #d32f2f)',
          boxShadow: connected ? '0 0 6px var(--success, #00a854)' : 'none',
          animation: connected ? 'pulse 1.5s infinite' : 'none',
          flexShrink: 0,
        }} />
        {connected ? 'Connected via SSE' : 'Connecting...'}
      </div>
    </div>
  );
}
