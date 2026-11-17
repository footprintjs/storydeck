import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, symlinkSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { memberReader, regularBytes, requireClean } from './files.mjs';

test('member reads leave the output tree unchanged and refuse traversal or linked build input', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'storydeck-data-fixture-')));
  try {
    mkdirSync(join(root, 'dist'));
    writeFileSync(join(root, 'dist/index.js'), 'not executed');
    const before = readdirSync(root);
    const read = memberReader(root, '1'.repeat(40));
    assert.equal(read('dist/index.js').toString(), 'not executed');
    for (const path of ['../escape', '/escape', 'dist/../escape', 'dist//index.js', 'dist\\index.js']) {
      assert.throws(() => read(path));
    }
    assert.deepEqual(readdirSync(root), before);
    symlinkSync(join(root, 'dist/index.js'), join(root, 'dist/link.js'));
    assert.throws(() => read('dist/link.js'), /linked file/);
    assert.throws(() => regularBytes(join(root, 'dist')), /regular file/);
    assert.throws(() => regularBytes(join(root, 'dist/index.js'), 3), /bounded regular/);
  } finally { rmSync(root, { recursive: true }); }
});

test('clean source admission refuses staged-only content hidden by restored working bytes', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'storydeck-git-fixture-')));
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  try {
    git('init', '--quiet');
    const file = join(root, 'source.txt');
    writeFileSync(file, 'original'); git('add', 'source.txt');
    git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
      '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'inert fixture');
    const head = git('rev-parse', 'HEAD');
    requireClean(root, head);
    writeFileSync(file, 'changed'); git('add', 'source.txt');
    writeFileSync(file, 'original');
    assert.throws(() => requireClean(root, head));
    git('restore', '--staged', 'source.txt'); requireClean(root, head);
    writeFileSync(file, 'working-only');
    assert.throws(() => requireClean(root, head));
  } finally { rmSync(root, { recursive: true }); }
});
