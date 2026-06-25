import { getLocalActorId, type ActorId } from '../playerActors.ts';

// --- Survival vitals (Primitive era) -----------------------------------------
//
// The worker's body reasserting itself against the construct: five meters, 0..100.
// Module-singleton mirroring mawSystem (let state + Set listeners + emit). The HUD
// POLLS the getters via rAF, so passive decay does NOT emit — only discrete events
// (eat/drink/damage/death) do, which keeps the debounced autosave from firing every
// frame. Persistence treats vitals as GLOBAL (see persistence.ts).
//
// Phase-1 scope: gentle, NON-LETHAL decay (hunger/thirst drift down slowly; no health
// damage yet). Warmth is held full until the temperature model lands. Stamina drives
// sprint. Satisfiers (food/water) + lethality come in the next slices.

export interface VitalsState {
  health: number;
  hunger: number;
  thirst: number;
  warmth: number;
  stamina: number;
  oxygen: number;
}

const MAX = 100;
const DEFAULT_VITALS: VitalsState = { health: MAX, hunger: MAX, thirst: MAX, warmth: MAX, stamina: MAX, oxygen: MAX };

export interface ActorVitalsState {
  vitals: VitalsState;
  exhausted: boolean; // stamina hit 0 — must recover past a threshold before sprinting again
}

export type VitalsSnapshot = Record<ActorId, ActorVitalsState>;

const actors = new Map<ActorId, ActorVitalsState>();

const listeners = new Set<() => void>();
function emit() { listeners.forEach(l => l()); }

function actorKey(actorId?: ActorId): ActorId {
  return actorId ?? getLocalActorId();
}

function cloneVitals(vitals: VitalsState): VitalsState {
  return { ...vitals };
}

function stateFor(actorId?: ActorId): ActorVitalsState {
  const key = actorKey(actorId);
  let state = actors.get(key);
  if (!state) {
    state = { vitals: cloneVitals(DEFAULT_VITALS), exhausted: false };
    actors.set(key, state);
  }
  return state;
}

// --- Balance (gentle; centralized + tunable) ---------------------------------
// Per-second rates. Hunger ~15 min to empty, thirst ~10 min — visible but never
// urgent yet (no satisfiers + non-lethal this phase).
const HUNGER_DECAY = MAX / (15 * 60);
const THIRST_DECAY = MAX / (10 * 60);
const HEALTH_REGEN = MAX / (4 * 60);   // slow heal while well-fed + hydrated
const WELL_FED = MAX * 0.5;            // hunger+thirst above this → passive health regen
const STAMINA_DRAIN = MAX / 8;         // ~8s of sprint from full
const STAMINA_REGEN = MAX / 6;         // ~6s to refill
const STAMINA_RECOVER = MAX * 0.3;     // after exhaustion, recover to 30% before sprinting again
const OXYGEN_DRAIN = MAX / 60;         // ~60s of breath from full underwater
const OXYGEN_REGEN = MAX / 6;          // ~6s to refill (≈4× faster than drain)
const DROWN_DAMAGE = 8;               // health per second when breath runs out

const clamp = (n: number) => Math.max(0, Math.min(MAX, n));

export function getVitals(actorId?: ActorId): VitalsState { return cloneVitals(stateFor(actorId).vitals); }
export function getStamina(actorId?: ActorId): number { return stateFor(actorId).vitals.stamina; }
export function isStaminaExhausted(actorId?: ActorId): boolean { return stateFor(actorId).exhausted; }

export function subscribeVitals(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Passive decay tick (real dt). Only decays when `active` (on-foot, surface, playing).
 *  Silent (no emit) — the HUD polls. */
export function tickVitals(dt: number, active: boolean, actorId?: ActorId): void {
  if (!active || !Number.isFinite(dt) || dt <= 0) return;
  const v = stateFor(actorId).vitals;
  v.hunger = clamp(v.hunger - HUNGER_DECAY * dt);
  v.thirst = clamp(v.thirst - THIRST_DECAY * dt);
  // warmth: no temperature model yet → held full (next slice).
  // health: NON-LETHAL for now → no starvation/dehydration damage; gentle regen when fed.
  if (v.hunger > WELL_FED && v.thirst > WELL_FED && v.health < MAX) {
    v.health = clamp(v.health + HEALTH_REGEN * dt);
  }
}

/** Can the player sprint right now? (Not exhausted + has stamina.) */
export function canSprint(actorId?: ActorId): boolean {
  const state = stateFor(actorId);
  return !state.exhausted && state.vitals.stamina > 0;
}

/** Drain (sprinting) or regen (otherwise) stamina each physics step. Silent. */
export function applyStamina(dt: number, sprinting: boolean, actorId?: ActorId): void {
  if (!Number.isFinite(dt) || dt <= 0) return;
  const state = stateFor(actorId);
  const v = state.vitals;
  if (sprinting) {
    v.stamina = clamp(v.stamina - STAMINA_DRAIN * dt);
    if (v.stamina <= 0) state.exhausted = true;
  } else {
    v.stamina = clamp(v.stamina + STAMINA_REGEN * dt);
    if (state.exhausted && v.stamina >= STAMINA_RECOVER) state.exhausted = false;
  }
}

/** Drain (submerged) or regen (surface) oxygen each physics step. Silent.
 *  When oxygen bottoms out underwater, drains health at DROWN_DAMAGE/s — non-lethal
 *  by design; the player has time to scramble to the surface. */
export function tickOxygen(dt: number, submerged: boolean, actorId?: ActorId): void {
  if (!Number.isFinite(dt) || dt <= 0) return;
  const v = stateFor(actorId).vitals;
  if (submerged) {
    v.oxygen = clamp(v.oxygen - OXYGEN_DRAIN * dt);
    if (v.oxygen <= 0) {
      // Drowning: drain health but never kill outright (clamp floor is 0)
      v.health = clamp(v.health - DROWN_DAMAGE * dt);
    }
  } else {
    v.oxygen = clamp(v.oxygen + OXYGEN_REGEN * dt);
  }
}

// --- Satisfiers (discrete events — emit so the HUD/persistence react) ---------
/** Eat: restore hunger (and a little thirst for juicy foods). */
export function feed(hunger: number, water = 0, actorId?: ActorId): void {
  const v = stateFor(actorId).vitals;
  v.hunger = clamp(v.hunger + hunger);
  if (water) v.thirst = clamp(v.thirst + water);
  emit();
}

/** Drink: restore thirst. */
export function drink(amount: number, actorId?: ActorId): void {
  const v = stateFor(actorId).vitals;
  v.thirst = clamp(v.thirst + amount);
  emit();
}

// --- Save/restore (global persistence) ---------------------------------------
/** Restore from a save (clamped). Emits. Oxygen defaults to MAX when absent
 *  (old saves pre-date the field; don't strand a returning player at 0). */
export function setVitals(s: Partial<VitalsState>, actorId?: ActorId): void {
  const state = stateFor(actorId);
  const current = state.vitals;
  state.vitals = {
    health: clamp(s.health ?? current.health),
    hunger: clamp(s.hunger ?? current.hunger),
    thirst: clamp(s.thirst ?? current.thirst),
    warmth: clamp(s.warmth ?? current.warmth),
    stamina: clamp(s.stamina ?? current.stamina),
    oxygen: clamp(s.oxygen ?? MAX)
  };
  state.exhausted = state.vitals.stamina <= 0;
  emit();
}

/** Full reset to healthy (new game / respawn baseline). Emits. */
export function resetVitals(actorId?: ActorId): void {
  const state = stateFor(actorId);
  state.vitals = cloneVitals(DEFAULT_VITALS);
  state.exhausted = false;
  emit();
}

export function resetAllVitals(): void {
  actors.clear();
  emit();
}

export function getVitalsSnapshot(): VitalsSnapshot {
  const out: VitalsSnapshot = {};
  for (const [actorId, state] of actors) {
    out[actorId] = { vitals: cloneVitals(state.vitals), exhausted: state.exhausted };
  }
  return out;
}

export function applyVitalsSnapshot(snapshot: VitalsSnapshot, options: { replace?: boolean } = {}): void {
  if (options.replace ?? true) actors.clear();
  for (const [actorId, state] of Object.entries(snapshot) as [ActorId, ActorVitalsState][]) {
    actors.set(actorId, { vitals: cloneVitals(state.vitals), exhausted: state.exhausted });
  }
  emit();
}
