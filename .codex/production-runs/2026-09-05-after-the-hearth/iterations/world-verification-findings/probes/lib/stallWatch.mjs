/**
 * OPT-IN bounded stall predicate for ch13 on-foot walk / interact phases.
 *
 * PURPOSE — efficient failure, never rescue. The pre-repair evidence contains a
 * 300 s home stagnation, a 243 s survey deep-link stagnation and a ~286 s
 * `ch13:survey:start` stagnation, each burning a full GPU budget to learn one
 * bit. This predicate lets a probe declare FAIL early, capture the frozen
 * moment, finalize its media, and stop. It NEVER unsticks anything, never grants
 * progress and never converts into a pass.
 *
 * EXACT PREDICATE
 * ---------------
 * A stall window opens at t0 and is RESET (t0 := now) whenever any of these is
 * observed to change or accumulate:
 *
 *   (a) STORY   beat | objectiveId | markerLabel | workOrder | anchorId |
 *               signed-AV activationSequence | localActor milestones
 *   (b) PHYSICAL-PROGRESS  the CommonGround diagnostic progress signature
 *               (survey.phase/approached/samples/lengthUnits/walkedUnits/
 *                testedPrefix/tailRevision/accepted*, common.stage/terraUnits/
 *                comparisonProved/finalReference*, holdReason, installWatch,
 *                worker.*) — ONLY when that diagnostic is actually exposed
 *   (c) PLAYER BODY   accumulated |Δ capsule centre| >= playerUnits
 *   (d) ACTOR BODY    accumulated |Δ worker pose| >= actorUnits
 *                     ("ongoing actor motion" — W-7744 walking his own leg is
 *                      the chapter working, not a stall)
 *   (e) ACTIVE FLIGHT the player is in flight controlMode AND the ship pose
 *                     accumulated >= shipUnits. NOTE: flight mode alone does
 *                     NOT exempt — a ship that is merely parked while the
 *                     on-foot rail asks for a walk is exactly VF-DEEPLINK-1 and
 *                     must still be caught.
 *   (f) OUT OF SCOPE  the current phase is not in --stall-phases, or the
 *                     operator declared a deliberate manual wait
 *                     (obs.manualHold), or the predicate is disabled.
 *
 * FIRING is additionally SUPPRESSED (clock keeps running, window is NOT reset)
 * while an intentional cue hold is active (obs.cueHoldUntilMs in the future, or
 * obs.captionActive). Suppression can delay a FAIL but can never cancel one:
 * the instant the cue hold ends, an already-overrun window fires.
 *
 * When the runtime reports its own intentional hold (`holdReason` non-null and
 * unchanged) the required window is multiplied by holdMultiplier, so a
 * legitimate long hold is given extra room while a permanently-wedged hold is
 * still caught.
 *
 * OUTCOME VOCABULARY: firing yields verdict 'FAIL-STALL'. There is no verdict
 * in this module that means success.
 */

export const DEFAULT_STALL_CONFIG = Object.freeze({
  enabled: false,           // opt-in only: --stall-fail-ms turns it on
  windowMs: 45_000,
  playerUnits: 0.75,        // matches the existing --stall-units reporting threshold
  actorUnits: 0.5,
  shipUnits: 1.0,
  cueGraceMs: 12_000,
  holdMultiplier: 2,
  phases: Object.freeze(['walk', 'interact', 'on-foot'])
});

const vec = (v) => (Array.isArray(v) && v.length >= 3
  && v.slice(0, 3).every((n) => typeof n === 'number' && Number.isFinite(n))) ? v.slice(0, 3) : null;
const d3 = (a, b) => (a && b) ? Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) : 0;

export const STORY_FIELDS = Object.freeze([
  'beat', 'objectiveId', 'markerLabel', 'workOrderSig',
  'anchorId', 'activationSequence', 'milestoneSig'
]);

export function storySignature(obs) {
  const o = {};
  for (const f of STORY_FIELDS) o[f] = obs?.[f] ?? null;
  return JSON.stringify(o);
}

export class StallWatch {
  constructor(config = {}) {
    this.cfg = { ...DEFAULT_STALL_CONFIG, ...config };
    this.fired = null;
    this.suppressions = [];
    this.resets = [];
    this.reset(null, 'init');
  }

  reset(atMs, reason) {
    this.t0 = atMs;
    this.t0Reason = reason;
    this.storySig = undefined;
    this.progressSig = undefined;
    this.playerAccum = 0;
    this.actorAccum = 0;
    this.shipAccum = 0;
    this.lastPlayer = null;
    this.lastActor = null;
    this.lastShip = null;
    this.t0Context = null;
    if (atMs != null) this.resets.push({ atMs, reason });
    if (this.resets.length > 200) this.resets.splice(0, this.resets.length - 200);
  }

  /**
   * @param {object} obs one observation. Fields are all optional; anything the
   *   probe could not observe is simply absent and is recorded as unobserved
   *   rather than treated as "unchanged evidence of a stall".
   * @returns {{fired:boolean, verdict:string|null, report:object|null, windowMs:number|null}}
   */
  update(obs) {
    const now = obs?.atMs ?? null;
    if (now == null) return this.#idle(null, 'no-timestamp');
    if (this.fired) return { fired: true, verdict: 'FAIL-STALL', report: this.fired, windowMs: this.fired.windowMs };

    if (!this.cfg.enabled) return this.#idle(now, 'predicate-disabled');
    if (obs.manualHold === true) { this.reset(now, 'deliberate-manual-wait'); return this.#idle(now, 'deliberate-manual-wait'); }
    const phase = obs.phase ?? null;
    if (phase != null && !this.cfg.phases.includes(phase)) {
      this.reset(now, `phase-out-of-scope:${phase}`);
      return this.#idle(now, `phase-out-of-scope:${phase}`);
    }

    if (this.t0 == null) { this.reset(now, 'window-opened'); this.t0Context = snapshotContext(obs); }

    // --- (a) story change
    const sig = storySignature(obs);
    if (this.storySig !== undefined && sig !== this.storySig) {
      this.storySig = sig; this.reset(now, 'story-change'); this.t0Context = snapshotContext(obs);
      return this.#idle(now, 'story-change');
    }
    this.storySig = sig;

    // --- (b) physical progress, only when actually observed
    const progressObserved = obs.cgProgressSig !== undefined && obs.cgProgressSig !== null;
    if (progressObserved) {
      if (this.progressSig !== undefined && obs.cgProgressSig !== this.progressSig) {
        this.progressSig = obs.cgProgressSig; this.reset(now, 'physical-progress-change'); this.t0Context = snapshotContext(obs);
        return this.#idle(now, 'physical-progress-change');
      }
      this.progressSig = obs.cgProgressSig;
    }

    // --- (c)(d)(e) body accumulation
    const p = vec(obs.playerPos); const a = vec(obs.workerPos); const sPos = vec(obs.shipPos);
    if (p) { this.playerAccum += d3(this.lastPlayer, p); this.lastPlayer = p; }
    if (a) { this.actorAccum += d3(this.lastActor, a); this.lastActor = a; }
    if (sPos) { this.shipAccum += d3(this.lastShip, sPos); this.lastShip = sPos; }

    if (this.playerAccum >= this.cfg.playerUnits) { this.reset(now, 'player-moved'); this.t0Context = snapshotContext(obs); return this.#idle(now, 'player-moved'); }
    if (this.actorAccum >= this.cfg.actorUnits) { this.reset(now, 'actor-moved'); this.t0Context = snapshotContext(obs); return this.#idle(now, 'actor-moved'); }
    if (obs.controlMode === 'flight' && this.shipAccum >= this.cfg.shipUnits) {
      this.reset(now, 'active-flight'); this.t0Context = snapshotContext(obs); return this.#idle(now, 'active-flight');
    }

    // --- required window, widened while the runtime declares its own hold
    const holding = obs.cgHoldReason != null && obs.cgHoldReason !== '';
    const required = holding ? this.cfg.windowMs * this.cfg.holdMultiplier : this.cfg.windowMs;
    const age = now - this.t0;
    if (age < required) return this.#idle(now, 'accumulating', { age, required });

    // --- suppression: intentional cue hold. Delays, never cancels.
    const cueActive = (obs.cueHoldUntilMs != null && obs.cueHoldUntilMs > now) || obs.captionActive === true;
    if (cueActive) {
      this.suppressions.push({ atMs: now, ageMs: age, reason: obs.captionActive === true ? 'caption-on-screen' : 'cue-hold-window' });
      return this.#idle(now, 'suppressed-by-cue-hold', { age, required });
    }

    this.fired = {
      verdict: 'FAIL-STALL',
      firedAtMs: now,
      windowStartedAtMs: this.t0,
      windowMs: age,
      requiredWindowMs: required,
      windowOpenedBecause: this.t0Reason,
      phase,
      playerMovedUnitsInWindow: round(this.playerAccum),
      actorMovedUnitsInWindow: round(this.actorAccum),
      shipMovedUnitsInWindow: round(this.shipAccum),
      thresholds: { playerUnits: this.cfg.playerUnits, actorUnits: this.cfg.actorUnits, shipUnits: this.cfg.shipUnits },
      storySignatureHeld: this.storySig,
      physicalProgressObserved: progressObserved,
      physicalProgressSignatureHeld: progressObserved ? this.progressSig : null,
      physicalProgressCaveat: progressObserved
        ? null
        : 'The CommonGround diagnostic was NOT exposed, so clause (b) could not be evaluated. This FAIL rests on story + body evidence only; it is a measured stagnation of everything observable, not a proof that no internal counter moved.',
      controlMode: obs.controlMode ?? null,
      contextAtWindowOpen: this.t0Context,
      contextAtFire: snapshotContext(obs),
      cueSuppressionsBeforeFire: this.suppressions.slice(-10),
      isSuccess: false,
      note: 'A stall FAIL is a measurement of stagnation. It is never a pass, never a checkpoint, and no rescue, nudge, teleport or progress grant was performed.'
    };
    return { fired: true, verdict: 'FAIL-STALL', report: this.fired, windowMs: age };
  }

  #idle(now, reason, extra = {}) {
    this.lastIdleReason = reason;
    return { fired: false, verdict: null, report: null, windowMs: (now != null && this.t0 != null) ? now - this.t0 : null, reason, ...extra };
  }

  /** Serialisable state for the probe summary — honest even when nothing fired. */
  describe() {
    return {
      enabled: this.cfg.enabled,
      config: { ...this.cfg, phases: [...this.cfg.phases] },
      fired: this.fired,
      lastIdleReason: this.lastIdleReason ?? null,
      openWindowMsAtEnd: null,
      resetsObserved: this.resets.length,
      recentResets: this.resets.slice(-20),
      cueSuppressions: this.suppressions.slice(-20),
      predicate: 'FAIL when, for a continuous window >= windowMs (x holdMultiplier while the runtime reports its own holdReason), NONE of story state, CommonGround physical-progress signature, player body (>= playerUnits), actor body (>= actorUnits) or an actively moving ship (>= shipUnits in flight controlMode) changed, while the phase is in scope and no deliberate manual wait was declared.',
      limits: [
        'Sample-rate bound: motion smaller than the pose quantum (1e-2 player, 1e-2/1e-1 worker) between samples is invisible and can read as stagnation.',
        'When the CommonGround diagnostic is not exposed, internal route/cursor progress is unobservable; the FAIL then covers only what could be observed and says so.',
        'A cue hold or caption suppresses firing but does not reset the clock, so a cue that never ends still fails — just later.',
        'A genuinely slow legitimate approach that moves under playerUnits per window would be a false FAIL; widen --stall-fail-ms rather than relaxing --stall-units.',
        'The phase label comes from the probe (e.g. autopilot routeAction), not from the chapter; a mislabelled phase can put the predicate out of scope and hide a real stall.',
        'It cannot distinguish "wedged" from "waiting for a player input the probe was never asked to send". Manual lanes must pass --manual-hold windows or leave the predicate off.'
      ]
    };
  }
}

function snapshotContext(obs) {
  return {
    atMs: obs?.atMs ?? null,
    beat: obs?.beat ?? null,
    objectiveId: obs?.objectiveId ?? null,
    markerLabel: obs?.markerLabel ?? null,
    anchorId: obs?.anchorId ?? null,
    phase: obs?.phase ?? null,
    playerPos: vec(obs?.playerPos),
    workerPos: vec(obs?.workerPos),
    controlMode: obs?.controlMode ?? null,
    cgHoldReason: obs?.cgHoldReason ?? null
  };
}

const round = (n) => Math.round(n * 1000) / 1000;
