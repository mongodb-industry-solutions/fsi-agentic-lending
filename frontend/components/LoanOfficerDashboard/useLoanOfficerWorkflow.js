"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { apiPost, apiGet, apiSSE, apiWebSocket } from '../../lib/api';
import { agentToStageIdx, WORKFLOW_STAGES } from './constants';
import { SEED_DEMO_APPS, getDemoSeedDetail, isDemoSeed } from '../../lib/data/seedDemoApps';

const MAX_ACTIVITY_EVENTS = 200;

/**
 * Pure helper: derive workflow UI state from the live queue status.
 * Used both when the selected app changes and when the queue WS pushes
 * a status change for the already-selected app.
 */
function deriveWorkflowStateFromStatus(status) {
  if (!status) return { phase: 'preview', stage: 0, hitl: false, approved: false, approvalMode: null };
  if (status === 'review' || status === 'pending_review') {
    return { phase: 'executing', stage: 2, hitl: true, approved: false, approvalMode: null };
  }
  if (status === 'processing') {
    return { phase: 'executing', stage: 0, hitl: false, approved: false, approvalMode: null };
  }
  if (status === 'underwriting') {
    return { phase: 'executing', stage: 1, hitl: false, approved: false, approvalMode: null };
  }
  if (status === 'approved' || status === 'closing' || status === 'funded' || status === 'active') {
    return { phase: 'executing', stage: WORKFLOW_STAGES.length - 1, hitl: false, approved: true, approvalMode: 'auto' };
  }
  if (status === 'declined') {
    return { phase: 'executing', stage: WORKFLOW_STAGES.length - 1, hitl: false, approved: true, approvalMode: 'declined' };
  }
  return { phase: 'preview', stage: 0, hitl: false, approved: false, approvalMode: null };
}

function activityFromSseEvent(event, source) {
  const ts = event.timestamp ? new Date(event.timestamp).getTime() : Date.now();
  // Stable dedup key: backend _id if present, else content-hash. SSE backlog
  // and polling-fallback can re-deliver the same event; random-suffixed ids
  // defeat Set dedup, so we key on something deterministic instead.
  const backendId = event._id || event.id || null;
  const dedupKey = backendId
    ? `id:${backendId}`
    : `c:${ts}|${event.type || ''}|${event.agent || ''}|${event.action || ''}|${event.name || ''}|${(event.detail || '').slice(0, 64)}`;
  const base = { id: `${source}-${ts}-${Math.random()}`, _dedupKey: dedupKey, _ts: ts, isLive: source !== 'backlog' };

  if (event.type === 'agent_step') {
    return {
      ...base,
      kind: 'activity',
      agent: event.agent || 'System',
      action: event.action || '',
      detail: event.detail || '',
      isLive: !event.backlog,
    };
  }
  if (event.type === 'node_start') {
    return {
      ...base,
      kind: 'node_start',
      agent: event.agent || event.name || 'node',
      action: 'node_start',
      detail: '',
    };
  }
  if (event.type === 'node_complete') {
    const output = event.output || {};
    const fieldKeys = Object.keys(output).slice(0, 4).join(', ');
    return {
      ...base,
      kind: 'node_complete',
      agent: event.agent || event.name || 'node',
      action: 'node_complete',
      detail: fieldKeys ? `fields: ${fieldKeys}` : '',
      output,
    };
  }
  if (event.type === 'hitl_waiting') {
    return {
      ...base,
      kind: 'hitl',
      agent: 'hitl_gate',
      action: 'hitl_waiting',
      detail: 'Pipeline paused — awaiting officer decision',
    };
  }
  if (event.type === 'complete') {
    return {
      ...base,
      kind: 'complete',
      agent: 'supervisor',
      action: 'pipeline_complete',
      detail: 'Pipeline complete',
    };
  }
  return null;
}

export function useLoanOfficerWorkflow(addToast, active = true) {
  const [selectedApp, setSelectedApp] = useState(null);
  const [workflowPhase, setWorkflowPhase] = useState('idle');
  const [workflowStage, setWorkflowStage] = useState(0);
  const [hitlReached, setHitlReached] = useState(false);
  const [hitlStartTime, setHitlStartTime] = useState(null);
  const [hitlResolutionTime, setHitlResolutionTime] = useState(null);
  const [approved, setApproved] = useState(false);
  const [approvalDetails, setApprovalDetails] = useState(null);
  const [liveAgentOutput, setLiveAgentOutput] = useState({});
  const [activityEvents, setActivityEvents] = useState([]);
  const [streamConnected, setStreamConnected] = useState(false);
  const [streamError, setStreamError] = useState(false);
  const activitySSERef = useRef(null);
  const stageTimestampsRef = useRef({});
  const [stageTimestamps, setStageTimestamps] = useState({});
  // Mirror of workflowStage for synchronous reads inside event handlers so
  // we don't have to do side-effects (setStageTimestamps) inside a setState
  // updater. StrictMode double-invokes updaters; keeping them pure is safer.
  const currentStageRef = useRef(0);
  const executingStartRef = useRef(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [liveApplications, setLiveApplications] = useState([]);
  // Decorative seed apps carry module-load `Date.now()` timestamps, so rendering
  // them into SSR HTML would mismatch the client (React hydration error #418).
  // Merge them only after the component has mounted.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const [selectedAppDetail, setSelectedAppDetail] = useState(null);
  const [portfolioStats, setPortfolioStats] = useState(null);
  const [officer, setOfficer] = useState(null);
  const prevStatsRef = useRef({});

  // Fetch the reviewing loan officer once (seeded singleton). Used for header
  // identity and to attribute HITL decisions.
  useEffect(() => {
    let ignore = false;
    apiGet('/officers/current')
      .then((data) => { if (!ignore && data) setOfficer(data); })
      .catch(() => {});
    return () => { ignore = true; };
  }, []);

  const snapshotReceived = useRef(false);
  const selectedAppRef = useRef(selectedApp);
  selectedAppRef.current = selectedApp;
  const liveApplicationsRef = useRef(liveApplications);
  liveApplicationsRef.current = liveApplications;
  // Keep currentStageRef aligned with the committed state.
  currentStageRef.current = workflowStage;

  // Decorative APP-DEMO-* selection? These have no backend record, so the
  // per-app detail fetch + activity SSE must never fire for them. Module lookup
  // is used instead of a find on `applicationsForDisplay`, which is declared
  // later in the hook (TDZ).
  const isSeedSelection = isDemoSeed(selectedApp);

  // Advance the stage pointer and record its entry timestamp. All side
  // effects happen outside setState updaters to stay StrictMode-safe.
  const advanceStage = useCallback((stageIdx, markNext = false) => {
    if (stageIdx == null || stageIdx < 0) return;
    const prev = currentStageRef.current;
    const tsMap = stageTimestampsRef.current;
    let changed = false;
    if (stageIdx > prev && tsMap[stageIdx] == null) {
      tsMap[stageIdx] = Date.now();
      changed = true;
    }
    if (markNext && stageIdx >= prev && tsMap[stageIdx + 1] == null) {
      tsMap[stageIdx + 1] = Date.now();
      changed = true;
    }
    if (changed) setStageTimestamps({ ...tsMap });
    if (stageIdx > prev) {
      currentStageRef.current = stageIdx;
      setWorkflowStage(stageIdx);
    }
  }, []);

  // ── Activity event fan-out ─────────────────────────────────────────────
  const appendActivityEvents = useCallback((entries) => {
    if (!entries || entries.length === 0) return;
    setActivityEvents((prev) => {
      // Cap and dedupe by stable content/id key. `id` itself carries a random
      // suffix for React list keys; dedup must use `_dedupKey` instead, else
      // the same backend event re-delivered via backlog + polling fallback
      // renders twice.
      const merged = [...entries, ...prev];
      const seen = new Set();
      const out = [];
      for (const e of merged) {
        const key = e._dedupKey || e.id;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(e);
        if (out.length >= MAX_ACTIVITY_EVENTS) break;
      }
      return out;
    });
  }, []);

  // Real-time application queue via WebSocket + MongoDB Change Stream,
  // with REST fallback when WebSocket cannot connect through Next.js proxy.
  // Gated on `active` to avoid connections when the officer tab is hidden.
  useEffect(() => {
    if (!active) return;

    snapshotReceived.current = false;
    let pollInterval = null;

    apiGet('/applications').then((apps) => {
      if (Array.isArray(apps) && apps.length > 0 && !snapshotReceived.current) {
        setLiveApplications(apps);
      }
    }).catch(() => {});

    const ws = apiWebSocket('/applications/ws', {
      onMessage: (data) => {
        if (data.type === 'snapshot') {
          snapshotReceived.current = true;
          if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
          setLiveApplications(data.applications ?? []);
        } else if (data.type === 'change' && snapshotReceived.current) {
          const app = data.application;
          if (app) {
            setLiveApplications((prev) => {
              const idx = prev.findIndex((a) => a.application_id === app.application_id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = app;
                return next;
              }
              return [app, ...prev];
            });
            if (app.application_id === selectedAppRef.current) {
              apiGet(`/applications/${app.application_id}`).then((detail) => {
                if (detail) setSelectedAppDetail(detail);
              });
            }
          }
        }
      },
    });

    pollInterval = setInterval(() => {
      if (snapshotReceived.current) { clearInterval(pollInterval); pollInterval = null; return; }
      apiGet('/applications').then((apps) => {
        if (Array.isArray(apps) && !snapshotReceived.current) {
          setLiveApplications(apps);
        }
      }).catch(() => {});
    }, 10000);

    return () => {
      ws.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [active]);

  useEffect(() => {
    if (!active) return;
    apiGet('/portfolio/stats').then((data) => {
      if (data) setPortfolioStats(data);
    }).catch(() => {});
  }, [active]);

  useEffect(() => {
    if (!selectedApp) {
      setSelectedAppDetail(null);
      return;
    }
    // Seed selections resolve their detail from the hardcoded module instead
    // of a backend fetch (which would 404 — the records don't exist).
    if (isSeedSelection) {
      setSelectedAppDetail(getDemoSeedDetail(selectedApp));
      return;
    }
    apiGet(`/applications/${selectedApp}`).then((data) => {
      setSelectedAppDetail(data);
    });
  }, [selectedApp, isSeedSelection]);

  // Merge the decorative seed apps ahead of the real queue for display + stats.
  // Kept separate from `liveApplications` so internal selection/WS-matching logic
  // (which only ever deals with real backend IDs) is untouched.
  const applicationsForDisplay = useMemo(
    () => (mounted ? [...SEED_DEMO_APPS, ...liveApplications] : liveApplications),
    [liveApplications, mounted]
  );

  const dashboardStats = useMemo(() => {
    const pendingCount = applicationsForDisplay.filter(
      (a) => ['review', 'pending_review'].includes(a.status)
    ).length;
    const approvedCount = applicationsForDisplay.filter((a) => a.status === 'approved').length;
    const processingCount = applicationsForDisplay.filter((a) => a.status === 'processing' || a.status === 'underwriting').length;

    // Average agentic decision time across apps that report one (seed apps carry
    // `decision_ms`; real apps expose it via `decision_ms` when the pipeline persists it).
    const decisionTimes = applicationsForDisplay
      .map((a) => a.decision_ms)
      .filter((ms) => typeof ms === 'number' && ms > 0);
    const avgDecisionMs = decisionTimes.length
      ? decisionTimes.reduce((sum, ms) => sum + ms, 0) / decisionTimes.length
      : null;

    const prev = prevStatsRef.current;
    const trend = (key, current) => {
      const p = prev[key];
      if (p == null) return '';
      if (current > p) return '\u2191';
      if (current < p) return '\u2193';
      return '';
    };

    const stats = [
      { label: 'Applications', value: String(applicationsForDisplay.length), color: 'var(--mongo)', trend: trend('total', applicationsForDisplay.length) },
      { label: 'Processing', value: String(processingCount), color: 'var(--agent-cyan)', trend: trend('processing', processingCount) },
      { label: 'Approved', value: String(approvedCount), color: 'var(--success)', trend: trend('approved', approvedCount) },
      { label: 'Pending Reviews', value: String(pendingCount), color: 'var(--hitl-amber)', trend: trend('pending', pendingCount) },
    ];

    if (avgDecisionMs != null) {
      stats.push({
        label: 'Avg Decision Time',
        value: `${(avgDecisionMs / 1000).toFixed(1)}s`,
        color: 'var(--tool-blue)',
      });
    }

    if (portfolioStats) {
      if (portfolioStats.total_portfolio_value) {
        stats.push({ label: 'Portfolio Value', value: `$${(portfolioStats.total_portfolio_value / 1_000_000).toFixed(1)}M`, color: 'var(--mongo)' });
      }
      if (portfolioStats.active_loans != null) {
        stats.push({ label: 'Active Loans', value: String(portfolioStats.active_loans), color: 'var(--tool-blue)' });
      }
    }

    return stats;
  }, [applicationsForDisplay, portfolioStats]);

  useEffect(() => {
    const processingCount = applicationsForDisplay.filter((a) => a.status === 'processing' || a.status === 'underwriting').length;
    const approvedCount = applicationsForDisplay.filter((a) => a.status === 'approved').length;
    const pendingCount = applicationsForDisplay.filter((a) => ['review', 'pending_review'].includes(a.status)).length;
    prevStatsRef.current = { total: applicationsForDisplay.length, processing: processingCount, approved: approvedCount, pending: pendingCount };
  }, [applicationsForDisplay]);

  // ── Single persistent activity SSE per selected app ────────────────────
  useEffect(() => {
    // Close any prior stream first
    if (activitySSERef.current) { activitySSERef.current.close(); activitySSERef.current = null; }
    setStreamConnected(false);
    setStreamError(false);

    // Seeds have no backend agent stream — skip (the close + resets above still
    // clear any state from a previously-selected real app).
    if (!selectedApp || isSeedSelection) return;

    const handle = apiSSE(
      `/agent/${selectedApp}/stream`,
      (event) => {
        if (event.type === 'connected') {
          setStreamConnected(true);
          setStreamError(false);
          return;
        }

        const entry = activityFromSseEvent(event, 'activity');
        if (!entry) return;
        appendActivityEvents([entry]);

        // Drive workflow stage from backlog+live events
        const stageIdx = agentToStageIdx(entry.agent);
        if (stageIdx != null) advanceStage(stageIdx);

        if (entry.agent === 'hitl_gate' && (entry.action === 'interrupt' || entry.action === 'hitl_waiting')) {
          setHitlReached(true);
          setHitlStartTime((prev) => prev || Date.now());
        }
        if (entry.action === 'pipeline_complete' || entry.kind === 'complete') {
          setApproved((prev) => prev || true);
          setHitlResolutionTime((prev) => prev || Date.now());
          setApprovalDetails((prev) => prev || { mode: 'auto' });
        }
      },
      {
        onConnect: () => { setStreamConnected(true); setStreamError(false); },
        onError: () => setStreamError(true),
        onClose: () => { setStreamConnected(false); },
        autoCloseOn: [], // never auto-close; we manage the lifetime per-app
      },
    );

    activitySSERef.current = handle;

    return () => {
      if (handle) handle.close();
      activitySSERef.current = null;
    };
  }, [selectedApp, isSeedSelection, appendActivityEvents, advanceStage]);

  // ── Reset everything when selected app changes ─────────────────────────
  useEffect(() => {
    // Clear per-app state first
    setWorkflowStage(0);
    currentStageRef.current = 0;
    setHitlReached(false); setHitlStartTime(null); setHitlResolutionTime(null);
    setApproved(false);
    setApprovalDetails(null);
    setLiveAgentOutput({});
    setActivityEvents([]);
    stageTimestampsRef.current = {};
    setStageTimestamps({});

    if (!selectedApp) {
      setWorkflowPhase('idle');
      return;
    }

    // Seeds live in the hardcoded module, not in `liveApplications` (raw state),
    // so resolve their status from the module. Keeps hitlReached/approved phase
    // consistent for the Agent Rail when a seed is selected.
    const queueApp = isSeedSelection
      ? getDemoSeedDetail(selectedApp)
      : liveApplicationsRef.current.find((a) => a.application_id === selectedApp);
    const status = queueApp?.status || 'submitted';
    const derived = deriveWorkflowStateFromStatus(status);

    // "submitted" is the only state that starts in preview; everything else
    // starts in executing so the activity stream has a surface to render into.
    if (status === 'submitted' || status === 'error') {
      setWorkflowPhase('preview');
      return;
    }

    setWorkflowPhase(derived.phase);
    setWorkflowStage(derived.stage);
    currentStageRef.current = derived.stage;
    if (derived.hitl) {
      setHitlReached(true);
      setHitlStartTime(Date.now());
    }
    if (derived.approved) {
      setApproved(true);
      setHitlResolutionTime(Date.now());
      setApprovalDetails({ mode: derived.approvalMode });
    }
  }, [selectedApp, isSeedSelection]);

  // ── Phase follows live queue status transitions ────────────────────────
  // When the WS pushes a status change for the already-selected app (e.g.
  // processing → underwriting → review → approved), re-derive phase/stage
  // without blowing away liveAgentOutput or activityEvents.
  const selectedQueueStatus = liveApplications.find((a) => a.application_id === selectedApp)?.status;
  useEffect(() => {
    if (!selectedApp || !selectedQueueStatus) return;
    const derived = deriveWorkflowStateFromStatus(selectedQueueStatus);

    if (selectedQueueStatus === 'submitted' || selectedQueueStatus === 'error') {
      // Don't force "preview" if the user already started the pipeline locally
      return;
    }

    setWorkflowPhase(derived.phase);
    advanceStage(derived.stage);
    if (derived.hitl) {
      setHitlReached(true);
      setHitlStartTime((prev) => prev || Date.now());
    }
    if (derived.approved) {
      setApproved(true);
      setHitlResolutionTime((prev) => prev || Date.now());
      setApprovalDetails((prev) => prev || { mode: derived.approvalMode });
    }
  }, [selectedApp, selectedQueueStatus, advanceStage]);

  // Elapsed processing timer
  useEffect(() => {
    // Seeds show no live pipeline, so never start a wall-clock timer for them.
    if (workflowPhase !== 'executing' || approved || isSeedSelection) {
      setElapsedSeconds(0);
      executingStartRef.current = null;
      return;
    }
    executingStartRef.current = Date.now();
    const interval = setInterval(() => {
      if (executingStartRef.current) {
        setElapsedSeconds(Math.floor((Date.now() - executingStartRef.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [workflowPhase, approved, selectedApp, isSeedSelection]);

  const selectedAppData = liveApplications.find((a) => a.application_id === selectedApp);

  const handleApprove = useCallback(async (details) => {
    if (!selectedApp) return;
    const appName = selectedAppDetail?.borrower_names?.length
      ? selectedAppDetail.borrower_names.join(' & ')
      : selectedAppData?.name || 'Application';

    if (details?.mode === 'modified') {
      addToast({ type: 'info', title: 'Submitting Modifications...', message: 'Sending updated terms to agent pipeline.' });
      const modResult = await apiPost(`/hitl/${selectedApp}/decision`, {
        action: 'modify_and_continue',
        officer_notes: details.conditions || 'Modified terms',
        officer_id: officer?.officer_id || 'officer-001',
        conditions: details.conditions ? [details.conditions] : [],
        overrides: {
          ...(details.rate ? { rate: parseFloat(details.rate) } : {}),
          ...(details.loanAmount ? { loan_amount: details.loanAmount } : {}),
        },
      });
      if (modResult) {
        setHitlReached(false); setHitlStartTime(null); setHitlResolutionTime(null);
        setApproved(false);
        setApprovalDetails(null);
        // Activity SSE stays open — no need to reconnect
        addToast({ type: 'info', title: 'Modifications Applied', message: 'Agent re-running underwriting with updated terms.' });
      } else {
        addToast({ type: 'error', title: 'Modification Failed', message: 'Could not apply modified terms. Please try again.' });
      }
      return;
    }

    const rate = details?.rate || '';
    const suffix = details?.conditions ? ` · Conditions: ${details.conditions}` : '';
    addToast({ type: 'info', title: 'Processing Approval...', message: `Submitting decision for ${appName}.` });

    const result = await apiPost(`/hitl/${selectedApp}/decision`, {
      action: 'approve',
      officer_notes: details?.conditions || 'Approved after manual review',
      officer_id: officer?.officer_id || 'officer-001',
      conditions: details?.conditions ? [details.conditions] : [],
      overrides: {
        ...(details?.rate ? { rate: parseFloat(details.rate) } : {}),
        ...(details?.loanAmount ? { loan_amount: details.loanAmount } : {}),
      },
    });

    if (result) {
      setApproved(true);
      setWorkflowStage(WORKFLOW_STAGES.length - 1);
      currentStageRef.current = WORKFLOW_STAGES.length - 1;
      setHitlResolutionTime(Date.now());
      setApprovalDetails(details || { mode: 'recommended' });
      addToast({ type: 'success', title: 'Loan Approved', message: `${rate ? `@ ${rate} ` : ''}for ${appName}.${suffix}` });
    } else {
      addToast({ type: 'error', title: 'Approval Failed', message: 'Could not process approval. Please try again.' });
    }
  }, [addToast, selectedApp, selectedAppDetail, selectedAppData, officer]);

  const handleDecline = useCallback(async () => {
    const appName = selectedAppDetail?.borrower_names?.length
      ? selectedAppDetail.borrower_names.join(' & ')
      : selectedAppData?.name || 'Application';

    if (selectedApp) {
      addToast({ type: 'info', title: 'Processing...', message: `Declining ${appName}.` });
      const result = await apiPost(`/hitl/${selectedApp}/decision`, {
        action: 'decline',
        officer_notes: 'Declined after manual review',
        officer_id: officer?.officer_id || 'officer-001',
        conditions: [],
        overrides: {},
      });

      if (result) {
        setApproved(true);
        setWorkflowStage(WORKFLOW_STAGES.length - 1);
        currentStageRef.current = WORKFLOW_STAGES.length - 1;
        setHitlResolutionTime(Date.now());
        setApprovalDetails({ mode: 'declined' });
        addToast({ type: 'warning', title: 'Application Declined', message: `${appName} — declined after manual review.` });
      } else {
        addToast({ type: 'error', title: 'Decline Failed', message: 'Could not process decline. Please try again.' });
      }
    }
  }, [addToast, selectedApp, selectedAppDetail, selectedAppData, officer]);

  // Compatibility shim — LoanOfficerDashboard calls this on each activity entry
  // render. Stage progression is now handled in the hoisted SSE effect, so this
  // only needs to set HITL state on gate events for good measure.
  const handleAgentEvent = useCallback((entry) => {
    if (!entry) return;
    if (entry.agent === 'hitl_gate' && entry.action === 'interrupt') {
      setHitlReached(true);
      setHitlStartTime((prev) => prev || Date.now());
    }
  }, []);

  return {
    selectedApp,
    setSelectedApp,
    workflowPhase,
    workflowStage,
    hitlReached,
    hitlStartTime,
    hitlResolutionTime,
    approved,
    approvalDetails,
    liveAgentOutput,
    elapsedSeconds,
    // Exposed with the decorative seed apps merged in, so the queue + counts look
    // populated. Internal selection/WS logic uses the raw `liveApplications` state.
    liveApplications: applicationsForDisplay,
    selectedAppDetail,
    portfolioStats,
    dashboardStats,
    officer,
    stageTimestamps,
    activityEvents,
    streamConnected,
    streamError,

    handleApprove,
    handleDecline,
    handleAgentEvent,
  };
}
