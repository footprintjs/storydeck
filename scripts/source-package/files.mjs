// Read original Git documents and regular checked build bytes; never extract a package.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { constants, openSync, fstatSync, readFileSync, closeSync, lstatSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { INSPECTOR_HEAD } from './receipt.mjs';

export const git = (root, args) => execFileSync('git', ['-C', root, ...args],
  { timeout: 10000, maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });

export function regularBytes(file, maximum = 64 * 1024 * 1024) {
  assert.equal(realpathSync(dirname(file)), resolve(dirname(file)), 'aliased parent');
  assert(!lstatSync(file).isSymbolicLink(), 'linked file');
  const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = fstatSync(fd);
    assert(stat.isFile() && stat.nlink === 1 && stat.size <= maximum, 'not a bounded regular file');
    const bytes = readFileSync(fd);
    const after = fstatSync(fd);
    assert(bytes.length <= maximum && after.size === stat.size && after.mtimeMs === stat.mtimeMs
      && after.ctimeMs === stat.ctimeMs, 'file changed while reading');
    return bytes;
  } finally { closeSync(fd); }
}

export function original(root, head, path) {
  assert.match(head, /^[a-f0-9]{40}$/);
  return git(root, ['show', `${head}:${path}`]);
}

export function identity(root, head) {
  assert.match(head, /^[a-f0-9]{40}$/);
  return { head, tree: git(root, ['rev-parse', `${head}^{tree}`]).toString().trim() };
}

export function requireClean(root, head) {
  assert.equal(git(root, ['rev-parse', 'HEAD']).toString().trim(), head);
  git(root, ['diff', '--exit-code', 'HEAD', '--']);
}

export function loadInspector(root) {
  requireClean(root, INSPECTOR_HEAD);
  return createRequire(import.meta.url)(join(resolve(root), 'src/release-route/archive/inspector.cjs'));
}

export function memberReader(root, head) {
  return (path) => {
    assert(path && !path.includes('\\') && !path.includes(':') &&
      path.split('/').every((part) => part !== '' && part !== '.' && part !== '..'));
    return path.startsWith('dist/') ? regularBytes(join(root, path)) : original(root, head, path);
  };
}
