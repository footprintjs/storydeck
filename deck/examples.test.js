// The example decks in examples/ are what the README points at: each must load, check clean and tell what it says.
import {describe, it, expect} from 'vitest';
import path from 'node:path';
import {loadDeck} from './build.js';
import {checkDeck, formatProblems} from './check.js';
import {reviewClick, outline} from './review.js';
import {deckHtml} from './build.js';

const folder = (name) => path.join(process.cwd(), 'examples', name);

describe('examples/a-request: blocks on a floor, a view that follows, an order inside a click', () => {
  const {compiled} = loadDeck(folder('a-request'));

  it('checks clean', () => {
    expect(formatProblems(checkDeck(compiled))).toBe('no problems');
  });

  it('is three clicks on isometric pieces, the floor under them as ground', () => {
    expect(outline(compiled).split('\n')).toHaveLength(3);
    expect(compiled.iso).toBe(true);
    const pieces = compiled.maps.map.pieces;
    expect(pieces.filter((p) => p.ground).map((p) => p.keys[0])).toEqual(['floor']);
    expect(compiled.slides[0].html).toContain('data-sd-iso="block"');
    expect(compiled.slides[2].html).toContain('data-sd-iso="cylinder"');
  });

  it('plays each click in the order its route writes: the view first, a slow packet, then what follows', () => {
    expect(reviewClick(compiled, 2)).toContain('focus: fit, path · route: the view (1 s) → w1 (1.2 s) → dns, 0.35 s apart where a turn does not say');
    expect(reviewClick(compiled, 3)).toContain('route: the view (0.6 s) → w2 → server → w3 + db → why');
    // the view follows the pieces: it is closest on the first click and stands further out on each one after
    const scale = compiled.clicks.map((c) => c.look.stage.move.s);
    expect(scale[0]).toBeGreaterThan(scale[1]);
    expect(scale[1]).toBeGreaterThan(scale[2]);
    expect(scale[2]).toBeGreaterThan(0.5);   // and never so far that words get small (check's view-far)
  });

  it('builds into one page that carries the isometric stylesheet', () => {
    const {html} = deckHtml(folder('a-request'));
    expect(html).toContain('isometric pieces: blocks on a floor seen from a corner');
    expect(html).toContain('<polygon class="iso-top"');
  });
});
