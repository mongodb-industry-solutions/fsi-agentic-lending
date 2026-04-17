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

function OpBadge({ op }) {
  const style = OP_COLORS[op] || OP_COLORS.UPDATE;
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
      borderRadius: 4, padding: '1px 6px',
      color: style.color, background: style.bg,
      fontFamily: 'var(--font-mono)', flexShrink: 0,
    }}>
      {op}
    </span>
  );
}

function CollectionBadge({ name }) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 600, borderRadius: 4, padding: '1px 6px',
      color: 'var(--text-secondary)', background: 'var(--bg-raised)',
      fontFamily: 'var(--font-mono)', flexShrink: 0,
    }}>
      {name}
    </span>
  );
}

function synthesizeEvent(sseEvent) {
  const ts = sseEvent.timestamp || new Date().toISOString();
  if (sseEvent.type === 'status' || sseEvent.status) {
    return {
      id: `cs-${Date.now()}-${Math.random()}`,
      timestamp: ts,
      operation: 'UPDATE',
      collection: 'applications',
      summary: `status: "${sseEvent.status}"`,
      detail: 'updateDescription.updatedFields.status',
    };
  }
  if (sseEvent.type === 'agent_step') {
    return {
      id: `cs-${Date.now()}-${Math.random()}`,
      timestamp: ts,
      operation: 'INSERT',
      collection: 'agent_activity',
      summary: `${sseEvent.agent || 'agent'} / ${sseEvent.action || 'step'}`,
      detail: sseEvent.detail || '',
    };
  }
  if (sseEvent.type === 'node_start') {
    return {
      id: `cs-${Date.now()}-${Math.random()}`,
      timestamp: ts,
      operation: 'UPDATE',
      collection: 'applications',
      summary: `node_start: ${sseEvent.agent || sseEvent.name || 'node'}`,
      detail: 'Pipeline node execution began',
    };
  }
  if (sseEvent.type === 'node_complete') {
    const fields = sseEvent.output ? Object.keys(sseEvent.output).join(', ') : '';
    return {
      id: `cs-${Date.now()}-${Math.random()}`,
      timestamp: ts,
      operation: 'UPDATE',
      collection: 'applications',
      summary: `node_complete: ${sseEvent.agent || 'node'}`,
      detail: fields ? `updatedFields: ${fields}` : '',
    };
  }
  if (sseEvent.type === 'hitl_waiting') {
    return {
      id: `cs-${Date.now()}-${Math.random()}`,
      timestamp: ts,
      operation: 'INSERT',
      collection: 'interventions',
      summary: 'HITL gate — awaiting officer decision',
      detail: 'type: "escalation_review", status: "pending"',
    };
  }
  if (sseEvent.type === 'complete') {
    return {
      id: `cs-${Date.now()}-${Math.random()}`,
      timestamp: ts,
      operation: 'UPDATE',
      collection: 'applications',
      summary: 'Pipeline complete',
      detail: 'status → approved | declined',
    };
  }
  return null;
}

function formatTimestamp(ts) {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
      + '.' + String(d.getMilliseconds()).padStart(3, '0');
  } catch { return '—'; }
}

export default function ChangeStreamConsole({ applicationId }) {
  const [events, setEvents] = useState([]);
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState('All');
  const [connected, setConnected] = useState(false);
  const pausedRef = useRef(false);
  const bufferRef = useRef([]);
  const [bufferCount, setBufferCount] = useState(0);

  pausedRef.current = paused;

  const addEvent = useCallback((evt) => {
    if (!evt) return;
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
    if (!applicationId) return;
    setEvents([]);
    setConnected(false);

    // Subscribe to the run-stream or activity stream
    const source = apiSSE(
      `/agent/${applicationId}/stream`,
      (sseEvent) => {
        if (sseEvent.type === 'connected') {
          setConnected(true);
          return;
        }
        if (!connected) setConnected(true);
        const evt = synthesizeEvent(sseEvent);
        addEvent(evt);
      },
      () => setConnected(false),
    );

    // Also subscribe to status SSE
    const statusSource = apiSSE(
      `/applications/${applicationId}/status`,
      (sseEvent) => {
        const evt = synthesizeEvent(sseEvent);
        addEvent(evt);
      },
    );

    return () => {
      source?.close();
      statusSource?.close();
    };
  }, [applicationId, addEvent]);

  const filtered = useMemo(() => {
    if (filter === 'All') return events;
    return events.filter((e) => e.collection === filter);
  }, [events, filter]);

  if (!applicationId) {
    return (
      <div style={{ padding: spacing[5], textAlign: 'center', color: 'var(--text-dim)', fontSize: 11 }}>
        Select an application to view change stream events.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: spacing[2],
        padding: `${spacing[2]}px ${spacing[3]}px`,
        borderBottom: '1px solid var(--border-dim)',
        flexShrink: 0,
      }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, color: 'var(--text-primary)' }}>
          Change Stream Console
        </span>

        <div style={{ flex: 1 }} />

        {/* Pause/Resume */}
        <button
          type="button"
          onClick={() => paused ? handleResume() : setPaused(true)}
          style={{
            padding: '2px 8px', borderRadius: 6, border: 'none',
            background: paused ? 'var(--hitl-amber-dim)' : 'transparent',
            color: paused ? 'var(--hitl-amber)' : 'var(--text-dim)',
            fontSize: 9, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'var(--font-display)',
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          {paused ? '\u25B6' : '\u23F8'}
          {paused && bufferCount > 0 && (
            <span style={{
              background: 'var(--hitl-amber)', color: '#fff',
              fontSize: 8, fontWeight: 700, padding: '0 4px',
              borderRadius: 6, minWidth: 14, textAlign: 'center',
            }}>
              {bufferCount}
            </span>
          )}
        </button>

        {/* Clear */}
        <button
          type="button"
          onClick={() => setEvents([])}
          style={{
            padding: '2px 8px', borderRadius: 6, border: 'none',
            background: 'transparent', color: 'var(--text-dim)',
            fontSize: 9, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-display)',
          }}
        >
          Clear
        </button>

        {/* Filter */}
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            padding: '2px 6px', borderRadius: 4, fontSize: 9,
            fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)',
            background: 'var(--bg-surface)', border: '1px solid var(--border-dim)',
            cursor: 'pointer',
          }}
        >
          {COLLECTION_FILTERS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>

        {/* Count + connection */}
        <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
          {events.length} events
        </span>
        <span style={{
          width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
          background: connected ? 'var(--mongo-bright)' : 'var(--text-dim)',
          boxShadow: connected ? '0 0 6px var(--mongo-bright)' : 'none',
          animation: connected ? 'pulse 1.5s infinite' : 'none',
        }} />
      </div>

      {/* Event list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: `${spacing[1]}px ${spacing[3]}px` }}>
        {filtered.length === 0 && (
          <div style={{
            padding: spacing[5], textAlign: 'center',
            color: 'var(--text-dim)', fontSize: 11,
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, opacity: 0.2, marginBottom: spacing[2] }}>
              {'{ }'}
            </div>
            Waiting for change stream events...
          </div>
        )}
        {filtered.map((evt) => (
          <div
            key={evt.id}
            style={{
              padding: '4px 0',
              borderBottom: '1px solid var(--border-dim)',
              animation: 'eventSlideIn 220ms cubic-bezier(0.33, 1, 0.68, 1) both',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)',
                minWidth: 80, flexShrink: 0,
              }}>
                {formatTimestamp(evt.timestamp)}
              </span>
              <OpBadge op={evt.operation} />
              <CollectionBadge name={evt.collection} />
              <span style={{
                fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1,
              }}>
                {evt.summary}
              </span>
            </div>
            {evt.detail && (
              <div style={{
                paddingLeft: 88, fontSize: 11, color: 'var(--text-dim)',
                fontFamily: 'var(--font-mono)', marginTop: 1,
                wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap', maxWidth: '100%',
              }}>
                {evt.detail}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
