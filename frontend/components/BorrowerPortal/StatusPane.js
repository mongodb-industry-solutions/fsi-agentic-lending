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

function getStageState(stageKey, currentStatus) {
  if (!currentStatus) return 'future';

  const currentIdx = STAGE_ORDER.findIndex((s) => s.key === currentStatus);
  const stageIdx = STAGE_ORDER.findIndex((s) => s.key === stageKey);

  // Handle terminal statuses
  if (currentStatus === 'approved' || currentStatus === 'declined' || currentStatus === 'error') {
    // All stages up to decision are done for terminal statuses
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
        width: 14,
        height: 14,
        borderRadius: '50%',
        background: 'var(--mongo)',
        flexShrink: 0,
      }} />
    );
  }

  if (state === 'active') {
    return (
      <div style={{
        width: 14,
        height: 14,
        borderRadius: '50%',
        background: 'transparent',
        border: '2.5px solid var(--mongo)',
        position: 'relative',
        flexShrink: 0,
        animation: 'statusPulse 2s cubic-bezier(0.33, 1, 0.68, 1) infinite',
      }}>
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: 'var(--mongo)',
        }} />
      </div>
    );
  }

  return (
    <div style={{
      width: 14,
      height: 14,
      borderRadius: '50%',
      border: '1.5px solid var(--border-dim)',
      flexShrink: 0,
    }} />
  );
}

function StageRow({ label, state, timestamp }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: spacing[3],
      padding: `${spacing[2]}px 0`,
    }}>
      <StageIndicator state={state} />
      <div style={{
        flex: 1,
        fontSize: 13,
        fontWeight: state === 'active' ? 600 : 400,
        color: state === 'future' ? 'var(--text-dim)' : 'var(--text-primary)',
        fontFamily: 'var(--font-display)',
      }}>
        {label}
      </div>
      {timestamp && (
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--text-dim)',
          flexShrink: 0,
        }}>
          {new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}
      {state === 'active' && !timestamp && (
        <div style={{
          fontSize: 10,
          color: 'var(--mongo)',
          fontWeight: 600,
          flexShrink: 0,
        }}>
          In Progress
        </div>
      )}
    </div>
  );
}

export default function StatusPane({ applicationId, applicationData }) {
  const [status, setStatus] = useState(null);
  const [timestamps, setTimestamps] = useState({});
  const [connected, setConnected] = useState(false);
  const sourceRef = useRef(null);

  useEffect(() => {
    if (!applicationId) return;

    setConnected(false);

    const source = apiSSE(
      `/applications/${applicationId}/status`,
      (data) => {
        if (data.status) {
          setStatus(data.status);
        }

        if (data.timestamp && data.status) {
          setTimestamps((prev) => ({
            ...prev,
            [data.status]: data.timestamp,
          }));
        }
      },
      () => {
        setConnected(false);
      }
    );

    sourceRef.current = source;
    source.onopen = () => setConnected(true);

    return () => {
      if (sourceRef.current) {
        sourceRef.current.close();
      }
    };
  }, [applicationId]);

  // Determine terminal status label override for decision stage
  const terminalLabel = status && TERMINAL_LABELS[status] ? TERMINAL_LABELS[status] : null;

  return (
    <div style={{
      width: 340,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      borderRight: '1px solid var(--border-dim)',
      background: 'var(--bg-surface)',
      overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{ padding: `${spacing[5]}px ${spacing[5]}px ${spacing[4]}px` }}>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: 16,
          color: 'var(--text-primary)',
          marginBottom: spacing[1],
        }}>
          Application Status
        </div>
        {applicationId && (
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-dim)',
            marginBottom: spacing[3],
          }}>
            {applicationId}
          </div>
        )}

        {/* Application summary */}
        {applicationData && (
          <div style={{
            padding: spacing[3],
            background: 'var(--bg-raised, var(--bg-surface))',
            borderRadius: 8,
            border: '1px solid var(--border-dim)',
            marginBottom: spacing[2],
          }}>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 13,
              color: 'var(--text-primary)',
              marginBottom: 2,
            }}>
              {applicationData.firstName} {applicationData.lastName}
              {applicationData.coApplicantName ? ` & ${applicationData.coApplicantName}` : ''}
            </div>
            <div style={{
              fontSize: 11,
              color: 'var(--text-secondary)',
              marginBottom: 2,
            }}>
              {applicationData.productType}
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}>
              ${Number(applicationData.loanAmount).toLocaleString()}
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
          // Override decision label with terminal status if applicable
          const label = stage.key === 'decision' && terminalLabel ? terminalLabel : stage.label;
          return (
            <StageRow
              key={stage.key}
              label={label}
              state={state}
              timestamp={timestamps[stage.key]}
            />
          );
        })}

        {/* Show error state if applicable */}
        {status === 'error' && (
          <div style={{
            marginTop: spacing[3],
            padding: spacing[3],
            borderRadius: 8,
            border: '1px solid var(--danger, #d32f2f)',
            background: 'rgba(211, 47, 47, 0.06)',
            fontSize: 12,
            color: 'var(--danger, #d32f2f)',
            fontWeight: 500,
          }}>
            An error occurred during processing. Please contact support.
          </div>
        )}
      </div>

      {/* SSE connection indicator */}
      <div style={{
        padding: `${spacing[3]}px ${spacing[5]}px`,
        borderTop: '1px solid var(--border-dim)',
        display: 'flex',
        alignItems: 'center',
        gap: spacing[2],
        fontSize: 10,
        color: 'var(--text-dim)',
      }}>
        <span style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
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
