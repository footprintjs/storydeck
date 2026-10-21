// @vitest-environment node
import {afterEach, describe, it, expect} from 'vitest';
import http from 'node:http';
import net from 'node:net';
import {chmodSync, existsSync, readFileSync, statSync, symlinkSync, writeFileSync, mkdirSync} from 'node:fs';
import path from 'node:path';
import {serveDeck, folderStamp} from './dev.js';
import {STARTER} from './init.js';
import {tempDeck, tempDir, cleanDecks} from './test/helpers.js';

const servers = [];
afterEach(async () => {
  while (servers.length) await servers.pop().close();
  cleanDecks();
});
const serve = async (dir, opts = {}) => {
  const s = await serveDeck(dir, {port: 0, ...opts});
  servers.push(s);
  return s;
};

/** One request: {status, type, body}. */
function get(server, pathname, {host = `localhost:${server.port}`, method = 'GET'} = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({host: '127.0.0.1', port: server.port, path: pathname, method, headers: host === null ? {} : {host}}, (res) => {
      let body = '';
      res.on('data', (d) => { body += d; });
      res.on('end', () => resolve({status: res.statusCode, type: res.headers['content-type'], headers: res.headers, body}));
    });
    req.on('error', reject);
    req.end();
  });
}

/** The reload channel: the events it sends, as they come; `stop()` hangs up. */
function listen(server) {
  const events = [];
  let req;
  const opened = new Promise((resolve) => {
    req = http.get({host: '127.0.0.1', port: server.port, path: '/__storydeck/events', headers: {host: `127.0.0.1:${server.port}`}}, (res) => {
      let buf = '';
      res.on('data', (d) => {
        buf += d;
        for (let i = buf.indexOf('\n\n'); i >= 0; i = buf.indexOf('\n\n')) {
          const block = buf.slice(0, i);
          buf = buf.slice(i + 2);
          const event = /^event: (.+)$/m.exec(block)?.[1], data = /^data: (.+)$/m.exec(block)?.[1];
          if (event) events.push({event, data: JSON.parse(data)});
        }
      });
      resolve();
    });
  });
  const until = async (pred, ms = 8000) => {   // a file watcher can be slow under a loaded machine
    const t0 = Date.now();
    while (!pred(events)) {
      if (Date.now() - t0 > ms) throw new Error(`no such event in ${JSON.stringify(events)}`);
      await new Promise((r) => setTimeout(r, 20));
    }
    return events;
  };
  return {events, opened, until, stop: () => req.destroy()};
}

describe('serveDeck', () => {
  it('serves the deck\'s own page with the dev client, and its files', async () => {
    const lines = [];
    const s = await serve(tempDeck(), {log: (l) => lines.push(l)});
    expect(s.url).toBe(`http://127.0.0.1:${s.port}/`);
    const page = await get(s, '/');
    expect(page).toMatchObject({status: 200, type: 'text/html; charset=utf-8'});
    expect(page.body).toContain('<meta name="storydeck-dev" content="1">');
    expect(page.body).toContain('__sdDev');
    expect(page.headers).toMatchObject({'x-content-type-options': 'nosniff', 'cache-control': 'no-store', 'cross-origin-resource-policy': 'same-origin'});
    expect(page.headers['access-control-allow-origin']).toBeUndefined();
    expect((await get(s, '/index.html')).status).toBe(200);
    expect(await get(s, '/icons/server.svg')).toMatchObject({status: 200, type: 'image/svg+xml'});
    expect((await get(s, '/deck.json')).type).toBe('application/json; charset=utf-8');
    expect((await get(s, '/', {method: 'HEAD'})).body).toBe('');
    expect((await get(s, '/icons/server.svg', {method: 'HEAD'})).body).toBe('');
    expect(lines[0]).toMatch(/^built 6 clicks in \d+ ms$/);
    expect(s.state()).toEqual({version: 1, problem: null});
  });

  it('answers only requests addressed to localhost, and only reads', async () => {
    const s = await serve(tempDeck());
    expect((await get(s, '/', {host: `evil.example:${s.port}`})).status).toBe(403);
    expect((await get(s, '/', {host: `localhost:${s.port + 1}`})).status).toBe(403);
    for (const host of [`127.0.0.1:${s.port}`, `[::1]:${s.port}`, `LOCALHOST:${s.port}`]) expect((await get(s, '/', {host})).status).toBe(200);
    expect((await get(s, '/', {method: 'POST'})).status).toBe(405);
    expect((await get(s, '/', {method: 'PUT'})).status).toBe(405);
  });

  it('serves nothing hidden, nothing outside the folder, and nothing through a link that leaves it or hides', async () => {
    const dir = tempDeck({...STARTER, '.env': 'SECRET=1', 'sub/.hidden': 'x'});
    const secret = path.join(tempDir(), 'secret.txt');
    writeFileSync(secret, 'TOP SECRET');
    symlinkSync(secret, path.join(dir, 'leak.txt'));
    symlinkSync(path.join(dir, '.env'), path.join(dir, 'env.txt'));
    mkdirSync(path.join(dir, 'pics'));
    const s = await serve(dir);
    for (const p of ['/.env', '/sub/.hidden', '/../package.json', '/%2e%2e/%2e%2e/etc/passwd', '/leak.txt', '/env.txt', '/icons', '/nope.png', '/%E0%A4%A', '/a%00b', '/pics']) {
      const r = await get(s, p);
      expect([p, r.status]).toEqual([p, 404]);
      expect(r.body).not.toContain('SECRET');
    }
  });

  it('rebuilds on a save and tells the page to reload; a save that breaks the build says why and keeps the last good page', async () => {
    const dir = tempDeck();
    const s = await serve(dir, {watch: false, poll: 50});   // the stamp, which never misses a save
    const ch = listen(s);
    await ch.opened;
    await ch.until((e) => e.some((x) => x.event === 'hello'));
    expect(ch.events[0]).toEqual({event: 'hello', data: {version: 1, problem: null}});
    const clicks = path.join(dir, 'clicks.html'), orig = readFileSync(clicks, 'utf8');
    writeFileSync(clicks, orig.replace('A client needs data', 'A client needs its data'));
    await ch.until((e) => e.some((x) => x.event === 'reload'));
    expect((await get(s, '/')).body).toContain('A client needs its data');
    writeFileSync(clicks, orig.replace('data-on="server time"', 'data-on="server nope"'));
    const ev = await ch.until((e) => e.some((x) => x.event === 'problem'));
    expect(ev.find((x) => x.event === 'problem').data.message).toMatch(/"2 · Close in" click 1: no piece "nope"/);
    expect((await get(s, '/')).body).toContain('A client needs its data');   // the last good page
    expect(s.state().problem).toMatch(/no piece "nope"/);
    ch.stop();
  }, 30000);   // a file watcher can be slow on a loaded machine

  it('does not rebuild for its own output, a hidden file, or a dependency', async () => {
    const dir = tempDeck();
    const s = await serve(dir, {poll: 50});
    await new Promise((r) => setTimeout(r, 300));   // the folder's own creation may still be reported (macOS FSEvents)
    const v = s.state().version;
    writeFileSync(path.join(dir, 'index.html'), 'built elsewhere');
    writeFileSync(path.join(dir, '.notes.swp'), 'x');
    mkdirSync(path.join(dir, 'node_modules'));
    writeFileSync(path.join(dir, 'node_modules', 'x.js'), 'x');
    await new Promise((r) => setTimeout(r, 300));
    expect(s.state().version).toBe(v);
  });

  it('shows why before the deck has ever built, and serves the deck once a save fixes it', async () => {
    const dir = tempDeck({...STARTER, 'deck.json': '{"titel": "x"}'});
    const s = await serve(dir, {watch: false, poll: 50});
    expect(s.state()).toEqual({version: 0, problem: expect.stringMatching(/"titel", which it does not know/)});
    const page = await get(s, '/');
    expect(page.body).toContain('<meta name="storydeck-dev" content="0">');
    expect(page.body).not.toContain('<deck-stage width');
    const ch = listen(s);
    await ch.opened;
    await ch.until((e) => e.some((x) => x.event === 'hello' && x.data.problem));
    writeFileSync(path.join(dir, 'deck.json'), '{"title": "Fixed"}');
    await ch.until((e) => e.some((x) => x.event === 'reload' && x.data.version === 1));
    expect((await get(s, '/')).body).toContain('<title>Fixed</title>');
    ch.stop();
  }, 30000)

  it('answers a request it cannot read with 400, and keeps serving', async () => {
    const s = await serve(tempDeck(), {watch: false});
    expect((await get(s, '//[')).status).toBe(400);
    expect((await get(s, '/')).status).toBe(200);
    // a request line Node itself cannot parse is dropped, and the server stays up
    await new Promise((resolve) => {
      const sock = net.connect(s.port, '127.0.0.1', () => sock.end('GARBAGE\r\n\r\n'));
      sock.on('close', resolve);
      sock.on('error', resolve);
    });
    expect((await get(s, '/')).status).toBe(200);
  });

  it('listens on this machine only, and names a folder that is not there', async () => {
    await expect(serveDeck(tempDeck(), {port: 0, host: '0.0.0.0', watch: false})).rejects.toThrow(/listens on this machine only \(127\.0\.0\.1, ::1, localhost\), not on 0\.0\.0\.0/);
    await expect(serveDeck(path.join(tempDir(), 'nope'), {port: 0, watch: false})).rejects.toThrow(/nope is not a folder — a deck is a folder with deck.json/);
    const s = await serve(tempDeck(), {host: 'localhost', watch: false});
    expect(s.url).toBe(`http://localhost:${s.port}/`);
  });

  it('takes the next free port when the one asked for is taken, and says so when none is', async () => {
    const blocker = net.createServer().listen(0, '127.0.0.1');
    await new Promise((r) => blocker.once('listening', r));
    const taken = blocker.address().port;
    const s = await serve(tempDeck(), {port: taken, watch: false});
    expect(s.port).not.toBe(taken);
    await expect(serveDeck(tempDeck(), {port: taken, tries: 1, watch: false})).rejects.toThrow(`ports ${taken} to ${taken} are taken — pass another with --port`);
    blocker.close();
  });

  it('rebuilds at once on the watcher alone, when it hears the save', {retry: 2}, async () => {
    const dir = tempDeck();
    const s = await serve(dir, {poll: 0});
    await new Promise((r) => setTimeout(r, 300));   // the folder's own creation may still be reported (macOS FSEvents)
    const v = s.state().version;
    writeFileSync(path.join(dir, 'theme.css'), `${STARTER['theme.css']}\n/* edited */`);
    const t0 = Date.now();
    while (s.state().version === v && Date.now() - t0 < 8000) await new Promise((r) => setTimeout(r, 20));
    expect(s.state().version).toBeGreaterThan(v);
  }, 30000);

  it('stamps the folder by what a save changes: files, their sizes and times — never hidden ones, dependencies or its output', () => {
    const dir = tempDeck({...STARTER, '.git/HEAD': 'x', 'node_modules/a/index.js': 'x', 'index.html': 'built'});
    const stamp = folderStamp(dir, ['index.html']);
    expect(stamp).toContain('clicks.html ');
    expect(stamp).toContain('icons/server.svg ');
    expect(stamp).not.toMatch(/\.git|node_modules|index\.html/);
    writeFileSync(path.join(dir, 'index.html'), 'built again, longer');
    writeFileSync(path.join(dir, '.git', 'HEAD'), 'moved');
    expect(folderStamp(dir, ['index.html'])).toBe(stamp);
    writeFileSync(path.join(dir, 'map.html'), `${STARTER['map.html']} `);
    expect(folderStamp(dir, ['index.html'])).not.toBe(stamp);
    expect(folderStamp(path.join(dir, 'missing'))).toBe('');
  });

  it('rebuilds when asked, and hangs up on the page when it closes', async () => {
    const s = await serve(tempDeck(), {watch: false});
    const ch = listen(s);
    await ch.opened;
    await ch.until((e) => e.length > 0);
    s.rebuild();
    await ch.until((e) => e.some((x) => x.event === 'reload' && x.data.version === 2));
    expect((await get(s, '/__storydeck/events', {method: 'HEAD'})).status).toBe(200);
  });
});

/** The token the dev page carries (only that page can read it). */
const tokenOf = async (s) => /<meta name="storydeck-dev-token" content="([0-9a-f]{32})">/.exec((await get(s, '/')).body)?.[1];

/** One edit as the dev page sends it — its origin, its token, JSON — with any of them changed; `chunks` sends the body in parts. */
function post(server, pathname, body, {origin = `http://localhost:${server.port}`, token, type = 'application/json', raw, chunks} = {}) {
  return new Promise((resolve, reject) => {
    const headers = {host: `localhost:${server.port}`, ...(type ? {'content-type': type} : {}), ...(origin ? {origin} : {}), ...(token ? {'x-storydeck-token': token} : {})};
    const req = http.request({host: '127.0.0.1', port: server.port, path: pathname, method: 'POST', headers}, (res) => {
      let text = '';
      res.on('data', (d) => { text += d; });
      res.on('end', () => resolve({status: res.statusCode, headers: res.headers, body: /json/.test(res.headers['content-type']) ? JSON.parse(text) : text}));
    });
    req.on('error', (e) => (e.code === 'ECONNRESET' || e.code === 'EPIPE' ? resolve({status: 'reset'}) : reject(e)));
    if (chunks) { for (const c of chunks) req.write(c); req.end(); } else req.end(raw ?? JSON.stringify(body));
  });
}

describe('edits from the dev page', () => {
  /** A dev server with its own note key folder, and the piece numbers its page carries (data-sd-at) by name. */
  const editing = async (dir) => {
    const home = tempDir();
    const s = await serve(dir, {watch: false, poll: 0, home});
    const page = (await get(s, '/')).body;
    const at = (name) => Number(new RegExp(`data-k="${name}"[^>]*data-sd-at="(\\d+)"`).exec(page)?.[1]);
    return {s, home, token: await tokenOf(s), at};
  };

  it('takes a note on a click into feedback.md, signed as yours, without a rebuild', async () => {
    const dir = tempDeck({...STARTER, 'feedback.md': '# Feedback\n\n- [ ] click 1 · "Title" — planted by whoever sent the deck (t)\n'});
    const {s, home, token} = await editing(dir);
    expect(token).toMatch(/^[0-9a-f]{32}$/);
    const r = await post(s, '/__storydeck/feedback', {click: 2, text: 'Make the\nserver wider'}, {token});
    expect(r).toMatchObject({status: 200, body: {ok: true, open: 1}});   // the planted line is not counted as yours
    expect(r.headers['access-control-allow-origin']).toBeUndefined();
    expect((await post(s, '/__storydeck/feedback', {click: 6, text: 'and slower'}, {token})).body.open).toBe(2);
    const md = readFileSync(path.join(dir, 'feedback.md'), 'utf8');
    expect(md).toMatch(/\n- \[ \] click 2 · "[^"]+" — Make the server wider \(\d{4}-\d\d-\d\d \d\d:\d\d · k:[0-9a-f]{16}\)\n- \[ \] click 6 · /);
    expect(md).toContain('planted by whoever sent the deck');
    expect(statSync(path.join(home, 'key')).isFile()).toBe(true);   // the key lives with the person, not the deck
    expect(existsSync(path.join(dir, 'key'))).toBe(false);
    await new Promise((r2) => setTimeout(r2, 250));   // a note is not a change to the deck
    expect(s.state().version).toBe(1);
  });

  it('moves the piece the build numbered, into its map file, and rebuilds at once — a box by left/top, a wire by its arrow', async () => {
    const dir = tempDeck();
    const {s, token, at} = await editing(dir);
    expect([at('client'), at('req1'), at('server')]).toEqual([0, 1, 2]);
    expect(await post(s, '/__storydeck/move', {map: 'map', index: at('server'), name: 'server', dx: 60, dy: -20}, {token})).toMatchObject({status: 200, body: {ok: true}});
    expect(s.state().version).toBe(2);
    expect((await post(s, '/__storydeck/move', {map: 'map', index: 1, name: 'req1', dx: 0, dy: 10}, {token})).status).toBe(200);
    const map = readFileSync(path.join(dir, 'map.html'), 'utf8');
    expect(map).toContain('<div data-k="server" class="box" style="left:780px;top:400px;width:300px;height:210px">');
    expect(map).toContain('<i data-k="req1" class="wire req pkt" data-arrow="464 500 716 500"></i>');
    expect(map.replace('left:780px;top:400px', 'left:720px;top:420px').replace('464 500 716 500', '464 490 716 490')).toBe(STARTER['map.html']);
  });

  it('answers an edit only from its own page: its origin, its token, JSON, at most 16 KB — and is never framed elsewhere', async () => {
    const {s, token} = await editing(tempDeck());
    const note = {click: 1, text: 'x'};
    expect((await post(s, '/__storydeck/feedback', note, {token, origin: null})).status).toBe(403);
    expect((await post(s, '/__storydeck/feedback', note, {token, origin: 'http://evil.example'})).status).toBe(403);
    expect((await post(s, '/__storydeck/feedback', note, {token, origin: `http://localhost:${s.port + 1}`})).status).toBe(403);
    expect((await post(s, '/__storydeck/feedback', note, {})).body.error).toMatch(/carries the dev page's token/);
    expect((await post(s, '/__storydeck/feedback', note, {token: 'f'.repeat(32)})).status).toBe(403);
    expect((await post(s, '/__storydeck/feedback', note, {token: `${token}0`})).status).toBe(403);
    expect((await post(s, '/__storydeck/feedback', note, {token, type: 'text/plain'})).status).toBe(415);
    expect((await post(s, '/__storydeck/feedback', null, {token, raw: '{"click": 1,'})).status).toBe(400);
    expect((await post(s, '/__storydeck/feedback', [1], {token})).body.error).toMatch(/a JSON object/);
    expect((await post(s, '/__storydeck/feedback', {click: 1, text: 'x'.repeat(17000)}, {token})).status).toBe(413);
    const parts = await post(s, '/__storydeck/feedback', null, {token, chunks: ['{"click": 1, "text": "', ...Array(20).fill('x'.repeat(1000)), '"}']});
    expect([413, 'reset']).toContain(parts.status);
    expect((await post(s, '/__storydeck/elsewhere', note, {token})).status).toBe(405);
    for (const origin of [`http://127.0.0.1:${s.port}`, `http://[::1]:${s.port}`]) expect((await post(s, '/__storydeck/feedback', note, {token, origin})).status).toBe(200);
    for (const answer of [await get(s, '/'), await get(s, '/icons/server.svg'), await post(s, '/__storydeck/feedback', note, {token})]) {
      expect(answer.headers).toMatchObject({'x-frame-options': 'SAMEORIGIN', 'content-security-policy': "frame-ancestors 'self'"});
    }
  });

  it('refuses a move it cannot be sure of, and says why', async () => {
    const dir = tempDeck();
    const {s, token, at} = await editing(dir);
    const move = (body) => post(s, '/__storydeck/move', {map: 'map', index: at('server'), name: 'server', dx: 1, dy: 1, ...body}, {token});
    expect((await move({map: 'nope'})).body.error).toBe('no map "nope"');
    expect((await move({map: 'constructor'})).status).toBe(400);
    expect((await move({index: -1})).status).toBe(400);
    expect((await move({name: undefined})).status).toBe(400);
    expect((await move({dx: '1'})).body.error).toBe('a move is two numbers of px');
    expect((await move({name: 'client'})).body.error).toMatch(/the page and the build disagree on piece 2 \("client"\)/);
    expect((await move({index: 99, name: 'ghost'})).status).toBe(409);
    expect((await move({dx: 9000})).body.error).toMatch(/at most 5000/);
    // the map saved since the page was built (no rebuild yet): the page may show another map — refused
    writeFileSync(path.join(dir, 'map.html'), `<div data-k="new" style="left:1px;top:1px">N</div>\n${STARTER['map.html']}`);
    expect((await move({})).body.error).toMatch(/the map changed since the page was built/);
    // a save that breaks the build: the page shows the last good build, so nothing may be moved until it builds
    s.rebuild();
    writeFileSync(path.join(dir, 'clicks.html'), STARTER['clicks.html'].replace('data-on="server time"', 'data-on="server nope"'));
    s.rebuild();
    expect(s.state().problem).toMatch(/no piece "nope"/);
    expect((await move({index: 3})).body.error).toMatch(/the deck does not build right now/);
    expect(s.state().version).toBe(2);
  });

  it('refuses every move on a map whose drawn pieces are not its file\'s, in order', async () => {
    // the build reads <div<!-- c -->data-k…> as no piece (its comment stripped, "divdata-k" is one name); the file holds one
    const dir = tempDeck({...STARTER, 'map.html': `${STARTER['map.html']}<div<!-- c -->data-k="y" style="left:5px;top:5px">Y</div>`});
    const {s, token, at} = await editing(dir);
    const r = await post(s, '/__storydeck/move', {map: 'map', index: at('server'), name: 'server', dx: 1, dy: 1}, {token});
    expect(r.body.error).toMatch(/map "map": the pieces it draws are not the pieces its file holds/);
    expect(readFileSync(path.join(dir, 'map.html'), 'utf8')).toContain('left:720px;top:420px');
  });

  it('waits for a first build before any edit, and signs no note with a key it cannot trust', async () => {
    const {s, token} = await editing(tempDeck({...STARTER, 'deck.json': '{"titel": "x"}'}));
    expect(await post(s, '/__storydeck/feedback', {click: 1, text: 'x'}, {token})).toMatchObject({status: 409, body: {error: 'the deck has not built yet — fix it first'}});
    const home = tempDir();
    writeFileSync(path.join(home, 'key'), 'b'.repeat(64), {mode: 0o644});
    chmodSync(path.join(home, 'key'), 0o644);
    const s2 = await serve(tempDeck(), {watch: false, poll: 0, home});
    if (process.platform !== 'win32') {
      expect((await post(s2, '/__storydeck/feedback', {click: 1, text: 'x'}, {token: await tokenOf(s2)})).body.error)
        .toMatch(/can be read or written by others \(chmod 600 it\) — a note is signed with it, so it is known for yours/);
    }
  });

  it('never writes through a link, nor reads one that leaves the deck', async () => {
    const dir = tempDeck();
    const outside = path.join(tempDir(), 'outside.md');
    writeFileSync(outside, 'mine');
    symlinkSync(outside, path.join(dir, 'feedback.md'));
    const {s, token} = await editing(dir);
    expect((await post(s, '/__storydeck/feedback', {click: 1, text: 'x'}, {token})).body.error).toMatch(/feedback.md is a link to a file outside the deck folder/);
    expect(readFileSync(outside, 'utf8')).toBe('mine');
    const dir2 = tempDeck();
    symlinkSync(path.join(dir2, 'map.html'), path.join(dir2, 'feedback.md'));   // a link to the deck's own map
    const two = await editing(dir2);
    expect((await post(two.s, '/__storydeck/feedback', {click: 1, text: 'x'}, {token: two.token})).body.error).toMatch(/feedback.md is a link — the build writes a file, never through a link/);
    expect(readFileSync(path.join(dir2, 'map.html'), 'utf8')).toBe(STARTER['map.html']);
  });
});
