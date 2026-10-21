// source — a deck folder read from disk into plain data (Node). Nothing here draws; compile.js does that.
//
//   my-deck/
//     deck.json      the settings (config.js): title, footer, area, …
//     clicks.html    the parts and their clicks (parse.js)
//     map.html       a map: every element with data-k="name" and an inline left/top/width/height is a piece
//     theme.css      the deck's tokens and look (light, and :root.dark)
//     icons/*.svg    drawn identities, used as <i class="ic" data-icon="name"></i>
import {existsSync, readFileSync, readdirSync, realpathSync, statSync} from 'node:fs';
import path from 'node:path';
import {readConfig, deckPath} from './config.js';
import {parseClicks} from './parse.js';
import {readIcon} from './transforms.js';

const MAX_FILE = 4 * 1024 * 1024;   // a deck's text file is small; a bigger one is a mistake (a video, a dump), never read whole

/**
 * Where a deck file really is — refused when it (or a folder on the way) is a link that leaves the deck folder, so a
 * deck someone sent you cannot pull a file from elsewhere on your machine into its page, its review or its server.
 */
export function inside(root, full, file) {
  const real = realpathSync(full);
  if (real !== root && !real.startsWith(root + path.sep)) throw new Error(`${file} is a link to a file outside the deck folder — a deck reads only its own files`);
  return real;
}

/** A text file inside the deck folder (`root`, a real path), or null when it is not there (and `need` is false). */
function readText(root, file, {need, what}) {
  const full = path.join(root, file);
  if (!existsSync(full)) {
    if (need) throw new Error(`${what}: the deck has no ${file}`);
    return null;
  }
  const real = inside(root, full, file);
  if (!statSync(real).isFile()) throw new Error(`${file} is not a file`);
  const size = statSync(real).size;
  if (size > MAX_FILE) throw new Error(`${file} is ${(size / 1048576).toFixed(1)} MB — a deck's text files stay under ${MAX_FILE / 1048576} MB`);
  return readFileSync(real, 'utf8');
}

/** The icons folder: every *.svg in it, by its name. */
function readIcons(root, folder, need) {
  const full = path.join(root, folder);
  if (!existsSync(full)) {
    if (need) throw new Error(`deck.json "icons": the deck has no ${folder}/ folder`);
    return {};
  }
  const set = {};
  for (const name of readdirSync(inside(root, full, `${folder}/`)).filter((f) => f.endsWith('.svg')).sort()) {
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
  if (!existsSync(dir) || !statSync(dir).isDirectory()) throw new Error(`${dir} is not a folder — a deck is a folder with deck.json (make one: storydeck init ${dir})`);
  const root = realpathSync(path.resolve(dir));
  const config = readConfig(readText(root, 'deck.json', {need: true, what: `${dir} is not a deck`}));
  const clicksHtml = readText(root, config.clicks, {need: true, what: 'the clicks'});
  const parts = parseClicks(clicksHtml);
  const maps = {};
  for (const part of parts) {
    if (!part.map || maps[part.map] !== undefined) continue;
    if (!/^[\w-]+$/.test(part.map)) throw new Error(`"${part.label}": data-map="${part.map}" — a map's name is letters, digits, - and _`);
    const file = config.maps[part.map] ?? deckPath(`${part.map}.html`, `maps.${part.map}`);
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
