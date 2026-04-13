"use client";

import { useState, useEffect, useMemo } from 'react';
import { spacing } from '@leafygreen-ui/tokens';
import { apiSSE } from '../../lib/api';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'supervisor', label: 'Supervisor' },
  { id: 'loanapp', label: 'Loan App' },
  { id: 'underwriting', label: 'Underwriting' },
  { id: 'hitl', label: 'HITL' },
];

export default function AgentActivityLog({ onEvent, applicationId }) {
  const [entries, setEntries] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!applicationId) {
      setEntries([]);
      return;
    }

    setEntries([]);

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
            op: '',
            latency: '\u2014',
            icon: null,
            reasoning: event.detail || '',
            details: null,
            time: new Date(event.timestamp || Date.now()).toLocaleTimeString(),
            isLive: true,
          };
          setEntries((prev) => {
            const next = [liveEntry, ...prev];
            return next.length > 100 ? next.slice(0, 100) : next;
          });
          if (onEvent) onEvent(liveEntry);
        }
        if (event.type === 'complete') {
          console.log('[AgentActivityLog] Pipeline complete');
        }
      }
    );

    return () => source?.close();
  }, [applicationId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!applicationId) {
    return (
      <div style={{
        width: 360,
        borderLeft: '1px solid var(--border-dim)',
        background: 'var(--bg-base)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        flexShrink: 0,
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

  const filtered = useMemo(() => {
    let result = entries;
    if (activeFilter !== 'all') {
      result = result.filter((e) => e.category === activeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) => e.action.toLowerCase().includes(q) || e.agent.toLowerCase().includes(q) || e.op.toLowerCase().includes(q)
      );
    }
    return result;
  }, [entries, activeFilter, searchQuery]);

  const costSummary = useMemo(() => {
    let totalTokens = 0;
    let totalLatencyMs = 0;
    let llmCalls = 0;
    let apiCalls = 0;
    let sysCalls = 0;
    entries.forEach((e) => {
      if (e.details) {
        totalTokens += e.details.tokens || 0;
        const model = e.details.model || '';
        if (model.startsWith('gpt') || model.startsWith('voyage')) llmCalls++;
        else if (model.includes('API')) apiCalls++;
        else sysCalls++;
      }
      const ms = parseInt(e.latency, 10);
      if (!isNaN(ms)) totalLatencyMs += ms;
    });
    const costUsd = (totalTokens / 1_000_000) * 8.5;
    return { totalTokens, totalLatencyMs, costUsd, llmCalls, apiCalls, sysCalls };
  }, [entries]);

  return (
    <div style={{
      flex: '0 1 360px',
      minWidth: 260,
      maxWidth: 420,
      borderLeft: '1px solid var(--border-dim)',
      background: 'var(--bg-base)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border-dim)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13 }}>
            Agent Activity Log
          </div>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 600, color: 'var(--success)' }}>
            <span style={{
              width: 5, height: 5, borderRadius: '50%',
              background: 'var(--success)',
              boxShadow: '0 0 6px var(--success)',
              animation: 'pulse 1.5s infinite',
            }} />
            Live
          </span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2, marginBottom: spacing[2] }}>
          {entries.length} agent actions · {filtered.length} shown
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
          const isExpanded = expandedId === entry.id;
          return (
            <div
              key={entry.id}
              style={{
                marginBottom: 6,
                background: 'var(--bg-surface)',
                borderRadius: 6,
                border: `1px solid ${isExpanded ? 'var(--agent-cyan)' : 'var(--border-dim)'}`,
                animation: 'slideDown 0.3s ease-out',
                transition: 'border-color 220ms cubic-bezier(0.33, 1, 0.68, 1)',
              }}
            >
              <div
                style={{ padding: '8px 10px', cursor: 'pointer' }}
                onClick={() => setExpandedId(isExpanded ? null : entry.id)}
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
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 3 }}>
                  {entry.action}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--agent-cyan)' }}>
                    {entry.op}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--mongo)', fontWeight: 700 }}>
                    {entry.latency}
                  </span>
                </div>
              </div>

              {isExpanded && (
                <div style={{
                  padding: '0 10px 10px',
                  borderTop: '1px solid var(--border-dim)',
                }}>
                  <div style={{ marginTop: spacing[2] }}>
                    <div style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: 'var(--agent-cyan)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: 4,
                    }}>
                      Reasoning
                    </div>
                    <div style={{
                      fontSize: 10,
                      color: 'var(--text-secondary)',
                      lineHeight: 1.5,
                      padding: '6px 8px',
                      background: 'var(--bg-raised)',
                      borderRadius: 6,
                      borderLeft: '2px solid var(--agent-cyan)',
                    }}>
                      {entry.reasoning || 'No reasoning provided.'}
                    </div>
                  </div>

                  {entry.details && (
                    <div style={{ marginTop: spacing[2] }}>
                      <div style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: 'var(--text-dim)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        marginBottom: 4,
                      }}>
                        Details
                      </div>
                      <div style={{
                        padding: '6px 8px',
                        background: 'var(--bg-raised)',
                        borderRadius: 6,
                        fontSize: 9,
                        fontFamily: 'var(--font-mono)',
                      }}>
                        <div style={{ marginBottom: 4 }}>
                          <span style={{ color: 'var(--text-dim)' }}>input: </span>
                          <span style={{ color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{entry.details.input}</span>
                        </div>
                        <div style={{ marginBottom: 4 }}>
                          <span style={{ color: 'var(--text-dim)' }}>output: </span>
                          <span style={{ color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{entry.details.output}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                          <span>
                            <span style={{ color: 'var(--text-dim)' }}>tokens: </span>
                            <span style={{ color: 'var(--voyage)', fontWeight: 600 }}>{entry.details.tokens}</span>
                          </span>
                          <span>
                            <span style={{ color: 'var(--text-dim)' }}>model: </span>
                            <span style={{ color: 'var(--tool-blue)', fontWeight: 600 }}>{entry.details.model}</span>
                          </span>
                          <span>
                            <span style={{ color: 'var(--text-dim)' }}>latency: </span>
                            <span style={{ color: 'var(--mongo)', fontWeight: 600 }}>{entry.latency}</span>
                          </span>
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

      {/* Cost summary footer */}
      {entries.length > 0 && (
        <div style={{
          padding: `${spacing[2]}px ${spacing[3]}px`,
          borderTop: '1px solid var(--border-dim)',
          background: 'var(--bg-surface)',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 6,
        }}>
          <div>
            <div style={{ fontSize: 8, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>Tokens</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--voyage)' }}>
              {costSummary.totalTokens.toLocaleString('en-US')}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 8, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>Est. Cost</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--mongo)' }}>
              ${costSummary.costUsd.toFixed(4)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 8, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>Latency</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--agent-cyan)' }}>
              {costSummary.totalLatencyMs}ms
            </div>
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, fontSize: 9, color: 'var(--text-dim)' }}>
            <span><span style={{ fontWeight: 700, color: 'var(--tool-blue)' }}>{costSummary.llmCalls}</span> LLM</span>
            <span><span style={{ fontWeight: 700, color: 'var(--agent-cyan)' }}>{costSummary.apiCalls}</span> API</span>
            <span><span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>{costSummary.sysCalls}</span> System</span>
          </div>
        </div>
      )}
    </div>
  );
}
