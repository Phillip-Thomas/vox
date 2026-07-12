// --- The audio core ----------------------------------------------------------------------
//
// ONE AudioContext and ONE music output chain, shared by every music engine:
// the streamed-layer/ambient mixer (musicEngine) and the procedural score
// (scoreEngine). One context means one clock — everything that schedules sound
// reads the same `currentTime` — and one output chain means the whole score
// passes through the underwater muffle, the hidden-tab duck, and the safety
// compressor together:
//
//   engine outputs → musicBus (volume · mute) → submergeFilter (lowpass)
//                  → visibilityGain → compressor → destination

let ctx: AudioContext | null = null;
let musicBus: GainNode | null = null;
let submergeFilter: BiquadFilterNode | null = null;
let visibilityGain: GainNode | null = null;

let volume = 0.72;
let muted = false;
let submerged = false;
let ducked = false;

export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (ctx) return ctx;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -20;
  compressor.ratio.value = 8;
  compressor.connect(ctx.destination);

  visibilityGain = ctx.createGain();
  visibilityGain.gain.value = ducked ? 0.18 : 1;
  visibilityGain.connect(compressor);

  submergeFilter = ctx.createBiquadFilter();
  submergeFilter.type = 'lowpass';
  submergeFilter.frequency.value = submerged ? 540 : 20000; // open on land (transparent)
  submergeFilter.Q.value = 0.7;
  submergeFilter.connect(visibilityGain);

  musicBus = ctx.createGain();
  musicBus.gain.value = 0;
  musicBus.connect(submergeFilter);
  applyOutput(0.05);

  return ctx;
}

/** The shared music bus — every music engine's output connects here. */
export function getMusicBus(): GainNode | null {
  getAudioContext();
  return musicBus;
}

/**
 * The context if one already exists — never creates one. Lets late-joining
 * engines (the generative bed) build only after an unlock path made the
 * context, so no pre-gesture AudioContext is ever constructed on their behalf.
 */
export function peekAudioContext(): AudioContext | null {
  return ctx;
}

/** Resume the context from a user gesture (autoplay policy). */
export function unlockAudio(): void {
  const context = getAudioContext();
  if (context && context.state === 'suspended') void context.resume();
}

export function setMusicOutput(nextVolume: number, nextMuted: boolean): void {
  volume = Math.min(1, Math.max(0, nextVolume));
  muted = nextMuted;
  applyOutput(0.22);
}

export function isMusicMuted(): boolean {
  return muted;
}

/** Muffle the whole music mix underwater (edge-driven by AudioDirector). */
export function setMusicSubmerged(next: boolean): void {
  submerged = next;
  if (ctx && submergeFilter) {
    rampParam(ctx, submergeFilter.frequency, next ? 540 : 20000, next ? 0.12 : 0.2);
  }
}

export function setMusicVisibilityDucked(next: boolean): void {
  ducked = next;
  if (ctx && visibilityGain) {
    rampParam(ctx, visibilityGain.gain, next ? 0.18 : 1, next ? 0.35 : 0.45);
  }
}

function applyOutput(fadeSeconds: number): void {
  if (!ctx || !musicBus) return;
  rampParam(ctx, musicBus.gain, muted ? 0 : volume, fadeSeconds);
}

export function rampParam(
  context: AudioContext,
  param: AudioParam,
  value: number,
  fadeSeconds: number
): void {
  const now = context.currentTime;
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  param.linearRampToValueAtTime(value, now + Math.max(0.01, fadeSeconds));
}

export function makeNoiseBuffer(context: AudioContext, seconds: number): AudioBuffer {
  const frameCount = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const data = buffer.getChannelData(0);
  let sample = 0;
  for (let i = 0; i < frameCount; i++) {
    // Brown-ish noise sits behind the music as air/sea texture instead of
    // reading as bright broadband static.
    sample = sample * 0.985 + (Math.random() * 2 - 1) * 0.015;
    data[i] = sample * 3.5;
  }
  return buffer;
}
