"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { spacing } from '@leafygreen-ui/tokens';
import { apiGet } from '../../lib/api';

const FIELD_ANNOTATIONS = {
  property: 'Nested subdocument — property data co-located, no JOIN needed',
  income_summary: 'Embedded object — all income data travels with the application',
  status_history: 'Array of status transitions — audit trail lives in the document',
  borrower_ids: 'Reference array — flexible $lookup when full borrower data needed',
  risk_score: 'Computed by the underwriter agent, written directly to the document',
  gds_ratio: 'Stress-tested ratio — pipeline writes results in-place',
  tds_ratio: 'Stress-tested ratio — pipeline writes results in-place',
  documents: 'Embedded references — each links to the documents collection',
  credit_reports: 'Joined via $lookup on borrower_ids — credit data from bureau',
  existing_monthly_debt: 'Self-reported from application form, fallback for credit data',
};

const TYPE_COLORS = {
  string: 'var(--mongo)',
  number: 'var(--tool-blue)',
  boolean: 'var(--voyage)',
  null: 'var(--text-dim)',
  date: 'var(--hitl-amber)',
  objectId: 'var(--text-secondary)',
};

// Underwriting internals that must never reach the borrower. When this viewer
// is rendered borrower-side (borrowerSafe), these keys are stripped from the
// document (values AND keys) at any depth before rendering. The officer-side
// inspector renders the full document unchanged.
const SENSITIVE_FIELDS = new Set([
  'risk_score', 'risk_tier', 'gds_ratio', 'tds_ratio',
  'stress_gds', 'stress_tds', 'primary_credit_score', 'ltv',
  'decision_reasoning', 'credit_score', 'risk_factors',
]);

function sanitizeDoc(value) {
  if (Array.isArray(value)) return value.map(sanitizeDoc);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_FIELDS.has(k)) continue;
      out[k] = sanitizeDoc(v);
    }
    return out;
  }
  return value;
}

function getValueType(val) {
  if (val === null || val === undefined) return 'null';
  if (typeof val === 'boolean') return 'boolean';
  if (typeof val === 'number') return 'number';
  if (typeof val === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T/.test(val)) return 'date';
    if (/^[a-f0-9]{24}$/.test(val)) return 'objectId';
    return 'string';
  }
  if (Array.isArray(val)) return 'array';
  if (typeof val === 'object') return 'object';
  return 'string';
}

function formatValue(val, type) {
  if (type === 'null') return 'null';
  if (type === 'boolean') return String(val);
  if (type === 'number') return String(val);
  if (type === 'date') {
    try { return new Date(val).toLocaleString(); } catch { return val; }
  }
  if (type === 'objectId') return `ObjectId("${val.slice(0, 8)}...")`;
  if (type === 'string') {
    const s = String(val);
    return `"${s.length > 40 ? s.slice(0, 40) + '...' : s}"`;
  }
  return String(val);
}

const MAX_DEPTH = 10;

function TreeNode({ name, value, depth, changedPaths, path }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const type = getValueType(value);
  const isExpandable = (type === 'object' || type === 'array') && depth < MAX_DEPTH;
  const isChanged = changedPaths.has(path);
  const annotation = FIELD_ANNOTATIONS[name];

  const indent = depth * 16;
  const entries = isExpandable
    ? (type === 'array' ? value.map((v, i) => [`[${i}]`, v]) : Object.entries(value || {}))
    : [];

  return (
    <div>
      <div
        style={{
          display: 'flex', alignItems: 'flex-start', gap: 4,
          paddingLeft: indent, paddingTop: 2, paddingBottom: 2,
          cursor: isExpandable ? 'pointer' : 'default',
          animation: isChanged ? 'fieldHighlight 2s ease-out both' : undefined,
          borderRadius: 3,
        }}
        onClick={isExpandable ? () => setExpanded((p) => !p) : undefined}
      >
        {/* Caret */}
        <span style={{
          width: 12, fontSize: 10, color: 'var(--text-dim)', flexShrink: 0, marginTop: 2,
          transform: isExpandable ? (expanded ? 'rotate(90deg)' : 'rotate(0)') : undefined,
          transition: 'transform 150ms ease',
          visibility: isExpandable ? 'visible' : 'hidden',
        }}>
          {'\u25B8'}
        </span>

        {/* Field name */}
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600,
          color: 'var(--text-primary)', flexShrink: 0,
        }}>
          {name}
        </span>

        {/* Value or type indicator */}
        {isExpandable ? (
          <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
            {expanded ? (type === 'array' ? '[' : '{') : (
              type === 'array'
                ? `[ ... ] ${value.length} items`
                : `{ ... } ${Object.keys(value || {}).length} fields`
            )}
          </span>
        ) : (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 12,
            color: TYPE_COLORS[type] || 'var(--text-primary)',
            fontStyle: type === 'null' ? 'italic' : 'normal',
          }}>
            {formatValue(value, type)}
          </span>
        )}

        {/* Changed indicator */}
        {isChanged && (
          <span style={{
            fontSize: 8, fontWeight: 700, color: 'var(--mongo)',
            textTransform: 'uppercase', marginLeft: 4, flexShrink: 0,
          }}>
            changed
          </span>
        )}
      </div>

      {/* Annotation */}
      {annotation && expanded && (
        <div style={{
          paddingLeft: indent + 16, fontSize: 10, color: 'var(--text-dim)',
          fontStyle: 'italic', fontFamily: 'var(--font-display)',
          borderLeft: '2px solid var(--mongo-dim)', marginLeft: indent + 6,
          paddingTop: 1, paddingBottom: 2, marginBottom: 2,
        }}>
          {annotation}
        </div>
      )}

      {/* Children */}
      {isExpandable && expanded && (
        <div>
          {entries.map(([k, v]) => (
            <TreeNode
              key={k}
              name={k}
              value={v}
              depth={depth + 1}
              changedPaths={changedPaths}
              path={`${path}.${k}`}
            />
          ))}
          <div style={{ paddingLeft: indent + 12, fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
            {type === 'array' ? ']' : '}'}
          </div>
        </div>
      )}
    </div>
  );
}

function highlightJson(json) {
  // Tokenize JSON string into syntax-highlighted spans.
  // Order matters: handle strings (with optional key colon) before numbers/booleans.
  const tokenRe = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+\.?\d*(?:[eE][+-]?\d+)?)/g;
  const parts = [];
  let lastIndex = 0;
  let match;
  let idx = 0;
  while ((match = tokenRe.exec(json)) !== null) {
    if (match.index > lastIndex) {
      parts.push(json.slice(lastIndex, match.index));
    }
    const [full, str, colon, literal, num] = match;
    if (str !== undefined) {
      if (colon) {
        // Object key
        parts.push(
          <span key={idx++} style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{str}</span>
        );
        parts.push(<span key={idx++} style={{ color: 'var(--text-dim)' }}>{colon}</span>);
      } else {
        // String value — check if it looks like a date/objectId
        const inner = str.slice(1, -1);
        let color = TYPE_COLORS.string;
        if (/^\d{4}-\d{2}-\d{2}T/.test(inner)) color = TYPE_COLORS.date;
        else if (/^[a-f0-9]{24}$/.test(inner)) color = TYPE_COLORS.objectId;
        parts.push(<span key={idx++} style={{ color }}>{str}</span>);
      }
    } else if (literal !== undefined) {
      const color = literal === 'null' ? TYPE_COLORS.null : TYPE_COLORS.boolean;
      parts.push(
        <span key={idx++} style={{ color, fontStyle: literal === 'null' ? 'italic' : 'normal' }}>{literal}</span>
      );
    } else if (num !== undefined) {
      parts.push(<span key={idx++} style={{ color: TYPE_COLORS.number }}>{num}</span>);
    }
    lastIndex = match.index + full.length;
  }
  if (lastIndex < json.length) parts.push(json.slice(lastIndex));
  return parts;
}

function RawJsonView({ doc }) {
  const json = JSON.stringify(doc, null, 2);
  return (
    <pre style={{
      fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.65,
      background: 'var(--bg-void)', padding: spacing[3], borderRadius: 6,
      margin: spacing[3], overflow: 'auto', color: 'var(--text-dim)',
      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      border: '1px solid var(--border-dim)',
    }}>
      {highlightJson(json)}
    </pre>
  );
}

export default function DocumentModelViewer({ applicationId, borrowerSafe = false }) {
  const [doc, setDoc] = useState(null);
  const [viewMode, setViewMode] = useState('json');
  const [changedPaths, setChangedPaths] = useState(new Set());
  const [lastUpdated, setLastUpdated] = useState(null);
  const prevDocRef = useRef(null);

  const detectChanges = useCallback((prev, next) => {
    if (!prev || !next) return new Set();
    const changed = new Set();
    const check = (p, n, path) => {
      if (p === n) return;
      if (typeof p !== typeof n || p === null || n === null) {
        changed.add(path);
        return;
      }
      if (typeof n === 'object' && !Array.isArray(n)) {
        for (const k of new Set([...Object.keys(p || {}), ...Object.keys(n || {})])) {
          check(p?.[k], n?.[k], `${path}.${k}`);
        }
      } else if (JSON.stringify(p) !== JSON.stringify(n)) {
        changed.add(path);
      }
    };
    for (const k of new Set([...Object.keys(prev), ...Object.keys(next)])) {
      check(prev[k], next[k], k);
    }
    return changed;
  }, []);

  useEffect(() => {
    if (!applicationId) return;
    let cancelled = false;

    const fetchDoc = () => {
      apiGet(`/applications/${applicationId}`).then((raw) => {
        if (cancelled || !raw) return;
        const data = borrowerSafe ? sanitizeDoc(raw) : raw;
        const changes = detectChanges(prevDocRef.current, data);
        if (changes.size > 0) setChangedPaths(changes);
        prevDocRef.current = data;
        setDoc(data);
        setLastUpdated(new Date());
      });
    };

    fetchDoc();
    const interval = setInterval(fetchDoc, 3000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [applicationId, detectChanges, borrowerSafe]);

  // Clear change highlights after 3 seconds
  useEffect(() => {
    if (changedPaths.size === 0) return;
    const t = setTimeout(() => setChangedPaths(new Set()), 3000);
    return () => clearTimeout(t);
  }, [changedPaths]);

  if (!applicationId) {
    return (
      <div style={{ padding: spacing[5], textAlign: 'center', color: 'var(--text-dim)', fontSize: 11 }}>
        Select an application to view its document model.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: spacing[2],
        padding: `${spacing[2]}px ${spacing[3]}px`,
        borderBottom: '1px solid var(--border-dim)',
        flexShrink: 0,
      }}>
        <div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12 }}>
            Application Document
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)', marginLeft: 8,
          }}>
            applications collection
          </span>
        </div>

        <div style={{ flex: 1 }} />

        {lastUpdated && (
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
            Updated: {lastUpdated.toLocaleTimeString()}
          </span>
        )}

        {/* View mode toggle */}
        <div style={{ display: 'flex', gap: 0, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border-dim)' }}>
          {['tree', 'raw'].map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              style={{
                padding: '2px 8px', border: 'none',
                background: viewMode === mode ? 'var(--mongo-dim)' : 'var(--bg-surface)',
                color: viewMode === mode ? 'var(--mongo)' : 'var(--text-dim)',
                fontSize: 9, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'var(--font-display)', textTransform: 'uppercase',
              }}
            >
              {mode === 'tree' ? 'Tree' : 'JSON'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: `${spacing[2]}px ${spacing[2]}px` }}>
        {!doc ? (
          <div style={{
            padding: spacing[5], textAlign: 'center',
            color: 'var(--text-dim)', fontSize: 11,
          }}>
            <div style={{
              width: 40, height: 4, borderRadius: 2, background: 'var(--bg-raised)',
              margin: '0 auto', marginBottom: 6,
              animation: 'shimmerCard 2s ease-in-out infinite',
              backgroundSize: '200% 100%',
              backgroundImage: 'linear-gradient(90deg, var(--bg-raised) 0%, var(--border-dim) 50%, var(--bg-raised) 100%)',
            }} />
            Loading application document...
          </div>
        ) : viewMode === 'raw' ? (
          <RawJsonView doc={doc} />
        ) : (
          <div>
            {Object.entries(doc).map(([key, value]) => (
              <TreeNode
                key={key}
                name={key}
                value={value}
                depth={0}
                changedPaths={changedPaths}
                path={key}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
