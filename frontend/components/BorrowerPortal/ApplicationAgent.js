"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { spacing } from '@leafygreen-ui/tokens';
import { apiPost, apiGet } from '../../lib/api';

const API_BASE = '/api/backend';

const STATUS_SUGGESTIONS = {
  submitted: [
    'What documents were submitted with my application?',
    'How long does the verification process take?',
  ],
  processing: [
    'What documents were submitted?',
    'How long will verification take?',
    'What happens during document verification?',
  ],
  underwriting: [
    'What is the mortgage stress test?',
    'How is my risk score calculated?',
    'What are the GDS and TDS ratios?',
  ],
  review: [
    'What does officer review mean?',
    'How long does officer review take?',
    'Can I provide additional documents?',
  ],
  approved: [
    'What are the next steps after approval?',
    'When is my first payment due?',
    'What was my final interest rate?',
  ],
  declined: [
    'Why was my application declined?',
    'Can I reapply with changes?',
    'What can I do to improve my application?',
  ],
  default: [
    'What is the status of my application?',
    'What are the next steps in the process?',
    'Explain the mortgage stress test',
  ],
};

function renderMessageContent(text) {
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

function renderInline(text) {
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

function StreamingBubble({ content }) {
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

function TypingIndicator() {
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

function MessageBubble({ message }) {
  const isUser = message.role === 'user';

  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
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
      </div>
    </div>
  );
}

function SuggestedQuestions({ onSelect, questions }) {
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap',
      gap: spacing[2], padding: `${spacing[2]}px 0`,
    }}>
      {questions.map((q) => (
        <button
          key={q}
          type="button"
          onClick={() => onSelect(q)}
          style={{
            padding: `${spacing[1]}px ${spacing[3]}px`,
            borderRadius: 20,
            border: '1px solid var(--border-dim)',
            background: 'var(--bg-surface)',
            color: 'var(--text-secondary)',
            fontSize: 12,
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'border-color 150ms ease, color 150ms ease, background 150ms ease',
            lineHeight: 1.4,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--mongo)';
            e.currentTarget.style.color = 'var(--mongo)';
            e.currentTarget.style.background = 'var(--mongo-dim)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-dim)';
            e.currentTarget.style.color = 'var(--text-secondary)';
            e.currentTarget.style.background = 'var(--bg-surface)';
          }}
          onFocus={(e) => { e.currentTarget.style.boxShadow = '0 0 0 2px var(--focus-ring, rgba(0, 124, 173, 0.4))'; }}
          onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
        >
          {q}
        </button>
      ))}
    </div>
  );
}

function InterventionCard({ intervention, onResolve, resolving }) {
  const isResolved = intervention._resolved;
  const ctx = intervention.borrower_context || {};

  return (
    <div style={{
      margin: `${spacing[2]}px 0`,
      padding: spacing[3],
      background: isResolved ? 'var(--success-dim)' : 'var(--hitl-amber-dim)',
      borderRadius: 8,
      border: `1px solid ${isResolved ? 'var(--success)' : 'var(--hitl-amber)'}`,
      borderLeft: `3px solid ${isResolved ? 'var(--success)' : 'var(--hitl-amber)'}`,
      transition: 'all 300ms cubic-bezier(0.33, 1, 0.68, 1)',
      animation: 'cardEnter 0.3s cubic-bezier(0.4, 0, 0.2, 1) both',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{
          fontSize: 8, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.05em',
          padding: '2px 6px', borderRadius: 4,
          background: isResolved ? 'var(--success)' : 'var(--hitl-amber)',
          color: '#FFFFFF',
        }}>
          {isResolved ? 'Resolved' : intervention.status || 'Action Required'}
        </span>
        <span style={{
          fontSize: 9, color: 'var(--text-dim)', fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.03em',
        }}>
          {intervention.type?.replace(/_/g, ' ') || 'Intervention'}
        </span>
      </div>

      {ctx.summary && (
        <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5, marginBottom: 4 }}>
          {ctx.summary}
        </div>
      )}
      {ctx.action_required && !isResolved && (
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: 8 }}>
          {ctx.action_required}
        </div>
      )}

      {!isResolved && (
        <button
          type="button"
          onClick={() => onResolve(intervention._id)}
          disabled={resolving}
          style={{
            padding: '4px 12px', borderRadius: 6,
            border: '1px solid var(--hitl-amber)',
            background: 'var(--bg-base)',
            color: 'var(--hitl-amber)',
            fontSize: 11, fontWeight: 600,
            fontFamily: 'var(--font-display)',
            cursor: resolving ? 'default' : 'pointer',
            opacity: resolving ? 0.6 : 1,
            transition: 'background 150ms ease',
          }}
          onMouseEnter={(e) => { if (!resolving) e.currentTarget.style.background = 'var(--hitl-amber-dim)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-base)'; }}
        >
          {resolving ? 'Resolving...' : 'Acknowledge'}
        </button>
      )}
    </div>
  );
}

function createWelcomeMessage() {
  return {
    role: 'assistant',
    content: 'Welcome! I\'m your LendFlow application assistant. I can help you with document requirements, lending policies, and track your application progress. What would you like to know?',
    timestamp: new Date().toISOString(),
  };
}

export default function ApplicationAgent({ applicationId, applicationStatus }) {
  const [messages, setMessages] = useState(() => [createWelcomeMessage()]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [interventions, setInterventions] = useState([]);
  const [resolvingId, setResolvingId] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const textareaRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    if (!applicationId) return;
    apiGet(`/chat/${applicationId}/history`).then(data => {
      if (data?.messages?.length) {
        setMessages(data.messages);
      }
    });
  }, [applicationId]);

  const fetchInterventions = useCallback(() => {
    if (!applicationId) return;
    apiGet(`/chat/${applicationId}/interventions`).then(data => {
      if (data?.interventions) {
        setInterventions(prev => {
          const resolvedIds = new Set(prev.filter(i => i._resolved).map(i => i._id));
          return data.interventions.map(i => ({
            ...i,
            _resolved: resolvedIds.has(i._id) || i.status === 'resolved',
          }));
        });
      }
    });
  }, [applicationId]);

  useEffect(() => {
    fetchInterventions();
    const interval = setInterval(fetchInterventions, 8000);
    return () => clearInterval(interval);
  }, [fetchInterventions]);

  const resolveIntervention = useCallback(async (id) => {
    setResolvingId(id);
    const result = await apiPost(`/chat/${applicationId}/interventions/${id}/resolve`);
    if (result && !result.error) {
      setInterventions(prev => prev.map(i => i._id === id ? { ...i, _resolved: true } : i));
    }
    setResolvingId(null);
  }, [applicationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, streamingContent]);

  const adjustTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const maxHeight = 20 * 4;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, []);

  useEffect(() => {
    adjustTextarea();
  }, [input, adjustTextarea]);

  const sendMessage = useCallback(async (overrideMessage) => {
    const userMessage = (overrideMessage || input).trim();
    if (!userMessage || loading) return;
    if (!overrideMessage) setInput('');

    setMessages(prev => [...prev, { role: 'user', content: userMessage, timestamp: new Date().toISOString() }]);
    setLoading(true);
    setStreamingContent('');

    if (applicationId) {
      try {
        const abort = new AbortController();
        abortRef.current = abort;

        const res = await fetch(`${API_BASE}/chat/${applicationId}/message/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: userMessage, application_id: applicationId }),
          signal: abort.signal,
        });

        if (!res.ok) throw new Error(`Stream error: ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = '';
        let buffer = '';
        let receivedDone = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const payload = JSON.parse(line.slice(6));
              if (payload.type === 'token') {
                accumulated += payload.content;
                setStreamingContent(accumulated);
              } else if (payload.type === 'done') {
                receivedDone = true;
                setMessages(prev => [...prev, {
                  role: 'assistant',
                  content: payload.content,
                  timestamp: payload.timestamp,
                }]);
                setStreamingContent('');
                setLoading(false);
              }
            } catch { /* skip malformed SSE lines */ }
          }
        }

        if (!receivedDone && accumulated) {
          setMessages(prev => [...prev, {
            role: 'assistant', content: accumulated,
            timestamp: new Date().toISOString(),
          }]);
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: 'Sorry, I had trouble processing that. Please try again.',
            timestamp: new Date().toISOString(),
          }]);
        }
      } finally {
        setStreamingContent('');
        setLoading(false);
        abortRef.current = null;
        inputRef.current?.focus();
        fetchInterventions();
      }
    } else {
      try {
        const result = await apiPost('/chat/general/message', { message: userMessage });
        if (result?.content) {
          setMessages(prev => [...prev, { role: 'assistant', content: result.content, timestamp: result.timestamp }]);
        } else {
          setMessages(prev => [...prev, {
            role: 'assistant', content: 'Sorry, I had trouble processing that. Please try again.',
            timestamp: new Date().toISOString(),
          }]);
        }
      } catch {
        setMessages(prev => [...prev, {
          role: 'assistant', content: 'Sorry, I had trouble processing that. Please try again.',
          timestamp: new Date().toISOString(),
        }]);
      } finally {
        setLoading(false);
        inputRef.current?.focus();
      }
    }
  }, [input, loading, applicationId, fetchInterventions]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setMessages([createWelcomeMessage()]);
    setInput('');
    setStreamingContent('');
    setLoading(false);
  }, []);

  const canSend = input.trim().length > 0 && !loading;

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
              />
            ))}
          </div>
        )}
        {!loading && messages.length > 0 && messages[messages.length - 1].role === 'assistant' && (
          <SuggestedQuestions
            onSelect={(q) => sendMessage(q)}
            questions={STATUS_SUGGESTIONS[applicationStatus] || STATUS_SUGGESTIONS.default}
          />
        )}
        {loading && streamingContent && (
          <StreamingBubble content={streamingContent} />
        )}
        {loading && !streamingContent && <TypingIndicator />}
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
