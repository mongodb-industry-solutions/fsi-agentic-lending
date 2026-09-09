"use client";

import { useState, useEffect } from 'react';
import { WORKFLOW_STAGES } from './constants';
import { formatDuration } from './utils';

/**
 * Consolidated, expandable pipeline step tracker for the officer view.
 *
 * Replaces the previous stack of overlapping step visualizations (StageProgressBar
 * + always-on WorkflowCanvas + LiveUnderwritingResults caption). Shows the 3
 * high-level stages as collapsible boxes: collapsed = name + state + elapsed;
 * expanded = real sub-steps + live metrics. The heavy node diagram is demoted
 * behind a "View diagram" action (onViewDiagram) rendered in a modal by the parent.
 */

// Meaningful sub-steps per stage (infra nodes like mongoAtlas/checkpoint omitted
// to keep the view high-level). `match` substrings map backend agent names.
const STAGE_SUBSTEPS = [
  [
    { key: 'doc', label: 'Document verification', match: ['doc_verifier', 'docverifier'] },
    { key: 'credit', label: 'Credit bureau pull', match: ['credit_puller', 'creditpuller'] },
    { key: 'synth', label: 'Application synthesis', match: ['loan_app', 'appagent'] },
  ],
  [
    { key: 'risk', label: 'Risk scoring', match: ['underwriter'] },
    { key: 'agg', label: 'Risk aggregation pipeline', match: ['aggregation', 'underwriter'] },
    { key: 'rag', label: 'Policy RAG (vector search)', match: ['vectorsearch', 'vector_search'] },
  ],
  [
    { key: 'gate', label: 'Officer review gate', match: ['hitl_gate', 'hitlgate', 'hitl'] },
  ],
];

function formatElapsed(stageTimestamps, i) {
  const start = stageTimestamps?.[i];
  const end = stageTimestamps?.[i + 1];
  if (!start || !end) return null;
  const ms = end - start;
  if (ms <= 0) return null;
  return formatDuration(ms);
}

function StatePill({ state }) {
  const map = {
    complete: { label: 'Done', color: 'var(--success)', bg: 'var(--success-dim)' },
    current: { label: 'Live', color: 'var(--agent-cyan)', bg: 'var(--agent-cyan-dim)' },
    hitl: { label: 'Awaiting', color: 'var(--hitl-amber)', bg: 'var(--hitl-amber-dim)' },
    declined: { label: 'Declined', color: 'var(--danger)', bg: 'var(--danger-dim)' },
    future: { label: 'Pending', color: 'var(--text-dim)', bg: 'var(--bg-raised)' },
  };
  const s = map[state] || map.future;
  return (
    <span style={{
      fontSize: 8, fontWeight: 700, fontFamily: 'var(--font-mono)',
      padding: '2px 7px', borderRadius: 10, textTransform: 'uppercase', letterSpacing: '0.04em',
      color: s.color, background: s.bg, flexShrink: 0,
      display: 'inline-flex', alignItems: 'center', gap: 4,
    }}>
      {state === 'current' && (
        <span style={{
          width: 5, height: 5, borderRadius: '50%', background: s.color,
          boxShadow: `0 0 5px ${s.color}`, animation: 'pulse 1.5s infinite',
        }} />
      )}
      {s.label}
    </span>
  );
}

function SubStep({ label, status }) {
  const color = status === 'done' ? 'var(--success)' : status === 'active' ? 'var(--agent-cyan)' : 'var(--text-dim)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '3px 0' }}>
      <span style={{
        width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
        border: `1.5px solid ${color}`,
        background: status === 'done' ? color : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 8, color: '#fff', fontWeight: 800,
        animation: status === 'active' ? 'pulse 1.5s infinite' : 'none',
      }}>
        {status === 'done' ? '✓' : ''}
      </span>
      <span style={{ color: status === 'pending' ? 'var(--text-dim)' : 'var(--text-secondary)' }}>{label}</span>
    </div>
  );
}

function StageBox({
  index, stage, state, elapsed, substeps, metrics, expanded, onToggle, onViewDiagram,
}) {
  const accent = state === 'complete' ? 'var(--success)'
    : state === 'current' ? 'var(--agent-cyan)'
    : state === 'hitl' ? 'var(--hitl-amber)'
    : state === 'declined' ? 'var(--danger)'
    : 'var(--border-dim)';

  return (
    <div style={{
      border: '1px solid var(--border-dim)',
      borderLeft: `3px solid ${accent}`,
      borderRadius: 6,
      background: 'var(--bg-surface)',
      overflow: 'hidden',
    }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%',
          padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer',
          textAlign: 'left', font: 'inherit',
        }}
      >
        <span style={{
          width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
          border: `2px solid ${accent}`,
          background: state === 'complete' ? accent : 'transparent',
          color: state === 'complete' ? '#fff' : accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 800,
        }}>
          {state === 'complete' ? '✓' : state === 'hitl' ? '!' : index + 1}
        </span>
        <span style={{
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15,
          color: state === 'future' ? 'var(--text-dim)' : 'var(--text-primary)', flex: 1,
        }}>
          {stage.label}
        </span>
        {elapsed && (
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>{elapsed}</span>
        )}
        <StatePill state={state} />
        <span style={{
          fontSize: 10, color: 'var(--text-dim)',
          transform: expanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 150ms ease',
        }}>
          {'▾'}
        </span>
      </button>

      {expanded && (
        <div style={{ padding: '4px 12px 12px 44px', borderTop: '1px solid var(--border-dim)' }}>
          <div style={{ marginTop: 8 }}>
            {substeps.map((s) => <SubStep key={s.key} label={s.label} status={s.status} />)}
          </div>

          {metrics.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {metrics.map((m) => (
                <div key={m.label} style={{
                  padding: '4px 8px', borderRadius: 4, background: 'var(--bg-raised)',
                  fontSize: 9,
                }}>
                  <span style={{ color: 'var(--text-dim)' }}>{m.label}: </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>{m.value}</span>
                </div>
              ))}
            </div>
          )}

          {onViewDiagram && (
            <button
              type="button"
              onClick={() => onViewDiagram(index)}
              style={{
                marginTop: 10, padding: '5px 10px', borderRadius: 6,
                border: '1px solid var(--agent-cyan)', background: 'var(--agent-cyan-dim)',
                color: 'var(--agent-cyan)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'var(--font-display)',
              }}
            >
              View pipeline diagram
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function PipelineStepTracker({
  stage, hitlReached, approved, approvalDetails, stageTimestamps,
  liveAgentOutput = {}, activityEvents = [], onViewDiagram,
}) {
  const effectiveStage = approved
    ? WORKFLOW_STAGES.length - 1
    : stage === -1 ? -1 : Math.max(0, Math.min(stage, WORKFLOW_STAGES.length - 1));
  const isDeclined = approved && approvalDetails?.mode === 'declined';

  // Auto-expand the active stage; let the officer override by clicking.
  const activeIdx = hitlReached && !approved ? 2 : effectiveStage;
  const [expandedIdx, setExpandedIdx] = useState(activeIdx);
  useEffect(() => { setExpandedIdx(activeIdx < 0 ? 0 : activeIdx); }, [activeIdx]);

  const seenAgents = activityEvents.map((e) => (e.agent || '').toLowerCase());

  const stageState = (i) => {
    if (approved) {
      if (i === 2 && isDeclined) return 'declined';
      return i <= effectiveStage ? 'complete' : 'future';
    }
    if (i === 2 && hitlReached) return 'hitl';
    if (i < effectiveStage) return 'complete';
    if (i === effectiveStage) return 'current';
    return 'future';
  };

  const substepsFor = (i, state) => STAGE_SUBSTEPS[i].map((s) => {
    let status = 'pending';
    if (state === 'complete' || state === 'declined') status = 'done';
    else if (state === 'current') status = s.match.some((m) => seenAgents.some((a) => a.includes(m))) ? 'done' : 'active';
    else if (state === 'hitl') status = 'active';
    return { ...s, status };
  });

  const metricsFor = (i) => {
    // Officer view keeps full underwriting detail — surface it in the underwriting
    // and review stages once available.
    if (i < 1) return [];
    const o = liveAgentOutput || {};
    const out = [];
    if (o.primary_credit_score) out.push({ label: 'Credit', value: String(o.primary_credit_score) });
    if (o.document_count) out.push({ label: 'Docs', value: String(o.document_count) });
    if (o.risk_score != null) out.push({ label: 'Risk', value: `${o.risk_score}/100` });
    if (o.risk_tier) out.push({ label: 'Tier', value: String(o.risk_tier) });
    if (o.gds_ratio != null) out.push({ label: 'GDS', value: `${(o.gds_ratio * 100).toFixed(1)}%` });
    if (o.tds_ratio != null) out.push({ label: 'TDS', value: `${(o.tds_ratio * 100).toFixed(1)}%` });
    return out;
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      padding: '10px 16px', borderBottom: '1px solid var(--border-dim)', background: 'var(--bg-base)',
    }}>
      {WORKFLOW_STAGES.map((ws, i) => {
        const state = stageState(i);
        return (
          <StageBox
            key={ws.nodeKey}
            index={i}
            stage={ws}
            state={state}
            elapsed={formatElapsed(stageTimestamps, i)}
            substeps={substepsFor(i, state)}
            metrics={metricsFor(i)}
            expanded={expandedIdx === i}
            onToggle={() => setExpandedIdx(expandedIdx === i ? null : i)}
            onViewDiagram={onViewDiagram}
          />
        );
      })}
    </div>
  );
}
