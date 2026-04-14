"use client";

import { spacing } from '@leafygreen-ui/tokens';
import { ThinkingStrip, ActivityFeed } from './ActivityFeed';
import { STAGES, formatTime } from './statusTrackerConstants';

export function TimelineStageCard({
  stage,
  stageContext = {},
  index,
  activeStage,
  timestamps,
  expandedStage,
  activityEvents,
  isDeclined,
  stampAnimated,
  onStampAnimated,
  feedCollapsed,
  onToggleFeed,
  onToggleExpand,
}) {
  const isCompleted = index < activeStage;
  const isActive = index === activeStage;
  const isFuture = index > activeStage;
  const isExpanded = expandedStage === stage.id;
  const canExpand = isCompleted;
  const isComplete = activeStage >= STAGES.length - 1;

  // Dynamic content from stage template functions
  const stageType = stage.getType ? stage.getType(stageContext) : (stage.type || 'clean');
  const detail = stage.getDetail ? stage.getDetail(stageContext) : (stage.detail || '');
  const interventions = stage.getInterventions ? stage.getInterventions(stageContext) : (stage.interventions || []);
  const metrics = stage.getMetrics ? stage.getMetrics(stageContext) : null;

  const hasInterventions = stageType === 'intervention';
  const isActionReq = stageType === 'action-required';

  let dotBg, dotBorder;
  if (isCompleted) {
    dotBg = 'var(--success)';
    dotBorder = 'var(--success)';
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
  if (isActive && hasInterventions) {
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

  const labelColor = isActive && hasInterventions
    ? 'var(--hitl-amber)'
    : isActive
        ? 'var(--mongo)'
        : isCompleted
          ? 'var(--text-primary)'
          : 'var(--text-dim)';

  const stageEvents = activityEvents[stage.id] || [];

  // Count resolved interventions for this stage's badge
  const resolvedCount = interventions.filter((i) => i.status === 'resolved' || i.resolution).length;

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
        {isCompleted ? '\u2713' : isActive ? stage.icon : ''}
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
            {isCompleted && interventions.length > 0 && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                padding: '2px 8px', borderRadius: 8,
                background: 'var(--success-dim)', color: 'var(--success)',
                fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)',
              }}>
                <span style={{ fontSize: 10 }}>{'\u2713'}</span>
                {resolvedCount > 0 ? `${resolvedCount} resolved by AI` : 'Reviewed'}
              </span>
            )}
            {isCompleted && interventions.length === 0 && !isActionReq && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                padding: '2px 8px', borderRadius: 8,
                background: 'var(--success-dim)', color: 'var(--success)',
                fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)',
              }}>
                <span style={{ fontSize: 10 }}>{'\u2713'}</span>
                {stage.id === 'action-required' ? 'Document verified' : 'Verified'}
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
            {isCompleted && isActionReq && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                padding: '2px 8px', borderRadius: 8,
                background: 'var(--success-dim)', color: 'var(--success)',
                fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)',
              }}>
                <span style={{ fontSize: 10 }}>{'\u2713'}</span>
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
                {'\u25BE'}
              </span>
            )}
          </div>
        </div>

        <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {stage.id === 'approved' && isDeclined
            ? (stageContext.decisionReasoning || 'Application has been declined after review.')
            : detail}
        </div>

        {stage.id === 'approved' && (isCompleted || isActive) && !isDeclined && (
          <>
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

            {/* Loan summary */}
            {(typeof stageContext.approvedRate === 'number' || typeof stageContext.monthlyPayment === 'number') && (
              <div style={{
                display: 'flex', gap: spacing[2], marginTop: 10, flexWrap: 'wrap',
                animation: 'cardEnter 0.4s cubic-bezier(0.33, 1, 0.68, 1) 0.3s both',
              }}>
                {typeof stageContext.approvedRate === 'number' && (
                  <div style={{ padding: '6px 10px', background: 'var(--bg-raised)', borderRadius: 6, textAlign: 'center' }}>
                    <div style={{ fontSize: 7, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 2 }}>Rate</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 800, color: 'var(--mongo)' }}>{(stageContext.approvedRate * 100).toFixed(2)}%</div>
                  </div>
                )}
                {typeof stageContext.monthlyPayment === 'number' && (
                  <div style={{ padding: '6px 10px', background: 'var(--bg-raised)', borderRadius: 6, textAlign: 'center' }}>
                    <div style={{ fontSize: 7, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 2 }}>Monthly</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>${stageContext.monthlyPayment.toLocaleString()}</div>
                  </div>
                )}
                {stageContext.loanAmount && (
                  <div style={{ padding: '6px 10px', background: 'var(--bg-raised)', borderRadius: 6, textAlign: 'center' }}>
                    <div style={{ fontSize: 7, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 2 }}>Loan</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>${Number(stageContext.loanAmount).toLocaleString()}</div>
                  </div>
                )}
                {stageContext.product && (
                  <div style={{ padding: '6px 10px', background: 'var(--bg-raised)', borderRadius: 6, textAlign: 'center' }}>
                    <div style={{ fontSize: 7, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 2 }}>Product</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--mongo)' }}>{stageContext.product}</div>
                  </div>
                )}
              </div>
            )}

            {/* Closing timeline */}
            <div style={{
              marginTop: 10, padding: '8px 10px',
              background: 'var(--bg-raised)', borderRadius: 'var(--radius-sm)',
              animation: 'cardEnter 0.4s cubic-bezier(0.33, 1, 0.68, 1) 0.5s both',
            }}>
              <div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-dim)', letterSpacing: '0.5px', marginBottom: 6 }}>
                Next Steps
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {['Rate Lock', 'Doc Prep', 'Signing', 'Funding'].map((step, i) => (
                  <div key={step} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%', margin: '0 auto 3px',
                      background: i === 0 ? 'var(--mongo)' : 'var(--border-dim)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 8, color: i === 0 ? '#fff' : 'var(--text-dim)', fontWeight: 700,
                    }}>
                      {i === 0 ? '\u2713' : i + 1}
                    </div>
                    <div style={{ fontSize: 8, color: i === 0 ? 'var(--mongo)' : 'var(--text-dim)', fontWeight: 600, fontFamily: 'var(--font-display)' }}>
                      {step}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Active processing indicator */}
        {isActive && !isComplete && (
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
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: (interventions.length > 0 || metrics) ? 8 : 0 }}>
              {stageEvents.length > 0
                ? `${stageEvents.length} agent action${stageEvents.length !== 1 ? 's' : ''} recorded. ${stageEvents.map((e) => e.detail).filter(Boolean).slice(0, 3).join(' \u2192 ')}`
                : 'Processing completed for this stage.'}
            </div>

            {/* Intervention sub-list */}
            {interventions.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
                {interventions.map((intv, idx) => (
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
                          {intv.issue || intv.borrower_context?.summary || intv.type}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', flexShrink: 0, marginTop: 3 }} />
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--success)', marginBottom: 2 }}>
                          {intv.status === 'resolved' ? 'Resolved by AI' : 'Action Required'}
                        </div>
                        <div style={{ fontSize: 9, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          {intv.resolution || intv.borrower_context?.action_required || ''}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Underwriting metrics summary */}
            {metrics && (
              <div style={{
                marginTop: 8, padding: '6px 8px',
                background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--success)',
              }}>
                <div style={{
                  fontSize: 9, fontWeight: 700, color: 'var(--success)',
                  textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6,
                }}>
                  Underwriting Results
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[1] }}>
                  {metrics.map((m, idx) => (
                    <div key={idx} style={{
                      display: 'flex', alignItems: 'center', gap: 6, fontSize: 9,
                      opacity: 0,
                      animation: `thinkingFade 300ms cubic-bezier(0.33, 1, 0.68, 1) ${idx * 100}ms forwards`,
                    }}>
                      <span style={{ color: 'var(--text-dim)', minWidth: 70 }}>{m.label}:</span>
                      <span style={{
                        color: 'var(--success)', fontFamily: 'var(--font-mono)', fontWeight: 700,
                      }}>
                        {m.value}
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
