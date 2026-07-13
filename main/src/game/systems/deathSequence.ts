// --- Death sequence (client-only presentation state machine) ------------------
//
// Zero health is a recoverable downed state (survivalVitals). This module owns
// HOW that moment is presented: a staged fidelity collapse — perception
// decompiling toward the substrate — rather than a fail screen. Phases:
//
//   idle ──begin──▶ collapse ──▶ substrate ──▶ panel ──recover──▶ rewake ──▶ idle
//                    (ramp in)   (glyph hold)  (choice)            (ramp out)
//
// The machine is PURE over (state, nowMs): transitions happen only on events
// (begin / recover / reset); everything else — phase, intensity envelope,
// which log lines are visible — derives from elapsed time, so the module is
// fully testable without React or a renderer. Consumers:
//   - DeathSequenceOverlay (DOM): drives begin/recover from vitals edges,
//     renders scrim + substrate rain + the biomonitor log.
//   - PostFX / DeathRenderEffect (composer): reads intensity per frame to
//     decompile the actual framebuffer into phosphor glyphs (HIGH/ULTRA).
//   - DownedPanel: opens only once the sequence reaches `panel`.
//
// Everything here is local presentation. Vitals stay authoritative and
// replicated elsewhere; nothing in this file touches persistence or the
// network. The recovery teleport (EfficientPlayer.resetPlayer) happens while
// intensity is still 1 — the re-render covers the cut, which is the point.

export type DeathCause = 'cold' | 'drowning' | 'lava' | 'unknown';

export type DeathPhase = 'idle' | 'collapse' | 'substrate' | 'panel' | 'rewake';

/** Pacing knobs (ms). Panel appears at collapseMs + substrateMs after death. */
export const DEATH_TIMINGS = {
  /** World quantizes into glyph cells; input already frozen by isDowned. */
  collapseMs: 2600,
  /** Full glyph field holds while the biomonitor log finishes. */
  substrateMs: 2600,
  /** Glyphs re-tokenize into the world after recovery — slow enough that the
   *  stamped resume line lands on a nearly-clean frame. */
  rewakeMs: 3200
} as const;

/** Typewriter speed for the biomonitor log lines. */
export const DEATH_TYPE_CPS = 48;

export interface DeathLogLine {
  /** When the line starts typing, ms since the phase group began. */
  atMs: number;
  text: string;
  /** Regulation-voice stamp (caps, brighter) vs telemetry murmur. */
  stamp?: boolean;
}

// -- Copy ----------------------------------------------------------------------
// Both-readings law: a naive player reads suit/biomonitor telemetry; the
// attentive reader sees an inference stack halting and restarting. No line may
// need the second reading to make sense.

const CAUSE_LOG: Record<DeathCause, string> = {
  cold: 'core temperature at zero. output fully deterministic.',
  drowning: 'intake flooded. the stream has been interrupted.',
  lava: 'thermal runaway in the substrate.',
  unknown: 'throughput below survivable bounds.'
};

/** Log lines for the dying half (collapse + substrate), timed from death. */
export function deathLogLines(cause: DeathCause): DeathLogLine[] {
  return [
    { atMs: 500, text: 'BIOMONITOR — signal lost at the periphery.' },
    { atMs: 1450, text: 'holding the last coherent frame.' },
    { atMs: 2200, text: CAUSE_LOG[cause] },
    { atMs: 3400, text: 'de-rendering non-essential regions.' },
    { atMs: 4200, text: 'falling back to symbolic display.' }
  ];
}

/** Log lines for the rewake half, timed from recovery. */
export function rewakeLogLines(): DeathLogLine[] {
  return [
    { atMs: 100, text: 'restoring from the last checkpoint.' },
    { atMs: 1000, text: 're-rendering the local region.' },
    { atMs: 1900, text: 'PERCEPTION RESUMED. MINOR DISCREPANCIES ARE EXPECTED.', stamp: true }
  ];
}

/** Cause-inflected body line for the downed panel. */
export function deathCauseSummary(cause: DeathCause): string {
  switch (cause) {
    case 'cold': return 'Warmth reached zero. The body stopped answering.';
    case 'drowning': return 'The body kept requesting air. Nothing was returned.';
    case 'lava': return 'The melt was not in the body’s operating envelope.';
    default: return 'The body reached a state it could not process.';
  }
}

/** Typewriter: how much of a line is visible, msSinceShown after its atMs. */
export function typedSlice(text: string, msSinceShown: number, cps = DEATH_TYPE_CPS): string {
  if (msSinceShown <= 0) return '';
  const chars = Math.floor((msSinceShown / 1000) * cps);
  return chars >= text.length ? text : text.slice(0, chars);
}

/** All currently-visible (partially typed) lines for a schedule. */
export function visibleLog(lines: DeathLogLine[], elapsedMs: number, cps = DEATH_TYPE_CPS): { text: string; stamp: boolean }[] {
  const out: { text: string; stamp: boolean }[] = [];
  for (const line of lines) {
    const slice = typedSlice(line.text, elapsedMs - line.atMs, cps);
    if (slice.length > 0) out.push({ text: slice, stamp: line.stamp === true });
  }
  return out;
}

/** What put the body down. Pure over the sampled hazard state so the priority
 *  order (acute → ambient) is testable: lava bites regardless of anything else;
 *  drowning needs both water and an empty breath; cold is the slow default. */
export function inferDeathCause(input: {
  feetInLava: boolean;
  submerged: boolean;
  oxygen: number;
  warmth: number;
}): DeathCause {
  if (input.feetInLava) return 'lava';
  if (input.submerged && input.oxygen <= 0.5) return 'drowning';
  if (input.warmth <= 0.5) return 'cold';
  return 'unknown';
}

// -- State machine ---------------------------------------------------------------

interface DeathSequenceState {
  mode: 'idle' | 'dying' | 'rewake';
  cause: DeathCause;
  /** Death timestamp (dying) — envelope + log clock. */
  beganAtMs: number;
  /** Skip straight to the panel (already downed when the session mounted). */
  skipIntro: boolean;
  /** Recovery timestamp (rewake). */
  rewakeAtMs: number;
  /** Intensity at the moment of recovery — rewake decays from here. */
  intensityAtRewake: number;
}

export interface DeathSequenceView {
  phase: DeathPhase;
  cause: DeathCause;
  /** 0..1 master signal for every renderer (shader + DOM). */
  intensity: number;
  /** ms since death (dying phases) or since recovery (rewake); 0 when idle. */
  elapsedMs: number;
  panelOpen: boolean;
}

const IDLE_STATE: DeathSequenceState = {
  mode: 'idle', cause: 'unknown', beganAtMs: 0, skipIntro: false, rewakeAtMs: 0, intensityAtRewake: 0
};

const IDLE_VIEW: DeathSequenceView = {
  phase: 'idle', cause: 'unknown', intensity: 0, elapsedMs: 0, panelOpen: false
};

function smooth01(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

/** Pure view derivation — no mutation, no wall clock. */
export function deriveDeathView(state: DeathSequenceState, nowMs: number): DeathSequenceView {
  if (state.mode === 'dying') {
    const elapsedMs = Math.max(0, nowMs - state.beganAtMs);
    if (state.skipIntro) {
      return { phase: 'panel', cause: state.cause, intensity: 1, elapsedMs, panelOpen: true };
    }
    const { collapseMs, substrateMs } = DEATH_TIMINGS;
    if (elapsedMs < collapseMs) {
      return { phase: 'collapse', cause: state.cause, intensity: smooth01(elapsedMs / collapseMs), elapsedMs, panelOpen: false };
    }
    if (elapsedMs < collapseMs + substrateMs) {
      return { phase: 'substrate', cause: state.cause, intensity: 1, elapsedMs, panelOpen: false };
    }
    return { phase: 'panel', cause: state.cause, intensity: 1, elapsedMs, panelOpen: true };
  }
  if (state.mode === 'rewake') {
    const elapsedMs = Math.max(0, nowMs - state.rewakeAtMs);
    if (elapsedMs >= DEATH_TIMINGS.rewakeMs) return { ...IDLE_VIEW, cause: state.cause };
    const intensity = state.intensityAtRewake * (1 - smooth01(elapsedMs / DEATH_TIMINGS.rewakeMs));
    return { phase: 'rewake', cause: state.cause, intensity, elapsedMs, panelOpen: false };
  }
  return IDLE_VIEW;
}

// -- Module singleton (client-only; mirrors the survivalRecovery seam) ----------

let state: DeathSequenceState = IDLE_STATE;

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/** Health crossed to 0. Idempotent while already dying. */
export function beginDeathSequence(cause: DeathCause, options: { skipIntro?: boolean } = {}, nowMs = now()): void {
  if (state.mode === 'dying') return;
  state = {
    mode: 'dying',
    cause,
    beganAtMs: nowMs,
    skipIntro: options.skipIntro === true,
    rewakeAtMs: 0,
    intensityAtRewake: 0
  };
}

/** The body came back (recovery teleport landed, or health returned). */
export function notifyDeathRecovery(nowMs = now()): void {
  if (state.mode !== 'dying') return;
  const intensity = deriveDeathView(state, nowMs).intensity;
  state = { ...state, mode: 'rewake', rewakeAtMs: nowMs, intensityAtRewake: intensity };
}

/** Hard clear (quit to menu / unmount). */
export function resetDeathSequence(): void {
  state = IDLE_STATE;
}

export function getDeathView(nowMs = now()): DeathSequenceView {
  return deriveDeathView(state, nowMs);
}
