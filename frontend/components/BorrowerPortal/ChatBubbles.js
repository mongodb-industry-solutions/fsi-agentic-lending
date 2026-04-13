"use client";

import { useState } from 'react';
import { spacing } from '@leafygreen-ui/tokens';

export function renderInline(text) {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (/^\*\*(.+)\*\*$/.test(part)) {
      const inner = part.match(/^\*\*(.+)\*\*$/)[1];
      return <strong key={idx}>{inner}</strong>;
    }
    if (/^`([^`]+)`$/.test(part)) {
      const inner = part.match(/^`([^`]+)`$/)[1];
      return (
        <code key={idx} style={{
          fontFamily: 'var(--font-mono)', fontSize: '0.9em',
          background: 'var(--bg-raised)', padding: '1px 4px',
          borderRadius: 3, border: '1px solid var(--border-dim)',
        }}>
          {inner}
        </code>
      );
    }
    return part;
  });
}

export function renderMessageContent(text) {
  if (!text) return null;

  const lines = text.split('\n');
  const elements = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const key = `line-${i}`;

    if (/^---+$/.test(line.trim()) || /^\*\*\*+$/.test(line.trim())) {
      elements.push(
        <hr key={key} style={{ border: 'none', borderTop: '1px solid var(--border-dim)', margin: '8px 0' }} />
      );
      continue;
    }

    if (/^### (.+)/.test(line)) {
      const match = line.match(/^### (.+)/);
      elements.push(
        <div key={key} style={{ fontWeight: 600, fontSize: 12, marginTop: i > 0 ? 5 : 0, marginBottom: 2, color: 'var(--text-primary)' }}>
          {renderInline(match[1])}
        </div>
      );
      continue;
    }

    if (/^## (.+)/.test(line)) {
      const match = line.match(/^## (.+)/);
      elements.push(
        <div key={key} style={{ fontWeight: 700, fontSize: 13, marginTop: i > 0 ? 6 : 0, marginBottom: 2 }}>
          {renderInline(match[1])}
        </div>
      );
      continue;
    }

    if (/^# (.+)/.test(line)) {
      const match = line.match(/^# (.+)/);
      elements.push(
        <div key={key} style={{ fontWeight: 700, fontSize: 15, marginTop: i > 0 ? 8 : 0, marginBottom: 4 }}>
          {renderInline(match[1])}
        </div>
      );
      continue;
    }

    if (/^\d+\.\s+(.+)/.test(line)) {
      const match = line.match(/^(\d+)\.\s+(.+)/);
      elements.push(
        <div key={key} style={{ paddingLeft: 20, position: 'relative', marginTop: 2, marginBottom: 2 }}>
          <span style={{ position: 'absolute', left: 0, fontWeight: 600, fontSize: 12, color: 'var(--text-secondary)' }}>
            {match[1]}.
          </span>
          {renderInline(match[2])}
        </div>
      );
      continue;
    }

    if (/^\s{2,}[-*] (.+)/.test(line)) {
      const match = line.match(/^\s{2,}[-*] (.+)/);
      elements.push(
        <div key={key} style={{ paddingLeft: 28, position: 'relative', marginTop: 1, marginBottom: 1 }}>
          <span style={{ position: 'absolute', left: 16, fontSize: 10, color: 'var(--text-dim)' }}>{'\u25E6'}</span>
          {renderInline(match[1])}
        </div>
      );
      continue;
    }

    if (/^[-*] (.+)/.test(line)) {
      const match = line.match(/^[-*] (.+)/);
      elements.push(
        <div key={key} style={{ paddingLeft: 16, position: 'relative', marginTop: 2, marginBottom: 2 }}>
          <span style={{ position: 'absolute', left: 4 }}>{'\u2022'}</span>
          {renderInline(match[1])}
        </div>
      );
      continue;
    }

    if (line.trim() === '') {
      elements.push(<div key={key} style={{ height: 6 }} />);
      continue;
    }

    elements.push(
      <div key={key} style={{ marginTop: 1, marginBottom: 1 }}>
        {renderInline(line)}
      </div>
    );
  }

  return elements;
}

export function StreamingBubble({ content }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'flex-start',
      padding: `${spacing[1]}px 0`,
    }}>
      <div style={{
        maxWidth: '85%',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-dim)',
        borderRadius: 8,
        padding: `${spacing[2]}px ${spacing[3]}px`,
        fontSize: 13, lineHeight: 1.6, color: 'var(--text-primary)',
        position: 'relative',
      }}>
        {renderMessageContent(content)}
        <span style={{
          display: 'inline-block', width: 2, height: 14,
          background: 'var(--mongo)', marginLeft: 2,
          animation: 'pulse 1s infinite', verticalAlign: 'text-bottom',
        }} />
      </div>
    </div>
  );
}

export function TypingIndicator() {
  const dotStyle = (delay) => ({
    width: 6, height: 6, borderRadius: '50%',
    background: 'var(--text-dim)',
    animation: `typingDot 1.4s ease-in-out ${delay}s infinite`,
  });

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', padding: `${spacing[2]}px 0` }}>
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-dim)',
        borderRadius: 8, padding: `${spacing[2]}px ${spacing[3]}px`,
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        <div style={dotStyle(0)} />
        <div style={dotStyle(0.2)} />
        <div style={dotStyle(0.4)} />
      </div>
    </div>
  );
}

export function ContextGathering({ tools, collapsed }) {
  if (!tools || tools.length === 0) return null;

  if (collapsed) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: `4px ${spacing[3]}px`,
        fontSize: 10, color: 'var(--text-dim)',
        fontFamily: 'var(--font-mono)',
      }}>
        <span style={{
          width: 5, height: 5, borderRadius: '50%',
          background: 'var(--agent-cyan)', flexShrink: 0,
        }} />
        {tools.length} source{tools.length !== 1 ? 's' : ''} checked
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start',
      padding: `${spacing[2]}px 0`,
    }}>
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--agent-cyan)',
        borderRadius: 8, padding: `${spacing[2]}px ${spacing[3]}px`,
        minWidth: 180, maxWidth: '85%',
      }}>
        <div style={{
          fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.05em', color: 'var(--agent-cyan)',
          fontFamily: 'var(--font-display)', marginBottom: 4,
        }}>
          Gathering context
        </div>
        {tools.map((tool, idx) => (
          <div
            key={`${tool.tool}-${idx}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '3px 0',
              animation: `thinkingFade 200ms cubic-bezier(0.33, 1, 0.68, 1) ${idx * 80}ms both`,
            }}
          >
            <span style={{
              width: 5, height: 5, borderRadius: '50%',
              background: tool.found != null ? 'var(--success)' : 'var(--agent-cyan)',
              animation: tool.found != null ? 'none' : 'pulse 1.5s infinite',
              flexShrink: 0,
            }} />
            <span style={{
              fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.3,
            }}>
              {tool.label}
            </span>
            {tool.found != null && (
              <span style={{
                fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600,
                color: 'var(--success)',
                animation: `toolCheckIn 200ms cubic-bezier(0.33, 1, 0.68, 1) both`,
              }}>
                {'\u2713'}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CitationCard({ citations }) {
  const [expanded, setExpanded] = useState(false);

  if (!citations || citations.length === 0) return null;

  return (
    <div style={{ padding: `2px 0 ${spacing[1]}px` }}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '2px 0', font: 'inherit',
        }}
      >
        <span style={{
          fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.04em', color: 'var(--voyage)',
          fontFamily: 'var(--font-display)',
        }}>
          {citations.length} polic{citations.length !== 1 ? 'ies' : 'y'} referenced
        </span>
        <span style={{
          fontSize: 10, color: 'var(--text-dim)',
          transform: expanded ? 'rotate(180deg)' : 'rotate(0)',
          transition: 'transform 150ms ease', display: 'inline-block',
        }}>
          {'\u25BE'}
        </span>
      </button>
      {expanded && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4,
          animation: 'thinkingFade 200ms cubic-bezier(0.33, 1, 0.68, 1) both',
        }}>
          {citations.map((c, idx) => (
            <div key={idx} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 8px', borderRadius: 6,
              background: 'var(--voyage-dim)',
              border: '1px solid var(--voyage-dim)',
            }}>
              <span style={{ fontSize: 11 }}>{'\uD83D\uDCC4'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 10, fontWeight: 600, color: 'var(--text-primary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {c.title}
                </div>
                {c.section && (
                  <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>
                    {c.section}
                  </div>
                )}
              </div>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: c.score > 0.7 ? 'var(--success)' : 'var(--hitl-amber)',
                flexShrink: 0,
              }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function MessageBubble({ message }) {
  const isUser = message.role === 'user';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      padding: `${spacing[1]}px 0`,
    }}>
      <div style={{
        maxWidth: '85%',
        background: isUser ? 'var(--mongo-dim)' : 'var(--bg-surface)',
        border: isUser ? '1px solid var(--mongo)' : '1px solid var(--border-dim)',
        borderRadius: 8,
        padding: `${spacing[2]}px ${spacing[3]}px`,
        fontSize: 13, lineHeight: 1.6, color: 'var(--text-primary)',
      }}>
        {renderMessageContent(message.content)}
        {!isUser && message.toolsMeta && message.toolsMeta.length > 0 && (
          <div style={{
            marginTop: 6, paddingTop: 4,
            borderTop: '1px solid var(--border-dim)',
            fontSize: 9, color: 'var(--text-dim)',
            fontFamily: 'var(--font-mono)',
          }}>
            {message.toolsMeta.length} source{message.toolsMeta.length !== 1 ? 's' : ''} consulted
          </div>
        )}
      </div>
      {!isUser && message.citations && message.citations.length > 0 && (
        <div style={{ maxWidth: '85%' }}>
          <CitationCard citations={message.citations} />
        </div>
      )}
    </div>
  );
}
