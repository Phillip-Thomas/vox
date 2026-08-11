// Extends evidence-registry.json and raw-audiovisual-evidence.json with the
// iteration-4 (draft-v4) CC1 discharge evidence. Same conventions as
// evidence-manifest-v3-build.mjs: every hash and probe is computed from the
// bytes on disk, frame directories are hashed as a sorted name:hash manifest,
// and earlier entries are carried through, re-hashed only where the file
// itself changed this iteration. Must run AFTER discharge-evidence-build.mjs.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const RUN_DIR = path.dirname(new URL(import.meta.url).pathname);
const ORDERED = path.join(RUN_DIR, 'evidence', 'verification-v3', 'routeA-ordered');
const REL = (p) => path.relative(RUN_DIR, p);
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const CONTRACT_SHA = sha(path.join(RUN_DIR, 'scene-contract.json'));
const CONTRACT_VERSION = 'draft-v4';
const COMPILED_AT = new Date().toISOString();

function probe(p) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries',
    'format=format_name,duration:stream=codec_type,codec_name,width,height,sample_rate,channels',
    '-of', 'json', p], { encoding: 'utf8' });
  if (r.status !== 0) return null;
  const parsed = JSON.parse(r.stdout);
  const video = (parsed.streams || []).find(s => s.codec_type === 'video');
  const audio = (parsed.streams || []).find(s => s.codec_type === 'audio');
  const duration = Number(parsed.format?.duration);
  return {
    formatName: parsed.format?.format_name || 'unknown',
    durationSeconds: Number.isFinite(duration) ? Number(duration.toFixed(3)) : 0,
    video: video ? { codec: video.codec_name, width: video.width, height: video.height } : null,
    audio: audio ? { codec: audio.codec_name, sampleRate: Number(audio.sample_rate), channels: audio.channels } : null
  };
}

const DESCRIPTIONS = {
  'evidence/verification-v3/routeA-ordered/routeA-ordered.json': "Canonical ordered-ignition route (condition CC1): one script, three cold runs on a pristine ch8-launch deep link at LOW with no input until after the L2 timer fires, then [SPACE] ignition and a sustained [W] climb to deep_space and through the frozen exit window. Carries the per-run l2Cause, the L2/L3 formula deltas, the measured discharge margin and every frame's capture metadata.",
  'evidence/verification-v3/routeA-ordered/routeA-ordered-captures.json': 'Gate capture manifest for the twelve Route A anchor offsets across three cold runs: per-frame hash, bound scene-contract anchor, binding basis with the measured deviation, ffprobe block, live beat, flight phase, caption reveal state and standing objective.',
  'discharge-measure-probe.mjs': 'Stage 6 probe that drives and measures the canonical ordered-ignition route in one script (acceptance criteria [21] and [26]).',
  'discharge-evidence-build.mjs': 'Compiles the CC1 discharge measurement into the gate capture manifest, verification-report.json dischargeMeasurement, check-results.json and the iteration ledger.',
  'evidence-manifest-v4-build.mjs': 'Extends the evidence registry and raw audiovisual evidence with the iteration-4 discharge artifacts.'
};

const KIND = (p) => p.endsWith('.wav') ? 'audio'
  : p.endsWith('.webm') ? 'video'
    : p.endsWith('.png') ? 'frame'
      : p.endsWith('.log') ? 'log'
        : p.includes('fps-') ? 'perf' : 'trace';
const refFor = (rel) => `${KIND(rel)}:${rel.replace(/^evidence\//, '').replace(/[\/.]/g, '-')}`;

// --- registry ----------------------------------------------------------------
const registry = JSON.parse(fs.readFileSync(path.join(RUN_DIR, 'evidence-registry.json'), 'utf8'));
const byPath = new Map(registry.entries.map(e => [e.path, e]));

const upsert = (absPath) => {
  const rel = REL(absPath);
  const existing = byPath.get(rel);
  byPath.set(rel, {
    ref: existing?.ref ?? refFor(rel),
    path: rel,
    sha256: sha(absPath),
    kind: existing?.kind ?? KIND(rel),
    description: DESCRIPTIONS[rel] ?? existing?.description ?? `Stage 6 mechanical-proof artifact: ${path.basename(rel)}.`
  });
};

for (const name of fs.readdirSync(ORDERED)) {
  const full = path.join(ORDERED, name);
  if (fs.statSync(full).isFile()) upsert(full);
}
for (const name of fs.readdirSync(ORDERED)) {
  const full = path.join(ORDERED, name);
  if (!fs.statSync(full).isDirectory()) continue;
  const pngs = fs.readdirSync(full).filter(n => n.endsWith('.png')).sort();
  if (!pngs.length) continue;
  const rel = REL(full);
  byPath.set(rel, {
    ref: `frame:${rel.replace(/^evidence\//, '').replace(/[\/.]/g, '-')}`,
    path: rel,
    sha256: crypto.createHash('sha256').update(pngs.map(n => `${n}:${sha(path.join(full, n))}`).join('\n')).digest('hex'),
    kind: 'frame-set',
    description: `Frame strip directory with ${pngs.length} PNG frames; the sha256 is over the sorted per-file name:hash manifest of the directory.`
  });
}
for (const name of ['verification-report.json', 'check-results.json', 'iteration-ledger.jsonl',
  'discharge-measure-probe.mjs', 'discharge-evidence-build.mjs', 'evidence-manifest-v4-build.mjs']) {
  const full = path.join(RUN_DIR, name);
  if (fs.existsSync(full)) upsert(full);
}

registry.contractVersion = CONTRACT_VERSION;
registry.contractSha256 = CONTRACT_SHA;
registry.compiledAt = COMPILED_AT;
registry.entries = [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path));
fs.writeFileSync(path.join(RUN_DIR, 'evidence-registry.json'), `${JSON.stringify(registry, null, 2)}\n`);

// --- raw audiovisual evidence -------------------------------------------------
const raw = JSON.parse(fs.readFileSync(path.join(RUN_DIR, 'raw-audiovisual-evidence.json'), 'utf8'));
const pngsIn = (dir) => fs.readdirSync(dir).filter(n => n.endsWith('.png')).sort();
const LABEL = 'ch8-launch, pristine deep link at 1280x720 LOW with no movie flag; seated, no input until after the L2 caption timer-fires, [SPACE] committed at entry +10 s and [W] held through the atmosphere boundary; beat entry through 1.5 s past the first deep_space observation';
const newStrips = fs.readdirSync(ORDERED)
  .filter(n => fs.statSync(path.join(ORDERED, n)).isDirectory() && pngsIn(path.join(ORDERED, n)).length > 0)
  .sort()
  .map(n => {
    const dir = path.join(ORDERED, n);
    const pngs = pngsIn(dir);
    return {
      path: REL(dir),
      sha256: crypto.createHash('sha256').update(pngs.map(f => `${f}:${sha(path.join(dir, f))}`).join('\n')).digest('hex'),
      frameCount: pngs.length,
      label: `${LABEL} (routeA-ordered-${n})`,
      probe: probe(path.join(dir, pngs[0]))
    };
  });

const existingStripPaths = new Set(raw.frameStrips.map(s => s.path));
raw.frameStrips.push(...newStrips.filter(s => !existingStripPaths.has(s.path)));
raw.contractVersion = CONTRACT_VERSION;
raw.contractSha256 = CONTRACT_SHA;
raw.capturedAt = COMPILED_AT;
const ITERATION4_INSTRUCTIONS = 'Iteration-4 strips (routeA-ordered) are 1280x720 PNG; the ignition-to-exit window is shot at roughly one frame per 100 ms and file names carry the label, the story-clock offset from beat entry, the live beat and the live flight phase.';
if (!raw.playbackMetadata.instructions.includes(ITERATION4_INSTRUCTIONS)) {
  raw.playbackMetadata.instructions = `${raw.playbackMetadata.instructions} ${ITERATION4_INSTRUCTIONS}`;
}
raw.unavailable = [...new Set([...raw.unavailable,
  'Iteration-4 captured frame strips and state traces only: no audio track and no continuous video, for the same headless reason recorded above. The first two frames of each iteration-4 run render the world black with the guidance HUD drawn; the world appears by beat entry +2.9 s, before any measured anchor.'])];
fs.writeFileSync(path.join(RUN_DIR, 'raw-audiovisual-evidence.json'), `${JSON.stringify(raw, null, 2)}\n`);

const rawRel = 'raw-audiovisual-evidence.json';
const rawEntry = registry.entries.find(e => e.path === rawRel);
if (rawEntry) rawEntry.sha256 = sha(path.join(RUN_DIR, rawRel));
fs.writeFileSync(path.join(RUN_DIR, 'evidence-registry.json'), `${JSON.stringify(registry, null, 2)}\n`);
// The registry file itself changed after its own entry was written; the entry
// for evidence-registry.json (if any) is intentionally not self-referential.
console.log('registry entries:', registry.entries.length, '| raw frame strips:', raw.frameStrips.length);
