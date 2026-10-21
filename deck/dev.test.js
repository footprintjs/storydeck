// @vitest-environment node
import {afterEach, describe, it, expect} from 'vitest';
import http from 'node:http';
import net from 'node:net';
import {readFileSync, symlinkSync, writeFileSync, mkdirSync} from 'node:fs';
import path from 'node:path';
import {serveDeck} from './dev.js';
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
  const until = async (pred, ms = 3000) => {
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
    expect(page.headers).toMatchObject({'x-content-type-options': 'nosniff', 'cache-control': 'no-store'});
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

  it('serves nothing hidden, nothing outside the folder, and nothing through a link that leaves it', async () => {
    const dir = tempDeck({...STARTER, '.env': 'SECRET=1', 'sub/.hidden': 'x'});
    const secret = path.join(tempDir(), 'secret.txt');
    writeFileSync(secret, 'TOP SECRET');
    symlinkSync(secret, path.join(dir, 'leak.txt'));
    mkdirSync(path.join(dir, 'pics'));
    const s = await serve(dir);
    for (const p of ['/.env', '/sub/.hidden', '/../package.json', '/%2e%2e/%2e%2e/etc/passwd', '/leak.txt', '/icons', '/nope.png', '/%E0%A4%A', '/a%00b', '/pics']) {
      const r = await get(s, p);
      expect([p, r.status]).toEqual([p, 404]);
      expect(r.body).not.toContain('SECRET');
    }
  });

  it('rebuilds on a save and tells the page to reload; a save that breaks the build says why and keeps the last good page', async () => {
    const dir = tempDeck();
    const s = await serve(dir);
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
  });

  it('does not rebuild for its own output, a hidden file, or a dependency', async () => {
    const dir = tempDeck();
    const s = await serve(dir);
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
    const s = await serve(dir);
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
