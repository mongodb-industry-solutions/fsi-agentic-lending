"use client";

import { useState, useEffect } from 'react';
import { spacing } from '@leafygreen-ui/tokens';
import { apiGet } from '../../lib/api';

export function PortfolioIntelligence() {
  const [expanded, setExpanded] = useState(false);
  const [payments, setPayments] = useState(null);
  const [ews, setEws] = useState(null);
  const [events, setEvents] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!expanded || loaded) return;
    setLoaded(true);
    Promise.all([
      apiGet('/portfolio/payments'),
      apiGet('/portfolio/ews'),
      apiGet('/portfolio/events'),
    ]).then(([p, e, ev]) => {
      if (p) setPayments(p);
      if (e) setEws(e);
      if (ev) setEvents(ev);
    }).catch(() => {
      setLoaded(false);
    });
  }, [expanded, loaded]);

  const ewsAlerts = Array.isArray(ews) ? ews : ews?.alerts || [];
  const eventList = Array.isArray(events) ? events : events?.events || [];
  const paymentData = Array.isArray(payments) ? payments : payments?.data || payments?.payments || [];

  return (
    <div style={{
      borderTop: '1px solid var(--border-dim)',
      background: 'var(--bg-base)',
    }}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%', padding: '8px 12px',
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          font: 'inherit',
        }}
      >
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
            TIME-SERIES
          </span>
        </div>
        <span style={{
          fontSize: 10, color: 'var(--text-dim)',
          transform: expanded ? 'rotate(180deg)' : 'rotate(0)',
          transition: 'transform 150ms ease', display: 'inline-block',
        }}>{'\u25BE'}</span>
      </button>
      {expanded && (
        <div style={{ padding: `0 12px ${spacing[3]}px`, display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
          {/* Payment Trends Mini-Chart */}
          {paymentData.length > 0 && (
            <div style={{
              padding: '8px 10px', background: 'var(--bg-surface)',
              borderRadius: 6, border: '1px solid var(--border-dim)',
            }}>
              <div style={{
                fontSize: 8, fontWeight: 700, color: 'var(--text-dim)',
                textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6,
              }}>
                Payment Trends
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 40 }}>
                {paymentData.slice(-12).map((d, i) => {
                  const val = typeof d === 'number' ? d : d.amount || d.value || 0;
                  const max = Math.max(...paymentData.slice(-12).map(x => typeof x === 'number' ? x : x.amount || x.value || 0), 1);
                  return (
                    <div key={i} style={{
                      flex: 1, borderRadius: 2,
                      height: `${Math.max(4, (val / max) * 100)}%`,
                      background: 'var(--mongo)',
                      opacity: 0.6 + (i / 12) * 0.4,
                      transition: 'height 300ms ease',
                    }} />
                  );
                })}
              </div>
            </div>
          )}

          {/* EWS Alerts */}
          {ewsAlerts.length > 0 && (
            <div style={{
              padding: '8px 10px', background: 'var(--bg-surface)',
              borderRadius: 6, border: '1px solid var(--border-dim)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
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
              {ewsAlerts.slice(0, 3).map((alert, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '3px 0', fontSize: 9, color: 'var(--text-secondary)',
                }}>
                  <span style={{
                    width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                    background: (alert.severity === 'high' || alert.severity === 'critical')
                      ? 'var(--danger)' : 'var(--hitl-amber)',
                  }} />
                  {alert.message || alert.description || alert.type || JSON.stringify(alert).slice(0, 80)}
                </div>
              ))}
            </div>
          )}

          {/* Recent Events */}
          {eventList.length > 0 && (
            <div style={{
              padding: '8px 10px', background: 'var(--bg-surface)',
              borderRadius: 6, border: '1px solid var(--border-dim)',
            }}>
              <div style={{
                fontSize: 8, fontWeight: 700, color: 'var(--text-dim)',
                textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4,
              }}>
                Recent Events
              </div>
              {eventList.slice(0, 5).map((ev, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 6,
                  padding: '3px 0', fontSize: 9,
                }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 8,
                    color: 'var(--text-dim)', flexShrink: 0, minWidth: 50,
                  }}>
                    {ev.timestamp ? new Date(ev.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                  </span>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {ev.description || ev.event || ev.type || JSON.stringify(ev).slice(0, 80)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {!payments && !ews && !events && (
            <div style={{ fontSize: 9, color: 'var(--text-dim)', padding: 4 }}>
              Loading portfolio data...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
