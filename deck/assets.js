// assets — what the library ships that a built page carries inside it (Node): the <deck-stage> runtime, the focus,
// narration and deck stylesheets, and the version that names them. Found from this module, so the source tree and the
// installed package (dist/deck/…) read the same files.
import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const NAME = 'footprint-storydeck';

/** The package's root folder: the nearest folder up from here whose package.json is this package. */
export function packageRoot(from = path.dirname(fileURLToPath(import.meta.url))) {
  for (let dir = from; ; dir = path.dirname(dir)) {
    const pkg = path.join(dir, 'package.json');
    if (existsSync(pkg)) {
      try { if (JSON.parse(readFileSync(pkg, 'utf8')).name === NAME) return dir; } catch { /* not a package.json we can read: go on up */ }
    }
    if (path.dirname(dir) === dir) throw new Error(`cannot find the ${NAME} package around ${from}`);
  }
}

let cached = null;

/** {stageJs, css: [focus.css, narration.css, deck.css], version}, read once per process. */
export function pageAssets() {
  if (cached) return cached;
  const root = packageRoot();
  const read = (file) => readFileSync(path.join(root, file), 'utf8');
  cached = Object.freeze({
    stageJs: read('site/public/deck-stage.js'),
    css: Object.freeze([read('focus.css'), read('narration.css'), read('deck.css')]),
    version: JSON.parse(read('package.json')).version,
  });
  return cached;
}
