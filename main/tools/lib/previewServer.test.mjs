import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startParavoxiaPreview } from './previewServer.mjs';

test('a running preview serves its original build after a concurrent rebuild', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'paravoxia-preview-test-'));
  let preview;
  const previousUrl = process.env.PARAVOXIA_URL;
  delete process.env.PARAVOXIA_URL;
  try {
    mkdirSync(join(directory, 'assets'));
    const original = '<!doctype html><title>Paravoxia</title><script src="/assets/a.js"></script>';
    writeFileSync(join(directory, 'index.html'), original);
    writeFileSync(join(directory, 'assets/a.js'), 'window.build = "original";');
    preview = await startParavoxiaPreview({ build: false, distDir: directory, log() {} });
    assert.ok(preview.buildHash);
    assert.ok(existsSync(preview.snapshotDir));
    assert.equal(await (await fetch(preview.url)).text(), original);
    rmSync(directory, { recursive: true }); mkdirSync(directory);
    writeFileSync(join(directory, 'index.html'), '<title>Paravoxia</title>new build');
    assert.equal(await (await fetch(preview.url)).text(), original);
    assert.equal(await (await fetch(new URL('assets/a.js', preview.url))).text(), 'window.build = "original";');
    preview.stop(); preview.stop();
    assert.equal(existsSync(preview.snapshotDir), false);
  } finally {
    preview?.stop();
    rmSync(directory, { recursive: true, force: true });
    if (previousUrl === undefined) delete process.env.PARAVOXIA_URL;
    else process.env.PARAVOXIA_URL = previousUrl;
  }
});
