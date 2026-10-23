"use client";

import { spacing } from '@leafygreen-ui/tokens';
import {
  getContextualSuggestions,
  getVisibleQuickActions,
  getNewlyUnlockedActions,
  getTypeAheadSuggestions,
  getProactiveComponentSuggestion,
  getPlaceholder,
  CAPABILITIES_INFO,
  DATA_SOURCES,
} from './chatConstants';
import { MessageBubble, StreamingBubble, TypingIndicator, ContextGathering, MiniIcon, ComponentAnnouncement } from './ChatBubbles';
import { InterventionCard } from './InterventionCard';
import { SuggestedQuestions } from './SuggestedQuestions';
import { useApplicationChat } from './useApplicationChat';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatCurrency } from './generative/utils';

function ContextStrip({ applicationId, applicationStatus, borrowerProfile, loading }) {
  if (!applicationId) return null;
  const name = borrowerProfile?.firstName
    ? `${borrowerProfile.firstName} ${borrowerProfile.lastName || ''}`
    : null;
  const loanAmount = borrowerProfile?.loanAmount
    ? formatCurrency(parseFloat(borrowerProfile.loanAmount))
    : null;

  const statusColors = {
    submitted: 'var(--text-dim)',
    processing: 'var(--agent-cyan)',
    underwriting: 'var(--voyage)',
    review: 'var(--hitl-amber)',
    approved: 'var(--success)',
    declined: 'var(--danger)',
    closing: 'var(--success)',
  };
  const statusColor = statusColors[applicationStatus] || 'var(--text-dim)';

  return (
    <div style={{
      padding: '4px 16px',
      borderBottom: '1px solid var(--border-dim)',
      display: 'flex', alignItems: 'center', gap: 8,
      fontSize: 10, color: 'var(--text-dim)',
      background: 'var(--bg-surface)',
      flexShrink: 0,
    }}>
      {/* Pulsing dot */}
      <div style={{
        width: 6, height: 6, borderRadius: '50%',
        background: loading ? 'var(--agent-cyan)' : statusColor,
        animation: loading ? 'pulse 1.5s infinite' : 'none',
        flexShrink: 0,
      }} />
      {name && <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{name}</span>}
      <span aria-hidden="true" style={{ color: 'var(--border-base)' }}>|</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9 }}>
        {applicationId.length > 16 ? applicationId.slice(0, 16) + '...' : applicationId}
      </span>
      {loanAmount && (
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ fontSize: 7, color: 'var(--text-dim)', fontFamily: 'var(--font-display)', textTransform: 'uppercase' }}>Mortgage</span>
          {loanAmount}
        </span>
      )}
      <span style={{
        fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 3,
        // Bug 1: `${statusColor}18` was concatenating a hex alpha suffix onto
        // a `var(--...)` reference \u2014 invalid CSS that silently dropped the
        // tint. color-mix accepts `var()` as a color argument and works in all
        // modern browsers (already used elsewhere in this file).
        background: `color-mix(in srgb, ${statusColor} 12%, transparent)`,
        color: statusColor,
        textTransform: 'uppercase', fontFamily: 'var(--font-display)',
      }}>
        {applicationStatus || 'pending'}
      </span>
    </div>
  );
}

// --- Capabilities Info Panel ---
// D5: rendered as an overlay popover anchored below the info button rather
// than pushing the chat content down.
// D6: tool rows are buttons that dispatch the related component's message.
// Review #2: panel is focusable (tabIndex=-1), receives focus on mount,
// responds to Escape, and restores focus to the trigger on dismiss.
function CapabilitiesPanel({ id, panelRef, onDismiss, onInvoke }) {
  useEffect(() => {
    // Move focus into the dialog when it opens so screen-reader users land
    // on the heading region instead of being stranded on the trigger.
    panelRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onDismiss();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      id={id}
      ref={panelRef}
      role="dialog"
      aria-label="Assistant capabilities"
      tabIndex={-1}
      style={{
        position: 'absolute',
        top: 'calc(100% + 4px)', left: 0, right: 0,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-dim)',
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        padding: '12px 16px',
        maxHeight: 280,
        overflowY: 'auto',
        zIndex: 20,
        outline: 'none',
        animation: 'slideDown 220ms cubic-bezier(0.33, 1, 0.68, 1) both',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 6,
      }}>
        <div style={{
          fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.05em', color: 'var(--agent-cyan)',
          fontFamily: 'var(--font-display)',
        }}>
          Interactive Tools
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close capabilities panel"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 12, lineHeight: 1, color: 'var(--text-dim)', padding: 2,
          }}
        >{'\u2715'}</button>
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4,
        marginBottom: 10,
      }}>
        {CAPABILITIES_INFO.map((cap) => (
          <button
            key={cap.name}
            type="button"
            onClick={() => onInvoke && onInvoke(cap.message)}
            style={{
              padding: '6px 8px', borderRadius: 4,
              border: '1px solid var(--border-dim)',
              borderLeft: `3px solid ${cap.color}`,
              background: 'var(--bg-base)',
              textAlign: 'left', cursor: 'pointer',
              transition: 'background 150ms ease, border-color 150ms ease',
            }}
            onMouseEnter={(e) => {
              // Review #11: same fallback pattern \u2014 reset to a valid
              // solid color first so unsupported color-mix gets ignored
              // without leaving a blank background.
              e.currentTarget.style.background = 'var(--bg-base)';
              e.currentTarget.style.background = `color-mix(in srgb, ${cap.color} 6%, var(--bg-base))`;
            }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-base)'; }}
            onFocus={(e) => { e.currentTarget.style.boxShadow = '0 0 0 2px var(--focus-ring, rgba(0, 124, 173, 0.4))'; }}
            onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
          >
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
              {cap.name}
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 1 }}>
              {cap.description}
            </div>
          </button>
        ))}
      </div>

      <div style={{
        fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.05em', color: 'var(--voyage)',
        fontFamily: 'var(--font-display)', marginBottom: 4,
      }}>
        Data Sources
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
        {DATA_SOURCES.map((src) => (
          <span key={src.label} style={{
            fontSize: 8, fontWeight: 600, padding: '2px 6px', borderRadius: 3,
            background: src.bg, color: src.color,
            fontFamily: 'var(--font-display)',
          }}>
            {src.label}
          </span>
        ))}
      </div>

      <div style={{
        fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)',
        lineHeight: 1.4,
      }}>
        Ask any question. The assistant gathers data from multiple sources, searches policies using vector search, and responds with context-aware answers \u2014 sometimes with interactive components.
      </div>
    </div>
  );
}

export default function ApplicationAgent({ applicationId, applicationStatus, borrowerProfile, onDocumentUploaded }) {
  const {
    messages,
    input, setInput,
    loading,
    streamingContent,
    interventions,
    resolvingId,
    activeTools,
    pendingComponents,
    messagesEndRef,
    textareaRef, inputRef,
    sendMessage,
    clearChat,
    resolveIntervention,
    abort,
    dismissWelcome,
    canSend,
  } = useApplicationChat(applicationId, applicationStatus);

  const [showCapabilities, setShowCapabilities] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // Review #1 + #2: refs for outside-click dismiss + focus restoration.
  const infoButtonRef = useRef(null);
  const capabilitiesPanelRef = useRef(null);

  const dismissCapabilities = () => {
    setShowCapabilities(false);
    // Return focus to the trigger so keyboard users aren't stranded.
    infoButtonRef.current?.focus();
  };

  useEffect(() => {
    if (!showCapabilities) return;
    const handler = (e) => {
      const panel = capabilitiesPanelRef.current;
      const trigger = infoButtonRef.current;
      if (!panel) return;
      if (panel.contains(e.target)) return;
      if (trigger && trigger.contains(e.target)) return; // trigger toggles itself
      setShowCapabilities(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showCapabilities]);

  // B9: tie the connection dot to navigator.onLine so it reflects real
  // connectivity instead of being a static ornament.
  useEffect(() => {
    if (typeof navigator === 'undefined' || typeof window === 'undefined') return;
    setIsOnline(navigator.onLine);
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  // A5: track which quick actions are newly unlocked at the current status so
  // we can play the unlock animation once per transition.
  // Polish: back-to-back status changes could stack setTimeouts and wipe
  // `unlockedKeys` early. Hold the handle in a ref and clear on re-entry.
  // UX 2: `seenKeysRef` records quick-action keys that have already been in
  // the visible set, so we only play the initial stagger the first time a
  // key appears in the bar (not on every re-render).
  const prevStatusRef = useRef(applicationStatus);
  const unlockTimerRef = useRef(null);
  const seenKeysRef = useRef(new Set());
  const [unlockedKeys, setUnlockedKeys] = useState(() => new Set());
  useEffect(() => {
    const newly = getNewlyUnlockedActions(prevStatusRef.current, applicationStatus);
    if (newly.size > 0) {
      setUnlockedKeys(newly);
      if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current);
      unlockTimerRef.current = setTimeout(() => setUnlockedKeys(new Set()), 1200);
    }
    prevStatusRef.current = applicationStatus;
  }, [applicationStatus]);
  useEffect(() => () => {
    if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current);
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (loading) return; // B1: ignore Enter while the assistant is replying
      sendMessage();
    }
  };

  // B2 + B3: dedupe active tools by label, drop entries with explicit
  // failure metadata (tool.error or tool.status === 'failed') before deriving
  // the header subtitle.
  const visibleActiveTools = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const t of activeTools) {
      if (t.error || t.status === 'failed') continue;
      const key = t.label || t.tool;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(t);
    }
    return out;
  }, [activeTools]);

  // G3: subtitle is static brand tagline. Loading state is rendered as a
  // separate chip instead of overloading the subtitle text.
  // Review #7: pick the first tool that is still in-flight. Completed tools
  // linger in the array with status === 'complete' / found != null; showing
  // the *last* entry made the chip say "Searching policies" even after all
  // tools had returned and the LLM was already generating text.
  const inFlightTool = visibleActiveTools.find(
    t => t.status !== 'complete' && t.found == null
  );
  const loadingChip = loading
    ? (inFlightTool?.label || 'Analyzing')
    : null;

  // E2: typing-ahead suggestions — debounce to avoid re-rendering on every
  // keystroke.
  const [typeAhead, setTypeAhead] = useState([]);
  useEffect(() => {
    if (!input || input.length < 2 || loading) {
      setTypeAhead([]);
      return;
    }
    const handle = setTimeout(() => {
      setTypeAhead(getTypeAheadSuggestions(input, applicationStatus, interventions));
    }, 120);
    return () => clearTimeout(handle);
  }, [input, applicationStatus, interventions, loading]);

  // E6: derive a proactive component suggestion from the last assistant
  // message if the LLM discussed a tool-worthy topic but attached no UI.
  const proactiveSuggestion = useMemo(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'assistant' || last.isWelcome) return null;
    return getProactiveComponentSuggestion(last, applicationStatus);
  }, [messages, applicationStatus]);

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      background: 'var(--bg-base)', minWidth: 0,
    }}>
      {/* Header */}
      <div style={{
        padding: `${spacing[3]}px ${spacing[4]}px`,
        borderBottom: applicationId ? 'none' : '1px solid var(--border-dim)',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexShrink: 0,
        position: 'relative',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* AI circle with loading ring */}
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            border: `2px solid ${loading ? 'transparent' : 'var(--bg-base)'}`,
            borderTopColor: loading ? 'var(--agent-cyan)' : 'var(--bg-base)',
            animation: loading ? 'spin 1s linear infinite' : 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              background: 'var(--mongo)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 9, color: '#fff', fontWeight: 800, fontFamily: 'var(--font-display)' }}>AI</span>
            </div>
          </div>
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <div style={{
                fontFamily: 'var(--font-display)', fontWeight: 700,
                fontSize: 14, color: 'var(--text-primary)',
              }}>
                Personal Lending Assistant
              </div>
              {/* Info button (A6: 18×18) */}
              <button
                ref={infoButtonRef}
                type="button"
                onClick={() => setShowCapabilities(p => !p)}
                title={showCapabilities ? 'Hide capabilities' : 'View capabilities'}
                aria-expanded={showCapabilities}
                aria-controls="capabilities-panel"
                aria-haspopup="dialog"
                style={{
                  width: 18, height: 18, borderRadius: '50%',
                  border: `1px solid ${showCapabilities ? 'var(--agent-cyan)' : 'var(--border-dim)'}`,
                  background: 'transparent',
                  fontSize: 10, fontWeight: 700, lineHeight: 1,
                  color: showCapabilities ? 'var(--agent-cyan)' : 'var(--text-dim)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'border-color 150ms ease, color 150ms ease',
                  padding: 0, flexShrink: 0,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--agent-cyan)'; e.currentTarget.style.color = 'var(--agent-cyan)'; }}
                onMouseLeave={(e) => {
                  if (!showCapabilities) { e.currentTarget.style.borderColor = 'var(--border-dim)'; e.currentTarget.style.color = 'var(--text-dim)'; }
                }}
                onFocus={(e) => { e.currentTarget.style.boxShadow = '0 0 0 2px var(--focus-ring, rgba(0, 124, 173, 0.4))'; }}
                onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
              >
                i
              </button>
            </div>
            {/* G3: static marketing subtitle + separate loading chip */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, marginTop: 1,
            }}>
              <span style={{
                fontSize: 10, color: 'var(--text-dim)',
              }}>
                Personalized mortgage guidance
              </span>
              {loadingChip && (
                <span
                  role="status"
                  aria-live="polite"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    fontSize: 9, fontFamily: 'var(--font-mono)',
                    color: 'var(--agent-cyan)',
                    padding: '1px 6px', borderRadius: 8,
                    background: 'var(--agent-cyan-dim)',
                    border: '1px solid var(--agent-cyan-dim)',
                    animation: 'thinkingFade 180ms ease both',
                  }}
                >
                  <span style={{
                    width: 4, height: 4, borderRadius: '50%',
                    background: 'var(--agent-cyan)',
                    animation: 'pulse 1.2s infinite',
                  }} />
                  {loadingChip}
                </span>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Connection dot (B9: reflects online/offline state) */}
          <div
            style={{
              width: 6, height: 6, borderRadius: '50%',
              background: isOnline ? 'var(--success)' : 'var(--danger)',
              flexShrink: 0,
              transition: 'background 150ms ease',
            }}
            title={isOnline ? 'Connected' : 'Offline'}
            aria-label={isOnline ? 'Connected' : 'Offline'}
          />
          {/* D8: "New chat" semantics with confirmation for destructive reset. */}
          <button
            onClick={() => {
              // Review #10: iOS PWA standalone mode can throw on
              // window.confirm. Fall through to clear if the prompt is
              // unavailable rather than silently failing.
              if (messages.filter(m => m.role === 'user').length > 0) {
                try {
                  if (!window.confirm('Start a new chat? This clears the current conversation.')) return;
                } catch {
                  // prompt unavailable \u2014 proceed with clear
                }
              }
              clearChat();
            }}
            title="Start a new chat"
            aria-label="Start a new chat"
            style={{
              background: 'transparent',
              border: '1px solid var(--border-dim)',
              borderRadius: 8,
              padding: `${spacing[1]}px ${spacing[2]}px`,
              fontSize: 11, color: 'var(--text-dim)',
              cursor: 'pointer', fontFamily: 'var(--font-display)',
              transition: 'border-color 150ms ease',
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-base)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-dim)'; }}
            onFocus={(e) => { e.currentTarget.style.boxShadow = '0 0 0 2px var(--focus-ring, rgba(0, 124, 173, 0.4))'; }}
            onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
          >
            <span aria-hidden="true" style={{ fontSize: 12, lineHeight: 1 }}>{'\u21BB'}</span>
            New chat
          </button>
        </div>

        {/* Capabilities Info Panel (popover anchored under header) */}
        {showCapabilities && (
          <CapabilitiesPanel
            id="capabilities-panel"
            panelRef={capabilitiesPanelRef}
            onDismiss={dismissCapabilities}
            onInvoke={(msg) => { dismissCapabilities(); sendMessage(msg); }}
          />
        )}
      </div>

      {/* Context Strip */}
      <ContextStrip
        applicationId={applicationId}
        applicationStatus={applicationStatus}
        borrowerProfile={borrowerProfile}
        loading={loading}
      />

      {/* Messages area */}
      <div style={{
        flex: 1, overflowY: 'auto',
        padding: `${spacing[3]}px ${spacing[4]}px`,
        display: 'flex', flexDirection: 'column',
      }}>
        {messages.map((msg, idx) => (
          <MessageBubble
            key={`${msg.timestamp}-${idx}`}
            message={msg}
            onAction={sendMessage}
            hasApplication={applicationId != null}
            onDismissWelcome={dismissWelcome}
          />
        ))}
        {interventions.length > 0 && (
          <div style={{ padding: `${spacing[1]}px 0` }}>
            {interventions.map((intv) => (
              <InterventionCard
                key={intv._id}
                intervention={intv}
                onResolve={resolveIntervention}
                resolving={resolvingId === intv._id}
                applicationId={applicationId}
                onDocumentUploaded={onDocumentUploaded}
              />
            ))}
          </div>
        )}
        {!loading && messages.length > 0 && messages[messages.length - 1].role === 'assistant' && !messages[messages.length - 1].isWelcome && (() => {
          const base = getContextualSuggestions(
            applicationStatus,
            interventions,
            messages.filter(m => m.role === 'user').length
          );
          // E6: if the LLM discussed a component-worthy topic without
          // attaching a UI component, prepend a proactive suggestion.
          const combined = proactiveSuggestion
            ? [proactiveSuggestion, ...base.filter(q => q.text !== proactiveSuggestion.text)]
            : base;
          return (
            <SuggestedQuestions
              onSelect={(q) => sendMessage(q)}
              questions={combined}
              showHint
            />
          );
        })()}

        {loading && activeTools.length > 0 && !streamingContent && (
          <ContextGathering tools={activeTools} collapsed={false} />
        )}
        {/* Component pre-announcement */}
        {loading && pendingComponents.length > 0 && !streamingContent && (
          <ComponentAnnouncement components={pendingComponents} />
        )}
        {loading && streamingContent && (
          <>
            {activeTools.length > 0 && <ContextGathering tools={activeTools} collapsed={true} />}
            {/* D3: morph announcement as streaming text arrives. */}
            {pendingComponents.length > 0 && <ComponentAnnouncement components={pendingComponents} morphing />}
            <StreamingBubble content={streamingContent} />
          </>
        )}
        {loading && !streamingContent && activeTools.length === 0 && pendingComponents.length === 0 && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* E2: typing-ahead suggestions float just above the input.
          Review #5: suppress when a proactive suggestion is already shown to
          avoid rendering three suggestion surfaces simultaneously. */}
      {!loading && typeAhead.length > 0 && !proactiveSuggestion && (
        <div style={{ padding: `0 ${spacing[4]}px`, flexShrink: 0 }}>
          <SuggestedQuestions
            onSelect={(q) => { setInput(''); sendMessage(q); }}
            questions={typeAhead}
          />
        </div>
      )}

      {/* Capability Bar (D1: dim during loading, don't hide; D2: grid equal-width) */}
      {applicationId && (
        <div
          style={{
            padding: `4px ${spacing[4]}px 0`,
            display: 'grid',
            gridTemplateColumns: `repeat(${getVisibleQuickActions(applicationStatus).length || 1}, minmax(0, 1fr))`,
            gap: 6,
            flexShrink: 0,
            opacity: loading ? 0.4 : 1,
            pointerEvents: loading ? 'none' : 'auto',
            transition: 'opacity 180ms ease',
          }}
          aria-hidden={loading || undefined}
        >
          {getVisibleQuickActions(applicationStatus).map((qa, idx) => {
            const isNewlyUnlocked = unlockedKeys.has(qa.key);
            // UX 2: play the initial stagger the first time each key is seen
            // in the bar. Subsequent re-renders keep the card static so the
            // animation doesn't replay when the user types or the bar
            // re-renders for an unrelated reason.
            const isFirstRender = !seenKeysRef.current.has(qa.key) && !isNewlyUnlocked;
            if (!seenKeysRef.current.has(qa.key)) seenKeysRef.current.add(qa.key);
            let animation;
            if (isNewlyUnlocked) animation = 'capabilityUnlock 1.1s cubic-bezier(0.33, 1, 0.68, 1) both';
            else if (isFirstRender) animation = `capabilityTileIn 0.25s cubic-bezier(0.33, 1, 0.68, 1) ${idx * 40}ms both`;
            return (
              <button
                key={qa.label} type="button"
                onClick={() => sendMessage(qa.message)}
                disabled={loading}
                // Review #8: disabled buttons are removed from tab order in
                // most browsers, but belt-and-suspenders with tabIndex=-1
                // when the parent is aria-hidden to keep keyboard focus in
                // sync with the visual dim state.
                tabIndex={loading ? -1 : 0}
                style={{
                  padding: '8px 12px', borderRadius: 6,
                  border: `1px solid ${isNewlyUnlocked ? qa.color : 'var(--border-dim)'}`,
                  background: 'var(--bg-surface)',
                  cursor: loading ? 'default' : 'pointer', textAlign: 'left',
                  transition: 'all 150ms ease, transform 120ms ease',
                  display: 'flex', flexDirection: 'column', gap: 3,
                  animation,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = qa.color;
                  // Review #11: seed a solid fallback background before the
                  // color-mix attempt. Browsers that don't recognize
                  // color-mix (older Safari, some webviews) silently drop
                  // the invalid value and we'd be left with a blank box.
                  e.currentTarget.style.background = 'var(--bg-surface-hover, var(--bg-surface))';
                  e.currentTarget.style.background = `color-mix(in srgb, ${qa.color} 6%, var(--bg-surface))`;
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)';
                }}
                onMouseLeave={(e) => {
                  // Review #3: always reset to the neutral border. The unlock
                  // animation's box-shadow has already played; the initial
                  // render sets the colored border inline, and preserving it
                  // post-hover after the setTimeout clears `unlockedKeys`
                  // produced a stuck permanent tint.
                  e.currentTarget.style.borderColor = 'var(--border-dim)';
                  e.currentTarget.style.background = 'var(--bg-surface)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.97)'; }}
                onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                onFocus={(e) => { e.currentTarget.style.boxShadow = '0 0 0 2px var(--focus-ring, rgba(0, 124, 173, 0.4))'; }}
                onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
              >
                <MiniIcon type={qa.iconType} color={qa.color} />
                <div style={{
                  fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-display)',
                  color: 'var(--text-primary)',
                }}>
                  {qa.label}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>
                  {qa.sublabel}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Input area */}
      <div style={{
        borderTop: '1px solid var(--border-dim)',
        padding: `${spacing[3]}px ${spacing[4]}px`,
        display: 'flex', alignItems: 'center',
        gap: spacing[2], flexShrink: 0,
      }}>
        <textarea
          ref={(el) => { textareaRef.current = el; inputRef.current = el; }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={loading ? 'Assistant is responding\u2026' : getPlaceholder(applicationStatus, interventions)}
          aria-label="Message input"
          aria-busy={loading}
          disabled={loading}
          rows={1}
          style={{
            flex: 1, minWidth: 0, resize: 'none',
            border: '1px solid var(--border-dim)', borderRadius: 8,
            padding: `${spacing[2]}px ${spacing[3]}px`,
            minHeight: 36, boxSizing: 'border-box',
            fontSize: 13, lineHeight: '20px',
            color: loading ? 'var(--text-dim)' : 'var(--text-primary)',
            background: loading ? 'var(--bg-surface)' : 'var(--bg-base)',
            fontFamily: 'inherit', outline: 'none',
            overflow: 'auto',
            wordBreak: 'break-word',
            opacity: loading ? 0.7 : 1,
            cursor: loading ? 'not-allowed' : 'text',
            transition: 'border-color 150ms ease, box-shadow 150ms ease, opacity 150ms ease',
          }}
          onFocus={(e) => {
            e.target.style.borderColor = 'var(--mongo)';
            e.target.style.boxShadow = '0 0 0 2px var(--mongo-glow)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'var(--border-dim)';
            e.target.style.boxShadow = 'none';
          }}
        />
        {/* UX 1: while the assistant is replying, swap Send for Stop. Clicking
            aborts the in-flight streaming fetch and resets ephemeral state. */}
        {loading ? (
          <button
            onClick={abort}
            aria-label="Stop generating"
            title="Stop generating"
            style={{
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-base)',
              borderRadius: 8,
              width: 36, height: 36,
              fontSize: 11, fontWeight: 700,
              fontFamily: 'var(--font-display)',
              cursor: 'pointer', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 150ms ease, border-color 150ms ease, transform 120ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--danger-dim, color-mix(in srgb, var(--danger) 10%, transparent))';
              e.currentTarget.style.borderColor = 'var(--danger)';
              e.currentTarget.style.color = 'var(--danger)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--bg-surface)';
              e.currentTarget.style.borderColor = 'var(--border-base)';
              e.currentTarget.style.color = 'var(--text-primary)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
            onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.95)'; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            onFocus={(e) => { e.currentTarget.style.boxShadow = '0 0 0 2px var(--focus-ring, rgba(0, 124, 173, 0.4))'; }}
            onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
          >
            {/* filled square \u2014 universal stop glyph */}
            <span aria-hidden="true" style={{
              width: 10, height: 10, borderRadius: 2, background: 'currentColor',
              display: 'inline-block',
            }} />
          </button>
        ) : (
          <button
            onClick={() => sendMessage()}
            disabled={!canSend}
            aria-label="Send message"
            style={{
              background: canSend ? 'var(--mongo)' : 'var(--border-dim)',
              color: canSend ? '#FFFFFF' : 'var(--text-dim)',
              border: 'none', borderRadius: 8,
              width: 36, height: 36,
              fontSize: 16, fontWeight: 600,
              fontFamily: 'var(--font-display)',
              cursor: canSend ? 'pointer' : 'default',
              flexShrink: 0,
              // G4: breathing invitation while input is present but not sent.
              animation: canSend ? 'sendInvite 1.8s ease-in-out infinite' : 'none',
              transition: 'background 150ms ease, color 150ms ease, transform 120ms ease',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseDown={(e) => { if (canSend) e.currentTarget.style.transform = 'scale(0.95)'; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            {'\u2191'}
          </button>
        )}
      </div>
    </div>
  );
}
