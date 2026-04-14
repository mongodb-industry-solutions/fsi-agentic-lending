"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { spacing } from '@leafygreen-ui/tokens';
import { apiSSE } from '../../lib/api';

const OP_COLORS = {
  INSERT: { color: 'var(--mongo)', bg: 'var(--mongo-dim)' },
  UPDATE: { color: 'var(--tool-blue)', bg: 'var(--tool-blue-dim)' },
  REPLACE: { color: 'var(--voyage)', bg: 'var(--voyage-dim)' },
  DELETE: { color: 'var(--danger)', bg: 'var(--danger-dim)' },
};

const COLLECTION_FILTERS = ['All', 'applications', 'documents', 'agent_activity', 'interventions'];

function synthesizeEvent(sseEvent) {
  const ts = sseEvent.timestamp || new Date().toISOString();
  const base = { id: `cs-${Date.now()}-${Math.random()}`, timestamp: ts };

  if (sseEvent.type === 'status' || sseEvent.status) {
    return { ...base, operation: 'UPDATE', collection: 'applications', summary: `status: "${sseEvent.status}"`, detail: 'updatedFields.status' };
  }
  if (sseEvent.type === 'agent_step') {
    return { ...base, operation: 'INSERT', collection: 'agent_activity', summary: `${sseEvent.agent || 'agent'} / ${sseEvent.action || 'step'}`, detail: sseEvent.detail || '' };
  }
  if (sseEvent.type === 'node_start') {
    return { ...base, operation: 'UPDATE', collection: 'applications', summary: `node_start: ${sseEvent.agent || sseEvent.name || 'node'}`, detail: '' };
  }
  if (sseEvent.type === 'node_complete') {
    const fields = sseEvent.output ? Object.keys(sseEvent.output).slice(0, 4).join(', ') : '';
    return { ...base, operation: 'UPDATE', collection: 'applications', summary: `node_complete: ${sseEvent.agent || 'node'}`, detail: fields ? `fields: ${fields}` : '' };
  }
  if (sseEvent.type === 'hitl_waiting') {
    return { ...base, operation: 'INSERT', collection: 'interventions', summary: 'HITL gate — awaiting officer decision', detail: 'status: "pending"' };
  }
  if (sseEvent.type === 'complete') {
    return { ...base, operation: 'UPDATE', collection: 'applications', summary: 'Pipeline complete', detail: '' };
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

export default function OfficerChangeStreamConsole({ applicationId, lastCorrelatedEvent }) {
  const [events, setEvents] = useState([]);
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState('All');
  const [connected, setConnected] = useState(false);
  const pausedRef = useRef(false);
  const bufferRef = useRef([]);
  const [bufferCount, setBufferCount] = useState(0);
  const eventTimesRef = useRef([]);

  pausedRef.current = paused;

  // Ops/sec counter
  const [opsPerSec, setOpsPerSec] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      eventTimesRef.current = eventTimesRef.current.filter((t) => now - t < 5000);
      setOpsPerSec(eventTimesRef.current.length / 5);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const addEvent = useCallback((evt) => {
    if (!evt) return;
    eventTimesRef.current.push(Date.now());
    if (pausedRef.current) {
      bufferRef.current = [evt, ...bufferRef.current].slice(0, 50);
      setBufferCount(bufferRef.current.length);
    } else {
      setEvents((prev) => [evt, ...prev].slice(0, 50));
    }
  }, []);

  const handleResume = useCallback(() => {
    setPaused(false);
    const buffered = bufferRef.current;
    bufferRef.current = [];
    setBufferCount(0);
    setEvents((prev) => [...buffered, ...prev].slice(0, 50));
  }, []);

  useEffect(() => {
    if (!applicationId) { setEvents([]); setConnected(false); return; }
    setEvents([]);
    setConnected(false);

    let gotFirstEvent = false;
    const markConnected = () => { if (!gotFirstEvent) { gotFirstEvent = true; setConnected(true); } };

    const source = apiSSE(
      `/agent/${applicationId}/stream`,
      (sseEvent) => {
        markConnected();
        if (sseEvent.type === 'connected') return;
        addEvent(synthesizeEvent(sseEvent));
      },
      () => setConnected(false),
    );
    const statusSource = apiSSE(
      `/applications/${applicationId}/status`,
      (sseEvent) => { markConnected(); addEvent(synthesizeEvent(sseEvent)); },
    );
    return () => { source?.close(); statusSource?.close(); };
  }, [applicationId, addEvent]);

  // Collection counts
  const collectionCounts = useMemo(() => {
    const counts = {};
    for (const e of events) {
      counts[e.collection] = (counts[e.collection] || 0) + 1;
    }
    return counts;
  }, [events]);

  const filtered = useMemo(() => {
    if (filter === 'All') return events;
    return events.filter((e) => e.collection === filter);
  }, [events, filter]);

  // Cross-rail correlation
  const correlatedTs = lastCorrelatedEvent?._correlationTs || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
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
          {/* Ops/sec */}
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
            color: opsPerSec > 2 ? 'var(--mongo)' : 'var(--text-dim)',
            transition: 'color 300ms ease',
          }}>
            {opsPerSec.toFixed(1)} ops/s
          </span>
          {/* Live indicator */}
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 8, fontWeight: 700, color: connected ? 'var(--mongo-bright)' : 'var(--text-dim)' }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: connected ? 'var(--mongo-bright)' : 'var(--text-dim)',
              animation: connected ? 'pulse 1.5s infinite' : 'none',
            }} />
            {connected ? 'LIVE' : 'OFF'}
          </span>
        </div>

        {/* Collection counts + controls */}
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
          <button type="button" onClick={() => paused ? handleResume() : setPaused(true)} style={{
            padding: '1px 6px', borderRadius: 4, border: 'none', fontSize: 9, fontWeight: 600, cursor: 'pointer',
            background: paused ? 'var(--hitl-amber-dim)' : 'transparent', color: paused ? 'var(--hitl-amber)' : 'var(--text-dim)',
            fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: 3,
          }}>
            {paused ? '\u25B6' : '\u23F8'}
            {paused && bufferCount > 0 && (
              <span style={{ background: 'var(--hitl-amber)', color: '#fff', fontSize: 7, fontWeight: 700, padding: '0 3px', borderRadius: 4 }}>{bufferCount}</span>
            )}
          </button>
          <button type="button" onClick={() => setEvents([])} style={{
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

      {/* Event list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: `0 ${spacing[2]}px` }}>
        {filtered.length === 0 && (
          <div style={{ padding: spacing[4], textAlign: 'center', color: 'var(--text-dim)', fontSize: 10 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, opacity: 0.2, marginBottom: 4 }}>{'{ }'}</div>
            Waiting for change stream events...
          </div>
        )}
        {filtered.map((evt) => {
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
                <div style={{ paddingLeft: 74, fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>
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
