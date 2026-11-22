// isoPaint: the deck's one SVG painter. What it writes for each kind of paint item, that the usual style painted by it
// is the deck's 0.34.0 faces byte for byte, that colours are written only when the list carries them, and that iso.js
// builds no face of its own any more.
import {describe, it, expect} from 'vitest';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {isometric, isoStyle, paintPiece, PAINT_ITEMS} from 'footprint-story/isometric';
import {isoArt, roleClass} from './isoPaint.js';

const NONE = {fill: null, stroke: null};
const art = (item, box = {x: 0, y: 0}) => isoArt([{of: 'p', ...NONE, ...item}], box);

describe('isoPaint · a paint list written as SVG', () => {
  it('writes every kind of item the kit has, classed by its role, in the box, to one decimal', () => {
    expect(PAINT_ITEMS).toEqual(['polygon', 'ellipse', 'path', 'lines']);   // a new kind in the kit is a new case here
    const box = {x: 10, y: 20};
    expect(art({item: 'polygon', role: 'left', points: [[10, 20], [130.04, 80.06], [10.25, 140]]}, box)).toBe('<polygon class="iso-left" points="0,0 120,60.1 0.3,120"/>');
    expect(art({item: 'ellipse', role: 'top', cx: 77.94, cy: 53.9, rx: 67.94, ry: 33.95}, box)).toBe('<ellipse class="iso-top" cx="67.9" cy="33.9" rx="67.9" ry="34"/>');
    expect(art({item: 'lines', role: 'grid', segments: [[10, 20, 310, 170], [70, 50, 370, 200]]}, box)).toBe('<path class="iso-lines" d="M0 0L300 150M60 30L360 180"/>');
    expect(art({item: 'path', role: 'side', segments: [['move', 10, 53.9], ['line', 10, 142.1], ['arc', 77.9, 142.1, 67.9, 33.9, Math.PI, 0, true], ['line', 145.8, 53.9], ['close']]}, box))
      .toBe('<path class="iso-side" d="M0 33.9L0 122.1A67.9 33.9 0 0 0 135.8 122.1L135.8 33.9Z"/>');
    // roles: each its own class; the tile lines keep `iso-lines`; a style's own role (hatch) is iso-hatch
    expect(['top', 'left', 'right', 'side', 'ground', 'grid', 'hatch'].map(roleClass)).toEqual(['iso-top', 'iso-left', 'iso-right', 'iso-side', 'iso-ground', 'iso-lines', 'iso-hatch']);
    // in paint order, one element an item
    expect(isoArt([{item: 'polygon', role: 'ground', of: 'f', points: [[0, 0], [1, 0], [0, 1]], ...NONE}, {item: 'lines', role: 'grid', of: 'f', segments: [], ...NONE}], {x: 0, y: 0})).toBe('<polygon class="iso-ground" points="0,0 1,0 0,1"/><path class="iso-lines" d=""/>');
  });

  it('writes an arc as SVG does: large-arc 0, sweep by the way it turns, the end on its ellipse; a line to its start only when the pen is elsewhere', () => {
    const arc = (from, to, anticlockwise, before = [['move', 0, 0]]) => art({item: 'path', role: 'side', segments: [...before, ['arc', 100, 100, 50, 20, from, to, anticlockwise]]});
    expect(arc(Math.PI, 0, true, [['move', 50, 100]])).toBe('<path class="iso-side" d="M50 100A50 20 0 0 0 150 100"/>');   // pen at its start: no line
    expect(arc(0, Math.PI, false, [['move', 150, 100]])).toBe('<path class="iso-side" d="M150 100A50 20 0 0 1 50 100"/>');  // clockwise: sweep 1
    expect(arc(0, Math.PI / 2, false)).toBe('<path class="iso-side" d="M0 0L150 100A50 20 0 0 1 100 120"/>');            // reached by a line from the pen
    expect(arc(Math.PI / 2, 0, true, [['move', 0, 0], ['line', 100, 120], ['close']])).toBe('<path class="iso-side" d="M0 0L100 120ZL100 120A50 20 0 0 0 150 100"/>');   // after a close the pen is back at the move
    expect(arc(Math.PI, Math.PI / 2, true, [])).toBe('<path class="iso-side" d="M50 100A50 20 0 0 0 100 120"/>');           // no pen yet: the arc's start is moved to
  });

  it('the usual style, painted, is the faces the deck wrote itself up to 0.34.0 — byte for byte, on any grid', () => {
    // the deck's own strings, as deck/iso.js · artOf built them from the grid before this painter (0.34.0)
    const fixed = (v) => +v.toFixed(1), pts = (list, x, y) => list.map((p) => `${fixed(p.x - x)},${fixed(p.y - y)}`).join(' ');
    const was = (kind, at, size, grid) => {
      if (kind === 'floor') {
        const f = grid.floor({cols: size[0], rows: size[1], at}), {x, y} = f.box;
        return `<polygon class="iso-ground" points="${pts(f.outline, x, y)}"/><path class="iso-lines" d="${f.lines.map(([x1, y1, x2, y2]) => `M${fixed(x1 - x)} ${fixed(y1 - y)}L${fixed(x2 - x)} ${fixed(y2 - y)}`).join('')}"/>`;
      }
      if (kind === 'cylinder') {
        const c = grid.cylinder({at, size}), {x, y} = c.box, t = c.top, b = c.bottom;
        return `<path class="iso-side" d="M${fixed(t.cx - t.rx - x)} ${fixed(t.cy - y)}L${fixed(b.cx - b.rx - x)} ${fixed(b.cy - y)}A${fixed(b.rx)} ${fixed(b.ry)} 0 0 0 ${fixed(b.cx + b.rx - x)} ${fixed(b.cy - y)}L${fixed(t.cx + t.rx - x)} ${fixed(t.cy - y)}Z"/><ellipse class="iso-top" cx="${fixed(t.cx - x)}" cy="${fixed(t.cy - y)}" rx="${fixed(t.rx)}" ry="${fixed(t.ry)}"/>`;
      }
      const k = grid.block({at, size}), {x, y} = k.box;
      return `<polygon class="iso-left" points="${pts(k.left, x, y)}"/><polygon class="iso-right" points="${pts(k.right, x, y)}"/><polygon class="iso-top" points="${pts(k.top, x, y)}"/>`;
    };
    let seed = 7;
    const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    const int = (a, b) => a + Math.floor(rnd() * (b - a + 1)), half = (a, b) => int(2 * a, 2 * b) / 2;
    const style = isoStyle();
    for (let n = 0; n < 600; n += 1) {
      const w = int(20, 200), grid = isometric({tile: rnd() < 0.3 ? [w, Math.max(5, Math.round(w * (0.2 + rnd() * 0.7)))] : w, origin: [int(-2000, 2000) + rnd(), int(-1000, 1000)], ...(rnd() < 0.3 ? {rise: int(10, 150)} : {})});
      const kind = ['block', 'cylinder', 'floor'][n % 3], wide = half(0.5, 6);
      const piece = kind === 'floor' ? {at: [int(-5, 10), int(-5, 10)], size: [int(1, 12), int(1, 12)]} : {at: [half(0, 10), half(0, 10), half(0, 3)], size: kind === 'cylinder' ? [wide, wide, half(0, 4)] : [wide, half(0.5, 6), half(0, 4)]};
      const now = paintPiece(style, {name: 'p', kind, ...piece}, grid);
      expect(isoArt(now.items, now.box)).toBe(was(kind, piece.at, piece.size, grid));
    }
  });

  it('writes no colour when the list carries none (the page\'s CSS colours by role), and the colour it carries when it does', () => {
    const grid = isometric({tile: 120, origin: [960, 240]}), piece = {name: 'p', kind: 'block', at: [1, 1], size: [2, 2, 1]};
    expect(isoArt(paintPiece(isoStyle(), piece, grid).items, {x: 0, y: 0})).not.toContain('style=');
    const coloured = isoArt(paintPiece(isoStyle(), piece, grid, {base: '#336699', ink: '#000000'}).items, {x: 0, y: 0});
    expect(coloured.match(/<polygon class="iso-left" style="([^"]*)"/)[1]).toMatch(/^fill:#[0-9a-f]{6};stroke:#000000;stroke-width:[\d.]+px;stroke-linejoin:round;stroke-linecap:\w+$/);
    expect(coloured.match(/style="/g)).toHaveLength(3);
    // a stroke seen through: its alpha as an opacity; a fill alone, no stroke
    expect(art({item: 'ellipse', role: 'top', cx: 1, cy: 1, rx: 1, ry: 1, fill: {mix: null, colour: '#abcdef'}, stroke: {colour: '#000000', alpha: 0.5, width: 2.56, join: 'miter', cap: 'butt'}}))
      .toBe('<ellipse class="iso-top" style="fill:#abcdef;stroke:#000000;stroke-width:2.6px;stroke-linejoin:miter;stroke-linecap:butt;stroke-opacity:0.5" cx="1" cy="1" rx="1" ry="1"/>');
    expect(art({item: 'polygon', role: 'top', points: [[0, 0], [1, 0], [0, 1]], fill: {mix: ['#ffffff', 0.2], colour: '#abcdef'}, stroke: {colour: null, alpha: 1, width: 5, join: 'round', cap: 'round'}})).toBe('<polygon class="iso-top" style="fill:#abcdef" points="0,0 1,0 0,1"/>');
  });

  it('refuses what it cannot write rather than drop a face or write a stray word into the page', () => {
    expect(() => art({item: 'circle', role: 'top'})).toThrow(/a polygon, an ellipse, a path or lines — not "circle"/);
    expect(() => art({item: 'polygon', role: 'top" onload="x', points: [[0, 0], [1, 0], [0, 1]]})).toThrow(/role is a short lower-case name/);
    expect(() => roleClass(undefined)).toThrow(/not undefined/);
    expect(() => art({item: 'polygon', role: 'top', points: [[0, 0], [1, 0], [0, 1]], fill: {mix: null, colour: 'red;x:y'}})).toThrow(/colour is "#rrggbb"/);
    expect(() => art({item: 'path', role: 'side', segments: [['move', 0, 0], ['curve', 1, 1]]})).toThrow(/move, line, arc or close — not "curve"/);
  });

  it('is the only writer of a face: deck/iso.js paints the built map\'s list and builds no face string, nor asks the grid for one', () => {
    const iso = readFileSync(path.join(process.cwd(), 'deck/iso.js'), 'utf8');
    expect(iso).toMatch(/import \{isoArt\} from '\.\/isoPaint\.js';/);
    expect(iso).toContain('isoArt(paints, box)');
    expect(iso).not.toMatch(/<(polygon|ellipse|path)\b/);
    expect(iso).not.toMatch(/class="iso-(left|right|top|side|ground|lines)"/);
    expect(iso).not.toMatch(/grid\.(block|cylinder|floor)\(/);
    expect(iso).toMatch(/built\.paints\[i\]/);
    expect(iso).toMatch(/built\.floorPaints\[i\]/);
  });
});
