"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { spacing } from '@leafygreen-ui/tokens';
import { apiGet } from '../../lib/api';

// TODO: reconcile with PipelineExplorer.STAGE_META — same 7-stage pipeline
// but this list uses outputKey/outputPreview closures for live-output binding
// while STAGE_META carries collection/docsIn/docsOut/syntax/sampleOutput for
// the explorer view. Consolidate into a single pipelineStages.js module when
// one surface needs both sets of metadata.
const PIPELINE_STAGES = [
  {
    operator: '$match',
    label: 'Filter Application',
    description: 'Match by application_id and processing status',
    outputKey: 'document_count',
    outputPreview: (d) => d.document_count != null ? `${d.document_count} income docs matched` : null,
    color: 'var(--mongo)',
    colorDim: 'var(--mongo-dim)',
    estimatedMs: 0.8,
  },
  {
    operator: '$lookup',
    label: 'Join Credit Reports',
    description: 'credit_reports via borrower_ids',
    outputKey: 'primary_credit_score',
    outputPreview: (d) => d.primary_credit_score != null ? `Score: ${d.primary_credit_score}` : null,
    color: 'var(--voyage)',
    colorDim: 'var(--voyage-dim)',
    estimatedMs: 1.2,
  },
  {
    operator: '$lookup',
    label: 'Join Documents',
    description: 'documents via application reference',
    outputKey: 'document_count',
    outputPreview: (d) => d.document_count != null ? `${d.document_count} docs linked` : null,
    color: 'var(--voyage)',
    colorDim: 'var(--voyage-dim)',
    estimatedMs: 0.9,
  },
  {
    operator: '$addFields',
    label: 'Compute Ratios',
    description: 'GDS + TDS from income, debt, property',
    outputKey: 'gds_ratio',
    outputPreview: (d) => d.gds_ratio != null ? `GDS: ${(d.gds_ratio * 100).toFixed(1)}% | TDS: ${(d.tds_ratio * 100).toFixed(1)}%` : null,
    color: 'var(--tool-blue)',
    colorDim: 'var(--tool-blue-dim)',
    estimatedMs: 0.1,
  },
  {
    operator: '$addFields',
    label: 'Score Risk Factors',
    description: 'Credit, LTV, income stability, debt load',
    outputKey: 'risk_score',
    outputPreview: (d) => d.risk_score != null ? `${Object.keys(d).filter(k => k.includes('risk') || k.includes('credit') || k.includes('ltv')).length} factors evaluated` : null,
    color: 'var(--tool-blue)',
    colorDim: 'var(--tool-blue-dim)',
    estimatedMs: 0.2,
  },
  {
    operator: '$addFields',
    label: 'Aggregate Risk Score',
    description: 'Weighted composite score 0-100',
    outputKey: 'risk_score',
    outputPreview: (d) => d.risk_score != null ? `Risk: ${d.risk_score}/100 (${d.risk_tier || '?'})` : null,
    color: 'var(--tool-blue)',
    colorDim: 'var(--tool-blue-dim)',
    estimatedMs: 0.1,
  },
  {
    operator: '$project',
    label: 'Shape Output',
    description: 'Project final risk assessment',
    outputKey: 'decision',
    outputPreview: (d) => d.decision ? `Decision: ${d.decision}` : 'Decision-ready document',
    color: 'var(--text-secondary)',
    colorDim: 'var(--bg-raised)',
    estimatedMs: 0.1,
  },
];

function StageCard({ stage, index, isComplete, isActive, output }) {
  const preview = isComplete ? stage.outputPreview(output) : null;

  return (
    <div style={{
      display: 'flex', gap: 8, alignItems: 'flex-start',
      opacity: isComplete ? 1 : isActive ? 0.9 : 0.35,
      animation: isComplete ? 'pipelineStageIn 300ms cubic-bezier(0.33, 1, 0.68, 1) both' : undefined,
      transition: 'opacity 280ms cubic-bezier(0.33, 1, 0.68, 1)',
    }}>
      {/* Stage number + connector */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
        <div style={{
          width: 18, height: 18, borderRadius: '50%',
          background: isComplete ? stage.color : 'var(--bg-raised)',
          border: `1.5px solid ${isComplete ? stage.color : 'var(--border-dim)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)',
          color: isComplete ? '#fff' : 'var(--text-dim)',
          transition: 'all 280ms cubic-bezier(0.33, 1, 0.68, 1)',
        }}>
          {isComplete ? '\u2713' : index + 1}
        </div>
        {index < PIPELINE_STAGES.length - 1 && (
          <div style={{
            width: 1, height: 16, flexShrink: 0,
            background: isComplete ? stage.color : 'var(--border-dim)',
            opacity: isActive ? 1 : 0.4,
            animation: isActive ? 'pipelineFlow 1.5s ease-in-out infinite' : undefined,
            transition: 'background 300ms ease',
          }} />
        )}
      </div>

      {/* Stage content */}
      <div style={{
        flex: 1, minWidth: 0,
        padding: '3px 8px 6px',
        borderLeft: `3px solid ${isComplete ? stage.color : 'var(--border-dim)'}`,
        background: isActive ? stage.colorDim : 'transparent',
        borderRadius: '0 4px 4px 0',
        transition: 'background 220ms cubic-bezier(0.33, 1, 0.68, 1), border-left-color 300ms ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
            color: isComplete ? stage.color : 'var(--text-dim)',
          }}>
            {stage.operator}
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
            {stage.label}
          </span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
            {isComplete ? `${stage.estimatedMs}ms` : ''}
          </span>
        </div>
        <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 1 }}>
          {stage.description}
        </div>
        {preview && (
          <div style={{
            fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600,
            color: stage.color, marginTop: 2,
          }}>
            {preview}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AggregationPipelineVisualizer({ applicationId, liveAgentOutput, expanded, onToggle }) {
  const [autoExpanded, setAutoExpanded] = useState(false);
  const [fallbackData, setFallbackData] = useState(null);
  const userCollapsedRef = useRef(false);
  const prevExpandedRef = useRef(expanded);

  // REST fallback: if SSE `liveAgentOutput` never populates (e.g. /stream
  // reconnect path never sees node_complete events, or K8s proxy dropped
  // early frames), fetch /applications/{id} and derive the same metrics.
  // This guarantees the visualizer fills in for any in-flight application.
  useEffect(() => {
    if (!applicationId) return undefined;
    const hasLiveData = liveAgentOutput && (
      liveAgentOutput.risk_score != null ||
      liveAgentOutput.gds_ratio != null ||
      liveAgentOutput.primary_credit_score != null
    );
    if (hasLiveData) {
      setFallbackData(null);
      return undefined;
    }
    let cancelled = false;
    let timer = null;
    const tick = async () => {
      if (cancelled) return;
      try {
        const app = await apiGet(`/applications/${applicationId}`);
        if (cancelled || !app) return;
        const derived = {
          document_count: Array.isArray(app.documents) ? app.documents.length : undefined,
          primary_credit_score: app.primary_credit_score,
          gds_ratio: app.gds_ratio,
          tds_ratio: app.tds_ratio,
          risk_score: app.risk_score,
          risk_tier: app.risk_tier,
          decision: app.status,
        };
        setFallbackData(derived);
      } catch {
        // Swallow — next tick will retry.
      }
      if (!cancelled) timer = setTimeout(tick, 5000);
    };
    // First attempt after 3s to give SSE a chance to win.
    timer = setTimeout(tick, 3000);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [applicationId, liveAgentOutput?.risk_score, liveAgentOutput?.gds_ratio, liveAgentOutput?.primary_credit_score]);

  // Merge: prefer whichever source has more stage-relevant signal, so that
  // during reconnect (where SSE may only emit early node_complete events like
  // `document_count`) the REST fallback — which reads persisted risk metrics —
  // still gets to fill in downstream stages. We count stage-mapped keys from
  // each source and pick the winner; ties prefer live data.
  const effectiveOutput = useMemo(() => {
    const stageKeys = ['document_count', 'primary_credit_score', 'gds_ratio', 'tds_ratio', 'risk_score', 'decision'];
    const count = (obj) => obj ? stageKeys.filter((k) => obj[k] != null).length : 0;
    const liveCount = count(liveAgentOutput);
    const fbCount = count(fallbackData);
    if (liveCount === 0 && fbCount === 0) return liveAgentOutput || {};
    if (fbCount > liveCount) return fallbackData;
    return liveAgentOutput || fallbackData || {};
  }, [liveAgentOutput, fallbackData]);

  // Track user-initiated collapse so we don't fight their intent.
  useEffect(() => {
    if (prevExpandedRef.current && !expanded) {
      userCollapsedRef.current = true;
    }
    prevExpandedRef.current = expanded;
  }, [expanded]);

  const handleToggle = () => {
    if (expanded) userCollapsedRef.current = true;
    if (onToggle) onToggle();
  };

  // Auto-expand when underwriting data arrives — but only once, and never
  // after the user has manually collapsed the panel.
  useEffect(() => {
    if (userCollapsedRef.current) return;
    if (!autoExpanded && (effectiveOutput?.risk_score != null || effectiveOutput?.gds_ratio != null)) {
      setAutoExpanded(true);
      if (!expanded && onToggle) onToggle();
    }
    // expanded and onToggle intentionally omitted — autoExpanded guards against re-fire
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveOutput?.risk_score, effectiveOutput?.gds_ratio, autoExpanded]);

  // Determine which stages are complete based on available data
  const completedStages = useMemo(() => {
    if (!effectiveOutput || Object.keys(effectiveOutput).length === 0) return 0;
    // Progressive: each stage completes when its output key has data
    let completed = 0;
    for (const stage of PIPELINE_STAGES) {
      if (effectiveOutput[stage.outputKey] != null) {
        completed = PIPELINE_STAGES.indexOf(stage) + 1;
      }
    }
    // If risk_score exists, all stages complete
    if (effectiveOutput.risk_score != null) return PIPELINE_STAGES.length;
    return completed;
  }, [effectiveOutput]);

  const totalMs = PIPELINE_STAGES.reduce((s, st) => s + st.estimatedMs, 0);
  const hasData = completedStages > 0;
  const allComplete = completedStages === PIPELINE_STAGES.length;

  // Collapsed summary
  const summaryText = hasData
    ? `${PIPELINE_STAGES.length}-Stage Pipeline | ${totalMs.toFixed(1)}ms${effectiveOutput?.risk_score != null ? ` | Risk: ${effectiveOutput.risk_score}/100` : ''}`
    : `${PIPELINE_STAGES.length}-Stage Aggregation Pipeline`;

  return (
    <div style={{ borderTop: '1px solid var(--border-dim)', background: 'var(--bg-void)' }}>
      {/* Collapsible header */}
      <button
        type="button"
        onClick={handleToggle}
        style={{
          width: '100%', padding: '6px 10px',
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          font: 'inherit',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--tool-blue)', fontFamily: 'var(--font-display)' }}>
            Aggregation Pipeline
          </span>
          <span style={{
            fontSize: 7, fontFamily: 'var(--font-mono)', fontWeight: 700,
            padding: '1px 4px', borderRadius: 3,
            background: 'var(--tool-blue-dim)', color: 'var(--tool-blue)',
          }}>
            {completedStages}/{PIPELINE_STAGES.length}
          </span>
          {allComplete && (
            <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--mongo)', fontFamily: 'var(--font-mono)' }}>
              {'\u2713'} {totalMs.toFixed(1)}ms
            </span>
          )}
        </div>
        <span style={{
          fontSize: 10, color: 'var(--text-dim)',
          transform: expanded ? 'rotate(180deg)' : 'rotate(0)',
          transition: 'transform 150ms ease', display: 'inline-block',
        }}>{'\u25BE'}</span>
      </button>

      {/* Collapsed summary */}
      {!expanded && hasData && (
        <div style={{
          padding: '0 10px 6px', fontSize: 9, fontFamily: 'var(--font-mono)',
          color: 'var(--text-dim)',
        }}>
          {summaryText}
        </div>
      )}

      {/* Expanded stages */}
      {expanded && (
        <div style={{ padding: `0 ${spacing[2]}px ${spacing[3]}px`, display: 'flex', flexDirection: 'column', gap: 0 }}>
          {PIPELINE_STAGES.map((stage, i) => (
            <StageCard
              key={`${stage.operator}-${i}`}
              stage={stage}
              index={i}
              isComplete={i < completedStages}
              isActive={i === completedStages}
              output={effectiveOutput || {}}
            />
          ))}

          {/* Summary footer */}
          {allComplete && (
            <div style={{
              marginTop: spacing[2], padding: '6px 8px',
              background: 'var(--mongo-dim)', borderRadius: 6,
              border: '1px solid var(--mongo)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              fontSize: 10, fontFamily: 'var(--font-mono)',
            }}>
              <span style={{ fontWeight: 700, color: 'var(--mongo)' }}>
                Pipeline Complete
              </span>
              <span style={{ color: 'var(--text-dim)' }}>
                {totalMs.toFixed(1)}ms total | {PIPELINE_STAGES.length} stages
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
