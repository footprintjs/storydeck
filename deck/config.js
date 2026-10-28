// config — a deck's deck.json, checked and given its defaults. Plain data in, plain data out.
//
//   { "title": "A request, end to end" }                       the least a deck needs
//   { "title": "…", "description": "…", "lang": "en",
//     "footer": "… · illustration",                            the text in every slide's footer (default: the title)
//     "area": [0, 220, 1920, 1000],                             where focus may move and blur: below the headline, above the footer
//     "canvas": [1920, 1080],                                   the slide's design size
//     "clicks": "clicks.html", "theme": "theme.css", "icons": "icons",
//     "maps": { "map": "map.html" },                            a map's file (default: <name>.html)
//     "out": "index.html",                                      the built page, inside the deck folder
//     "post": "post.json", "deckData": "deck-data.json",       the Read/Scroll lenses' sources, when the deck has them
//     "checks": { "maxWords": 12, "maxSlideWords": 40 },        what `storydeck check` asks: words in a headline, on a plain slide
//     "explore": true }                                         a viewer may click a piece to go to the click about it (explore.js)
//
// A key it does not know is refused with the keys it does, so a typo is never a silent default. A file name it gives
// follows paths.js · deckPath (relative, inside the deck, nothing hidden).
import {deckPath} from './paths.js';

export const DEFAULTS = Object.freeze({
  lang: 'en',
  canvas: Object.freeze([1920, 1080]),
  area: Object.freeze([0, 220, 1920, 1000]),
  clicks: 'clicks.html',
  theme: 'theme.css',
  icons: 'icons',
  out: 'index.html',
  checks: Object.freeze({maxWords: 12, maxSlideWords: 40}),
});
const KEYS = ['title', 'description', 'lang', 'footer', 'area', 'canvas', 'clicks', 'theme', 'icons', 'maps', 'out', 'post', 'deckData', 'checks', 'explore'];
const CHECK_KEYS = ['maxWords', 'maxSlideWords'];

const isText = (v) => typeof v === 'string' && v.trim().length > 0;
const numbers = (v, n) => Array.isArray(v) && v.length === n && v.every((x) => typeof x === 'number' && Number.isFinite(x));

/** deck.json, read: the deck's settings with every default filled in. Throws, naming the fix, on anything it cannot use. */
export function readConfig(json) {
  let raw;
  try {
    raw = typeof json === 'string' ? JSON.parse(json) : json;
  } catch (e) {
    throw new Error(`deck.json is not valid JSON: ${e.message}`);
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('deck.json is an object: { "title": "…" }');
  const unknown = Object.keys(raw).filter((k) => !KEYS.includes(k));
  if (unknown.length) throw new Error(`deck.json has ${unknown.map((k) => `"${k}"`).join(', ')}, which it does not know (the keys are ${KEYS.join(', ')})`);
  if (!isText(raw.title)) throw new Error('deck.json needs a "title" (the page title and, by default, the footer)');
  for (const k of ['description', 'lang', 'footer']) {
    if (raw[k] !== undefined && typeof raw[k] !== 'string') throw new Error(`deck.json "${k}" is text, not ${JSON.stringify(raw[k])}`);
  }
  const canvas = raw.canvas ?? DEFAULTS.canvas;
  if (!numbers(canvas, 2) || canvas.some((x) => x <= 0)) throw new Error(`deck.json "canvas" is [width, height] in px, not ${JSON.stringify(raw.canvas)}`);
  const area = raw.area ?? [0, Math.min(DEFAULTS.area[1], canvas[1]), canvas[0], Math.max(0, canvas[1] - 80)];
  if (!numbers(area, 4) || area[2] <= area[0] || area[3] <= area[1]) throw new Error(`deck.json "area" is [x0, y0, x1, y1] in slide px (x1 > x0, y1 > y0), not ${JSON.stringify(raw.area)}`);
  const maps = raw.maps ?? {};
  if (!maps || typeof maps !== 'object' || Array.isArray(maps)) throw new Error('deck.json "maps" names each map\'s file: { "map": "map.html" }');
  const checks = raw.checks ?? {};
  if (!checks || typeof checks !== 'object' || Array.isArray(checks)) throw new Error('deck.json "checks" is an object: { "maxWords": 12, "maxSlideWords": 40 }');
  const unknownCheck = Object.keys(checks).filter((k) => !CHECK_KEYS.includes(k));
  if (unknownCheck.length) throw new Error(`deck.json "checks" has ${unknownCheck.join(', ')}, which it does not know (the checks are ${CHECK_KEYS.join(', ')})`);
  const count = (k) => {
    const v = checks[k] ?? DEFAULTS.checks[k];
    if (!Number.isInteger(v) || v < 1) throw new Error(`deck.json "checks.${k}" is a whole number of words, not ${JSON.stringify(checks[k])}`);
    return v;
  };
  const maxWords = count('maxWords'), maxSlideWords = count('maxSlideWords');
  if (raw.explore !== undefined && typeof raw.explore !== 'boolean') throw new Error(`deck.json "explore" is true or false, not ${JSON.stringify(raw.explore)}`);
  return Object.freeze({
    title: raw.title.trim(),
    description: raw.description ?? '',
    lang: raw.lang ?? DEFAULTS.lang,
    footer: raw.footer ?? raw.title.trim(),
    canvas: Object.freeze([...canvas]),
    area: Object.freeze([...area]),
    clicks: deckPath(raw.clicks ?? DEFAULTS.clicks, 'clicks'),
    theme: deckPath(raw.theme ?? DEFAULTS.theme, 'theme'),
    icons: deckPath(raw.icons ?? DEFAULTS.icons, 'icons'),
    maps: Object.freeze(Object.fromEntries(Object.entries(maps).map(([name, file]) => [name, deckPath(file, `maps.${name}`)]))),
    out: deckPath(raw.out ?? DEFAULTS.out, 'out'),
    post: raw.post === undefined ? null : deckPath(raw.post, 'post'),
    deckData: raw.deckData === undefined ? null : deckPath(raw.deckData, 'deckData'),
    checks: Object.freeze({maxWords, maxSlideWords}),
    explore: raw.explore === true,
    given: Object.freeze(Object.keys(raw)),   // the keys deck.json wrote: a file it names must be there; a default may be absent
  });
}
