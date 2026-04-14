"use client";

import { spacing } from '@leafygreen-ui/tokens';
import { getContextualSuggestions } from './chatConstants';
import { MessageBubble, StreamingBubble, TypingIndicator, ContextGathering } from './ChatBubbles';
import { InterventionCard } from './InterventionCard';
import { SuggestedQuestions } from './SuggestedQuestions';
import { useApplicationChat } from './useApplicationChat';
import { useEffect, useRef } from 'react';

export default function ApplicationAgent({ applicationId, applicationStatus, onToolActivity }) {
  const {
    messages,
    input, setInput,
    loading,
    streamingContent,
    interventions,
    resolvingId,
    activeTools,
    messagesEndRef,
    textareaRef, inputRef,
    sendMessage,
    clearChat,
    resolveIntervention,
    canSend,
  } = useApplicationChat(applicationId);

  // Report tool activity to parent for TechnologyTheatre
  const toolHistoryRef = useRef([]);
  useEffect(() => {
    if (!onToolActivity) return;
    // Track completed tools in history
    if (activeTools.length === 0 && toolHistoryRef.current.length > 0) {
      // Tools just finished — snapshot them
    }
    for (const t of activeTools) {
      if (t.status === 'complete' && !toolHistoryRef.current.find(h => h.label === t.label)) {
        toolHistoryRef.current = [...toolHistoryRef.current, { ...t, completedAt: new Date().toISOString() }];
      }
    }
    onToolActivity(activeTools, toolHistoryRef.current);
  }, [activeTools, onToolActivity]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      background: 'var(--bg-base)', minWidth: 0,
    }}>
      {/* Header */}
      <div style={{
        padding: `${spacing[3]}px ${spacing[4]}px`,
        borderBottom: '1px solid var(--border-dim)',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-display)', fontWeight: 700,
            fontSize: 14, color: 'var(--text-primary)',
          }}>
            LendFlow Assistant
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 1 }}>
            AI-powered application support
          </div>
        </div>
        <button
          onClick={clearChat}
          style={{
            background: 'transparent',
            border: '1px solid var(--border-dim)',
            borderRadius: 8,
            padding: `${spacing[1]}px ${spacing[2]}px`,
            fontSize: 11, color: 'var(--text-dim)',
            cursor: 'pointer', fontFamily: 'var(--font-display)',
            transition: 'border-color 150ms ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-base)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-dim)'; }}
          onFocus={(e) => { e.currentTarget.style.boxShadow = '0 0 0 2px var(--focus-ring, rgba(0, 124, 173, 0.4))'; }}
          onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
        >
          Clear
        </button>
      </div>

      {/* Messages area */}
      <div style={{
        flex: 1, overflowY: 'auto',
        padding: `${spacing[3]}px ${spacing[4]}px`,
        display: 'flex', flexDirection: 'column',
      }}>
        {messages.map((msg, idx) => (
          <MessageBubble key={`${msg.timestamp}-${idx}`} message={msg} />
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
              />
            ))}
          </div>
        )}
        {!loading && messages.length > 0 && messages[messages.length - 1].role === 'assistant' && (
          <SuggestedQuestions
            onSelect={(q) => sendMessage(q)}
            questions={getContextualSuggestions(applicationStatus, interventions)}
          />
        )}
        {loading && activeTools.length > 0 && !streamingContent && (
          <ContextGathering tools={activeTools} collapsed={false} />
        )}
        {loading && streamingContent && (
          <>
            {activeTools.length > 0 && <ContextGathering tools={activeTools} collapsed={true} />}
            <StreamingBubble content={streamingContent} />
          </>
        )}
        {loading && !streamingContent && activeTools.length === 0 && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div style={{
        borderTop: '1px solid var(--border-dim)',
        padding: `${spacing[3]}px ${spacing[4]}px`,
        display: 'flex', alignItems: 'flex-end',
        gap: spacing[2], flexShrink: 0,
      }}>
        <textarea
          ref={(el) => { textareaRef.current = el; inputRef.current = el; }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your application..."
          aria-label="Message input"
          rows={1}
          style={{
            flex: 1, resize: 'none',
            border: '1px solid var(--border-dim)', borderRadius: 8,
            padding: `${spacing[2]}px ${spacing[3]}px`,
            fontSize: 13, lineHeight: '20px',
            color: 'var(--text-primary)',
            background: 'var(--bg-base)',
            fontFamily: 'inherit', outline: 'none',
            overflow: 'hidden',
            transition: 'border-color 150ms ease',
          }}
          onFocus={(e) => { e.target.style.borderColor = 'var(--border-base)'; }}
          onBlur={(e) => { e.target.style.borderColor = 'var(--border-dim)'; }}
        />
        <button
          onClick={() => sendMessage()}
          disabled={!canSend}
          style={{
            background: canSend ? 'var(--mongo)' : 'var(--border-dim)',
            color: canSend ? '#FFFFFF' : 'var(--text-dim)',
            border: 'none', borderRadius: 8,
            padding: `${spacing[2]}px ${spacing[3]}px`,
            fontSize: 13, fontWeight: 600,
            fontFamily: 'var(--font-display)',
            cursor: canSend ? 'pointer' : 'default',
            flexShrink: 0,
            transition: 'background 150ms ease, color 150ms ease',
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
