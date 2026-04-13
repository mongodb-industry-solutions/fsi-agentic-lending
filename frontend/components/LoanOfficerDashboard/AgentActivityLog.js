"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { spacing } from '@leafygreen-ui/tokens';
import { apiSSE } from '../../lib/api';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'supervisor', label: 'Supervisor' },
  { id: 'loanapp', label: 'Loan App' },
  { id: 'underwriting', label: 'Underwriting' },
  { id: 'hitl', label: 'HITL' },
];

const MAX_ENTRIES = 100;

const ACTION_BADGE_MAP = {
  data: { actions: ['credit_pull', 'fetch_documents', 'credit_check', 'banking', 'plaid', 'equifax', 'document'], color: 'var(--voyage)', bg: 'var(--voyage-dim)', label: 'DATA' },
  compute: { actions: ['ratio_calc', 'stress_test', 'ltv_calc', 'risk_score', 'scoring', 'aggregate', 'calc', 'gds', 'tds'], color: 'var(--tool-blue)', bg: 'var(--tool-blue-dim)', label: 'COMPUTE' },
  search: { actions: ['policy_search', 'policy_match', 'vector_search', 'rag', 'search', 'lookup'], color: 'var(--mongo)', bg: 'var(--mongo-dim)', label: 'SEARCH' },
  decision: { actions: ['decision', 'route', 'routing', 'recommend', 'complete', 'approve', 'decline'], color: 'var(--hitl-amber)', bg: 'var(--hitl-amber-dim)', label: 'DECIDE' },
  alert: { actions: ['error', 'intervention', 'data_gap', 'escalat', 'interrupt', 'fail'], color: 'var(--danger)', bg: 'var(--danger-dim)', label: 'ALERT' },
};

function getActionBadge(action) {
  if (!action) return null;
  const lower = action.toLowerCase();
  for (const [, config] of Object.entries(ACTION_BADGE_MAP)) {
    if (config.actions.some((a) => lower.includes(a))) {
      return config;
    }
  }
  return null;
}

export default function AgentActivityLog({ onEvent, applicationId }) {
  const [entries, setEntries] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('compact');
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const bufferedEntriesRef = useRef([]);
  const [bufferCount, setBufferCount] = useState(0);
  const [totalReceived, setTotalReceived] = useState(0);

  pausedRef.current = paused;

  const flushBuffer = useCallback(() => {
    const buffered = bufferedEntriesRef.current;
    if (buffered.length === 0) return;
    bufferedEntriesRef.current = [];
    setBufferCount(0);
    setEntries((prev) => {
      const next = [...buffered, ...prev];
      return next.length > MAX_ENTRIES ? next.slice(0, MAX_ENTRIES) : next;
    });
  }, []);

  const handleResume = useCallback(() => {
    setPaused(false);
    flushBuffer();
  }, [flushBuffer]);

  useEffect(() => {
    if (!applicationId) {
      setEntries([]);
      setTotalReceived(0);
      setBufferCount(0);
      bufferedEntriesRef.current = [];
      return;
    }

    setEntries([]);
    setTotalReceived(0);
    setPaused(false);
    setBufferCount(0);
    bufferedEntriesRef.current = [];

    const source = apiSSE(
      `/agent/${applicationId}/stream`,
      (event) => {
        if (event.type === 'agent_step') {
          const liveEntry = {
            id: `live-${Date.now()}-${Math.random()}`,
            agent: event.agent || 'System',
            category: (event.agent || '').toLowerCase().includes('underwrit') ? 'underwriting'
              : (event.agent || '').toLowerCase().includes('supervisor') ? 'supervisor'
              : (event.agent || '').toLowerCase().includes('hitl') ? 'hitl'
              : 'loanapp',
            action: event.action || '',
            reasoning: event.detail || '',
            time: new Date(event.timestamp || Date.now()).toLocaleTimeString(),
            isLive: true,
          };

          setTotalReceived((prev) => prev + 1);

          if (pausedRef.current) {
            bufferedEntriesRef.current = [liveEntry, ...bufferedEntriesRef.current];
            setBufferCount((prev) => prev + 1);
          } else {
            setEntries((prev) => {
              const next = [liveEntry, ...prev];
              return next.length > MAX_ENTRIES ? next.slice(0, MAX_ENTRIES) : next;
            });
          }
          if (onEvent) onEvent(liveEntry);
        }
        if (event.type === 'complete') {
          // Pipeline complete
        }
      }
    );

    return () => source?.close();
  }, [applicationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    let result = entries;
    if (activeFilter !== 'all') {
      result = result.filter((e) => e.category === activeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) => e.action.toLowerCase().includes(q) || e.agent.toLowerCase().includes(q) || (e.reasoning || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [entries, activeFilter, searchQuery]);

  if (!applicationId) {
    return (
      <div style={{
        flex: '1 1 0',
        minHeight: 0,
        borderLeft: '1px solid var(--border-dim)',
        background: 'var(--bg-base)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border-dim)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13 }}>
            Agent Activity Log
          </div>
        </div>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: spacing[5],
        }}>
          <div style={{
            textAlign: 'center', padding: spacing[4],
            border: '2px dashed var(--border-dim)', borderRadius: 8,
            background: '#FAFBFA',
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', opacity: 0.5, marginBottom: spacing[2] }}>
              SSE
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              Select an application to view agent activity
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      flex: '1 1 0',
      minHeight: 0,
      borderLeft: '1px solid var(--border-dim)',
      background: 'var(--bg-base)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border-dim)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13 }}>
            Agent Activity Log
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Pause/Resume */}
            <button
              type="button"
              onClick={() => paused ? handleResume() : setPaused(true)}
              style={{
                padding: '2px 8px', borderRadius: 8, border: 'none',
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

            {/* Live indicator */}
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 600, color: paused ? 'var(--hitl-amber)' : 'var(--success)' }}>
              <span style={{
                width: 5, height: 5, borderRadius: '50%',
                background: paused ? 'var(--hitl-amber)' : 'var(--success)',
                boxShadow: paused ? 'none' : '0 0 6px var(--success)',
                animation: paused ? 'none' : 'pulse 1.5s infinite',
              }} />
              {paused ? 'Paused' : 'Live'}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2, marginBottom: spacing[2] }}>
          <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
            {entries.length}{totalReceived > entries.length ? ` / ${totalReceived}` : ''} actions {'\u00b7'} {filtered.length} shown
          </span>

          {/* View mode toggle */}
          <div style={{ display: 'flex', gap: 0, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border-dim)' }}>
            {['compact', 'detailed'].map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                style={{
                  padding: '2px 8px', border: 'none',
                  background: viewMode === mode ? 'var(--agent-cyan-dim)' : 'var(--bg-surface)',
                  color: viewMode === mode ? 'var(--agent-cyan)' : 'var(--text-dim)',
                  fontSize: 8, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'var(--font-display)', textTransform: 'uppercase',
                }}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <input
          type="text"
          placeholder="Search actions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search agent actions"
          style={{
            width: '100%',
            padding: '5px 8px',
            fontSize: 10,
            fontFamily: 'var(--font-body)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-dim)',
            borderRadius: 6,
            color: 'var(--text-primary)',
            outline: 'none',
            marginBottom: spacing[2],
          }}
        />

        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setActiveFilter(f.id)}
              style={{
                padding: '3px 8px',
                fontSize: 9,
                fontWeight: activeFilter === f.id ? 700 : 500,
                fontFamily: 'var(--font-display)',
                borderRadius: 10,
                border: 'none',
                background: activeFilter === f.id ? 'var(--agent-cyan-dim)' : 'var(--bg-raised)',
                color: activeFilter === f.id ? 'var(--agent-cyan)' : 'var(--text-dim)',
                cursor: 'pointer',
                transition: 'background 150ms cubic-bezier(0.33, 1, 0.68, 1)',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Entries */}
      <div style={{ flex: 1, overflowY: 'auto', padding: `${spacing[2]}px 12px` }}>
        {filtered.map((entry) => {
          const isExpanded = expandedId === entry.id || viewMode === 'detailed';
          const badge = getActionBadge(entry.action);

          return (
            <div
              key={entry.id}
              style={{
                marginBottom: 6,
                background: 'var(--bg-surface)',
                borderRadius: 6,
                border: `1px solid ${expandedId === entry.id ? 'var(--agent-cyan)' : 'var(--border-dim)'}`,
                animation: 'slideDown 0.3s ease-out',
                transition: 'border-color 220ms cubic-bezier(0.33, 1, 0.68, 1)',
              }}
            >
              <div
                style={{ padding: '8px 10px', cursor: 'pointer' }}
                onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 11, color: 'var(--text-primary)' }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                      background: entry.category === 'supervisor' ? 'var(--mongo)'
                        : entry.category === 'underwriting' ? 'var(--tool-blue)'
                        : entry.category === 'hitl' ? 'var(--hitl-amber)'
                        : 'var(--agent-cyan)',
                    }} />
                    {entry.agent}
                    {badge && (
                      <span style={{
                        fontSize: 7, fontWeight: 700, fontFamily: 'var(--font-mono)',
                        padding: '1px 4px', borderRadius: 3,
                        background: badge.bg, color: badge.color,
                      }}>
                        {badge.label}
                      </span>
                    )}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-dim)' }}>
                      {entry.time}
                    </span>
                    <span style={{
                      fontSize: 10,
                      color: 'var(--text-dim)',
                      transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)',
                      transition: 'transform 220ms cubic-bezier(0.33, 1, 0.68, 1)',
                      display: 'inline-block',
                    }}>
                      {'\u25BE'}
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                  {entry.action}
                </div>
              </div>

              {isExpanded && entry.reasoning && (
                <div style={{
                  padding: '0 10px 10px',
                  borderTop: '1px solid var(--border-dim)',
                }}>
                  <div style={{ marginTop: spacing[2] }}>
                    <div style={{
                      fontSize: 9, fontWeight: 700, color: 'var(--agent-cyan)',
                      textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4,
                    }}>
                      Reasoning
                    </div>
                    <div style={{
                      fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.5,
                      padding: '6px 8px', background: 'var(--bg-raised)',
                      borderRadius: 6, borderLeft: '2px solid var(--agent-cyan)',
                    }}>
                      {entry.reasoning}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {entries.length === 0 && (
          <div style={{
            padding: spacing[5], textAlign: 'center',
            border: '2px dashed var(--border-dim)', borderRadius: 8,
            background: '#FAFBFA', marginTop: spacing[3],
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)', opacity: 0.5, marginBottom: spacing[1] }}>
              ...
            </div>
            <div style={{ color: 'var(--text-dim)', fontSize: 11 }}>
              Waiting for agent activity...
            </div>
          </div>
        )}
        {entries.length > 0 && filtered.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-dim)', fontSize: 11 }}>
            No actions match current filters.
          </div>
        )}
      </div>

    </div>
  );
}
