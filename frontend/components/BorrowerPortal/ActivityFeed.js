"use client";

import { useEffect, useRef } from 'react';
import { spacing } from '@leafygreen-ui/tokens';
import { getAgentStyle } from './statusTrackerConstants';

export function ActivityItem({ event }) {
  const agentStyle = getAgentStyle(event.agent);
  const time = event.timestamp
    ? new Date(event.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '';

  return (
    <div style={{
      display: 'flex', gap: 6, alignItems: 'flex-start',
      padding: '4px 0',
      animation: 'cardEnter 0.3s cubic-bezier(0.4, 0, 0.2, 1) both',
    }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 9,
        color: 'var(--text-dim)', flexShrink: 0, marginTop: 1,
        minWidth: 58,
      }}>
        {time}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 1 }}>
          <span style={{
            fontSize: 8, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.04em', color: agentStyle.color,
            padding: '1px 5px', borderRadius: 4,
            background: agentStyle.bg,
          }}>
            {agentStyle.label}
          </span>
          {event.action && (
            <span style={{
              fontSize: 8, color: 'var(--text-dim)', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.03em',
            }}>
              {event.action}
            </span>
          )}
        </div>
        <div style={{
          fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4,
        }}>
          {event.detail}
        </div>
      </div>
    </div>
  );
}

export function ThinkingStrip({ events }) {
  const latest = events[events.length - 1];
  if (!latest) return null;

  const agentStyle = getAgentStyle(latest.agent);

  return (
    <div
      key={`${latest.timestamp}-${events.length}`}
      style={{
        marginTop: 6,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        animation: 'thinkingFade 150ms cubic-bezier(0.33, 1, 0.68, 1) both',
      }}
    >
      <div style={{
        width: 6, height: 6, borderRadius: '50%',
        background: agentStyle.color,
        boxShadow: `0 0 6px ${agentStyle.color}`,
        animation: 'pulse 1.5s infinite',
        flexShrink: 0,
      }} />
      <span style={{
        fontSize: 8, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.04em', color: agentStyle.color,
        padding: '1px 5px', borderRadius: 4,
        background: agentStyle.bg, flexShrink: 0,
      }}>
        {agentStyle.label}
      </span>
      <span style={{
        fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.3,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {latest.detail}
      </span>
    </div>
  );
}

export function ActivityFeed({ events, collapsed, onToggle }) {
  const feedRef = useRef(null);

  useEffect(() => {
    if (feedRef.current && !collapsed) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [events.length, collapsed]);

  if (events.length === 0) return null;

  return (
    <div style={{
      marginTop: spacing[2],
      borderTop: '1px solid var(--border-dim)',
      paddingTop: spacing[2],
    }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '2px 0', width: '100%', textAlign: 'left',
          font: 'inherit',
        }}
      >
        <span style={{
          fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.05em', color: 'var(--agent-cyan)',
          fontFamily: 'var(--font-display)',
        }}>
          Live Activity
        </span>
        <span style={{
          fontSize: 8, fontWeight: 700, fontFamily: 'var(--font-mono)',
          padding: '1px 5px', borderRadius: 4,
          background: 'var(--agent-cyan-dim)',
          color: 'var(--agent-cyan)',
        }}>
          {events.length}
        </span>
        <span style={{
          fontSize: 10, color: 'var(--text-dim)',
          transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
          transition: 'transform 150ms ease',
          marginLeft: 'auto',
        }}>
          {'\u25BE'}
        </span>
      </button>

      {!collapsed && (
        <div
          ref={feedRef}
          style={{
            maxHeight: 200, overflowY: 'auto', marginTop: 4,
            paddingRight: 2,
          }}
        >
          {events.map((ev, idx) => (
            <ActivityItem key={`${ev.timestamp}-${idx}`} event={ev} />
          ))}
        </div>
      )}
    </div>
  );
}
