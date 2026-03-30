"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { apiSSE } from '../../lib/api';

const STAGES = [
  {
    id: 'received',
    label: 'Application Received',
    type: 'clean',
    detail: 'Your application APP-2026-00001 has been received and queued for processing.',
    icon: '📝',
    delayMs: 0,
    agentStatus: 'Our AI assistant is reviewing your submission...',
    whatHappened: 'Your application was received and queued for processing. All required fields validated — personal information, employment details, and loan parameters confirmed complete.',
  },
  {
    id: 'docs',
    label: 'Document Verification',
    type: 'intervention',
    detail: 'AI detected 2 issues during document analysis and resolved both automatically.',
    icon: '🧬',
    delayMs: 3000,
    agentStatus: 'AI assistant detected document issues — resolving automatically...',
    agentStatusActive: 'Our AI assistant is verifying your documents...',
    whatHappened: 'Our AI verified your CRA tax notices, bank statements, and pay stubs. Two issues were detected and resolved without requiring any action from you.',
    interventions: [
      {
        issue: 'Bank statement pages 2-3 had insufficient image quality — text extraction failed on first attempt.',
        resolution: 'AI auto-enhanced the images using voyage-multimodal-3.5 and re-processed successfully on retry. All 247 transactions extracted.',
        icon: '📄',
      },
      {
        issue: 'Pay stub shows "M. Delgado" while credit report shows "Marcus Alejandro Delgado" — name mismatch flagged.',
        resolution: 'AI cross-referenced SIN and address across all documents to confirm identity match. Name variation logged as verified alias.',
        icon: '🔍',
      },
    ],
  },
  {
    id: 'action-required',
    label: 'Additional Document Needed',
    type: 'action-required',
    detail: 'Your bank statement covers only 2 months. Our policy requires a minimum of 3 months. Please upload an additional statement.',
    icon: '⚠',
    delayMs: 4000,
    agentStatus: 'Waiting for you to upload an additional bank statement...',
    agentStatusActive: 'AI assistant identified a missing document requirement...',
    whatHappened: 'Our AI detected that your bank statement covered only January–February 2026, but policy §2.3.1 requires a minimum of 3 consecutive months. After you uploaded the December 2025 statement, the AI verified it in 320ms and resumed processing.',
    actionLabel: 'Upload December 2025 Bank Statement',
    actionDetail: 'Policy §2.3.1 requires 3 consecutive months of bank statements. Your current upload covers January–February 2026.',
  },
  {
    id: 'credit',
    label: 'Credit & Income Analysis',
    type: 'intervention',
    detail: 'AI investigated 2 discrepancies in your credit and income records and resolved both.',
    icon: '📋',
    delayMs: 5000,
    agentStatus: 'AI assistant found discrepancies in your records — investigating...',
    agentStatusActive: 'Our AI assistant is analyzing your credit and income data...',
    whatHappened: 'Credit and income analysis identified two discrepancies that the AI investigated and resolved, preventing unnecessary score penalties and ensuring accurate income reporting.',
    interventions: [
      {
        issue: '3 hard inquiries detected within 180 days, which would trigger a -8pt score penalty under policy §4.2.1.',
        resolution: 'AI identified that 2 of the 3 inquiries were rate-shopping for an auto loan within a 14-day window. Per FCAC guidelines, these are combined into 1 inquiry — effective count reduced to 2, avoiding the penalty trigger.',
        icon: '🔎',
      },
      {
        issue: 'Plaid monthly average ($18,150/mo) does not match combined T4 annualized income ($18,558/mo) — $408/mo discrepancy flagged.',
        resolution: 'AI found $4,900 in freelance deposits across the 12-month Plaid history (averaging $408/mo), fully explaining the gap. Combined income reconciled at $222,700/yr with $4,900 supplemental.',
        icon: '💰',
      },
    ],
  },
  {
    id: 'underwriting',
    label: 'Underwriting Risk Assessment',
    type: 'intervention',
    detail: 'Initial score: 68 (B). AI corrected a misclassified debt payment and improved the score to 72 (B+).',
    icon: '📊',
    delayMs: 5000,
    agentStatus: 'AI assistant corrected a scoring error — recalculating your risk profile...',
    agentStatusActive: 'Our AI assistant is running the underwriting risk assessment...',
    whatHappened: 'The 7-stage aggregation pipeline initially scored your application at 68 (B tier). The AI identified that your car loan payment was classified at the full $620/mo amount, but verified Scotiabank records show the actual payment is $482/mo. After correction, GDS dropped from 33.8% to 31.2% and the composite score improved to 72 (B+).',
    interventions: [
      {
        issue: 'Car loan payment classified at full amount ($620/mo) instead of verified Scotiabank payment ($482/mo), inflating GDS to 33.8%.',
        resolution: 'AI verified actual payment through Scotiabank loan records. Corrected monthly payment from $620 to $482, reducing GDS from 33.8% to 31.2%. Additionally, comparable borrower analysis shows 92% successful repayment for similar profiles.',
        icon: '🎓',
      },
    ],
    beforeAfter: {
      metrics: [
        { label: 'Risk Score', before: '68 (B)', after: '72 (B+)' },
        { label: 'GDS Ratio', before: '33.8%', after: '31.2%' },
        { label: 'Car Loan', before: '$620/mo', after: '$482/mo (verified)' },
      ],
    },
  },
  {
    id: 'decision',
    label: 'Decision Ready',
    type: 'clean',
    detail: 'Underwriting complete. Risk score: 72 (B+). 5 issues resolved by AI across the process.',
    icon: '✅',
    delayMs: 3000,
    agentStatus: 'Analysis complete — preparing your results...',
    whatHappened: 'Underwriting completed with a risk score of 72 (B+ tier). Throughout the process, our AI assistant resolved 5 issues autonomously and flagged 1 for your action — preventing unnecessary score penalties, correcting income records, and ensuring accurate debt calculations. The proposed rate of 4.89% reflects your corrected profile.',
  },
  {
    id: 'review',
    label: 'Officer Review',
    type: 'clean',
    detail: 'A loan officer is reviewing your application and the AI assistant\'s intervention history.',
    icon: '👤',
    delayMs: 4000,
    agentStatus: 'A loan officer is reviewing your application...',
    whatHappened: 'A senior loan officer reviewed the AI\'s assessment, including all 5 automated interventions. The officer verified the car loan correction, confirmed the FCAC rate-shopping consolidation, and approved the income reconciliation methodology.',
  },
  {
    id: 'approved',
    label: 'Approved',
    type: 'clean',
    detail: 'Congratulations! Your mortgage has been approved at 4.89% APR.',
    icon: '🎉',
    delayMs: 4000,
    agentStatus: 'Great news — your loan has been approved!',
    whatHappened: 'Your 5yr Fixed (25yr Amort) mortgage at 4.89% APR has been formally approved with a monthly payment of $4,047. Without the AI assistant\'s interventions, your application would have scored 68 (B tier) with a higher rate of 5.24%. The AI saved you an estimated $135/mo ($40,500 over the life of the loan).',
  },
  {
    id: 'active',
    label: 'Loan Active',
    type: 'clean',
    detail: 'Your mortgage is now active. $700,000 disbursed. First payment: May 1, 2026.',
    icon: '🏠',
    delayMs: 3000,
    agentStatus: 'Your loan is now active and being monitored.',
    whatHappened: 'EFT disbursement of $700,000 has been initiated to your designated account. Mortgage servicing has begun — your first payment of $4,047 is due May 1, 2026. Our AI assistant will continue to monitor your mortgage for renewal opportunities.',
  },
];

// Maps backend status values to STAGES indices for SSE-driven progression
const STATUS_TO_STAGE = {
  submitted: 0,      // received
  processing: 1,     // docs
  action_required: 2, // action-required (note underscore vs hyphen)
  credit: 3,         // credit
  underwriting: 4,   // underwriting
  decision: 5,       // decision
  review: 6,         // officer review
  approved: 7,       // approved
  declined: 7,       // declined (same position, could add distinct visual)
  funded: 8,         // active/funded
  active: 8,         // active
  error: -1,         // error state
};

function formatTime(date) {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function StatusTracker({ onNotification, applicationId }) {
  const [activeStage, setActiveStage] = useState(0);
  const [timestamps, setTimestamps] = useState([]);
  const [expandedStage, setExpandedStage] = useState(null);
  const [actionPaused, setActionPaused] = useState(false);
  const [actionUploading, setActionUploading] = useState(false);
  const [sseConnected, setSseConnected] = useState(false);
  const [isDeclined, setIsDeclined] = useState(false);
  const timerRef = useRef(null);
  const stageIdxRef = useRef(0);

  const sendNotification = useCallback((stage, time, extra) => {
    if (onNotification) onNotification({ stage, time, ...extra });
  }, [onNotification]);

  const advanceFromAction = useCallback(() => {
    if (!actionPaused) return;
    setActionUploading(true);
    sendNotification(
      { id: 'action-uploading', label: 'Document Uploading', icon: '📤', detail: 'Uploading December 2025 bank statement...' },
      new Date(),
      { subType: 'action-progress' }
    );
    setTimeout(() => {
      setActionUploading(false);
      setActionPaused(false);
      sendNotification(
        { id: 'action-complete', label: 'Document Received', icon: '✅', detail: 'Additional bank statement verified. Processing resumed.' },
        new Date(),
        { subType: 'action-resolved' }
      );
      // Continue advancing
      stageIdxRef.current++;
      if (stageIdxRef.current < STAGES.length) {
        const now = new Date();
        setActiveStage(stageIdxRef.current);
        setTimestamps((prev) => [...prev, now]);
        sendNotification(STAGES[stageIdxRef.current], now);
        // Send intervention sub-notifications
        const nextStage = STAGES[stageIdxRef.current];
        if (nextStage.interventions) {
          nextStage.interventions.forEach((intv, idx) => {
            setTimeout(() => {
              sendNotification(
                { id: `${nextStage.id}-issue-${idx}`, label: `Issue Detected`, icon: '⚠', detail: intv.issue },
                new Date(),
                { subType: 'intervention-issue', parentStage: nextStage.id }
              );
              setTimeout(() => {
                sendNotification(
                  { id: `${nextStage.id}-fix-${idx}`, label: `Resolved by AI`, icon: '🔧', detail: intv.resolution },
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
  }, [actionPaused, sendNotification]); // eslint-disable-line react-hooks/exhaustive-deps

  const advanceStageLoop = useCallback(() => {
    stageIdxRef.current++;
    if (stageIdxRef.current >= STAGES.length) return;

    const stage = STAGES[stageIdxRef.current];
    const now = new Date();
    setActiveStage(stageIdxRef.current);
    setTimestamps((prev) => [...prev, now]);
    sendNotification(stage, now);

    // Send intervention sub-notifications for stages with interventions
    if (stage.interventions) {
      stage.interventions.forEach((intv, idx) => {
        setTimeout(() => {
          sendNotification(
            { id: `${stage.id}-issue-${idx}`, label: `Issue Detected`, icon: '⚠', detail: intv.issue },
            new Date(),
            { subType: 'intervention-issue', parentStage: stage.id }
          );
          setTimeout(() => {
            sendNotification(
              { id: `${stage.id}-fix-${idx}`, label: `Resolved by AI`, icon: '🔧', detail: intv.resolution },
              new Date(),
              { subType: 'intervention-resolved', parentStage: stage.id }
            );
          }, 800);
        }, 600 + idx * 1600);
      });
    }

    // Pause at action-required stages
    if (stage.type === 'action-required') {
      setActionPaused(true);
      return;
    }

    if (stageIdxRef.current < STAGES.length - 1) {
      timerRef.current = setTimeout(advanceStageLoop, STAGES[stageIdxRef.current + 1].delayMs);
    }
  }, [sendNotification]);

  useEffect(() => {
    // SSE drives progression when connected — skip timer-based progression
    if (sseConnected) return;

    stageIdxRef.current = 0;
    setTimestamps([new Date()]);
    sendNotification(STAGES[0], new Date());

    if (STAGES.length > 1) {
      timerRef.current = setTimeout(advanceStageLoop, STAGES[1].delayMs);
    }

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [sseConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  // SSE connection for real-time backend status (supplementary to timer-based stages)
  useEffect(() => {
    if (!applicationId) return;

    const source = apiSSE(
      `/applications/${applicationId}/status`,
      (event) => {
        // Mark SSE as connected on first event
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
        setSseConnected(true);

        if (event.type === 'status' && event.status) {
          if (process.env.NODE_ENV === 'development') console.log('[StatusTracker] Real-time status:', event.status);
          if (event.status === 'declined') {
            setIsDeclined(true);
          }
          const targetIdx = STATUS_TO_STAGE[event.status];
          if (targetIdx !== undefined && targetIdx >= 0 && targetIdx > stageIdxRef.current) {
            // Clear any pending timer-based progression
            if (timerRef.current) clearTimeout(timerRef.current);
            // Advance directly to the target stage, skipping intermediate timers
            const now = new Date();
            const newTimestamps = [];
            while (stageIdxRef.current < targetIdx) {
              stageIdxRef.current++;
              newTimestamps.push(now);
              // Fire notification for each skipped/reached stage
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
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
      {applicationId && !sseConnected && (
        <div style={{ padding: '6px 12px', background: 'var(--hitl-amber-dim)', borderRadius: 'var(--radius-sm)', fontSize: 10, color: 'var(--hitl-amber)', marginBottom: 8 }}>
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
        padding: 16,
        background: 'var(--bg-surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-dim)',
        marginBottom: 16,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, color: 'var(--text-primary)' }}>Marcus & Sofia Delgado</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>APP-2026-00001 · $875,000 · 5yr Fixed (25yr Amort)</div>
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
        padding: '12px 16px',
        background: assistantBg,
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${assistantColor}`,
        marginBottom: 16,
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
      <div style={{ display: 'flex', gap: 2, padding: '0 0 24px', flexShrink: 0 }}>
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
      <div style={{ position: 'relative', paddingLeft: 28 }}>
        <div style={{ position: 'absolute', left: 11, top: 0, bottom: 0, width: 2, background: 'var(--border-dim)' }} />

        {STAGES.map((stage, i) => {
          const isCompleted = i < activeStage;
          const isActive = i === activeStage;
          const isFuture = i > activeStage;
          const isExpanded = expandedStage === stage.id;
          const canExpand = isCompleted;
          const hasInterventions = stage.type === 'intervention';
          const isActionReq = stage.type === 'action-required';
          const isActiveAction = isActive && isActionReq && actionPaused;

          // Determine node dot color
          let dotBg, dotBorder;
          if (isCompleted && hasInterventions) {
            dotBg = 'var(--success)';
            dotBorder = 'var(--success)';
          } else if (isCompleted && isActionReq) {
            dotBg = 'var(--success)';
            dotBorder = 'var(--success)';
          } else if (isCompleted) {
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

          // Card border/background
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

          return (
            <div key={stage.id} style={{
              position: 'relative',
              paddingBottom: 20,
              opacity: isFuture ? 0.35 : 1,
              transition: 'opacity 0.4s',
            }}>
              {/* Node dot */}
              <div style={{
                position: 'absolute', left: -22, top: 2,
                width: 20, height: 20, borderRadius: '50%',
                background: dotBg,
                border: `2px solid ${dotBorder}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, color: '#fff', zIndex: 1,
                animation: isActive ? 'pulse 1.5s infinite' : undefined,
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
                onClick={() => canExpand && setExpandedStage(isExpanded ? null : stage.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13,
                      color: labelColor,
                    }}>
                      {stage.id === 'approved' && isDeclined ? '❌ Declined' : `${stage.icon} ${stage.label}`}
                    </div>
                    {/* Badges */}
                    {isCompleted && hasInterventions && (
                      <span style={{
                        padding: '1px 6px', borderRadius: 6,
                        background: 'var(--success-dim)', color: 'var(--success)',
                        fontSize: 8, fontWeight: 700,
                      }}>
                        {stage.interventions.length} RESOLVED
                      </span>
                    )}
                    {isActive && hasInterventions && !isCompleted && (
                      <span style={{
                        padding: '1px 6px', borderRadius: 6,
                        background: 'var(--hitl-amber-dim)', color: 'var(--hitl-amber)',
                        fontSize: 8, fontWeight: 700,
                        animation: 'pulse 1.5s infinite',
                      }}>
                        ISSUES DETECTED
                      </span>
                    )}
                    {isActiveAction && (
                      <span style={{
                        padding: '1px 6px', borderRadius: 6,
                        background: 'var(--hitl-amber-dim)', color: 'var(--hitl-amber)',
                        fontSize: 8, fontWeight: 700,
                      }}>
                        ACTION NEEDED
                      </span>
                    )}
                    {isCompleted && isActionReq && (
                      <span style={{
                        padding: '1px 6px', borderRadius: 6,
                        background: 'var(--success-dim)', color: 'var(--success)',
                        fontSize: 8, fontWeight: 700,
                      }}>
                        UPLOADED
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {timestamps[i] && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-dim)' }}>
                        {formatTime(timestamps[i])}
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
                      onClick={(e) => { e.stopPropagation(); advanceFromAction(); }}
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

                {/* Active processing indicator (non-action stages) */}
                {isActive && !isActiveAction && !isComplete && (
                  <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-dim)', animation: 'pulse 1.5s infinite' }}>
                    {hasInterventions ? 'Investigating and resolving issues...' : 'Processing...'}
                  </div>
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
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {stage.interventions.map((intv, idx) => (
                          <div key={idx} style={{
                            padding: '6px 8px',
                            background: 'var(--bg-surface)',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-dim)',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 4 }}>
                              <span style={{ fontSize: 10, flexShrink: 0 }}>{intv.icon}</span>
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
                              <span style={{ fontSize: 10, flexShrink: 0 }}>🔧</span>
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {stage.beforeAfter.metrics.map((m, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9 }}>
                              <span style={{ color: 'var(--text-dim)', minWidth: 70 }}>{m.label}:</span>
                              <span style={{ color: 'var(--danger)', fontFamily: 'var(--font-mono)', fontWeight: 600, textDecoration: 'line-through' }}>
                                {m.before}
                              </span>
                              <span style={{ color: 'var(--text-dim)' }}>→</span>
                              <span style={{ color: 'var(--success)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
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
        })}
      </div>
    </div>
  );
}
