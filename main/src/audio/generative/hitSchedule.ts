import type { HitQuantize } from './transport.ts';
import { PHRASE_BARS } from './tuning.ts';

// --- Composed sync: cap-bounded quantum resolution (audio-10x Stage 3, §8.1) -------------------
//
// Pure. The story scheduler asks for a quantum (bar / beat / 8th step) at or
// after a DESIRED audio time; the anchor's cap bounds how far the onset may move
// from that desire. The written quantum is preferred and degrades one rung at a
// time — phrase → bar → beat → step — until a quantum fits the cap. `mayLead`
// admits the nearer EARLIER quantum (the ±cap rulings); `notBefore` is a hard
// floor no quantum may precede (the a2 HUD-death and a3 caption holds). When
// even the floor rung does not fit, the floor rung is still returned with
// `fitsCap: false` — the runtime lands on the grid and the fit TEST is what
// refuses the design, never a silent fall to "immediate".
//
// The grid is the shipped 8th-note step grid of the leading story mood
// (`patternStep` / `nextNoteAt`): one clock, the mood's own tempo. Story-side
// caps live in storyScore.ts (HIT_CAP_MS); this module knows only times.

export type HitQuantumRung = 'bar' | 'beat' | 'step';

export interface StepGrid {
  /** The step index the scheduler will emit next. */
  currentStep: number;
  /** Audio time of `currentStep`. */
  stepTime: number;
  /** Seconds per 8th-note step at the mood tempo. */
  stepSeconds: number;
  stepsPerBeat: number;
  stepsPerBar: number;
  barsPerPhrase?: number;
}

export interface HitQuantumRequest {
  quantize: HitQuantize;
  /** The caller's desired onset (audio time). */
  desired: number;
  /** Hard floor: no quantum earlier than this (audio time). */
  notBefore: number;
  /** Max distance from `desired`, ms. Later-only unless `mayLead`. */
  capMs: number;
  mayLead?: boolean;
  /** Lowest rung the degrade chain may reach (default 'step'). */
  floorRung?: HitQuantumRung;
}

export interface HitQuantumResult {
  step: number;
  time: number;
  quantumLanded: HitQuantumRung;
  /** Signed distance from the desired onset, ms (positive = later). */
  slackMs: number;
  fitsCap: boolean;
  /** Rungs walked below the written quantum (0 = written quantum fit). */
  rungsDegraded: number;
}

const RUNGS: readonly HitQuantumRung[] = ['bar', 'beat', 'step'];

export function rungForQuantize(quantize: HitQuantize): HitQuantumRung {
  return quantize === 'beat' ? 'beat' : 'bar';
}

function stepsPerUnit(grid: StepGrid, rung: HitQuantumRung, phrase: boolean): number {
  if (rung === 'step') return 1;
  if (rung === 'beat') return grid.stepsPerBeat;
  return phrase ? grid.stepsPerBar * (grid.barsPerPhrase ?? PHRASE_BARS) : grid.stepsPerBar;
}

/** Smallest multiple-of-`unit` step at or after `currentStep` whose time is ≥ `floor`. */
function nextUnitStep(grid: StepGrid, unit: number, floor: number): { step: number; time: number } {
  let step = Math.ceil(grid.currentStep / unit) * unit;
  let time = grid.stepTime + (step - grid.currentStep) * grid.stepSeconds;
  while (time < floor) {
    step += unit;
    time += unit * grid.stepSeconds;
  }
  return { step, time };
}

/**
 * Resolve one rung: the first quantum at or after max(desired, notBefore), or
 * with `mayLead` the nearer of that and the previous quantum (which must still
 * respect `notBefore` and the scheduler's current step).
 */
export function resolveRungQuantum(
  grid: StepGrid,
  rung: HitQuantumRung,
  req: HitQuantumRequest,
  phrase = false
): { step: number; time: number } {
  const unit = stepsPerUnit(grid, rung, phrase);
  const later = nextUnitStep(grid, unit, Math.max(req.desired, req.notBefore));
  if (!req.mayLead) return later;
  const earlierStep = later.step - unit;
  const earlierTime = later.time - unit * grid.stepSeconds;
  if (earlierStep < grid.currentStep || earlierTime < req.notBefore) return later;
  const laterDist = Math.abs(later.time - req.desired);
  const earlierDist = Math.abs(req.desired - earlierTime);
  return earlierDist < laterDist ? { step: earlierStep, time: earlierTime } : later;
}

/**
 * The degrade chain. Starts at the written quantum ('phrase' begins at the
 * phrase multiple, then the bar), walks toward `floorRung`, returns the first
 * rung whose quantum fits the cap; else the floor rung with `fitsCap: false`.
 */
export function resolveHitQuantum(grid: StepGrid, req: HitQuantumRequest): HitQuantumResult {
  const startRung = rungForQuantize(req.quantize);
  const floorRung = req.floorRung ?? 'step';
  const startIndex = RUNGS.indexOf(startRung);
  const floorIndex = Math.max(startIndex, RUNGS.indexOf(floorRung));
  const capS = req.capMs / 1000;
  let rungsDegraded = 0;
  // The phrase multiple is its own first attempt ahead of the plain bar.
  if (req.quantize === 'phrase') {
    const q = resolveRungQuantum(grid, 'bar', req, true);
    const slack = q.time - req.desired;
    if (Math.abs(slack) <= capS + 1e-9) {
      return { step: q.step, time: q.time, quantumLanded: 'bar', slackMs: slack * 1000, fitsCap: true, rungsDegraded: 0 };
    }
    rungsDegraded++;
  }
  for (let i = startIndex; i <= floorIndex; i++) {
    const rung = RUNGS[i];
    const q = resolveRungQuantum(grid, rung, req);
    const slack = q.time - req.desired;
    const fits = Math.abs(slack) <= capS + 1e-9;
    if (fits || i === floorIndex) {
      return { step: q.step, time: q.time, quantumLanded: rung, slackMs: slack * 1000, fitsCap: fits, rungsDegraded };
    }
    rungsDegraded++;
  }
  // Unreachable: the loop always returns at the floor rung.
  throw new Error('resolveHitQuantum: no rung');
}

/**
 * Design-time fit check (contract check-scheduler-cap-fit): at `tempo`, does
 * some rung from the written quantum down to `floorRung` ALWAYS fit inside the
 * cap regardless of grid phase? A later-only rung fits iff its period ≤ cap;
 * with lead permitted iff half its period ≤ cap.
 */
export function quantumFitsCapAtTempo(
  tempo: number,
  quantize: HitQuantize,
  capMs: number,
  opts: { mayLead?: boolean; floorRung?: HitQuantumRung; stepsPerBeat?: number; stepsPerBar?: number } = {}
): { fits: boolean; rung: HitQuantumRung | null; periodMs: number | null } {
  const stepsPerBeat = opts.stepsPerBeat ?? 2;
  const stepsPerBar = opts.stepsPerBar ?? 8;
  const stepMs = (60000 / tempo) / stepsPerBeat;
  const floorIndex = RUNGS.indexOf(opts.floorRung ?? 'step');
  for (let i = RUNGS.indexOf(rungForQuantize(quantize)); i <= floorIndex; i++) {
    const rung = RUNGS[i];
    const units = rung === 'step' ? 1 : rung === 'beat' ? stepsPerBeat : stepsPerBar;
    const periodMs = units * stepMs;
    const worst = opts.mayLead ? periodMs / 2 : periodMs;
    if (worst <= capMs + 1e-9) return { fits: true, rung, periodMs };
  }
  return { fits: false, rung: null, periodMs: null };
}
