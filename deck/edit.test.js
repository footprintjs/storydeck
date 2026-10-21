import {describe, it, expect} from 'vitest';
import {nudgePiece, sourcePieces, feedbackLine, readFeedback, appendFeedback, FEEDBACK} from './edit.js';
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

describe('sourcePieces', () => {
  it('finds the pieces in order, each by its name and which of that name it is — comments left out', () => {
    expect(sourcePieces(MAP).map((p) => [p.name, p.nth])).toEqual([['a', 0], ['w', 0], ['note', 0], ['b', 0], ['a', 1]]);
    // the starter's map, as the deck draws it (icons and wires made first): the same names in the same order
    const icons = {client: {viewBox: '0 0 1 1', body: ''}, server: {viewBox: '0 0 1 1', body: ''}, database: {viewBox: '0 0 1 1', body: ''}};
    const drawn = readPieces(applyTransforms(stripComments(STARTER['map.html']), {icons})).pieces;
    expect(sourcePieces(STARTER['map.html']).map((p) => p.name)).toEqual(drawn.map((p) => p.keys[0]));
  });
});

describe('nudgePiece', () => {
  it('moves a box by its inline left/top, every other byte kept', () => {
    const moved = nudgePiece(MAP, {name: 'a'}, 60, -30.25);
    expect(moved).toContain('style="left:160px;top:169.75px;width:50px;height:40px"');
    expect(moved.replace('left:160px;top:169.75px', 'left:100px;top:200px')).toBe(MAP);
    // the second piece of that name; a style written before data-k, in another order, with spaces and a bare 0
    expect(nudgePiece(MAP, {name: 'a', nth: 1}, 1, 1)).toContain('<div data-k="a" style="left:2px;top:3px">a second');
    expect(nudgePiece(MAP, {name: 'b'}, 10, 2.5)).toContain('<div style="top: 10px; left:10" data-k="b">');
  });

  it('moves a wire by its data-arrow and keeps its bend as written; an element that is not a wire moves by left/top', () => {
    expect(nudgePiece(MAP, {name: 'w'}, -10, 5)).toContain('data-arrow="0 25 20 45 5"');
    expect(nudgePiece('<i data-k="v" data-arrow="0,0,10,10"></i>', {name: 'v'}, 1, 1)).toBe('<i data-k="v" data-arrow="1 1 11 11"></i>');
    expect(nudgePiece('<i data-k="v" data-arrow=" 0 0 10 10 -12.25 "></i>', {name: 'v'}, 1, 0)).toContain('data-arrow="1 0 11 10 -12.25"');
    // only <i …></i> is drawn as a wire (transforms.js · wireRule): a <div data-arrow> keeps its arrow and moves its box
    expect(nudgePiece('<div data-k="d" data-arrow="0 0 1 1" style="left:5px;top:5px"></div>', {name: 'd'}, 1, 1))
      .toBe('<div data-k="d" data-arrow="0 0 1 1" style="left:6px;top:6px"></div>');
  });

  it('refuses what it cannot move, naming why', () => {
    expect(() => nudgePiece(MAP, {name: 'note'}, 1, 1)).toThrow(/"note" has no inline left\/top in px — a piece without them keeps its place/);
    expect(() => nudgePiece(MAP, {name: 'ghost'}, 1, 1)).toThrow(/the map changed since the page was built \(no piece "ghost"\)/);
    expect(() => nudgePiece(MAP, {name: 'a', nth: 2}, 1, 1)).toThrow(/no piece "a" #3/);
    expect(() => nudgePiece(MAP, {name: 'a'}, Infinity, 1)).toThrow(/a move is two numbers of px, at most 5000 each/);
    expect(() => nudgePiece(MAP, {name: 'a'}, 6000, 1)).toThrow(/at most 5000/);
    expect(() => nudgePiece('<i data-k="v" data-arrow="0 0 9"></i>', {name: 'v'}, 1, 1)).toThrow(/"v": its data-arrow is not "x1 y1 x2 y2 \[bend\]"/);
    expect(() => nudgePiece('<div data-k="p" style="left:5em;top:1px">x</div>', {name: 'p'}, 1, 1)).toThrow(/no inline left\/top/);
    expect(() => nudgePiece('<div data-k="p" style="left:1.2.3px;top:1px">x</div>', {name: 'p'}, 1, 1)).toThrow(/no inline left\/top/);
    expect(() => nudgePiece('<div data-k="p" <!-- x --> style="left:1px;top:1px">x</div>', {name: 'p'}, 1, 1)).toThrow(/a comment sits inside its tag/);
  });
});

describe('feedback', () => {
  it('writes a note as one checklist line: one line, no control characters, at most 2000 characters', () => {
    expect(feedbackLine({n: 3, label: 'Route · "2"', text: ' Make it\nwider\u0007 ', at: '2026-10-21 11:30'}))
      .toBe('- [ ] click 3 · "Route · 2" — Make it wider (2026-10-21 11:30)');
    expect(feedbackLine({n: 1, label: 'T', text: 'x'.repeat(3000), at: 'now'}).length).toBe(2000 + '- [ ] click 1 · "T" —  (now)'.length);
    expect(() => feedbackLine({n: 1, label: 'T', text: ' \n ', at: 'now'})).toThrow(/a note needs words/);
  });

  it('reads the checklist back, ticked and open, skipping anything else', () => {
    const md = appendFeedback(appendFeedback('', feedbackLine({n: 2, label: 'B', text: 'first', at: 't1'})), feedbackLine({n: 5, label: 'E', text: 'second (with parens)', at: 't2'}))
      .replace('- [ ] click 2', '- [x] click 2');
    expect(md.startsWith('# Feedback\n')).toBe(true);
    expect(readFeedback(`${md}\nsome prose\n- [ ] not a note`)).toEqual([
      {done: true, n: 2, label: 'B', text: 'first', at: 't1'},
      {done: false, n: 5, label: 'E', text: 'second (with parens)', at: 't2'},
    ]);
    expect(readFeedback('- [ ] click 4 · "D" — no time')).toEqual([{done: false, n: 4, label: 'D', text: 'no time', at: null}]);
    // its stamp is the "(…)" that ends the line and holds no ")"
    expect(readFeedback('- [x] click 1 · "A" — a (b) c (t)')[0]).toMatchObject({text: 'a (b) c', at: 't'});
    expect(readFeedback('- [ ] click 1 · "A" — a (b (t)')[0]).toMatchObject({text: 'a (b', at: 't'});
    expect(readFeedback('- [ ] click 1 · "A" — (t)')[0]).toMatchObject({text: '(t)', at: null});
  });

  it('reads a long or hostile file in one pass', () => {
    const t0 = performance.now();
    const lines = readFeedback(`- [ ] click 1 · "A" — ${' ('.repeat(1_000_000)})\n${'\n'.repeat(1_000_000)}x`);
    expect(lines).toHaveLength(1);
    expect(appendFeedback(`a${'\n'.repeat(2_000_000)}`, '- [ ] b')).toBe('a\n- [ ] b\n');
    expect(performance.now() - t0).toBeLessThan(1500);
  });

  it('adds a heading only the first time, and keeps one line per note', () => {
    const once = appendFeedback('', '- [ ] a');
    expect(once).toMatch(/^# Feedback\n\n.*\n\n- \[ \] a\n$/s);
    expect(appendFeedback('# Mine\n\n- [ ] a\n\n\n', '- [ ] b')).toBe('# Mine\n\n- [ ] a\n- [ ] b\n');
    expect(appendFeedback('\n \n', '- [ ] c')).toMatch(/^# Feedback\n/);
    expect(FEEDBACK).toBe('feedback.md');
  });
});
