"use client";

import Icon from '@leafygreen-ui/icon';
import { uiTokens } from '../../lib/uiTokens';
import { spacing } from '@leafygreen-ui/tokens';

export default function ActivityFeed({ steps, stepIndex }) {
  const entries = [];
  let rCount = 0;
  let oCount = 0;
  let mCount = 0;
  for (let i = 0; i <= stepIndex && i < steps.length; i++) {
    const s = steps[i];
    if (s.reasoning) {
      rCount++;
      entries.push({
        type: 'reason',
        cls: s.reasoning.agent.toLowerCase().replace(/\s+/g, '-').replace('$', ''),
        glyph: s.reasoning.glyph,
        agent: s.reasoning.agent,
        text: s.reasoning.text,
        timing: s.reasoning.timing,
      });
    }
    (s.ops || []).forEach((op) => {
      oCount++;
      entries.push({ type: 'op', verb: op.verb, collection: op.collection, latency: op.latency });
    });
    if (s.memory) {
      mCount++;
      entries.push({
        type: 'mem',
        memType: s.memory.type,
        title: s.memory.title,
        detail: s.memory.detail,
      });
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3], height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        <div style={{ fontFamily: uiTokens.font, fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', marginBottom: spacing[2] }}>
          Agent Reasoning <span style={{ fontFamily: uiTokens.monoFont, padding: `2px ${spacing[150]}px`, background: 'var(--bg-overlay)', borderRadius: 8 }}>{rCount}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[150] }}>
          {entries.filter((e) => e.type === 'reason').map((e, i) => (
            <div
              key={`r-${i}`}
              style={{
                padding: `${spacing[200]}px ${spacing[300]}px`,
                borderRadius: 8,
                borderLeft: '3px solid var(--border-dim)',
                background: 'var(--bg-surface)',
                fontSize: 12,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing[1], fontWeight: 700, fontSize: 11 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: spacing[1] }}>{e.glyph && <Icon glyph={e.glyph} size={12} />} {e.agent}</span>
                <span style={{ color: 'var(--text-dim)' }}>{e.timing}</span>
              </div>
              <div style={{ color: 'var(--text-secondary)' }}>{e.text}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ maxHeight: 200, overflow: 'auto' }}>
        <div style={{ fontFamily: uiTokens.font, fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', marginBottom: spacing[2] }}>
          MongoDB Ops <span style={{ fontFamily: uiTokens.monoFont }}>{oCount}</span>
        </div>
        {entries.filter((e) => e.type === 'op').map((e, i) => (
          <div key={`o-${i}`} style={{ display: 'flex', gap: spacing[2], padding: `${spacing[150]}px 0`, fontSize: 11, borderBottom: '1px solid var(--border-dim)' }}>
            <span style={{ fontFamily: uiTokens.monoFont, fontWeight: 600, minWidth: 72 }}>{e.verb}</span>
            <span style={{ flex: 1, color: 'var(--text-secondary)' }}>{e.collection}</span>
            <span style={{ color: 'var(--text-dim)' }}>{e.latency}</span>
          </div>
        ))}
      </div>
      <div style={{ maxHeight: 140, overflow: 'auto' }}>
        <div style={{ fontFamily: uiTokens.font, fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', marginBottom: spacing[2] }}>
          Memory & Checkpoints <span style={{ fontFamily: uiTokens.monoFont }}>{mCount}</span>
        </div>
        {entries.filter((e) => e.type === 'mem').map((e, i) => (
          <div key={`m-${i}`} style={{ display: 'flex', gap: spacing[200], padding: `${spacing[2]}px 0`, fontSize: 11, borderBottom: '1px solid var(--border-dim)' }}>
            <Icon glyph={e.memType === 'checkpoint' ? 'Save' : 'Beaker'} size={12} />
            <div>
              <div style={{ fontWeight: 600 }}>{e.title}</div>
              <div style={{ color: 'var(--text-dim)', fontSize: 10 }}>{e.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
