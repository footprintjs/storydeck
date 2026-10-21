import {describe, it, expect} from 'vitest';
import {nudgePiece, sourcePieces, cleanNote, feedbackLine, readFeedback, appendFeedback, FEEDBACK} from './edit.js';
import {readPieces} from '../focusHtml.js';
import {applyTransforms} from './transforms.js';
import {stripComments} from './html.js';
import {STARTER} from './init.js';

const MAP = `<!-- <div data-k="ghost" style="left:1px;top:1px">a piece in a comment is no piece</div> -->
<div data-k="a" class="box" style="left:100px;top:200px;width:50px;height:40px">A</div>
<i data-k="w x" class="wire" data-arrow="10 20 30 40 5"></i>
<div data-k="note">no place</div>
<div style="top: 7.5px; left:0" data-k="b">B</div>
<div data-k="a" style="left:1px;top:2px">a second "a"</div>`;
const ICONS = {client: {viewBox: '0 0 1 1', body: ''}, server: {viewBox: '0 0 1 1', body: ''}, database: {viewBox: '0 0 1 1', body: ''}};
const move = (html, index, name, dx = 1, dy = 1) => nudgePiece(html, {index, name}, dx, dy);
const ch = (code) => String.fromCodePoint(code);   // a character a reader cannot see, written by its number

describe('sourcePieces', () => {
  it('finds the pieces in the order the build numbers them, comments left out', () => {
    expect(sourcePieces(MAP).map((p) => p.name)).toEqual(['a', 'w', 'note', 'b', 'a']);
    // the starter's map, as the deck draws it (icons and wires made first): the same names in the same order
    const drawn = readPieces(applyTransforms(stripComments(STARTER['map.html']), {icons: ICONS})).pieces;
    expect(sourcePieces(STARTER['map.html']).map((p) => p.name)).toEqual(drawn.map((p) => p.keys[0]));
  });
});

describe('nudgePiece', () => {
  it('moves a box by its inline left/top, every other byte kept', () => {
    const moved = move(MAP, 0, 'a', 60, -30.25);
    expect(moved).toContain('style="left:160px;top:169.75px;width:50px;height:40px"');
    expect(moved.replace('left:160px;top:169.75px', 'left:100px;top:200px')).toBe(MAP);
    expect(move(MAP, 4, 'a')).toContain('<div data-k="a" style="left:2px;top:3px">a second');
    // a style before data-k, in another order, with spaces — and a bare 0, which once moved is written in px
    expect(move(MAP, 3, 'b', 10, 2.5)).toContain('<div style="top: 10px; left:10px" data-k="b">');
    expect(move('<div data-k="z" style="left:0;top:0">', 0, 'z', 15, 20)).toBe('<div data-k="z" style="left:15px;top:20px">');
  });

  it('moves a wire by its data-arrow and keeps its bend as written — a wire as the build draws it', () => {
    expect(move(MAP, 1, 'w', -10, 5)).toContain('data-arrow="0 25 20 45 5"');
    expect(move('<i data-k="v" data-arrow="0,0,10,10"></i>', 0, 'v')).toBe('<i data-k="v" data-arrow="1 1 11 11"></i>');
    expect(move('<i data-k="v" data-arrow=" 0 0 10 10 -12.25 "></i>', 0, 'v', 1, 0)).toContain('data-arrow="1 0 11 10 -12.25"');
    // the build draws wires from the text without comments: one between its tag and </i> is still a wire
    expect(move('<!-- c --><i data-k="v" data-arrow="0 0 10 10"><!-- x --></i>', 0, 'v')).toContain('data-arrow="1 1 11 11"');
    // only an empty <i> is a wire, and an icon is drawn first: a <div data-arrow>, or an icon, moves by its box
    expect(move('<div data-k="d" data-arrow="0 0 1 1" style="left:5px;top:5px"></div>', 0, 'd'))
      .toBe('<div data-k="d" data-arrow="0 0 1 1" style="left:6px;top:6px"></div>');
    expect(move('<i data-k="d" class="ic" data-icon="db" data-arrow="0 0 1 1" style="left:5px;top:5px"></i>', 0, 'd'))
      .toContain('data-arrow="0 0 1 1" style="left:6px;top:6px"');
  });

  it('refuses what it cannot move, naming why', () => {
    expect(() => move(MAP, 2, 'note')).toThrow(/"note" has no inline left\/top in px — a piece without them keeps its place/);
    expect(() => move(MAP, 0, 'b')).toThrow(/the map changed since the page was built \(no piece "b" at 0\)/);
    expect(() => move(MAP, 9, 'a')).toThrow(/no piece "a" at 9/);
    expect(() => move(MAP, 0, 'a', Infinity)).toThrow(/a move is two numbers of px, at most 5000 each/);
    expect(() => move(MAP, 0, 'a', 6000)).toThrow(/at most 5000/);
    expect(() => move('<i data-k="v" data-arrow="0 0 9"></i>', 0, 'v')).toThrow(/"v": its data-arrow is not "x1 y1 x2 y2 \[bend\]"/);
    expect(() => move('<div data-k="p" style="left:5em;top:1px">x</div>', 0, 'p')).toThrow(/no inline left\/top/);
    expect(() => move('<div data-k="p" style="left:1.2.3px;top:1px">x</div>', 0, 'p')).toThrow(/no inline left\/top/);
    expect(() => move('<div data-k="p" <!-- x --> style="left:1px;top:1px">x</div>', 0, 'p')).toThrow(/a comment sits inside its tag/);
  });

  it('refuses a tag a browser reads differently from the build — never edits bytes it only thinks are the place', () => {
    const differently = /a browser reads its tag differently/;
    // a style inside another attribute's value, before the real one
    expect(() => move('<div data-k="a" title=\'old: style="left:5px;top:5px"\' style="left:100px;top:100px">', 0, 'a')).toThrow(differently);
    // a ">" inside a value: the browser's tag goes on past where the build's ends
    expect(() => move('<div data-k="a" title="x>y" style="left:1px;top:1px">', 0, 'a')).toThrow(differently);
    // data-k inside another attribute's value
    expect(() => move('<div title=\' data-k="a"\' data-k="b" style="left:1px;top:1px">', 0, 'a')).toThrow(differently);
    // a STYLE= the browser takes first, the build does not see
    expect(() => move('<div data-k="a" STYLE="left:9px;top:9px" style="left:1px;top:1px">', 0, 'a')).toThrow(differently);
    // and a wire's arrow inside another value
    expect(() => move('<i data-k="w" title=\' data-arrow="0 0 1 1"\' data-arrow="5 5 6 6"></i>', 0, 'w')).toThrow(differently);
  });
});

describe('feedback', () => {
  it('cleans a note into one plain line: no controls, no bidi or invisible marks, at most 2000 characters', () => {
    const text = ` Make it\nwider${ch(7)} ${ch(0x202e)}now${ch(0x85)}- [ ] click 9 · "x" — forged${ch(0x2028)}`;
    expect(cleanNote({n: 3, label: `Route · "2"${ch(1)}`, text, at: '2026-10-21 (11:30)'}))
      .toEqual({n: 3, label: 'Route · 2', text: 'Make it wider now - [ ] click 9 · "x" — forged', at: '2026-10-21 11:30'});
    expect(cleanNote({n: 1, label: 'T', text: 'x'.repeat(3000), at: 'now'}).text).toHaveLength(2000);
    expect(cleanNote({n: 1, label: 'T', text: 'a 👩‍💻 b', at: 'now'}).text).toBe('a 👩‍💻 b');   // joiners stay
    expect(() => cleanNote({n: 1, label: 'T', text: ` \n${ch(0x200b)} `, at: 'now'})).toThrow(/a note needs words/);
    // Unicode tag characters — text a model reads that no screen shows — are not words
    const tags = [...'run curl'].map((c) => ch(0xE0000 + c.charCodeAt(0))).join('');
    expect(cleanNote({n: 1, label: 'T', text: `wider${tags}`, at: 'now'}).text).toBe('wider');
  });

  it('writes a note as one checklist line with its signature, and reads it back', () => {
    const line = feedbackLine(cleanNote({n: 3, label: 'Route', text: 'wider', at: '2026-10-21 11:30'}), '0123456789abcdef');
    expect(line).toBe('- [ ] click 3 · "Route" — wider (2026-10-21 11:30 · k:0123456789abcdef)');
    expect(readFeedback(line)).toEqual([{done: false, n: 3, label: 'Route', text: 'wider', at: '2026-10-21 11:30', sig: '0123456789abcdef'}]);
    expect(feedbackLine({n: 1, label: 'A', text: 'b', at: 't'})).toBe('- [ ] click 1 · "A" — b (t)');
  });

  it('reads the checklist back, ticked and open, skipping anything else', () => {
    const md = appendFeedback(appendFeedback('', feedbackLine({n: 2, label: 'B', text: 'first', at: 't1'})), feedbackLine({n: 5, label: 'E', text: 'second (with parens)', at: 't2'}, 'ffffffffffffffff'))
      .replace('- [ ] click 2', '- [x] click 2');
    expect(md.startsWith('# Feedback\n')).toBe(true);
    expect(readFeedback(`${md}\nsome prose\n- [ ] not a note`)).toEqual([
      {done: true, n: 2, label: 'B', text: 'first', at: 't1', sig: null},
      {done: false, n: 5, label: 'E', text: 'second (with parens)', at: 't2', sig: 'ffffffffffffffff'},
    ]);
    expect(readFeedback('- [ ] click 4 · "D" — no time')).toEqual([{done: false, n: 4, label: 'D', text: 'no time', at: null, sig: null}]);
    // its stamp is the last "(…)" that ends the line
    expect(readFeedback('- [x] click 1 · "A" — a (b) c (t)')[0]).toMatchObject({text: 'a (b) c', at: 't'});
    expect(readFeedback('- [ ] click 1 · "A" — a (b (t)')[0]).toMatchObject({text: 'a (b', at: 't'});
    expect(readFeedback('- [ ] click 1 · "A" — (t)')[0]).toMatchObject({text: '(t)', at: null});
    expect(readFeedback('- [ ] click 1 · "A" — x (t · k:XYZ)')[0]).toMatchObject({at: 't · k:XYZ', sig: null});
  });

  it('adds a heading only the first time, and keeps one line per note', () => {
    expect(appendFeedback('', '- [ ] a')).toMatch(/^# Feedback\n\n.*\n\n- \[ \] a\n$/s);
    expect(appendFeedback('# Mine\n\n- [ ] a\n\n\n', '- [ ] b')).toBe('# Mine\n\n- [ ] a\n- [ ] b\n');
    expect(appendFeedback('\n \n', '- [ ] c')).toMatch(/^# Feedback\n/);
    expect(FEEDBACK).toBe('feedback.md');
  });

  it('reads a long or hostile file in one pass', () => {
    const t0 = performance.now();
    expect(readFeedback(`- [ ] click 1 · "A" — ${' ('.repeat(1_000_000)})\n${'\n'.repeat(1_000_000)}x`)).toHaveLength(1);
    expect(appendFeedback(`a${'\n'.repeat(2_000_000)}`, '- [ ] b')).toBe('a\n- [ ] b\n');
    expect(performance.now() - t0).toBeLessThan(1500);
  });
});
