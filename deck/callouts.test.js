// @vitest-environment node
import {afterEach, describe, it, expect} from 'vitest';
import {callouts, calloutsIn, CALLOUT_CSS} from './callouts.js';
import {applyTransforms} from './transforms.js';
import {compileDeck} from './compile.js';
import {deckPage} from './page.js';
import {pageAssets} from './assets.js';
import {readDeck} from './source.js';
import {reviewClick} from './review.js';
import {checkDeck} from './check.js';
import {nudgePiece} from './edit.js';
import {layoutProblems} from './layout.js';
import {readPieces} from '../focusHtml.js';
import {expandNames} from '../focus.js';
import {STARTER} from './init.js';
import {cleanDecks, sourceOf, tempDeck} from './test/helpers.js';

afterEach(cleanDecks);

const SERVER = '<div data-k="server" class="box" style="left:800px;top:500px;width:300px;height:200px">Server</div>';
const say = (spec, attrs = '', words = 'Most of the wait') => `<div data-k="why" data-callout="${spec}"${attrs}>${words}</div>`;
const drawn = (html, options) => callouts(`${SERVER}${html}`, options);
const boxOf = (html, name = 'why') => readPieces(html).pieces.find((p) => p.keys[0] === name).box;

/** Where the tail's tip lands in slide px, from what was drawn. */
function tipOf(html) {
  const b = boxOf(html), tail = /<svg class="callout-tail" style="left:(-?[\d.]+)px;top:(-?[\d.]+)px[^>]*data-sd-tip="(-?[\d.]+) (-?[\d.]+)"/.exec(html);
  return [b.x + Number(tail[1]) + Number(tail[3]), b.y + Number(tail[2]) + Number(tail[4])];
}

describe('where a callout stands', () => {
  it('stands above by default, centred on its piece, a tail\'s length off', () => {
    const b = boxOf(drawn(say('server')));
    expect(b.y + b.h).toBe(500 - 34);
    expect(b.x + b.w / 2).toBe(800 + 150);
  });

  it('stands on the side it names', () => {
    const at = (side) => boxOf(drawn(say(`server ${side}`)));
    expect(at('above').y + at('above').h).toBe(466);
    expect(at('below').y).toBe(700 + 34);
    expect(at('left').x + at('left').w).toBe(800 - 34);
    expect(at('right').x).toBe(1100 + 34);
    expect(at('left').y + at('left').h / 2).toBe(600);
  });

  it('takes its size from its words: a short one hugs them, a long one wraps and grows', () => {
    const short = boxOf(drawn(say('server', '', 'Hi there'))), long = boxOf(drawn(say('server', '', 'A much longer thing to say about this piece, which needs a few lines to say it')));
    expect(short.w).toBeLessThan(200);
    expect(long.w).toBeGreaterThan(300);
    expect(long.w).toBeLessThanOrEqual(400);
    expect(long.h).toBeGreaterThan(short.h * 2);
    expect(boxOf(drawn(say('server', '', 'One<br>Two'))).h).toBe(2 * 35 + 24);
  });

  it('counts Chinese, Japanese and Korean letters as twice as wide, and a long word as the lines it takes', () => {
    expect(boxOf(drawn(say('server', '', '大部分等待时间都在这里'))).w).toBeGreaterThan(boxOf(drawn(say('server', '', 'abcdefghijk'))).w);
    expect(boxOf(drawn(say('server', '', 'x'.repeat(60)))).h).toBe(3 * 35 + 24);
  });

  it('keeps a width or height it was given, written where it was', () => {
    const html = drawn(say('server', ' style="width:310px;--callout-bg:#fde68a"'));
    expect(boxOf(html).w).toBe(310);
    expect(html).toContain('width:310px;--callout-bg:#fde68a"');
    expect(html.match(/width:310px/g)).toHaveLength(1);
    expect(boxOf(drawn(say('server', ' style="height:150px"'))).h).toBe(150);
  });

  it('stays on the slide when it is told the slide', () => {
    const corner = '<div data-k="corner" style="left:30px;top:250px;width:100px;height:100px">C</div>';
    const words = 'A long enough thing to say that it would run off the edge';
    const free = boxOf(callouts(`${corner}<div data-k="why" data-callout="corner above">${words}</div>`));
    expect(free.x).toBeLessThan(0);
    const kept = boxOf(callouts(`${corner}<div data-k="why" data-callout="corner above">${words}</div>`, {canvas: [1920, 1080]}));
    expect(kept.x).toBe(24);
  });

  it('a left and a top place it by hand, and its tail still reaches the piece', () => {
    const html = drawn(say('server', ' style="left:100px;top:100px;width:300px;height:100px"'));
    expect(boxOf(html)).toEqual({x: 100, y: 100, w: 300, h: 100});
    const [x, y] = tipOf(html);
    expect(x).toBeGreaterThan(780);
    expect(y).toBeGreaterThan(480);
    expect(x).toBeLessThan(810);
    expect(y).toBeLessThan(510);
  });
});

describe('its tail', () => {
  it.each([['above', 950, 496], ['below', 950, 704], ['left', 796, 600], ['right', 1104, 600]])('on %s points at the piece\'s edge, just short of it', (side, x, y) => {
    expect(tipOf(drawn(say(`server ${side}`)))).toEqual([x, y]);
  });

  it('starts inside its bubble, so no seam shows', () => {
    const html = drawn(say('server above')), b = boxOf(html);
    const foot = /<path d="M(-?[\d.]+) (-?[\d.]+)/.exec(html), top = Number(/callout-tail" style="left:-?[\d.]+px;top:(-?[\d.]+)px/.exec(html)[1]);
    expect(top + Number(foot[2])).toBeLessThan(b.h);
  });

  it('is left to its piece: the svg has no piece name, so it never counts as one', () => {
    expect(readPieces(drawn(say('server'))).pieces.map((p) => p.keys[0])).toEqual(['server', 'why']);
  });
});

describe('as a piece', () => {
  it('is marked for what it is about, so "server+" takes it in', () => {
    const {pieces} = readPieces(drawn(say('server')));
    expect(pieces[1].ends).toEqual(['server']);
    expect(expandNames(pieces, ['server+'])).toEqual(['server', 'why']);
  });

  it('gets class callout once, keeps its own classes, and keeps its words and their markup', () => {
    expect(drawn(say('server'))).toContain('class="callout"');
    expect(drawn(say('server', ' class="bad"'))).toContain('class="callout bad"');
    expect(drawn(say('server', ' class="callout bad"'))).toContain('class="callout bad"');
    expect(drawn(say('server', '', '<b>Waiter</b> is the server'))).toContain('<span class="callout-say"><b>Waiter</b> is the server</span></div>');
    expect(drawn(say('server'))).not.toContain('data-callout=');
  });

  it('holds tags of its own kind inside it', () => {
    expect(drawn(say('server', '', '<div>Inner</div> after'))).toContain('<span class="callout-say"><div>Inner</div> after</span></div>');
  });

  it('reads back as data, for a reviewer', () => {
    expect(calloutsIn(`${SERVER}${say('server below', '', '<b>Most</b> of &amp; it')}`)).toEqual([{name: 'why', target: 'server', side: 'below', text: expect.stringContaining('Most of')}]);
  });

  it('a wire may reach a callout, since a callout has a box by then', () => {
    const html = applyTransforms(`${SERVER}${say('server')}<i data-k="w" data-arrow="server to why"></i>`.replace('server to why', 'why to server 60'));
    expect(html).toContain('data-ends="why server"');
  });

  it('HTML without one comes back exactly as it was', () => {
    expect(callouts(SERVER)).toBe(SERVER);
  });
});

describe('what it refuses, each naming the fix', () => {
  const refuses = (html, message) => expect(() => callouts(`${SERVER}${html}`)).toThrow(message);

  it('a side it does not have', () => refuses(say('server up'), 'data-callout="server up": a callout names the piece it is about and the side it stands on ("server above"): above, below, left or right'));
  it('nothing to point at', () => refuses(say(''), 'a callout names the piece'));
  it('a piece that is not there, naming those that are', () => refuses(say('nope'), 'data-callout="nope": no piece "nope" with a box (data-k, and an inline left, top, width and height) — the placed pieces are server'));
  it('itself', () => refuses(say('why'), '"why" is the callout itself'));
  it('no name of its own', () => refuses('<div data-callout="server">Words</div>', 'a callout is a piece, so a click can bring it in — give it a data-k name'));
  it('no words', () => refuses(say('server', '', ' <b></b> '), 'a callout says something'));
  it('never closed', () => refuses('<div data-k="why" data-callout="server">Words', 'its <div> is never closed'));
  it('a piece inside it', () => refuses(say('server', '', 'Hi <b data-k="x">there</b>'), 'pieces do not nest'));
  it('a misspelt attribute, so it is never silently a plain element', () => refuses('<div data-k="why" data-callout-for="server">Words</div>', 'data-callout-for="server": a callout is written data-callout="piece side"'));
  it('a quote never closed', () => refuses('<div data-k="why" title="a data-callout="server">Words</div>', /a quote in its tag is never closed/));
  it('half a place', () => refuses(say('server', ' style="left:10px"'), 'it needs both a left and a top'));
  it('a place not in px', () => refuses(say('server', ' style="width:50%"'), 'its width is a number of px'));
  it('standing on its piece, where a tail has nowhere to go', () => refuses(say('server', ' style="left:850px;top:550px;width:100px;height:60px"'), '"why" stands on "server", so its tail has nowhere to go'));
});

describe('the page', () => {
  const clicks = '<section data-label="P" data-kicker="P" data-map="map"><step data-in="a why" data-on="a why"><h2>Here</h2></step></section>';
  const map = '<div data-k="a" style="left:800px;top:500px;width:300px;height:200px">A</div><div data-k="why" data-callout="a">Words</div>';
  const page = (m, theme = '') => deckPage(compileDeck(sourceOf({clicks, maps: {map: m}, theme})), pageAssets());

  it('carries its stylesheet only when a deck has one, before the deck\'s theme', () => {
    const plainMap = '<div data-k="a" style="left:800px;top:500px;width:300px;height:200px">A</div><div data-k="why" style="left:1px;top:1px;width:9px;height:9px">Words</div>';
    expect(page(plainMap)).not.toContain('sdCalloutIn');
    const html = page(map, '.mine { color: red; }');
    expect(html).toContain('sdCalloutIn');
    expect(html.indexOf('sdCalloutIn')).toBeLessThan(html.indexOf('.mine'));
  });

  it('carries it for a callout on a plain slide too, and holds it there', () => {
    const plain = `<section data-label="P" data-kicker="P">${SERVER}${say('server')}</section>`;
    const html = deckPage(compileDeck(sourceOf({clicks: plain})), pageAssets());
    expect(html).toContain('sdCalloutIn');
    expect(html).toContain('data-sd-callout="above"');
  });

  it('a deck with no callout has no field for them, so what it compiles to is as before', () => {
    const compiled = compileDeck(sourceOf({clicks: clicks.replace(' why', '').replace(' why', ''), maps: {map: '<div data-k="a" style="left:800px;top:500px;width:300px;height:200px">A</div>'}}));
    expect(Object.keys(compiled)).not.toContain('callouts');
    expect(Object.keys(compiled.maps.map)).toEqual(['pieces']);
  });
});

describe('its stylesheet', () => {
  const rules = [...CALLOUT_CSS.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({selector: selector.trim(), body}));
  const own = rules.filter((r) => !/^(from|\d+%)/.test(r.selector) && !r.selector.startsWith('sdCalloutIn'));

  it('holds every rule at no weight and only inside a slide, so a deck wins and a site keeps its own .callout', () => {
    expect(own.length).toBeGreaterThanOrEqual(5);
    for (const {selector} of own) expect(selector, selector).toMatch(/^:where\(section\[data-label\] /);
    expect(CALLOUT_CSS).not.toContain('!important');
  });

  it('makes every look a token with a fallback, the tail the same colour as the bubble', () => {
    for (const token of ['--callout-bg', '--callout-fg', '--callout-size', '--callout-radius', '--callout-lag']) expect(CALLOUT_CSS).toContain(`var(${token},`);
    const bubble = /background: ([^;]+);/.exec(CALLOUT_CSS)[1];
    expect(CALLOUT_CSS).toContain(`fill: ${bubble};`);
  });

  it('moves only under no reduced motion, in the slot that plays by focus.css\'s gate, honouring a part\'s pace', () => {
    expect(CALLOUT_CSS).toMatch(/@media screen and \(prefers-reduced-motion: no-preference\) \{\s+:where\(section\[data-label\] \[data-sd-callout\]\.sd-enter\) \{ --sd-a-more:/);
    for (const pace of ['--sd-arrive-with', '--sd-arrive-time', '--sd-arrive-delay']) expect(CALLOUT_CSS).toContain(`var(${pace},`);
  });
});

describe('the starter', () => {
  it('shows one, checks clean, and the reviewer reads what it says', () => {
    const compiled = compileDeck(readDeck(tempDeck()));
    expect(compiled.callouts).toBe(true);
    expect(checkDeck(compiled)).toEqual([]);
    expect(reviewClick(compiled, 5)).toContain('callouts (1): why above server "Most of the wait is here"');
    expect(reviewClick(compiled, 2)).not.toContain('callouts');
  });
});

describe('check', () => {
  const map = '<div data-k="a" style="left:800px;top:500px;width:300px;height:200px">A</div><div data-k="b" style="left:100px;top:500px;width:300px;height:200px">B</div><div data-k="why" data-callout="a">Words</div>';
  const check = (steps) => checkDeck(compileDeck(sourceOf({clicks: `<section data-label="P" data-kicker="P" data-map="map">${steps}</section>`, maps: {map}}))).filter((p) => p.rule === 'callout-alone');

  it('warns once when a callout shows without the piece it points at', () => {
    const steps = '<step data-in="b why" data-on="b why"><h2>One</h2></step><step data-on="why"><h2>Two</h2></step>';
    expect(check(steps)).toEqual([{level: 'warn', rule: 'callout-alone', click: 1, label: 'P · 1', message: '"why" points at "a", which this click does not show — bring "a" in, or take the callout out with data-out'}]);
  });

  it('is quiet when the piece shows, greyed or lit', () => {
    expect(check('<step data-in="a why" data-on="why"><h2>One</h2></step>')).toEqual([]);
  });
});

describe('moving one in the dev page', () => {
  const source = `${SERVER}\n<div data-k="why" data-callout="server above">Words</div>`;

  it('refuses a callout that stands beside its piece, saying what to move instead', () => {
    expect(() => nudgePiece(source, {index: 1, name: 'why'}, 10, 10)).toThrow('"why" stands beside "server" and follows it — move "server", or give the callout a left and top of its own');
  });

  it('moves one placed by hand, and leaves its piece where it is', () => {
    const hand = source.replace('data-callout="server above"', 'data-callout="server above" style="left:100px;top:100px"');
    expect(nudgePiece(hand, {index: 1, name: 'why'}, 10, 20)).toContain('left:110px;top:120px');
  });

  it('moves its piece, and the callout follows when the page is drawn again', () => {
    const moved = nudgePiece(source, {index: 0, name: 'server'}, 100, 0);
    expect(boxOf(callouts(moved)).x).toBe(boxOf(callouts(source)).x + 100);
  });
});

describe('the layout check says', () => {
  const clicks = [{n: 1, label: 'C1'}, {n: 2, label: 'C2'}];

  it('when a callout meets another, or the headline', () => {
    const found = [{n: 1, kind: 'callout-overlap', piece: 'a', text: 'Words', other: '"b"', dx: 0, dy: 0}, {n: 2, kind: 'callout-overlap', piece: 'a', text: 'Words', other: 'the headline', dx: 0, dy: 0}];
    const problems = layoutProblems(found, clicks);
    expect(problems.map((p) => p.rule)).toEqual(['callout-overlap', 'callout-overlap']);
    expect(problems[0].message).toContain('"a" meets "b", and one hides the other');
    expect(problems[1].message).toContain('"a" meets the headline');
  });

  it('when a tail no longer reaches its piece', () => {
    const [p] = layoutProblems([{n: 2, kind: 'tail-miss', piece: 'a', text: 'Words', other: 'server', dx: 0, dy: 0}], clicks);
    expect(p).toMatchObject({level: 'warn', rule: 'tail-miss', click: 2});
    expect(p.message).toContain('the tail of "a" no longer reaches "server"');
  });
});
