import { WORKFLOW_STAGES } from './constants';

export function StageProgressBar({ stage, hitlReached, approved, approvalDetails, stageTimestamps }) {
  // When approved, force-render all stages complete. Otherwise clamp to valid range.
  // `stage = -1` is the preview sentinel — allow it through unchanged so no stage lights up.
  const effectiveStage = approved
    ? WORKFLOW_STAGES.length - 1
    : stage === -1
      ? -1
      : Math.max(0, Math.min(stage, WORKFLOW_STAGES.length - 1));

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 0,
      padding: '8px 16px',
      borderBottom: '1px solid var(--border-dim)',
      background: 'var(--bg-base)',
    }}>
      {WORKFLOW_STAGES.map((ws, i) => {
        const isComplete = i < effectiveStage || (i === effectiveStage && (approved || (i === 2 && hitlReached)));
        const isCurrent = i === effectiveStage && !approved && !(i === 2 && hitlReached);
        const isHitlWaiting = i === 2 && hitlReached && !approved;
        const isFuture = i > effectiveStage;
        const isDeclined = approved && approvalDetails?.mode === 'declined';

        let nodeColor = 'var(--border-dim)';
        let labelColor = 'var(--text-dim)';
        if (isComplete && !isHitlWaiting) {
          nodeColor = isDeclined && i === 2 ? 'var(--danger)' : 'var(--success)';
          labelColor = 'var(--text-primary)';
        } else if (isCurrent) {
          nodeColor = 'var(--agent-cyan)';
          labelColor = 'var(--agent-cyan)';
        } else if (isHitlWaiting) {
          nodeColor = 'var(--hitl-amber)';
          labelColor = 'var(--hitl-amber)';
        }

        const elapsed = stageTimestamps?.[i] && (isComplete || isCurrent)
          ? (() => {
              const end = stageTimestamps[i + 1];
              if (!end) return null;
              const ms = end - stageTimestamps[i];
              if (ms <= 0) return null;
              return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
            })()
          : null;

        return (
          <div key={ws.nodeKey} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 64 }}>
              <div style={{
                width: 18, height: 18, borderRadius: '50%',
                background: isComplete && !isHitlWaiting ? nodeColor : 'transparent',
                border: `2px solid ${nodeColor}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 700,
                color: isComplete && !isHitlWaiting ? '#fff' : nodeColor,
                animation: isCurrent ? 'pulse 1.5s infinite' : 'none',
                transition: 'all 300ms cubic-bezier(0.33, 1, 0.68, 1)',
              }}>
                {isComplete && !isHitlWaiting ? '\u2713' : isHitlWaiting ? '!' : i + 1}
              </div>
              <div style={{
                fontSize: 9, fontWeight: 600, color: labelColor, marginTop: 3,
                fontFamily: 'var(--font-display)',
                transition: 'color 300ms ease',
              }}>
                {ws.label}
              </div>
              {elapsed && (
                <div style={{ fontSize: 7, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginTop: 1 }}>
                  {elapsed}
                </div>
              )}
              {isHitlWaiting && (
                <div style={{ fontSize: 7, fontWeight: 700, color: 'var(--hitl-amber)', marginTop: 1 }}>
                  AWAITING
                </div>
              )}
            </div>
            {i < WORKFLOW_STAGES.length - 1 && (
              <div style={{
                flex: 1, height: 2, borderRadius: 1, margin: '0 4px',
                background: isComplete && !isHitlWaiting ? 'var(--success)' : isCurrent ? 'var(--agent-cyan)' : 'var(--border-dim)',
                opacity: isFuture ? 0.3 : 1,
                transition: 'all 300ms cubic-bezier(0.33, 1, 0.68, 1)',
                marginBottom: elapsed ? 16 : isHitlWaiting ? 14 : 0,
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
