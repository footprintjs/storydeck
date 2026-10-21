// source — a deck folder read from disk into plain data (Node). Nothing here draws; compile.js does that.
//
//   my-deck/
//     deck.json      the settings (config.js): title, footer, area, …
//     clicks.html    the parts and their clicks (parse.js)
//     map.html       a map: every element with data-k="name" and an inline left/top/width/height is a piece
//     theme.css      the deck's tokens and look (light, and :root.dark)
//     icons/*.svg    drawn identities, used as <i class="ic" data-icon="name"></i>
//
// Every file is read as paths.js says: by its real path, inside the deck folder, never hidden.
import {readFileSync, readdirSync, statSync} from 'node:fs';
import path from 'node:path';
import {readConfig} from './config.js';
import {parseClicks} from './parse.js';
import {readIcon} from './transforms.js';
import {deckPath, deckRoot, presence, realInside} from './paths.js';

const MAX_FILE = 4 * 1024 * 1024;   // a deck's text file is small; a bigger one is a mistake (a video, a dump), never read whole

/** A text file inside the deck folder (`root`, a real path), or null when it is not there (and `need` is false). */
function readText(root, file, {need, what}) {
  const full = path.join(root, file);
  const state = presence(full);
  if (state === 'dangling') throw new Error(`${file} is a link to a file that is not there`);
  if (state === 'missing') {
    if (need) throw new Error(`${what}: the deck has no ${file}`);
    return null;
  }
  const real = realInside(root, full, file);
  if (!statSync(real).isFile()) throw new Error(`${file} is not a file`);
  const size = statSync(real).size;
  if (size > MAX_FILE) throw new Error(`${file} is ${(size / 1048576).toFixed(1)} MB — a deck's text files stay under ${MAX_FILE / 1048576} MB`);
  return readFileSync(real, 'utf8');
}

/** A text file the deck has (dev.js re-reads a map before it edits one): read by the same rules as every deck file. */
export const deckFileText = (root, file) => readText(root, file, {need: true, what: 'the deck'});

/** The file a map is drawn in: the one deck.json "maps" names, or <name>.html. */
export function mapFile(config, name) {
  if (!/^[\w-]+$/.test(name)) throw new Error(`a map's name is letters, digits, - and _ — not "${name}"`);
  return Object.hasOwn(config.maps, name) ? config.maps[name] : deckPath(`${name}.html`, `maps.${name}`);   // a map called "toString" is toString.html
}

/** The icons folder: every *.svg in it, by its name. */
function readIcons(root, folder, need) {
  const full = path.join(root, folder);
  const state = presence(full);
  if (state === 'dangling') throw new Error(`${folder}/ is a link to a folder that is not there`);
  if (state === 'missing') {
    if (need) throw new Error(`deck.json "icons": the deck has no ${folder}/ folder`);
    return {};
  }
  const real = realInside(root, full, `${folder}/`);
  if (!statSync(real).isDirectory()) throw new Error(`${folder} is not a folder — icons are a folder of .svg files (deck.json "icons" names it)`);
  const set = {};
  for (const name of readdirSync(real).filter((f) => f.endsWith('.svg')).sort()) {
    const key = name.slice(0, -4);
    if (!/^[\w-]+$/.test(key)) throw new Error(`icons/${name}: an icon's name is letters, digits, - and _ (it is written data-icon="${key}")`);
    set[key] = readIcon(key, readText(root, `${folder}/${name}`, {need: true, what: 'icon'}));
  }
  return set;
}

/**
 * A deck folder as plain data: {dir, config, clicksHtml, parts, maps: {name: html}, themeCss, icons, post}. Every
 * file it names must be inside the folder; a map is the file deck.json "maps" names, or <name>.html.
 */
export function readDeck(dir) {
  const root = deckRoot(dir);
  const config = readConfig(readText(root, 'deck.json', {need: true, what: `${dir} is not a deck`}));
  const clicksHtml = readText(root, config.clicks, {need: true, what: 'the clicks'});
  const parts = parseClicks(clicksHtml);
  const maps = {};
  for (const part of parts) {
    if (!part.map || maps[part.map] !== undefined) continue;
    if (!/^[\w-]+$/.test(part.map)) throw new Error(`"${part.label}": data-map="${part.map}" — a map's name is letters, digits, - and _`);
    const file = mapFile(config, part.map);
    const html = readText(root, file, {need: false});
    if (html === null) throw new Error(`"${part.label}" is told on map "${part.map}", but the deck has no ${file} — add it, or name its file in deck.json "maps"`);
    maps[part.map] = html;
  }
  const given = (k) => config.given.includes(k);
  const themeCss = readText(root, config.theme, {need: given('theme'), what: 'deck.json "theme"'}) ?? '';
  const icons = readIcons(root, config.icons, given('icons'));
  const postText = config.post ? readText(root, config.post, {need: true, what: 'deck.json "post"'}) : null;
  let post = null;
  if (postText !== null) {
    try { post = JSON.parse(postText); } catch (e) { throw new Error(`${config.post} is not valid JSON: ${e.message}`); }
  }
  return {dir: root, config, clicksHtml, parts, maps, themeCss, icons, post};
}
