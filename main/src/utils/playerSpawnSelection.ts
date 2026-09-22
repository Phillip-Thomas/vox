// Spawn precedence for the on-foot controller at scene hydration.
//
// A Continue restores two independent things: the saved player pose and the
// persisted parked ship. Both are legitimate. The bug this module owns is that
// a non-null persisted parked ship used to win unconditionally, so a session
// saved while walking anywhere on the planet re-entered at the ship's egress
// pad instead of where the player actually stopped.
//
// Precedence is therefore scoped to *provenance*, not to "save beats ship":
// only the ship pose that was rehydrated from persistence at mount yields to a
// restored saved on-foot pose, and only until the player actually uses the ship
// again. A real boarding/flight/landing this session marks the restore spent,
// so every later disembark owns its current lawful egress.

/** How the scene's initial on-foot position was obtained at mount. */
export type InitialPlayerSpawnSource =
  /** Continue taken while in flight: pose restored from the system runtime. */
  | 'system-restore'
  /** Approach cinematic entry. */
  | 'approach'
  /** Authored Chapter 6 dive reload recovery. */
  | 'authored-dive-recovery'
  /** Matching saved on-foot pose, safe exactly as serialized. */
  | 'saved-pose'
  /** Matching saved on-foot pose relocated by the safe-spawn validator. */
  | 'saved-pose-validated'
  /** No usable saved pose: canonical arrival pad. */
  | 'arrival';

/**
 * The two saved on-foot sources that carry restore precedence. Both have
 * already passed the scene's existing safety validation: `saved-pose` was dry
 * and clear as serialized, `saved-pose-validated` was relocated to a valid site
 * near the save. A save that failed validation outright falls back to
 * `'arrival'` and deliberately carries no precedence.
 */
export const SAVED_ON_FOOT_SPAWN_SOURCES = [
  'saved-pose',
  'saved-pose-validated'
] as const satisfies readonly InitialPlayerSpawnSource[];

export function isSavedOnFootSpawnSource(
  source: InitialPlayerSpawnSource
): boolean {
  return (SAVED_ON_FOOT_SPAWN_SOURCES as readonly InitialPlayerSpawnSource[])
    .includes(source);
}

/** Where the currently known landed ship pose came from. */
export type LandedShipProvenance =
  /** No landed/parked ship pose is known. */
  | 'none'
  /** Rehydrated from persistence when the scene mounted. */
  | 'persisted-parked'
  /** Produced by this session: an actual landing or story boarding transfer. */
  | 'session';

export interface PlayerSpawnLifecycleInputs {
  initialSpawnSource: InitialPlayerSpawnSource;
  landedShipProvenance: LandedShipProvenance;
  /**
   * True once the player has actually taken the ship in this session. Monotonic
   * — it must never fall back to false, or a stale restore could re-latch after
   * a lawful egress.
   */
  shipEgressClaimed: boolean;
}

export type PlayerSpawnChoice =
  /** Keep the restored saved on-foot pose over a merely persisted parked ship. */
  | 'restored-saved-on-foot'
  /** Leave the ship this session parked where it is and step out beside it. */
  | 'ship-egress'
  /** No ship pose at all: the scene's own initial position. */
  | 'initial';

/**
 * Decide which spawn the on-foot controller should hydrate with.
 *
 * Ship egress remains the default whenever a ship pose exists, exactly as
 * before. The single new outcome is `restored-saved-on-foot`, which requires
 * all three of: a safety-validated saved on-foot pose, a ship pose that is only
 * persisted (not earned this session), and no ship egress claimed yet.
 */
export function selectPlayerSpawnChoice(
  inputs: PlayerSpawnLifecycleInputs
): PlayerSpawnChoice {
  const { initialSpawnSource, landedShipProvenance, shipEgressClaimed } = inputs;
  if (landedShipProvenance === 'none') return 'initial';
  if (
    landedShipProvenance === 'persisted-parked'
    && !shipEgressClaimed
    && isSavedOnFootSpawnSource(initialSpawnSource)
  ) return 'restored-saved-on-foot';
  return 'ship-egress';
}

export interface PlayerSpawnCandidates<TPosition> {
  /** The scene's initial on-foot position for `initialSpawnSource`. */
  initial: TPosition;
  /** Resolved player-clearance egress beside the ship, null while unresolved. */
  shipEgress: TPosition | null;
  /** Canonical arrival pad, used when egress geometry is unavailable. */
  arrivalFallback: TPosition;
}

/**
 * Resolve the chosen spawn to a concrete position. Kept generic so the
 * lifecycle decision is testable without a physics or THREE fixture.
 */
export function resolvePlayerSpawnPosition<TPosition>(
  inputs: PlayerSpawnLifecycleInputs,
  candidates: PlayerSpawnCandidates<TPosition>
): TPosition {
  const choice = selectPlayerSpawnChoice(inputs);
  if (choice === 'ship-egress') {
    return candidates.shipEgress ?? candidates.arrivalFallback;
  }
  return candidates.initial;
}
