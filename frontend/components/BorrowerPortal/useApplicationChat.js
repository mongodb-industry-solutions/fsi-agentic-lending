"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { apiPost, apiGet } from '../../lib/api';
import { API_BASE, createWelcomeMessage } from './chatConstants';

export function useApplicationChat(applicationId) {
  const [messages, setMessages] = useState(() => [createWelcomeMessage()]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [interventions, setInterventions] = useState([]);
  const [resolvingId, setResolvingId] = useState(null);
  const [activeTools, setActiveTools] = useState([]);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const textareaRef = useRef(null);
  const abortRef = useRef(null);
  const toolsRef = useRef([]);
  const citationsRef = useRef([]);

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
    setActiveTools([]);
    toolsRef.current = [];
    citationsRef.current = [];

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
              if (payload.type === 'tool_call') {
                toolsRef.current = [...toolsRef.current, payload];
                setActiveTools([...toolsRef.current]);
              } else if (payload.type === 'token') {
                accumulated += payload.content;
                setStreamingContent(accumulated);
              } else if (payload.type === 'done') {
                receivedDone = true;
                if (payload.citations) {
                  citationsRef.current = payload.citations;
                }
                setMessages(prev => [...prev, {
                  role: 'assistant',
                  content: payload.content,
                  timestamp: payload.timestamp,
                  toolsMeta: toolsRef.current.length > 0 ? toolsRef.current : undefined,
                  citations: citationsRef.current.length > 0 ? citationsRef.current : undefined,
                }]);
                setStreamingContent('');
                setActiveTools([]);
                setLoading(false);
              }
            } catch { /* skip malformed SSE lines */ }
          }
        }

        if (!receivedDone && accumulated) {
          setMessages(prev => [...prev, {
            role: 'assistant', content: accumulated,
            timestamp: new Date().toISOString(),
            toolsMeta: toolsRef.current.length > 0 ? toolsRef.current : undefined,
            citations: citationsRef.current.length > 0 ? citationsRef.current : undefined,
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
        setActiveTools([]);
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

  const clearChat = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setMessages([createWelcomeMessage()]);
    setInput('');
    setStreamingContent('');
    setLoading(false);
  }, []);

  return {
    messages,
    input,
    setInput,
    loading,
    streamingContent,
    interventions,
    resolvingId,
    activeTools,
    messagesEndRef,
    inputRef,
    textareaRef,
    sendMessage,
    clearChat,
    resolveIntervention,
    canSend: input.trim().length > 0 && !loading,
  };
}
