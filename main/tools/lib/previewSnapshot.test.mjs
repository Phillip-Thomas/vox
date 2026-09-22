import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { previewBuildManifest, snapshotPreviewBuild } from './previewSnapshot.mjs';

test('an owned preview keeps exact bytes after the shared build is replaced', () => {
  const source = mkdtempSync(join(tmpdir(), 'paravoxia-snapshot-test-'));
  let snapshot;
  try {
    mkdirSync(join(source, 'assets'));
    writeFileSync(join(source, 'index.html'), '<title>Paravoxia</title><script src="/assets/a.js"></script>');
    writeFileSync(join(source, 'assets/a.js'), 'window.original = true;');
    const original = previewBuildManifest(source);
    snapshot = snapshotPreviewBuild(source);
    rmSync(source, { recursive: true }); mkdirSync(source);
    writeFileSync(join(source, 'index.html'), '<title>Paravoxia</title>replacement');
    assert.deepEqual(snapshot.manifest, original);
    assert.deepEqual(previewBuildManifest(snapshot.directory), original);
    assert.equal(readFileSync(join(snapshot.directory, 'assets/a.js'), 'utf8'), 'window.original = true;');
    snapshot.cleanup(); snapshot.cleanup();
    assert.throws(() => readFileSync(join(snapshot.directory, 'index.html')), /ENOENT/);
  } finally { snapshot?.cleanup(); rmSync(source, { recursive: true, force: true }); }
});

test('an incomplete build or a linked mutable asset cannot become preview evidence', () => {
  const source = mkdtempSync(join(tmpdir(), 'paravoxia-snapshot-test-'));
  try {
    assert.throws(() => snapshotPreviewBuild(source), /missing index/);
    writeFileSync(join(source, 'index.html'), '<title>Paravoxia</title>');
    symlinkSync(join(source, 'index.html'), join(source, 'linked.html'));
    assert.throws(() => snapshotPreviewBuild(source), /mutable symlink/);
  } finally { rmSync(source, { recursive: true, force: true }); }
});
