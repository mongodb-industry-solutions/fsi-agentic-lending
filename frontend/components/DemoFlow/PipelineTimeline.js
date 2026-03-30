"use client";

import { useMemo, useEffect, useRef } from 'react';

const NODE_COLORS = {
  supervisor: '#00684A',
  appAgent: '#0891b2',
  underwriter: '#2563eb',
  renewalAgent: '#6341e0',
  creditAPI: '#64748b',
  voyageEmbed: '#6341e0',
  vectorSearch: '#6341e0',
  graphLookup: '#dc2626',
  hitlGate: '#d97706',
  decision: '#00684A',
  fundingEngine: '#059669',
  changeStream: '#059669',
  mongoAtlas: '#00684A',
  timeSeries: '#6341e0',
};

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
          icon: s.reasoning.icon,
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
      <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-dim)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
        Pipeline activity will appear here...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ height: 6, background: 'var(--border-dim)', borderRadius: 3, marginBottom: 6, flexShrink: 0, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${steps.length > 0 ? ((stepIndex + 1) / steps.length) * 100 : 0}%`,
          background: 'var(--mongo)',
          borderRadius: 2,
          transition: 'width 0.6s ease-out',
        }} />
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 0 6px', borderBottom: '1px solid var(--border-dim)', marginBottom: 6, flexShrink: 0,
      }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Pipeline Activity
        </div>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 9, padding: '2px 6px',
          background: 'var(--bg-raised)', borderRadius: 3, color: 'var(--text-dim)',
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
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  borderLeft: `3px solid ${e.color}`,
                  background: isHighlighted ? e.color + '14' : isLatest ? 'var(--bg-surface)' : 'var(--bg-surface)',
                  fontSize: 11,
                  transition: 'background 0.2s, box-shadow 0.2s',
                  boxShadow: isHighlighted ? `0 0 0 1px ${e.color}33` : 'none',
                  cursor: 'default',
                  animation: isLatest ? 'slideDown 0.25s ease-out' : undefined,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontWeight: 700, fontSize: 12 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>{e.icon}</span>
                    <span style={{ color: e.color }}>{e.agent}</span>
                  </span>
                  <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>{e.timing}</span>
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
                  display: 'flex', gap: 6, padding: '5px 10px', fontSize: 12,
                  borderLeft: `3px solid ${e.color}33`,
                  borderRadius: 'var(--radius-sm)',
                  background: isHighlighted ? e.color + '0a' : 'transparent',
                  transition: 'background 0.2s',
                  animation: isLatest ? 'slideDown 0.2s ease-out' : undefined,
                }}
              >
                <span style={{ fontSize: 9, marginTop: 1 }}>🗄</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, minWidth: 60, color: 'var(--mongo)' }}>{e.verb}</span>
                <span style={{ flex: 1, color: 'var(--text-secondary)', fontSize: 11 }}>{e.collection}</span>
                <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>{e.latency}</span>
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
                  display: 'flex', gap: 8, padding: '6px 10px', fontSize: 12,
                  borderLeft: `3px solid ${e.color}`,
                  borderRadius: 'var(--radius-sm)',
                  background: isHighlighted ? e.color + '14' : e.color + '08',
                  transition: 'background 0.2s',
                  animation: isLatest ? 'slideDown 0.25s ease-out' : undefined,
                }}
              >
                <span style={{ fontSize: 11 }}>{e.memType === 'checkpoint' ? '💾' : '🧠'}</span>
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
