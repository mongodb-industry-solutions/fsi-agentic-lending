"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { spacing } from '@leafygreen-ui/tokens';
import { apiSSE, apiGet, apiPost } from '../../lib/api';
import { STAGES, STATUS_TO_STAGE } from './statusTrackerConstants';
import { SavingsSummary } from './SavingsSummary';
import { TimelineStageCard } from './TimelineStageCard';

function ApprovalContextCard({ stageContext }) {
  // Borrower-facing: qualitative summary only. No risk score/tier, GDS/TDS,
  // or credit score — those remain officer-only.
  return (
    <div style={{
      padding: spacing[3],
      background: 'var(--bg-surface)',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--success)',
      borderLeft: '4px solid var(--success)',
      marginTop: spacing[3],
      animation: 'cardEnter 0.4s cubic-bezier(0.33, 1, 0.68, 1) both',
    }}>
      <div style={{
        fontFamily: 'var(--font-display)', fontWeight: 700,
        fontSize: 13, color: 'var(--success)', marginBottom: spacing[2],
      }}>
        Your Application Was Approved
      </div>
      <div style={{
        fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.5,
      }}>
        Your income, credit, and documentation met our lending criteria
        {stageContext.product ? ` for the ${stageContext.product}` : ''}. Your
        Personal Lending Assistant can walk you through your rate, payment, and
        next steps toward closing.
      </div>
    </div>
  );
}

function DeclineCard({ stageContext, onOpenChat }) {
  // Borrower-facing: qualitative reason only (no ratios/scores). The reasoning
  // text comes from the backend's borrower-safe decline_reason.
  const reasoning = stageContext.declineReason
    || 'We’re unable to approve this application at this time.';
  const r = reasoning.toLowerCase();

  // Map the qualitative reason to actionable guidance — no numbers.
  const guidance = [];
  if (r.includes('afford')) {
    guidance.push('Consider increasing your down payment or choosing a less expensive property to improve affordability.');
    guidance.push('Reducing existing monthly debt payments can also help.');
  }
  if (r.includes('income')) guidance.push('Ensure all income documentation is uploaded and accurate, including employment letters, pay stubs, and tax notices.');
  if (r.includes('credit')) guidance.push('Review your credit report for errors and consider resolving any outstanding debts before reapplying.');
  if (guidance.length === 0) guidance.push('Speak with a loan officer for personalized guidance on your application and next steps.');

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
          Speak with your Lending Assistant
        </button>
      )}
    </div>
  );
}

// Button label for the "Provide Information" upload flow.
function getProvideLabel(state) {
  switch (state) {
    case 'uploading': return 'Uploading...';
    case 'extracting': return 'Extracting data...';
    case 'processing': return 'Processing...';
    case 'done': return '✓ Documents Uploaded — Resuming Review';
    case 'error': return 'Upload Failed — Retry';
    default: return 'Provide Information';
  }
}

const DOC_TYPE_LABELS = {
  government_id: 'Government ID',
  employment_letter: 'Employment Letter',
  paystubs: 'Pay Stubs',
  income_tax: 'CRA Tax Notices',
  bank_statements: 'Bank Statements',
  purchase_agreement: 'Purchase Agreement',
  investment_statements: 'Investment Statements',
  other_property_docs: 'Property Docs',
  mortgage_application: 'Mortgage Application',
  utility_bills: 'Utility Bills',
  credit_report: 'Credit Report',
  car_loan_statement: 'Car Loan Statement',
  property_tax: 'Property Tax',
  property_inspection: 'Property Inspection',
};

// Timestamped log of each step the "Provide Information" flow actually carried
// out — what was uploaded, when, and what happened after. Entries come only
// from real API results, so the log reflects genuine backend activity.
function ProvideLog({ entries }) {
  if (!entries || entries.length === 0) return null;
  return (
    <div style={{
      marginTop: spacing[2],
      padding: spacing[2],
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-dim)',
      borderRadius: 'var(--radius-sm)',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{
        fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.05em', color: 'var(--text-dim)',
        fontFamily: 'var(--font-display)', marginBottom: 2,
      }}>
        Steps Carried Out
      </div>
      {entries.map((e, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 9,
            color: 'var(--text-dim)', flexShrink: 0,
          }}>
            {e.time}
          </span>
          <span style={{
            fontSize: 10, lineHeight: 1.5,
            color: e.error ? 'var(--danger)' : 'var(--text-secondary)',
          }}>
            {e.error ? '✗ ' : '✓ '}{e.text}
          </span>
        </div>
      ))}
    </div>
  );
}

function ActionNeededBanner({ actions, onProvide, provideState, provideLog }) {
  if (!actions || actions.length === 0) return null;
  const inProgress = provideState === 'uploading' || provideState === 'extracting' || provideState === 'processing';
  const isDone = provideState === 'done';
  const isError = provideState === 'error';
  return (
    <div style={{
      padding: spacing[3],
      background: 'var(--hitl-amber-dim)',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--hitl-amber)',
      borderLeft: '4px solid var(--hitl-amber)',
      marginBottom: spacing[3],
      animation: 'cardEnter 0.4s cubic-bezier(0.33, 1, 0.68, 1) both',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: spacing[2],
      }}>
        <span style={{ fontSize: 14 }}>⚠️</span>
        <span style={{
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13,
          color: 'var(--hitl-amber)',
        }}>
          Action Needed
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[2], marginBottom: spacing[3] }}>
        {actions.map((a, i) => (
          <div key={i} style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {a.borrower_context?.summary || 'Additional information requested'}
            </div>
            {a.borrower_context?.action_required && (
              <div style={{ marginTop: 2 }}>{a.borrower_context.action_required}</div>
            )}
          </div>
        ))}
      </div>
      {onProvide && (
        <button
          type="button"
          onClick={onProvide}
          disabled={inProgress || isDone}
          style={{
            width: '100%', padding: '10px 16px',
            background: isDone ? 'var(--success)' : isError ? 'var(--danger)' : 'var(--hitl-amber)',
            color: '#fff',
            border: 'none', borderRadius: 'var(--radius-md)',
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12,
            cursor: inProgress || isDone ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            opacity: inProgress ? 0.85 : 1,
          }}
        >
          {inProgress && (
            <span style={{
              display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
              border: '2px solid currentColor', borderTopColor: 'transparent',
              animation: 'spin 0.8s linear infinite',
              flexShrink: 0,
            }} />
          )}
          {getProvideLabel(provideState)}
        </button>
      )}
      <ProvideLog entries={provideLog} />
    </div>
  );
}

export default function StatusTracker({ onNotification, applicationId, applicationData, onOpenChat, onDocumentUploaded }) {
  const [activeStage, setActiveStage] = useState(0);
  const [timestamps, setTimestamps] = useState([]);
  const [sseConnected, setSseConnected] = useState(false);
  const [isDeclined, setIsDeclined] = useState(false);
  const [timelineCtx, setTimelineCtx] = useState(null);
  // idle | uploading | extracting | processing | done | error
  const [provideState, setProvideState] = useState('idle');
  const [provideLog, setProvideLog] = useState([]);
  const stageContextRef = useRef({});
  const stageIdxRef = useRef(0);
  const provideTimersRef = useRef([]);
  const mountedRef = useRef(true);
  useEffect(() => () => {
    mountedRef.current = false;
    provideTimersRef.current.forEach(clearTimeout);
  }, []);

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

  // SSE connection for real-time backend status, with REST polling fallback.
  useEffect(() => {
    if (!applicationId) return;
    setIsDeclined(false);
    stageIdxRef.current = 0;
    setActiveStage(0);
    setTimestamps([]);
    let sseAlive = false;
    let pollInterval = null;

    const source = apiSSE(
      `/applications/${applicationId}/status`,
      (event) => {
        sseAlive = true;
        setSseConnected(true);
        if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }

        if (event.type === 'status' && event.status) {
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

  // Fetch borrower-safe timeline context — debounced re-fetch as stages advance.
  // Generation guard: a stale response from a previous applicationId must not
  // overwrite the freshly-fetched context after a borrower switch.
  const ctxGenRef = useRef(0);
  const refreshTimelineCtx = useCallback(() => {
    if (!applicationId) return;
    const gen = ++ctxGenRef.current;
    apiGet(`/applications/${applicationId}/timeline-context`).then(
      (data) => { if (mountedRef.current && ctxGenRef.current === gen && data) setTimelineCtx(data); }
    ).catch(() => {});
  }, [applicationId]);

  useEffect(() => {
    if (!applicationId) return;
    const timer = setTimeout(refreshTimelineCtx, activeStage === 0 ? 0 : 250);
    return () => clearTimeout(timer);
  }, [applicationId, activeStage, refreshTimelineCtx]);

  // Reset the provide-info flow when switching applications.
  useEffect(() => {
    setProvideState('idle');
    setProvideLog([]);
    provideTimersRef.current.forEach(clearTimeout);
    provideTimersRef.current = [];
  }, [applicationId]);

  // Build context for milestone template functions. Only borrower-safe fields.
  const stageContext = useMemo(() => {
    const app = timelineCtx?.application || {};
    const interventions = timelineCtx?.interventions || [];
    const active = interventions.filter((i) => i.status !== 'superseded');

    // Only surface interventions the borrower can actually ACT on (upload a
    // document). Advisory/escalation/credit-info interventions are informational
    // — they must not appear as "Action Needed" (the borrower has nothing to do).
    const ACTIONABLE_TYPES = ['missing_document', 'document_processing_error'];
    const pendingActions = active.filter(
      (i) => i.status === 'pending' && ACTIONABLE_TYPES.includes(i.type)
    );

    return {
      appId: applicationId,
      loanAmount: app.loan_amount,
      product: app.product,
      // Raw status drives "a loan officer is reviewing" framing only — never a
      // number. Underwriting internals stay officer-only.
      rawStatus: app.status,
      declineReason: app.decline_reason,
      borrowerNames: app.borrower_names || [],
      approvedRate: app.approved_rate,
      monthlyPayment: app.monthly_payment,
      isDeclined,
      pendingActions,
    };
  }, [timelineCtx, applicationId, isDeclined]);
  stageContextRef.current = stageContext;

  // "Provide Information" — HUMAN-TRIGGERED ONLY (the banner button's onClick is
  // the sole entry point; nothing in this component or the backend invokes it
  // automatically). Upload the requested documents (demo-upload of the
  // pre-seeded PDFs, same pipeline the chat InterventionCard uses), then
  // resolve the intervention(s). The resolve endpoint auto-triggers the
  // pipeline re-evaluate once no blocking interventions remain, so processing
  // resumes. Each real step is appended to a timestamped log so the borrower
  // can see exactly what was carried out, what, and when.
  const addProvideLog = useCallback((text, error = false) => {
    const time = new Date().toLocaleTimeString([], { hour12: false });
    setProvideLog((prev) => [...prev, { time, text, error }]);
  }, []);

  const handleProvideInfo = useCallback(async () => {
    if (!applicationId) return;
    if (provideState !== 'idle' && provideState !== 'error') return;
    const actionable = stageContextRef.current.pendingActions;
    if (!actionable || actionable.length === 0) return;

    setProvideState('uploading');
    if (provideState === 'error') setProvideLog([]);
    addProvideLog('You clicked "Provide Information" — starting document upload');
    // Simulated staged progress, mirroring InterventionCard's UX.
    const extractTimer = setTimeout(() => setProvideState((s) => (s === 'uploading' ? 'extracting' : s)), 1200);
    const processTimer = setTimeout(() => setProvideState((s) => ((s === 'uploading' || s === 'extracting') ? 'processing' : s)), 3000);
    provideTimersRef.current = [extractTimer, processTimer];

    try {
      for (const action of actionable) {
        for (const docType of action.borrower_context?.document_types_accepted || []) {
          const label = DOC_TYPE_LABELS[docType] || docType;
          addProvideLog(`Uploading ${label}...`);
          const result = await apiPost(`/applications/${applicationId}/documents/demo-upload/${docType}`, {});
          if (!mountedRef.current) return;
          if (!result || result.error) {
            addProvideLog(`${label} upload failed${result?.error ? `: ${result.error}` : ''}`, true);
            throw new Error('document upload failed');
          }
          addProvideLog(`${label} uploaded — data extracted and indexed`);
        }
      }

      for (const action of actionable) {
        if (action._id) {
          const resolved = await apiPost(`/chat/${applicationId}/interventions/${action._id}/resolve`);
          if (!mountedRef.current) return;
          if (!resolved || resolved.error) {
            addProvideLog('Marking the request as answered failed — please retry', true);
            throw new Error('intervention resolve failed');
          }
          addProvideLog('Request marked as answered — notifying the lending team');
        }
      }

      if (onDocumentUploaded) onDocumentUploaded();
      addProvideLog('Review resumed — your application is being re-evaluated');
      setProvideState('done');
      // Re-fetch so the banner clears even if the status change hasn't
      // advanced a timeline stage yet.
      refreshTimelineCtx();
    } catch (err) {
      console.warn('[StatusTracker] provide information failed:', err);
      if (mountedRef.current) setProvideState('error');
    } finally {
      provideTimersRef.current.forEach(clearTimeout);
      provideTimersRef.current = [];
    }
  }, [applicationId, provideState, onDocumentUploaded, refreshTimelineCtx, addProvideLog]);

  // Re-arm the Provide Information button when a NEW set of pending actions
  // appears (e.g. the post-resolve re-evaluate surfaced another missing
  // document). The initial pending set and the cleared (post-resolve) state
  // don't reset — 'done' should persist while the banner is on its way out.
  const pendingIdsRef = useRef(null);
  useEffect(() => {
    const ids = stageContext.pendingActions.map((a) => a._id).join(',');
    if (pendingIdsRef.current === null) {
      pendingIdsRef.current = ids;
      return;
    }
    if (ids !== pendingIdsRef.current) {
      pendingIdsRef.current = ids;
      if (ids) {
        setProvideState('idle');
        setProvideLog([]);
      }
    }
  }, [stageContext.pendingActions]);

  // "Approved" (positive/complete state) is reached at the Decision milestone,
  // not only at Funded — so the approval summary shows as soon as it's approved.
  const isApproved = !isDeclined && activeStage >= STATUS_TO_STAGE.approved;
  const currentStage = STAGES[activeStage];

  const statusLabel = isDeclined
    ? 'Not Approved'
    : activeStage >= STATUS_TO_STAGE.funded
      ? 'Funded'
      : isApproved
        ? 'Approved'
        : 'In Progress';
  const statusColor = isDeclined ? 'var(--danger)' : isApproved ? 'var(--success)' : 'var(--mongo)';

  const currentAgentStatus = currentStage?.getAgentStatus
    ? currentStage.getAgentStatus(stageContext)
    : 'We’re reviewing your application.';

  // Prefer backend data over stale form data for summary card
  const displayName = stageContext.borrowerNames?.length > 0
    ? stageContext.borrowerNames.join(' & ')
    : applicationData
      ? [applicationData.firstName, applicationData.coApplicantName ? `& ${applicationData.coApplicantName.split(' ')[0]}` : null, applicationData.lastName].filter(Boolean).join(' ')
      : 'Application';
  const displayAmount = stageContext.loanAmount || (applicationData ? Number(applicationData.loanAmount) : null);
  const displayProduct = stageContext.product || applicationData?.productType || '';

  const assistantColor = isApproved ? 'var(--success)' : 'var(--agent-cyan)';
  const assistantBg = isApproved ? 'var(--success-dim)' : 'var(--agent-cyan-dim)';

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
            Loading your application status...
          </div>
          <div style={{
            fontSize: 11,
            color: 'var(--text-dim)',
            textAlign: 'center',
            maxWidth: 300,
            lineHeight: 1.5,
          }}>
            Fetching the latest status of your application.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: `20px ${spacing[4]}px` }}>
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
            {[applicationId, displayAmount ? `$${Number(displayAmount).toLocaleString('en-US')}` : null, displayProduct].filter(Boolean).join(' · ')}
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

      {/* Personal Lending Assistant status line — the single assistant identity */}
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
        {!isApproved && (
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: assistantColor,
            boxShadow: `0 0 8px ${assistantColor}`,
            animation: 'pulse 1.5s infinite',
            flexShrink: 0,
          }} />
        )}
        {isApproved && (
          <span style={{ fontSize: 14, flexShrink: 0 }}>✅</span>
        )}
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12,
            color: assistantColor, marginBottom: 2,
          }}>
            {isApproved ? 'All Set' : 'Personal Lending Assistant'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            {currentAgentStatus}
          </div>
        </div>
      </div>

      {/* Action needed — pending info the loan officer requested */}
      {!isApproved && !isDeclined && (
        <ActionNeededBanner
          actions={stageContext.pendingActions}
          onProvide={handleProvideInfo}
          provideState={provideState}
          provideLog={provideLog}
        />
      )}

      {/* Segmented progress rail */}
      <div style={{ display: 'flex', gap: 2, padding: `0 0 ${spacing[4]}px`, flexShrink: 0 }}>
        {STAGES.map((stage, i) => {
          const isSegComplete = i < activeStage;
          const isSegActive = i === activeStage;
          return (
            <div key={stage.id} style={{
              flex: 1, height: 4, borderRadius: 2,
              background: isSegComplete ? 'var(--mongo)' : isSegActive ? (isDeclined ? 'var(--danger)' : 'var(--hitl-amber)') : 'var(--border-dim)',
              transition: 'background 0.4s ease',
              animation: isSegActive && !isDeclined ? 'pulse 1.5s infinite' : undefined,
            }} />
          );
        })}
      </div>

      {/* Milestone timeline */}
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
            isDeclined={isDeclined}
          />
        ))}
      </div>

      {/* Post-Approval Context + Summary */}
      {isApproved && !isDeclined && (
        <>
          <ApprovalContextCard stageContext={stageContext} />
          <SavingsSummary stageContext={stageContext} />
        </>
      )}

      {/* Decline Experience Card */}
      {isDeclined && (
        <DeclineCard stageContext={stageContext} onOpenChat={onOpenChat} />
      )}
    </div>
  );
}
