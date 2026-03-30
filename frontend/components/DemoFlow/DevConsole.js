"use client";

import { useState, useMemo } from 'react';

const TABS = ['Agent Reasoning', 'MongoDB Ops', 'Memory & Checkpoints'];

export default function DevConsole({ steps, stepIndex }) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  const entries = useMemo(() => {
    const result = { reason: [], op: [], mem: [] };
    for (let i = 0; i <= stepIndex && i < steps.length; i++) {
      const s = steps[i];
      if (s.reasoning) {
        result.reason.push({
          icon: s.reasoning.icon,
          agent: s.reasoning.agent,
          text: s.reasoning.text,
          timing: s.reasoning.timing,
        });
      }
      (s.ops || []).forEach((op) => {
        result.op.push({ verb: op.verb, collection: op.collection, latency: op.latency });
      });
      if (s.memory) {
        result.mem.push({
          memType: s.memory.type,
          title: s.memory.title,
          detail: s.memory.detail,
        });
      }
    }
    return result;
  }, [steps, stepIndex]);

  const counts = [entries.reason.length, entries.op.length, entries.mem.length];

  return (
    <div
      style={{
        borderTop: '1px solid var(--border-dim)',
        background: 'var(--bg-base)',
        transition: 'height 0.25s ease',
        height: expanded ? 240 : 36,
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((p) => !p)}
        onKeyDown={(e) => e.key === 'Enter' && setExpanded((p) => !p)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 36,
          padding: '0 16px',
          cursor: 'pointer',
          userSelect: 'none',
          background: 'var(--bg-surface)',
          borderBottom: expanded ? '1px solid var(--border-dim)' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--text-dim)' }}>
            Developer Console
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)', padding: '1px 6px', background: 'var(--bg-raised)', borderRadius: 3 }}>
            {counts[0] + counts[1] + counts[2]} entries
          </span>
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-dim)', transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▲</span>
      </div>

      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', height: 204 }}>
          <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border-dim)' }}>
            {TABS.map((tab, i) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(i)}
                style={{
                  padding: '6px 14px',
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: 'var(--font-display)',
                  border: 'none',
                  borderBottom: activeTab === i ? '2px solid var(--mongo)' : '2px solid transparent',
                  background: 'transparent',
                  color: activeTab === i ? 'var(--text-primary)' : 'var(--text-dim)',
                  cursor: 'pointer',
                }}
              >
                {tab} <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>({counts[i]})</span>
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
            {activeTab === 0 && entries.reason.map((e, i) => (
              <div
                key={i}
                style={{
                  padding: '8px 12px',
                  marginBottom: 4,
                  borderRadius: 'var(--radius-sm)',
                  borderLeft: '3px solid var(--border-dim)',
                  background: 'var(--bg-surface)',
                  fontSize: 11,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2, fontWeight: 700 }}>
                  <span>{e.icon} {e.agent}</span>
                  <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>{e.timing}</span>
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>{e.text}</div>
              </div>
            ))}

            {activeTab === 1 && entries.op.map((e, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', fontSize: 11, borderBottom: '1px solid var(--border-dim)' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, minWidth: 72, color: 'var(--mongo)' }}>{e.verb}</span>
                <span style={{ flex: 1, color: 'var(--text-secondary)' }}>{e.collection}</span>
                <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{e.latency}</span>
              </div>
            ))}

            {activeTab === 2 && entries.mem.map((e, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 0', fontSize: 11, borderBottom: '1px solid var(--border-dim)' }}>
                <span>{e.memType === 'checkpoint' ? '💾' : '🧠'}</span>
                <div>
                  <div style={{ fontWeight: 600 }}>{e.title}</div>
                  <div style={{ color: 'var(--text-dim)', fontSize: 10 }}>{e.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
