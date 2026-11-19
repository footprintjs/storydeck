import {describe, it, expect} from 'vitest';
import {checkDeck, failure, formatProblems} from './check.js';
import {compileDeck} from './compile.js';
import {sourceOf, MAP} from './test/helpers.js';

const check = (clicks, extra = {}) => checkDeck(compileDeck(sourceOf({clicks, ...extra})));
const rules = (problems) => problems.map((p) => `${p.level} ${p.rule} ${p.click ?? '-'}`);

describe('checkDeck', () => {
  it('finds nothing in a deck that does what it says', () => {
    expect(check(`<section data-label="M" data-map="map">
      <step data-in="a b c w1 w2"><h2>All of it</h2><aside class="notes">n</aside></step>
      <step data-on="b"><h2>Just B</h2><aside class="notes">n</aside></step></section>`)).toEqual([]);
  });

  it('words: a headline over checks.maxWords, a plain slide over checks.maxSlideWords', () => {
    const p = check('<section data-label="P"><p>one two three four five</p></section><section data-label="M" data-map="map"><step data-in="*"><h2>one two three four</h2></step></section>',
      {deck: {title: 'T', checks: {maxWords: 3, maxSlideWords: 4}}});
    expect(rules(p)).toEqual(['warn words 1', 'warn words 2', 'info never-shown -'].filter((r) => !r.startsWith('info')));
    expect(p[0].message).toBe('this slide shows 5 words (at most 4) — keep the canvas short and move the rest into the notes');
    expect(p[1].message).toMatch(/^the headline is 4 words \(at most 3\)/);
  });

  it('theme-unstyled: a part theme that theme.css never selects, once per theme — and not when it does', () => {
    const clicks = '<section data-label="Cover" data-theme="ledgr"><p>Hi</p></section><section data-label="M" data-map="map" data-theme="ledgr"><step data-in="*"><h2>All</h2></step></section>';
    const p = check(clicks, {theme: '[data-theme="ledger"] { --bg: #eef; }'});
    expect(rules(p).filter((r) => r.includes('theme'))).toEqual(['warn theme-unstyled 1']);
    expect(p.find((x) => x.rule === 'theme-unstyled').message).toBe('part "Cover" asks for data-theme="ledgr", which theme.css never selects — fix the name, or give it its tokens there ([data-theme="ledgr"] { --bg: …; })');
    for (const theme of ['[data-theme="ledgr"]{}', "section[data-theme='ledgr' i] .x{}", ':root.dark [ data-theme = ledgr ] {}']) {
      expect(rules(check(clicks, {theme})).some((r) => r.includes('theme')), theme).toBe(false);
    }
    // a part without a theme asks for nothing
    expect(rules(check('<section data-label="P"><p>Hi</p></section>')).some((r) => r.includes('theme'))).toBe(false);
  });

  it('lit-on-entry: pieces that come in lit though the click is about others — and not when quiet, or about everything', () => {
    const p = check('<section data-label="M" data-map="map"><step data-in="a b" data-on="a"><h2>A</h2></step></section>');
    expect(rules(p)).toContain('warn lit-on-entry 1');
    expect(p.find((x) => x.rule === 'lit-on-entry').message).toBe('b comes in lit, though the click is about a — add data-quiet to bring it in greyed, or name it in data-on');
    const many = check('<section data-label="M" data-map="map"><step data-in="a b c" data-on="a"><h2>A</h2></step></section>');
    expect(many.find((x) => x.rule === 'lit-on-entry').message).toMatch(/^b, c come in lit, .* bring them in greyed, or name them in data-on$/);
    expect(rules(check('<section data-label="M" data-map="map"><step data-in="a b" data-on="a" data-quiet><h2>A</h2></step></section>'))).not.toContain('warn lit-on-entry 1');
    expect(rules(check('<section data-label="M" data-map="map"><step data-in="a b" data-on="*"><h2>A</h2></step></section>'))).not.toContain('warn lit-on-entry 1');
    expect(rules(check('<section data-label="M" data-map="map"><step data-in="a b"><h2>A</h2></step></section>'))).not.toContain('warn lit-on-entry 1');
  });

  it('lit-on-entry reads name+ as the piece and what it touches', () => {
    const map = MAP.replace('data-arrow="300 470 500 470"', 'data-arrow="a to b"').replace('data-arrow="700 470 900 470"', 'data-arrow="b to c"');
    const clicks = '<section data-label="M" data-map="map"><step data-in="a"><h2>A</h2></step><step data-in="w1 b w2 c" data-on="b+"><h2>B and its wires</h2></step></section>';
    expect(check(clicks, {maps: {map}}).filter((p) => p.rule === 'lit-on-entry')).toEqual([]);
    const narrow = clicks.replace('data-on="b+"', 'data-on="b"');
    expect(rules(check(narrow, {maps: {map}})).filter((r) => r.includes('lit-on-entry'))).toEqual(['warn lit-on-entry 2']);
  });

  it('no-change: a click that leaves the screen as it was, with the same headline', () => {
    const same = check('<section data-label="M" data-map="map"><step data-in="*"><h2>H</h2></step><step><h2>H</h2></step></section>');
    expect(rules(same)).toContain('warn no-change 2');
    const newHeadline = check('<section data-label="M" data-map="map"><step data-in="*"><h2>H</h2></step><step><h2>Other</h2></step></section>');
    expect(rules(newHeadline)).not.toContain('warn no-change 2');
    const nextPart = check('<section data-label="M" data-map="map"><step data-in="*"><h2>H</h2></step></section><section data-label="N" data-map="map"><step><h2>H</h2></step></section>');
    expect(rules(nextPart)).not.toContain('warn no-change 2');   // a part's first click is never the same click again
  });

  it('never-shown: a piece no click brings in, unless it is a twin that steps aside', () => {
    const p = check('<section data-label="M" data-map="map"><step data-in="a w1 b"><h2>H</h2></step></section>');
    expect(p.find((x) => x.rule === 'never-shown').message).toBe('map "map": w2, c never shown — bring them in with data-in, or remove them from the map');
    const one = check('<section data-label="M" data-map="map"><step data-in="a w1 b w2"><h2>H</h2></step></section>');
    expect(one.find((x) => x.rule === 'never-shown').message).toMatch(/c never shown — bring it in/);
    const twin = `${MAP}<div data-k="dash" data-twin="b" style="left:0;top:0;width:1px;height:1px"></div>`;
    expect(rules(check('<section data-label="M" data-map="map"><step data-in="*"><h2>H</h2></step></section>', {maps: {map: twin}}))).not.toContain('info never-shown -');
  });

  it('no-notes: the clicks without notes in a deck that mostly has them', () => {
    const p = check(`<section data-label="A"><p>a</p><aside class="notes">n</aside></section>
      <section data-label="B"><p>b</p><aside class="notes">n</aside></section><section data-label="C"><p>c</p></section>`);
    expect(p.find((x) => x.rule === 'no-notes').message).toBe('click 3 has no notes — the presenter view shows nothing there and listen mode skips it');
    const two = check(`<section data-label="A"><p>a</p><aside class="notes">n</aside></section><section data-label="B"><p>b</p><aside class="notes">n</aside></section>
      <section data-label="C"><p>c</p><aside class="notes">n</aside></section><section data-label="D"><p>d</p></section><section data-label="E"><p>e</p></section>`);
    expect(two.find((x) => x.rule === 'no-notes').message).toMatch(/^clicks 4, 5 have no notes .* skips them$/);
    expect(check('<section data-label="A"><p>a</p></section>')).toEqual([]);   // a deck without notes is not asked for them
  });
});

describe('formatProblems', () => {
  it('lists the worst first, then by click; a deck-wide problem says so', () => {
    const text = formatProblems([
      {level: 'info', rule: 'no-notes', click: null, label: null, message: 'm1'},
      {level: 'warn', rule: 'words', click: 4, label: 'D', message: 'm2'},
      {level: 'warn', rule: 'words', click: 2, label: 'B', message: 'm3'},
      ...failure(new Error('broken')),
    ]);
    expect(text.split('\n')).toEqual([
      'error deck · compile: broken',
      'warn  click 2 "B" · words: m3',
      'warn  click 4 "D" · words: m2',
      'info  deck · no-notes: m1',
    ]);
    expect(formatProblems([])).toBe('no problems');
  });
});

describe('checkDeck · view-far', () => {
  const wide = `<div data-k="a" class="box" style="left:0px;top:400px;width:400px;height:200px">A</div>
<div data-k="b" class="box" style="left:1800px;top:400px;width:400px;height:200px">B</div>
<div data-k="c" class="box" style="left:4800px;top:400px;width:400px;height:200px">C</div>`;
  const deck = (focus) => compileDeck(sourceOf({clicks: `<section data-label="Wide" data-map="map">
  <step data-in="a" data-focus="${focus}"><h2>One</h2></step>
  <step data-in="b" data-focus="${focus}"><h2>Two</h2></step>
  <step data-in="c" data-focus="${focus}"><h2>Three</h2></step>
</section>`, maps: {map: wide}}));

  it('warns on the click where a fit stands further out than half size, with what the words shrink to and what to do', () => {
    const found = checkDeck(deck('fit')).filter((p) => p.rule === 'view-far');
    expect(found.map((p) => [p.level, p.click])).toEqual([['warn', 3]]);   // 2200 wide is 0.70×: fine; 5200 wide is 0.30×
    expect(found[0].message).toMatch(/^the view stands at 0\.2954× here, so words drawn 26 px tall show about 8 px tall — show less at once/);
  });

  it('says nothing of a deck whose view never goes that far out, or has no camera', () => {
    expect(checkDeck(deck('grey')).filter((p) => p.rule === 'view-far')).toEqual([]);
    expect(checkDeck(deck('zoom')).filter((p) => p.rule === 'view-far')).toEqual([]);
  });
});

describe('checkDeck · across-stages, and a far view on a stage of its own', () => {
  const box = (name, x, more = '') => `<div data-k="${name}" class="box" ${more} style="left:${x}px;top:400px;width:300px;height:200px">${name}</div>`;
  const deck = (map, clicks) => compileDeck(sourceOf({clicks: `<section data-label="S" data-map="map">${clicks}</section>`, maps: {map}}));

  it('warns about a wire that joins pieces standing on different stages: it is left behind when one moves', () => {
    const found = checkDeck(deck(`${box('a', 0)}${box('r', 900, 'data-stage="panel"')}<i data-k="w" class="wire" data-arrow="a to r"></i>`, '<step data-in="*"><h2>All</h2></step>')).filter((p) => p.rule === 'across-stages');
    expect(found.map((p) => [p.level, p.click])).toEqual([['warn', 1]]);
    expect(found[0].message).toBe('"w" stands on the main stage and touches "a" and "r" on the main stage and stage "panel" — each stage has its own view, so it is left behind when one moves: stand them on one stage (data-stage)');
    // a wire between two pieces of one stage is that stage's by itself, and a deck with one stage is never asked
    expect(checkDeck(deck(`${box('q', 0, 'data-stage="panel"')}${box('r', 900, 'data-stage="panel"')}<i data-k="w" class="wire" data-arrow="q to r"></i>`, '<step data-in="*"><h2>All</h2></step>')).filter((p) => p.rule === 'across-stages')).toEqual([]);
    expect(checkDeck(deck(`${box('a', 0)}${box('b', 900)}<i data-k="w" class="wire" data-arrow="a to b"></i>`, '<step data-in="*"><h2>All</h2></step>')).filter((p) => p.rule === 'across-stages')).toEqual([]);
  });

  it('view-far names the stage whose view stands far out', () => {
    const wide = `${box('a', 0)}${box('p', 0, 'data-stage="panel"')}${box('q', 6000, 'data-stage="panel"')}`;
    const found = checkDeck(deck(wide, '<step data-in="*" data-focus="fit" data-focus-stage="panel"><h2>All</h2></step><step data-on="a"><h2>Then</h2></step>')).filter((p) => p.rule === 'view-far');
    expect(found.map((p) => p.click)).toEqual([1, 2]);                      // the panel's view stays far out on the next click too
    expect(found[0].message).toMatch(/^the view of stage "panel" stands at 0\.25× here/);
  });
});

describe('checkDeck · wire-way: what the build knows of a wire along the floor, said in words', () => {
  const grid = '<i data-iso-grid="120 at 960 240"></i>';
  const iso = (name, at, size = '2 2 1') => `<div data-k="${name}" data-iso="block" data-at="${at}" data-size="${size}"><b>${name}</b></div>`;
  const deck = (map) => compileDeck(sourceOf({clicks: '<section data-label="S" data-map="map"><step data-in="*"><h2>All</h2></step></section>', maps: {map}}));
  const ways = (map) => checkDeck(deck(map)).filter((p) => p.rule === 'wire-way');

  it('says nothing of a wire that lies well', () => {
    expect(ways(`${grid}${iso('a', '0 4')}${iso('b', '5 1')}<i data-k="w" class="wire" data-arrow="a to b"></i><i data-k="v" class="wire" data-arrow="b to a"></i>`)).toEqual([]);
    expect(deck(`${grid}${iso('a', '0 4')}${iso('b', '5 1')}<i data-k="w" class="wire" data-arrow="a to b"></i>`).maps.map.ways).toBe(undefined);
  });

  it('warns that a wire passes behind a block, with the two ways out', () => {
    const map = `${grid}${iso('a', '0 4')}${iso('b', '8 4')}${iso('wall', '4 5.5', '2 40 2')}<i data-k="w" class="wire" data-arrow="a to b"></i>`;
    expect(deck(map).maps.map.ways).toEqual([{name: 'w', from: 'a', to: 'b', way: 'behind wall'}]);
    expect(ways(map)).toEqual([{level: 'warn', rule: 'wire-way', click: 1, label: expect.any(String), message: '"w" (a to b) passes behind wall: that stretch of it is hidden — move it or the two blocks so there is floor to see between, or draw the wire straight (data-arrow="a to b 0")'}]);
  });

  it('says why a wire between two blocks is drawn straight: two heights is a note, no way is a warning', () => {
    const lifted = ways(`${grid}${iso('a', '0 4')}${iso('up', '6 0 2')}<i data-k="w" class="wire" data-arrow="a to up"></i>`);
    expect(lifted).toEqual([{level: 'info', rule: 'wire-way', click: 1, label: expect.any(String), message: '"w" (a to up) is drawn straight, through the air, not along the floor: the two stand at different heights'}]);
    // a wire asked to be straight says nothing: it is what was written
    expect(ways(`${grid}${iso('a', '0 4')}${iso('b', '5 1')}<i data-k="w" class="wire" data-arrow="a to b 0"></i>`)).toEqual([]);
  });

  it('warns when a wire lies on another for want of room at a foot', () => {
    const wires = Array.from({length: 7}, (_, i) => `<i data-k="w${i}" class="wire" data-arrow="${i % 2 ? 'b to a' : 'a to b'}"></i>`).join('');
    const said = ways(`${grid}${iso('a', '0 4')}${iso('b', '5 1')}${wires}`).filter((p) => p.level === 'warn');   // seven wires at two blocks cross too: a note
    expect(said).toHaveLength(1);
    expect(said[0].message).toBe('"w6" (a to b) lies on another wire for want of room: a foot of a block has a place for three wires — make the block wider (data-size), or take a wire out');
  });

  it('a map no part is told on says nothing', () => {
    const source = sourceOf({clicks: '<section data-label="S" data-map="map"><step data-in="*"><h2>All</h2></step></section>', maps: {map: `${grid}${iso('a', '0 4')}${iso('b', '5 1')}`, spare: `${grid}${iso('a', '0 4')}${iso('up', '6 0 2')}<i data-k="w" class="wire" data-arrow="a to up"></i>`}});
    expect(checkDeck(compileDeck(source)).filter((p) => p.rule === 'wire-way')).toEqual([]);
  });
});
