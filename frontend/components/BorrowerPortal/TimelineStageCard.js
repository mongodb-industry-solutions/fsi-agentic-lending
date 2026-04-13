"use client";

import { spacing } from '@leafygreen-ui/tokens';
import { ThinkingStrip, ActivityFeed } from './ActivityFeed';
import { formatTime } from './statusTrackerConstants';

export function TimelineStageCard({
  stage,
  index,
  activeStage,
  timestamps,
  expandedStage,
  activityEvents,
  isDeclined,
  stampAnimated,
  onStampAnimated,
  actionPaused,
  actionUploading,
  feedCollapsed,
  onToggleFeed,
  onToggleExpand,
  onAdvanceFromAction,
}) {
  const isCompleted = index < activeStage;
  const isActive = index === activeStage;
  const isFuture = index > activeStage;
  const isExpanded = expandedStage === stage.id;
  const canExpand = isCompleted;
  const hasInterventions = stage.type === 'intervention';
  const isActionReq = stage.type === 'action-required';
  const isActiveAction = isActive && isActionReq && actionPaused;
  const isComplete = activeStage >= 8; // STAGES.length - 1

  let dotBg, dotBorder;
  if (isCompleted) {
    dotBg = 'var(--success)';
    dotBorder = 'var(--success)';
  } else if (isActiveAction) {
    dotBg = 'var(--hitl-amber)';
    dotBorder = 'var(--hitl-amber)';
  } else if (isActive && hasInterventions) {
    dotBg = 'var(--hitl-amber)';
    dotBorder = 'var(--hitl-amber)';
  } else if (isActive) {
    dotBg = 'var(--mongo)';
    dotBorder = 'var(--mongo)';
  } else {
    dotBg = 'var(--bg-raised)';
    dotBorder = 'var(--border-dim)';
  }

  let cardBg, cardBorder;
  if (isActiveAction) {
    cardBg = 'var(--hitl-amber-dim)';
    cardBorder = 'var(--hitl-amber)';
  } else if (isActive && hasInterventions) {
    cardBg = 'var(--hitl-amber-dim)';
    cardBorder = 'var(--hitl-amber)';
  } else if (isActive) {
    cardBg = 'var(--mongo-dim)';
    cardBorder = 'var(--mongo)';
  } else if (isExpanded) {
    cardBg = 'var(--bg-surface)';
    cardBorder = 'var(--agent-cyan)';
  } else if (isCompleted) {
    cardBg = 'var(--bg-surface)';
    cardBorder = 'var(--border-dim)';
  } else {
    cardBg = 'var(--bg-raised)';
    cardBorder = 'var(--border-dim)';
  }

  const labelColor = isActiveAction
    ? 'var(--hitl-amber)'
    : isActive && hasInterventions
      ? 'var(--hitl-amber)'
      : isActive
        ? 'var(--mongo)'
        : isCompleted
          ? 'var(--text-primary)'
          : 'var(--text-dim)';

  const stageEvents = activityEvents[stage.id] || [];

  return (
    <div
      ref={isActive ? (el) => { if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } : undefined}
      style={{
        position: 'relative',
        paddingBottom: 20,
        opacity: isFuture ? 0.35 : 1,
        transition: 'opacity 0.4s',
      }}
    >
      {/* Node dot */}
      <div style={{
        position: 'absolute', left: -22, top: 2,
        width: 20, height: 20, borderRadius: '50%',
        background: dotBg,
        border: `2px solid ${dotBorder}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, color: '#fff', zIndex: 1,
        animation: isActive ? 'pulse 1.5s infinite'
          : (isCompleted && index === activeStage - 1) ? 'completionBurst 300ms cubic-bezier(0.33, 1, 0.68, 1)' : undefined,
      }}>
        {isCompleted ? '✓' : isActive ? (isActiveAction ? '!' : stage.icon) : ''}
      </div>

      {/* Content */}
      <div
        style={{
          padding: '10px 14px',
          background: cardBg,
          borderRadius: 'var(--radius-md)',
          border: `1px solid ${cardBorder}`,
          marginLeft: 8,
          cursor: canExpand ? 'pointer' : 'default',
          transition: 'border-color 0.2s, background 0.2s',
        }}
        onClick={() => canExpand && onToggleExpand(isExpanded ? null : stage.id)}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13,
              color: labelColor,
            }}>
              {stage.id === 'approved' && isDeclined ? 'Declined' : stage.label}
            </div>
            {isCompleted && hasInterventions && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                padding: '2px 8px', borderRadius: 8,
                background: 'var(--success-dim)', color: 'var(--success)',
                fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)',
              }}>
                <span style={{ fontSize: 10 }}>{'✓'}</span>
                {stage.interventions.length} resolved by AI
              </span>
            )}
            {isCompleted && !hasInterventions && !isActionReq && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                padding: '2px 8px', borderRadius: 8,
                background: 'var(--success-dim)', color: 'var(--success)',
                fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)',
              }}>
                <span style={{ fontSize: 10 }}>{'✓'}</span>
                Verified
              </span>
            )}
            {isActive && hasInterventions && !isCompleted && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                padding: '2px 8px', borderRadius: 8,
                background: 'var(--hitl-amber-dim)', color: 'var(--hitl-amber)',
                fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)',
                animation: 'pulse 1.5s infinite',
              }}>
                ISSUES DETECTED
              </span>
            )}
            {isActiveAction && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                padding: '2px 8px', borderRadius: 8,
                background: 'var(--hitl-amber-dim)', color: 'var(--hitl-amber)',
                fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)',
              }}>
                ACTION NEEDED
              </span>
            )}
            {isCompleted && isActionReq && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                padding: '2px 8px', borderRadius: 8,
                background: 'var(--success-dim)', color: 'var(--success)',
                fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)',
              }}>
                <span style={{ fontSize: 10 }}>{'✓'}</span>
                Document verified
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {timestamps[index] && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-dim)' }}>
                {formatTime(timestamps[index])}
              </span>
            )}
            {canExpand && (
              <span style={{
                fontSize: 10, color: 'var(--text-dim)',
                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)',
                transition: 'transform 0.2s',
                display: 'inline-block',
              }}>
                ▾
              </span>
            )}
          </div>
        </div>

        <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {stage.id === 'approved' && isDeclined
            ? 'Application has been declined after officer review.'
            : stage.detail}
        </div>

        {stage.id === 'approved' && (isCompleted || isActive) && !isDeclined && (
          <div
            onAnimationEnd={() => onStampAnimated?.()}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '8px 20px', background: 'var(--success-dim)',
              border: '2px solid var(--success)', borderRadius: 'var(--radius-md)',
              animation: stampAnimated ? 'none' : 'approvedStamp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards, celebratePulse 1s ease-out 0.5s',
              fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16,
              color: 'var(--success)', letterSpacing: '0.02em',
              marginTop: 8,
            }}>
            APPROVED
          </div>
        )}

        {/* Action-required: upload button */}
        {isActiveAction && (
          <div style={{ marginTop: 10 }}>
            <div style={{
              padding: '8px 10px', marginBottom: 8,
              background: 'var(--bg-raised)', borderRadius: 'var(--radius-sm)',
              fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.5,
              borderLeft: '2px solid var(--hitl-amber)',
            }}>
              {stage.actionDetail}
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onAdvanceFromAction(); }}
              disabled={actionUploading}
              style={{
                padding: '8px 16px', borderRadius: 'var(--radius-md)',
                border: 'none', background: actionUploading ? 'var(--text-dim)' : 'var(--mongo)',
                color: '#fff', fontFamily: 'var(--font-display)',
                fontWeight: 700, fontSize: 11, cursor: actionUploading ? 'default' : 'pointer',
                width: '100%',
              }}
            >
              {actionUploading ? '📤 Uploading & Verifying...' : `📎 ${stage.actionLabel}`}
            </button>
          </div>
        )}

        {/* Active processing indicator */}
        {isActive && !isActiveAction && !isComplete && (
          stageEvents.length > 0
            ? <ThinkingStrip events={stageEvents} />
            : (
              <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-dim)', animation: 'pulse 1.5s infinite' }}>
                {hasInterventions ? 'Investigating and resolving issues...' : 'Processing...'}
              </div>
            )
        )}

        {/* Live agent activity feed */}
        {(isActive || isCompleted) && stageEvents.length > 0 && (
          <ActivityFeed
            events={stageEvents}
            collapsed={isCompleted ? true : feedCollapsed}
            onToggle={onToggleFeed}
          />
        )}

        {/* Expandable "What happened" section */}
        {isExpanded && (
          <div style={{
            marginTop: 8, padding: '8px 10px',
            background: 'var(--bg-raised)', borderRadius: 'var(--radius-sm)',
            borderLeft: `2px solid ${hasInterventions ? 'var(--hitl-amber)' : 'var(--agent-cyan)'}`,
          }}>
            <div style={{
              fontSize: 9, fontWeight: 700,
              color: hasInterventions ? 'var(--hitl-amber)' : 'var(--agent-cyan)',
              textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4,
            }}>
              What happened
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: stage.interventions ? 8 : 0 }}>
              {stage.whatHappened}
            </div>

            {/* Intervention sub-list */}
            {stage.interventions && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
                {stage.interventions.map((intv, idx) => (
                  <div key={idx} style={{
                    padding: '6px 8px',
                    background: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-dim)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--hitl-amber)', flexShrink: 0, marginTop: 3 }} />
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--hitl-amber)', marginBottom: 2 }}>
                          Issue Detected
                        </div>
                        <div style={{ fontSize: 9, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          {intv.issue}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', flexShrink: 0, marginTop: 3 }} />
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--success)', marginBottom: 2 }}>
                          Resolved by AI
                        </div>
                        <div style={{ fontSize: 9, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          {intv.resolution}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Before/after metrics */}
            {stage.beforeAfter && (
              <div style={{
                marginTop: 8, padding: '6px 8px',
                background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--success)',
              }}>
                <div style={{
                  fontSize: 9, fontWeight: 700, color: 'var(--success)',
                  textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6,
                }}>
                  Correction Summary
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[1] }}>
                  {stage.beforeAfter.metrics.map((m, idx) => (
                    <div key={idx} style={{
                      display: 'flex', alignItems: 'center', gap: 6, fontSize: 9,
                      opacity: 0,
                      animation: `thinkingFade 300ms cubic-bezier(0.33, 1, 0.68, 1) ${idx * 100}ms forwards`,
                    }}>
                      <span style={{ color: 'var(--text-dim)', minWidth: 70 }}>{m.label}:</span>
                      <span style={{
                        color: 'var(--danger)', fontFamily: 'var(--font-mono)', fontWeight: 600,
                        textDecoration: 'line-through',
                        animation: `metricRevealBefore 250ms cubic-bezier(0.33, 1, 0.68, 1) ${idx * 100 + 50}ms both`,
                      }}>
                        {m.before}
                      </span>
                      <span style={{ color: 'var(--text-dim)' }}>→</span>
                      <span style={{
                        color: 'var(--success)', fontFamily: 'var(--font-mono)', fontWeight: 700,
                        animation: `metricRevealAfter 250ms cubic-bezier(0.33, 1, 0.68, 1) ${idx * 100 + 150}ms both`,
                      }}>
                        {m.after}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
