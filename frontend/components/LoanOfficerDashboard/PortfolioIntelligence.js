"use client";

import { useState, useEffect, useMemo } from 'react';
import { spacing } from '@leafygreen-ui/tokens';
import { apiGet } from '../../lib/api';
import styles from './PortfolioIntelligence.module.css';

function getEwsColor(alert) {
  if (alert.status === 'red' || alert.severity === 'high' || alert.severity === 'critical') return 'danger';
  if (alert.status === 'amber' || alert.severity === 'medium') return 'amber';
  return 'green';
}

export function PortfolioIntelligence() {
  const [expanded, setExpanded] = useState(false);
  const [payments, setPayments] = useState(null);
  const [ews, setEws] = useState(null);
  const [events, setEvents] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!expanded || loaded) return;
    setLoaded(true);
    Promise.allSettled([
      apiGet('/portfolio/payments'),
      apiGet('/portfolio/ews'),
      apiGet('/portfolio/events'),
    ]).then(([p, e, ev]) => {
      if (p.value) setPayments(p.value);
      if (e.value) setEws(e.value);
      if (ev.value) setEvents(ev.value);
      if (!p.value && !e.value && !ev.value) setLoaded(false);
    });
  }, [expanded, loaded]);

  const ewsAlerts = Array.isArray(ews) ? ews : ews?.alerts || [];
  const eventList = Array.isArray(events) ? events : events?.events || [];
  const paymentData = Array.isArray(payments) ? payments : payments?.data || payments?.payments || [];

  // Compute SVG trend line points from payment data
  const trendLine = useMemo(() => {
    const slice = paymentData.slice(-12);
    if (slice.length < 2) return null;
    const values = slice.map(d => typeof d === 'number' ? d : d.amount || d.value || 0);
    const max = Math.max(...values, 1);
    const points = values.map((v, i) => {
      const x = (i / (values.length - 1)) * 100;
      const y = 100 - (v / max) * 100;
      return `${x},${y}`;
    }).join(' ');
    return points;
  }, [paymentData]);

  // EWS summary for collapsed preview
  const ewsSummary = useMemo(() => {
    if (ewsAlerts.length === 0) return null;
    const red = ewsAlerts.filter(a => a.status === 'red' || a.severity === 'high' || a.severity === 'critical').length;
    const amber = ewsAlerts.filter(a => a.status === 'amber' || a.severity === 'medium').length;
    return { total: ewsAlerts.length, red, amber };
  }, [ewsAlerts]);

  return (
    <div style={{
      borderTop: '1px solid var(--border-dim)',
      background: 'var(--bg-base)',
    }}>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%', padding: '8px 12px',
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          font: 'inherit',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, color: 'var(--tool-blue)',
              fontFamily: 'var(--font-display)',
            }}>
              Portfolio Intelligence
            </span>
            <span style={{
              fontSize: 7, fontFamily: 'var(--font-mono)', fontWeight: 700,
              padding: '1px 4px', borderRadius: 3,
              background: 'var(--tool-blue-dim)', color: 'var(--tool-blue)',
            }}>
              PAYMENTS
            </span>
          </div>
          {/* Collapsed preview */}
          {!expanded && loaded && ewsSummary && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
              <span style={{
                width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                background: ewsSummary.red > 0 ? 'var(--danger)' : ewsSummary.amber > 0 ? 'var(--hitl-amber)' : 'var(--success)',
              }} />
              {ewsSummary.red > 0
                ? `${ewsSummary.red} critical`
                : ewsSummary.amber > 0
                  ? `${ewsSummary.amber} warning${ewsSummary.amber > 1 ? 's' : ''}`
                  : 'All clear'}
              {ewsSummary.total > (ewsSummary.red + ewsSummary.amber) && ` | ${ewsSummary.total} total`}
            </div>
          )}
        </div>
        <span style={{
          fontSize: 10, color: 'var(--text-dim)',
          transform: expanded ? 'rotate(180deg)' : 'rotate(0)',
          transition: 'transform 150ms ease', display: 'inline-block',
        }}>{'\u25BE'}</span>
      </button>
      <div style={{
        maxHeight: expanded ? 600 : 0,
        overflow: expanded ? 'auto' : 'hidden',
        transition: 'max-height 220ms cubic-bezier(0.33, 1, 0.68, 1)',
      }}>
        <div style={{ padding: `0 12px ${spacing[3]}px`, display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
          {/* Payment Trends with SVG trend line */}
          {paymentData.length > 0 && (
            <div style={{
              padding: '8px 10px', background: 'var(--bg-surface)',
              borderRadius: 6, border: '1px solid var(--border-dim)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{
                  fontSize: 8, fontWeight: 700, color: 'var(--text-dim)',
                  textTransform: 'uppercase', letterSpacing: '0.5px',
                }}>
                  Payment Trends
                </div>
                <span style={{
                  fontSize: 6, fontFamily: 'var(--font-mono)', fontWeight: 700,
                  padding: '1px 4px', borderRadius: 2,
                  background: 'var(--tool-blue-dim)', color: 'var(--tool-blue)',
                }}>
                  $setWindowFields
                </span>
              </div>
              <div style={{ position: 'relative', height: 40 }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: '100%' }}>
                  {(() => {
                    const slice = paymentData.slice(-12);
                    const max = Math.max(...slice.map(x => typeof x === 'number' ? x : x.amount || x.value || 0), 1);
                    return slice.map((d, i) => {
                      const val = typeof d === 'number' ? d : d.amount || d.value || 0;
                      return (
                        <div key={i} style={{
                          flex: 1, borderRadius: 2,
                          height: `${Math.max(4, (val / max) * 100)}%`,
                          background: 'var(--mongo)',
                          opacity: 0.6 + (i / 12) * 0.4,
                          transition: 'height 300ms ease',
                        }} />
                      );
                    });
                  })()}
                </div>
                {/* SVG trend line overlay */}
                {trendLine && (
                  <svg
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    style={{
                      position: 'absolute', top: 0, left: 0,
                      width: '100%', height: '100%',
                      pointerEvents: 'none',
                    }}
                  >
                    <polyline
                      points={trendLine}
                      fill="none"
                      stroke="var(--tool-blue)"
                      strokeWidth="2"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                )}
              </div>
              {/* Time axis labels */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                {paymentData.slice(-12).map((d, i) => (
                  <span key={i} style={{ fontSize: 6, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', flex: 1, textAlign: 'center' }}>
                    {d.month || d.label || `M${i + 1}`}
                  </span>
                ))}
              </div>
              {/* Technology annotation */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, marginTop: 4,
                fontSize: 7, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)',
              }}>
                <span>Bucketed by month</span>
                <span style={{ color: 'var(--border-base)' }}>{'\u00b7'}</span>
                <span>payments collection</span>
                <span style={{ color: 'var(--border-base)' }}>{'\u00b7'}</span>
                <span>12-month window</span>
              </div>
            </div>
          )}

          {/* EWS Alerts — severity-tiered */}
          {ewsAlerts.length > 0 && (
            <div style={{
              padding: '8px 10px', background: 'var(--bg-surface)',
              borderRadius: 6, border: '1px solid var(--border-dim)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{
                  fontSize: 8, fontWeight: 700, color: 'var(--text-dim)',
                  textTransform: 'uppercase', letterSpacing: '0.5px',
                }}>
                  Early Warning Signals
                </span>
                <span style={{
                  fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
                  padding: '1px 5px', borderRadius: 4,
                  background: 'var(--hitl-amber-dim)', color: 'var(--hitl-amber)',
                }}>
                  {ewsAlerts.length}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {ewsAlerts.slice(0, 4).map((alert, i) => {
                  const severity = getEwsColor(alert);
                  if (severity === 'danger') {
                    return (
                      <div key={i} style={{
                        padding: '6px 8px', borderRadius: 4,
                        background: 'var(--danger-dim)',
                        borderLeft: '3px solid var(--danger)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                          <span style={{ fontSize: 7, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--danger)' }}>CRITICAL</span>
                        </div>
                        <div style={{ fontSize: 9, color: 'var(--text-primary)', fontWeight: 600 }}>
                          {alert.signal || alert.message || alert.description || alert.type || JSON.stringify(alert).slice(0, 80)}
                        </div>
                        {alert.detail && <div style={{ fontSize: 8, color: 'var(--text-secondary)', marginTop: 2 }}>{alert.detail}</div>}
                      </div>
                    );
                  }
                  if (severity === 'amber') {
                    return (
                      <div key={i} style={{
                        padding: '4px 8px', borderRadius: 4,
                        borderLeft: '2px solid var(--hitl-amber)',
                        background: 'var(--bg-raised)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 7, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--hitl-amber)' }}>WARNING</span>
                        </div>
                        <div style={{ fontSize: 9, color: 'var(--text-secondary)' }}>
                          {alert.signal || alert.message || alert.description || alert.type || JSON.stringify(alert).slice(0, 80)}
                        </div>
                        {alert.detail && <div style={{ fontSize: 8, color: 'var(--text-dim)', marginTop: 1 }}>{alert.detail}</div>}
                      </div>
                    );
                  }
                  // Green — minimal
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '3px 0', fontSize: 9, color: 'var(--text-secondary)',
                    }}>
                      <span style={{
                        width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                        background: 'var(--success)',
                      }} />
                      <span>{alert.signal || alert.message || alert.description || alert.type || JSON.stringify(alert).slice(0, 80)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent Events — mini-timeline */}
          {eventList.length > 0 && (
            <div style={{
              padding: '8px 10px', background: 'var(--bg-surface)',
              borderRadius: 6, border: '1px solid var(--border-dim)',
            }}>
              <div style={{
                fontSize: 8, fontWeight: 700, color: 'var(--text-dim)',
                textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6,
              }}>
                Recent Events
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {eventList.slice(0, 5).map((ev, i) => (
                  <div key={i} className={i < eventList.slice(0, 5).length - 1 ? styles.timelineEvent : styles.timelineEventLast} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                    paddingLeft: 14, paddingBottom: 6, paddingTop: i === 0 ? 0 : 2,
                    position: 'relative',
                  }}>
                    {/* Timeline dot */}
                    <span style={{
                      position: 'absolute', left: 1, top: i === 0 ? 2 : 4,
                      width: 6, height: 6, borderRadius: '50%',
                      background: 'var(--tool-blue)', border: '1px solid var(--bg-surface)',
                      flexShrink: 0, zIndex: 1,
                    }} />
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 7,
                      color: 'var(--text-dim)', flexShrink: 0, minWidth: 42,
                    }}>
                      {ev.timestamp ? new Date(ev.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                    </span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 9, lineHeight: 1.3 }}>
                      {ev.message || ev.description || ev.event || ev.type || JSON.stringify(ev).slice(0, 80)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!payments && !ews && !events && (
            <div style={{ fontSize: 9, color: 'var(--text-dim)', padding: 4 }}>
              Loading portfolio data...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
