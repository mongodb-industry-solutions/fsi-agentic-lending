"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { apiPost, apiGet } from '../../lib/api';
import { API_BASE, createWelcomeMessage } from './chatConstants';

// Milestone-level proactive messages. The internal working statuses
// (processing/credit/underwriting/review) collapse into a single "in review"
// announcement so the borrower isn't spammed as the pipeline walks through
// them (or re-walks them on a re-run / SSE reconnect). Each milestone is
// announced at most once per application.
const STATUS_MILESTONES = {
  processing: { key: 'in-review', text: 'Your application is now being reviewed.' },
  credit: { key: 'in-review', text: 'Your application is now being reviewed.' },
  underwriting: { key: 'in-review', text: 'Your application is now being reviewed.' },
  review: { key: 'in-review', text: 'Your application is now being reviewed.' },
  approved: { key: 'approved', text: 'Your application has been approved.' },
  declined: { key: 'declined', text: 'Your application decision is ready.' },
  closing: { key: 'closing', text: 'Your application is moving to the closing stage.' },
  funded: { key: 'funded', text: 'Your loan is now active.' },
  active: { key: 'funded', text: 'Your loan is now active.' },
};

export function useApplicationChat(applicationId, applicationStatus) {
  const [messages, setMessages] = useState(() => [createWelcomeMessage()]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [interventions, setInterventions] = useState([]);
  const [resolvingId, setResolvingId] = useState(null);
  const [activeTools, setActiveTools] = useState([]);
  const [pendingComponents, setPendingComponents] = useState([]);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const textareaRef = useRef(null);
  const abortRef = useRef(null);
  const abortedRef = useRef(false);
  const toolsRef = useRef([]);
  const citationsRef = useRef([]);
  const uiComponentsRef = useRef([]);

  // Bug 3: dedicated reset on applicationId change so the previous
  // conversation, interventions, streaming state, and refs don't leak into
  // the new app. Runs before the history fetch so there's no flash of the
  // previous user's chat. Skips the initial mount (applicationId stays
  // constant on first render; the main history fetch handles that path).
  const firstAppIdRef = useRef(true);
  useEffect(() => {
    if (firstAppIdRef.current) {
      firstAppIdRef.current = false;
      return;
    }
    if (abortRef.current) abortRef.current.abort();
    abortedRef.current = true;
    setMessages([createWelcomeMessage()]);
    setInterventions([]);
    setStreamingContent('');
    setActiveTools([]);
    setPendingComponents([]);
    setLoading(false);
    toolsRef.current = [];
    citationsRef.current = [];
    uiComponentsRef.current = [];
  }, [applicationId]);

  useEffect(() => {
    if (!applicationId) return;
    // Guard against a stale history response from a previous applicationId
    // resolving after the user has switched borrowers. Without this, app A's
    // history could overwrite app B's freshly-seeded welcome state.
    let cancelled = false;
    apiGet(`/chat/${applicationId}/history`).then(data => {
      if (cancelled) return;
      if (data?.messages?.length) {
        // A2: returning user — if server history already contains an assistant
        // reply, strip any stored isWelcome flag so WelcomeCard doesn't render
        // on top of a real conversation.
        const hasRealAssistant = data.messages.some(
          m => m.role === 'assistant' && !m.isWelcome
        );
        setMessages(hasRealAssistant
          ? data.messages.map(m => ({ ...m, isWelcome: false }))
          : data.messages);
      }
      // else: reset effect already seeded [welcome], leave it alone
    });
    return () => { cancelled = true; };
  }, [applicationId]);

  const fetchInterventions = useCallback(() => {
    if (!applicationId) return;
    apiGet(`/chat/${applicationId}/interventions`).then(data => {
      if (data?.interventions) {
        setInterventions(prev => {
          const resolvedIds = new Set(prev.filter(i => i._resolved).map(i => i._id));
          return data.interventions.map(i => ({
            ...i,
            _resolved: i.status === 'resolved' || resolvedIds.has(i._id),
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
      // Auto-trigger pipeline re-evaluate when all blocking interventions are resolved
      if (result.re_evaluate_eligible) {
        apiPost(`/agent/${applicationId}/re-evaluate`).catch((err) => {
          console.warn('[useApplicationChat] re-evaluate after intervention resolve failed:', err);
        });
      }
    }
    setResolvingId(null);
  }, [applicationId]);

  // Proactive system messages on milestone changes. Announce each high-level
  // milestone at most once per application, so re-runs / SSE reconnects that
  // re-walk processing → underwriting → review don't re-spam the borrower.
  const prevAppIdForStatusRef = useRef(null);
  const announcedMilestonesRef = useRef(new Set());
  useEffect(() => {
    if (!applicationId) return;
    // On app switch, reset and seed the current milestone as already-announced
    // so resuming an in-flight app doesn't retroactively emit a banner.
    if (prevAppIdForStatusRef.current !== applicationId) {
      prevAppIdForStatusRef.current = applicationId;
      announcedMilestonesRef.current = new Set();
      const seed = STATUS_MILESTONES[applicationStatus];
      if (seed) announcedMilestonesRef.current.add(seed.key);
      return;
    }
    const milestone = STATUS_MILESTONES[applicationStatus];
    if (milestone && !announcedMilestonesRef.current.has(milestone.key)) {
      announcedMilestonesRef.current.add(milestone.key);
      setMessages(prev => [...prev, {
        role: 'system', content: milestone.text, timestamp: new Date().toISOString(),
      }]);
    }
  }, [applicationStatus, applicationId]);

  // Abort any in-flight streaming fetch on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, streamingContent]);

  const adjustTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    // Grow up to ~7 lines; beyond that the textarea's own overflow:auto
    // lets the borrower scroll inside the input rather than clipping.
    const maxHeight = 20 * 7;
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
    setPendingComponents([]);
    toolsRef.current = [];
    citationsRef.current = [];
    uiComponentsRef.current = [];
    abortedRef.current = false;

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
              } else if (payload.type === 'ui_component') {
                uiComponentsRef.current = [...uiComponentsRef.current, {
                  component: payload.component,
                  data: payload.data,
                  id: payload.id,
                  status: payload.status || 'ready',
                }];
                setPendingComponents([...uiComponentsRef.current]);
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
                  uiComponents: uiComponentsRef.current.length > 0 ? uiComponentsRef.current : undefined,
                }]);
                setStreamingContent('');
                setActiveTools([]);
                setPendingComponents([]);
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
            uiComponents: uiComponentsRef.current.length > 0 ? uiComponentsRef.current : undefined,
          }]);
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          abortedRef.current = true;
        } else {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: 'Sorry, I had trouble processing that. Please try again.',
            timestamp: new Date().toISOString(),
          }]);
        }
      } finally {
        setStreamingContent('');
        setActiveTools([]);
        setPendingComponents([]);
        setLoading(false);
        abortRef.current = null;
        inputRef.current?.focus();
        // Bug 4: if the request was aborted (user hit Stop or switched apps),
        // skip the trailing intervention refresh so it can't overwrite the
        // freshly-cleared list for the new context.
        if (!abortedRef.current) fetchInterventions();
        abortedRef.current = false;
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
    if (abortRef.current) {
      abortedRef.current = true;
      abortRef.current.abort();
    }
    setMessages([createWelcomeMessage()]);
    setInput('');
    setStreamingContent('');
    setLoading(false);
    // B6: full ephemeral cleanup so a stale in-flight streaming frame doesn't
    // leak into the new conversation.
    setActiveTools([]);
    setPendingComponents([]);
    toolsRef.current = [];
    citationsRef.current = [];
    uiComponentsRef.current = [];
  }, []);

  // UX 1: exposed so the input area can render a Stop button. Marks the
  // active fetch as aborted so finally knows to skip fetchInterventions().
  const abort = useCallback(() => {
    if (abortRef.current) {
      abortedRef.current = true;
      abortRef.current.abort();
    }
  }, []);

  // UX 7: welcome-card dismiss. Removes the seeded welcome message; the
  // effect that fetches history can still populate real chat.
  const dismissWelcome = useCallback(() => {
    setMessages(prev => prev.filter(m => !m.isWelcome));
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
    pendingComponents,
    messagesEndRef,
    inputRef,
    textareaRef,
    sendMessage,
    clearChat,
    resolveIntervention,
    abort,
    dismissWelcome,
    canSend: input.trim().length > 0 && !loading,
  };
}
