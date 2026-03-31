"use client";

import { useState } from 'react';

const LEVELS = [
  { id: 'observe', label: 'Observe Only', description: 'Agent suggests but takes no action. You control every step.' },
  { id: 'suggest', label: 'Suggest & Confirm', description: 'Agent plans and proposes. You approve before execution.' },
  { id: 'bounded', label: 'Act Within Limits', description: 'Agent executes within policy bounds. Escalates edge cases.' },
  { id: 'auto', label: 'Full Auto', description: 'Agent handles end-to-end autonomously.' },
];

export default function AutonomyDial({ value, onChange }) {
  const [hoveredLevel, setHoveredLevel] = useState(null);
  const displayLevel = hoveredLevel !== null
    ? LEVELS[hoveredLevel]
    : LEVELS.find((l) => l.id === value);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 12px',
      background: 'var(--bg-surface)',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border-dim)',
      gridColumn: '1 / -1',
    }}>
      <div style={{
        fontSize: 9,
        color: 'var(--text-dim)',
        textTransform: 'uppercase',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        letterSpacing: '0.5px',
      }}>
        Agent Autonomy
      </div>

      <div style={{
        display: 'flex',
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
        border: '1px solid var(--border-dim)',
      }}>
        {LEVELS.map((level, i) => {
          const isActive = value === level.id;
          return (
            <button
              key={level.id}
              type="button"
              onClick={() => onChange(level.id)}
              onMouseEnter={() => setHoveredLevel(i)}
              onMouseLeave={() => setHoveredLevel(null)}
              style={{
                padding: '5px 10px',
                border: 'none',
                borderRight: i < LEVELS.length - 1 ? '1px solid var(--border-dim)' : 'none',
                background: isActive ? 'var(--agent-cyan-dim)' : 'var(--bg-base)',
                color: isActive ? 'var(--agent-cyan)' : 'var(--text-secondary)',
                fontFamily: 'var(--font-display)',
                fontWeight: isActive ? 700 : 500,
                fontSize: 10,
                cursor: 'pointer',
                transition: 'background 0.15s, color 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {level.label}
            </button>
          );
        })}
      </div>

      {displayLevel && (
        <div style={{
          fontSize: 9,
          color: 'var(--text-dim)',
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
        }}>
          {displayLevel.description}
        </div>
      )}
    </div>
  );
}
