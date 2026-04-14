"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { apiPost, apiGet, apiSSE, apiWebSocket } from '../../lib/api';
import { NODE_TO_STAGE } from './constants';

export function useLoanOfficerWorkflow(addToast) {
  const [selectedApp, setSelectedApp] = useState(null);
  const [workflowPhase, setWorkflowPhase] = useState('idle');
  const [workflowStage, setWorkflowStage] = useState(0);
  const [hitlReached, setHitlReached] = useState(false);
  const [approved, setApproved] = useState(false);
  const [planSettings, setPlanSettings] = useState(null);
  const [approvalDetails, setApprovalDetails] = useState(null);
  const [liveAgentOutput, setLiveAgentOutput] = useState({});
  const sseRef = useRef(null);
  const stageTimestampsRef = useRef({});
  const executingStartRef = useRef(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [liveApplications, setLiveApplications] = useState([]);
  const [selectedAppDetail, setSelectedAppDetail] = useState(null);
  const [portfolioStats, setPortfolioStats] = useState(null);
  const prevStatsRef = useRef({});

  const snapshotReceived = useRef(false);
  const selectedAppRef = useRef(selectedApp);
  selectedAppRef.current = selectedApp;
  const liveApplicationsRef = useRef(liveApplications);
  liveApplicationsRef.current = liveApplications;

  // Real-time application queue via WebSocket + MongoDB Change Stream,
  // with REST fallback when WebSocket cannot connect through Next.js proxy.
  useEffect(() => {
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
  }, []);

  // Fetch portfolio stats on mount
  useEffect(() => {
    apiGet('/portfolio/stats').then((data) => {
      if (data) setPortfolioStats(data);
    }).catch(() => {});
  }, []);

  // Fetch selected application detail from backend
  useEffect(() => {
    if (!selectedApp) {
      setSelectedAppDetail(null);
      return;
    }
    apiGet(`/applications/${selectedApp}`).then((data) => {
      setSelectedAppDetail(data);
    });
  }, [selectedApp]);

  // Dashboard stats derived from real data + portfolio stats
  const dashboardStats = useMemo(() => {
    const pendingCount = liveApplications.filter(
      (a) => ['review', 'pending_review'].includes(a.status)
    ).length;
    const approvedCount = liveApplications.filter((a) => a.status === 'approved').length;
    const processingCount = liveApplications.filter((a) => a.status === 'processing' || a.status === 'underwriting').length;

    const prev = prevStatsRef.current;
    const trend = (key, current) => {
      const p = prev[key];
      if (p == null) return '';
      if (current > p) return '\u2191';
      if (current < p) return '\u2193';
      return '';
    };

    const completedApps = liveApplications.filter((a) =>
      (a.status === 'approved' || a.status === 'declined') && a.created_at
    );
    let avgTimeStr = '';
    if (completedApps.length > 0) {
      const times = completedApps.map((a) => {
        const created = new Date(a.created_at).getTime();
        const updated = a.updated_at ? new Date(a.updated_at).getTime() : Date.now();
        return updated - created;
      }).filter((t) => t > 0);
      if (times.length > 0) {
        const avgMs = times.reduce((s, t) => s + t, 0) / times.length;
        avgTimeStr = avgMs < 60000 ? `~${(avgMs / 1000).toFixed(0)}s` : `~${(avgMs / 60000).toFixed(1)}m`;
      }
    }

    const stats = [
      { label: 'Applications', value: String(liveApplications.length), color: 'var(--mongo)', trend: trend('total', liveApplications.length) },
      { label: 'Processing', value: String(processingCount), color: 'var(--agent-cyan)', trend: trend('processing', processingCount) },
      { label: 'Approved', value: String(approvedCount), color: 'var(--success)', trend: trend('approved', approvedCount) },
      { label: 'Pending Reviews', value: String(pendingCount), color: 'var(--hitl-amber)', trend: trend('pending', pendingCount) },
    ];

    if (avgTimeStr) {
      stats.push({ label: 'Avg Time', value: avgTimeStr, color: 'var(--agent-cyan)' });
    }

    if (portfolioStats) {
      if (portfolioStats.total_portfolio_value) {
        stats.push({ label: 'Portfolio Value', value: `$${(portfolioStats.total_portfolio_value / 1_000_000).toFixed(1)}M`, color: 'var(--mongo)' });
      }
      if (portfolioStats.active_loans != null) {
        stats.push({ label: 'Active Loans', value: String(portfolioStats.active_loans), color: 'var(--tool-blue)' });
      }
      if (portfolioStats.delinquency_rate != null) {
        stats.push({ label: 'Delinquency', value: `${(portfolioStats.delinquency_rate * 100).toFixed(1)}%`, color: portfolioStats.delinquency_rate > 0.05 ? 'var(--danger)' : 'var(--success)' });
      }
    }

    return stats;
  }, [liveApplications, portfolioStats]);

  useEffect(() => {
    const processingCount = liveApplications.filter((a) => a.status === 'processing' || a.status === 'underwriting').length;
    const approvedCount = liveApplications.filter((a) => a.status === 'approved').length;
    const pendingCount = liveApplications.filter((a) => ['review', 'pending_review'].includes(a.status)).length;
    prevStatsRef.current = { total: liveApplications.length, processing: processingCount, approved: approvedCount, pending: pendingCount };
  }, [liveApplications]);

  // Clean up SSE on unmount
  useEffect(() => {
    return () => { if (sseRef.current) { sseRef.current.close(); sseRef.current = null; } };
  }, []);

  const reconnectActivitySSERef = useRef(reconnectActivitySSE);
  reconnectActivitySSERef.current = reconnectActivitySSE;

  // Status-aware reset when selected app changes
  useEffect(() => {
    if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }
    setWorkflowStage(0);
    setHitlReached(false);
    setApproved(false);
    setPlanSettings(null);
    setApprovalDetails(null);
    setLiveAgentOutput({});
    stageTimestampsRef.current = {};

    if (!selectedApp) {
      setWorkflowPhase('idle');
      return;
    }

    const queueApp = liveApplicationsRef.current.find((a) => a.application_id === selectedApp);
    const status = queueApp?.status || 'submitted';

    if (status === 'review' || status === 'pending_review') {
      setWorkflowPhase('executing');
      setWorkflowStage(2);
      setHitlReached(true);
    } else if (status === 'processing' || status === 'underwriting') {
      setWorkflowPhase('executing');
      setWorkflowStage(status === 'underwriting' ? 1 : 0);
      reconnectActivitySSERef.current(selectedApp);
    } else if (status === 'approved' || status === 'closing') {
      setWorkflowPhase('executing');
      setApproved(true);
      setApprovalDetails({ mode: 'auto' });
    } else if (status === 'funded' || status === 'active') {
      setWorkflowPhase('executing');
      setApproved(true);
      setApprovalDetails({ mode: 'auto' });
    } else if (status === 'declined') {
      setWorkflowPhase('executing');
      setApproved(true);
      setApprovalDetails({ mode: 'declined' });
    } else if (status === 'error') {
      setWorkflowPhase('preview');
    } else {
      setWorkflowPhase('preview');
    }
  }, [selectedApp]);

  // Elapsed processing timer
  useEffect(() => {
    if (workflowPhase !== 'executing' || approved) {
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
  }, [workflowPhase, approved, selectedApp]);

  // SSE-driven workflow stage progression via run-stream
  const startWorkflowSSE = useCallback((appId) => {
    if (sseRef.current) sseRef.current.close();

    setWorkflowStage(0);
    setHitlReached(false);
    setApproved(false);
    setWorkflowPhase('executing');
    setLiveAgentOutput({});
    stageTimestampsRef.current = { 0: Date.now() };

    const source = apiSSE(
      `/agent/${appId}/run-stream?autonomy_level=bounded`,
      (event) => {
        if (event.type === 'node_start') {
          const agentName = event.agent || event.name || '';
          const stageIdx = NODE_TO_STAGE[agentName];
          if (stageIdx !== undefined) {
            setWorkflowStage((prev) => {
              if (stageIdx > prev) {
                stageTimestampsRef.current[stageIdx] = Date.now();
              }
              return Math.max(prev, stageIdx);
            });
          }
        }

        if (event.type === 'node_complete') {
          const agentName = event.agent || '';
          const stageIdx = NODE_TO_STAGE[agentName];
          if (stageIdx !== undefined) {
            setWorkflowStage((prev) => {
              if (stageIdx >= prev) {
                stageTimestampsRef.current[stageIdx + 1] = stageTimestampsRef.current[stageIdx + 1] || Date.now();
              }
              return Math.max(prev, stageIdx);
            });
          }

          if (event.output && typeof event.output === 'object') {
            setLiveAgentOutput((prev) => ({ ...prev, ...event.output }));
          }

          if (agentName === 'hitl_gate') {
            setHitlReached(true);
            addToast({ type: 'warning', title: 'HITL Review Required', message: `${appId} awaiting your decision.` });
          }
        }

        if (event.type === 'hitl_waiting') {
          setHitlReached(true);
          setWorkflowStage(2);
          stageTimestampsRef.current[2] = stageTimestampsRef.current[2] || Date.now();
          addToast({ type: 'warning', title: 'HITL Review Required', message: `${appId} awaiting your decision.` });
        }

        if (event.type === 'complete') {
          setApproved(true);
          setApprovalDetails({ mode: 'auto' });
          addToast({ type: 'success', title: 'Pipeline Complete', message: `Agent pipeline completed for ${appId}.` });
        }
      }
    );

    sseRef.current = source;
  }, [addToast]);

  // Reconnect to activity stream for apps already processing
  function reconnectActivitySSE(appId) {
    if (sseRef.current) sseRef.current.close();

    const source = apiSSE(
      `/agent/${appId}/stream`,
      (event) => {
        if (event.type === 'agent_step') {
          const agentName = event.agent || '';
          const stageIdx = NODE_TO_STAGE[agentName];
          if (stageIdx !== undefined) {
            setWorkflowStage(stageIdx);
          }
          if (agentName === 'hitl_gate' && event.action === 'interrupt') {
            setHitlReached(true);
            addToast({ type: 'warning', title: 'HITL Review Required', message: `${appId} awaiting your decision.` });
          }
        }
        if (event.type === 'complete') {
          setApproved(true);
          setApprovalDetails({ mode: 'auto' });
          addToast({ type: 'success', title: 'Pipeline Complete', message: `Agent pipeline completed for ${appId}.` });
        }
      }
    );

    sseRef.current = source;
  }

  const handleProceed = useCallback((settings) => {
    if (!selectedApp) return;
    setPlanSettings(settings || null);
    startWorkflowSSE(selectedApp);
    addToast({ type: 'info', title: 'Workflow Started', message: `Processing ${selectedApp} with bounded autonomy.` });
  }, [selectedApp, addToast, startWorkflowSSE]);

  const handleManual = useCallback(() => {
    setWorkflowPhase('manual');
    addToast({ type: 'info', title: 'Manual Mode', message: 'Agent bypassed. You are handling this application directly.' });
  }, [addToast]);

  const selectedAppData = liveApplications.find((a) => a.application_id === selectedApp);

  const handleApprove = useCallback(async (details) => {
    if (!selectedApp) return;
    const appName = selectedAppDetail?.borrower_names?.length
      ? selectedAppDetail.borrower_names.join(' & ')
      : selectedAppData?.name || 'Application';

    if (details?.mode === 'modified') {
      addToast({ type: 'info', title: 'Modifications Applied', message: 'Agent re-running underwriting with updated terms.' });
      await apiPost(`/hitl/${selectedApp}/decision`, {
        action: 'modify_and_continue',
        officer_notes: details.conditions || 'Modified terms',
        conditions: details.conditions ? [details.conditions] : [],
        overrides: {
          ...(details.rate ? { rate: parseFloat(details.rate) } : {}),
          ...(details.loanAmount ? { loan_amount: details.loanAmount } : {}),
        },
      });
      setHitlReached(false);
      setApproved(false);
      setApprovalDetails(null);
      reconnectActivitySSE(selectedApp);
      return;
    }

    setApproved(true);
    setApprovalDetails(details || { mode: 'recommended' });
    const rate = details?.rate || '';
    const suffix = details?.conditions ? ` · Conditions: ${details.conditions}` : '';
    addToast({ type: 'success', title: 'Loan Approved', message: `${rate ? `@ ${rate} ` : ''}for ${appName}.${suffix}` });

    await apiPost(`/hitl/${selectedApp}/decision`, {
      action: 'approve',
      officer_notes: details?.conditions || 'Approved after manual review',
    });
  }, [addToast, selectedApp, selectedAppDetail, selectedAppData]);

  const handleDecline = useCallback(async () => {
    const appName = selectedAppDetail?.borrower_names?.length
      ? selectedAppDetail.borrower_names.join(' & ')
      : selectedAppData?.name || 'Application';

    setApproved(true);
    setApprovalDetails({ mode: 'declined' });
    addToast({ type: 'warning', title: 'Application Declined', message: `${appName} — declined after manual review.` });

    if (selectedApp) {
      await apiPost(`/hitl/${selectedApp}/decision`, {
        action: 'decline',
        officer_notes: 'Declined after manual review',
      });
    }
  }, [addToast, selectedApp, selectedAppDetail, selectedAppData]);

  const handleAgentEvent = useCallback((entry) => {
    if (!entry) return;
    const agentName = entry.agent || '';
    const stageIdx = NODE_TO_STAGE[agentName.toLowerCase().includes('underwrit') ? 'underwriter'
      : agentName.toLowerCase().includes('loan_app') ? 'loan_app'
      : agentName.toLowerCase().includes('hitl') ? 'hitl_gate' : ''];
    if (stageIdx !== undefined) {
      setWorkflowStage(stageIdx);
    }
    if (entry.agent === 'hitl_gate' && entry.action === 'interrupt') {
      setHitlReached(true);
    }
  }, []);

  return {
    selectedApp,
    setSelectedApp,
    workflowPhase,
    workflowStage,
    hitlReached,
    approved,
    planSettings,
    setPlanSettings,
    approvalDetails,
    liveAgentOutput,
    elapsedSeconds,
    liveApplications,
    selectedAppDetail,
    portfolioStats,
    dashboardStats,
    stageTimestamps: stageTimestampsRef.current,

    handleProceed,
    handleManual,
    handleApprove,
    handleDecline,
    handleAgentEvent,
  };
}
