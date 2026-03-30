/**
 * LendFlow API client.
 * All calls proxy through Next.js rewrites -> FastAPI backend.
 * Falls back gracefully if backend is unavailable.
 */

const API_BASE = '/api/backend';

export async function apiPost(path, body) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

export function apiSSE(path, onEvent, onError) {
  const url = `${API_BASE}${path}`;
  const source = new EventSource(url);

  source.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onEvent(data);
    } catch (err) {
      console.warn('[LendFlow SSE] Parse error:', err);
    }
  };

  source.onerror = (err) => {
    console.warn('[LendFlow SSE] Connection error:', err);
    if (onError) onError(err);
    source.close();
  };

  return source; // Caller can call source.close() to disconnect
}
