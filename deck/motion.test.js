// motion: a deck's blocks moved by intent, end to end — the moves a click names compiled into its slides, a deck that
// moves nothing left byte for byte as it was, the camera framing where blocks rest, what is refused, and what the
// critics found reaching the check at their own level, naming the move and the fix.
import {describe, it, expect} from 'vitest';
import {compileDeck} from './compile.js';
import {checkDeck} from './check.js';
import {deckStyles} from './page.js';
import {CARRIERS, moverNames, piecesAt} from './motion.js';
import {MOTION_CSS} from './motionDraw.js';
import {sourceOf} from './test/helpers.js';

const MAP = `<i data-iso-grid="120 at 960 300"></i>
<div data-k="floor" data-iso="floor" data-size="8 6"></div>
<div data-k="box" data-iso="block" data-at="1 1 3" data-size="1 1 1"><b>Box</b></div>
<div data-k="server" data-iso="block" data-at="5 2" data-size="2 2 1.4"><b>Server</b><small>an API</small></div>
<div data-k="crate" data-iso="block" data-at="1 4" data-size="1 1 1"><b>Crate</b></div>`;
const clicksOf = (...moves) => `<section data-label="Drop" data-map="map">
<step data-in="floor box server crate"><h2>Here</h2></step>
${moves.map((m, i) => `<step${m === null ? '' : ` data-move="${m}"`}><h2>Then ${i + 1}</h2></step>`).join('\n')}
</section>`;
const compile = (clicks, maps = {map: MAP}) => compileDeck(sourceOf({clicks, maps}));

describe('motion · a deck whose blocks move', () => {
  it('leaves a deck that moves nothing as it was, byte for byte: no wrapper, no index, no stylesheet', () => {
    const still = compile(clicksOf(null, null));
    expect(still.motionCss).toBeUndefined();
    expect(still.maps.map.motion).toBeUndefined();
    expect(still.slides.some((s) => /data-sd-(?:mover|moving|say|move)|iso-motion/.test(s.html))).toBe(false);
    expect(moverNames([{map: null}, {map: 'map', steps: [{attrs: ' data-in="a"'}]}]).size).toBe(0);
    // a second map whose blocks move leaves this one's slides as they were
    const both = compile(`${clicksOf(null, null)}<section data-label="Other" data-map="other"><step data-in="floor box"><h2>O</h2></step><step data-move="box fall"><h2>P</h2></step></section>`, {map: MAP, other: MAP});
    const uncounted = (html) => html.replace(/class="count">\d+ \/ \d+</, 'class="count"><');   // the deck has two more clicks
    expect(both.slides.slice(0, 3).map((s) => uncounted(s.html))).toEqual(still.slides.map((s) => uncounted(s.html)));
    expect(both.maps.other.motion.moves).toBe(1);
    expect(deckStyles(still, {css: []})).not.toContain('iso-motion');
  });

  it('compiles each click\'s moves into its slide: the block at rest where they leave it, its move playing on its click', () => {
    const c = compile(clicksOf('box fall; crate slide to 4 4.5', null, 'box throw to server'));
    const {motion} = c.maps.map;
    expect(motion.record.map((r) => [r.click, r.piece, r.do, r.model])).toEqual([[2, 'box', 'fall', 'ballistic'], [2, 'crate', 'slide', 'coulomb'], [4, 'box', 'throw', 'ballistic']]);
    expect(motion.carriers).toEqual(CARRIERS);
    expect(motion.carriers.pptx).toMatch(/^at rest, where each move ends, by a driver that can end them \(rest\(\).* the export's own record \(exportPptx · moves\) says how/);
    expect(typeof motion.run).toBe('function');
    expect(c.slides[0].html).toContain('<span class="iso-motion" data-sd-mover="0" style="transform:translate(0px, 0px) scale(1, 1)">');
    expect(c.slides[1].html).toMatch(/<span class="iso-motion" data-sd-mover="0" data-sd-move="map-0" style="transform:translate\(0px, [\d.]+px\) scale\(1, 1\)">/);
    expect(c.slides[2].html).not.toContain('data-sd-move="');
    expect(c.slides[3].html).toContain('data-sd-move="map-2"');
    expect(c.slides[3].html).toMatch(/data-sd-say="1" style="[^"]*visibility:hidden" data-sd-show="map-2"/);   // the server's name, covered from the box's rest on
    expect(c.motionCss.startsWith(MOTION_CSS)).toBe(true);
    expect(deckStyles(c, {css: []})).toContain('@keyframes sdIsoMove-map-0 {');
  });

  it('frames a click where its blocks rest at its end, so a camera that fits them finds them there', () => {
    const c = compile(clicksOf('box fall'));
    const map = {pieces: c.maps.map.pieces, moving: null};
    expect(piecesAt(map, 0)).toBe(map.pieces);
    const box = c.maps.map.pieces.find((p) => p.keys[0] === 'box');
    const moved = {pieces: c.maps.map.pieces, moving: {view: {moved: (ci) => new Map(ci === 1 ? [['box', {dx: 0, dy: 200}]] : [])}}};
    expect(piecesAt(moved, 0)).toBe(moved.pieces);
    expect(piecesAt(moved, 1).find((p) => p.keys[0] === 'box').box).toEqual({...box.box, y: box.box.y + 200});
    // a zoom on the click after the fall frames the box on the floor, below where it was built
    const fit = compile(`<section data-label="F" data-map="map"><step data-in="floor box server crate"><h2>A</h2></step><step data-move="box fall"><h2>B</h2></step><step data-on="box" data-focus="zoom"><h2>C</h2></step></section>`);
    const still = compile(`<section data-label="F" data-map="map"><step data-in="floor box server crate"><h2>A</h2></step><step><h2>B</h2></step><step data-on="box" data-focus="zoom"><h2>C</h2></step></section>`);
    expect(fit.clicks[2].look.stage.move.y).toBeLessThan(still.clicks[2].look.stage.move.y);
  });

  it('refuses a move it cannot show: a block the click does not show, a map with no block, more moves than one list', () => {
    expect(() => compile(`<section data-label="G" data-map="map"><step data-in="floor server"><h2>A</h2></step><step data-move="box fall"><h2>B</h2></step></section>`))
      .toThrow(/"G" click 2: data-move\[0\] \("box"\) moves "box", which this click does not show — bring it in \(data-in="box"\), or move it on a click that shows it/);
    expect(() => compile('<section data-label="H" data-map="map"><step data-in="a" data-move="a fall"><h2>A</h2></step></section>', {map: '<div data-k="a" class="box" style="left:1px;top:1px;width:9px;height:9px">A</div>'}))
      .toThrow(/"H" click 1: data-move moves isometric blocks, and map "map" has none — draw the block with data-iso="block"/);
    expect(() => compile(clicksOf('floor fall'))).toThrow(/"Drop" click 2: data-move\[0\]: "floor" is a floor: the ground the blocks stand on does not move/);
    expect(() => compile(clicksOf('w fall'), {map: `${MAP}<i data-k="w" class="wire" data-arrow="box to crate"></i>`})).toThrow(/"w" is not an isometric block/);
    const many = Array.from({length: 33}, (_, i) => (i % 2 ? 'crate slide to 3 4.5' : 'crate slide to 1.5 4.5'));
    expect(() => compile(clicksOf(...many, ...many))).toThrow(/map "map": its clicks move blocks 66 times, and footprint-story plans at most 64 moves in one list — tell the rest on a second map/);
  });

  it('refuses a map too big for its moving blocks\' paint levels', () => {
    const blocks = Array.from({length: 130}, (_, i) => `<div data-k="b${i}" data-iso="block" data-at="${i % 16} ${Math.floor(i / 16)} 3" data-size="1 1 1"></div>`).join('');
    const map = `<i data-iso-grid="20 at 960 100"></i><div data-k="floor" data-iso="floor" data-size="16 9"></div>${blocks}`;
    expect(() => compile(`<section data-label="B" data-map="map"><step data-in="floor b0 b1"><h2>A</h2></step><step data-move="b0 fall; b1 fall"><h2>B</h2></step></section>`, {map}))
      .toThrow(/map "map": a map whose blocks move holds at most 128 blocks, cylinders and footprints with 2 of them moving, and this one has 130 — move fewer blocks on this map, or tell it in two maps/);
  });

  it('brings what the critics found to the check, at each critic\'s own level, naming the move and the fix', () => {
    const c = compile(clicksOf('box reach to 3 1 3 model min-jerk bend 0; crate reach to 3 4.5 model min-jerk bend 0 accept arc', 'box throw to server'));
    const found = checkDeck(c).filter((p) => p.rule === 'motion');
    expect(found.map((p) => [p.level, p.click, p.label])).toEqual([['warn', 2, 'Drop · 2'], ['info', 2, 'Drop · 2'], ['warn', 3, 'Drop · 3']]);
    expect(found[0].message).toMatch(/^data-move\[0\] \("box"\) · arc: its move runs straight .* — \S/);
    expect(found[1].message).toMatch(/^data-move\[1\] \("crate"\) · arc \(accepted\): /);
    expect(found[2].message).toMatch(/^data-move\[0\] \("box"\) · deck:covers: it comes to rest over "server"'s name \("Server"\), which is hidden from then — land it clear of the name/);
    // a footprint-story note is advice: told as info
    const noted = {...c, maps: {map: {...c.maps.map, motion: {...c.maps.map.motion, findings: [{click: 2, who: '"Drop" click 2: data-move[0] ("box")', critic: 'spin', level: 'note', what: 'w', fix: 'f'}]}}}};
    expect(checkDeck(noted).filter((p) => p.rule === 'motion').map((p) => [p.level, p.message])).toEqual([['info', 'data-move[0] ("box") · spin: w — f']]);
  });
});
