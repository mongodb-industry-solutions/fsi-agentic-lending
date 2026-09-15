"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Icon from '@leafygreen-ui/icon';
import { SERVICING_STEPS } from '../engine/demoScenes';
import { mergeCanvasState } from '../engine/canvasUtils';
import WorkflowCanvas from '../WorkflowCanvas';
import AnnotationOverlay from '../AnnotationOverlay';
import PipelineDrawer from '../PipelineDrawer';
import { apiGet } from '../../../lib/api';
import { spacing } from '@leafygreen-ui/tokens';
import { palette } from '@leafygreen-ui/palette';
import { uiTokens } from '../../../lib/uiTokens';

const DEFAULT_STATS = [
  { label: 'Active Loans', value: 4287, format: (v) => v.toLocaleString('en-US'), color: 'var(--mongo)' },
  { label: 'Portfolio Value', value: 1.2, format: (v) => `$${v.toFixed(1)}B`, color: 'var(--agent-cyan)' },
  { label: 'Delinquency Rate', value: 2.4, format: (v) => `${v.toFixed(1)}%`, color: 'var(--hitl-amber)' },
  { label: 'EWS Alerts', value: 23, format: (v) => `${Math.round(v)} active`, color: 'var(--danger)' },
];

const EWS_SIGNALS = [
  { signal: 'Credit utilization trend', status: 'red', detail: 'Rising 3 consecutive months', glyph: 'Warning' },
  { signal: 'Payment pattern change', status: 'amber', detail: '2 late in 90 days', glyph: 'Warning' },
  { signal: 'Income stability', status: 'green', detail: 'Stable — verified monthly', glyph: 'Checkmark' },
];

const EVENT_TEMPLATES = [
  { type: 'payment', glyph: 'CreditCard', color: 'var(--success)', messages: ['Payment received: $4,047 on L-00001', 'Payment received: $2,450 on L-91205', 'Payment received: $1,320 on L-64817'] },
  { type: 'status', glyph: 'Refresh', color: 'var(--tool-blue)', messages: ['Status update: L-55023 → funded', 'Status update: L-82910 → underwriting', 'Status update: L-41892 → closing'] },
  { type: 'alert', glyph: 'Warning', color: 'var(--hitl-amber)', messages: ['Alert: Delinquency threshold on L-33719', 'Alert: Late payment flagged on L-28104'] },
  { type: 'agent', glyph: 'Refresh', color: 'var(--voyage)', messages: [
    'Servicing Agent: rate comparison triggered for L-33719',
    'Servicing Agent: similar borrower analysis initiated',
    'Servicing Agent: personalized offer generated for L-33719',
    'Servicing Agent: EWS alert evaluated — proactive intervention',
  ] },
];

const INTERVENTION_STEPS = [
  { label: 'EWS Alert', detail: 'Payment anomaly detected (Day 47 late, 2nd occurrence)', glyph: 'Warning', color: 'var(--danger)' },
  { label: 'Propensity-to-Pay', detail: 'Score: 0.73 — Atlas Vector Search on 500M+ patterns', glyph: 'MagnifyingGlass', color: 'var(--voyage)' },
  { label: 'Similar Borrowers', detail: '82% resolved with modification, 12% self-cured', glyph: 'Person', color: 'var(--agent-cyan)' },
  { label: 'Offer Generated', detail: 'Rate 4.89% → 4.29% for 6 months, payment $4,047 → $3,840', glyph: 'Edit', color: 'var(--mongo)' },
];

function AnimatedStat({ stat }) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let start = null;
    const target = stat.value;
    let raf;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / 1000, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(target * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [stat.value]);

  return (
    <div style={{ padding: `${spacing[200]}px ${spacing[300]}px`, background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border-dim)' }}>
      <div style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600, marginBottom: spacing[100] }}>{stat.label}</div>
      <div style={{ fontFamily: uiTokens.monoFont, fontSize: 18, fontWeight: 800, color: stat.color }}>{stat.format(value)}</div>
    </div>
  );
}

function StatusDot({ status }) {
  const colors = { green: 'var(--success)', amber: 'var(--hitl-amber)', red: 'var(--danger)' };
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
      background: colors[status] || 'var(--text-dim)',
      boxShadow: status === 'red' ? '0 0 6px var(--danger)' : status === 'amber' ? '0 0 4px var(--hitl-amber)' : 'none',
    }} />
  );
}

function EWSPanel({ highlightAlert, signals }) {
  const data = signals || EWS_SIGNALS;
  return (
    <div style={{ padding: spacing[300], background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border-dim)', animation: 'slideDown 220ms cubic-bezier(0.33, 1, 0.68, 1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[200] }}>
        <div style={{ fontFamily: uiTokens.font, fontWeight: 700, fontSize: 12 }}>Early Warning System</div>
        <div style={{ display: 'flex', gap: spacing[100], alignItems: 'center' }}>
          <span style={{ fontSize: 8, fontWeight: 600, padding: `${spacing[50]}px ${spacing[150]}px`, borderRadius: 8, background: 'var(--voyage-dim)', color: 'var(--voyage)' }}>
            Aggregation &middot; $setWindowFields
          </span>
          <span style={{ fontSize: 8, fontWeight: 600, padding: `${spacing[50]}px ${spacing[150]}px`, borderRadius: 8, background: 'var(--agent-cyan-dim)', color: 'var(--agent-cyan)' }}>
            Change Streams
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {data.map((s) => {
          const isHighlighted = highlightAlert && (s.status === 'red' || s.status === 'amber');
          return (
            <div key={s.signal} style={{
              display: 'flex', alignItems: 'center', gap: spacing[200], padding: `${spacing[150]}px ${spacing[200]}px`,
              borderBottom: '1px solid var(--border-dim)',
              background: isHighlighted ? (s.status === 'red' ? palette.red.light3 : palette.yellow.light3) : 'transparent',
              transition: 'background 220ms cubic-bezier(0.33, 1, 0.68, 1)',
            }}>
              <StatusDot status={s.status} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{s.signal}</div>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>{s.detail}</div>
              </div>
              <Icon glyph={s.glyph || 'Warning'} size={10} />
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: spacing[150], fontStyle: 'italic' }}>
        EWS can cut loan loss provisions 10–20% and improve ROE by 20%+
      </div>
    </div>
  );
}

function ServicingInterventionCard({ sceneStep }) {
  const visibleSteps = Math.min(sceneStep >= 3 ? 4 : sceneStep >= 2 ? 2 : 0, INTERVENTION_STEPS.length);
  if (visibleSteps === 0) return null;

  return (
    <div style={{ padding: spacing[300], background: 'var(--bg-surface)', borderRadius: 8, border: '2px solid var(--voyage)', animation: 'sceneEnter 220ms cubic-bezier(0.33, 1, 0.68, 1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing[200], marginBottom: spacing[300] }}>
        <Icon glyph="Refresh" size={18} />
        <div>
          <div style={{ fontFamily: uiTokens.font, fontWeight: 800, fontSize: 13, color: 'var(--voyage)' }}>Servicing Agent — Proactive Intervention</div>
          <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Servicing + collections-grade capabilities via MongoDB + AI</div>
        </div>
      </div>

      <div style={{ position: 'relative', paddingLeft: spacing[500] }}>
        <div style={{ position: 'absolute', left: 8, top: 0, bottom: 0, width: 2, background: 'var(--border-dim)' }} />
        {INTERVENTION_STEPS.slice(0, visibleSteps).map((step, i) => (
          <div key={step.label} style={{ position: 'relative', paddingLeft: spacing[500], paddingBottom: spacing[200], animation: 'slideDown 220ms cubic-bezier(0.33, 1, 0.68, 1)' }}>
            <div style={{
              position: 'absolute', left: 0, top: 4, width: 16, height: 16, borderRadius: '50%',
              background: 'var(--bg-surface)', border: `2px solid ${step.color}`, zIndex: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8,
            }}>
              <Icon glyph={step.glyph} size={10} />
            </div>
            <div style={{ fontWeight: 600, fontSize: 11, color: step.color, marginBottom: 1 }}>{step.label}</div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{step.detail}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: spacing[200], fontSize: 11, color: 'var(--text-dim)', display: 'flex', gap: spacing[150] }}>
        <span style={{ padding: `${spacing[50]}px ${spacing[150]}px`, background: 'var(--voyage-dim)', color: 'var(--voyage)', borderRadius: 8 }}>Vector Search</span>
        <span style={{ padding: `${spacing[50]}px ${spacing[150]}px`, background: 'var(--bg-raised)', color: 'var(--agent-cyan)', borderRadius: 8 }}>$setWindowFields</span>
        <span style={{ padding: `${spacing[50]}px ${spacing[150]}px`, background: 'var(--bg-raised)', color: 'var(--success)', borderRadius: 8 }}>Change Streams</span>
      </div>
    </div>
  );
}

function LiveEventFeed({ sceneStep, backendEvents }) {
  const [events, setEvents] = useState([]);
  const counterRef = useRef(0);

  useEffect(() => {
    // If we have backend events, use them as initial seed
    if (backendEvents && backendEvents.length > 0) {
      const seeded = backendEvents.map((e, i) => ({
        id: `be-${i}`,
        type: e.type || 'payment',
        glyph: e.glyph || 'CreditCard',
        color: e.color || 'var(--text-secondary)',
        text: e.message || '',
        time: e.timestamp ? new Date(e.timestamp).toLocaleTimeString() : '',
      }));
      setEvents(seeded.slice(0, 20));
      return;
    }

    const addEvent = () => {
      const templates = sceneStep >= 2
        ? EVENT_TEMPLATES
        : EVENT_TEMPLATES.filter((t) => t.type !== 'agent');
      const tmpl = templates[Math.floor(Math.random() * templates.length)];
      const msg = tmpl.messages[Math.floor(Math.random() * tmpl.messages.length)];
      const id = counterRef.current++;
      setEvents((prev) => [{ id, ...tmpl, text: msg, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 20));
    };
    addEvent(); addEvent(); addEvent();
    const interval = setInterval(addEvent, 3500);
    return () => clearInterval(interval);
  }, [sceneStep, backendEvents]);

  return (
    <div style={{ padding: spacing[300], background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border-dim)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[200] }}>
        <div style={{ fontFamily: uiTokens.font, fontWeight: 700, fontSize: 11 }}>Live Change Stream</div>
        <span style={{ display: 'flex', alignItems: 'center', gap: spacing[100], fontSize: 9, fontWeight: 600, color: 'var(--success)' }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 6px var(--success)', animation: 'pulse 1.5s infinite' }} />
          Streaming
        </span>
      </div>
      <div style={{ maxHeight: 80, overflowY: 'auto' }}>
        {events.map((e) => (
          <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: spacing[150], padding: `${spacing[100]}px 0`, borderBottom: '1px solid var(--border-dim)', fontSize: 10, animation: 'slideDown 220ms cubic-bezier(0.33, 1, 0.68, 1)' }}>
            <Icon glyph={e.glyph || 'CreditCard'} size={11} />
            <span style={{ flex: 1, color: e.type === 'agent' ? 'var(--voyage)' : 'var(--text-secondary)', fontWeight: e.type === 'agent' ? 600 : 400 }}>{e.text}</span>
            <span style={{ fontFamily: uiTokens.monoFont, fontSize: 8, color: 'var(--text-dim)', flexShrink: 0 }}>{e.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ServicingScene({ sceneStep, currentStepData }) {
  const started = sceneStep >= 0;
  const showEWS = sceneStep >= 0;
  const showAlertHighlight = sceneStep >= 2;
  const showServicingAgent = sceneStep >= 2;

  const [hoveredNode, setHoveredNode] = useState(null);
  const [timelineHighlight, setTimelineHighlight] = useState(null);

  const [liveStats, setLiveStats] = useState(null);
  const [ewsSignals, setEwsSignals] = useState(EWS_SIGNALS);
  const [liveEvents, setLiveEvents] = useState(null);

  useEffect(() => {
    if (sceneStep < 0) return;
    let cancelled = false;

    async function fetchPortfolioData() {
      try {
        const [statsRes] = await Promise.all([
          apiGet('/portfolio/stats'),
        ]);
        if (cancelled) return;

        if (statsRes && statsRes.active_loans !== undefined) {
          setLiveStats(statsRes);
        }
      } catch {
        // Keep fallback data on error
      }

      // Fetch EWS signals
      try {
        const ewsRes = await apiGet('/portfolio/ews?loan_id=L-00001');
        if (!cancelled && ewsRes && Array.isArray(ewsRes) && ewsRes.length > 0) {
          setEwsSignals(ewsRes);
        }
      } catch {
        // Keep fallback EWS data
      }

      // Fetch recent events
      try {
        const eventsRes = await apiGet('/portfolio/events?limit=20');
        if (!cancelled && eventsRes && Array.isArray(eventsRes) && eventsRes.length > 0) {
          setLiveEvents(eventsRes);
        }
      } catch {
        // Keep fallback events
      }
    }

    fetchPortfolioData();
    return () => { cancelled = true; };
  }, [sceneStep]);

  const handleNodeHover = useCallback((nodeId) => setHoveredNode(nodeId), []);
  const handleTimelineHover = useCallback((nodeId) => setTimelineHighlight(nodeId), []);

  const canvasState = useMemo(
    () => mergeCanvasState(SERVICING_STEPS, sceneStep),
    [sceneStep],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <div style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden', display: 'grid', gridTemplateColumns: '1fr' }}>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ position: 'relative', flex: '1.4 1 0%', minHeight: 240, overflow: 'hidden' }}>
            {started && (
              <WorkflowCanvas
                activeNodes={canvasState.activeNodes}
                activeEdges={canvasState.activeEdges}
                pulsingNodes={canvasState.pulsingNodes}
                completedNodes={canvasState.completedNodes}
                currentScene="servicing"
                onNodeHover={handleNodeHover}
                highlightNode={timelineHighlight}
              />
            )}
          </div>
          <AnnotationOverlay
            currentStep={currentStepData}
            sceneTitle="Servicing"
            stepIndex={sceneStep}
            totalSteps={SERVICING_STEPS.length}
          />
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', borderTop: '1px solid var(--border-dim)', padding: spacing[300], display: 'flex', flexDirection: 'column', gap: spacing[200] }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing[200] }}>
              {(liveStats
                ? [
                    { label: 'Active Loans', value: liveStats.active_loans, format: (v) => v.toLocaleString('en-US'), color: 'var(--mongo)' },
                    { label: 'Total Outstanding', value: liveStats.total_outstanding, format: (v) => `$${(v / 1000).toFixed(0)}K`, color: 'var(--agent-cyan)' },
                    { label: 'Delinquency Rate', value: liveStats.delinquency_rate, format: (v) => `${v.toFixed(1)}%`, color: 'var(--hitl-amber)' },
                    { label: 'EWS Alerts', value: liveStats.delinquent_count || 0, format: (v) => `${Math.round(v)} active`, color: 'var(--danger)' },
                  ]
                : DEFAULT_STATS
              ).map((s) => <AnimatedStat key={s.label} stat={s} />)}
            </div>

            {showEWS && <EWSPanel highlightAlert={showAlertHighlight} signals={ewsSignals} />}

            <LiveEventFeed sceneStep={sceneStep} backendEvents={liveEvents} />

            {showServicingAgent && <ServicingInterventionCard sceneStep={sceneStep} />}
          </div>
        </div>

        <PipelineDrawer
          steps={SERVICING_STEPS}
          stepIndex={sceneStep}
          onEntryHover={handleTimelineHover}
          highlightNodeId={hoveredNode}
        />
      </div>
    </div>
  );
}
