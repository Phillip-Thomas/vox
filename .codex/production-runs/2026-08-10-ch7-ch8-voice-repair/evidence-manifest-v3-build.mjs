// Extends evidence-registry.json and raw-audiovisual-evidence.json with the
// iteration-3 (draft-v3) verification evidence. Every hash and probe is
// computed from the bytes on disk; iteration-1 entries are carried through and
// re-hashed only where the file itself changed this iteration.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const RUN_DIR = path.dirname(new URL(import.meta.url).pathname);
const V3 = path.join(RUN_DIR, 'evidence', 'verification-v3');
const REL = (p) => path.relative(RUN_DIR, p);
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const CONTRACT_SHA = '1e36818230e7f48649c040b0e6574cad51c67dd5ba405fa00661307f0e0b4737';
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
  'evidence/verification-v3/ladder-analysis.json': 'Aggregated paced-ladder assertion sheet: formula conformance, C3 margin, drop behaviour, cross-run variance, pooled exit-window rows, variant-D ordering and variant parity across all 24 cold runs.',
  'evidence/verification-v3/routeA-space.json': 'Route A, paced scripted deep link driven exactly as the contract scripts it (hold [SPACE] at entry +6.0 s, no further pilot input); three cold runs with per-frame capture metadata.',
  'evidence/verification-v3/routeA-space-then-w.json': 'Route A variant that reaches deep_space (ignition then held climb thrust); three cold runs; carries the C3 margin measurement.',
  'evidence/verification-v3/routeA-space-late-ignite.json': 'Route A timer-branch control with ignition at entry +10.0 s; three cold runs proving L2 on the timer path and L3 on the phase edge.',
  'evidence/verification-v3/routeB-desktop.json': 'Route B, chained movie from ch7-board; three cold runs with the edge-caused L2 interruption pair, the L3 drop and the full frozen exit-window cadence.',
  'evidence/verification-v3/routeC-desktop.json': 'Route C, plain ch8-launch deep-link movie; three cold runs with deep_space -0.5/+0.0/+0.5 frames.',
  'evidence/verification-v3/routeC-potato.json': 'Route D POTATO tier: three cold runs asserting the L3 drop rather than the render.',
  'evidence/verification-v3/routeC-mobile-portrait.json': 'Route D parity at 390x844 mobile portrait; three cold runs.',
  'evidence/verification-v3/routeC-reduced-motion.json': 'Route D parity under prefers-reduced-motion reduce; three cold runs.',
  'evidence/verification-v3/seeded-entries.json': 'Two entries whose phase is already non-surface: a fresh non-surface load and a disclosed mid-flight beat re-entry; both seed the ladder consumed.',
  'evidence/verification-v3/seeded-entry-frames.json': 'Empty-caption-slot frames at entry +0.5 s, +1.5 s and +3.0 s on the non-surface entry, shuttered off the app beat mirror.',
  'evidence/verification-v3/frame-defect-scan.json': 'Blank-frame and luminance-pop scan over every iteration-3 capture directory.'
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

const upsert = (absPath, description) => {
  const rel = REL(absPath);
  byPath.set(rel, { ref: refFor(rel), path: rel, sha256: sha(absPath), kind: KIND(rel),
    description: description ?? DESCRIPTIONS[rel] ?? `Stage 6 mechanical-proof artifact: ${path.basename(rel)}.` });
};

for (const name of fs.readdirSync(V3)) {
  const full = path.join(V3, name);
  if (fs.statSync(full).isFile()) upsert(full);
}
// Frame directories are hashed as a sorted name:hash manifest, matching the
// iteration-1 convention.
for (const name of fs.readdirSync(V3)) {
  const full = path.join(V3, name);
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
// Run-level artifacts this iteration rewrote, plus the new probe scripts.
for (const name of ['verification-report.json', 'check-results.json', 'raw-audiovisual-evidence.json',
  'ladder-verify-probe.mjs', 'ladder-analysis.mjs', 'frame-defect-scan.mjs',
  'repair-verification-report-build.mjs', 'evidence-manifest-v3-build.mjs']) {
  const full = path.join(RUN_DIR, name);
  if (!fs.existsSync(full)) continue;
  const rel = REL(full);
  const existing = byPath.get(rel);
  byPath.set(rel, {
    ref: existing?.ref ?? refFor(rel),
    path: rel,
    sha256: sha(full),
    kind: existing?.kind ?? 'trace',
    description: existing?.description ?? `Stage 6 mechanical-proof artifact: ${name}.`
  });
}

registry.contractVersion = 'draft-v3';
registry.contractSha256 = CONTRACT_SHA;
registry.compiledAt = COMPILED_AT;
registry.entries = [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path));
fs.writeFileSync(path.join(RUN_DIR, 'evidence-registry.json'), `${JSON.stringify(registry, null, 2)}\n`);

// --- raw audiovisual evidence -------------------------------------------------
const raw = JSON.parse(fs.readFileSync(path.join(RUN_DIR, 'raw-audiovisual-evidence.json'), 'utf8'));
const pngsIn = (dir) => fs.readdirSync(dir).filter(n => n.endsWith('.png')).sort();
const strip = (dir, label) => ({
  path: REL(dir),
  sha256: crypto.createHash('sha256').update(pngsIn(dir).map(n => `${n}:${sha(path.join(dir, n))}`).join('\n')).digest('hex'),
  frameCount: pngsIn(dir).length,
  label,
  probe: probe(path.join(dir, pngsIn(dir)[0]))
});

const LABELS = {
  'routeA-space-run': 'ch8-launch, deep link, scripted ignition at entry +6.0 s with no further pilot input, 1280x720 LOW, beat entry through L3 reveal complete',
  'routeA-space-then-w-run': 'ch8-launch, deep link, scripted ignition at entry +6.0 s then held climb thrust, 1280x720 LOW, beat entry through 2.5 s past the atmosphere exit',
  'routeA-space-late-ignite-run': 'ch8-launch, deep link, scripted ignition at entry +10.0 s with no further pilot input, 1280x720 LOW',
  'routeB-desktop-run': 'ch8-launch entered from the ch7-board movie chain, 1280x720 LOW, beat entry through the exit window',
  'routeC-desktop-run': 'ch8-launch deep-link movie, 1280x720 LOW, beat entry through the exit window',
  'routeC-potato-run': 'ch8-launch deep-link movie, 1280x720 POTATO',
  'routeC-mobile-portrait-run': 'ch8-launch deep-link movie, 390x844 LOW',
  'routeC-reduced-motion-run': 'ch8-launch deep-link movie, 1280x720 LOW, prefers-reduced-motion reduce',
  'seeded-fly-entry': 'ch8-launch entered with the flight phase already non-surface; frames at entry +0.5, +1.5, +2.1 and +3.0 s',
  'seeded-midflight-reentry': 'ch8-launch beat re-entered mid-climb; one frame at re-entry +0.5 s'
};
const labelFor = (name) => {
  for (const [prefix, label] of Object.entries(LABELS)) {
    if (name.startsWith(prefix)) return `${label} (${name})`;
  }
  return name;
};

const newStrips = fs.readdirSync(V3)
  .filter(n => fs.statSync(path.join(V3, n)).isDirectory() && pngsIn(path.join(V3, n)).length > 0)
  .sort()
  .map(n => strip(path.join(V3, n), labelFor(n)));

const existingStripPaths = new Set(raw.frameStrips.map(s => s.path));
raw.frameStrips.push(...newStrips.filter(s => !existingStripPaths.has(s.path)));
raw.contractVersion = 'draft-v3';
raw.contractSha256 = CONTRACT_SHA;
raw.capturedAt = COMPILED_AT;
raw.playbackMetadata.instructions = `${raw.playbackMetadata.instructions} Iteration-3 strips are 1280x720 PNG unless the label says 390x844; frame file names carry the label, the story-clock offset from beat entry, the live beat and the live flight phase.`;
raw.unavailable = [...new Set([...raw.unavailable,
  'No iteration-3 capture carries an audio track or a continuous video: the paced-ladder proof is frame strips plus state traces, and headless Chromium cannot mux the WebAudio bus. The iteration-1 offline combined-music-bus renders listed above remain the audio record; no score or SFX event was added by this patch.'])];
fs.writeFileSync(path.join(RUN_DIR, 'raw-audiovisual-evidence.json'), `${JSON.stringify(raw, null, 2)}\n`);

// The registry must hash the raw-evidence file it just rewrote.
const rawRel = 'raw-audiovisual-evidence.json';
const rawEntry = registry.entries.find(e => e.path === rawRel);
if (rawEntry) rawEntry.sha256 = sha(path.join(RUN_DIR, rawRel));
fs.writeFileSync(path.join(RUN_DIR, 'evidence-registry.json'), `${JSON.stringify(registry, null, 2)}\n`);

console.log('registry entries:', registry.entries.length, '| raw frame strips:', raw.frameStrips.length);
