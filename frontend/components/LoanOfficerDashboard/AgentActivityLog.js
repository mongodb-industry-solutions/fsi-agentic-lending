"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { spacing } from '@leafygreen-ui/tokens';
import { apiSSE, apiGet } from '../../lib/api';
import styles from './AgentActivityLog.module.css';

const NOISE_ACTIONS = ['tool_parse_warning', 'heartbeat', 'ping', 'noop'];

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

// Left-border + background treatment per badge type
const BADGE_ACCENTS = {
  ALERT:   { border: 'var(--danger)',     bg: 'var(--danger-dim)' },
  DECIDE:  { border: 'var(--hitl-amber)', bg: 'var(--hitl-amber-dim)' },
  SEARCH:  { border: 'var(--mongo)',      bg: undefined },
  DATA:    { border: 'var(--voyage)',     bg: undefined },
  COMPUTE: { border: 'var(--tool-blue)',  bg: undefined },
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

function relativeTime(ts) {
  if (!ts) return '';
  const diff = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diff < 3) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

const HITL_FALLBACK_STATUSES = new Set(['review', 'pending_review', 'processing', 'underwriting']);

export default function AgentActivityLog({ onEvent, applicationId, applicationStatus, onStatsChange, hitlReached, liveAgentOutput }) {
  const [entries, setEntries] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('compact');
  const [paused, setPaused] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const pausedRef = useRef(false);
  const bufferedEntriesRef = useRef([]);
  const sseEventCountRef = useRef(0);
  const [bufferCount, setBufferCount] = useState(0);
  const [totalReceived, setTotalReceived] = useState(0);
  const hitlInjectedRef = useRef(false);

  pausedRef.current = paused;

  // Lift stats to parent for rail header
  useEffect(() => {
    if (onStatsChange) onStatsChange({ totalReceived });
  }, [totalReceived, onStatsChange]);

  // Inject synthetic HITL gate entry
  useEffect(() => {
    if (hitlReached && !hitlInjectedRef.current) {
      hitlInjectedRef.current = true;
      const hitlEntry = {
        id: `hitl-gate-${Date.now()}`,
        agent: 'HITL Gate',
        category: 'hitl',
        action: 'Human-in-the-Loop Gate Reached',
        reasoning: 'Agent pipeline paused. All state checkpointed to MongoDB via MongoDBSaver. Awaiting officer review and decision.',
        time: new Date().toLocaleTimeString(),
        _ts: Date.now(),
        isLive: true,
        isGate: true,
      };
      setEntries((prev) => {
        if (prev.some(e => e.isGate)) return prev; // dedup
        return [hitlEntry, ...prev];
      });
    }
    if (!hitlReached) {
      hitlInjectedRef.current = false;
    }
  }, [hitlReached]);

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
      hitlInjectedRef.current = false;
      return;
    }

    setEntries([]);
    setTotalReceived(0);
    setPaused(false);
    setBufferCount(0);
    bufferedEntriesRef.current = [];
    hitlInjectedRef.current = false;
    sseEventCountRef.current = 0;

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
            _ts: event.timestamp ? new Date(event.timestamp).getTime() : Date.now(),
            isLive: true,
          };

          sseEventCountRef.current += 1;
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

    // REST fallback: fetch activity trail for apps whose status implies there
    // should be prior activity. Gated by status + a 2s timer so SSE has a
    // chance to populate first before we hit the fallback endpoint.
    let fallbackTimer = null;
    if (applicationStatus && HITL_FALLBACK_STATUSES.has(applicationStatus)) {
      fallbackTimer = setTimeout(() => {
        // Skip if SSE already produced events for this app.
        if (sseEventCountRef.current > 0) return;
        apiGet(`/hitl/${applicationId}/context`).then((ctx) => {
          if (ctx?.activity_trail?.length > 0) {
            const trailEntries = ctx.activity_trail.map((a, i) => ({
              id: `trail-${i}-${Date.now()}`,
              agent: a.agent || 'System',
              category: (a.agent || '').toLowerCase().includes('underwrit') ? 'underwriting'
                : (a.agent || '').toLowerCase().includes('supervisor') ? 'supervisor'
                : (a.agent || '').toLowerCase().includes('hitl') ? 'hitl'
                : 'loanapp',
              action: a.action || '',
              reasoning: a.detail || '',
              time: a.timestamp ? new Date(a.timestamp).toLocaleTimeString() : '',
              _ts: a.timestamp ? new Date(a.timestamp).getTime() : Date.now(),
              isLive: false,
            }));
            setEntries((prev) => prev.length === 0 ? trailEntries : prev);
            setTotalReceived((prev) => prev === 0 ? trailEntries.length : prev);
          }
        }).catch(() => {});
      }, 2000);
    }

    return () => {
      if (fallbackTimer) clearTimeout(fallbackTimer);
      source?.close();
    };
  }, [applicationId, applicationStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    let result = entries.filter((e) => !NOISE_ACTIONS.includes(e.action));
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

  // Metric pills from liveAgentOutput
  const metricPills = useMemo(() => {
    if (!liveAgentOutput) return [];
    const pills = [];
    if (liveAgentOutput.document_count != null) pills.push({ key: 'docs', label: 'Docs', value: liveAgentOutput.document_count });
    if (liveAgentOutput.primary_credit_score != null) pills.push({ key: 'credit', label: 'Credit', value: liveAgentOutput.primary_credit_score });
    if (liveAgentOutput.risk_score != null) pills.push({ key: 'risk', label: 'Risk', value: `${liveAgentOutput.risk_score}/100` });
    if (liveAgentOutput.gds_ratio != null) pills.push({ key: 'gds', label: 'GDS', value: `${(liveAgentOutput.gds_ratio * 100).toFixed(1)}%` });
    if (liveAgentOutput.tds_ratio != null) pills.push({ key: 'tds', label: 'TDS', value: `${(liveAgentOutput.tds_ratio * 100).toFixed(1)}%` });
    return pills;
  }, [liveAgentOutput]);

  if (!applicationId) {
    return (
      <div style={{
        flex: '1 1 0',
        minHeight: 0,
        background: 'var(--bg-base)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border-dim)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-sm)' }}>
            Agent Activity Log
          </div>
        </div>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: spacing[5],
        }}>
          {/* Anticipatory pipeline preview */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 220 }}>
            {[
              { label: 'Document Collection', color: 'var(--agent-cyan)' },
              { label: 'Credit Analysis', color: 'var(--voyage)' },
              { label: 'Underwriting', color: 'var(--tool-blue)' },
              { label: 'HITL Review', color: 'var(--hitl-amber)' },
            ].map((stage, i) => (
              <div key={stage.label} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                animation: `thinkingFade 400ms ease ${i * 100}ms both`,
              }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  border: `2px dashed ${stage.color}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 8, fontWeight: 700, color: stage.color,
                  flexShrink: 0,
                }}>
                  {i + 1}
                </div>
                <span style={{
                  fontSize: 10, color: 'var(--text-dim)',
                  fontFamily: 'var(--font-display)', fontWeight: 500,
                }}>
                  {stage.label}
                </span>
                {i < 3 && (
                  <span style={{ flex: 1, height: 1, background: 'var(--border-dim)' }} />
                )}
              </div>
            ))}
            <div style={{
              textAlign: 'center', marginTop: 8,
              fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-display)',
            }}>
              Select an application to begin
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
      background: 'var(--bg-base)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border-dim)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-sm)' }}>
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
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          aria-label="Search agent actions"
          style={{
            width: '100%',
            padding: '5px 8px',
            fontSize: 10,
            fontFamily: 'var(--font-body)',
            background: 'var(--bg-surface)',
            border: `1px solid ${searchFocused ? 'var(--agent-cyan)' : 'var(--border-dim)'}`,
            borderRadius: 6,
            color: 'var(--text-primary)',
            outline: 'none',
            marginBottom: spacing[2],
            boxShadow: searchFocused ? 'var(--focus-ring)' : 'none',
            transition: 'border-color 150ms ease, box-shadow 150ms ease',
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
                transform: activeFilter === f.id ? 'scale(1.05)' : 'scale(1)',
                transition: 'background 150ms cubic-bezier(0.33, 1, 0.68, 1), transform 150ms cubic-bezier(0.33, 1, 0.68, 1)',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Metric Summary Strip */}
      {metricPills.length > 0 && (
        <div style={{
          display: 'flex', gap: 4, flexWrap: 'wrap',
          padding: '6px 12px', borderBottom: '1px solid var(--border-dim)',
          background: 'var(--bg-base)',
        }}>
          {metricPills.map((pill, i) => (
            <div key={pill.key} style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '2px 7px', borderRadius: 8,
              background: 'var(--bg-raised)', border: '1px solid var(--border-dim)',
              animation: `metricRevealAfter 300ms ease-out ${i * 80}ms both`,
            }}>
              <span style={{ fontSize: 7, color: 'var(--text-dim)', fontFamily: 'var(--font-display)', fontWeight: 600, textTransform: 'uppercase' }}>
                {pill.label}
              </span>
              <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>
                {pill.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Entries */}
      <div style={{ flex: 1, overflowY: 'auto', padding: `${spacing[2]}px 12px` }}>
        {filtered.map((entry, idx) => {
          const isExpanded = expandedId === entry.id || viewMode === 'detailed';
          const badge = getActionBadge(entry.action);
          const accent = badge ? BADGE_ACCENTS[badge.label] : null;
          const prevEntry = idx > 0 ? filtered[idx - 1] : null;
          const showDivider = prevEntry && prevEntry.agent !== entry.agent && !entry.isGate;

          return (
            <div key={entry.id}>
              {/* Agent transition divider */}
              {showDivider && (
                <div role="separator" aria-label={`Agent: ${entry.agent}`} style={{
                  position: 'relative', height: 16, display: 'flex', alignItems: 'center',
                  margin: '4px 0',
                }}>
                  <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, transparent, var(--border-base), transparent)' }} />
                  <span style={{
                    position: 'absolute', left: '50%', transform: 'translateX(-50%)',
                    background: 'var(--bg-base)', padding: '0 8px',
                    fontSize: 7, fontFamily: 'var(--font-mono)', fontWeight: 600,
                    color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px',
                    whiteSpace: 'nowrap',
                  }}>
                    {entry.agent}
                  </span>
                </div>
              )}

              {/* HITL Gate special entry */}
              {entry.isGate ? (
                <div
                  aria-live="assertive"
                  style={{
                    marginBottom: 6, padding: '10px 12px',
                    background: 'var(--hitl-amber-dim)',
                    borderRadius: 6,
                    border: '1px solid var(--hitl-amber)',
                    borderLeft: '3px solid var(--hitl-amber)',
                    animation: 'urgencyPulse 2s infinite',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: 'var(--hitl-amber)',
                      flexShrink: 0,
                    }} />
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11, color: 'var(--hitl-amber)' }}>
                      HITL Gate
                    </span>
                    <span style={{
                      fontSize: 7, fontWeight: 700, fontFamily: 'var(--font-mono)',
                      padding: '1px 5px', borderRadius: 3,
                      background: 'var(--hitl-amber)', color: '#fff',
                    }}>
                      AWAITING REVIEW
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {entry.reasoning}
                  </div>
                </div>
              ) : (
                /* Standard entry */
                <div
                  className={styles.entryCard}
                  style={{
                    marginBottom: 6,
                    background: accent?.bg || 'var(--bg-surface)',
                    borderRadius: 6,
                    border: `1px solid ${expandedId === entry.id ? 'var(--agent-cyan)' : 'var(--border-dim)'}`,
                    borderLeft: accent ? `3px solid ${accent.border}` : `1px solid ${expandedId === entry.id ? 'var(--agent-cyan)' : 'var(--border-dim)'}`,
                    animation: entry.isLive ? 'agentEntryPing 0.6s ease-out, slideDown 0.3s ease-out' : 'none',
                    transition: 'border-color 220ms cubic-bezier(0.33, 1, 0.68, 1), background 220ms ease',
                  }}
                >
                  <div
                    style={{ padding: '8px 10px', cursor: 'pointer' }}
                    onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                  >
                    {/* Row 1: Action (primary) + time + chevron */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 3 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                          {entry.action}
                        </div>
                        {/* Row 2: Agent name (metadata) + badge */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{
                            width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                            background: entry.category === 'supervisor' ? 'var(--mongo)'
                              : entry.category === 'underwriting' ? 'var(--tool-blue)'
                              : entry.category === 'hitl' ? 'var(--hitl-amber)'
                              : 'var(--agent-cyan)',
                          }} />
                          <span style={{ fontSize: 9, color: 'var(--text-dim)', fontWeight: 500 }}>
                            {entry.agent}
                          </span>
                          {badge && (
                            <span style={{
                              fontSize: 7, fontWeight: 700, fontFamily: 'var(--font-mono)',
                              padding: '1px 4px', borderRadius: 3,
                              background: badge.bg, color: badge.color,
                            }}>
                              {badge.label}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 6 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-dim)' }}>
                          {relativeTime(entry._ts)}
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

                    {/* Reasoning preview in compact mode */}
                    {viewMode === 'compact' && !isExpanded && entry.reasoning && (
                      <div style={{
                        fontSize: 9, color: 'var(--text-dim)', fontStyle: 'italic',
                        marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {entry.reasoning.length > 120
                          ? entry.reasoning.slice(0, entry.reasoning.lastIndexOf(' ', 120) || 120) + '...'
                          : entry.reasoning}
                      </div>
                    )}
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
                          Detail
                        </div>
                        <div style={{
                          fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.6,
                          padding: '8px 10px', background: 'var(--bg-raised)',
                          borderRadius: 6, borderLeft: '2px solid var(--agent-cyan)',
                        }}>
                          {entry.reasoning.split('\n').filter(Boolean).map((para, pi) => {
                            const isHeader = para.startsWith('# ') || para.startsWith('## ');
                            const isBold = para.startsWith('**') && para.endsWith('**');
                            return (
                              <div key={pi} style={{
                                marginBottom: 4,
                                fontWeight: (isHeader || isBold) ? 700 : 400,
                                fontSize: isHeader ? 11 : 10,
                                color: isHeader ? 'var(--text-primary)' : 'var(--text-secondary)',
                              }}>
                                {isHeader ? para.replace(/^#+\s*/, '') : isBold ? para.slice(2, -2) : para}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {entries.length === 0 && (
          <div style={{
            padding: spacing[5], textAlign: 'center',
            border: '2px dashed var(--border-dim)', borderRadius: 8,
            background: 'var(--bg-void)', marginTop: spacing[3],
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)', opacity: 0.5, marginBottom: spacing[1] }}>
              SSE
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
