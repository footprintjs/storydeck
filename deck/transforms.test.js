import {describe, it, expect} from 'vitest';
import {wires, icons, readIcon, applyTransforms} from './transforms.js';

describe('wires', () => {
  it('draws a straight wire in a box that holds it, with its head, keeping the element\'s attributes', () => {
    expect(wires('<i data-k="w" class="req" data-arrow="100 200 300 200"></i>')).toBe(
      '<svg data-k="w" class="wire req" style="left:80px;top:180px;width:240px;height:40px" viewBox="0 0 240 40" aria-hidden="true">'
      + '<path d="M20 20 Q120 20 205.6 20"/><path class="head" d="M220 20L202 30.8L202 9.2Z"/></svg>');
  });

  it('adds a packet for class "pkt", bends the curve, and gives a wire without a class its "wire"', () => {
    const out = wires('<i data-k="w" class="wire pkt" data-arrow="0 0 100 0 40"></i><i data-k="v" data-arrow="0,0,0,50"></i>');
    expect(out).toContain('<rect class="pkt"');
    expect(out).toContain('--pdx:');
    expect(out).toMatch(/class="wire pkt"/);
    expect(out).toMatch(/<svg data-k="v" class="wire"/);
    expect(out).toContain("Q70 60");   // the bend pulls the curve 40 px off the straight line
  });

  it('keeps a class that already names the wire, and leaves other <i> elements alone', () => {
    expect(wires('<i class="wire x" data-arrow="0 0 10 10"></i>')).toMatch(/class="wire x"/);
    expect(wires('<i class="ic"></i>')).toBe('<i class="ic"></i>');
  });

  it('stays linear on a map of unfinished <i> tags', () => {
    const t0 = performance.now();
    const hostile = '<i data-k="x" '.repeat(100000);
    expect(wires(hostile)).toBe(hostile);
    expect(icons(hostile)).toBe(hostile);
    expect(performance.now() - t0).toBeLessThan(1500);
  });

  it('refuses a wire that is not four or five numbers', () => {
    expect(() => wires('<i data-arrow="1 2 3"></i>')).toThrow(/data-arrow="1 2 3": a wire is "x1 y1 x2 y2"/);
    expect(() => wires('<i data-arrow="1 2 3 x"></i>')).toThrow(/a wire is/);
  });
});

describe('icons', () => {
  const set = {dot: readIcon('dot', '<?xml version="1.0"?><!-- c --><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><circle r="3"/></svg>\n')};

  it('reads an icon file into its viewBox and drawing', () => {
    expect(set.dot).toEqual({viewBox: '0 0 8 8', body: '<circle r="3"/>'});
  });

  it('refuses a file that is not one <svg> with a viewBox', () => {
    expect(() => readIcon('x', '<g/>')).toThrow(/icon "x": an icon file is one <svg/);
    expect(() => readIcon('x', '<svg width="8"></svg>')).toThrow(/has no viewBox/);
  });

  it('draws <i data-icon> as the icon, keeping its other attributes', () => {
    expect(icons('<i class="ic big" data-icon="dot" title="t"></i>', set)).toBe('<svg class="ic big" title="t" viewBox="0 0 8 8" aria-hidden="true"><circle r="3"/></svg>');
  });

  it('names the icons there are when one is missing, or says there are none', () => {
    expect(() => icons('<i data-icon="cat"></i>', set)).toThrow(/no icon "cat" \(there are dot\) — add icons\/cat.svg/);
    expect(() => icons('<i data-icon="cat"></i>')).toThrow(/the deck has no icons/);
  });

  it('runs icons, then wires', () => {
    const out = applyTransforms('<i data-icon="dot"></i><i data-arrow="0 0 10 0"></i>', {icons: set});
    expect(out).toMatch(/^<svg viewBox="0 0 8 8"/);
    expect(out).toContain('class="wire"');
    expect(applyTransforms('<p>plain</p>')).toBe('<p>plain</p>');
  });
});
