"use client";

import { useState, useEffect } from 'react';
import { spacing } from '@leafygreen-ui/tokens';
import Badge from '@leafygreen-ui/badge';
import { apiGet } from '../../lib/api';
import { formatCurrency, getRiskColor, formatDuration } from './utils';

const POST_APPROVAL_STAGES = [
  { label: 'Closing in progress', icon: '📑', statuses: ['closing'] },
  { label: 'Documents signed', icon: '✍️', statuses: ['funded', 'active'] },
  { label: 'Funded', icon: '💰', statuses: ['funded', 'active'] },
];

// Map the current application status to a stage index.
// `approved` is pre-closing (stage 0 shown but not yet active),
// `closing` → stage 0, `funded`/`active` → final stage.
function stageFromStatus(status) {
  if (!status) return -1;
  if (status === 'closing') return 0;
  if (status === 'funded' || status === 'active') return POST_APPROVAL_STAGES.length - 1;
  return -1;
}

function PostApprovalProgression({ active, status }) {
  const stage = stageFromStatus(status);

  // Only show once backend has actually advanced to a post-approval status.
  // Hides for plain "approved" (no fake progress) — fires on closing/funded/active.
  if (!active || stage < 0) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: `${spacing[2]}px 0`, marginBottom: spacing[3] }}>
      {POST_APPROVAL_STAGES.map((s, i) => (
        <div key={s.label} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
          <div style={{
            padding: '4px 8px', borderRadius: 4, flex: 1,
            background: i <= stage ? 'var(--bg-raised)' : 'transparent',
            border: `1px solid ${i <= stage ? 'var(--mongo)' : 'var(--border-dim)'}`,
            opacity: i <= stage ? 1 : 0.4,
            transition: 'all 400ms ease',
          }}>
            <div style={{ fontSize: 9, fontWeight: 600, color: i <= stage ? 'var(--mongo)' : 'var(--text-dim)' }}>
              {s.icon} {s.label}
            </div>
          </div>
          {i < POST_APPROVAL_STAGES.length - 1 && (
            <div style={{ width: 12, height: 1, background: i < stage ? 'var(--mongo)' : 'var(--border-dim)', flexShrink: 0, transition: 'background 400ms ease' }} />
          )}
        </div>
      ))}
    </div>
  );
}

const AGENT_TIMELINE_COLORS = {
  supervisor: { color: 'var(--mongo)', bg: 'var(--mongo-dim)' },
  loan_app_agent: { color: 'var(--agent-cyan)', bg: 'var(--agent-cyan-dim)' },
  loan_app: { color: 'var(--agent-cyan)', bg: 'var(--agent-cyan-dim)' },
  underwriter: { color: 'var(--hitl-amber)', bg: 'var(--hitl-amber-dim)' },
  hitl_gate: { color: 'var(--hitl-amber)', bg: 'var(--hitl-amber-dim)' },
};

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

  const maxDuration = Math.max(...stages.map((s) => {
    const start = s.startTime ? new Date(s.startTime) : null;
    const end = s.endTime ? new Date(s.endTime) : null;
    return start && end ? end - start : 0;
  }), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: spacing[3] }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
        Processing Timeline
      </div>
      {stages.map((stage, i) => {
        const start = stage.startTime ? new Date(stage.startTime) : null;
        const end = stage.endTime ? new Date(stage.endTime) : null;
        const durationMs = start && end ? end - start : 0;
        const durationLabel = formatDuration(durationMs > 0 ? durationMs : null);
        const pct = Math.max(8, (durationMs / maxDuration) * 100);
        const colors = AGENT_TIMELINE_COLORS[stage.agent] || { color: 'var(--text-dim)', bg: 'var(--bg-raised)' };

        return (
          <div key={i} style={{
            padding: '6px 10px', borderRadius: 6,
            background: colors.bg,
            borderLeft: `3px solid ${colors.color}`,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{
              fontSize: 10, fontWeight: 700, color: colors.color,
              fontFamily: 'var(--font-mono)', minWidth: 90,
            }}>
              {stage.agent}
            </span>
            <div style={{ flex: 1, height: 4, background: 'var(--border-dim)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                width: `${pct}%`, height: '100%', borderRadius: 2,
                background: colors.color, transition: 'width 400ms ease',
              }} />
            </div>
            <span style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', minWidth: 85, textAlign: 'right' }}>
              {stage.actions.length} actions · {durationLabel}
            </span>
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

function ProvenanceChain({ trail, approvalDetails, isDeclined }) {
  const recommendation = (trail || []).find((a) =>
    a.action?.includes('decision') || a.action?.includes('complete') || a.detail?.includes('recommend')
  );

  const isModified = approvalDetails?.mode === 'modified';
  const isHITL = approvalDetails?.mode === 'recommended' || isModified;

  const nodes = [
    {
      label: recommendation?.agent || 'Agent',
      detail: recommendation?.detail?.slice(0, 80) || 'Processed application',
      timestamp: recommendation?.timestamp,
      color: 'var(--agent-cyan)',
      bg: 'var(--agent-cyan-dim)',
    },
  ];

  if (isHITL || approvalDetails?.mode === 'manual') {
    nodes.push({
      label: 'Officer',
      detail: isModified ? 'Modified terms' : 'Approved as recommended',
      color: 'var(--hitl-amber)',
      bg: 'var(--hitl-amber-dim)',
    });
  }

  nodes.push({
    label: isDeclined ? 'Declined' : 'Approved',
    detail: approvalDetails?.rate ? `@ ${approvalDetails.rate}` : '',
    color: isDeclined ? 'var(--danger)' : 'var(--success)',
    bg: isDeclined ? 'var(--danger-dim)' : 'var(--success-dim)',
  });

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 0,
      padding: `${spacing[2]}px 0`, marginBottom: spacing[3],
    }}>
      {nodes.map((node, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
          <div style={{
            padding: '6px 10px', borderRadius: 6,
            background: node.bg, border: `1px solid ${node.color}`,
            flex: 1, minWidth: 0,
          }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: node.color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {node.label}
            </div>
            {node.detail && (
              <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.3 }}>
                {node.detail}
              </div>
            )}
            {node.timestamp && (
              <div style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginTop: 1 }}>
                {new Date(node.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
            )}
          </div>
          {i < nodes.length - 1 && (
            <div style={{
              width: 20, height: 1, background: 'var(--border-base)', flexShrink: 0,
              position: 'relative',
            }}>
              <div style={{
                position: 'absolute', right: -3, top: -3,
                fontSize: 8, color: 'var(--text-dim)',
              }}>{'\u25B6'}</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function DecisionSummary({ applicationId, appDetail, approvalDetails, appName, officer, onClose }) {
  const [trail, setTrail] = useState(null);
  const [showAudit, setShowAudit] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const totalTime = trail && trail.length >= 2 && trail[0].timestamp && trail[trail.length - 1].timestamp
    ? (() => {
        const first = new Date(trail[0].timestamp);
        const last = new Date(trail[trail.length - 1].timestamp);
        const ms = last - first;
        if (!Number.isFinite(ms) || ms < 0) return null;
        return formatDuration(ms);
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
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--text-md)', color: statusColor }}>
              {isDeclined ? 'APPLICATION DECLINED' : 'LOAN APPROVED'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
              {appName} · {appDetail?.product || ''}
              {approvalDetails?.rate && ` @ ${approvalDetails.rate}`}
              {!isAuto && officer?.full_name && ` · Reviewed by ${officer.full_name}`}
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

      {/* Decision Provenance Chain */}
      <ProvenanceChain trail={trail} approvalDetails={approvalDetails} isDeclined={isDeclined} />

      {/* Post-approval micro-progression — only renders on real closing/funded status */}
      {!isDeclined && <PostApprovalProgression active={!isDeclined} status={appDetail?.status} />}

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

      {/* Before/After comparison for modified decisions */}
      {approvalDetails?.mode === 'modified' && trail && (
        <div style={{
          padding: spacing[2], background: 'var(--bg-surface)',
          borderRadius: 6, border: '1px solid var(--border-dim)',
          marginBottom: spacing[3],
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
            Decision Comparison
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[2] }}>
            <div style={{ padding: '6px 8px', borderRadius: 4, background: 'var(--agent-cyan-dim)' }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--agent-cyan)', textTransform: 'uppercase', marginBottom: 4 }}>Agent Proposed</div>
              {(() => {
                const rec = trail.find((a) => a.action?.includes('decision') || a.detail?.includes('recommend'));
                const rateMatch = rec?.detail?.match(/([\d.]+)%/);
                return (
                  <>
                    {rateMatch && <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Rate: <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{rateMatch[1]}%</span></div>}
                    {appDetail?.loan_amount && <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Amount: <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{formatCurrency(appDetail.loan_amount)}</span></div>}
                  </>
                );
              })()}
            </div>
            <div style={{
              padding: '6px 8px', borderRadius: 4,
              background: 'var(--hitl-amber-dim)',
            }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--hitl-amber)', textTransform: 'uppercase', marginBottom: 4 }}>Officer Decided</div>
              {approvalDetails.rate && (
                <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Rate: <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--hitl-amber)' }}>{approvalDetails.rate}</span></div>
              )}
              {approvalDetails.loanAmount && (
                <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Amount: <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--hitl-amber)' }}>{formatCurrency(approvalDetails.loanAmount)}</span></div>
              )}
              {approvalDetails.conditions && (
                <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Condition: {approvalDetails.conditions}</div>
              )}
            </div>
          </div>
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
          {showAudit && (() => {
            const groups = [];
            let currentGroup = null;
            trail.forEach((entry) => {
              const agent = entry.agent || 'system';
              if (agent !== currentGroup?.agent) {
                currentGroup = { agent, entries: [entry] };
                groups.push(currentGroup);
              } else {
                currentGroup.entries.push(entry);
              }
            });
            const agentColors = AGENT_TIMELINE_COLORS;
            return (
              <div style={{
                padding: '10px 12px', background: 'var(--bg-surface)',
                border: '1px solid var(--border-dim)', borderTop: 'none',
                borderRadius: '0 0 6px 6px', marginBottom: spacing[2],
                maxHeight: '70vh', overflowY: 'auto',
              }}>
                {groups.map((group, gi) => {
                  const colors = agentColors[group.agent] || { color: 'var(--text-dim)', bg: 'var(--bg-raised)' };
                  return (
                    <div key={gi} style={{ marginBottom: gi < groups.length - 1 ? 6 : 0 }}>
                      <div style={{
                        fontSize: 8, fontWeight: 700, fontFamily: 'var(--font-mono)',
                        color: colors.color, textTransform: 'uppercase', letterSpacing: '0.5px',
                        padding: '3px 0', borderBottom: `1px solid ${colors.color}20`,
                        marginBottom: 2,
                      }}>
                        {group.agent} ({group.entries.length})
                      </div>
                      {group.entries.map((entry, i) => {
                        const text = entry.detail || entry.action || '';
                        const lines = String(text).split('\n');
                        return (
                          <div key={i} style={{
                            display: 'flex', gap: 8, padding: '6px 0 6px 10px',
                            fontSize: 10, lineHeight: 1.55,
                            borderLeft: `2px solid ${colors.color}30`,
                            background: i % 2 === 0 ? 'transparent' : 'var(--bg-raised)',
                            alignItems: 'flex-start',
                          }}>
                            <span style={{
                              width: 5, height: 5, borderRadius: '50%',
                              background: colors.color, flexShrink: 0, marginTop: 7,
                              opacity: 0.6,
                            }} />
                            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', minWidth: 60, flexShrink: 0, fontSize: 9, marginTop: 1 }}>
                              {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}
                            </span>
                            <div style={{
                              color: 'var(--text-secondary)', flex: 1, minWidth: 0,
                              wordBreak: 'break-word', overflowWrap: 'anywhere',
                            }}>
                              {lines.map((line, li) => {
                                if (line.length === 0) {
                                  return <div key={li} style={{ height: 6 }} />;
                                }
                                const isHeader = line.startsWith('# ') || line.startsWith('## ');
                                // Single-span bold: entire line wrapped in ** with no inner occurrences.
                                const isWholeBold = line.startsWith('**') && line.endsWith('**') &&
                                  line.length >= 4 && line.slice(2, -2).indexOf('**') === -1;
                                // Render **bold** segments inline while preserving the rest.
                                const renderInline = (text) => {
                                  const parts = [];
                                  const re = /\*\*([^*]+)\*\*/g;
                                  let last = 0; let m; let idx = 0;
                                  while ((m = re.exec(text)) !== null) {
                                    if (m.index > last) parts.push(text.slice(last, m.index));
                                    parts.push(<strong key={idx++}>{m[1]}</strong>);
                                    last = m.index + m[0].length;
                                  }
                                  if (last < text.length) parts.push(text.slice(last));
                                  return parts.length ? parts : text;
                                };
                                return (
                                  <div key={li} style={{
                                    marginBottom: 2,
                                    fontWeight: (isHeader || isWholeBold) ? 700 : 400,
                                    fontSize: isHeader ? 11 : 10,
                                    color: isHeader ? 'var(--text-primary)' : 'var(--text-secondary)',
                                    whiteSpace: 'pre-wrap',
                                  }}>
                                    {isHeader
                                      ? line.replace(/^#+\s*/, '')
                                      : isWholeBold
                                        ? line.slice(2, -2)
                                        : renderInline(line)}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Copy Audit Trail */}
          <button
            type="button"
            onClick={() => {
              const payload = {
                applicationId,
                appName,
                decision: isDeclined ? 'declined' : 'approved',
                mode: approvalDetails?.mode || 'unknown',
                approvalDetails,
                trail,
              };
              navigator.clipboard.writeText(JSON.stringify(payload, null, 2)).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              });
            }}
            style={{
              width: '100%', padding: '6px 10px', marginBottom: spacing[3],
              background: copied ? 'var(--success-dim)' : 'var(--bg-surface)',
              border: `1px solid ${copied ? 'var(--success)' : 'var(--border-dim)'}`,
              borderRadius: 6, cursor: 'pointer',
              fontSize: 10, fontWeight: 600,
              color: copied ? 'var(--success)' : 'var(--text-secondary)',
              fontFamily: 'var(--font-display)',
              transition: 'all 200ms ease',
            }}
          >
            {copied ? '\u2713 Copied to Clipboard' : '\u2398 Copy Audit Trail'}
          </button>
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
