#!/usr/bin/env node
// --- Chapter evidence ------------------------------------------------------------------
//
// The deterministic adapter for the acceptance workflow's
// `capture-chapter-boundary-and-av` step, and the tool that makes the final
// gate reachable by an unattended run: it produces the headed real-GPU
// evidence the gate demands (continuous video, HUD-suppressed frames, a
// contact sheet, flicker scalars, a text digest) as a percept
// `capture-bundle-v1` under <run>/evidence/bundle/, and lists it for the
// reviewers twin-first.
//
//   node tools/chapter-evidence.mjs --chapter ch10 --run <runDir> [--lane movie|manual]
//        [--beats ch10-cold,ch10-ask] [--video] [--cap-s 150] [--strip-s 4]
//        [--settle-s 8] [--profile HIGH] [--agent] [--no-build] [--audio a.wav,b.wav]
//
// Per beat it opens `?story=<beat>&movie=1&journeyprobe=1`, settles, shoots the
// opening still at +2 s, then runs one capture session: a coverage strip every
// --strip-s, a trigger frame the first time each registry checkpoint milestone
// latches and each required signed-AV anchor activates (the salience signal
// this game actually has), an adjacent-frame burst on entry and one on the
// beat's first anchor activation, and stops three seconds after the beat's
// checkpoint milestone or at --cap-s.
//
// Exit 1 on a software renderer, any blank still, or any burst that reads as
// flicker (flickerRatio > 2.5 AND signFlips > 0.40). The bundle is still
// written so the defect can be looked at.

import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync, spawnSync } from 'node:child_process';
import process from 'node:process';
import { startParavoxiaPreview } from './lib/previewServer.mjs';
import {
  openParavoxia, waitReady, readState, captureSession, composeSheet, writeDigest, writeBundle,
  CAPTURE_TIER, sha256, probeMedia,
} from './lib/evidence.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const MAIN = resolve(HERE, '..');
const ROOT = resolve(MAIN, '..');
const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : fallback;
};
const has = (name) => process.argv.includes(`--${name}`);
const tag = (m) => console.log(`[chapter-evidence] ${m}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chapterId = arg('chapter');
const runDir = arg('run');
if (!chapterId || !runDir) {
  console.error('usage: node tools/chapter-evidence.mjs --chapter <id> --run <runDir> [--lane movie|manual] [--beats a,b] [--video]');
  process.exit(2);
}
const lane = arg('lane', 'movie');
const capS = Number(arg('cap-s', '150'));
const stripS = Number(arg('strip-s', '4'));
const settleS = Number(arg('settle-s', '8'));
const profile = arg('profile', 'HIGH');
const wantVideo = has('video');
const useAgent = has('agent');
const audioFiles = (arg('audio') ? arg('audio').split(',') : []).map((f) => resolve(runDir, f)).filter((f) => existsSync(f));
// the run's own identity, when this is a governed run dir (the gate binds every artifact to these)
const readJsonIf = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null);
const contract = readJsonIf(join(runDir, 'scene-contract.json'));
const lock = readJsonIf(join(runDir, 'production-lock.json'));
const contractSha256 = existsSync(join(runDir, 'scene-contract.json')) ? sha256(readFileSync(join(runDir, 'scene-contract.json'))) : null;

// ------------------------------------------------------------- the chapter ---
const registry = JSON.parse(readFileSync(join(MAIN, 'chapter-registry.json'), 'utf8'));
const chapters = registry.chapters ?? registry;
const chapter = (Array.isArray(chapters) ? chapters : Object.values(chapters)).find((c) => c.id === chapterId);
if (!chapter) { console.error(`chapter ${chapterId} not in chapter-registry.json`); process.exit(2); }
const journey = JSON.parse(readFileSync(join(MAIN, 'chapter-journey-contract.json'), 'utf8'));
const jChapters = journey.chapters ?? {};
const jChapter = Array.isArray(jChapters) ? jChapters.find((c) => c.id === chapterId) : jChapters[chapterId];
const anchorIds = jChapter?.registryProjection?.requiredSignedAnchorIds ?? [];
const beats = (arg('beats') ? arg('beats').split(',') : chapter.beats).filter(Boolean);
const checkpointFor = (beat) => (chapter.checkpoints ?? []).find((c) => c.beat === beat) ?? null;
const milestoneRefs = (beat) => {
  const cp = checkpointFor(beat);
  const refs = [...(cp?.evidenceRefs ?? []), ...(cp?.milestone ? [`milestone:${cp.milestone}`] : [])];
  return refs.filter((r) => r.startsWith('milestone:')).map((r) => r.slice('milestone:'.length));
};
const buildSha = (() => { try { return execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { return null; } })();

const bundleDir = resolve(runDir, 'evidence', 'bundle');
mkdirSync(bundleDir, { recursive: true });
const videoDir = join(bundleDir, 'video');
if (wantVideo) mkdirSync(videoDir, { recursive: true });

// ------------------------------------------------------------------ capture ---
const preview = await startParavoxiaPreview({ build: !has('no-build') && !process.env.PARAVOXIA_URL, log: tag });
const allFrames = [];
const allBursts = [];
const sessions = [];
const videos = [];
let nextIndex = 0;
let clockOffset = 0;
let renderer = null;
let lastSheetPage = null;
let exitCode = 0;
let sheet = null;

try {
  for (const beat of beats) {
    const q = new URLSearchParams({ story: beat, journeyprobe: '1', profile });
    if (lane === 'movie') q.set('movie', '1');
    if (useAgent) q.set('agent', '1');
    const url = `/?${q.toString()}`;
    tag(`beat ${beat}: ${url}`);
    const opened = await openParavoxia({
      url, preview, log: tag,
      recordVideo: wantVideo ? { dir: videoDir } : null,
    });
    renderer = opened.renderer;
    const { page } = opened;
    try {
      await waitReady(page, { settleMs: settleS * 1000 });
      const entryState = await readState(page);
      const milestones = milestoneRefs(beat);
      const exitMilestone = checkpointFor(beat)?.milestone ?? null;
      const seenMilestones = new Set(entryState.milestones ?? []);
      const seenAnchors = new Set(entryState.av?.activationHistoryAnchorIds ?? []);
      let exitAt = null;
      let climaxBurstAdded = false;

      const session = await captureSession(page, bundleDir, {
        startIndex: nextIndex, clockOffset, capMs: capS * 1000, stripIntervalS: stripS, log: tag,
        stills: [{ id: 'opening-2.0s', role: 'still', settleMs: 2000 }],
        bursts: [{ id: 'entry', from: 3, to: 5.5, perBeat: true }],
        events: [
          ...milestones.map((m) => ({ key: `milestone:${m}`, pred: (s) => !seenMilestones.has(m) && (s.milestones ?? []).includes(m) })),
          ...anchorIds.map((a) => ({ key: `anchor:${a}`, pred: (s) => !seenAnchors.has(a) && (s.av?.activationHistoryAnchorIds ?? []).includes(a) })),
          { key: 'caption-first', pred: (s) => !!s.caption && s.caption !== entryState.caption },
          { key: 'objective-change', pred: (s) => s.objectiveId !== entryState.objectiveId },
        ],
        onState: (s, clock, addBurst) => {
          const hist = s.av?.activationHistoryAnchorIds ?? [];
          if (!climaxBurstAdded && hist.some((a) => anchorIds.includes(a) && !seenAnchors.has(a))) {
            climaxBurstAdded = true;
            addBurst(clock, clock + 2.5, `${beat}-climax`);
          }
          if (exitMilestone && exitAt == null && (s.milestones ?? []).includes(exitMilestone) && !seenMilestones.has(exitMilestone)) exitAt = clock;
          if (exitAt != null && clock - exitAt > 3) return 'stop';
          return null;
        },
      });
      nextIndex = session.nextIndex;
      clockOffset = session.clockOffset;
      allFrames.push(...session.frames);
      allBursts.push(...session.bursts);
      sessions.push({ id: beat, url, frames: session.frames.length, bursts: session.bursts.length,
        pageErrors: opened.pageErrors, reachedExit: exitAt != null, completedEvents: session.frames.filter((f) => f.role === 'trigger').map((f) => f.label),
        note: `${session.frames.length} frames, ${session.bursts.length} bursts, exit milestone ${exitMilestone ?? 'n/a'} ${exitAt != null ? `reached at t=${exitAt.toFixed(1)}s` : 'NOT reached'}; page errors: ${opened.pageErrors.length}` });
      // the sheet is composed in-page; keep the last live page for it
      lastSheetPage = page;
      sheet = await composeSheet(page, bundleDir, allFrames, { title: `${chapterId} ${lane} ${CAPTURE_TIER}` });
    } finally {
      const video = wantVideo ? page.video() : null;
      await opened.context.close().catch(() => {});
      if (video) {
        const p = await video.path().catch(() => null);
        if (p && existsSync(p)) videos.push({ beat, file: relative(bundleDir, p), bytes: statSync(p).size, sha256: sha256(readFileSync(p)) });
      }
      await opened.browser.close().catch(() => {});
    }
  }
} finally {
  preview.stop();
}

// ------------------------------------------------------------------ outputs ---
const capture = {
  tier: CAPTURE_TIER, adapter: renderer, headed: CAPTURE_TIER === 'hardware-high',
  resolution: { w: 1280, h: 720 }, seed: `${lane}:${profile}`, clock: allFrames[0]?.clock ?? 'wall-since-settle',
  buildSha, viewport: '1280x720',
};
const digest = writeDigest(bundleDir, { subject: { id: `${chapterId}@${lane}` }, capture, frames: allFrames, bursts: allBursts, sessions });
const manifest = await writeBundle(bundleDir, {
  subject: { id: `${chapterId}@${lane}`, kind: 'paravoxia-chapter' },
  capture, frames: allFrames, bursts: allBursts, sheet, digest,
  provenance: { chapter: chapterId, lane, beats, videos, sessions: sessions.map(({ note, ...s }) => s) },
});

// reviewer-facing rows: twin first, HUD composite marked audit-only
const rows = [];
const mediaRow = (rel, extra) => {
  const abs = join(bundleDir, rel);
  return { path: `evidence/bundle/${rel}`, bytes: statSync(abs).size, sha256: sha256(readFileSync(abs)), probe: probeMedia(abs), ...extra };
};
for (const f of manifest.frames) {
  rows.push(mediaRow(f.file, { label: f.label ?? f.role, beat: f.beat, role: f.role, frameIndex: f.frame, storyClockS: f.simTime,
    capture: 'hud-suppressed frame of record' }));
}
for (const f of manifest.frames) {
  rows.push(mediaRow(f.hudFile, { label: `${f.label ?? f.role}-hud`, beat: f.beat, frameIndex: f.frame,
    capture: 'hud composite (audit only — not reviewer evidence)' }));
}
// The gate's continuous video must carry an audio stream; Playwright records
// picture only, so the first score render given with --audio is muxed under the
// first beat's video (picture copied, audio to opus, cut to the shorter track).
if (videos.length && audioFiles.length) {
  const v = videos[0];
  const muxed = v.file.replace(/\.webm$/, '-av.webm');
  const mux = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', join(bundleDir, v.file), '-i', audioFiles[0],
    '-c:v', 'copy', '-c:a', 'libopus', '-shortest', join(bundleDir, muxed)], { encoding: 'utf8' });
  if (mux.status === 0 && existsSync(join(bundleDir, muxed))) {
    videos[0] = { ...v, file: muxed, bytes: statSync(join(bundleDir, muxed)).size, sha256: sha256(readFileSync(join(bundleDir, muxed))), audioFrom: relative(runDir, audioFiles[0]) };
    tag(`continuous video muxed with ${relative(runDir, audioFiles[0])} → ${muxed}`);
  } else tag(`WARNING: could not mux audio into the continuous video (${mux.stderr?.trim() || 'ffmpeg failed'}); the gate's raw-evidence.video audio requirement will not be met`);
} else if (videos.length) tag('NOTE: continuous video has no audio track (pass --audio <score.wav> to mux the score render in); the gate requires one');
const videoRows = videos.map((v) => mediaRow(v.file, { beat: v.beat, container: 'webm', ...(v.audioFrom ? { audioFrom: v.audioFrom } : {}) }));
const audioRows = audioFiles.map((abs) => ({ path: relative(runDir, abs), bytes: statSync(abs).size, sha256: sha256(readFileSync(abs)), probe: probeMedia(abs), kind: 'score-render' }));
const raw = {
  schema: 'paravoxia.rawAudiovisualEvidence.v1',
  runId: lock?.runId ?? relative(ROOT, resolve(runDir)),
  contractVersion: contract?.contractVersion ?? null, contractSha256,
  sourceRevision: lock?.sourceRevision ?? buildSha, workingTree: buildSha,
  chapter: chapterId, lane, compiledAt: new Date().toISOString(),
  containsCreativeIntent: false,
  intentFreeInstructions: 'Open only the files listed here, in this order, and read nothing else first. Rows marked "hud-suppressed frame of record" are the frames to judge; rows marked "audit only" are the same instants with the HUD layer shown and exist for auditors, not reviewers. sheet.png is the chronological contact sheet and its red numbers are the frameIndex values in this list. digest.md answers every timing, order and causality question; frames are for shape, colour, composition and light.',
  playbackMetadata: {
    frameSize: '1280x720', frameFormat: 'png', audioFormat: audioRows.length ? 'wav' : null, colourManagement: 'none',
    renderer, tier: CAPTURE_TIER, headed: capture.headed, clock: capture.clock,
    instructions: 'View frames at 1280x720, one at a time, in list order; view the contact sheet whole; play the continuous video once before examining frames.',
  },
  continuousVideo: videoRows[0] ?? null,
  additionalVideo: videoRows.slice(1),
  contactSheet: sheet ? mediaRow('sheet.png', { kind: 'contact-sheet' }) : null,
  digest: { path: 'evidence/bundle/digest.md', sha256: digest.sha256 },
  frameStrips: rows,
  audio: audioRows,
  bursts: allBursts,
};
const rawPath = join(runDir, 'raw-audiovisual-evidence.json');
const rawTarget = existsSync(rawPath) ? join(runDir, 'raw-audiovisual-evidence.bundle.json') : rawPath;
writeFileSync(rawTarget, `${JSON.stringify(raw, null, 2)}\n`);
// registry rows in the gate's entry shape (ref/path/sha256/kind/description/bytes), ready to merge
// into the run's evidence-registry.json; percept:* refs are what a scorecard cites
const slug = (p) => p.replace(/^evidence\/bundle\//, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
const registryRows = [
  { ref: 'percept:bundle', path: 'evidence/bundle/bundle.json', sha256: sha256(readFileSync(join(bundleDir, 'bundle.json'))), kind: 'artifact', description: 'percept capture-bundle-v1 manifest (hash-bound frames, bursts, sheet, digest)', bytes: statSync(join(bundleDir, 'bundle.json')).size },
  ...(sheet ? [{ ref: 'capture:contact-sheet', path: 'evidence/bundle/sheet.png', sha256: sheet.sha256, kind: 'frame', description: 'chronological contact sheet; red numbers are frame indices', bytes: statSync(join(bundleDir, 'sheet.png')).size }] : []),
  { ref: 'percept:digest', path: 'evidence/bundle/digest.md', sha256: digest.sha256, kind: 'document', description: 'temporal digest: beat/objective/caption/anchor timeline and burst scalars', bytes: statSync(join(bundleDir, 'digest.md')).size },
  ...rows.map((r) => ({ ref: `capture:${slug(r.path)}`, path: r.path, sha256: r.sha256, kind: 'frame', description: r.capture.startsWith('hud composite') ? `HUD composite (audit only) frame ${r.frameIndex}` : `HUD-suppressed frame of record ${r.frameIndex} (${r.label}, ${r.beat})`, bytes: r.bytes })),
  ...videoRows.map((v) => ({ ref: `capture:${slug(v.path)}`, path: v.path, sha256: v.sha256, kind: 'trace', description: `continuous movie-lane video, beat ${v.beat}`, bytes: v.bytes })),
];
writeFileSync(join(bundleDir, 'evidence-registry.bundle.json'), `${JSON.stringify({ schema: 'paravoxia.evidenceRegistry.bundle.v1', generatedAt: new Date().toISOString(), entries: registryRows }, null, 2)}\n`);

// ------------------------------------------------------------------ verdict ---
const blankStills = manifest.frames.filter((f) => (f.role === 'still' || f.role === 'trigger') && f.stats?.blank);
const flicker = allBursts.filter((b) => b.flickerRatio > 2.5 && (b.signFlipRatio ?? 0) > 0.4);
if (CAPTURE_TIER !== 'hardware-high') { tag(`software renderer (${renderer}) — evidence is ${CAPTURE_TIER}, not the delivered look`); exitCode = 1; }
if (blankStills.length) { tag(`BLANK stills: ${blankStills.map((f) => f.file).join(', ')}`); exitCode = 1; }
if (flicker.length) { tag(`FLICKER: ${flicker.map((b) => `t=${b.t0}s ratio=${b.flickerRatio} flips=${b.signFlipRatio}`).join('; ')}`); exitCode = 1; }
tag(`bundle ${bundleDir}: ${manifest.frames.length} frames (${manifest.frames.filter((f) => f.role === 'burst').length} burst), ${allBursts.length} bursts, sheet=${sheet ? sheet.tiles + ' tiles' : 'none'}, videos=${videos.length}, tier=${CAPTURE_TIER}, renderer=${renderer}`);
tag(`reviewer rows → ${relative(ROOT, rawTarget)}${rawTarget !== rawPath ? ' (existing raw-audiovisual-evidence.json left untouched)' : ''}`);
for (const s of sessions) tag(`  ${s.id}: ${s.note}`);
process.exit(exitCode);
