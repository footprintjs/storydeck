import fs from 'node:fs';
import path from 'node:path';
import { assemblePost, scopeDeckCss } from 'storydeck';
import { BASE } from '../site.config';

// Loads the one post for this site (storydeck explaining storydeck) — same adapter the blog uses.
const dir = path.join(process.cwd(), 'content', 'posts', 'storydeck');

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

function load() {
  const { sections, ...meta } = readJson(path.join(dir, 'post.json'));
  const deck = readJson(path.join(dir, 'deck-data.json'));
  const bodyMd = fs.readFileSync(path.join(dir, 'body.md'), 'utf8');
  const deckSlides = deck.sections.map((s) => ({ label: s.label, html: s.html }));
  const post = assemblePost({ meta, sections, bodyMd, deckSlides });
  post.deckCssScoped = scopeDeckCss(deck.deckCss);
  return post;
}

export const post = load();
