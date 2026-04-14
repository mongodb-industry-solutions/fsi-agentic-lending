"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import { spacing } from '@leafygreen-ui/tokens';
import { apiPost } from '../../lib/api';

export function PolicyExplorer({ autoQuery = '' }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [expandedResult, setExpandedResult] = useState(null);
  const [preloaded, setPreloaded] = useState(false);
  const [searchMeta, setSearchMeta] = useState(null);
  const autoQueryRef = useRef('');

  // Auto-load common policies on first expand
  useEffect(() => {
    if (!expanded || preloaded) return;
    setPreloaded(true);
    (async () => {
      setSearching(true);
      const t0 = Date.now();
      const data = await apiPost('/policies/search', { query: 'mortgage lending requirements GDS TDS credit score', limit: 5 });
      const duration = Date.now() - t0;
      setSearching(false);
      if (data?.results) { setResults(data.results); setSearchMeta({ count: data.results.length, ms: duration }); }
      else if (Array.isArray(data)) { setResults(data); setSearchMeta({ count: data.length, ms: duration }); }
    })();
  }, [expanded, preloaded]);

  // Auto-query from HITL gate
  useEffect(() => {
    if (autoQuery && autoQuery !== autoQueryRef.current) {
      autoQueryRef.current = autoQuery;
      setPreloaded(true); // prevent concurrent preload race
      setExpanded(true);
      setQuery(autoQuery);
      (async () => {
        setSearching(true);
        const t0 = Date.now();
        const data = await apiPost('/policies/search', { query: autoQuery, limit: 5 });
        const duration = Date.now() - t0;
        setSearching(false);
        if (data?.results) { setResults(data.results); setSearchMeta({ count: data.results.length, ms: duration }); }
        else if (Array.isArray(data)) { setResults(data); setSearchMeta({ count: data.length, ms: duration }); }
        else setResults([]);
      })();
    }
  }, [autoQuery]);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    const t0 = Date.now();
    const data = await apiPost('/policies/search', { query: query.trim(), limit: 5 });
    const duration = Date.now() - t0;
    setSearching(false);
    if (data?.results) { setResults(data.results); setSearchMeta({ count: data.results.length, ms: duration }); }
    else if (Array.isArray(data)) { setResults(data); setSearchMeta({ count: data.length, ms: duration }); }
    else { setResults([]); setSearchMeta({ count: 0, ms: duration }); }
  }, [query]);

  // Highlight query terms in content
  const highlightTerms = useCallback((content, q) => {
    if (!q || !content) return content;
    const terms = q.trim().split(/\s+/).filter(t => t.length > 2);
    if (terms.length === 0) return content;
    const regex = new RegExp(`(${terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    const parts = content.split(regex);
    // Captured groups from split() land at odd indices
    return parts.map((part, i) =>
      i % 2 === 1
        ? <mark key={i} style={{ background: 'var(--voyage-dim)', color: 'var(--voyage)', padding: '0 1px', borderRadius: 2 }}>{part}</mark>
        : part
    );
  }, []);

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
              fontSize: 10, fontWeight: 700, color: 'var(--voyage)',
              fontFamily: 'var(--font-display)',
            }}>
              Policy Lookup
            </span>
            <span style={{
              fontSize: 7, fontFamily: 'var(--font-mono)', fontWeight: 700,
              padding: '1px 4px', borderRadius: 3,
              background: 'var(--voyage-dim)', color: 'var(--voyage)',
            }}>
              VECTOR SEARCH
            </span>
          </div>
          {/* Collapsed preview */}
          {!expanded && results && results.length > 0 && (
            <span style={{ fontSize: 8, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
              {results.length} policies{results[0]?.title ? ` | Top: ${results[0].title}` : ''}{results[0]?.score != null ? ` (${results[0].score.toFixed(2)})` : ''}
            </span>
          )}
        </div>
        <span style={{
          fontSize: 10, color: 'var(--text-dim)',
          transform: expanded ? 'rotate(180deg)' : 'rotate(0)',
          transition: 'transform 150ms ease', display: 'inline-block',
        }}>{'\u25BE'}</span>
      </button>
      <div style={{
        maxHeight: expanded ? 800 : 0,
        overflow: 'hidden',
        transition: 'max-height 220ms cubic-bezier(0.33, 1, 0.68, 1)',
      }}>
        <div style={{ padding: `0 12px ${spacing[3]}px` }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search lending policies..."
              aria-label="Policy search"
              style={{
                flex: 1, padding: '5px 8px', fontSize: 10,
                fontFamily: 'inherit',
                background: 'var(--bg-surface)', border: '1px solid var(--border-dim)',
                borderRadius: 6, color: 'var(--text-primary)', outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={searching || !query.trim()}
              style={{
                padding: '5px 10px', borderRadius: 6, border: 'none',
                background: query.trim() ? 'var(--voyage)' : 'var(--border-dim)',
                color: '#fff', fontSize: 9, fontWeight: 600,
                fontFamily: 'var(--font-display)', cursor: query.trim() ? 'pointer' : 'default',
              }}
            >
              {searching ? '...' : 'Search'}
            </button>
          </div>
          {/* Search provenance */}
          {searchMeta && (
            <div style={{
              fontSize: 7, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)',
              marginBottom: spacing[2], display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <span>Voyage AI embeddings</span>
              <span style={{ color: 'var(--border-base)' }}>{'\u00b7'}</span>
              <span>Atlas Vector Search</span>
              <span style={{ color: 'var(--border-base)' }}>{'\u00b7'}</span>
              <span>{searchMeta.count} results in {searchMeta.ms}ms</span>
            </div>
          )}
          {results && results.length === 0 && (
            <div style={{ fontSize: 9, color: 'var(--text-dim)', padding: 4 }}>
              No matching policies found.
            </div>
          )}
          {results && results.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {results.map((r, i) => (
                <div key={i} onClick={() => setExpandedResult(expandedResult === i ? null : i)} style={{
                  padding: '6px 8px', background: 'var(--bg-surface)', borderRadius: 6,
                  border: `1px solid ${expandedResult === i ? 'var(--voyage)' : 'var(--border-dim)'}`,
                  cursor: 'pointer',
                  animation: `thinkingFade 200ms cubic-bezier(0.33, 1, 0.68, 1) ${i * 60}ms both`,
                  transition: 'border-color 150ms ease',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {r.title || 'Policy'}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {/* Relevance bar */}
                      {r.score != null && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div
                            role="meter"
                            aria-valuemin={0}
                            aria-valuemax={1}
                            aria-valuenow={r.score}
                            aria-label={`Relevance score: ${Math.round(r.score * 100)}%`}
                            style={{
                              width: 36, height: 3, borderRadius: 2,
                              background: 'var(--border-dim)',
                              overflow: 'hidden',
                            }}
                          >
                            <div style={{
                              width: `${Math.max(8, r.score * 100)}%`, height: '100%',
                              borderRadius: 2,
                              background: r.score > 0.7 ? 'var(--success)' : 'var(--hitl-amber)',
                              transition: 'width 300ms ease',
                            }} />
                          </div>
                          <span style={{ fontSize: 7, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', fontWeight: 600 }}>
                            {(r.score * 100).toFixed(0)}
                          </span>
                        </div>
                      )}
                      <span style={{
                        fontSize: 8, color: 'var(--text-dim)',
                        transform: expandedResult === i ? 'rotate(180deg)' : 'rotate(0)',
                        transition: 'transform 150ms ease', display: 'inline-block',
                      }}>{'\u25BE'}</span>
                    </div>
                  </div>
                  {r.section && (
                    <div style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--voyage)', marginBottom: 2 }}>
                      {r.section}
                    </div>
                  )}
                  {r.content && (
                    <div style={{ fontSize: 9, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      {expandedResult === i ? highlightTerms(r.content, query) : (r.content.slice(0, 200) + (r.content.length > 200 ? '...' : ''))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
