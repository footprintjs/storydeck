// @vitest-environment node
import {afterEach, describe, it, expect, vi} from 'vitest';
import {readFileSync, symlinkSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkTool, outlineTool, reviewTool, buildTool, feedbackTool} from './tools.js';
import {STARTER} from './init.js';
import {measureSlide} from '../video.js';
import {tempDeck, tempDir, cleanDecks} from './test/helpers.js';

afterEach(cleanDecks);

/** Playwright's chromium, faked: it opens the page it is given (offline), and every click spills once — or the page never settles. */
function fakeChromium(found = [{kind: 'spills', piece: 'server', text: 'Server', dx: 12, dy: 0}], {settles = true} = {}) {
  const opened = [];
  const f = {opened, routed: false};
  const page = {
    goto: vi.fn(async (url) => { opened.push(readFileSync(fileURLToPath(url), 'utf8')); }),
    waitForFunction: vi.fn(async () => { if (!settles) throw new Error('page.waitForFunction: Timeout 30000ms exceeded.\nCall log: …'); }),
    addStyleTag: vi.fn(),
    evaluate: vi.fn(async (fn) => (fn === measureSlide ? found : undefined)),
  };
  const context = {route: vi.fn(async () => { f.routed = true; }), routeWebSocket: vi.fn(), newPage: async () => page, on: vi.fn()};
  const browser = {newContext: async () => context, close: vi.fn()};
  return Object.assign(f, {chromium: {launch: vi.fn(async () => browser)}, browser});
}

describe('checkTool --layout', () => {
  it('opens the built page in a browser and adds what spills, once for the clicks it stays on', async () => {
    const f = fakeChromium();
    const r = await checkTool(tempDeck(), {layout: true, chromium: f.chromium});
    expect(f.opened[0]).toMatch(/^<!doctype html>/);
    expect(f.browser.close).toHaveBeenCalled();
    expect(f.routed).toBe(true);   // measured offline
    expect(r).toMatchObject({errors: 0, warnings: 1});
    expect(r.text).toBe('warn  click 1 "Title" · spills: text spills out of "server" by 12 px wide ("Server") (on clicks 1–6) — shorten it, or give the box more room');
  });

  it('reports a page that never settles as one error, closing the browser — the other checks still report', async () => {
    const f = fakeChromium([], {settles: false});
    const r = await checkTool(tempDeck(), {layout: true, chromium: f.chromium});
    expect(f.browser.close).toHaveBeenCalled();
    expect(r).toMatchObject({errors: 1, warnings: 0});
    expect(r.text).toBe('error deck · layout: the layout check stopped: page.waitForFunction: Timeout 30000ms exceeded. — the page did not settle in the browser (a script in the deck may navigate away or keep it busy)');
  });

  it('reports a deck that cannot be read as the one error, before any browser opens', async () => {
    const f = fakeChromium();
    const r = await checkTool(tempDeck({'deck.json': '{}'}), {layout: true, chromium: f.chromium});
    expect(r).toMatchObject({errors: 1, warnings: 0});
    expect(f.chromium.launch).not.toHaveBeenCalled();
  });
});

describe('the read-first tools', () => {
  it('outline, review and build answer in text', () => {
    const dir = tempDeck();
    expect(outlineTool(dir).split('\n')).toHaveLength(7);
    expect(reviewTool(dir, {click: 1})).toMatch(/^click 1 of 6/);
    expect(() => reviewTool(dir, {click: ''})).toThrow(/name a click/);
    expect(buildTool(dir)).toMatch(/^✓ .* · 6 clicks · \d+ KB · \d+ ms$/);
    expect(buildTool(tempDeck({...JSON.parse('{}'), 'deck.json': '{"title":"T","deckData":"deck-data.json"}', 'clicks.html': '<section data-label="P"><p>x</p></section>'})))
      .toMatch(/ · .*deck-data\.json$/);
  });
});

describe('feedback', () => {
  const NOTES = '# Feedback\n\n- [x] click 2 · "Route" — wider (t1)\n- [ ] click 4 · "Back" — slower (t2)\nsome prose\n- [ ] click 5 · "Back · 2" — a (b) (t3)\n';

  it('lists the open notes a person left, and check names how many are open', async () => {
    const dir = tempDeck({...STARTER, 'feedback.md': NOTES});
    expect(feedbackTool(dir)).toBe('2 open notes (tick a line in feedback.md when it is done):\n- click 4 "Back": slower (t2)\n- click 5 "Back · 2": a (b) (t3)');
    const r = await checkTool(dir);
    expect(r).toMatchObject({errors: 0, warnings: 0});
    expect(r.text).toContain('2 open notes from the dev page — storydeck feedback lists them');
  });

  it('says so when there are none — no file, or every note ticked', async () => {
    expect(feedbackTool(tempDeck())).toBe('no open notes');
    const done = tempDeck({...STARTER, 'feedback.md': NOTES.replaceAll('- [ ]', '- [x]')});
    expect(feedbackTool(done)).toBe('no open notes');
    expect((await checkTool(done)).text).toBe('no problems');
  });

  it('never reads a feedback.md that is a link out of the deck — check reports it as an error', async () => {
    const outside = path.join(tempDir(), 'notes.md');
    writeFileSync(outside, NOTES);
    const dir = tempDeck();
    symlinkSync(outside, path.join(dir, 'feedback.md'));
    expect(() => feedbackTool(dir)).toThrow(/feedback.md is a link to a file outside the deck folder/);
    expect(await checkTool(dir)).toMatchObject({errors: 1, text: expect.stringMatching(/feedback: feedback.md is a link to a file outside/)});
  });
});
