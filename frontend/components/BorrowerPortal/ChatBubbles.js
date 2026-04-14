"use client";

import { useState } from 'react';
import { spacing } from '@leafygreen-ui/tokens';
import GenerativeComponent from './generative/ComponentRegistry';

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
    const totalFound = tools.reduce((s, t) => s + (t.found || 0), 0);
    const totalMs = tools.reduce((s, t) => s + (t.elapsed_ms || 0), 0);
    const parts = [`${tools.length} tool${tools.length !== 1 ? 's' : ''}`];
    if (totalFound > 0) parts.push(`${totalFound} sources`);
    if (totalMs > 0) parts.push(`${totalMs}ms`);
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
        {parts.join(' \u00B7 ')}
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
              fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.3, flex: 1,
            }}>
              {tool.label}
              {tool.found != null && tool.found > 0 && (
                <span style={{ fontSize: 8, color: 'var(--text-dim)', marginLeft: 4, fontFamily: 'var(--font-mono)' }}>
                  {tool.found} found
                </span>
              )}
            </span>
            {tool.elapsed_ms != null && (
              <span style={{ fontSize: 8, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                {tool.elapsed_ms}ms
              </span>
            )}
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

const SOURCE_BADGE_MAP = [
  { tool: 'application_status', label: 'Your application', color: 'var(--mongo)', bg: 'var(--mongo-dim)', border: 'var(--mongo-glow)' },
  { tool: 'policy_search', label: 'Lending policies', color: 'var(--voyage)', bg: 'var(--voyage-dim)', border: 'var(--voyage-glow)' },
  { tool: 'document_inventory', label: 'Your documents', color: 'var(--tool-blue)', bg: 'var(--tool-blue-dim)', border: 'var(--tool-blue-border)' },
  { tool: 'document_requirements', label: 'Requirements', color: 'var(--agent-cyan)', bg: 'var(--agent-cyan-dim)', border: 'var(--agent-cyan-dim)' },
  { tool: 'interventions', label: 'Action items', color: 'var(--hitl-amber)', bg: 'var(--hitl-amber-dim)', border: 'var(--hitl-amber-glow)' },
];

function SourceBadge({ label, color, bg, border }) {
  return (
    <span style={{
      fontSize: 8, fontWeight: 600, padding: '1px 5px', borderRadius: 3,
      background: bg, color, border: `1px solid ${border}`,
      fontFamily: 'var(--font-display)',
    }}>
      {label}
    </span>
  );
}

export function MessageBubble({ message }) {
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const isUser = message.role === 'user';

  // System messages (status change notifications)
  if (message.role === 'system') {
    return (
      <div style={{
        textAlign: 'center', padding: '8px 0',
        animation: 'genUISlideIn 0.3s ease both',
      }}>
        <span style={{
          fontSize: 10, color: 'var(--text-dim)',
          fontFamily: 'var(--font-display)', fontWeight: 500,
          padding: '3px 10px', borderRadius: 10,
          background: 'var(--bg-surface)', border: '1px solid var(--border-dim)',
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          <span style={{
            width: 5, height: 5, borderRadius: '50%',
            background: 'var(--agent-cyan)',
          }} />
          {message.content}
        </span>
      </div>
    );
  }

  // Source badges for assistant messages
  const sourceBadges = !isUser && message.toolsMeta
    ? SOURCE_BADGE_MAP.filter(b => message.toolsMeta.some(t => t.tool === b.tool))
    : [];

  // Enhanced tech footer
  const techFooter = !isUser && message.toolsMeta && message.toolsMeta.length > 0
    ? (() => {
      const totalMs = message.toolsMeta.reduce((s, t) => s + (t.elapsed_ms || 0), 0);
      const totalSources = message.toolsMeta.reduce((s, t) => s + (t.found || 0), 0);
      const hasVector = message.toolsMeta.some(t => t.tool === 'policy_search');
      const parts = [`${message.toolsMeta.length} queries`];
      if (hasVector) parts.push('1 vector search');
      if (totalMs > 0) parts.push(`${totalMs}ms`);
      return parts.join(' \u00B7 ');
    })()
    : null;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      padding: `${spacing[1]}px 0`,
    }}>
      <div style={{
        display: 'flex', gap: 6, alignItems: 'flex-start',
        maxWidth: '88%',
        flexDirection: isUser ? 'row-reverse' : 'row',
      }}>
        {/* Agent avatar */}
        {!isUser && (
          <div style={{
            width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
            background: 'var(--mongo)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', marginTop: 2,
          }}>
            <span style={{ fontSize: 8, color: '#fff', fontWeight: 800, fontFamily: 'var(--font-display)' }}>AI</span>
          </div>
        )}

        <div style={{ minWidth: 0, maxWidth: '100%' }}>
          <div style={{
            background: isUser ? 'var(--mongo-dim)' : 'var(--bg-surface)',
            border: isUser ? '1px solid var(--mongo)' : '1px solid var(--border-dim)',
            borderRadius: 8,
            padding: `${spacing[2]}px ${spacing[3]}px`,
            fontSize: 13, lineHeight: 1.6, color: 'var(--text-primary)',
          }}>
            {renderMessageContent(message.content)}
            {!isUser && message.uiComponents && message.uiComponents.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {message.uiComponents.map((comp) => (
                  <GenerativeComponent
                    key={comp.id}
                    component={comp.component}
                    data={comp.data}
                    id={comp.id}
                    status={comp.status}
                  />
                ))}
              </div>
            )}
            {techFooter && (
              <div style={{
                marginTop: 6, paddingTop: 4,
                borderTop: '1px solid var(--border-dim)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                  {techFooter}
                </span>
                {message.toolsMeta && message.toolsMeta.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setReasoningOpen(p => !p)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 9, color: 'var(--agent-cyan)', fontWeight: 600,
                      fontFamily: 'var(--font-display)', padding: 0,
                    }}
                  >
                    {reasoningOpen ? 'Hide' : 'View reasoning'}
                  </button>
                )}
              </div>
            )}
            {reasoningOpen && message.toolsMeta && (
              <div style={{
                marginTop: 4, padding: '6px 8px', borderRadius: 4,
                background: 'var(--bg-base)', border: '1px solid var(--border-dim)',
                fontSize: 9, color: 'var(--text-secondary)',
                animation: 'genUISlideIn 0.2s ease both',
              }}>
                <div style={{
                  fontSize: 8, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.04em', color: 'var(--agent-cyan)',
                  fontFamily: 'var(--font-display)', marginBottom: 4,
                }}>
                  Context sources
                </div>
                {message.toolsMeta.map((t, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0',
                  }}>
                    <span style={{
                      width: 4, height: 4, borderRadius: '50%',
                      background: 'var(--success)', flexShrink: 0,
                    }} />
                    <span style={{ flex: 1 }}>{t.label}</span>
                    {t.found != null && (
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
                        {t.found} result{t.found !== 1 ? 's' : ''}
                      </span>
                    )}
                    {t.elapsed_ms != null && (
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
                        {t.elapsed_ms}ms
                      </span>
                    )}
                  </div>
                ))}
                {message.citations && message.citations.length > 0 && (
                  <div style={{ marginTop: 4, paddingTop: 4, borderTop: '1px solid var(--border-dim)' }}>
                    <div style={{
                      fontSize: 8, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.04em', color: 'var(--voyage)',
                      fontFamily: 'var(--font-display)', marginBottom: 2,
                    }}>
                      Policy citations
                    </div>
                    {message.citations.map((c, ci) => (
                      <div key={ci} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '1px 0' }}>
                        <span style={{
                          width: 4, height: 4, borderRadius: '50%',
                          background: c.score > 0.7 ? 'var(--success)' : 'var(--hitl-amber)',
                          flexShrink: 0,
                        }} />
                        <span>{c.title}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginLeft: 'auto' }}>
                          {(c.score * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Source badges */}
          {sourceBadges.length > 0 && (
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 3, paddingLeft: 2 }}>
              {sourceBadges.map(b => (
                <SourceBadge key={b.tool} label={b.label} color={b.color} bg={b.bg} border={b.border} />
              ))}
            </div>
          )}

          {/* Citations */}
          {!isUser && message.citations && message.citations.length > 0 && (
            <CitationCard citations={message.citations} />
          )}
        </div>
      </div>
    </div>
  );
}
