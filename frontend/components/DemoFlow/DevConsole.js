"use client";

import { useState, useMemo } from 'react';
import Icon from '@leafygreen-ui/icon';
import { uiTokens } from '../../lib/uiTokens';
import { spacing } from '@leafygreen-ui/tokens';

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
          glyph: s.reasoning.glyph,
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
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setExpanded((p) => !p))}
        onFocus={(e) => { e.currentTarget.style.boxShadow = uiTokens.focusRing; }}
        onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 36,
          padding: `0 ${spacing[3]}px`,
          cursor: 'pointer',
          userSelect: 'none',
          background: 'var(--bg-surface)',
          borderBottom: expanded ? '1px solid var(--border-dim)' : 'none',
          outline: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
          <span style={{ fontFamily: uiTokens.monoFont, fontSize: 11, fontWeight: 700, color: 'var(--text-dim)' }}>
            Developer Console
          </span>
          <span style={{ fontFamily: uiTokens.monoFont, fontSize: 10, color: 'var(--text-dim)', padding: `1px ${spacing[150]}px`, background: 'var(--bg-raised)', borderRadius: 8 }}>
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
                onFocus={(e) => { e.currentTarget.style.boxShadow = uiTokens.focusRing; }}
                onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
                style={{
                  padding: `${spacing[150]}px ${spacing[300]}px`,
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: uiTokens.font,
                  border: 'none',
                  borderBottom: activeTab === i ? '2px solid var(--mongo)' : '2px solid transparent',
                  background: 'transparent',
                  color: activeTab === i ? 'var(--text-primary)' : 'var(--text-dim)',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                {tab} <span style={{ fontFamily: uiTokens.monoFont, fontSize: 10 }}>({counts[i]})</span>
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: `${spacing[2]}px ${spacing[3]}px` }}>
            {activeTab === 0 && entries.reason.map((e, i) => (
              <div
                key={i}
                style={{
                  padding: `${spacing[2]}px ${spacing[3]}px`,
                  marginBottom: spacing[1],
                  borderRadius: 8,
                  borderLeft: '3px solid var(--border-dim)',
                  background: 'var(--bg-surface)',
                  fontSize: 11,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2, fontWeight: 700 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: spacing[1] }}>{e.glyph && <Icon glyph={e.glyph} size={12} />} {e.agent}</span>
                  <span style={{ color: 'var(--text-dim)', fontFamily: uiTokens.monoFont, fontSize: 10 }}>{e.timing}</span>
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>{e.text}</div>
              </div>
            ))}

            {activeTab === 1 && entries.op.map((e, i) => (
              <div key={i} style={{ display: 'flex', gap: spacing[2], padding: '5px 0', fontSize: 11, borderBottom: '1px solid var(--border-dim)' }}>
                <span style={{ fontFamily: uiTokens.monoFont, fontWeight: 600, minWidth: 72, color: 'var(--mongo)' }}>{e.verb}</span>
                <span style={{ flex: 1, color: 'var(--text-secondary)' }}>{e.collection}</span>
                <span style={{ color: 'var(--text-dim)', fontFamily: uiTokens.monoFont }}>{e.latency}</span>
              </div>
            ))}

            {activeTab === 2 && entries.mem.map((e, i) => (
              <div key={i} style={{ display: 'flex', gap: spacing[200], padding: `${spacing[150]}px 0`, fontSize: 11, borderBottom: '1px solid var(--border-dim)' }}>
                <Icon glyph={e.memType === 'checkpoint' ? 'Save' : 'Beaker'} size={12} />
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
