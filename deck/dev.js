// dev — `storydeck dev`: the deck's own page, rebuilt on every save and reloaded on the same click (Node).
//
//   const dev = await serveDeck('my-deck');   // → http://localhost:4321/  (the next free port if that one is taken)
//   …edit any file of the deck: the page reloads on the click you were on, and plays it again…
//   await dev.close();
//
// A rebuild reads the deck's files again and compiles them in this process — no deck code runs, so serving a
// deck never executes it. The server is for one person on one machine:
//   · it listens on the loopback address only, and answers only requests addressed to localhost (a page on another
//     site cannot reach it through DNS rebinding);
//   · it only reads: GET and HEAD, the page, the reload channel, and the deck folder's own files (no hidden file,
//     nothing outside the folder, through a symlink either);
//   · it sends no CORS header, so another site's script cannot read what it serves.
import http from 'node:http';
import {watch, realpathSync, statSync, createReadStream} from 'node:fs';
import path from 'node:path';
import {deckHtml} from './build.js';
import {devClient} from './devClient.js';
import {scriptSafe} from './page.js';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp4': 'video/mp4',
  '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
};
const SAFE = {'x-content-type-options': 'nosniff', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer'};
const IGNORED = /(^|[\\/])(node_modules|\.[^\\/]*)([\\/]|$)/;   // dependencies and hidden files (.git, editor swap files)

/** The page shown before the deck has ever built: the dev client alone, which shows why and reloads once it builds. */
const waitingPage = () => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="storydeck-dev" content="0"><title>storydeck dev</title></head>
<body style="background:#0f1216"><script>(${scriptSafe(devClient)})();</script></body></html>
`;

/** A request's Host header names this server on the loopback address. */
function allowedHost(header, port) {
  if (typeof header !== 'string') return false;
  return [`localhost:${port}`, `127.0.0.1:${port}`, `[::1]:${port}`].includes(header.toLowerCase());
}

/** A file of the deck folder for a URL path, or null: no hidden segment, nothing outside the folder (symlinks resolved). */
function deckFile(root, pathname) {
  let rel;
  try { rel = decodeURIComponent(pathname); } catch { return null; }
  if (rel.includes('\0')) return null;
  const segs = rel.split(/[\\/]+/).filter(Boolean);
  if (!segs.length || segs.some((s) => s.startsWith('.'))) return null;
  let real;
  try { real = realpathSync(path.join(root, ...segs)); } catch { return null; }
  if (!real.startsWith(root + path.sep)) return null;
  try { return statSync(real).isFile() ? real : null; } catch { return null; }
}

/** Listen on the first free port from `port` (up to `tries` of them); port 0 takes any free one. */
function listen(server, port, host, tries) {
  return new Promise((resolve, reject) => {
    const attempt = (p, left) => {
      const onError = (e) => {
        server.off('listening', onListening);
        if (e.code === 'EADDRINUSE' && left > 1 && p !== 0) attempt(p + 1, left - 1);
        else reject(e.code === 'EADDRINUSE' ? new Error(`ports ${port} to ${p} are taken — pass another with --port`) : e);
      };
      const onListening = () => { server.off('error', onError); resolve(server.address().port); };
      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(p, host);
    };
    attempt(port, tries);
  });
}

/**
 * Serve a deck folder for editing. Options: port (4321; the next free one is taken), host (127.0.0.1 — loopback
 * only), watch (true), log (a line per build). Returns {url, port, close(), rebuild(), state()}.
 */
export async function serveDeck(dir, {port = 4321, host = '127.0.0.1', watch: watching = true, log = () => {}, tries = 20} = {}) {
  const root = realpathSync(path.resolve(dir));
  let version = 0, page = null, problem = null, outputs = ['index.html'];
  const clients = new Set();
  const send = (event, data) => { for (const res of clients) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };

  const rebuild = () => {
    const t0 = performance.now();
    try {
      const {compiled, html} = deckHtml(root, {dev: {client: devClient, version: version + 1}});
      version += 1;
      page = html;
      problem = null;
      outputs = [compiled.config.out, compiled.config.deckData].filter(Boolean);
      const ms = Math.round(performance.now() - t0);
      log(`built ${compiled.clicks.length} clicks in ${ms} ms`);
      send('reload', {version, ms});
    } catch (e) {
      problem = e.message;
      log(`the build stopped: ${problem}`);
      send('problem', {message: problem, version});
    }
  };
  rebuild();

  let timer = null, watcher = null;
  if (watching) {
    watcher = watch(root, {recursive: true}, (_, file) => {
      const name = file ? String(file).replace(/\\/g, '/') : null;
      if (name && (IGNORED.test(name) || outputs.includes(name))) return;   // its own output, a dependency, a hidden file
      clearTimeout(timer);
      timer = setTimeout(rebuild, 40);   // one rebuild for the burst of events a save makes
    });
  }

  let listeningPort = null;
  const server = http.createServer((req, res) => {
    const deny = (code, text) => { res.writeHead(code, {'content-type': 'text/plain; charset=utf-8', ...SAFE}); res.end(text); };
    if (!allowedHost(req.headers.host, listeningPort)) return deny(403, 'storydeck dev answers requests to localhost only');
    if (req.method !== 'GET' && req.method !== 'HEAD') return deny(405, 'storydeck dev only reads');
    const {pathname} = new URL(req.url, 'http://localhost');
    if (pathname === '/' || pathname === '/index.html') {
      res.writeHead(200, {'content-type': 'text/html; charset=utf-8', ...SAFE});
      return res.end(req.method === 'HEAD' ? undefined : page ?? waitingPage());
    }
    if (pathname === '/__storydeck/events') {
      res.writeHead(200, {'content-type': 'text/event-stream', ...SAFE, connection: 'keep-alive'});
      if (req.method === 'HEAD') return res.end();
      res.write(`retry: 800\nevent: hello\ndata: ${JSON.stringify({version, problem})}\n\n`);
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return undefined;
    }
    const file = deckFile(root, pathname);
    if (!file) return deny(404, 'not in the deck');
    res.writeHead(200, {'content-type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream', ...SAFE});
    if (req.method === 'HEAD') return res.end();
    return createReadStream(file).on('error', () => res.destroy()).pipe(res);
  });
  listeningPort = await listen(server, port, host, tries);
  const keepAlive = setInterval(() => { for (const res of clients) res.write(': still here\n\n'); }, 15000);
  keepAlive.unref();

  return {
    url: `http://${host === '127.0.0.1' || host === '0.0.0.0' ? '127.0.0.1' : host}:${listeningPort}/`,
    port: listeningPort,
    rebuild,
    state: () => ({version, problem}),
    close: () => new Promise((resolve) => {
      clearTimeout(timer);
      clearInterval(keepAlive);
      watcher?.close();
      for (const res of clients) res.end();
      clients.clear();
      server.close(() => resolve());
      server.closeAllConnections?.();
    }),
  };
}
