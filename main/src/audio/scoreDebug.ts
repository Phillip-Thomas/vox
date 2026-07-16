import type { ArchetypeId } from '../game/data/planetArchetypes.ts';
import type { MusicMix } from './musicDirector.ts';
import { SLOTS_PER_BAR } from './generative/rhythm.ts';
import {
  resolveAudioGust,
  resolveEraGates,
  resolveMacroDrift,
  resolveWorldClockTick,
  type BedSignals
} from './generative/worldSignals.ts';

// --- Dev-only live score signal inspector -------------------------------------------------------
//
// `?scoredebug=1` exposes the exact world snapshot AudioDirector handed to the
// bed, alongside the pure musical resolvers and the live chord/mix. The normal
// game pays one boolean branch; DOM writes and object formatting are throttled
// and never run without the explicit dev flag.

const SCORE_DEBUG_PAINT_INTERVAL_MS = 500;
const SCORE_DEBUG_CONSOLE_INTERVAL_MS = 4000;
const SCORE_DEBUG_OVERLAY_ID = 'paravoxia-score-debug';
const SCORE_DEBUG_Z_INDEX = '2147483647';
const SCORE_DEBUG_MAX_WIDTH = '520px';
const SCORE_DEBUG_MAX_HEIGHT = '72vh';
const SCORE_DEBUG_FONT_SIZE = '11px';

export interface ScoreDebugChord {
  root: number;
  chord: readonly number[];
}

export interface ScoreDebugInput {
  signals: BedSignals;
  planetSeed: number;
  archetype: ArchetypeId;
  paletteBrightness: number;
  biomeWeights: object;
  chord: ScoreDebugChord;
  mix: MusicMix;
  /** Optional additive rim snapshot when bedEngine exposes one. */
  bed?: object | null;
}

export interface ScoreDebugSnapshot {
  atMs: number;
  planet: {
    seed: number;
    archetype: ArchetypeId;
    paletteBrightness: number;
    biomeWeights: object;
  };
  signals: BedSignals;
  music: {
    chord: { root: number; tones: number[] };
    eraGates: ReturnType<typeof resolveEraGates>;
    clock: ReturnType<typeof resolveWorldClockTick>;
    gust: ReturnType<typeof resolveAudioGust>;
    macroDrift: ReturnType<typeof resolveMacroDrift>;
    streamedLayers: MusicMix['layers'];
    proceduralRims: MusicMix['procedural'];
    mixFadeSeconds: number;
    bed: object | null;
  };
}

declare global {
  interface Window {
    __scoreDebug?: ScoreDebugSnapshot;
  }
}

function scoreDebugEnabled(): boolean {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false;
  const raw = new URLSearchParams(window.location.search).get('scoredebug');
  return raw !== null && raw !== '0' && raw !== 'false';
}

const enabled = scoreDebugEnabled();
/** Cheap call-site guard so the normal rAF does not clone debug snapshots. */
export function isScoreDebugEnabled(): boolean {
  return enabled;
}
let lastPaintAt = Number.NEGATIVE_INFINITY;
let lastConsoleAt = Number.NEGATIVE_INFINITY;
let overlay: HTMLPreElement | null = null;

function ensureOverlay(): HTMLPreElement | null {
  if (!enabled || typeof document === 'undefined') return null;
  if (overlay?.isConnected) return overlay;
  const existing = document.getElementById(SCORE_DEBUG_OVERLAY_ID);
  if (existing instanceof HTMLPreElement) {
    overlay = existing;
    return overlay;
  }
  const el = document.createElement('pre');
  el.id = SCORE_DEBUG_OVERLAY_ID;
  el.setAttribute('aria-label', 'Procedural score signal diagnostics');
  Object.assign(el.style, {
    position: 'fixed',
    right: '12px',
    bottom: '12px',
    zIndex: SCORE_DEBUG_Z_INDEX,
    maxWidth: SCORE_DEBUG_MAX_WIDTH,
    maxHeight: SCORE_DEBUG_MAX_HEIGHT,
    overflow: 'auto',
    margin: '0',
    padding: '10px 12px',
    border: '1px solid rgba(155, 220, 255, 0.45)',
    borderRadius: '6px',
    background: 'rgba(3, 8, 18, 0.9)',
    color: '#c9efff',
    font: `${SCORE_DEBUG_FONT_SIZE}/1.35 ui-monospace, SFMono-Regular, Menlo, monospace`,
    pointerEvents: 'none',
    whiteSpace: 'pre-wrap'
  });
  document.body.appendChild(el);
  overlay = el;
  return el;
}

function rounded(value: number): number {
  return Number(value.toFixed(3));
}

function tableRows(snapshot: ScoreDebugSnapshot): Array<Record<string, string | number | boolean>> {
  const s = snapshot.signals;
  const m = snapshot.music;
  const bed = m.bed as {
    padLevel?: number;
    subLevel?: number;
    ostinatoLevel?: number;
    shimmerLevel?: number;
  } | null;
  const level = (value: number | undefined): string =>
    value == null ? 'pending first bar' : String(rounded(value));
  return [
    { signal: 'planet', value: `${snapshot.planet.seed}/${snapshot.planet.archetype}`, music: `root ${m.chord.root}` },
    { signal: 'biome weights', value: JSON.stringify(snapshot.planet.biomeWeights), music: 'demoted streamed-stem mood weights' },
    { signal: 'palette proxy', value: rounded(snapshot.planet.paletteBrightness), music: 'temperature+saturation -> pad filter base' },
    { signal: 'daylight', value: rounded(s.daylight), music: `register ${rounded(m.macroDrift.registerShift)}, pad warmth ${rounded(s.warmth)}` },
    { signal: 'golden', value: rounded(s.golden), music: 'mediant cadence probability' },
    { signal: 'submergence', value: rounded(s.submergence), music: `clock ${rounded(m.clock.hz)}Hz, level ${rounded(m.clock.level)}` },
    { signal: 'wind strength', value: `${rounded(s.windStrength)} / gust ${rounded(s.windGustStrength)}`, music: `field ${rounded(m.gust.gust)}, drive ${rounded(m.gust.drive)}` },
    { signal: 'wind field', value: `scale ${rounded(s.windGustScale)} speed ${rounded(s.windGustSpeed)}`, music: `shared visual-cell gust ${rounded(m.gust.gust)}` },
    { signal: 'wind direction', value: `${rounded(s.windDirectionX)},${rounded(s.windDirectionY)} veer ${rounded(s.windVeer)}`, music: `pan ${rounded(m.gust.pan)}, turbulence ${rounded(m.gust.turbulence)}` },
    { signal: 'wind offset', value: `${rounded(s.windOffsetX)},${rounded(s.windOffsetY)}`, music: `sample @ ${rounded(s.playerX)},${rounded(s.playerZ)}` },
    { signal: 'regionUnit', value: rounded(s.regionUnit), music: `Euclidean rotation ${Math.floor(s.regionUnit * SLOTS_PER_BAR)}/${SLOTS_PER_BAR}` },
    { signal: 'timeSec', value: rounded(s.timeSec), music: `macro register ${rounded(m.macroDrift.registerShift)}, texture ${rounded(m.macroDrift.textureLean)}` },
    {
      signal: 'destination',
      value: s.destinationSeed == null
        ? 'none'
        : `${s.destinationWorldId ?? 'coordinate'} · ${s.destinationSeed} · ${s.destinationProfileId ?? 'unknown'}@${s.destinationProfileVersion ?? '?'} · ${s.destinationProfileHash ?? 'unverified'} · ${s.destinationArchetype ?? 'unknown'}`,
      music: s.scene === 'approach' ? 'approach modulation active' : 'latent'
    },
    { signal: 'warp', value: s.warpActive, music: `progress ${rounded(s.warpProgress)}, clock ${rounded(m.clock.presence)}` },
    { signal: 'scene', value: s.scene, music: `mix fade ${rounded(m.mixFadeSeconds)}s` },
    { signal: 'storyLeads', value: s.storyLeads, music: s.storyLeads ? 'bed yields to authored mood' : 'generative bed leads' },
    { signal: 'era/stage', value: `${rounded(s.era)}/${s.stage}`, music: `pad ${rounded(m.eraGates.padChoir)}, sub ${rounded(m.eraGates.sub)}, shimmer ${rounded(m.eraGates.shimmer)}` },
    { signal: 'chroma', value: rounded(s.chroma), music: `color tones + pad detune; pad level ${level(bed?.padLevel)}` },
    { signal: 'detail', value: rounded(s.detail), music: `Euclidean onset count + era; ost level ${level(bed?.ostinatoLevel)}` },
    { signal: 'organic', value: rounded(s.organic), music: 'seeded note/percussion timing jitter + era' },
    { signal: 'atmosphere', value: rounded(s.atmosphere), music: `reverb target ${rounded(m.eraGates.reverb * s.atmosphere)}` },
    { signal: 'thermal', value: rounded(s.thermal), music: `sub harmonics + organ warmth; sub level ${level(bed?.subLevel)}` },
    { signal: 'crystalline', value: rounded(s.crystalline), music: `FM shimmer; shimmer level ${level(bed?.shimmerLevel)}` },
    { signal: 'metal', value: rounded(s.metal), music: `tick/percussion partial color; tick level ${rounded(m.clock.level)}` },
    { signal: 'chord', value: `[${m.chord.tones.join(', ')}]`, music: `texture drift ${rounded(m.macroDrift.textureLean)}` }
  ];
}

/** Called from AudioDirector's existing rAF; no work unless `?scoredebug=1`. */
export function updateScoreDebug(input: ScoreDebugInput): void {
  if (!enabled) return;
  const now = performance.now();
  if (now - lastPaintAt < SCORE_DEBUG_PAINT_INTERVAL_MS) return;
  lastPaintAt = now;
  const s = input.signals;
  const snapshot: ScoreDebugSnapshot = {
    atMs: now,
    planet: {
      seed: input.planetSeed,
      archetype: input.archetype,
      paletteBrightness: input.paletteBrightness,
      biomeWeights: { ...input.biomeWeights }
    },
    signals: { ...s },
    music: {
      chord: { root: input.chord.root, tones: [...input.chord.chord] },
      eraGates: resolveEraGates(s.era, s.stage),
      clock: resolveWorldClockTick(s),
      gust: resolveAudioGust(s),
      macroDrift: resolveMacroDrift(input.planetSeed, s.timeSec, s.daylight),
      streamedLayers: { ...input.mix.layers },
      proceduralRims: { ...input.mix.procedural },
      mixFadeSeconds: input.mix.fadeSeconds,
      bed: input.bed ?? null
    }
  };
  window.__scoreDebug = snapshot;
  const rows = tableRows(snapshot);
  const el = ensureOverlay();
  if (el) {
    el.textContent = [
      'PARAVOXIA SCORE DEBUG — signal -> music',
      ...rows.map((row) => `${String(row.signal).padEnd(13)} ${String(row.value).padEnd(22)} ${row.music}`),
      `layers        ${JSON.stringify(snapshot.music.streamedLayers)}`,
      `procedural    ${JSON.stringify(snapshot.music.proceduralRims)}`,
      snapshot.music.bed ? `bed           ${JSON.stringify(snapshot.music.bed)}` : ''
    ].filter(Boolean).join('\n');
  }
  if (now - lastConsoleAt >= SCORE_DEBUG_CONSOLE_INTERVAL_MS) {
    lastConsoleAt = now;
    console.table(rows);
  }
}
