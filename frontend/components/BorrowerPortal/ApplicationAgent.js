"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { spacing } from '@leafygreen-ui/tokens';
import { apiPost, apiGet } from '../../lib/api';

/**
 * Simple markdown-like renderer. Handles headings, bold, bullets, and line breaks.
 * Returns an array of React elements — no external markdown library needed.
 */
function renderMessageContent(text) {
  if (!text) return null;

  const lines = text.split('\n');
  const elements = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const key = `line-${i}`;

    // # Heading
    if (/^# (.+)/.test(line)) {
      const match = line.match(/^# (.+)/);
      elements.push(
        <div key={key} style={{ fontWeight: 700, fontSize: 15, marginTop: i > 0 ? 8 : 0, marginBottom: 4 }}>
          {renderInline(match[1])}
        </div>
      );
      continue;
    }

    // ## Sub-heading
    if (/^## (.+)/.test(line)) {
      const match = line.match(/^## (.+)/);
      elements.push(
        <div key={key} style={{ fontWeight: 700, fontSize: 13, marginTop: i > 0 ? 6 : 0, marginBottom: 2 }}>
          {renderInline(match[1])}
        </div>
      );
      continue;
    }

    // Bullet: - item or * item
    if (/^[\-\*] (.+)/.test(line)) {
      const match = line.match(/^[\-\*] (.+)/);
      elements.push(
        <div key={key} style={{ paddingLeft: 16, position: 'relative', marginTop: 2, marginBottom: 2 }}>
          <span style={{ position: 'absolute', left: 4 }}>{'\u2022'}</span>
          {renderInline(match[1])}
        </div>
      );
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      elements.push(<div key={key} style={{ height: 6 }} />);
      continue;
    }

    // Regular line
    elements.push(
      <div key={key} style={{ marginTop: 1, marginBottom: 1 }}>
        {renderInline(line)}
      </div>
    );
  }

  return elements;
}

/** Renders inline bold markers: **text** */
function renderInline(text) {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (/^\*\*(.+)\*\*$/.test(part)) {
      const inner = part.match(/^\*\*(.+)\*\*$/)[1];
      return <strong key={idx}>{inner}</strong>;
    }
    return part;
  });
}

function TypingIndicator() {
  const dotStyle = (delay) => ({
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'var(--text-dim)',
    animation: `typingDot 1.4s ease-in-out ${delay}s infinite`,
  });

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      padding: `${spacing[2]}px 0`,
    }}>
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-dim)',
        borderRadius: 8,
        padding: `${spacing[2]}px ${spacing[3]}px`,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
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
        fontSize: 13,
        lineHeight: 1.6,
        color: 'var(--text-primary)',
      }}>
        {renderMessageContent(message.content)}
      </div>
    </div>
  );
}

const WELCOME_MESSAGE = {
  role: 'assistant',
  content: 'Welcome! I\'m your LendFlow application assistant. I can help you with document requirements, lending policies, and track your application progress. What would you like to know?',
  timestamp: new Date().toISOString(),
};

export default function ApplicationAgent({ applicationId }) {
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const textareaRef = useRef(null);

  // Load conversation history on mount
  useEffect(() => {
    if (!applicationId) return;
    apiGet(`/chat/${applicationId}/history`).then(data => {
      if (data?.messages?.length) {
        setMessages(data.messages);
      }
    });
  }, [applicationId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Auto-resize textarea
  const adjustTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const lineHeight = 20;
    const maxHeight = lineHeight * 4;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, []);

  useEffect(() => {
    adjustTextarea();
  }, [input, adjustTextarea]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || loading) return;
    const userMessage = input.trim();
    setInput('');

    // Add user message optimistically
    setMessages(prev => [...prev, { role: 'user', content: userMessage, timestamp: new Date().toISOString() }]);
    setLoading(true);

    try {
      const endpoint = applicationId
        ? `/chat/${applicationId}/message`
        : '/chat/general/message';
      const result = await apiPost(endpoint, { message: userMessage, application_id: applicationId });

      if (result?.content) {
        setMessages(prev => [...prev, { role: 'assistant', content: result.content, timestamp: result.timestamp }]);
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Sorry, I had trouble processing that. Please try again.',
          timestamp: new Date().toISOString(),
        }]);
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I had trouble processing that. Please try again.',
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, applicationId]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = useCallback(() => {
    setMessages([WELCOME_MESSAGE]);
    setInput('');
  }, []);

  const canSend = input.trim().length > 0 && !loading;

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-base)',
      minWidth: 0,
    }}>
      {/* Header */}
      <div style={{
        padding: `${spacing[3]}px ${spacing[4]}px`,
        borderBottom: '1px solid var(--border-dim)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 14,
            color: 'var(--text-primary)',
          }}>
            LendFlow Assistant
          </div>
          <div style={{
            fontSize: 10,
            color: 'var(--text-dim)',
            marginTop: 1,
          }}>
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
            fontSize: 11,
            color: 'var(--text-dim)',
            cursor: 'pointer',
            fontFamily: 'var(--font-display)',
          }}
        >
          Clear
        </button>
      </div>

      {/* Messages area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: `${spacing[3]}px ${spacing[4]}px`,
        display: 'flex',
        flexDirection: 'column',
      }}>
        {messages.map((msg, idx) => (
          <MessageBubble key={`${msg.timestamp}-${idx}`} message={msg} />
        ))}
        {loading && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div style={{
        borderTop: '1px solid var(--border-dim)',
        padding: `${spacing[3]}px ${spacing[4]}px`,
        display: 'flex',
        alignItems: 'flex-end',
        gap: spacing[2],
        flexShrink: 0,
      }}>
        <textarea
          ref={(el) => { textareaRef.current = el; inputRef.current = el; }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your application..."
          rows={1}
          style={{
            flex: 1,
            resize: 'none',
            border: '1px solid var(--border-dim)',
            borderRadius: 8,
            padding: `${spacing[2]}px ${spacing[3]}px`,
            fontSize: 13,
            lineHeight: '20px',
            color: 'var(--text-primary)',
            background: 'var(--bg-base)',
            fontFamily: 'inherit',
            outline: 'none',
            overflow: 'hidden',
          }}
          onFocus={(e) => { e.target.style.borderColor = 'var(--border-base)'; }}
          onBlur={(e) => { e.target.style.borderColor = 'var(--border-dim)'; }}
        />
        <button
          onClick={sendMessage}
          disabled={!canSend}
          style={{
            background: canSend ? 'var(--mongo)' : 'var(--border-dim)',
            color: canSend ? '#FFFFFF' : 'var(--text-dim)',
            border: 'none',
            borderRadius: 8,
            padding: `${spacing[2]}px ${spacing[3]}px`,
            fontSize: 13,
            fontWeight: 600,
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
