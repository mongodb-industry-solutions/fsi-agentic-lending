/**
 * LendFlow API client.
 * All calls proxy through Next.js rewrites -> FastAPI backend.
 * Falls back gracefully if backend is unavailable.
 */

const API_BASE = '/api/backend';

export async function apiPost(path, body, extraHeaders = {}) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...extraHeaders },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`[LendFlow API] POST ${path} failed:`, err.message);
    return null;
  }
}

export async function apiGet(path) {
  try {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`[LendFlow API] GET ${path} failed:`, err.message);
    return null;
  }
}

export async function apiUpload(path, file, fields = {}) {
  try {
    const formData = new FormData();
    formData.append('file', file);
    Object.entries(fields).forEach(([k, v]) => formData.append(k, v));

    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error(`Upload error: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`[LendFlow API] Upload ${path} failed:`, err.message);
    return null;
  }
}

/**
 * WebSocket client with automatic reconnection.
 * Connects directly to the backend (Next.js rewrites don't support WS).
 * Derives the WS URL from NEXT_PUBLIC_BACKEND_URL so it bypasses Next.js.
 */
function deriveWsBase() {
  if (process.env.NEXT_PUBLIC_WS_BASE) return process.env.NEXT_PUBLIC_WS_BASE;
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (backendUrl) {
    return backendUrl.replace(/^http/, 'ws').replace(/\/$/, '') + '/api';
  }
  if (typeof window !== 'undefined') {
    return `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//localhost:8000/api`;
  }
  return 'ws://localhost:8000/api';
}
const WS_BASE = deriveWsBase();

export function apiWebSocket(path, { onMessage, onError, onClose, reconnect = true, maxRetries = 5 } = {}) {
  let ws = null;
  let retries = 0;
  let closed = false;
  let pingInterval = null;

  function connect() {
    if (closed) return;

    try {
      ws = new WebSocket(`${WS_BASE}${path}`);
    } catch (err) {
      console.warn('[LendFlow WS] Failed to create WebSocket:', err.message);
      if (onError) onError(err);
      return;
    }

    ws.onopen = () => {
      console.info(`[LendFlow WS] Connected: ${path}`);
      retries = 0;
      // Clear any stale interval from prior connection
      if (pingInterval) clearInterval(pingInterval);
      // Keepalive ping every 30s
      pingInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send('ping');
        }
      }, 30000);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'pong') return; // Ignore keepalive responses
        if (data.type === 'error') {
          console.warn('[LendFlow WS] Server error:', data.message);
          if (onError) onError(new Error(data.message));
          return;
        }
        if (onMessage) onMessage(data);
      } catch (err) {
        console.warn('[LendFlow WS] Parse error:', err);
      }
    };

    ws.onclose = (event) => {
      if (pingInterval) clearInterval(pingInterval);
      pingInterval = null;

      if (closed) return;
      console.info(`[LendFlow WS] Closed (code ${event.code}): ${path}`);
      if (onClose) onClose(event);

      // Reconnect with exponential backoff
      if (reconnect && retries < maxRetries && event.code !== 1000) {
        retries++;
        const delay = Math.min(1000 * Math.pow(2, retries - 1), 30000);
        console.info(`[LendFlow WS] Reconnecting in ${delay}ms (attempt ${retries}/${maxRetries})`);
        setTimeout(connect, delay);
      }
    };

    ws.onerror = (err) => {
      console.warn('[LendFlow WS] Connection error:', err);
      // onclose will fire after this
    };
  }

  connect();

  // Return a handle for cleanup
  return {
    close() {
      closed = true;
      if (pingInterval) clearInterval(pingInterval);
      if (ws && ws.readyState !== WebSocket.CLOSED) {
        ws.close(1000);
      }
    },
    send(msg) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
      }
    },
  };
}

export function apiSSE(path, onEvent, onError, { maxRetries = 5 } = {}) {
  const url = `${API_BASE}${path}`;
  let source = null;
  let lastEventId = null;
  let retries = 0;
  let closed = false;

  function connect() {
    if (closed) return;
    const connectUrl = lastEventId ? `${url}${url.includes('?') ? '&' : '?'}after=${encodeURIComponent(lastEventId)}` : url;
    source = new EventSource(connectUrl);

    source.onmessage = (event) => {
      retries = 0;
      if (event.lastEventId) lastEventId = event.lastEventId;
      try {
        const data = JSON.parse(event.data);
        onEvent(data);
        if (data.type === 'complete' || data.type === 'error' || data.type === 'hitl_waiting') {
          source.close();
          closed = true;
        }
      } catch (err) {
        console.warn('[LendFlow SSE] Parse error:', err);
      }
    };

    source.onerror = (err) => {
      console.warn('[LendFlow SSE] Connection error:', err);
      const readyState = source.readyState;
      source.close();
      if (closed) return;
      // readyState CLOSED before our close() means the connection was rejected or dropped;
      // this covers 4xx errors and permanent failures — skip retry to avoid futile loops
      if (readyState === EventSource.CLOSED) {
        console.warn('[LendFlow SSE] Connection closed by server/network, not retrying');
        if (onError) onError(err);
        return;
      }
      if (retries < maxRetries) {
        retries++;
        const delay = Math.min(1000 * Math.pow(2, retries - 1), 15000);
        console.info(`[LendFlow SSE] Reconnecting in ${delay}ms (attempt ${retries}/${maxRetries})`);
        setTimeout(connect, delay);
      } else {
        if (onError) onError(err);
      }
    };
  }

  connect();

  return {
    close() {
      closed = true;
      if (source) source.close();
    },
  };
}
