// dev — `storydeck dev`: the deck's own page, rebuilt on every save and reloaded on the same click (Node).
//
//   const dev = await serveDeck('my-deck');   // → http://localhost:4321/  (the next free port if that one is taken)
//   …edit any file of the deck: the page reloads on the click you were on, and plays it again…
//   await dev.close();
//
// A rebuild reads the deck's files again and compiles them in this process — no deck code runs, so serving a
// deck never executes it. Co-editing: in the page a person can leave a note on a click (into feedback.md, signed with
// their own note key so a reader knows it for theirs: noteKey.js) and Alt-drag a piece (its left/top, or its wire's
// coordinates, written into its map). Those are the only two writes, each one checked: the page's own origin, the
// page's own token, JSON, small. A move names the piece by the number this build gave it (data-sd-at, in the dev page
// only), and is refused while the build is failing, when the map changed since the build, or when the build's pieces
// are not its file's. The server is for one person on one machine:
//   · it listens on the loopback address only, and answers only requests addressed to localhost (a page on another
//     site cannot reach it through DNS rebinding);
//   · it reads the page, the reload channel and the deck folder's own files (paths.js · servedFile: no hidden file,
//     nothing outside the folder, through a link either), and writes only the two edits above (paths.js · writeInside);
//   · it sends no CORS header and marks every answer same-origin only, so another site cannot read, embed or frame it;
//   · every answer runs only StoryDeck's own scripts (a nonce policy): no script a deck carries runs in the dev page or
//     in any file of the folder served on its own, so none can read the page's token and send its edits;
//   · a request it cannot read is answered 400; nothing a request sends can stop the server.
// A deck's own HTML still renders in the page, as any page you open does (its scripts run in the built page only).
import http from 'node:http';
import {randomBytes, timingSafeEqual} from 'node:crypto';
import {watch, createReadStream, readdirSync, lstatSync} from 'node:fs';
import path from 'node:path';
import {deckHtml} from './build.js';
import {devClient} from './devClient.js';
import {scriptSafe} from './html.js';
import {deckRoot, servedFile, presence, writeInside} from './paths.js';
import {deckFileText, mapFile} from './source.js';
import {FEEDBACK, nudgePiece, sourcePieces, mapAmbiguity, cleanNote, feedbackLine, appendFeedback, readFeedback} from './edit.js';
import {noteKey, signNote, signedBy, storydeckHome} from './noteKey.js';

const MAX_BODY = 16 * 1024;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp4': 'video/mp4',
  '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
};
/**
 * The headers of every answer: no sniffing, no caching, no referrer, readable and frameable by this origin only — and a
 * policy that runs only the scripts carrying this server's nonce (StoryDeck's own: page.js marks them), so nothing a
 * deck carries, in its page or any file of its folder, runs here: no deck script can read the page's token and send
 * its edits. (A deck's own scripts run in the page `storydeck build` writes.)
 */
const answerHeaders = (nonce) => ({'x-content-type-options': 'nosniff', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer',
  'cross-origin-resource-policy': 'same-origin', 'x-frame-options': 'SAMEORIGIN',
  'content-security-policy': `script-src 'nonce-${nonce}'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'`});
const LOOPBACK = ['127.0.0.1', '::1', 'localhost'];
const IGNORED = /(^|[\\/])(node_modules|\.[^\\/]*)([\\/]|$)/;   // dependencies and hidden files (.git, editor swap files)

/**
 * What a move may edit, map by map, as this build read it: {file, text, names} — or {why} when the pieces the build drew
 * are not the pieces of the map's source, in the same order (an icon file holding pieces of its own, a comment inside a
 * tag), so no piece number could be trusted to name the same one in both.
 */
function editableMaps(source, compiled) {
  return Object.fromEntries(Object.entries(compiled.maps).map(([name, {pieces}]) => {
    const text = source.maps[name], names = pieces.map((p) => p.keys[0]);
    const odd = mapAmbiguity(text);
    if (odd) return [name, {why: `a browser reads it differently from the build (${odd})`}];
    const same = sourcePieces(text).map((p) => p.name).join('\n') === names.join('\n');
    return [name, same ? {file: mapFile(source.config, name), text, names} : {why: 'the pieces it draws are not the pieces its file holds, in that order (an icon holding pieces of its own)'}];
  }));
}

/** When a note was left, in the person's own clock: "2026-10-21 14:05". */
function localStamp(d) {
  const two = (v) => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`;
}

/**
 * The deck folder's stamp: every file it holds (not hidden, not a dependency, not its own output) with its size and
 * time. A file watcher can miss a save (some disks, a busy machine); comparing stamps once a second never does.
 */
export function folderStamp(root, outputs = []) {
  const lines = [];
  const walk = (dir, rel) => {
    let names;
    try { names = readdirSync(dir).sort(); } catch { return; }
    for (const name of names) {
      const r = rel ? `${rel}/${name}` : name;
      if (IGNORED.test(r) || outputs.includes(r)) continue;
      let st;
      try { st = lstatSync(path.join(dir, name)); } catch { continue; }
      if (st.isDirectory()) walk(path.join(dir, name), r);
      else lines.push(`${r} ${st.size} ${st.mtimeMs}`);
    }
  };
  walk(root, '');
  return lines.join('\n');
}

/** The page shown before the deck has ever built: the dev client alone, which shows why and reloads once it builds. */
const waitingPage = (token, nonce) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="storydeck-dev" content="0"><meta name="storydeck-dev-token" content="${token}"><title>storydeck dev</title></head>
<body style="background:#0f1216"><script nonce="${nonce}">(${scriptSafe(devClient)})();</script></body></html>
`;

/** A request's Host header names this server on the loopback address. */
function allowedHost(header, port) {
  if (typeof header !== 'string') return false;
  return [`localhost:${port}`, `127.0.0.1:${port}`, `[::1]:${port}`].includes(header.toLowerCase());
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
 * Serve a deck folder for editing. Options: port (4321; the next free one is taken), host (127.0.0.1, ::1 or localhost
 * — loopback only, anything else is refused), watch (true: a save rebuilds at once), poll (1000 ms: and the folder's
 * stamp is compared that often, so a save the watcher missed still rebuilds; 0 turns it off), log (a line per build),
 * home (where the person's note key lives: noteKey.js). Returns {url, port, close(), rebuild(), state()}.
 */
export async function serveDeck(dir, {port = 4321, host = '127.0.0.1', watch: watching = true, poll = 1000, log = () => {}, tries = 20, home = storydeckHome()} = {}) {
  if (!LOOPBACK.includes(host)) throw new Error(`storydeck dev listens on this machine only (${LOOPBACK.join(', ')}), not on ${host}`);
  const root = deckRoot(dir);
  // feedback.md is written by the page itself: a note never rebuilds the deck
  let version = 0, page = null, problem = null, outputs = ['index.html', FEEDBACK], stamp = null, current = null;
  const token = randomBytes(16).toString('hex');   // only the page this server serves can read it
  const nonce = randomBytes(16).toString('base64');   // only StoryDeck's own scripts carry it
  const SAFE = answerHeaders(nonce);
  const clients = new Set();
  const send = (event, data) => { for (const res of clients) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };

  const rebuild = () => {
    const t0 = performance.now();
    stamp = folderStamp(root, outputs);   // what this build read: a later stamp that differs is a save
    try {
      const {source, compiled, html} = deckHtml(root, {dev: {client: devClient, version: version + 1, token, nonce}});
      version += 1;
      page = html;
      problem = null;
      current = {compiled, maps: editableMaps(source, compiled)};
      outputs = [compiled.config.out, compiled.config.deckData, FEEDBACK].filter(Boolean);
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

  let timer = null, watcher = null, poller = null;
  if (poll > 0) {
    poller = setInterval(() => { if (folderStamp(root, outputs) !== stamp) rebuild(); }, poll);
    poller.unref();
  }
  if (watching) {
    watcher = watch(root, {recursive: true}, (_, file) => {
      const name = file ? String(file).replace(/\\/g, '/') : null;
      if (name && (IGNORED.test(name) || outputs.includes(name))) return;   // its own output, a dependency, a hidden file
      clearTimeout(timer);
      // one rebuild for the burst of events a save makes — and none when the folder is as the last build read it (an
      // edit from the page has already rebuilt)
      timer = setTimeout(() => { if (folderStamp(root, outputs) !== stamp) rebuild(); }, 40);
    });
  }

  let listeningPort = null;
  /** The two edits the page may send: a note on a click, and a piece moved. */
  const write = async (pathname, body) => {
    if (!current) return [409, {error: 'the deck has not built yet — fix it first'}];
    const {compiled, maps} = current;
    if (pathname === '/__storydeck/feedback') {
      const n = body.click;
      if (!Number.isInteger(n) || n < 1 || n > compiled.clicks.length) return [400, {error: `no click ${JSON.stringify(n)}`}];
      if (typeof body.text !== 'string') return [400, {error: 'a note is text'}];
      const note = cleanNote({n, label: compiled.clicks[n - 1].label, text: body.text, at: localStamp(new Date())});
      const {key, why} = noteKey(home, {create: true, deck: root});
      if (!key) return [409, {error: `${why} — a note is signed with it, so it is known for yours`}];
      const file = path.join(root, FEEDBACK);
      const after = appendFeedback(presence(file) === 'missing' ? '' : deckFileText(root, FEEDBACK), feedbackLine(note, signNote(key, note, root)));
      writeInside(root, file, after);
      log(`noted on click ${n}`);
      return [200, {ok: true, open: readFeedback(after).filter((f) => !f.done && signedBy(key, f, root)).length}];
    }
    const {map, index, name, dx, dy} = body;
    if (typeof map !== 'string' || !Object.hasOwn(maps, map)) return [400, {error: `no map ${JSON.stringify(map)}`}];
    if (!Number.isInteger(index) || index < 0 || typeof name !== 'string') return [400, {error: 'name the piece moved: its number and its name'}];
    if (typeof dx !== 'number' || typeof dy !== 'number') return [400, {error: 'a move is two numbers of px'}];
    // the page shows the last good build: while a save keeps it from building, it may not show what the files hold
    if (problem) return [409, {error: 'the deck does not build right now — fix that first, then move pieces'}];
    const {file, text, names, why} = maps[map];
    if (why) return [409, {error: `map "${map}": ${why} — move its pieces in the file`}];
    if (names[index] !== name) return [409, {error: `the page and the build disagree on piece ${index} ("${name}") — reload the page`}];
    const now = deckFileText(root, file);
    if (now !== text) return [409, {error: 'the map changed since the page was built — the page reloads with the new one'}];
    writeInside(root, path.join(root, file), nudgePiece(now, {index, name}, dx, dy));
    log(`moved "${name}" by ${dx}, ${dy} in ${file}`);
    rebuild();   // at once, so the page reloads on the new place without waiting for the watcher
    return [200, {ok: true}];
  };

  /** A write request, checked: the page's own origin and token, JSON, at most 16 KB. */
  const edit = (req, res, pathname) => {
    const reply = (code, body) => { res.writeHead(code, {'content-type': 'application/json; charset=utf-8', ...SAFE}); res.end(JSON.stringify(body)); };
    const own = [`http://localhost:${listeningPort}`, `http://127.0.0.1:${listeningPort}`, `http://[::1]:${listeningPort}`];
    if (!own.includes(String(req.headers.origin ?? '').toLowerCase())) return reply(403, {error: 'an edit comes from the dev page itself'});
    const sent = Buffer.from(String(req.headers['x-storydeck-token'] ?? '')), mine = Buffer.from(token);
    if (sent.length !== mine.length || !timingSafeEqual(sent, mine)) return reply(403, {error: 'an edit carries the dev page\'s token'});
    if (!/^application\/json\b/i.test(String(req.headers['content-type'] ?? ''))) return reply(415, {error: 'an edit is JSON'});
    // too big: answered once, and the connection closed after the answer (the rest of the body is never kept)
    const tooBig = () => { res.setHeader('connection', 'close'); reply(413, {error: 'an edit is at most 16 KB'}); };
    if (Number(req.headers['content-length']) > MAX_BODY) return tooBig();
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      if (size > MAX_BODY) return;
      size += c.length;
      if (size > MAX_BODY) { chunks.length = 0; tooBig(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (size > MAX_BODY) return;
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return reply(400, {error: 'an edit is JSON'}); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return reply(400, {error: 'an edit is a JSON object'});
      write(pathname, body).then(([code, out]) => reply(code, out), (e) => reply(409, {error: e.message}));
    });
    return undefined;
  };

  const answer = (req, res) => {
    const deny = (code, text) => { res.writeHead(code, {'content-type': 'text/plain; charset=utf-8', ...SAFE}); res.end(text); };
    if (!allowedHost(req.headers.host, listeningPort)) return deny(403, 'storydeck dev answers requests to localhost only');
    if (req.method === 'POST') {
      let edited;
      try { edited = new URL(req.url, 'http://localhost').pathname; } catch { return deny(400, 'a request storydeck dev cannot read'); }
      if (edited === '/__storydeck/feedback' || edited === '/__storydeck/move') return edit(req, res, edited);
      return deny(405, 'storydeck dev takes two edits only: a note, and a piece moved');
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return deny(405, 'storydeck dev only reads, and takes two edits from its page');
    let pathname;
    try { ({pathname} = new URL(req.url, 'http://localhost')); } catch { return deny(400, 'a request storydeck dev cannot read'); }
    if (pathname === '/' || pathname === '/index.html') {
      res.writeHead(200, {'content-type': 'text/html; charset=utf-8', ...SAFE});
      return res.end(req.method === 'HEAD' ? undefined : page ?? waitingPage(token, nonce));
    }
    if (pathname === '/__storydeck/events') {
      res.writeHead(200, {'content-type': 'text/event-stream', ...SAFE, connection: 'keep-alive'});
      if (req.method === 'HEAD') return res.end();
      res.write(`retry: 800\nevent: hello\ndata: ${JSON.stringify({version, problem})}\n\n`);
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return undefined;
    }
    const file = servedFile(root, pathname);
    if (!file) return deny(404, 'not in the deck');
    res.writeHead(200, {'content-type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream', ...SAFE});
    if (req.method === 'HEAD') return res.end();
    return createReadStream(file).on('error', () => res.destroy()).pipe(res);
  };
  const server = http.createServer((req, res) => {
    try {
      answer(req, res);
    } catch {
      // nothing a request sends may stop the server: answer it, or drop it if the answer had begun
      if (res.headersSent) res.destroy(); else { res.writeHead(500, {'content-type': 'text/plain; charset=utf-8', ...SAFE}); res.end('storydeck dev could not answer that'); }
    }
  });
  server.on('clientError', (_, socket) => socket.destroy());
  listeningPort = await listen(server, port, host, tries);
  const keepAlive = setInterval(() => { for (const res of clients) res.write(': still here\n\n'); }, 15000);
  keepAlive.unref();

  return {
    url: `http://${host === '::1' ? '[::1]' : host}:${listeningPort}/`,
    port: listeningPort,
    rebuild,
    state: () => ({version, problem}),
    close: () => new Promise((resolve) => {
      clearTimeout(timer);
      clearInterval(poller);
      clearInterval(keepAlive);
      watcher?.close();
      for (const res of clients) res.end();
      clients.clear();
      server.close(() => resolve());
      server.closeAllConnections?.();
    }),
  };
}
