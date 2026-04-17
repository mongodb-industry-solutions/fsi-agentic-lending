"use client";

import { useState, useEffect } from 'react';
import { spacing } from '@leafygreen-ui/tokens';
import GenerativeComponent from './generative/ComponentRegistry';
import { CAPABILITY_TILES, PRE_APP_TILES, COMPONENT_DISPLAY_NAMES, CAPABILITIES_INFO } from './chatConstants';

export function renderInline(text) {
  if (!text) return null;
  // UX 4: added markdown link handling \u2014 `[text](url)` \u2014 alongside
  // the existing bold and inline-code tokens. Split pattern keeps the three
  // alternations mutually exclusive so a URL containing asterisks doesn't get
  // partially matched.
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g);
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
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
    if (linkMatch) {
      const [, linkText, href] = linkMatch;
      // Only follow http(s) or relative links \u2014 reject javascript:, data:
      // and similar to stay safe against a misbehaving LLM output.
      const safe = /^(https?:|\/|\.\/|\#)/i.test(href);
      if (!safe) return linkText;
      return (
        <a
          key={idx}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: 'var(--mongo)', textDecoration: 'underline',
            textUnderlineOffset: 2,
          }}
        >
          {linkText}
        </a>
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

    // UX 4: fenced code blocks (``` optionally followed by a language). Buffer
    // everything up to the matching closing fence and emit a single <pre>.
    // If no closing fence appears, eat the remainder so half-streamed tokens
    // render as code rather than as literal ``` + content.
    const fenceOpen = line.trim().match(/^```(\w*)$/);
    if (fenceOpen) {
      const codeLines = [];
      let j = i + 1;
      while (j < lines.length && !/^```\s*$/.test(lines[j].trim())) {
        codeLines.push(lines[j]);
        j++;
      }
      elements.push(
        <pre key={key} style={{
          background: 'var(--bg-raised)',
          border: '1px solid var(--border-dim)',
          borderRadius: 4,
          padding: '6px 8px',
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          overflowX: 'auto',
          margin: '4px 0',
          lineHeight: 1.5,
          color: 'var(--text-primary)',
          whiteSpace: 'pre',
        }}>
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      i = j; // skip past the closing fence (or past the EOF)
      continue;
    }

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

// --- CSS mini-icons for capability tiles (no emoji) ---
function MiniCalcIcon({ color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, width: 20, height: 14, justifyContent: 'center' }}>
      <div style={{ height: 2.5, width: '100%', borderRadius: 1, background: color }} />
      <div style={{ height: 2.5, width: '65%', borderRadius: 1, background: color, opacity: 0.5 }} />
      <div style={{ height: 2.5, width: '85%', borderRadius: 1, background: color, opacity: 0.3 }} />
    </div>
  );
}

function MiniDocIcon({ color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2.5, width: 20, height: 14, justifyContent: 'center' }}>
      {[1, 0.6, 0.8].map((w, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <div style={{ width: 3, height: 3, borderRadius: 1, background: color, opacity: i === 0 ? 1 : 0.5, flexShrink: 0 }} />
          <div style={{ height: 2, width: `${w * 100}%`, borderRadius: 1, background: color, opacity: i === 0 ? 0.6 : 0.3 }} />
        </div>
      ))}
    </div>
  );
}

function MiniRateIcon({ color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, width: 20, height: 14 }}>
      <div style={{ width: 5, height: 10, borderRadius: 1.5, background: color, opacity: 0.4 }} />
      <div style={{ width: 5, height: 14, borderRadius: 1.5, background: color }} />
      <div style={{ width: 5, height: 7, borderRadius: 1.5, background: color, opacity: 0.6 }} />
    </div>
  );
}

function MiniScheduleIcon({ color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1.5, width: 20, height: 14, justifyContent: 'center' }}>
      <div style={{ display: 'flex', gap: 1.5 }}>
        <div style={{ width: 4, height: 4, borderRadius: 1, background: color }} />
        <div style={{ width: 4, height: 4, borderRadius: 1, background: color, opacity: 0.5 }} />
        <div style={{ width: 4, height: 4, borderRadius: 1, background: color, opacity: 0.3 }} />
      </div>
      <div style={{ height: 2, width: '100%', borderRadius: 1, background: color, opacity: 0.2 }} />
      <div style={{ height: 2, width: '70%', borderRadius: 1, background: color, opacity: 0.15 }} />
    </div>
  );
}

function MiniAppIcon({ color }) {
  return (
    <div style={{ width: 20, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        width: 12, height: 12, borderRadius: '50%',
        border: `2px solid ${color}`,
        position: 'relative',
      }}>
        <div style={{
          position: 'absolute', bottom: 1, left: '50%', transform: 'translateX(-50%)',
          width: 4, height: 4, borderRadius: '50%', background: color, opacity: 0.5,
        }} />
      </div>
    </div>
  );
}

const ICON_MAP = {
  calculator: MiniCalcIcon,
  documents: MiniDocIcon,
  rates: MiniRateIcon,
  schedule: MiniScheduleIcon,
  application: MiniAppIcon,
};

export function MiniIcon({ type, color }) {
  const Component = ICON_MAP[type];
  if (!Component) return null;
  return <Component color={color} />;
}

// --- WelcomeCard ---
// B7: strict `hasApplication === true` gate — defaults to compact pre-app view.
// A1: pre-app uses curated PRE_APP_TILES (2 tiles) instead of ad-hoc filter.
// UX 7: optional onDismiss renders a small close button so repeat demo-runners
// can hide the card without needing to send a message.
export function WelcomeCard({ onAction, hasApplication, onDismiss }) {
  const showFull = hasApplication === true;
  const tiles = showFull ? CAPABILITY_TILES : PRE_APP_TILES;

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 6,
      padding: `${spacing[1]}px 0`,
    }}>
      <div style={{
        width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
        background: 'var(--mongo)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', marginTop: 2,
      }}>
        <span style={{ fontSize: 8, color: '#fff', fontWeight: 800, fontFamily: 'var(--font-display)' }}>AI</span>
      </div>
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-dim)',
        borderRadius: 8,
        padding: `${spacing[3]}px ${spacing[3]}px ${spacing[2]}px`,
        maxWidth: '88%',
        position: 'relative',
        animation: 'genUISlideIn 0.35s cubic-bezier(0.33, 1, 0.68, 1) both',
      }}>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss welcome card"
            title="Dismiss"
            style={{
              position: 'absolute', top: 6, right: 6,
              width: 18, height: 18, borderRadius: '50%',
              background: 'transparent', border: '1px solid transparent',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, lineHeight: 1, color: 'var(--text-dim)',
              padding: 0, transition: 'border-color 150ms ease, color 150ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-dim)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = 'var(--text-dim)'; }}
          >
            {'\u2715'}
          </button>
        )}
        <div style={{
          fontFamily: 'var(--font-display)', fontWeight: 700,
          fontSize: 13, color: 'var(--text-primary)', marginBottom: 2,
        }}>
          Personal Lending Assistant
        </div>
        <div style={{
          fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)',
          marginBottom: 8, letterSpacing: '0.02em',
        }}>
          Powered by MongoDB Atlas + AI Agents
        </div>
        <div style={{
          fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5,
          marginBottom: 10,
        }}>
          {showFull
            ? 'I can help with your mortgage journey \u2014 from document prep to closing.'
            : 'Explore mortgage tools before you apply.'}
        </div>

        {/* Capability tiles grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 6,
          marginBottom: 8,
        }}>
          {tiles.map((tile, idx) => {
            const IconComp = ICON_MAP[tile.iconType];
            return (
              <button
                key={tile.label}
                type="button"
                onClick={() => onAction(tile.message)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--border-dim)',
                  background: 'var(--bg-base)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'border-color 150ms ease, background 150ms ease, transform 120ms ease',
                  animation: `capabilityTileIn 0.25s cubic-bezier(0.33, 1, 0.68, 1) ${idx * 60}ms both`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = tile.color;
                  e.currentTarget.style.background = `color-mix(in srgb, ${tile.color} 6%, var(--bg-base))`;
                  // A4: icon lifts 1px on hover
                  const icon = e.currentTarget.querySelector('[data-tile-icon]');
                  if (icon) icon.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-dim)';
                  e.currentTarget.style.background = 'var(--bg-base)';
                  e.currentTarget.style.transform = 'scale(1)';
                  const icon = e.currentTarget.querySelector('[data-tile-icon]');
                  if (icon) icon.style.transform = 'translateY(0)';
                }}
                // D7: press animation
                onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.97)'; }}
                onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                onFocus={(e) => { e.currentTarget.style.boxShadow = '0 0 0 2px var(--focus-ring, rgba(0, 124, 173, 0.4))'; }}
                onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
              >
                {IconComp && (
                  <div data-tile-icon style={{ transition: 'transform 150ms ease' }}>
                    <IconComp color={tile.color} />
                  </div>
                )}
                <div style={{
                  fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-display)',
                  color: 'var(--text-primary)', marginTop: 4,
                }}>
                  {tile.label}
                </div>
                <div style={{
                  fontSize: 10, color: 'var(--text-dim)', marginTop: 2,
                }}>
                  {tile.sublabel}
                </div>
              </button>
            );
          })}
        </div>

        {/* Tech footer */}
        <div style={{
          fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <span>{CAPABILITIES_INFO.length} interactive tools</span>
          <span style={{ opacity: 0.4 }}>{'\u00B7'}</span>
          <span>policy search</span>
          <span style={{ opacity: 0.4 }}>{'\u00B7'}</span>
          <span>real-time tracking</span>
        </div>
      </div>
    </div>
  );
}

// --- Component pre-announcement strip ---
// D3: when `morphing` is true, the strip fades + drifts upward as it morphs
// into the rendered component below it.
// UX 5: once the morph animation completes, hide the wrapper entirely so the
// strip doesn't sit in the DOM as a zero-opacity spacer.
export function ComponentAnnouncement({ components, morphing = false }) {
  const [hidden, setHidden] = useState(false);
  // Reset the hidden flag when a new set of components arrives (e.g., next
  // reply cycle) so a fresh strip renders.
  const signature = (components || []).map(c => c.id || c.component).join('|');
  useEffect(() => { setHidden(false); }, [signature]);

  if (!components || components.length === 0) return null;
  if (hidden) return null;

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 0', overflow: 'hidden' }}
      onAnimationEnd={morphing ? () => setHidden(true) : undefined}
    >
      {components.map((comp) => {
        const meta = COMPONENT_DISPLAY_NAMES[comp.component] || { label: comp.component, color: 'var(--agent-cyan)' };
        return (
          <div
            key={comp.id || comp.component}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: `1px solid ${meta.color}`,
              background: `color-mix(in srgb, ${meta.color} 8%, var(--bg-surface))`,
              display: 'flex', alignItems: 'center', gap: 6,
              animation: morphing
                ? 'announcementMorph 260ms cubic-bezier(0.33, 1, 0.68, 1) both'
                : 'thinkingFade 200ms cubic-bezier(0.33, 1, 0.68, 1) both',
            }}
          >
            <span style={{
              width: 5, height: 5, borderRadius: '50%',
              background: meta.color, flexShrink: 0,
              animation: 'pulse 1.5s infinite',
            }} />
            <span style={{
              fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-display)',
              color: 'var(--text-secondary)',
            }}>
              Preparing: {meta.label}
            </span>
          </div>
        );
      })}
    </div>
  );
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

export function MessageBubble({ message, onAction, hasApplication, onDismissWelcome }) {
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const isUser = message.role === 'user';

  // Welcome card
  if (message.isWelcome) {
    return (
      <WelcomeCard
        onAction={onAction || (() => {})}
        hasApplication={hasApplication === true}
        onDismiss={onDismissWelcome}
      />
    );
  }

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

  // Message accent border (priority: intervention > component > citation).
  // B4: use `boxShadow: inset` so the accent respects the bubble's
  // borderRadius instead of clipping at rounded corners.
  const hasInterventionContext = !isUser && message.toolsMeta?.some(t => t.tool === 'interventions');
  const hasUIComponents = !isUser && message.uiComponents?.length > 0;
  const hasCitations = !isUser && message.citations?.length > 0;
  let accentStyle = {};
  if (hasInterventionContext) accentStyle = { boxShadow: 'inset 3px 0 0 0 var(--hitl-amber)' };
  else if (hasUIComponents) accentStyle = { boxShadow: 'inset 0 3px 0 0 var(--mongo)' };
  else if (hasCitations) accentStyle = { boxShadow: 'inset 3px 0 0 0 var(--voyage)' };

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
            ...accentStyle,
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
