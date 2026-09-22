// --- Self-served Paravoxia preview for probes --------------------------------------
//
// Every browser probe that measures the game must serve the game itself and
// prove it is measuring the right program. On 2026-09-04 a probe pointed at a
// fixed port measured a DIFFERENT PROJECT after that port was taken over: it
// returned 200, rendered a real app, and nothing looked wrong. So this picks a
// free port and refuses to hand back a URL until the page served there carries
// `<title>Paravoxia</title>`.
//
//   const preview = await startParavoxiaPreview({ build: true });
//   try { ... probe against preview.url ... } finally { preview.stop(); }

import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import process from 'node:process';
import { resolve } from 'node:path';
import { bytesHash, snapshotPreviewBuild } from './previewSnapshot.mjs';

export function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

export async function waitForParavoxia(url, timeoutMs = 60_000, expectedIndexHash = null) {
  const deadline = Date.now() + timeoutMs;
  let lastError = 'no response';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(Math.max(1, Math.min(2000, deadline - Date.now()))) });
      const body = await response.text();
      if (response.ok && body.includes('<title>Paravoxia</title>')) {
        if (!expectedIndexHash || bytesHash(body) === expectedIndexHash) return;
        lastError = 'Paravoxia index does not match the owned build snapshot';
      } else {
        lastError = `served a page that is not Paravoxia (${body.length} bytes)`;
      }
    } catch (error) {
      lastError = String(error?.message ?? error);
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`Preview server never served Paravoxia at ${url}: ${lastError}`);
}

export function run(command, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', env: { ...process.env, ...env } });
    child.on('error', reject);
    child.on('exit', code => resolve(code ?? 1));
  });
}

/**
 * Build (optionally), start `vite preview` on a free port, verify identity, and
 * pin its build bytes, and return `{ url, port, stop, snapshotDir, buildHash }`. Honours `PARAVOXIA_URL` as an override for
 * callers that deliberately point at an already-running server — the identity
 * check still runs against it.
 */
export async function startParavoxiaPreview({ build = true, log = console.log, distDir = resolve('dist') } = {}) {
  if (process.env.PARAVOXIA_URL) {
    const url = process.env.PARAVOXIA_URL;
    await waitForParavoxia(url, 15_000);
    log(`[preview] using ${url} (identity confirmed)`);
    return { url, port: null, stop() {} };
  }
  if (build) {
    log('[preview] building…');
    const code = await run('npm', ['run', 'build']);
    if (code !== 0) throw new Error(`build failed (${code})`);
  }
  const port = await freePort();
  const url = `http://127.0.0.1:${port}/`;
  const snapshot = snapshotPreviewBuild(distDir);
  // An owned port plus an owned build: another Vite build cannot replace the
  // JavaScript underneath a running probe. Keep Vite in its own process group.
  const viteBin = new URL('../../node_modules/vite/bin/vite.js', import.meta.url).pathname;
  let child;
  try {
    child = spawn(process.execPath, [viteBin, 'preview', '--port', String(port), '--strictPort',
      '--outDir', snapshot.directory], { stdio: 'ignore', env: process.env, detached: true });
  } catch (error) {
    snapshot.cleanup();
    throw error;
  }
  let stopped = false;
  const signalHandlers = new Map();
  const stop = () => {
    if (stopped) return;
    stopped = true;
    process.removeListener('exit', stop);
    for (const [signal, handler] of signalHandlers) process.removeListener(signal, handler);
    try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill('SIGTERM'); }
    snapshot.cleanup();
  };
  process.once('exit', stop);
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    const handler = () => { stop(); process.exit(130); };
    signalHandlers.set(signal, handler);
    process.once(signal, handler);
  }
  child.once('exit', stop);
  try {
    await Promise.race([
      waitForParavoxia(url, 60_000, snapshot.manifest.files['index.html']),
      new Promise((_, reject) => child.once('error', reject))
    ]);
  } catch (error) {
    stop();
    throw error;
  }
  log(`[preview] serving Paravoxia at ${url} (owned build ${snapshot.manifest.sha256})`);
  return { url, port, stop, snapshotDir: snapshot.directory, buildHash: snapshot.manifest.sha256 };

}

/**
 * Chromium launch args shared by every probe on this machine.
 *
 * `--use-gl=angle` is load-bearing. Without it, headless Chromium on this box
 * fell back to SwiftShader and a cold-boot profile showed a 20-24 SECOND
 * `(program)` block — synchronous software shader compilation — that the real
 * GPU never produces. That number looked like an application bug for an hour.
 * `assertHardwareGl` below is the guard: a probe must know what rendered it.
 */
export const CHROMIUM_ARGS = [
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--ignore-gpu-blocklist',
  '--enable-webgl',
  '--use-gl=angle',
  '--enable-unsafe-swiftshader',
  '--autoplay-policy=no-user-gesture-required',
  '--mute-audio',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding'
];

export function chromePath() {
  return process.env.CHROME_PATH ?? '/snap/bin/chromium';
}

/**
 * Read the WebGL renderer string from a page and refuse to proceed on a
 * software renderer unless `PARAVOXIA_ALLOW_SWIFTSHADER=1`. Measurements taken
 * on SwiftShader are measurements of SwiftShader.
 */
export async function assertHardwareGl(page, log = console.log) {
  const renderer = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!gl) return null;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  });
  log(`[gl] renderer: ${renderer}`);
  const software = !renderer || /swiftshader|software|llvmpipe/i.test(renderer);
  if (software && process.env.PARAVOXIA_ALLOW_SWIFTSHADER !== '1') {
    throw new Error(`Software WebGL renderer (${renderer}); set PARAVOXIA_ALLOW_SWIFTSHADER=1 to measure it anyway`);
  }
  return renderer;
}
