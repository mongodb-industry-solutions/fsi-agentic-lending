"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { spacing } from '@leafygreen-ui/tokens';
import { apiGet } from '../../lib/api';
import { getRiskColor } from './utils';
import styles from './PipelineExplorer.module.css';

/**
 * Pipeline stage metadata — enriches the backend's pipeline_description
 * with timing estimates, doc counts, and sample MongoDB syntax.
 */
const STAGE_META = [
  {
    operator: '$match',
    label: 'Filter',
    description: 'Filter by application ID',
    collection: 'applications',
    docsIn: '~50',
    docsOut: '1',
    estimatedMs: 1,
    color: 'var(--mongo)',
    colorDim: 'var(--mongo-dim)',
    syntax: '{ "$match": { "application_id": "APP-XXXX" } }',
    sampleOutput: '{ "application_id": "APP-XXXX", "loan_amount": 700000, "purchase_price": 875000, "borrower_ids": ["ObjectId(...)"], "status": "review" }',
  },
  {
    operator: '$lookup',
    label: 'Credit Join',
    description: 'Join credit reports from credit_reports collection',
    collection: 'credit_reports',
    docsIn: '1',
    docsOut: '1 + credit_data[]',
    estimatedMs: 12,
    color: 'var(--tool-blue)',
    colorDim: 'var(--tool-blue-dim)',
    syntax: '{ "$lookup": { "from": "credit_reports", "localField": "borrower_ids", "foreignField": "borrower_id", "as": "credit_data" } }',
    sampleOutput: '{ ...app, "credit_data": [{ "score": 784, "bureau": "Equifax", "accounts": [...] }] }',
  },
  {
    operator: '$lookup',
    label: 'Income Docs',
    description: 'Join income verification documents',
    collection: 'documents',
    docsIn: '1',
    docsOut: '1 + income_docs[]',
    estimatedMs: 8,
    color: 'var(--tool-blue)',
    colorDim: 'var(--tool-blue-dim)',
    syntax: '{ "$lookup": { "from": "documents", "let": { "app_id": "$application_id" }, "pipeline": [{ "$match": { "$expr": { "$eq": ["$application_id", "$$app_id"] } } }, { "$match": { "doc_type": { "$in": ["employment_letter", "income_tax", "paystubs"] } } }], "as": "income_docs" } }',
    sampleOutput: '{ ...app, "income_docs": [{ "doc_type": "employment_letter", "status": "parsed" }, { "doc_type": "paystubs", "status": "parsed" }] }',
  },
  {
    operator: '$addFields',
    label: 'Compute Ratios',
    description: 'Calculate monthly income, LTV, credit scores',
    collection: null,
    docsIn: '1',
    docsOut: '1',
    estimatedMs: 2,
    color: 'var(--agent-cyan)',
    colorDim: 'var(--agent-cyan-dim)',
    syntax: '{ "$addFields": { "monthly_income": { "$divide": ["$income_summary.combined_gross", 12] }, "ltv": { "$multiply": [{ "$divide": ["$loan_amount", "$purchase_price"] }, 100] }, "primary_credit_score": { "$arrayElemAt": ["$credit_data.score", 0] } } }',
    sampleOutput: '{ ...app, "monthly_income": 18558, "ltv": 80.0, "primary_credit_score": 784, "doc_count": 3 }',
  },
  {
    operator: '$addFields',
    label: 'Risk Factors',
    description: 'Score risk factors (credit + LTV adjustments)',
    collection: null,
    docsIn: '1',
    docsOut: '1',
    estimatedMs: 1,
    color: 'var(--agent-cyan)',
    colorDim: 'var(--agent-cyan-dim)',
    syntax: '{ "$addFields": { "credit_risk_points": { "$add": [{ "$cond": [{ "$gte": ["$primary_credit_score", 750] }, -25, { "$cond": [{ "$gte": ["$primary_credit_score", 700] }, -15, -5] }] }, { "$cond": [{ "$lte": ["$ltv", 80] }, -15, { "$cond": [{ "$lte": ["$ltv", 90] }, -5, 0] }] }] } } }',
    sampleOutput: '{ ...app, "credit_risk_points": -40, "ltv_points": -15 }',
  },
  {
    operator: '$addFields',
    label: 'Risk Score',
    description: 'Compute final risk score (0–100)',
    collection: null,
    docsIn: '1',
    docsOut: '1',
    estimatedMs: 1,
    color: 'var(--hitl-amber)',
    colorDim: 'var(--hitl-amber-dim)',
    syntax: '{ "$addFields": { "risk_score": { "$max": [0, { "$min": [100, { "$add": [100, "$credit_risk_points"] }] }] } } }',
    sampleOutput: '{ ...app, "risk_score": 35, "risk_tier": "B+" }',
  },
  {
    operator: '$project',
    label: 'Shape Output',
    description: 'Project clean output for underwriting decision',
    collection: null,
    docsIn: '1',
    docsOut: '1',
    estimatedMs: 1,
    color: 'var(--success)',
    colorDim: 'var(--success-dim)',
    syntax: '{ "$project": { "application_id": 1, "risk_score": 1, "risk_tier": 1, "ltv": 1, "primary_credit_score": 1, "co_credit_score": 1, "doc_count": 1, "loan_amount": 1, "purchase_price": 1 } }',
    sampleOutput: '{ "application_id": "APP-XXXX", "risk_score": 35, "risk_tier": "B+", "ltv": 80.0, "primary_credit_score": 784, "doc_count": 3 }',
  },
].map((s) => ({ ...s, syntaxParsed: JSON.parse(s.syntax) }));

const MAX_TIMING = Math.max(...STAGE_META.map((s) => s.estimatedMs));

function StageNode({ stage, index, isExpanded, onToggle, isNarrow }) {
  const timeBarWidth = `${Math.max(8, (stage.estimatedMs / MAX_TIMING) * 100)}%`;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isExpanded}
      className={`${styles.stageNode} ${isExpanded ? styles.stageNodeExpanded : ''}`}
      style={{
        '--stage-color': stage.color,
        '--stage-color-dim': stage.colorDim,
        minWidth: isNarrow ? 'auto' : 130,
        flex: isNarrow ? '1 1 auto' : '0 0 auto',
      }}
    >
      {/* Operator + label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
          color: stage.color,
        }}>
          {stage.operator}
        </span>
      </div>
      <div style={{
        fontSize: 9, color: 'var(--text-secondary)', lineHeight: 1.3,
        marginBottom: 6,
      }}>
        {stage.label}
      </div>

      {/* Badges row */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
        <span style={{
          fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
          padding: '1px 5px', borderRadius: 3,
          background: 'var(--agent-cyan-dim)', color: 'var(--agent-cyan)',
        }}>
          {stage.estimatedMs}ms
        </span>
        <span style={{
          fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 600,
          padding: '1px 5px', borderRadius: 3,
          background: 'var(--bg-raised)', color: 'var(--text-dim)',
        }}>
          {stage.docsOut}
        </span>
        {stage.collection && (
          <span style={{
            fontSize: 7, fontFamily: 'var(--font-mono)', fontWeight: 600,
            padding: '1px 4px', borderRadius: 3,
            background: 'var(--mongo-dim)', color: 'var(--mongo)',
          }}>
            {stage.collection}
          </span>
        )}
      </div>

      {/* Proportional time bar */}
      <div style={{
        height: 3, background: 'var(--bg-surface)', borderRadius: 2,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: timeBarWidth,
          background: stage.color, borderRadius: 2,
          transition: 'width 400ms cubic-bezier(0.33, 1, 0.68, 1)',
        }} />
      </div>
    </button>
  );
}

function StageDetail({ stage, index }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(stage.syntax).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }, [stage.syntax]);

  return (
    <div className={styles.stageDetail} style={{
      padding: '10px 12px',
      background: 'var(--bg-void)',
      borderRadius: '0 0 6px 6px',
      border: '1px solid var(--border-dim)',
      borderTop: 'none',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{
          fontSize: 9, fontWeight: 700, color: 'var(--text-dim)',
          textTransform: 'uppercase', letterSpacing: '0.5px',
        }}>
          Stage {index + 1}: {stage.description}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          style={{
            fontSize: 9, fontFamily: 'var(--font-display)', fontWeight: 600,
            padding: '2px 8px', borderRadius: 4,
            border: '1px solid var(--border-dim)', background: 'var(--bg-surface)',
            color: copied ? 'var(--mongo)' : 'var(--text-dim)',
            cursor: 'pointer', transition: 'color 150ms ease',
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {/* Pipeline stage JSON */}
        <div>
          <div style={{
            fontSize: 8, fontWeight: 700, color: 'var(--mongo)',
            textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4,
          }}>
            Pipeline Stage
          </div>
          <pre style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, lineHeight: 1.5,
            color: 'var(--text-secondary)', background: 'var(--bg-base)',
            padding: 8, borderRadius: 4, border: '1px solid var(--border-dim)',
            margin: 0, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          }}>
            {JSON.stringify(stage.syntaxParsed, null, 2)}
          </pre>
        </div>
        {/* Sample output */}
        <div>
          <div style={{
            fontSize: 8, fontWeight: 700, color: 'var(--tool-blue)',
            textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4,
          }}>
            Sample Output
          </div>
          <pre style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, lineHeight: 1.5,
            color: 'var(--text-secondary)', background: 'var(--bg-base)',
            padding: 8, borderRadius: 4, border: '1px solid var(--border-dim)',
            margin: 0, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          }}>
            {stage.sampleOutput}
          </pre>
        </div>
      </div>
    </div>
  );
}

export default function PipelineExplorer({ applicationId }) {
  const [pipeline, setPipeline] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [expandedStage, setExpandedStage] = useState(null);
  const [copyAllFeedback, setCopyAllFeedback] = useState(false);
  const containerRef = useRef(null);
  const [isNarrow, setIsNarrow] = useState(false);

  const fetchPipeline = useCallback(async () => {
    if (pipeline || loading) return;
    setLoading(true);
    const data = await apiGet(`/applications/${applicationId}/risk-pipeline`);
    setLoading(false);
    if (data) setPipeline(data);
  }, [applicationId, pipeline, loading]);

  useEffect(() => {
    if (expanded && !pipeline && !loading) fetchPipeline();
  }, [expanded, pipeline, loading, fetchPipeline]);

  // Responsive: detect narrow container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setIsNarrow(el.getBoundingClientRect().width < 500);
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setIsNarrow(entry.contentRect.width < 500);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleCopyAll = useCallback(() => {
    const fullPipeline = JSON.stringify(STAGE_META.map((s) => s.syntaxParsed), null, 2);
    navigator.clipboard.writeText(fullPipeline).then(() => {
      setCopyAllFeedback(true);
      setTimeout(() => setCopyAllFeedback(false), 2000);
    }).catch(() => {});
  }, []);

  const totalMs = STAGE_META.reduce((sum, s) => sum + s.estimatedMs, 0);

  return (
    <div ref={containerRef}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%', padding: '8px 10px',
          background: 'var(--bg-raised)', border: '1px solid var(--border-dim)',
          borderRadius: expanded ? '6px 6px 0 0' : 6,
          cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: 10, fontWeight: 600, color: 'var(--mongo)', fontFamily: 'var(--font-display)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>Aggregation Pipeline</span>
          <span style={{
            fontSize: 7, fontFamily: 'var(--font-mono)', fontWeight: 700,
            padding: '1px 4px', borderRadius: 3,
            background: 'var(--mongo-dim)', color: 'var(--mongo)',
          }}>
            {STAGE_META.length} STAGES
          </span>
          <span style={{
            fontSize: 7, fontFamily: 'var(--font-mono)', fontWeight: 700,
            padding: '1px 4px', borderRadius: 3,
            background: 'var(--agent-cyan-dim)', color: 'var(--agent-cyan)',
          }}>
            ~{totalMs}ms
          </span>
        </div>
        <span style={{
          transform: expanded ? 'rotate(180deg)' : 'rotate(0)',
          transition: 'transform 0.2s', display: 'inline-block',
        }}>{'\u25BE'}</span>
      </button>

      {expanded && (
        <div style={{
          padding: '10px 12px', background: 'var(--bg-raised)',
          border: '1px solid var(--border-dim)', borderTop: 'none',
          borderRadius: '0 0 6px 6px',
        }}>
          {loading && (
            <div style={{ fontSize: 10, color: 'var(--text-dim)', padding: 8 }}>
              Loading pipeline stages...
            </div>
          )}

          {/* Pipeline flow */}
          <div className={isNarrow ? styles.flowVertical : styles.flowHorizontal}>
            {STAGE_META.map((stage, i) => (
              <div key={i} className={styles.stageWrapper}>
                <StageNode
                  stage={stage}
                  index={i}
                  isExpanded={expandedStage === i}
                  onToggle={() => setExpandedStage(expandedStage === i ? null : i)}
                  isNarrow={isNarrow}
                />
                {/* Connector */}
                {i < STAGE_META.length - 1 && !isNarrow && (
                  <div className={styles.connector}>
                    <div className={styles.connectorLine} />
                    <div className={styles.connectorArrow} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Expanded stage detail */}
          {expandedStage !== null && (
            <StageDetail stage={STAGE_META[expandedStage]} index={expandedStage} />
          )}

          {/* Results summary + Copy All */}
          {pipeline && (
            <div style={{
              marginTop: 8, padding: '8px 10px', background: 'var(--bg-surface)',
              borderRadius: 6, border: '1px solid var(--border-dim)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
            }}>
              <div style={{ display: 'flex', gap: spacing[3], flexWrap: 'wrap' }}>
                {pipeline.risk_score != null && (
                  <div>
                    <div style={{ fontSize: 8, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 1 }}>Risk Score</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 800, color: getRiskColor(pipeline.risk_score) }}>
                      {pipeline.risk_score}<span style={{ fontSize: 9, color: 'var(--text-dim)' }}>/100</span>
                    </div>
                  </div>
                )}
                {pipeline.risk_tier && (
                  <div>
                    <div style={{ fontSize: 8, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 1 }}>Tier</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 800, color: getRiskColor(pipeline.risk_score) }}>
                      {pipeline.risk_tier}
                    </div>
                  </div>
                )}
                {pipeline.primary_credit_score != null && (
                  <div>
                    <div style={{ fontSize: 8, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 1 }}>Credit</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 800 }}>{pipeline.primary_credit_score}</div>
                  </div>
                )}
                {pipeline.ltv != null && (
                  <div>
                    <div style={{ fontSize: 8, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 1 }}>LTV</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 800 }}>{pipeline.ltv.toFixed(1)}%</div>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={handleCopyAll}
                style={{
                  fontSize: 9, fontFamily: 'var(--font-display)', fontWeight: 600,
                  padding: '4px 10px', borderRadius: 4,
                  border: '1px solid var(--mongo)', background: copyAllFeedback ? 'var(--mongo-dim)' : 'transparent',
                  color: 'var(--mongo)', cursor: 'pointer', transition: 'background 150ms ease',
                }}
              >
                {copyAllFeedback ? 'Copied Pipeline' : 'Copy Full Pipeline'}
              </button>
            </div>
          )}

          {!loading && !pipeline && (
            <div style={{ fontSize: 10, color: 'var(--text-dim)', padding: 8 }}>
              Pipeline data not available for this application.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
