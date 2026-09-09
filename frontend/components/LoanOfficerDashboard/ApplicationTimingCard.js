"use client";

// Persistent "total time" card for the selected application, pinned at the top
// of the officer center column. Everything derives from the application
// document (`created_at` + `status_history`), which is durable — it survives
// approval/decline, so unlike the old header timer this card stays visible
// after the loan is decided and freezes at the exact persisted decision time.
//
// Frontend-only: the parent already has the full doc (`selectedAppDetail`,
// re-fetched on WS change), so this renders with zero extra network in the
// common path. A narrow self-fetch covers the one lag case — the SSE 'complete'
// event flips `approved` client-side before the WS refetch round-trip.

import { useState, useEffect, useMemo } from 'react';
import { apiGet } from '../../lib/api';
import { formatDuration } from './utils';

const TERMINAL_STATUSES = ['approved', 'declined'];

function parseTs(value) {
  if (value == null) return null;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}

// Monotonic recency: adopt a candidate only if it reflects a strictly newer
// write (last status_history timestamp, falling back to updated_at/created_at).
function isNewerDoc(candidate, current) {
  if (!candidate) return false;
  if (!current) return true;
  const candTs = lastWriteTs(candidate);
  const curTs = lastWriteTs(current);
  if (candTs == null) return false;
  if (curTs == null) return true;
  return candTs > curTs;
}

function lastWriteTs(doc) {
  let last = null;
  if (Array.isArray(doc.status_history)) {
    for (const entry of doc.status_history) {
      const t = parseTs(entry && entry.timestamp);
      if (t != null && (last == null || t > last)) last = t;
    }
  }
  if (last == null) last = parseTs(doc.updated_at);
  if (last == null) last = parseTs(doc.created_at);
  return last;
}

// Pure derivation: total time start → finish, plus consecutive status-stage
// blocks. "Finish" is the FIRST approved/declined status_history entry; anything
// after it (closing → funded → active) is ignored for total purposes.
function buildTimingData(doc, now) {
  if (!doc) return null;

  const t0 = parseTs(doc.created_at);
  const history = Array.isArray(doc.status_history) ? doc.status_history : [];
  const entries = history
    .map((entry) => ({
      status: String((entry && entry.status) || '').trim(),
      ts: parseTs(entry && entry.timestamp),
    }))
    .filter((e) => e.status && e.ts != null)
    .sort((a, b) => a.ts - b.ts);

  if (entries.length === 0) {
    if (t0 == null) return null;
    return {
      stages: [{ status: 'submitted', start: t0, end: now, elapsed: Math.max(0, now - t0), live: true }],
      total: Math.max(0, now - t0),
      isDecided: false,
      decisionTs: null,
      terminalStatus: null,
      t0,
    };
  }

  const startTs = t0 != null ? t0 : entries[0].ts;

  // Collapse consecutive duplicate statuses (keep the first of each run) — a
  // reprocessed app (modify-and-continue, action_required re-entry) legitimately
  // revisits a status, and each visit should render as its own block.
  const collapsed = [];
  for (const entry of entries) {
    const prev = collapsed[collapsed.length - 1];
    if (prev && prev.status === entry.status) continue;
    collapsed.push(entry);
  }

  const terminalIdx = collapsed.findIndex((e) => TERMINAL_STATUSES.includes(e.status));
  const isDecided = terminalIdx !== -1;
  const effective = isDecided ? collapsed.slice(0, terminalIdx + 1) : collapsed;
  const decisionTs = isDecided ? effective[effective.length - 1].ts : null;
  const endTs = isDecided ? decisionTs : now;

  const stages = effective.map((e, i) => {
    const end = i < effective.length - 1 ? effective[i + 1].ts : endTs;
    return {
      status: e.status,
      start: e.ts,
      end,
      elapsed: Math.max(0, end - e.ts),
      live: !isDecided && i === effective.length - 1,
    };
  });

  // The terminal block is zero-width (it is the END pointer of the prior stage),
  // so drop it unless it is the only block. The terminal status itself is
  // surfaced via the accent color + badge rather than a stage row.
  const blocks = isDecided && stages.length > 1 ? stages.slice(0, -1) : stages;

  return {
    stages: blocks,
    total: Math.max(0, endTs - startTs),
    isDecided,
    decisionTs,
    terminalStatus: isDecided ? effective[effective.length - 1].status : null,
    t0: startTs,
  };
}

function titleCase(s) {
  return String(s || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isoRange(stage) {
  if (stage.start == null || stage.end == null) return '';
  const fmt = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return `${fmt(stage.start)} → ${fmt(stage.end)}`;
}

export function ApplicationTimingCard({ applicationId = null, detail = null, status = null, approved = false }) {
  const [doc, setDoc] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  // Primary source: the parent's `selectedAppDetail`. Adopt monotonically so a
  // stale blow-over never regresses a fresher doc.
  useEffect(() => {
    setDoc((cur) => (isNewerDoc(detail, cur) ? detail : cur));
  }, [detail]);

  // Safety-net refetch on decision / status transition, where the WS-triggered
  // refetch can lag the client-side `approved` flip. Adopt only if newer.
  useEffect(() => {
    if (!applicationId) return;
    apiGet(`/applications/${applicationId}`)
      .then((data) => {
        if (data) setDoc((cur) => (isNewerDoc(data, cur) ? data : cur));
      })
      .catch(() => {});
  }, [applicationId, approved, status]);

  const timing = useMemo(() => buildTimingData(doc, now), [doc, now]);
  const running = !!(doc && timing && !timing.isDecided);

  // 1s live tick, mounted only while undecided; cleared on decision/unmount.
  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  if (!timing) return null;

  const pendingReview = doc?.status === 'review' || doc?.status === 'pending_review';
  const accent = timing.isDecided
    ? timing.terminalStatus === 'declined' ? 'var(--danger)' : 'var(--success)'
    : pendingReview ? 'var(--hitl-amber)' : 'var(--agent-cyan)';
  const totalColor = timing.isDecided
    ? timing.terminalStatus === 'declined' ? 'var(--danger)' : 'var(--success)'
    : 'var(--text-primary)';

  return (
    <div
      role="region"
      aria-label="Total processing time"
      style={{
        padding: '6px 14px',
        borderBottom: '1px solid var(--border-dim)',
        background: 'var(--bg-base)',
        borderLeft: `3px solid ${accent}`,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexShrink: 0 }}>
        <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, color: 'var(--text-dim)' }}>
          Total Time
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 800, color: totalColor }}>
          {formatDuration(timing.total)}
        </span>
        {timing.isDecided ? (
          <span style={{
            fontSize: 8, fontWeight: 700, fontFamily: 'var(--font-mono)',
            padding: '1px 6px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.5px',
            background: accent === 'var(--danger)' ? 'var(--danger-dim)' : 'var(--success-dim)',
            color: accent,
          }}>
            {timing.terminalStatus}
          </span>
        ) : (
          <span style={{ fontSize: 8, fontWeight: 600, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
            in progress
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
        {timing.stages.map((stage) => (
          <span
            key={`${stage.status}-${stage.start}`}
            title={`${titleCase(stage.status)}: ${isoRange(stage)}`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 9, fontFamily: 'var(--font-mono)',
              color: stage.live ? 'var(--agent-cyan)' : 'var(--text-dim)',
              fontWeight: stage.live ? 700 : 400,
              whiteSpace: 'nowrap',
            }}
          >
            {titleCase(stage.status)}
            <span style={{ color: 'var(--text-secondary)' }}>{formatDuration(stage.elapsed)}</span>
            {stage.live && (
              <span
                aria-hidden
                style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--agent-cyan)', animation: 'pulse 1.5s infinite' }}
              />
            )}
            <span style={{ color: 'var(--border-base)', marginLeft: 2 }}>{'›'}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default ApplicationTimingCard;
