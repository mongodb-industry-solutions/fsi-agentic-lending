/**
 * Custom Next.js server with WebSocket proxy.
 *
 * Next.js rewrites handle REST but cannot upgrade WebSocket connections.
 * This server intercepts WS upgrade requests on /api/* paths and proxies
 * them to the backend sidecar (localhost:BACKEND_PORT).
 *
 * In K8s, both frontend and backend run as sidecars in the same pod,
 * so localhost communication works for server-side proxying.
 */
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import httpProxy from 'http-proxy';
const { createProxyServer } = httpProxy;

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);
const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const wsProxy = createProxyServer({ target: backendUrl, ws: true });

wsProxy.on('error', (err, _req, socket) => {
  console.error('[WS Proxy] Error:', err.message);
  if (socket && typeof socket.destroy === 'function') {
    socket.destroy();
  }
});

app.prepare().then(() => {
  console.log(`> Backend target: ${backendUrl} (WebSocket proxy enabled)`);

  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  // Intercept WebSocket upgrade requests for /api/* paths
  server.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url);
    if (pathname?.startsWith('/api/')) {
      // Rewrite /api/backend/... → /api/... for the backend
      if (pathname.startsWith('/api/backend/')) {
        req.url = '/api/' + pathname.slice('/api/backend/'.length);
      }
      wsProxy.ws(req, socket, head);
    }
    // Non-/api/ upgrades (e.g., Next.js HMR in dev) are left unhandled —
    // the default Node HTTP server will pass them through to Next.js.
  });

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> WebSocket proxy: /api/* → ${backendUrl}`);
  });
}).catch((err) => {
  console.error('Failed to start Next.js:', err);
  process.exit(1);
});
