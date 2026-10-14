// Compiles the library to dist/: plain ESM JavaScript that Node and every bundler load as they are.
//
// The source stays what it is — JSX with extensionless relative imports, the way the tests and the
// demo site read it. What ships is that source compiled FILE BY FILE (never bundled): one dist file
// per source file, JSX turned into calls to `react/jsx-runtime`, every relative import given its
// `.js`. File by file keeps each module's own directives ('use client' stays on the components a
// server-rendering host must hydrate) and keeps one module per file, so the barrel and a subpath door
// (`/focus`, `/tour` …) share one instance of what they both import.
//
// The types are not built here: they are the hand-kept `*.d.ts` beside the source (index.d.ts says
// why), and the exports map points `types` at them.
import { transform } from 'esbuild';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'dist');

/** The library's source files: the root's modules and content/, never a test or a config. */
const isSource = (name) => /\.(js|jsx)$/.test(name) && !/\.test\.(js|jsx)$/.test(name) && !/^vitest\./.test(name);
const SOURCES = ['', 'content'].flatMap((dir) =>
  readdirSync(path.join(ROOT, dir), { withFileTypes: true })
    .filter((e) => e.isFile() && isSource(e.name))
    .map((e) => path.join(dir, e.name)),
);

/** `./x` → `./x.js` (the source file is x.js or x.jsx); `./x.jsx` → `./x.js`; a package specifier is left alone. */
function compiledSpecifier(fromFile, spec) {
  if (!spec.startsWith('./') && !spec.startsWith('../')) return spec;
  if (spec.endsWith('.jsx')) return spec.slice(0, -1);
  const base = path.join(ROOT, path.dirname(fromFile), spec);
  // what the source names first, so `./a.b` (a file `a.b.js`) is never mistaken for one with an extension
  if (existsSync(`${base}.js`) || existsSync(`${base}.jsx`)) return `${spec}.js`;
  if (path.extname(spec) === '.js' && existsSync(base)) return spec;
  throw new Error(`${fromFile}: cannot resolve "${spec}" to a source file`);
}

// `from '…'`, `import '…'` and `import('…')` — every way a module names another.
const SPECIFIER = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])([^'"]+)\2/g;

rmSync(OUT, { recursive: true, force: true });
for (const file of SOURCES) {
  const source = readFileSync(path.join(ROOT, file), 'utf8');
  const { code } = await transform(source, {
    loader: file.endsWith('.jsx') ? 'jsx' : 'js',
    jsx: 'automatic',
    format: 'esm',
    target: 'es2022',
    sourcefile: file,
  });
  const out = path.join(OUT, file.replace(/\.jsx$/, '.js'));
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, code.replace(SPECIFIER, (_, lead, q, spec) => `${lead}${q}${compiledSpecifier(file, spec)}${q}`));
}
console.log(`✓ built dist/ — ${SOURCES.length} modules`);
