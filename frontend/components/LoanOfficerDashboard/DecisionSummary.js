"use client";

import { useState, useEffect } from 'react';
import { spacing } from '@leafygreen-ui/tokens';
import Badge from '@leafygreen-ui/badge';
import { apiGet } from '../../lib/api';

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

function StageTimeline({ trail }) {
  if (!trail || trail.length === 0) return null;

  const stages = [];
  let currentStage = null;

  trail.forEach((entry) => {
    const agent = entry.agent || 'system';
    if (agent !== currentStage?.agent) {
      if (currentStage) {
        currentStage.endTime = entry.timestamp;
      }
      currentStage = { agent, startTime: entry.timestamp, endTime: entry.timestamp, actions: [entry] };
      stages.push(currentStage);
    } else {
      currentStage.actions.push(entry);
      currentStage.endTime = entry.timestamp;
    }
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: spacing[3] }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
        Processing Timeline
      </div>
      {stages.map((stage, i) => {
        const start = stage.startTime ? new Date(stage.startTime) : null;
        const end = stage.endTime ? new Date(stage.endTime) : null;
        const durationMs = start && end ? end - start : 0;
        const durationLabel = durationMs < 1000 ? `${durationMs}ms` : `${(durationMs / 1000).toFixed(1)}s`;

        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: i === stages.length - 1 ? 'var(--success)' : 'var(--agent-cyan)',
              flexShrink: 0,
            }} />
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{
                fontSize: 10, fontWeight: 600, color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
              }}>
                {stage.agent}
              </span>
              <span style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                {stage.actions.length} actions · {durationLabel}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PolicyViolations({ trail }) {
  const violations = (trail || []).filter((e) =>
    e.action?.includes('decision') || e.action?.includes('decline') ||
    e.action?.includes('stress_test') || e.action?.includes('error') ||
    e.action?.includes('policy') || e.action?.includes('escalat')
  );

  if (violations.length === 0) return null;

  return (
    <div style={{
      padding: spacing[3], background: 'var(--danger-dim)',
      borderRadius: 6, border: '1px solid var(--danger)',
      marginBottom: spacing[3],
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
        Policy Violations & Escalation Triggers
      </div>
      {violations.map((v, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4, fontSize: 10 }}>
          <span style={{ color: 'var(--danger)', fontWeight: 700, flexShrink: 0 }}>{'\u25CF'}</span>
          <div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--danger)', fontWeight: 600 }}>{v.agent}</span>
            <span style={{ color: 'var(--text-secondary)', marginLeft: 4 }}>{v.detail || v.action}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DecisionSummary({ applicationId, appDetail, approvalDetails, appName, onClose }) {
  const [trail, setTrail] = useState(null);
  const [showAudit, setShowAudit] = useState(false);

  useEffect(() => {
    if (!applicationId) return;
    apiGet(`/hitl/${applicationId}/context`).then((ctx) => {
      if (ctx?.activity_trail) setTrail(ctx.activity_trail);
    });
  }, [applicationId]);

  const isDeclined = approvalDetails?.mode === 'declined';
  const isAuto = approvalDetails?.mode === 'auto';
  const isHITL = approvalDetails?.mode === 'recommended' || approvalDetails?.mode === 'modified';
  const isManual = approvalDetails?.mode === 'manual';

  const statusColor = isDeclined ? 'var(--danger)' : 'var(--success)';
  const statusDimColor = isDeclined ? 'var(--danger-dim)' : 'var(--success-dim)';

  const totalTime = trail && trail.length >= 2
    ? (() => {
        const first = new Date(trail[0].timestamp);
        const last = new Date(trail[trail.length - 1].timestamp);
        const ms = last - first;
        return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
      })()
    : null;

  return (
    <div style={{
      padding: spacing[3], background: statusDimColor,
      borderRadius: 8, border: `1px solid ${statusColor}`,
      animation: 'slideDown 0.3s ease-out',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[3] }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            border: `2px solid ${statusColor}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, color: statusColor,
          }}>
            {isDeclined ? '\u2715' : '\u2713'}
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: statusColor }}>
              {isDeclined ? 'APPLICATION DECLINED' : 'LOAN APPROVED'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
              {appName} · {appDetail?.product || ''}
              {approvalDetails?.rate && ` @ ${approvalDetails.rate}`}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
          <Badge variant={isAuto ? 'blue' : isHITL ? 'yellow' : isManual ? 'lightgray' : 'red'}>
            {isAuto ? 'Auto-Approved' : isHITL ? 'Officer Reviewed' : isManual ? 'Manual' : 'Declined'}
          </Badge>
          {totalTime && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-dim)' }}>
              {totalTime}
            </span>
          )}
        </div>
      </div>

      {/* Officer modifications (HITL) */}
      {(isHITL || isManual) && (
        <div style={{
          padding: spacing[2], background: 'var(--bg-surface)',
          borderRadius: 6, border: '1px solid var(--border-dim)',
          marginBottom: spacing[3],
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
            Officer Decision
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing[2] }}>
            {approvalDetails?.rate && (
              <div>
                <div style={{ fontSize: 8, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Rate</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--mongo)' }}>{approvalDetails.rate}</div>
              </div>
            )}
            {appDetail?.risk_score != null && (
              <div>
                <div style={{ fontSize: 8, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Risk Score</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: getRiskColor(appDetail.risk_score) }}>{appDetail.risk_score}/100</div>
              </div>
            )}
            {appDetail?.loan_amount && (
              <div>
                <div style={{ fontSize: 8, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Amount</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700 }}>{formatCurrency(appDetail.loan_amount)}</div>
              </div>
            )}
          </div>
          {approvalDetails?.conditions && (
            <div style={{ marginTop: spacing[2], fontSize: 10, color: 'var(--text-secondary)' }}>
              <span style={{ fontWeight: 600 }}>Conditions:</span> {approvalDetails.conditions}
            </div>
          )}
        </div>
      )}

      {/* Key metrics for auto-approve */}
      {isAuto && appDetail && (
        <div style={{
          padding: spacing[2], background: 'var(--bg-surface)',
          borderRadius: 6, border: '1px solid var(--border-dim)',
          marginBottom: spacing[3],
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
            Automated Decision Summary
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing[2] }}>
            <div>
              <div style={{ fontSize: 8, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Risk Score</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: getRiskColor(appDetail.risk_score) }}>{appDetail.risk_score ?? 'N/A'}</div>
            </div>
            <div>
              <div style={{ fontSize: 8, color: 'var(--text-dim)', textTransform: 'uppercase' }}>GDS</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700 }}>{appDetail.gds_ratio != null ? `${(appDetail.gds_ratio * 100).toFixed(1)}%` : 'N/A'}</div>
            </div>
            <div>
              <div style={{ fontSize: 8, color: 'var(--text-dim)', textTransform: 'uppercase' }}>TDS</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700 }}>{appDetail.tds_ratio != null ? `${(appDetail.tds_ratio * 100).toFixed(1)}%` : 'N/A'}</div>
            </div>
            <div>
              <div style={{ fontSize: 8, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Credit</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700 }}>{appDetail.credit_reports?.[0]?.score ?? 'N/A'}</div>
            </div>
          </div>
        </div>
      )}

      {/* Policy violations for declined */}
      {isDeclined && trail && <PolicyViolations trail={trail} />}

      {/* Stage timeline */}
      {trail && trail.length > 0 && <StageTimeline trail={trail} />}

      {/* Audit trail toggle */}
      {trail && trail.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowAudit(!showAudit)}
            style={{
              all: 'unset', cursor: 'pointer', width: '100%',
              padding: '6px 10px', background: 'var(--bg-surface)',
              border: '1px solid var(--border-dim)',
              borderRadius: showAudit ? '6px 6px 0 0' : 6,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)',
              boxSizing: 'border-box', marginBottom: showAudit ? 0 : spacing[3],
            }}
          >
            <span>Full Audit Trail ({trail.length} entries)</span>
            <span style={{
              transform: showAudit ? 'rotate(180deg)' : 'rotate(0)',
              transition: 'transform 0.2s', display: 'inline-block',
            }}>{'\u25BE'}</span>
          </button>
          {showAudit && (
            <div style={{
              padding: '8px 10px', background: 'var(--bg-surface)',
              border: '1px solid var(--border-dim)', borderTop: 'none',
              borderRadius: '0 0 6px 6px', marginBottom: spacing[3],
              maxHeight: 200, overflowY: 'auto',
            }}>
              {trail.map((entry, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 3, fontSize: 9, lineHeight: 1.5 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', minWidth: 55, flexShrink: 0 }}>
                    {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--agent-cyan)', fontWeight: 600, minWidth: 65, flexShrink: 0 }}>
                    {entry.agent}
                  </span>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {entry.detail || entry.action}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        style={{
          width: '100%', padding: 10, borderRadius: 8,
          border: `1px solid ${statusColor}`, background: 'var(--bg-surface)',
          color: statusColor, fontFamily: 'var(--font-display)',
          fontWeight: 700, fontSize: 11, cursor: 'pointer',
        }}
      >
        Close Review
      </button>
    </div>
  );
}
