"use client";

import { formatTime } from './statusTrackerConstants';

/**
 * A single high-level milestone row in the borrower status tracker.
 *
 * Amazon-style: done ✓ / current ● / upcoming, a timestamp, and one
 * plain-language line. No per-stage expandables, metrics, or agent activity —
 * the borrower sees only the milestone and its status.
 */
export function TimelineStageCard({
  stage,
  stageContext = {},
  index,
  activeStage,
  timestamps,
  isDeclined,
}) {
  const isCompleted = index < activeStage;
  const isActive = index === activeStage;
  const isFuture = index > activeStage;

  const stageType = stage.getType ? stage.getType(stageContext) : 'clean';
  const detail = stage.getDetail ? stage.getDetail(stageContext) : '';
  const isActionReq = stageType === 'action-required';

  // On the Decision milestone, reflect declined vs approved.
  const declinedHere = stage.id === 'decision' && isDeclined;

  let dotBg, dotBorder;
  if (declinedHere && (isActive || isCompleted)) {
    dotBg = 'var(--danger)';
    dotBorder = 'var(--danger)';
  } else if (isCompleted) {
    dotBg = 'var(--success)';
    dotBorder = 'var(--success)';
  } else if (isActive && isActionReq) {
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
  if (isActive && isActionReq) {
    cardBg = 'var(--hitl-amber-dim)';
    cardBorder = 'var(--hitl-amber)';
  } else if (isActive && declinedHere) {
    cardBg = 'var(--danger-dim)';
    cardBorder = 'var(--danger)';
  } else if (isActive) {
    cardBg = 'var(--mongo-dim)';
    cardBorder = 'var(--mongo)';
  } else if (isCompleted) {
    cardBg = 'var(--bg-surface)';
    cardBorder = 'var(--border-dim)';
  } else {
    cardBg = 'var(--bg-raised)';
    cardBorder = 'var(--border-dim)';
  }

  const labelColor = declinedHere
    ? 'var(--danger)'
    : isActive && isActionReq
      ? 'var(--hitl-amber)'
      : isActive
        ? 'var(--mongo)'
        : isCompleted
          ? 'var(--text-primary)'
          : 'var(--text-dim)';

  return (
    <div
      ref={isActive ? (el) => { if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } : undefined}
      style={{
        position: 'relative',
        paddingBottom: 18,
        opacity: isFuture ? 0.4 : 1,
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
        animation: isActive && !declinedHere ? 'pulse 1.5s infinite'
          : (isCompleted && index === activeStage - 1) ? 'completionBurst 300ms cubic-bezier(0.33, 1, 0.68, 1)' : undefined,
      }}>
        {declinedHere ? '✕' : isCompleted ? '✓' : isActive ? stage.icon : ''}
      </div>

      {/* Content */}
      <div style={{
        padding: '10px 14px',
        background: cardBg,
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${cardBorder}`,
        marginLeft: 8,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13,
              color: labelColor,
            }}>
              {declinedHere ? 'Decision' : stage.label}
            </div>
            {isActive && isActionReq && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                padding: '2px 8px', borderRadius: 8,
                background: 'var(--hitl-amber-dim)', color: 'var(--hitl-amber)',
                fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)',
                animation: 'pulse 1.5s infinite',
              }}>
                ACTION NEEDED
              </span>
            )}
            {isCompleted && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                padding: '2px 8px', borderRadius: 8,
                background: 'var(--success-dim)', color: 'var(--success)',
                fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)',
              }}>
                <span style={{ fontSize: 10 }}>{'✓'}</span>
                Done
              </span>
            )}
          </div>
          {timestamps[index] && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-dim)' }}>
              {formatTime(timestamps[index])}
            </span>
          )}
        </div>

        {(isActive || isCompleted) && detail && (
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {detail}
          </div>
        )}
      </div>
    </div>
  );
}
