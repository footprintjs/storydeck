// What a consumer installs, checked the way a consumer meets it: every JavaScript door of the exports
// map loads in plain Node — no bundler, no JSX transform, no help — and the packed files carry the
// compiled modules and no source JSX. Run after `npm run build` (CI does both).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const failures = [];

for (const [door, target] of Object.entries(pkg.exports)) {
  const file = typeof target === 'string' ? target : target.default;
  // CSS is a stylesheet, and deck-stage.js is the browser runtime a page loads with a <script> tag
  if (file.endsWith('.css') || door === './deck-stage.js') continue;
  const name = door === '.' ? pkg.name : `${pkg.name}/${door.slice(2)}`;
  try {
    const mod = await import(name); // the package's own name: Node resolves it through the exports map
    if (Object.keys(mod).length === 0) failures.push(`${name} loads but exports nothing`);
  } catch (error) {
    failures.push(`${name} does not load in plain Node: ${error.message}`);
  }
}

const [packed] = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { encoding: 'utf8' }));
const files = packed.files.map((f) => f.path);
for (const f of files.filter((p) => p.endsWith('.jsx'))) failures.push(`the package ships source JSX: ${f}`);
for (const [door, target] of Object.entries(pkg.exports)) {
  for (const file of typeof target === 'string' ? [target] : Object.values(target)) {
    if (!files.includes(file.replace(/^\.\//, ''))) failures.push(`${door} points at ${file}, which the package does not ship`);
  }
}

if (failures.length > 0) {
  console.error(failures.map((f) => `✗ ${f}`).join('\n'));
  process.exit(1);
}
console.log(`✓ every JavaScript door loads in plain Node; ${files.length} files packed, no source JSX`);
