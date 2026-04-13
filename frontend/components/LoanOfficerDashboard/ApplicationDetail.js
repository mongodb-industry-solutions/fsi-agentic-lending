"use client";

import { useState, useEffect, useCallback } from 'react';
import { spacing } from '@leafygreen-ui/tokens';
import Badge from '@leafygreen-ui/badge';
import { apiGet, apiPost } from '../../lib/api';

function formatCurrency(amount) {
  if (amount == null) return 'N/A';
  return `$${Number(amount).toLocaleString('en-US')}`;
}

function getRiskColor(score) {
  if (score == null) return 'var(--text-dim)';
  if (score <= 30) return 'var(--success)';
  if (score <= 50) return 'var(--mongo)';
  if (score <= 65) return 'var(--hitl-amber)';
  return 'var(--danger)';
}

function MetricBox({ label, value, color, mono = true }) {
  return (
    <div>
      <div style={{ fontSize: 8, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-body)',
        fontSize: 13, fontWeight: 700, color: color || 'var(--text-primary)',
      }}>
        {value ?? 'N/A'}
      </div>
    </div>
  );
}

function RiskPipelineViz({ applicationId }) {
  const [pipeline, setPipeline] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

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

  const STAGE_COLORS = [
    ['#00684A', 'var(--mongo)'], ['#1A567E', 'var(--tool-blue)'], ['#1A567E', 'var(--tool-blue)'],
    ['#007DAE', 'var(--agent-cyan)'], ['#007DAE', 'var(--agent-cyan)'], ['#007DAE', 'var(--agent-cyan)'], ['#00684A', 'var(--success)'],
  ];

  return (
    <div>
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
        <span>Risk Aggregation Pipeline</span>
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
          {loading && <div style={{ fontSize: 10, color: 'var(--text-dim)', padding: 8 }}>Loading pipeline stages...</div>}
          {pipeline?.pipeline_description && (
            <>
              <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                {pipeline.pipeline_description.map((stage, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{
                      padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700,
                      fontFamily: 'var(--font-mono)',
                      background: `${STAGE_COLORS[i]?.[0]}20`, color: STAGE_COLORS[i]?.[1],
                    }}>
                      {stage.operator}
                    </span>
                    {i < pipeline.pipeline_description.length - 1 && (
                      <span style={{ color: 'var(--text-dim)', fontSize: 9 }}>{'\u2192'}</span>
                    )}
                  </div>
                ))}
              </div>
              {pipeline.pipeline_description.map((stage, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4, fontSize: 9 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', color: STAGE_COLORS[i]?.[1], fontWeight: 700, minWidth: 22 }}>
                    S{stage.stage}
                  </span>
                  <span style={{ color: 'var(--text-secondary)' }}>{stage.description}</span>
                </div>
              ))}
              {pipeline.risk_score != null && (
                <div style={{
                  marginTop: 8, padding: '6px 8px', background: 'var(--bg-surface)',
                  borderRadius: 6, border: '1px solid var(--border-dim)',
                  display: 'flex', gap: spacing[3], flexWrap: 'wrap',
                }}>
                  <MetricBox label="Risk Score" value={`${pipeline.risk_score}/100`} color={getRiskColor(pipeline.risk_score)} />
                  <MetricBox label="Risk Tier" value={pipeline.risk_tier} color={getRiskColor(pipeline.risk_score)} />
                  <MetricBox label="LTV" value={pipeline.ltv != null ? `${pipeline.ltv.toFixed(1)}%` : 'N/A'} />
                  <MetricBox label="Primary Credit" value={pipeline.primary_credit_score} />
                </div>
              )}
            </>
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

function DocumentSearch({ applicationId }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    const data = await apiPost('/documents/search', {
      query: query.trim(),
      application_id: applicationId,
      limit: 5,
    });
    setSearching(false);
    if (data?.results) setResults(data.results);
    else if (Array.isArray(data)) setResults(data);
    else setResults([]);
  }, [query, applicationId]);

  return (
    <div style={{
      padding: spacing[3], background: 'var(--bg-surface)', borderRadius: 8,
      border: '1px solid var(--border-dim)',
    }}>
      <div style={{
        fontSize: 9, fontWeight: 700, color: 'var(--voyage)',
        textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: spacing[2],
      }}>
        Document Search
        <span style={{
          marginLeft: 6, fontSize: 8, fontFamily: 'var(--font-mono)',
          padding: '1px 4px', borderRadius: 4,
          background: 'var(--voyage-dim)', color: 'var(--voyage)', fontWeight: 600,
        }}>
          Atlas Vector Search
        </span>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: spacing[2] }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search documents by meaning..."
          aria-label="Semantic document search"
          style={{
            flex: 1, padding: '6px 10px', fontSize: 11,
            fontFamily: 'inherit',
            background: 'var(--bg-raised)', border: '1px solid var(--border-dim)',
            borderRadius: 6, color: 'var(--text-primary)', outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={searching || !query.trim()}
          style={{
            padding: '6px 12px', borderRadius: 6, border: 'none',
            background: query.trim() ? 'var(--voyage)' : 'var(--border-dim)',
            color: '#fff', fontSize: 10, fontWeight: 600,
            fontFamily: 'var(--font-display)', cursor: query.trim() ? 'pointer' : 'default',
          }}
        >
          {searching ? '...' : 'Search'}
        </button>
      </div>
      {results && results.length === 0 && (
        <div style={{ fontSize: 10, color: 'var(--text-dim)', padding: 4 }}>
          No matching documents found.
        </div>
      )}
      {results && results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {results.map((r, i) => (
            <div key={i} style={{
              padding: '6px 8px', background: 'var(--bg-raised)', borderRadius: 6,
              border: '1px solid var(--border-dim)',
              animation: `thinkingFade 200ms cubic-bezier(0.33, 1, 0.68, 1) ${i * 60}ms both`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {r.doc_type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || r.filename || 'Document'}
                </span>
                {r.score != null && (
                  <span style={{
                    fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
                    padding: '1px 4px', borderRadius: 4,
                    background: r.score > 0.7 ? 'var(--success-dim)' : 'var(--hitl-amber-dim)',
                    color: r.score > 0.7 ? 'var(--success)' : 'var(--hitl-amber)',
                  }}>
                    {(r.score * 100).toFixed(0)}%
                  </span>
                )}
              </div>
              {r.content && (
                <div style={{ fontSize: 9, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {r.content.slice(0, 150)}{r.content.length > 150 ? '...' : ''}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ApplicationDetail({ appDetail, compact = false }) {
  if (!appDetail) return null;

  const {
    application_id, borrower_names, loan_amount, purchase_price, down_payment,
    product, property, income_summary, documents, credit_reports,
    risk_score, risk_tier, gds_ratio, tds_ratio,
  } = appDetail;

  const primaryCredit = credit_reports?.[0];
  const coCredit = credit_reports?.[1];

  if (compact) {
    return (
      <div style={{
        display: 'flex', gap: spacing[3], padding: '8px 12px',
        background: 'var(--bg-surface)', borderRadius: 6,
        border: '1px solid var(--border-dim)', flexWrap: 'wrap', alignItems: 'center',
      }}>
        <MetricBox label="Amount" value={formatCurrency(loan_amount)} color="var(--mongo)" />
        <MetricBox label="Product" value={product} mono={false} />
        {risk_score != null && <MetricBox label="Risk" value={`${risk_score} (${risk_tier})`} color={getRiskColor(risk_score)} />}
        {primaryCredit && <MetricBox label="Credit" value={primaryCredit.score} />}
        {gds_ratio != null && <MetricBox label="GDS" value={`${(gds_ratio * 100).toFixed(1)}%`} />}
        <MetricBox label="Docs" value={documents?.length ?? 0} />
      </div>
    );
  }

  return (
    <div style={{
      padding: spacing[3], overflowY: 'auto',
      display: 'flex', flexDirection: 'column', gap: spacing[3],
    }}>
      {/* Borrower section */}
      <div style={{
        padding: spacing[3], background: 'var(--bg-surface)', borderRadius: 8,
        border: '1px solid var(--border-dim)',
      }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: spacing[2] }}>
          Borrower
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, marginBottom: spacing[2] }}>
          {borrower_names?.join(' & ') || 'Unknown'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing[2] }}>
          <MetricBox label="Annual Income" value={formatCurrency(income_summary?.combined_gross)} color="var(--mongo)" />
          <MetricBox label="Monthly" value={formatCurrency(income_summary?.combined_gross ? Math.round(income_summary.combined_gross / 12) : null)} />
          <MetricBox label="Employment" value={income_summary?.primary_employment || 'N/A'} mono={false} />
        </div>
      </div>

      {/* Loan + Property */}
      <div style={{
        padding: spacing[3], background: 'var(--bg-surface)', borderRadius: 8,
        border: '1px solid var(--border-dim)',
      }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: spacing[2] }}>
          Loan Details
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing[2], marginBottom: spacing[2] }}>
          <MetricBox label="Loan Amount" value={formatCurrency(loan_amount)} color="var(--mongo)" />
          <MetricBox label="Purchase Price" value={formatCurrency(purchase_price)} />
          <MetricBox label="Down Payment" value={formatCurrency(down_payment)} />
          <MetricBox label="Product" value={product} mono={false} />
        </div>
        {property && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing[2] }}>
            <MetricBox label="Property Type" value={property.type || 'N/A'} mono={false} />
            <MetricBox label="Location" value={property.city ? `${property.city}, ${property.province || ''}` : 'N/A'} mono={false} />
            <MetricBox label="Annual Tax" value={formatCurrency(property.annual_tax)} />
          </div>
        )}
      </div>

      {/* Risk + Credit */}
      <div style={{
        padding: spacing[3], background: 'var(--bg-surface)', borderRadius: 8,
        border: '1px solid var(--border-dim)',
      }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: spacing[2] }}>
          Risk Assessment
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing[2], marginBottom: spacing[2] }}>
          <div>
            <div style={{ fontSize: 8, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px', marginBottom: 2 }}>Risk Score</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 800, color: getRiskColor(risk_score) }}>
              {risk_score != null ? risk_score : 'N/A'}
              {risk_score != null && <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600 }}> / 100</span>}
            </div>
          </div>
          <MetricBox label="Tier" value={risk_tier || 'N/A'} color={getRiskColor(risk_score)} />
          <MetricBox label="GDS" value={gds_ratio != null ? `${(gds_ratio * 100).toFixed(1)}%` : 'N/A'} color={gds_ratio > 0.36 ? 'var(--danger)' : undefined} />
          <MetricBox label="TDS" value={tds_ratio != null ? `${(tds_ratio * 100).toFixed(1)}%` : 'N/A'} color={tds_ratio > 0.41 ? 'var(--danger)' : undefined} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing[2] }}>
          <MetricBox label="Primary Credit" value={primaryCredit?.score ?? 'N/A'} color={primaryCredit?.score != null ? (primaryCredit.score >= 750 ? 'var(--success)' : primaryCredit.score >= 650 ? 'var(--hitl-amber)' : 'var(--danger)') : 'var(--text-dim)'} />
          <MetricBox label="Co-Applicant" value={coCredit?.score ?? 'N/A'} />
          <MetricBox label="LTV" value={purchase_price > 0 ? `${((loan_amount / purchase_price) * 100).toFixed(1)}%` : 'N/A'} />
        </div>
      </div>

      {/* Risk Pipeline */}
      {application_id && (
        <RiskPipelineViz applicationId={application_id} />
      )}

      {/* Documents */}
      {documents && documents.length > 0 && (
        <div style={{
          padding: spacing[3], background: 'var(--bg-surface)', borderRadius: 8,
          border: '1px solid var(--border-dim)',
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: spacing[2] }}>
            Documents ({documents.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {documents.map((doc, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '4px 8px', background: 'var(--bg-raised)', borderRadius: 4,
              }}>
                <span style={{ fontSize: 10, color: 'var(--text-primary)', fontWeight: 500 }}>
                  {doc.doc_type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || doc.filename || 'Document'}
                </span>
                <Badge variant={doc.status === 'verified' || doc.status === 'processed' ? 'green' : doc.status === 'error' ? 'red' : 'blue'}>
                  {doc.status || 'pending'}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Semantic Document Search */}
      {application_id && <DocumentSearch applicationId={application_id} />}
    </div>
  );
}
