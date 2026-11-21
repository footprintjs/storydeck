import {describe, it, expect} from 'vitest';
import {transformed} from './transforms.js';

// A lead into a port on a seen side ends at the end of its floor corner (footprint-story · cableLead, 0.31.0). 0.30.1
// counted four pieces for a port above the floor, and where the riser is shorter than its two corners' rounding there
// is no straight run down it, so the count ran one piece on along the floor.
const canvas = [1920, 1080], grid = '<i data-iso-grid="120 at 960 150"></i>';
const map = `${grid}<div data-k="lap" data-iso="block" data-at="0 6" data-size="2 1.4 0.3" data-ports="rj45: 2 0.7 0.15"></div>`
  + '<div data-k="sw" data-iso="block" data-at="6 6" data-size="4.7 2 0.4" data-ports="p1: 0.4 2 0.3 | up: 4.7 1 0.3"></div>';
const leadPath = (html, end) => new RegExp(`data-sd-lead="${end}"[^>]*>(?:<[^>]*>)*?<path d="([^"]+)"`).exec(html)?.[1];

describe('a lead into a port (cableLead)', () => {
  it('a low port\'s lead ends with its floor corner, not a run on along the floor', () => {
    const {html} = transformed(`${map}<i data-k="w" class="wire" data-arrow="lap.rj45 to sw.p1" data-packets="1"></i>`, {canvas});
    const d = leadPath(html, 'start');
    expect(d, html.slice(0, 400)).toBeTruthy();
    const steps = d.match(/[MLQ]/g);
    expect(steps.at(-1), d).toBe('Q');   // the floor corner is the lead's last piece
    expect(steps.filter((s) => s === 'Q')).toHaveLength(2);   // the corner out of the port's side and the floor corner
  });
});
