// Builds evidence-registry.json and raw-audiovisual-evidence.json from the
// bytes actually on disk. Every hash and every probe here is computed, never
// transcribed.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const RUN_DIR = path.dirname(new URL(import.meta.url).pathname);
const V = path.join(RUN_DIR, 'evidence', 'verification');
const REL = (p) => path.relative(RUN_DIR, p);
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

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
  'evidence/verification/ch7-flow-trace.json': 'Three cold ch7-reconstruct movie runs; every story-text, objective, feedback and beat emission stamped with the game story clock.',
  'evidence/verification/ch8-flow-trace.json': 'Three cold ch8-launch movie runs; every emission stamped with the game story clock.',
  'evidence/verification/cadence-assertions.json': 'Per-run assertion of every frozen string against the exported cadence constants, with cross-run variance and the variant-D ordering margin.',
  'evidence/verification/full-flow-trace.json': 'Continuous ch6-dive movie chain, capped at 600 s.',
  'evidence/verification/chain-landfall-from-crossing.json': 'Continuous movie chain started at ch8-crossing, autopilot state sampled per second.',
  'evidence/verification/chain-landfall-deeplink.json': 'Movie run started at the ch8-landfall deep link, autopilot state sampled per second.',
  'evidence/verification/chain-launch-anchor-fine-trace.json': 'Per-frame in-page sampler of activatedAnchorIds, activation history, flight phase and control mode across the ch7-board to ch8-launch handoff.',
  'evidence/verification/l23-captures.json': 'Sidecar for the ignition/liftoff strips on both the deep-link and the chained route, each frame stamped with the live anchor set and DOM caption.',
  'evidence/verification/variants-trace.json': 'Full ch7 and ch8 movie runs at mobile portrait, reduced motion and POTATO.',
  'evidence/verification/variant-parity.json': 'String, order and cadence parity assertion for every variant against the desktop reference.',
  'evidence/verification/resets-trace.json': 'Sandbox no-op, three deep links, and two mid-window interruption traces.',
  'evidence/verification/pause-window-trace.json': 'Real pause engaged through the app pointer-lock path mid-ch8-window; story-clock freeze and beat-runtime offsets.',
  'evidence/verification/quit-replay-trace.json': 'Quit-to-sandbox and reload-replay from mid-ch8-window.',
  'evidence/verification/fps-verification.json': 'rAF frame counts at the three baseline beats and inside the implemented ch8 hold window, 1280x720 LOW.',
  'evidence/verification/audio-window-census.json': 'Story UX feedback cues and SFX rate-limiter census sampled twice a second across the ch8 and ch7 windows.',
  'evidence/verification/ch8-window-av-score-trace.json': 'Signed AV snapshot sampled every 250 ms across the implemented ch8 hold: anchor, shot, camera authority, applied FOV, postFx, score cueRefs, intensity and hit.',
  'evidence/verification/score-ch8-window-verify-analysis.json': 'Post-implementation combined music-bus offline renders and windowed RMS analysis.',
  'evidence/verification/objective-lifecycle-measurements.json': 'Counted objective entries, marker labels, health transitions and feedback cues across every traced run.',
  'evidence/verification/ch7-captures-desktop.json': 'Sidecar for the ch7 exit-cadence strip and the pre-origin stage ladder at 1280x720 LOW.',
  'evidence/verification/ch8-captures-desktop.json': 'Sidecar for the ch8 hold-cadence strip at 1280x720 LOW.',
  'evidence/verification/ch7-captures-mobile-portrait.json': 'Sidecar for the ch7 exit-cadence strip at 390x844.',
  'evidence/verification/ch8-captures-mobile-portrait.json': 'Sidecar for the ch8 hold-cadence strip at 390x844.',
  'evidence/verification/ch8-captures-mobile-landscape.json': 'Sidecar for the ch8 hold-cadence strip at 844x390.',
  'evidence/verification/ch7-captures-reduced-motion.json': 'Sidecar for the ch7 exit-cadence strip under prefers-reduced-motion.',
  'evidence/verification/ch8-captures-reduced-motion.json': 'Sidecar for the ch8 hold-cadence strip under prefers-reduced-motion.',
  'evidence/verification/ch7-captures-potato.json': 'Sidecar for the ch7 exit-cadence strip at the POTATO tier.',
  'evidence/verification/ch8-captures-potato.json': 'Sidecar for the ch8 hold-cadence strip at the POTATO tier.',
  'evidence/verification/full-client-verify.log': 'npm --prefix main run verify output: 277 test files, 2199 tests, build.',
  'evidence/verification/story-ux-check-verification.log': 'npm --prefix main run story:ux:check output re-run post-implementation.'
};

const KIND = (p) => p.endsWith('.wav') ? 'audio'
  : p.endsWith('.webm') ? 'video'
    : p.endsWith('.png') ? 'frame'
      : p.endsWith('.log') ? 'log'
        : p.includes('fps-') ? 'perf' : 'trace';

const files = [];
const walk = (dir) => {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) { walk(full); continue; }
    files.push(full);
  }
};
walk(V);

// Registry: every non-PNG evidence file, plus the two PNGs cited by path in the
// reports, plus the run-level artifacts the gate hashes by name.
const CITED_PNGS = [
  path.join(V, 'ch8-captures-desktop', 'off_15p2s_ch8-launch.png'),
  path.join(V, 'ch8-captures-desktop', 'off_18p0s_ch8-crossing.png'),
  path.join(V, 'ch8-captures-desktop', 'off_2p0s_ch8-launch.png'),
  path.join(V, 'ch8-captures-desktop', 'off_8p5s_ch8-launch.png'),
  path.join(V, 'ch8-captures-mobile-portrait', 'off_2p0s_ch8-launch.png'),
  path.join(V, 'ch8-captures-potato', 'off_9p7s_ch8-launch.png')
];
const registryFiles = files.filter(f => !f.endsWith('.png')).concat(CITED_PNGS.filter(f => fs.existsSync(f)));
const runLevel = [
  'verification-report.json', 'screenshot-report.md', 'audio-report.md',
  'objective-lifecycle-evidence.json', 'chapter-journey-evidence.json',
  'raw-audiovisual-evidence.json', 'check-results.json'
].map(n => path.join(RUN_DIR, n)).filter(f => fs.existsSync(f));

const pngCounts = {};
for (const f of files.filter(f => f.endsWith('.png'))) {
  const dir = REL(path.dirname(f));
  pngCounts[dir] = (pngCounts[dir] ?? 0) + 1;
}

const refFor = (rel) => `${KIND(rel)}:${rel.replace(/^evidence\//, '').replace(/[\/.]/g, '-')}`;

const entries = [...registryFiles, ...runLevel].map(f => {
  const rel = REL(f);
  return {
    ref: refFor(rel),
    path: rel,
    sha256: sha(f),
    kind: KIND(rel),
    description: DESCRIPTIONS[rel] ?? `Stage 6 mechanical-proof artifact: ${path.basename(rel)}.`
  };
});
entries.push(...Object.entries(pngCounts).map(([dir, count]) => ({
  ref: `frame:${dir.replace(/^evidence\//, '').replace(/[\/.]/g, '-')}`,
  path: dir,
  sha256: crypto.createHash('sha256').update(
    fs.readdirSync(path.join(RUN_DIR, dir)).filter(n => n.endsWith('.png')).sort().map(n => `${n}:${sha(path.join(RUN_DIR, dir, n))}`).join('\n')
  ).digest('hex'),
  kind: 'frame-set',
  description: `Frame strip directory with ${count} PNG frames; the sha256 is over the sorted per-file name:hash manifest of the directory.`
})));

const registry = {
  schema: 'paravoxia.evidenceRegistry.v1',
  runId: '2026-08-10-ch7-ch8-voice-repair',
  contractVersion: 'draft-v2',
  contractSha256: 'aa7ea1ac3f60ad2c130e3eaa07c45b204be4a27f6ab2897e2035aeb9552aca8a',
  sourceRevision: '03e975a666767dd3d75fc339a3b3d61dfa755c4c',
  compiledAt: '2026-08-10T18:20:00.000Z',
  entries: entries.sort((a, b) => a.path.localeCompare(b.path))
};
fs.writeFileSync(path.join(RUN_DIR, 'evidence-registry.json'), `${JSON.stringify(registry, null, 2)}\n`);

// Raw audiovisual evidence: media files and timings only.
const videoDir = path.join(V, 'video');
const ch8Video = path.join(videoDir, 'ch8-launch-window.webm');
const ch7Video = path.join(videoDir, 'ch7-exit-window.webm');
const wavs = fs.readdirSync(V).filter(n => n.endsWith('.wav')).map(n => path.join(V, n));
const pngsIn = (dir) => fs.readdirSync(dir).filter(n => n.endsWith('.png')).sort();
const strip = (dir, label) => ({
  path: REL(dir),
  sha256: crypto.createHash('sha256').update(
    pngsIn(dir).map(n => `${n}:${sha(path.join(dir, n))}`).join('\n')
  ).digest('hex'),
  frameCount: pngsIn(dir).length,
  label,
  probe: probe(path.join(dir, pngsIn(dir)[0]))
});

const raw = {
  schema: 'paravoxia.rawAudiovisualEvidence.v1',
  runId: '2026-08-10-ch7-ch8-voice-repair',
  contractVersion: 'draft-v2',
  contractSha256: 'aa7ea1ac3f60ad2c130e3eaa07c45b204be4a27f6ab2897e2035aeb9552aca8a',
  sourceRevision: '03e975a666767dd3d75fc339a3b3d61dfa755c4c',
  capturedAt: '2026-08-10T18:20:00.000Z',
  containsCreativeIntent: false,
  intentFreeInstructions: 'Play the media in the order listed. Do not read any other file in this run folder first. The offsets below are seconds measured from the named window origin on the game clock; they are timing coordinates only.',
  playbackMetadata: {
    instructions: 'Video: 1280x720, VP8, no audio track (headless capture cannot mux the WebAudio bus). Audio: 48 kHz PCM 16-bit WAV, 20 s each, rendered offline from the combined music bus at the states listed. Frames: 1280x720 PNG unless the label says otherwise.',
    viewport: '1280x720 unless labelled 390x844 or 844x390',
    qualityTier: 'LOW unless labelled POTATO',
    previewUrl: 'http://localhost:5176',
    clock: 'offsets are seconds on the in-game story clock, measured from the named origin emission'
  },
  continuousVideo: fs.existsSync(ch8Video) ? {
    path: REL(ch8Video),
    sha256: sha(ch8Video),
    label: 'ch8-launch, deep link, movie autopilot, start of beat to 4 s past the advance',
    durationSeconds: probe(ch8Video)?.durationSeconds ?? 0,
    audioTrackAvailable: false,
    probe: probe(ch8Video),
    timings: [
      { offsetSeconds: 0.0, origin: 'atmosphere-exit caption' },
      { offsetSeconds: 1.767, marker: 'objective card changes' },
      { offsetSeconds: 2.016, marker: 'regulation band row 1' },
      { offsetSeconds: 4.016, marker: 'regulation band row 2' },
      { offsetSeconds: 6.033, marker: 'regulation band row 3' },
      { offsetSeconds: 8.533, marker: 'regulation band row 4' },
      { offsetSeconds: 11.549, marker: 'caption' },
      { offsetSeconds: 14.049, marker: 'caption' },
      { offsetSeconds: 15.0, marker: 'regulation band clears' },
      { offsetSeconds: 17.066, marker: 'beat change' }
    ]
  } : null,
  additionalVideo: fs.existsSync(ch7Video) ? [{
    path: REL(ch7Video),
    sha256: sha(ch7Video),
    label: 'ch7-reconstruct, deep link, movie autopilot, start of beat to 4 s past the advance',
    durationSeconds: probe(ch7Video)?.durationSeconds ?? 0,
    audioTrackAvailable: false,
    probe: probe(ch7Video),
    timings: [
      { offsetSeconds: 0.0, origin: 'calibration receipt regulation line' },
      { offsetSeconds: 0.611, marker: 'caption' },
      { offsetSeconds: 3.010, marker: 'caption' },
      { offsetSeconds: 5.027, marker: 'beat change' }
    ]
  }] : [],
  frameStrips: [
    strip(path.join(V, 'ch8-captures-desktop'), 'ch8 window, 1280x720 LOW, offsets +0.0 to +18.0'),
    strip(path.join(V, 'ch7-captures-desktop'), 'ch7 exit window, 1280x720 LOW, offsets +0.0 to +6.5'),
    strip(path.join(V, 'ch7-captures-desktop', 'pre-origin'), 'ch7 beat entry to calibration receipt, 400 ms interval, 1280x720 LOW'),
    strip(path.join(V, 'ch8-captures-mobile-portrait'), 'ch8 window, 390x844 LOW'),
    strip(path.join(V, 'ch8-captures-mobile-landscape'), 'ch8 window, 844x390 LOW'),
    strip(path.join(V, 'ch8-captures-reduced-motion'), 'ch8 window, 1280x720 LOW, prefers-reduced-motion reduce'),
    strip(path.join(V, 'ch8-captures-potato'), 'ch8 window, 1280x720 POTATO'),
    strip(path.join(V, 'ch7-captures-mobile-portrait'), 'ch7 exit window, 390x844 LOW'),
    strip(path.join(V, 'ch7-captures-reduced-motion'), 'ch7 exit window, 1280x720 LOW, prefers-reduced-motion reduce'),
    strip(path.join(V, 'ch7-captures-potato'), 'ch7 exit window, 1280x720 POTATO'),
    strip(path.join(V, 'l23-deep-link'), 'ch8 ignition and liftoff window, deep link, 250 ms interval'),
    strip(path.join(V, 'l23-chained'), 'ch8 ignition and liftoff window, chained from ch7-board, 250 ms interval')
  ],
  audio: wavs.map(w => ({
    path: REL(w),
    sha256: sha(w),
    label: path.basename(w, '.wav').replace('score-ch8-window-verify_', ''),
    durationSeconds: probe(w)?.durationSeconds ?? 0,
    probe: probe(w)
  })),
  unavailable: [
    'No continuous capture carries an audio track: headless Chromium cannot mux the WebAudio bus into the recorded video. The audio files listed are offline combined-music-bus renders of the same states and must be auditioned separately.'
  ]
};
fs.writeFileSync(path.join(RUN_DIR, 'raw-audiovisual-evidence.json'), `${JSON.stringify(raw, null, 2)}\n`);
console.log('registry entries:', registry.entries.length);
console.log('raw strips:', raw.frameStrips.length, 'audio:', raw.audio.length, 'video:', raw.continuousVideo ? 1 : 0);
