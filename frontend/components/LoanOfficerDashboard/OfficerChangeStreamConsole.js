"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { spacing } from '@leafygreen-ui/tokens';
import { apiSSE } from '../../lib/api';

const OP_COLORS = {
  INSERT: { color: 'var(--mongo)', bg: 'var(--mongo-dim)' },
  UPDATE: { color: 'var(--tool-blue)', bg: 'var(--tool-blue-dim)' },
  REPLACE: { color: 'var(--voyage)', bg: 'var(--voyage-dim)' },
  DELETE: { color: 'var(--danger)', bg: 'var(--danger-dim)' },
};

const COLLECTION_FILTERS = ['All', 'applications', 'documents', 'agent_activity', 'interventions'];

function synthesizeFromActivityEvent(evt) {
  const ts = evt._ts ? new Date(evt._ts).toISOString() : new Date().toISOString();
  const base = { id: `cs-${evt.id || `${Date.now()}-${Math.random()}`}`, timestamp: ts };

  if (evt.kind === 'activity' || !evt.kind) {
    return { ...base, operation: 'INSERT', collection: 'agent_activity',
      summary: `${evt.agent || 'agent'} / ${evt.action || 'step'}`,
      detail: evt.reasoning || evt.detail || '' };
  }
  if (evt.kind === 'node_start') {
    return { ...base, operation: 'UPDATE', collection: 'applications',
      summary: `node_start: ${evt.agent || 'node'}`, detail: '' };
  }
  if (evt.kind === 'node_complete') {
    const fields = evt.output ? Object.keys(evt.output).slice(0, 4).join(', ') : '';
    return { ...base, operation: 'UPDATE', collection: 'applications',
      summary: `node_complete: ${evt.agent || 'node'}`,
      detail: fields ? `fields: ${fields}` : '' };
  }
  if (evt.kind === 'hitl') {
    return { ...base, operation: 'INSERT', collection: 'interventions',
      summary: 'HITL gate — awaiting officer decision',
      detail: 'status: "pending"' };
  }
  if (evt.kind === 'complete') {
    return { ...base, operation: 'UPDATE', collection: 'applications',
      summary: 'Pipeline complete', detail: '' };
  }
  return null;
}

function synthesizeStatusEvent(sseEvent) {
  const ts = sseEvent.timestamp || new Date().toISOString();
  const base = { id: `cs-status-${Date.now()}-${Math.random()}`, timestamp: ts };
  if (sseEvent.type === 'status' && sseEvent.status) {
    return { ...base, operation: 'UPDATE', collection: 'applications',
      summary: `status: "${sseEvent.status}"`, detail: 'updatedFields.status' };
  }
  return null;
}

function formatTs(ts) {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
      + '.' + String(d.getMilliseconds()).padStart(3, '0');
  } catch { return '\u2014'; }
}

const MAX_DISPLAY = 60;

/**
 * Change Stream Console — renders change events derived from the hoisted
 * activity stream (no separate SSE to /agent/{id}/stream). Also opens a thin
 * SSE to /applications/{id}/status so status transitions show up here even
 * if they're driven by HITL / queue actions rather than the pipeline.
 */
export default function OfficerChangeStreamConsole({
  applicationId,
  lastCorrelatedEvent,
  activityEvents = [],
  streamConnected = false,
}) {
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState('All');
  const [statusEvents, setStatusEvents] = useState([]);
  const [clearedBefore, setClearedBefore] = useState(0);
  const [frozenAt, setFrozenAt] = useState(null);
  const eventTimesRef = useRef([]);
  const lastAppIdRef = useRef(null);

  // Reset on app change
  useEffect(() => {
    if (lastAppIdRef.current !== applicationId) {
      lastAppIdRef.current = applicationId;
      setStatusEvents([]);
      setClearedBefore(0);
      setFrozenAt(null);
      eventTimesRef.current = [];
    }
  }, [applicationId]);

  // Status SSE — light, emits a single UPDATE row per status change
  useEffect(() => {
    if (!applicationId) return;
    const handle = apiSSE(
      `/applications/${applicationId}/status`,
      (sseEvent) => {
        const synth = synthesizeStatusEvent(sseEvent);
        if (synth) {
          eventTimesRef.current.push(Date.now());
          setStatusEvents((prev) => [synth, ...prev].slice(0, 50));
        }
      },
      { autoCloseOn: ['error'] },
    );
    return () => handle?.close();
  }, [applicationId]);

  // Merge activity-derived events + status events
  const allEvents = useMemo(() => {
    const activityDerived = [];
    for (const evt of activityEvents) {
      const synth = synthesizeFromActivityEvent(evt);
      if (synth) activityDerived.push(synth);
    }
    const merged = [...activityDerived, ...statusEvents];
    merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return merged.filter((e) => new Date(e.timestamp).getTime() > clearedBefore);
  }, [activityEvents, statusEvents, clearedBefore]);

  // Ops/sec rolling 5-second window
  const [opsPerSec, setOpsPerSec] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      eventTimesRef.current = eventTimesRef.current.filter((t) => now - t < 5000);
      setOpsPerSec(eventTimesRef.current.length / 5);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Track activity event arrivals in ops/sec
  const activityCountRef = useRef(0);
  useEffect(() => {
    const next = activityEvents.length;
    const delta = next - activityCountRef.current;
    const now = Date.now();
    for (let i = 0; i < delta; i++) eventTimesRef.current.push(now);
    activityCountRef.current = next;
  }, [activityEvents.length]);

  const displayed = useMemo(() => {
    const base = paused && frozenAt != null
      ? allEvents.filter((e) => new Date(e.timestamp).getTime() <= frozenAt)
      : allEvents;
    const capped = base.slice(0, MAX_DISPLAY);
    if (filter === 'All') return capped;
    return capped.filter((e) => e.collection === filter);
  }, [allEvents, paused, frozenAt, filter]);

  const bufferCount = paused && frozenAt != null
    ? allEvents.filter((e) => new Date(e.timestamp).getTime() > frozenAt).length
    : 0;

  const collectionCounts = useMemo(() => {
    const counts = {};
    for (const e of displayed) counts[e.collection] = (counts[e.collection] || 0) + 1;
    return counts;
  }, [displayed]);

  const correlatedTs = lastCorrelatedEvent?._correlationTs || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        padding: `${spacing[2]}px ${spacing[2]}px`,
        borderBottom: '1px solid var(--border-dim)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11, color: 'var(--text-primary)' }}>
            Change Stream Console
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-dim)' }}>
            MongoDB Change Streams
          </span>
          <div style={{ flex: 1 }} />
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
            color: opsPerSec > 2 ? 'var(--mongo)' : 'var(--text-dim)',
            transition: 'color 300ms ease',
          }}>
            {opsPerSec.toFixed(1)} ops/s
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 8, fontWeight: 700,
            color: streamConnected ? 'var(--mongo-bright)' : 'var(--text-dim)' }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: streamConnected ? 'var(--mongo-bright)' : 'var(--text-dim)',
              animation: streamConnected ? 'pulse 1.5s infinite' : 'none',
            }} />
            {streamConnected ? 'LIVE' : 'OFF'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          {Object.entries(collectionCounts).map(([col, count]) => (
            <span key={col} style={{
              fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 600,
              padding: '1px 5px', borderRadius: 3,
              background: 'var(--bg-raised)', color: 'var(--text-dim)',
            }}>
              {col}: {count}
            </span>
          ))}
          <div style={{ flex: 1 }} />
          <button type="button"
            onClick={() => {
              if (paused) { setPaused(false); setFrozenAt(null); }
              else { setPaused(true); setFrozenAt(Date.now()); }
            }}
            style={{
              padding: '1px 6px', borderRadius: 4, border: 'none', fontSize: 9, fontWeight: 600, cursor: 'pointer',
              background: paused ? 'var(--hitl-amber-dim)' : 'transparent',
              color: paused ? 'var(--hitl-amber)' : 'var(--text-dim)',
              fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: 3,
            }}>
            {paused ? '\u25B6' : '\u23F8'}
            {paused && bufferCount > 0 && (
              <span style={{ background: 'var(--hitl-amber)', color: '#fff', fontSize: 7, fontWeight: 700, padding: '0 3px', borderRadius: 4 }}>{bufferCount}</span>
            )}
          </button>
          <button type="button" onClick={() => setClearedBefore(Date.now())} style={{
            padding: '1px 6px', borderRadius: 4, border: 'none', fontSize: 9, fontWeight: 600,
            cursor: 'pointer', background: 'transparent', color: 'var(--text-dim)', fontFamily: 'var(--font-display)',
          }}>Clear</button>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{
            padding: '1px 4px', borderRadius: 3, fontSize: 8, fontFamily: 'var(--font-mono)',
            color: 'var(--text-secondary)', background: 'var(--bg-surface)', border: '1px solid var(--border-dim)', cursor: 'pointer',
          }}>
            {COLLECTION_FILTERS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: `0 ${spacing[2]}px` }}>
        {displayed.length === 0 && (
          <div style={{ padding: spacing[4], textAlign: 'center', color: 'var(--text-dim)', fontSize: 10 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, opacity: 0.2, marginBottom: 4 }}>{'{ }'}</div>
            {applicationId
              ? (streamConnected ? 'Waiting for change stream events...' : 'Connecting to change stream...')
              : 'Select an application to view change events'}
          </div>
        )}
        {displayed.map((evt) => {
          const style = OP_COLORS[evt.operation] || OP_COLORS.UPDATE;
          const isCorrelated = correlatedTs && Math.abs(new Date(evt.timestamp).getTime() - correlatedTs) < 500;
          return (
            <div key={evt.id} style={{
              padding: '3px 0', borderBottom: '1px solid var(--border-dim)',
              borderLeft: isCorrelated ? '2px solid var(--agent-cyan)' : '2px solid transparent',
              paddingLeft: 4,
              animation: 'eventSlideIn 220ms cubic-bezier(0.33, 1, 0.68, 1) both',
              transition: 'border-left-color 1.5s ease-out',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-dim)', minWidth: 70, flexShrink: 0 }}>
                  {formatTs(evt.timestamp)}
                </span>
                <span style={{
                  fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                  borderRadius: 3, padding: '0px 4px', color: style.color, background: style.bg, fontFamily: 'var(--font-mono)', flexShrink: 0,
                }}>
                  {evt.operation}
                </span>
                <span style={{
                  fontSize: 8, fontWeight: 600, borderRadius: 3, padding: '0px 4px',
                  color: 'var(--text-secondary)', background: 'var(--bg-raised)', fontFamily: 'var(--font-mono)', flexShrink: 0,
                }}>
                  {evt.collection}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {evt.summary}
                </span>
              </div>
              {evt.detail && (
                <div style={{
                  paddingLeft: 74, fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: 1,
                  wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap', maxWidth: '100%',
                }}>
                  {evt.detail}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
