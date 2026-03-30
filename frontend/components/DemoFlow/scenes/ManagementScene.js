"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { MANAGEMENT_STEPS } from '../engine/demoScenes';
import { mergeCanvasState } from '../engine/canvasUtils';
import WorkflowCanvas from '../WorkflowCanvas';
import AnnotationOverlay from '../AnnotationOverlay';
import DataSourceStrip from '../DataSourceStrip';
import PipelineTimeline from '../PipelineTimeline';

const STATS = [
  { label: 'Active Loans', value: 4287, format: (v) => v.toLocaleString(), color: 'var(--mongo)' },
  { label: 'Portfolio Value', value: 1.2, format: (v) => `$${v.toFixed(1)}B`, color: 'var(--agent-cyan)' },
  { label: 'Delinquency Rate', value: 2.4, format: (v) => `${v.toFixed(1)}%`, color: 'var(--hitl-amber)' },
  { label: 'EWS Alerts', value: 23, format: (v) => `${Math.round(v)} active`, color: 'var(--danger)' },
];

const EWS_SIGNALS = [
  { signal: 'Payment pattern change', status: 'amber', detail: '2 late in 90 days', icon: '⚠️' },
  { signal: 'Income stability', status: 'green', detail: 'Stable — verified monthly', icon: '✓' },
  { signal: 'Credit utilization trend', status: 'red', detail: 'Rising 3 consecutive months', icon: '⚠️' },
  { signal: 'Behavioral score drift', status: 'amber', detail: 'PSI 0.18 (threshold: 0.20)', icon: '⚠️' },
  { signal: 'External event', status: 'green', detail: 'No adverse events detected', icon: '✓' },
];

const MONTHLY_DATA = [
  { month: 'Jan', value: 42 }, { month: 'Feb', value: 38 }, { month: 'Mar', value: 45 },
  { month: 'Apr', value: 52 }, { month: 'May', value: 48 }, { month: 'Jun', value: 55 },
  { month: 'Jul', value: 61 }, { month: 'Aug', value: 58 }, { month: 'Sep', value: 63 },
  { month: 'Oct', value: 59 }, { month: 'Nov', value: 67 }, { month: 'Dec', value: 72 },
];

const EVENT_TEMPLATES = [
  { type: 'payment', icon: '💰', color: 'var(--success)', messages: ['Payment received: $1,870 on L-78342', 'Payment received: $2,450 on L-91205', 'Payment received: $1,320 on L-64817'] },
  { type: 'status', icon: '🔄', color: 'var(--tool-blue)', messages: ['Status update: L-55023 → funded', 'Status update: L-82910 → underwriting', 'Status update: L-41892 → closing'] },
  { type: 'alert', icon: '⚠️', color: 'var(--hitl-amber)', messages: ['Alert: Delinquency threshold on L-33719', 'Alert: Late payment flagged on L-28104'] },
  { type: 'agent', icon: '🔄', color: 'var(--voyage)', messages: [
    'Renewal Agent: rate comparison triggered for L-33719',
    'Renewal Agent: similar borrower analysis initiated',
    'Renewal Agent: personalized offer generated for L-33719',
    'Renewal Agent: EWS alert evaluated — proactive intervention',
  ] },
];

const INTERVENTION_STEPS = [
  { label: 'EWS Alert', detail: 'Payment anomaly detected (Day 47 late, 2nd occurrence in 90 days)', icon: '🚨', color: 'var(--danger)' },
  { label: 'Propensity-to-Pay', detail: 'Score: 0.73 (moderate risk) — Atlas Vector Search on 500M+ payment patterns', icon: '🎯', color: 'var(--voyage)' },
  { label: 'Similar Borrowers', detail: '82% resolved with modification, 12% self-cured, 6% escalated', icon: '👥', color: 'var(--agent-cyan)' },
  { label: 'Recommended Action', detail: 'Proactive restructuring offer', icon: '💡', color: 'var(--mongo)' },
  { label: 'Multi-Channel Outreach', detail: 'SMS sent, email queued, portal notification active', icon: '📱', color: 'var(--success)' },
  { label: 'Offer Generated', detail: 'Rate reduction 6.875% → 5.5% for 6 months, payment $1,870 → $1,640', icon: '📝', color: 'var(--mongo)' },
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
    <div style={{ padding: '10px 12px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-dim)' }}>
      <div style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>{stat.label}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 800, color: stat.color }}>{stat.format(value)}</div>
    </div>
  );
}

const BAR_HEIGHT_PX = 70;

function BarChart({ data, label, badge }) {
  const maxVal = Math.max(...data.map((d) => d.value));
  return (
    <div style={{ padding: 12, background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-dim)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11 }}>{label}</div>
        {badge && <span style={{ fontSize: 8, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: 'var(--voyage-dim)', color: 'var(--voyage)' }}>{badge}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: BAR_HEIGHT_PX }}>
        {data.map((d, i) => {
          const h = (d.value / maxVal) * BAR_HEIGHT_PX;
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
              <div style={{ fontSize: 7, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--mongo)', marginBottom: 1 }}>{d.value}</div>
              <div style={{ width: '100%', height: h, background: 'var(--mongo)', borderRadius: '2px 2px 0 0', opacity: 0.6, transition: 'height 0.6s ease-out', minHeight: 3 }} />
              <div style={{ fontSize: 7, color: 'var(--text-dim)', whiteSpace: 'nowrap', marginTop: 3 }}>{d.month}</div>
            </div>
          );
        })}
      </div>
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

function EWSPanel({ highlightAlert }) {
  return (
    <div style={{ padding: 12, background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-dim)', animation: 'slideDown 0.3s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12 }}>Early Warning System</div>
        <span style={{ fontSize: 8, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: 'var(--agent-cyan-dim)', color: 'var(--agent-cyan)' }}>
          Time Series + $setWindowFields + Change Streams
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {EWS_SIGNALS.map((s) => {
          const isHighlighted = highlightAlert && (s.status === 'red' || s.status === 'amber');
          return (
            <div key={s.signal} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
              borderBottom: '1px solid var(--border-dim)',
              background: isHighlighted ? (s.status === 'red' ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)') : 'transparent',
              transition: 'background 0.3s',
            }}>
              <StatusDot status={s.status} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{s.signal}</div>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>{s.detail}</div>
              </div>
              <span style={{ fontSize: 10 }}>{s.icon}</span>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 6, fontStyle: 'italic' }}>
        EWS can cut loan loss provisions 10–20% and improve ROE by 20%+
      </div>
    </div>
  );
}

function PSIHealthIndicator() {
  return (
    <div style={{ padding: 10, background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-dim)', animation: 'slideDown 0.3s ease-out' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11, marginBottom: 6 }}>Model Health — PSI Monitor</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ flex: 1, height: 8, background: 'var(--bg-raised)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: '90%', background: 'linear-gradient(90deg, var(--success), var(--hitl-amber))', borderRadius: 4 }} />
          <div style={{ position: 'absolute', left: '90%', top: -2, width: 2, height: 12, background: 'var(--danger)' }} title="Threshold" />
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: 'var(--hitl-amber)' }}>PSI: 0.18</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: 'var(--text-dim)', marginTop: 3 }}>
        <span>Stable (0.0)</span>
        <span style={{ color: 'var(--danger)' }}>Retrain (0.20)</span>
      </div>
    </div>
  );
}

function RenewalInterventionCard({ sceneStep }) {
  const visibleSteps = Math.min(sceneStep >= 4 ? 6 : sceneStep >= 3 ? 4 : sceneStep >= 2 ? 2 : 0, INTERVENTION_STEPS.length);
  if (visibleSteps === 0) return null;

  return (
    <div style={{ padding: 14, background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '2px solid var(--voyage)', animation: 'sceneEnter 0.4s ease-out' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 18 }}>🔄</span>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13, color: 'var(--voyage)' }}>Renewal Agent — Proactive Intervention</div>
          <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Renewal + collections-grade capabilities via MongoDB + AI</div>
        </div>
      </div>

      <div style={{ position: 'relative', paddingLeft: 20 }}>
        <div style={{ position: 'absolute', left: 8, top: 0, bottom: 0, width: 2, background: 'var(--border-dim)' }} />
        {INTERVENTION_STEPS.slice(0, visibleSteps).map((step, i) => (
          <div key={step.label} style={{ position: 'relative', paddingLeft: 20, paddingBottom: 10, animation: 'slideDown 0.3s ease-out' }}>
            <div style={{
              position: 'absolute', left: 0, top: 4, width: 16, height: 16, borderRadius: '50%',
              background: 'var(--bg-surface)', border: `2px solid ${step.color}`, zIndex: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8,
            }}>
              {step.icon}
            </div>
            <div style={{ fontWeight: 600, fontSize: 11, color: step.color, marginBottom: 1 }}>{step.label}</div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{step.detail}</div>
          </div>
        ))}
      </div>

      {visibleSteps >= 6 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 6 }}>
          <div style={{ padding: '6px 8px', background: 'var(--bg-raised)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
            <div style={{ fontSize: 8, color: 'var(--text-dim)', marginBottom: 2 }}>ORIGINAL</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--text-dim)', textDecoration: 'line-through' }}>6.875%</div>
          </div>
          <div style={{ padding: '6px 8px', background: 'var(--mongo-dim)', borderRadius: 'var(--radius-sm)', textAlign: 'center', border: '1px solid var(--mongo)' }}>
            <div style={{ fontSize: 8, color: 'var(--mongo)', marginBottom: 2 }}>NEW RATE</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 800, color: 'var(--mongo)' }}>5.5%</div>
          </div>
          <div style={{ padding: '6px 8px', background: 'var(--bg-raised)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
            <div style={{ fontSize: 8, color: 'var(--text-dim)', marginBottom: 2 }}>PAYMENT</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--success)' }}>$1,640</div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 8, fontSize: 9, color: 'var(--text-dim)', display: 'flex', gap: 6 }}>
        <span style={{ padding: '2px 6px', background: 'var(--voyage-dim)', color: 'var(--voyage)', borderRadius: 3 }}>Vector Search</span>
        <span style={{ padding: '2px 6px', background: 'var(--bg-raised)', color: 'var(--agent-cyan)', borderRadius: 3 }}>Time Series</span>
        <span style={{ padding: '2px 6px', background: 'var(--bg-raised)', color: 'var(--success)', borderRadius: 3 }}>Change Streams</span>
      </div>
    </div>
  );
}

function CrossLifecycleFeedback() {
  return (
    <div style={{ padding: 12, background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--mongo)', animation: 'slideDown 0.3s ease-out' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11, color: 'var(--mongo)', marginBottom: 6 }}>
        Cross-Lifecycle Feedback Loop
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 6 }}>
        This borrower's payment pattern data will refine the Underwriting Agent's risk model for future applicants with similar profiles.
      </div>
      <div style={{ fontSize: 9, color: 'var(--text-dim)', fontStyle: 'italic' }}>
        Collections data → Underwriting model improvement: the gap no vendor has filled.
      </div>
    </div>
  );
}

function LiveEventFeed({ sceneStep }) {
  const [events, setEvents] = useState([]);
  const counterRef = useRef(0);

  useEffect(() => {
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
    const interval = setInterval(addEvent, 1800);
    return () => clearInterval(interval);
  }, [sceneStep]);

  return (
    <div style={{ padding: 12, background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-dim)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11 }}>Live Change Stream</div>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 600, color: 'var(--success)' }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 6px var(--success)', animation: 'pulse 1.5s infinite' }} />
          Streaming
        </span>
      </div>
      <div style={{ maxHeight: 120, overflowY: 'auto' }}>
        {events.map((e) => (
          <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: '1px solid var(--border-dim)', fontSize: 10, animation: 'slideDown 0.3s ease-out' }}>
            <span style={{ fontSize: 11, flexShrink: 0 }}>{e.icon}</span>
            <span style={{ flex: 1, color: e.type === 'agent' ? 'var(--voyage)' : 'var(--text-secondary)', fontWeight: e.type === 'agent' ? 600 : 400 }}>{e.text}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-dim)', flexShrink: 0 }}>{e.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ManagementScene({ sceneStep, currentStepData }) {
  const started = sceneStep >= 0;
  const showEWS = sceneStep >= 0;
  const showPSI = sceneStep >= 1;
  const showAlertHighlight = sceneStep >= 2;
  const showRenewalAgent = sceneStep >= 2;
  const showCrossLifecycle = sceneStep >= 4;

  const [hoveredNode, setHoveredNode] = useState(null);
  const [timelineHighlight, setTimelineHighlight] = useState(null);

  const handleNodeHover = useCallback((nodeId) => setHoveredNode(nodeId), []);
  const handleTimelineHover = useCallback((nodeId) => setTimelineHighlight(nodeId), []);

  const canvasState = useMemo(
    () => mergeCanvasState(MANAGEMENT_STEPS, sceneStep),
    [sceneStep],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <DataSourceStrip sceneKey="management" sceneStep={sceneStep} totalSteps={MANAGEMENT_STEPS.length} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden' }}>
            {started && (
              <WorkflowCanvas
                activeNodes={canvasState.activeNodes}
                activeEdges={canvasState.activeEdges}
                pulsingNodes={canvasState.pulsingNodes}
                completedNodes={canvasState.completedNodes}
                currentScene="management"
                onNodeHover={handleNodeHover}
                highlightNode={timelineHighlight}
              />
            )}
          </div>
          <AnnotationOverlay
            currentStep={currentStepData}
            sceneTitle="Management"
            stepIndex={sceneStep}
            totalSteps={MANAGEMENT_STEPS.length}
          />
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', borderTop: '1px solid var(--border-dim)', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {STATS.map((s) => <AnimatedStat key={s.label} stat={s} />)}
            </div>

            {showEWS && <EWSPanel highlightAlert={showAlertHighlight} />}
            {showPSI && <PSIHealthIndicator />}

            <BarChart data={MONTHLY_DATA} label="Monthly Payment Volume ($M)" badge="Time Series" />
            <LiveEventFeed sceneStep={sceneStep} />

            {showRenewalAgent && <RenewalInterventionCard sceneStep={sceneStep} />}
            {showCrossLifecycle && <CrossLifecycleFeedback />}
          </div>
        </div>

        <div style={{ borderLeft: '1px solid var(--border-dim)', display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--bg-base)', padding: 16 }}>
          <PipelineTimeline
            steps={MANAGEMENT_STEPS}
            stepIndex={sceneStep}
            onEntryHover={handleTimelineHover}
            highlightNodeId={hoveredNode}
          />
        </div>
      </div>
    </div>
  );
}
