// One scripts-off pack AFTER the existing native checks, then retain its original bytes.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, writeFileSync, realpathSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { createReceipt } from './receipt.mjs';
import { identity, loadInspector, memberReader, original, regularBytes, requireClean } from './files.mjs';

function packEnvironment(env) {
  const child = {};
  for (const [key, value] of Object.entries(env)) {
    if (/token|secret|password|passwd|key|auth|credential|^github_|^actions_/i.test(key)) continue;
    child[key] = value;
  }
  return { ...child, NPM_CONFIG_UPDATE_NOTIFIER: 'false' };
}

function prepareOutput(root, out) {
  assert(isAbsolute(out) && resolve(out) === out, 'output must be absolute');
  const parent = realpathSync(join(out, '..'));
  assert.equal(parent, resolve(out, '..'), 'aliased output parent');
  const path = relative(root, out);
  assert(path === '..' || path.startsWith('../') || isAbsolute(path), 'output inside source');
  mkdirSync(out, { mode: 0o700 }); // A consumed or pre-existing output is never reused.
}

export function retain({ root, inspectorRoot, out, sourceHead, testedHead, env = process.env }) {
  root = realpathSync(root);
  requireClean(root, testedHead);
  const source = identity(root, sourceHead), tested = identity(root, testedHead);
  assert.equal(source.tree, tested.tree, 'source/tested trees differ');
  const inspector = loadInspector(inspectorRoot);
  const manifestBytes = original(root, sourceHead, 'package.json');
  const lockBytes = original(root, sourceHead, 'package-lock.json');
  const profileBytes = original(root, sourceHead, '.github/release.json');
  prepareOutput(root, out);
  execFileSync('npm', ['pack', '--offline', '--ignore-scripts', '--json', '--pack-destination', out], {
    cwd: root, env: packEnvironment(env), timeout: 60000, maxBuffer: 2 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const files = readdirSync(out);
  assert.equal(files.length, 1, 'one original archive required');
  const archiveName = files[0];
  const archiveBytes = regularBytes(join(out, archiveName), 16 * 1024 * 1024);
  const receipt = createReceipt({ source, tested, manifestBytes, lockBytes, profileBytes,
    archiveName, archiveBytes, inspector, memberBytes: memberReader(root, sourceHead) });
  requireClean(root, testedHead);
  for (const [name, bytes] of [['source-package.json', manifestBytes],
    ['source-package-lock.json', lockBytes], ['candidate.json', JSON.stringify(receipt, null, 2) + '\n']]) {
    writeFileSync(join(out, name), bytes, { flag: 'wx', mode: 0o600 });
  }
  return receipt;
}
