"use client";

import { useState, useMemo } from 'react';
import { spacing } from '@leafygreen-ui/tokens';

const CAPABILITIES = [
  {
    id: 'search_lending_policies',
    label: 'Policy Search',
    technology: 'Atlas Vector Search + Voyage AI',
    description: 'Searches lending policies using semantic similarity. Answers regulatory and guideline questions with source citations.',
    category: 'search',
    color: 'var(--mongo)',
    bg: 'var(--mongo-dim)',
  },
  {
    id: 'get_document_context',
    label: 'Document Context',
    technology: 'MongoDB Aggregation',
    description: 'Fetches all submitted documents and their parsed extraction data for the current application.',
    category: 'data',
    color: 'var(--voyage)',
    bg: 'var(--voyage-dim)',
  },
  {
    id: 'get_application_status',
    label: 'Status Lookup',
    technology: 'MongoDB Query',
    description: 'Retrieves real-time application status, pipeline stage, and processing progress.',
    category: 'data',
    color: 'var(--tool-blue)',
    bg: 'var(--tool-blue-dim)',
  },
  {
    id: 'get_interventions',
    label: 'Intervention Check',
    technology: 'MongoDB Query',
    description: 'Checks for pending action items — missing documents, data gaps, or officer requests that need borrower attention.',
    category: 'alert',
    color: 'var(--hitl-amber)',
    bg: 'var(--hitl-amber-dim)',
  },
  {
    id: 'get_payment_schedule',
    label: 'Payment Projection',
    technology: 'MongoDB Aggregation',
    description: 'Calculates projected payment schedules based on current loan terms and approved rates.',
    category: 'compute',
    color: 'var(--tool-blue)',
    bg: 'var(--tool-blue-dim)',
  },
  {
    id: 'get_credit_summary',
    label: 'Credit Analysis',
    technology: 'MongoDB Query',
    description: 'Retrieves credit report data including score, trade lines, and bureau analysis from the credit_reports collection.',
    category: 'data',
    color: 'var(--agent-cyan)',
    bg: 'var(--agent-cyan-dim)',
  },
];

const CATEGORY_ICONS = {
  search: '\u2315',
  data: '\u25A6',
  compute: '\u2261',
  alert: '\u25C8',
};

function CapabilityCard({ cap, isActive, lastUsed }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: spacing[3],
        background: isActive ? cap.bg : 'var(--bg-surface)',
        border: `1px solid ${isActive ? cap.color : hovered ? 'var(--border-base)' : 'var(--border-dim)'}`,
        borderRadius: 8,
        transition: 'border-color 220ms cubic-bezier(0.33, 1, 0.68, 1), background 220ms cubic-bezier(0.33, 1, 0.68, 1), box-shadow 220ms cubic-bezier(0.33, 1, 0.68, 1), transform 220ms cubic-bezier(0.33, 1, 0.68, 1)',
        transform: hovered ? 'translateY(-1px)' : 'none',
        boxShadow: isActive
          ? undefined
          : hovered ? 'var(--shadow-xs)' : 'none',
        animation: isActive ? 'toolActive 1.5s ease-in-out infinite' : undefined,
        position: 'relative',
      }}
    >
      {/* Status indicator */}
      {(isActive || lastUsed) && (
        <div style={{ position: 'absolute', top: 8, right: 8 }}>
          {isActive ? (
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              border: '2px solid var(--mongo)',
              borderTopColor: 'transparent',
              animation: 'spin 0.8s linear infinite',
            }} />
          ) : (
            <span style={{ color: 'var(--mongo)', fontSize: 12, fontWeight: 700 }}>{'\u2713'}</span>
          )}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 14 }}>{CATEGORY_ICONS[cap.category] || '\u25C6'}</span>
        <span style={{
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13,
          color: 'var(--text-primary)',
        }}>
          {cap.label}
        </span>
      </div>

      {/* Technology badge */}
      <div style={{ marginBottom: 6 }}>
        <span style={{
          fontSize: 9, fontWeight: 600, textTransform: 'uppercase',
          color: cap.color, background: cap.bg,
          borderRadius: 4, padding: '1px 6px',
          fontFamily: 'var(--font-mono)',
        }}>
          {cap.technology}
        </span>
      </div>

      {/* Description */}
      <div style={{
        fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4,
        display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {cap.description}
      </div>

      {/* Last used */}
      {lastUsed && !isActive && (
        <div style={{
          marginTop: 6, fontSize: 9, fontFamily: 'var(--font-mono)',
          color: 'var(--text-dim)',
        }}>
          Last used: {new Date(lastUsed).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}

export default function AICapabilitiesPanel({ applicationId, activeTools, toolHistory, onSendMessage }) {
  const activeSet = useMemo(() => {
    const set = new Set();
    if (activeTools) {
      for (const t of activeTools) {
        if (t.label) set.add(t.label.toLowerCase());
        if (t.tool) set.add(t.tool.toLowerCase());
      }
    }
    return set;
  }, [activeTools]);

  const lastUsedMap = useMemo(() => {
    const map = {};
    if (toolHistory) {
      for (const t of toolHistory) {
        const key = (t.label || t.tool || '').toLowerCase();
        if (key) map[key] = t.timestamp || t.completedAt;
      }
    }
    return map;
  }, [toolHistory]);

  const suggestedQuestion = 'What are the lending policies for my property type?';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: spacing[2],
        padding: `${spacing[2]}px ${spacing[3]}px`,
        borderBottom: '1px solid var(--border-dim)',
        flexShrink: 0,
      }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12 }}>
          Personal Lending Assistant Capabilities
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
          {CAPABILITIES.length} tools available
        </span>

        <div style={{ flex: 1 }} />

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 9, color: 'var(--text-dim)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--border-dim)' }} /> Idle
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--mongo)', animation: 'pulse 1.5s infinite' }} /> Active
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ color: 'var(--mongo)', fontSize: 10, fontWeight: 700 }}>{'\u2713'}</span> Used
          </span>
        </div>
      </div>

      {/* Cards grid */}
      <div style={{
        flex: 1, overflowY: 'auto',
        padding: spacing[3],
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: spacing[2],
        }}>
          {CAPABILITIES.map((cap) => {
            const isActive = activeSet.has(cap.label.toLowerCase()) || activeSet.has(cap.id);
            const lastUsed = lastUsedMap[cap.label.toLowerCase()] || lastUsedMap[cap.id];
            return (
              <CapabilityCard
                key={cap.id}
                cap={cap}
                isActive={isActive}
                lastUsed={lastUsed}
              />
            );
          })}
        </div>

        {/* Suggested question */}
        <div style={{
          marginTop: spacing[3], textAlign: 'center',
          fontSize: 11, color: 'var(--text-dim)',
        }}>
          Tools activate as you chat with your Personal Lending Assistant. Try asking:
          <button
            type="button"
            onClick={() => onSendMessage?.(suggestedQuestion)}
            style={{
              display: 'inline-block',
              marginLeft: 6,
              padding: '3px 10px',
              borderRadius: 12,
              border: '1px solid var(--mongo)',
              background: 'var(--mongo-dim)',
              color: 'var(--mongo)',
              fontSize: 10,
              fontWeight: 600,
              fontFamily: 'var(--font-display)',
              cursor: 'pointer',
              transition: 'background 150ms ease',
            }}
          >
            &ldquo;{suggestedQuestion}&rdquo;
          </button>
        </div>
      </div>
    </div>
  );
}
