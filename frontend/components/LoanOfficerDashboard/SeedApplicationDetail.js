"use client";

// Detail view for the decorative APP-DEMO-* queue rows. Purely presentational —
// every byte comes from `frontend/lib/data/seedDemoApps.js`, never from a fetch.
// Each seed's status drives a distinct narrative (processing / HITL review /
// funded) so the dashboard demo looks alive when a seeded row is clicked.
//
// The center column swaps this component in for seed selections and bypasses the
// live phase machine, so none of the fetch-dependent officers panels mount.

import { spacing } from '@leafygreen-ui/tokens';
import Badge from '@leafygreen-ui/badge';
import { formatCurrency, getRiskColor, GDS_LIMIT, TDS_LIMIT } from './utils';

const STATUS_META = {
  processing: { label: 'Processing', color: 'var(--agent-cyan)', bg: 'var(--agent-cyan-dim)' },
  review: { label: 'Awaiting Review', color: 'var(--hitl-amber)', bg: 'var(--hitl-amber-dim)' },
  funded: { label: 'Funded', color: 'var(--success)', bg: 'var(--success-dim)' },
};

const REC_META = {
  approve: { label: 'Approve', color: 'var(--success)', bg: 'var(--success-dim)' },
  approve_with_conditions: { label: 'Approve with conditions', color: 'var(--mongo)', bg: 'var(--mongo-dim)' },
  manual_review: { label: 'Manual review', color: 'var(--hitl-amber)', bg: 'var(--hitl-amber-dim)' },
};

const AGENT_COLOR = {
  supervisor: 'var(--mongo)',
  doc_verifier: 'var(--agent-cyan)',
  credit_puller: 'var(--voyage)',
  loan_app: 'var(--agent-cyan)',
  underwriter: 'var(--tool-blue)',
  hitl_gate: 'var(--hitl-amber)',
  complete: 'var(--success)',
};

function titleCase(s) {
  return String(s || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function relativeTime(ts) {
  if (!ts) return '';
  const diff = Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 1000));
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
      {children}
    </div>
  );
}

function Card({ children, style }) {
  return (
    <div style={{ padding: spacing[3], borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border-dim)', marginBottom: 10, ...(style || {}) }}>
      {children}
    </div>
  );
}

function MetricCell({ label, value, color }) {
  return (
    <div style={{ minWidth: 120 }}>
      <div style={{ fontSize: 8, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px', marginBottom: 2 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 800, color: color || 'var(--text-primary)', whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  );
}

function RatioBar({ label, value, threshold, pass }) {
  const pct = value != null ? Math.min((value / 0.6) * 100, 100) : 0;
  const tickLeft = `${(threshold / 0.6) * 100}%`;
  const color = pass ? 'var(--success)' : 'var(--danger)';
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
        <span style={{ fontSize: 9, color: 'var(--text-dim)', width: 84, flexShrink: 0 }}>{label}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color }}>
          {value != null ? `${(value * 100).toFixed(1)}%` : '—'}
        </span>
      </div>
      <div style={{ position: 'relative', height: 4, borderRadius: 2, background: 'var(--bg-raised)' }}>
        <div style={{ width: pct + '%', height: '100%', borderRadius: 2, background: color }} />
        <div style={{ position: 'absolute', top: -1, left: tickLeft, width: 1, height: 6, background: 'var(--text-dim)', transform: 'translateX(-50%)' }} />
      </div>
      <div style={{ marginTop: 2, fontSize: 7, fontFamily: 'var(--font-mono)', fontWeight: 700, color }}>
        {pass ? 'PASS' : 'FAIL'}
      </div>
    </div>
  );
}

function KeyValueRow({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '5px 0' }}>
      <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{label}</span>
      <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, fontFamily: mono ? 'var(--font-mono)' : 'inherit', textAlign: 'right' }}>{value || '—'}</span>
    </div>
  );
}

// Status-specific centerpiece so the three seeds read distinctly.
function DecisionHero({ app, officerName }) {
  const dc = app.decisionContext || {};
  const meta = REC_META[dc.recommended_action] || { label: 'Officer review', color: 'var(--hitl-amber)', bg: 'var(--hitl-amber-dim)' };
  const hasRecommendation = !!dc.recommended_action && !!dc.recommendation_reason;

  if (app.status === 'review') {
    return (
      <div style={{ padding: spacing[3], borderRadius: 8, background: 'var(--hitl-amber-dim)', border: '1px solid var(--hitl-amber)', marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--hitl-amber)', marginBottom: 10 }}>
          Human-in-the-Loop Review
        </div>
        {hasRecommendation && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{
                padding: '3px 10px', borderRadius: 12, background: meta.color, color: '#fff',
                fontSize: 12, fontWeight: 800, fontFamily: 'var(--font-display)',
              }}>
                {meta.label}
              </span>
              <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>recommendation</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5, marginBottom: 10 }}>
              {dc.recommendation_reason}
            </div>
            {dc.recommended_conditions?.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                  Suggested conditions
                </div>
                {dc.recommended_conditions.map((c, i) => (
                  <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{'•'} {c}</div>
                ))}
              </div>
            )}
          </>
        )}
        <div style={{ marginTop: 10, fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--hitl-amber)' }}>
          AWAITING OFFICER REVIEW — pipeline paused at HITL gate · {officerName}.
        </div>
      </div>
    );
  }

  if (app.status === 'funded') {
    const approval = app.approvalDetails || {};
    return (
      <div style={{ padding: spacing[3], borderRadius: 8, background: 'var(--success-dim)', border: '1px solid var(--success)', marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--success)', marginBottom: 8 }}>
          Auto-Approved
        </div>
        {approval.rate && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 800, color: 'var(--success)' }}>{approval.rate}</span>
            <span style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>mode: {approval.mode || 'auto'}</span>
          </div>
        )}
        {approval.conditions?.length > 0 && (
          <div style={{ marginTop: 6 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Conditions</div>
            {approval.conditions.map((c, i) => (
              <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{'•'} {c}</div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 10, fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--success)' }}>
          FUNDED — ledger balance {formatCurrency(app.loan_amount)}.
        </div>
      </div>
    );
  }

  // processing — mid-pipeline
  return (
    <div style={{ padding: spacing[3], borderRadius: 8, background: 'var(--agent-cyan-dim)', border: '1px solid var(--agent-cyan)', marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--agent-cyan)', marginBottom: 8 }}>
        Underwriting in Progress
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
        {dc.recommendation_reason || 'Documentation verified and credit pulled — underwriter is running GDS/TDS and the OSFI B-20 stress test in parallel.'}
      </div>
      <div style={{ marginTop: 10, fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--agent-cyan)' }}>
        VERIFYING DOCUMENTS + PULLING CREDIT.
      </div>
    </div>
  );
}

function MetricsGrid({ app }) {
  const primaryCredit = app.credit_reports?.[0];
  const coCredit = app.credit_reports?.[1];
  const ratioRows = [
    { label: 'GDS Ratio', value: app.gds_ratio, threshold: GDS_LIMIT, pass: app.gds_ratio != null && app.gds_ratio <= GDS_LIMIT },
    { label: 'TDS Ratio', value: app.tds_ratio, threshold: TDS_LIMIT, pass: app.tds_ratio != null && app.tds_ratio <= TDS_LIMIT },
    ...(app.stress_gds != null ? [{ label: 'Stress GDS', value: app.stress_gds, threshold: GDS_LIMIT, pass: app.stress_gds <= GDS_LIMIT }] : []),
    ...(app.stress_tds != null ? [{ label: 'Stress TDS', value: app.stress_tds, threshold: TDS_LIMIT, pass: app.stress_tds <= TDS_LIMIT }] : []),
  ];

  return (
    <Card>
      <SectionTitle>Risk Assessment</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 12 }}>
        <MetricCell label="Risk Score" value={app.risk_score != null ? `${app.risk_score} / 100` : '—'} color={getRiskColor(app.risk_score)} />
        <MetricCell label="Risk Tier" value={app.risk_tier || '—'} color={getRiskColor(app.risk_score)} />
        <MetricCell
          label="Primary Credit"
          value={primaryCredit?.score ?? '—'}
          color={primaryCredit?.score != null ? (primaryCredit.score >= 750 ? 'var(--success)' : primaryCredit.score >= 650 ? 'var(--hitl-amber)' : 'var(--danger)') : 'var(--text-dim)'}
        />
        {coCredit && <MetricCell label="Co-Applicant" value={coCredit.score} color={coCredit.score >= 650 ? 'var(--text-primary)' : 'var(--hitl-amber)'} />}
        <MetricCell
          label="LTV"
          value={app.purchase_price > 0 ? `${((app.loan_amount / app.purchase_price) * 100).toFixed(1)}%` : '—'}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        {ratioRows.map((r) => (
          <RatioBar key={r.label} {...r} />
        ))}
      </div>
    </Card>
  );
}

function BorrowerCard({ app }) {
  const income = app.income_summary || {};
  const isJoint = (app.borrower_names || []).length > 1 && !!income.co_applicant_gross;
  return (
    <Card>
      <SectionTitle>Borrower{isJoint ? 's' : ''}</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 700, marginBottom: 6 }}>Primary</div>
          <KeyValueRow label="Combined Gross" value={formatCurrency(income.combined_gross)} mono />
          <KeyValueRow label="Employment" value={income.primary_employment} />
        </div>
        {isJoint && (
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 700, marginBottom: 6 }}>Co-Applicant</div>
            <KeyValueRow label="Income" value={formatCurrency(income.co_applicant_gross)} mono />
            <KeyValueRow label="Employment" value={income.co_applicant_employment} />
          </div>
        )}
      </div>
    </Card>
  );
}

function PropertyCard({ app }) {
  const property = app.property || {};
  return (
    <Card>
      <SectionTitle>Property</SectionTitle>
      <KeyValueRow label="Type" value={property.type} />
      <KeyValueRow label="Location" value={property.city ? `${property.city}, ${property.province || ''}` : '—'} />
      <KeyValueRow label="Purchase Price" value={formatCurrency(property.purchase_price)} mono />
      <KeyValueRow label="Annual Tax" value={formatCurrency(property.annual_tax)} mono />
    </Card>
  );
}

function DocumentsCard({ app }) {
  const docs = app.documents || [];
  if (!docs.length) return null;
  const variant = (status) => (status === 'verified' || status === 'processed' ? 'green' : status === 'error' ? 'red' : 'blue');
  return (
    <Card>
      <SectionTitle>Documents ({docs.length})</SectionTitle>
      {docs.map((doc, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          padding: '5px 8px', marginBottom: 4, background: 'var(--bg-base)', borderRadius: 4,
        }}>
          <span style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 500 }}>
            {titleCase(doc.doc_type)}
          </span>
          <Badge variant={variant(doc.status)}>{doc.status || 'pending'}</Badge>
        </div>
      ))}
    </Card>
  );
}

function ActivityTrailCard({ app }) {
  const trail = app.activity_trail || [];
  if (!trail.length) return null;
  return (
    <Card>
      <SectionTitle>Agent Activity Trail</SectionTitle>
      {trail.map((entry, i) => {
        const isGate = entry.agent === 'hitl_gate';
        const isComplete = entry.agent === 'complete';
        const color = AGENT_COLOR[entry.agent] || 'var(--text-dim)';
        return (
          <div
            key={`${entry.agent}-${entry.timestamp}-${i}`}
            style={{
              marginBottom: 6, padding: '8px 10px', borderRadius: 6,
              background: isGate ? 'var(--hitl-amber-dim)' : isComplete ? 'var(--success-dim)' : 'var(--bg-base)',
              border: isGate ? '1px solid var(--hitl-amber)' : isComplete ? '1px solid var(--success)' : '1px solid var(--border-dim)',
              borderLeft: `3px solid ${isGate ? 'var(--hitl-amber)' : isComplete ? 'var(--success)' : color}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: isGate ? 'var(--hitl-amber)' : isComplete ? 'var(--success)' : 'var(--text-primary)' }}>
                {entry.agent}
              </span>
              <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-secondary)' }}>{entry.action}</span>
              <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-dim)' }}>
                {relativeTime(entry.timestamp)}
              </span>
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-dim)', fontStyle: 'italic', lineHeight: 1.5 }}>
              {entry.detail}
            </div>
          </div>
        );
      })}
    </Card>
  );
}

export default function SeedApplicationDetail({ app, officerName = 'Loan Officer' }) {
  if (!app) return null;

  const statusMeta = STATUS_META[app.status] || { label: app.status, color: 'var(--text-dim)', bg: 'var(--bg-raised)' };
  const isJoint = (app.borrower_names || []).length > 1;

  return (
    <div
      role="region"
      aria-label="Application detail preview"
      style={{ padding: spacing[3], background: 'var(--bg-base)' }}
    >
      {/* Hero */}
      <div style={{ padding: spacing[3], borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border-dim)', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, color: 'var(--text-primary)' }}>
              {app.borrower_names?.join(' & ')}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
              {app.application_id} · submitted {relativeTime(app.created_at)}
              {isJoint ? ' · joint application' : ''}
            </div>
          </div>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 12,
            background: statusMeta.bg, color: statusMeta.color, flexShrink: 0,
          }}>
            {app.status === 'review' && (
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: statusMeta.color, animation: 'pulse 1.5s infinite' }} />
            )}
            {statusMeta.label}
          </span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 10 }}>
          <MetricCell label="Loan Amount" value={formatCurrency(app.loan_amount)} color="var(--mongo)" />
          <MetricCell label="Product" value={app.product} />
          <MetricCell label="Purchase Price" value={formatCurrency(app.purchase_price)} />
          <MetricCell label="Down Payment" value={formatCurrency(app.down_payment)} />
        </div>
      </div>

      <DecisionHero app={app} officerName={officerName} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
        <MetricsGrid app={app} />
        <div>
          <BorrowerCard app={app} />
          <PropertyCard app={app} />
        </div>
      </div>

      <DocumentsCard app={app} />
      <ActivityTrailCard app={app} />
    </div>
  );
}
