"use client";

import { useMemo, useEffect, useRef } from 'react';
import Icon from '@leafygreen-ui/icon';
import { NODE_COLORS } from '../../lib/data/nodeColors';
import { uiTokens } from '../../lib/uiTokens';
import { spacing } from '@leafygreen-ui/tokens';

export default function PipelineTimeline({
  steps,
  stepIndex,
  onEntryHover = null,
  highlightNodeId = null,
}) {
  const scrollRef = useRef(null);

  const entries = useMemo(() => {
    const result = [];
    for (let i = 0; i <= stepIndex && i < steps.length; i++) {
      const s = steps[i];
      if (s.reasoning) {
        const nodeId = s.focusNode || null;
        result.push({
          type: 'reason',
          glyph: s.reasoning.glyph,
          agent: s.reasoning.agent,
          text: s.reasoning.text,
          timing: s.reasoning.timing,
          nodeId,
          color: nodeId ? NODE_COLORS[nodeId] : 'var(--text-dim)',
          stepIdx: i,
        });
      }
      (s.ops || []).forEach((op) => {
        result.push({
          type: 'op',
          verb: op.verb,
          collection: op.collection,
          latency: op.latency,
          nodeId: 'mongoAtlas',
          color: NODE_COLORS.mongoAtlas,
          stepIdx: i,
        });
      });
      if (s.memory) {
        result.push({
          type: 'mem',
          memType: s.memory.type,
          title: s.memory.title,
          detail: s.memory.detail,
          nodeId: s.memory.type === 'checkpoint' ? 'checkpoint' : 'memory',
          color: s.memory.type === 'checkpoint' ? NODE_COLORS.hitlGate : NODE_COLORS.mongoAtlas,
          stepIdx: i,
        });
      }
    }
    return result;
  }, [steps, stepIndex]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length]);

  if (entries.length === 0) {
    return (
      <div style={{ padding: spacing[3], textAlign: 'center', color: 'var(--text-dim)', fontSize: 11, fontFamily: uiTokens.monoFont }}>
        Pipeline activity will appear here...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ height: 6, background: 'var(--border-dim)', borderRadius: 8, marginBottom: spacing[150], flexShrink: 0, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${steps.length > 0 ? ((stepIndex + 1) / steps.length) * 100 : 0}%`,
          background: 'var(--mongo)',
          borderRadius: 8,
          transition: 'width 400ms cubic-bezier(0.33, 1, 0.68, 1)',
        }} />
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: `${spacing[2]}px 0 ${spacing[150]}px`, borderBottom: '1px solid var(--border-dim)', marginBottom: spacing[150], flexShrink: 0,
      }}>
        <div style={{ fontFamily: uiTokens.font, fontWeight: 700, fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Pipeline Activity
        </div>
        <span style={{
          fontFamily: uiTokens.monoFont, fontSize: 9, padding: `2px ${spacing[150]}px`,
          background: 'var(--bg-raised)', borderRadius: 8, color: 'var(--text-dim)',
        }}>
          {entries.length} entries
        </span>
      </div>
      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {entries.map((e, i) => {
          const isHighlighted = highlightNodeId && e.nodeId === highlightNodeId;
          const isLatest = i === entries.length - 1;

          if (e.type === 'reason') {
            return (
              <div
                key={`r-${i}`}
                data-node-id={e.nodeId}
                onMouseEnter={() => onEntryHover && onEntryHover(e.nodeId)}
                onMouseLeave={() => onEntryHover && onEntryHover(null)}
                style={{
                  padding: `${spacing[2]}px ${spacing[200]}px`,
                  borderRadius: 8,
                  borderLeft: `3px solid ${e.color}`,
                  background: isHighlighted ? e.color + '14' : isLatest ? 'var(--bg-surface)' : 'var(--bg-surface)',
                  fontSize: 11,
                  transition: 'background 150ms cubic-bezier(0.33, 1, 0.68, 1), box-shadow 150ms cubic-bezier(0.33, 1, 0.68, 1)',
                  boxShadow: isHighlighted ? `0 0 0 1px ${e.color}33` : 'none',
                  cursor: 'default',
                  animation: isLatest ? 'slideDown 220ms cubic-bezier(0.33, 1, 0.68, 1)' : undefined,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontWeight: 700, fontSize: 12 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: spacing[1] }}>
                    {e.glyph && <Icon glyph={e.glyph} size={12} fill={e.color} />}
                    <span style={{ color: e.color }}>{e.agent}</span>
                  </span>
                  <span style={{ color: 'var(--text-dim)', fontFamily: uiTokens.monoFont, fontSize: 10 }}>{e.timing}</span>
                </div>
                <div style={{ color: 'var(--text-secondary)', lineHeight: 1.4, fontSize: 12 }}>{e.text}</div>
              </div>
            );
          }

          if (e.type === 'op') {
            return (
              <div
                key={`o-${i}`}
                data-node-id={e.nodeId}
                onMouseEnter={() => onEntryHover && onEntryHover(e.nodeId)}
                onMouseLeave={() => onEntryHover && onEntryHover(null)}
                style={{
                  display: 'flex', gap: spacing[150], padding: `5px ${spacing[200]}px`, fontSize: 12,
                  borderLeft: `3px solid ${e.color}33`,
                  borderRadius: 8,
                  background: isHighlighted ? e.color + '0a' : 'transparent',
                  transition: 'background 150ms cubic-bezier(0.33, 1, 0.68, 1)',
                  animation: isLatest ? 'slideDown 220ms cubic-bezier(0.33, 1, 0.68, 1)' : undefined,
                }}
              >
                <Icon glyph="Database" size={10} fill={e.color} />
                <span style={{ fontFamily: uiTokens.monoFont, fontWeight: 600, minWidth: 60, color: 'var(--mongo)' }}>{e.verb}</span>
                <span style={{ flex: 1, color: 'var(--text-secondary)', fontSize: 11 }}>{e.collection}</span>
                <span style={{ color: 'var(--text-dim)', fontFamily: uiTokens.monoFont, fontSize: 10 }}>{e.latency}</span>
              </div>
            );
          }

          if (e.type === 'mem') {
            return (
              <div
                key={`m-${i}`}
                data-node-id={e.nodeId}
                onMouseEnter={() => onEntryHover && onEntryHover(e.nodeId)}
                onMouseLeave={() => onEntryHover && onEntryHover(null)}
                style={{
                  display: 'flex', gap: spacing[2], padding: `${spacing[150]}px ${spacing[200]}px`, fontSize: 12,
                  borderLeft: `3px solid ${e.color}`,
                  borderRadius: 8,
                  background: isHighlighted ? e.color + '14' : e.color + '08',
                  transition: 'background 150ms cubic-bezier(0.33, 1, 0.68, 1)',
                  animation: isLatest ? 'slideDown 220ms cubic-bezier(0.33, 1, 0.68, 1)' : undefined,
                }}
              >
                <Icon glyph={e.memType === 'checkpoint' ? 'Save' : 'Beaker'} size={12} fill={e.color} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 12, color: e.color }}>{e.title}</div>
                  <div style={{ color: 'var(--text-dim)', fontSize: 10 }}>{e.detail}</div>
                </div>
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}
