#!/usr/bin/env node
// Stage 3 composed-sync LIVE probe (audio-10x run): boots `?story=<beat>&movie=1`
// on an ephemeral HMR-off vite server, unlocks audio exactly as fps-score-probe
// does, and records, per contracted anchor that fires in the beat:
//   - the HitSchedule (audioTime, armedAt, perfTime, quantumLanded, slackMs, onsetAttackMs),
//   - the bundle derivation (bundleAt, latencyComp terms and sample-rate key),
//   - the tick the STATE members ran, the tick the presentation fired, and the
//     tick the SFX member was posted + the audio time it was scheduled to,
//   - the rAF frame series around the fire, so the image frame offset against
//     the predicted audible onset is compared (0/+2 frame budget); actual
//     rendered visibility and captured acoustic onset still need peer review,
//   - a dense frame strip (-3..+3 around the fire) from the CDP screencast with a
//     burned-in DOM overlay (audioTime, armedAt, bundleAt, latencyCompMs + key,
//     device/music terms, beatClock≈, sfxAudioTime, ctx.currentTime, perf now).
//
//   node tools/hit-sync-probe.mjs <outDir> --beat a1-ramp [--start ch1-anomaly] [--runs 3] [--timeout 120] [--no-strips]
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const outDir = args.find((a) => !a.startsWith('--'));
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && i + 1 < args.length ? args[i + 1] : d; };
const beat = flag('beat', null);
// --start: the beat the movie lane boots into; the story then ADVANCES into `beat`
// on its own, so the target's arming tick happens with the world assembled and
// the frame loop steady (a deep link straight into the target arms during boot).
const start = flag('start', beat);
const runs = Math.max(1, Number(flag('runs', 3)));
const timeoutS = Number(flag('timeout', 120));
const strips = !args.includes('--no-strips');
const reducedMotion = args.includes('--reduced-motion');
const mobile = args.includes('--mobile');
const quality = flag('quality', 'full');
if (!outDir || !beat) { console.error('usage: hit-sync-probe.mjs <outDir> --beat <beat> [--runs 3] [--timeout 120] [--no-strips]'); process.exit(2); }
const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const FRAME_MS = 1000 / 60;

async function serverUp(port) { try { const response = await fetch(`http://localhost:${port}/`); return response.ok && /<title>\s*Paravoxia\s*<\/title>/i.test(await response.text()); } catch { return false; } }
async function freshPort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer(); server.unref(); server.on('error', reject);
    server.listen(0, '127.0.0.1', () => { const p = server.address().port; server.close((e) => (e ? reject(e) : resolve(p))); });
  });
}
const port = await freshPort();
const viteScript = ["import { createServer } from 'vite'", "import react from '@vitejs/plugin-react'",
  `const server = await createServer({ configFile: false, root: process.cwd(), plugins: [react()], server: { port: ${port}, strictPort: true, hmr: false, watch: null } })`,
  'await server.listen()', 'await new Promise(() => {})'].join(';');
const viteProc = spawn(process.execPath, ['--input-type=module', '--eval', viteScript], { cwd: root, stdio: 'ignore', env: { ...process.env, PROBE_NO_HMR: '1' } });
process.once('exit', () => { if (viteProc && !viteProc.killed) viteProc.kill(); });
for (let i = 0; i < 100 && !(await serverUp(port)); i++) await new Promise((r) => setTimeout(r, 300));
if (!(await serverUp(port))) throw new Error('vite dev server did not come up');

const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs.readdirSync(pwDir).filter((d) => /^chromium-\d+$/.test(d)).sort().pop();
const executablePath = path.join(pwDir, chromeDir, 'chrome-linux/chrome');
const browser = await chromium.launch({
  executablePath, headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--window-size=1280,720', '--autoplay-policy=no-user-gesture-required', '--mute-audio']
});
fs.mkdirSync(outDir, { recursive: true });
const report = { schema: 'paravoxia.hitSyncEvidence.v2', beat, start, variant: { reducedMotion, mobile, quality }, runs: [], generatedAt: new Date().toISOString(),
  evidenceScope: 'Presentation callback timing versus predicted post-tail onset; screencast frames require independent visibility review. This verdict does not establish actual image/acoustic sync.' };

for (let run = 1; run <= runs; run++) {
  const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 720 }, reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  const pageErrors = [];
  page.on('pageerror', (e) => { pageErrors.push(e.message); console.log(`[pageerror] ${e.message}`); });
  // rAF frame ring + burned overlay, installed before any module loads.
  await page.addInitScript(() => {
    const frames = [];
    const ring = 2400;
    const anchors = new Map();
    let overlay = null;
    const fmt = (v, d = 3) => (v == null || !Number.isFinite(v) ? '—' : Number(v).toFixed(d));
    const tick = (now) => {
      frames.push(now);
      if (frames.length > ring) frames.splice(0, frames.length - ring);
      try {
        if (!overlay && document.body) {
          overlay = document.createElement('pre');
          overlay.id = 'vox-sync-overlay';
          overlay.style.cssText = 'position:fixed;left:8px;top:8px;z-index:99999;margin:0;padding:6px 8px;font:11px/1.25 monospace;color:#e8f0ff;background:rgba(0,0,0,.72);pointer-events:none;white-space:pre';
          document.body.appendChild(overlay);
        }
        if (overlay) {
          const diag = window.__voxBundleDiag?.();
          const hit = window.__voxHitDiag?.();
          const t = diag?.trace ?? [];
          for (const event of t) {
            if (!event.fired) continue;
            let captured = anchors.get(event.seq);
            if (!captured) { captured = { fire: event.fired.perfNow, frames: frames.filter(frame => frame >= event.fired.perfNow - 2000) }; anchors.set(event.seq, captured); }
            else if (now <= captured.fire + 2000 && captured.frames.at(-1) !== now) captured.frames.push(now);
          }
          const recent = t.filter(event => event.fired && now - event.fired.perfNow <= 500).at(-1);
          const pending = t.filter(event => !event.fired).sort((a, b) => (a.perfNow + (a.bundleAt - a.armedBeatClock) * 1000) - (b.perfNow + (b.bundleAt - b.armedBeatClock) * 1000))[0];
          const last = recent ?? pending ?? t.at(-1);
          const arm = last?.arm;
          const ctxNow = hit?.currentTime;
          const beatApprox = last ? last.armedBeatClock + (now - last.perfNow) / 1000 : null;
          overlay.textContent =
            `beat ${window.__storyBeat ?? '—'}   perf ${fmt(now, 1)} ms   ctx.currentTime ${fmt(ctxNow, 4)} s   sr ${hit?.sampleRate ?? '—'}\n` +
            (last
              ? `anchor ${last.anchorId}  path ${arm?.fallback ? 'immediate' : arm?.schedule?.quantumLanded ?? '—'}\n` +
                `audioTime ${fmt(arm?.schedule?.audioTime, 4)}  armedAt ${fmt(arm?.schedule?.armedAt, 4)}  slack ${fmt(arm?.schedule?.slackMs, 1)} ms  attack ${fmt(arm?.schedule?.onsetAttackMs, 0)} ms\n` +
                `bundleAt ${fmt(last.bundleAt, 4)} (beat clock)  beatClock≈ ${fmt(beatApprox, 3)}  armed@ ${fmt(last.armedBeatClock, 3)}\n` +
                `latencyCompMs ${fmt(arm?.latency?.totalS * 1000, 2)} = device ${fmt(arm?.latency?.deviceS * 1000, 2)} + music-path ${fmt(arm?.latency?.musicPathS * 1000, 3)} @ key ${arm?.latency?.sampleRateKey ?? '—'} (ctx ${arm?.latency?.contextSampleRate ?? '—'})\n` +
                `sfxAudioTime ${fmt(arm?.sfxAudioTime, 4)} (fwd ${fmt(arm?.latency?.musicVsSfxS * 1000, 3)} ms)  schedulingArmAt ${fmt(last.schedulingArmAt?.beatClock, 3)}  authoredCommitAt ${fmt(last.authoredCommitAt?.beatClock, 3)}\n` +
                `fired@ ${fmt(last.fired?.beatClock, 3)}  sfx@ ${fmt(last.sfxPosted?.beatClock, 3)}`
              : 'no bundle armed yet');
        }
      } catch { /* overlay is evidence, never a fault */ }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    window.__voxFrames = { snapshot: () => frames.slice(), anchorSnapshots: () => Object.fromEntries(anchors), timeOrigin: performance.timeOrigin };
  });
  if (quality === 'lean') await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 2 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 2 });
  });
  // Screencast ring for the strips.
  const cdp = await page.context().newCDPSession(page);
  const shots = [];
  const anchorShots = new Map();
  if (strips) {
    cdp.on('Page.screencastFrame', (f) => {
      shots.push({ epochS: f.metadata.timestamp, data: f.data });
      for (const captured of anchorShots.values()) if (f.metadata.timestamp <= captured.fireEpochS + 2) captured.shots.push({ epochS: f.metadata.timestamp, data: f.data });
      if (shots.length > 240) shots.splice(0, shots.length - 240);
      cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
    });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 60, maxWidth: 640, maxHeight: 360, everyNthFrame: 1 });
  }
  const runRec = { run, beatLive: false, unlocked: null, anchors: [], frames: null };
  try {
    await page.goto(`http://localhost:${port}/?story=${start}&movie=1`, { waitUntil: 'load' });
    // Unlock audio as early as possible so the first beat's arming sees a transport.
    runRec.unlocked = await page.evaluate(async () => {
      const music = await import('/src/audio/musicEngine.ts');
      const sfx = await import('/src/audio/sfxEngine.ts');
      const story = await import('/src/story/storyScore.ts');
      await music.unlockMusicAudio();
      await sfx.unlockSfxAudio();
      story.unlockStoryScore();
      const core = await import('/src/audio/audioCore.ts');
      return core.peekAudioContext()?.state ?? 'none';
    }).catch((e) => `error: ${e.message}`);
    runRec.expectedAnchorIds = await page.evaluate(async target => Object.entries((await import('/src/story/storyScore.ts')).STORY_HIT_ANCHORS).filter(([, row]) => row.beat === target).map(([id]) => id), beat);
    const t0 = Date.now();
    let done = false;
    let seen = new Set();
    while ((Date.now() - t0) / 1000 < timeoutS) {
      const snap = await page.evaluate(() => ({
        beat: window.__storyBeat ?? null,
        trace: window.__voxBundleDiag?.()?.trace ?? [],
        timeOrigin: performance.timeOrigin,
        caps: window.__voxBundleDiag?.()?.caps ?? null
      })).catch(() => null);
      if (!snap) break;
      if (snap.caps) runRec.caps = snap.caps;
      if (snap.beat === beat) runRec.beatLive = true;
      for (const e of snap.trace) {
        if (e.beat !== beat) continue;
        if (e.fired && !seen.has(e.seq)) {
          seen.add(e.seq);
          runRec.anchors.push(e);
          const fireEpochS = (snap.timeOrigin + e.fired.perfNow) / 1000;
          anchorShots.set(e.seq, { fireEpochS, shots: shots.filter(shot => shot.epochS >= fireEpochS - 2) });
          console.log(`[run ${run}] ${e.anchorId} fired@${e.fired.beatClock.toFixed(3)} bundleAt=${e.bundleAt.toFixed(3)} ${e.arm.fallback ? 'IMMEDIATE' : e.arm.schedule.quantumLanded} slack=${e.arm.schedule?.slackMs?.toFixed(1) ?? '—'}ms`);
        }
      }
      // Stop once the beat has advanced past the target beat and every armed bundle fired.
      const pending = snap.trace.some((e) => e.beat === beat && !e.fired);
      const armedForBeat = snap.trace.some((e) => e.beat === beat);
      if (runRec.beatLive && snap.beat !== beat && !pending && armedForBeat) { done = true; break; }
      await new Promise((r) => setTimeout(r, 200));
    }
    // Let the last screencast frames arrive, then read the frame ring and hit trace.
    await new Promise((r) => setTimeout(r, 2200));
    const fr = await page.evaluate(() => ({ frames: window.__voxFrames.snapshot(), anchors: window.__voxFrames.anchorSnapshots(), timeOrigin: window.__voxFrames.timeOrigin, hits: window.__voxHitDiag?.()?.trace ?? [], bundles: window.__voxBundleDiag?.()?.trace ?? [] })).catch(() => null);
    // A presentation can precede a separate authored timeline commit (track).
    // Read the final row rather than freezing the semantic trace at first fire.
    runRec.anchors = runRec.anchors.map(event => fr?.bundles.find(final => final.seq === event.seq) ?? event);
    runRec.frames = fr ? { count: fr.frames.length, timeOrigin: fr.timeOrigin } : null;
    runRec.hitTrace = fr?.hits ?? [];
    runRec.completed = done;
    runRec.audioQuality = await page.evaluate(async () => (await import('/src/audio/bedEngine.ts')).getBedQualityTier());
    // Per-anchor frame analysis + strips.
    for (const e of runRec.anchors) {
      const arm = e.arm;
      const a = { anchorId: e.anchorId, fallback: arm.fallback, quantumLanded: arm.schedule?.quantumLanded ?? 'immediate',
        audioTime: arm.schedule?.audioTime ?? null, armedAt: arm.schedule?.armedAt ?? null, slackMs: arm.schedule?.slackMs ?? null,
        capMs: runRec.caps?.[e.anchorId] ?? null, onsetAttackMs: arm.schedule?.onsetAttackMs ?? null,
        bundleAt: e.bundleAt, armedBeatClock: e.armedBeatClock, latency: arm.latency,
        schedulingArmAt: e.schedulingArmAt, authoredCommitAt: e.authoredCommitAt, authoredCommits: e.authoredCommits,
        stateAtBeatClock: e.stateAt?.beatClock ?? null, firedBeatClock: e.fired.beatClock, sfxPostedBeatClock: e.sfxPosted?.beatClock ?? null,
        sfxAudioTime: arm.sfxAudioTime, sfxPostedAudioTime: e.sfxPosted?.audioTime ?? null,
        firedAudioTime: e.fired.audioTime, firedPerf: e.fired.perfNow, armedPerf: e.perfNow };
      // Audible music onset on the perf clock: schedule.perfTime + device + music-path latency.
      a.audibleOnsetPerf = arm.schedule ? arm.schedule.perfTime + arm.latency.totalS * 1000 : e.perfNow;
      // Image-vs-onset on the AUDIO clock (both terms read from ctx.currentTime):
      // the tick that fired the image members versus the post-tail audible onset.
      a.imageVsOnsetMs = arm.schedule && a.firedAudioTime != null
        ? (a.firedAudioTime - (arm.schedule.audioTime + arm.latency.totalS)) * 1000
        : a.firedPerf - a.audibleOnsetPerf;
      a.imageVsOnsetFrames = a.imageVsOnsetMs / FRAME_MS;
      a.imageVsOnsetPerfMs = a.firedPerf - a.audibleOnsetPerf;
      a.fireLatenessBeatClockMs = (a.firedBeatClock - a.bundleAt) * 1000;
      a.stateNotLaterThanImage = a.stateAtBeatClock == null ? null : a.stateAtBeatClock <= a.firedBeatClock + 1e-9;
      a.sfxScheduledAhead = a.sfxAudioTime == null ? null : (a.sfxPostedAudioTime != null ? a.sfxAudioTime - a.sfxPostedAudioTime : null);
      a.onsetVsBundle = arm.schedule ? (arm.schedule.audioTime - arm.schedule.armedAt) - (e.bundleAt - e.armedBeatClock - arm.latency.totalS) : null;
      if (fr) {
        const anchorFrames = fr.anchors[e.seq]?.frames ?? [];
        const idx = anchorFrames.findIndex((f) => f >= a.firedPerf - 0.5);
        a.frameAtFire = idx;
        a.frameTimesAroundFire = idx >= 0 ? anchorFrames.slice(Math.max(0, idx - 3), idx + 4).map((f) => +(f - a.audibleOnsetPerf).toFixed(2)) : null;
        a.frameGapAtFireMs = idx > 0 ? +(anchorFrames[idx] - anchorFrames[idx - 1]).toFixed(2) : null;
        // Anchor window (contract cap-fps-trace): frame cadence ±2 s around the fire.
        const win = anchorFrames.filter((f) => f >= a.firedPerf - 2000 && f <= a.firedPerf + 2000);
        if (win.length > 2) {
          const gaps = win.slice(1).map((f, i) => f - win[i]);
          a.anchorWindow = { frames: win.length, meanGapMs: +(gaps.reduce((x, y) => x + y, 0) / gaps.length).toFixed(2), maxGapMs: +Math.max(...gaps).toFixed(2), fps: +(1000 * gaps.length / (win[win.length - 1] - win[0])).toFixed(1) };
        }
        const capturedShots = anchorShots.get(e.seq)?.shots ?? [];
        if (strips && capturedShots.length) {
          const fireEpochS = (fr.timeOrigin + a.firedPerf) / 1000;
          const ordered = capturedShots.map((s, i) => ({ ...s, i })).sort((x, y) => Math.abs(x.epochS - fireEpochS) - Math.abs(y.epochS - fireEpochS));
          const center = ordered[0]?.i ?? -1;
          if (center >= 0) {
            const dir = path.join(outDir, beat, e.anchorId.replace(/[^a-z0-9.-]/gi, '_'), `run${run}`);
            fs.mkdirSync(dir, { recursive: true });
            const strip = [];
            for (let k = -3; k <= 3; k++) {
              const s = capturedShots[center + k];
              if (!s) continue;
              const file = path.join(dir, `f${k >= 0 ? '+' : ''}${k}.jpg`);
              fs.writeFileSync(file, Buffer.from(s.data, 'base64'));
              strip.push({ k, file: path.relative(outDir, file), epochS: s.epochS, msFromFire: +((s.epochS - fireEpochS) * 1000).toFixed(1), msFromAudibleOnset: +((s.epochS * 1000 - fr.timeOrigin - a.audibleOnsetPerf)).toFixed(1) });
            }
            fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify({ anchor: a, strip, note: 'k=0 is the screencast frame nearest the presentation fire tick; msFromAudibleOnset is measured against schedule.perfTime + latencyComp (the post-tail audible music onset). The SFX member is scheduled to sfxAudioTime = audioTime + musicVsSfx, i.e. the same audible instant.' }, null, 2));
            const dense = [];
            let lastEpochS = -Infinity;
            for (const shot of capturedShots) {
              const relativeMs = (shot.epochS - fireEpochS) * 1000;
              if (relativeMs < -500 || relativeMs > 1000 || shot.epochS <= lastEpochS) continue;
              lastEpochS = shot.epochS;
              const file = `dense-${String(dense.length).padStart(4, '0')}.jpg`;
              fs.writeFileSync(path.join(dir, file), Buffer.from(shot.data, 'base64'));
              dense.push({ file, epochS: shot.epochS, msFromFire: relativeMs });
            }
            fs.writeFileSync(path.join(dir, 'dense.json'), JSON.stringify({ frames: dense, note: 'Actual distinct screencast timestamps only; no interpolation or duplicate frame synthesis. Review actual visible onset independently.' }, null, 2));
            a.strip = path.relative(outDir, dir);
            a.stripCoverage = { pre: strip.filter(frame => frame.msFromFire < 0).length, post: strip.filter(frame => frame.msFromFire >= 0).length, maxDistanceMs: Math.max(...strip.map(frame => Math.abs(frame.msFromFire))) };
            a.stripComplete = a.stripCoverage.pre >= 3 && a.stripCoverage.post >= 3 && a.stripCoverage.maxDistanceMs <= 350;
          }
        }
      }
      runRec.anchorsAnalysed = runRec.anchorsAnalysed ?? [];
      runRec.anchorsAnalysed.push(a);
    }
    runRec.verdicts = [
      { id: 'no-page-errors', met: pageErrors.length === 0 },
      { id: 'target-beat-completed', met: runRec.completed },
      { id: 'audio-tier', met: runRec.audioQuality === quality },
      { id: 'all-anchor-windows', met: runRec.expectedAnchorIds.length > 0 && runRec.expectedAnchorIds.every(id => runRec.anchorsAnalysed?.some(row => row.anchorId === id)) },
      ...(runRec.anchorsAnalysed ?? []).map(row => ({ id: row.anchorId,
        met: !row.fallback && Math.abs(row.slackMs) <= row.capMs + 0.01 && row.imageVsOnsetFrames >= 0 && row.imageVsOnsetFrames <= 2
          && row.frameGapAtFireMs != null && row.frameGapAtFireMs <= 40 && (!strips || row.stripComplete === true) }))
    ];
    runRec.pageErrors = pageErrors;
  } finally {
    if (strips) await cdp.send('Page.stopScreencast').catch(() => {});
    await page.close();
  }
  runRec.anchors = undefined;
  report.runs.push(runRec);
}
await browser.close();
if (viteProc && !viteProc.killed) viteProc.kill();
fs.writeFileSync(path.join(outDir, `${beat}.json`), JSON.stringify(report, null, 2));
const rows = report.runs.flatMap((r) => (r.anchorsAnalysed ?? []).map((a) => ({ run: r.run, ...a })));
for (const a of rows) {
  console.log(`RESULT run${a.run} ${a.anchorId.padEnd(28)} ${a.quantumLanded.padEnd(9)} slack=${a.slackMs?.toFixed(1) ?? '—'}ms cap=${a.capMs ?? '—'} image-vs-onset=${a.imageVsOnsetMs.toFixed(1)}ms (${a.imageVsOnsetFrames.toFixed(2)} fr) fireLate=${a.fireLatenessBeatClockMs.toFixed(1)}ms state<=image=${a.stateNotLaterThanImage} sfxAhead=${a.sfxScheduledAhead == null ? '—' : (a.sfxScheduledAhead * 1000).toFixed(1) + 'ms'} win=${a.anchorWindow ? a.anchorWindow.fps + 'fps/max' + a.anchorWindow.maxGapMs + 'ms' : '—'} key=${a.latency.sampleRateKey}`);
}
console.log(`wrote ${path.join(outDir, `${beat}.json`)} (${rows.length} anchor firings over ${runs} runs)`);
if (report.runs.some(run => run.verdicts?.some(verdict => !verdict.met) || !run.verdicts)) process.exitCode = 1;
