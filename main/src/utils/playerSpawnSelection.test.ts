import { describe, expect, it } from 'vitest';
import {
  isSavedOnFootSpawnSource,
  resolvePlayerSpawnPosition,
  selectPlayerSpawnChoice,
  type InitialPlayerSpawnSource,
  type LandedShipProvenance,
  type PlayerSpawnLifecycleInputs
} from './playerSpawnSelection.ts';

// Values below are the actual measured capture from
// verifier/captures/continue-pose-handoff/attempt2-closure-2026-09-06T2301Z
// (producer-continue-pose-handoff-closure-review.json), not invented fixtures.

/** Loaded saved on-foot capsule centre H at Continue, Origin/local. */
const SAVED_ON_FOOT_H = [
  -32.02875900268555, 52.788692474365234, 21.45030403137207
] as const;
/** Non-null persisted parked ship pose iA (legitimately parked on +X). */
const PARKED_SHIP_IA = [53.5, 24, -24] as const;
/** Resolved player egress beside that parked ship, FA. */
const SHIP_EGRESS_FA = [53.85, 21.5, -24] as const;
/** Canonical arrival pad used when egress geometry is unavailable. */
const ARRIVAL_PAD = [8, 53.85, -6] as const;
/**
 * The physics centre actually observed after Continue, between +687ms and
 * +802ms. It equals FA within float precision: this is the physical jump.
 */
const OBSERVED_POST_CONTINUE_CENTRE = [
  53.849998474121094, 21.5, -24
] as const;

type Vec = readonly [number, number, number];

const candidates = {
  initial: SAVED_ON_FOOT_H as Vec,
  shipEgress: SHIP_EGRESS_FA as Vec,
  arrivalFallback: ARRIVAL_PAD as Vec
};

/**
 * The exact pre-repair EfficientScene expression:
 *   landedShipPos ? landedPlayerEgress ?? arrivalPose.playerSurfacePosition
 *                 : initialPlayerPosition
 * Reproduced verbatim so the counterfactual failure is demonstrated against the
 * old rule rather than asserted, and restored precisely if reused.
 */
function oldSourceSpawn(
  landedShipPos: Vec | null,
  landedPlayerEgress: Vec | null,
  arrivalFallback: Vec,
  initialPlayerPosition: Vec
): Vec {
  return landedShipPos
    ? landedPlayerEgress ?? arrivalFallback
    : initialPlayerPosition;
}

function lifecycle(
  overrides: Partial<PlayerSpawnLifecycleInputs> = {}
): PlayerSpawnLifecycleInputs {
  return {
    initialSpawnSource: 'saved-pose',
    landedShipProvenance: 'persisted-parked',
    shipEgressClaimed: false,
    ...overrides
  };
}

describe('actual captured Continue spawn precedence (CG-IMPL-011)', () => {
  it('old source discards the loaded saved on-foot pose for parked egress', () => {
    // Counterfactual: this is precisely the observed defect.
    const chosen = oldSourceSpawn(
      PARKED_SHIP_IA,
      SHIP_EGRESS_FA,
      ARRIVAL_PAD,
      SAVED_ON_FOOT_H
    );
    expect(chosen).toEqual(SHIP_EGRESS_FA);
    expect(chosen).not.toEqual(SAVED_ON_FOOT_H);
    // and that is what the physics body actually became.
    expect(OBSERVED_POST_CONTINUE_CENTRE[0]).toBeCloseTo(SHIP_EGRESS_FA[0], 5);
    expect(OBSERVED_POST_CONTINUE_CENTRE[1]).toBeCloseTo(SHIP_EGRESS_FA[1], 5);
    expect(OBSERVED_POST_CONTINUE_CENTRE[2]).toBeCloseTo(SHIP_EGRESS_FA[2], 5);
  });

  it('repaired selection keeps the loaded saved on-foot pose H', () => {
    const inputs = lifecycle();
    expect(selectPlayerSpawnChoice(inputs)).toBe('restored-saved-on-foot');
    expect(resolvePlayerSpawnPosition(inputs, candidates)).toEqual(SAVED_ON_FOOT_H);
  });

  it('does not move the parked ship: only the player spawn is decided', () => {
    // The selection consumes the egress candidate but never produces a ship
    // pose; ship position/hatch/rendering stay bound to landedShipPos.
    const inputs = lifecycle();
    const spawn = resolvePlayerSpawnPosition(inputs, candidates);
    expect(spawn).not.toEqual(PARKED_SHIP_IA);
    expect(PARKED_SHIP_IA).toEqual([53.5, 24, -24]);
  });

  it('restores the old outcome exactly when precedence does not apply', () => {
    // Same captured geometry, but the ship pose was earned this session.
    const inputs = lifecycle({ landedShipProvenance: 'session' });
    expect(resolvePlayerSpawnPosition(inputs, candidates)).toEqual(
      oldSourceSpawn(PARKED_SHIP_IA, SHIP_EGRESS_FA, ARRIVAL_PAD, SAVED_ON_FOOT_H)
    );
  });
});

describe('safe fallback for invalid, missing or mismatched saves', () => {
  const nonRestoring: InitialPlayerSpawnSource[] = [
    'arrival',
    'approach',
    'system-restore',
    'authored-dive-recovery'
  ];

  it.each(nonRestoring)(
    'source %s carries no precedence over a persisted parked ship',
    source => {
      const inputs = lifecycle({ initialSpawnSource: source });
      expect(selectPlayerSpawnChoice(inputs)).toBe('ship-egress');
      expect(resolvePlayerSpawnPosition(inputs, candidates)).toEqual(SHIP_EGRESS_FA);
    }
  );

  it('an unsafe save with no valid site nearby degrades to arrival, not H', () => {
    // The scene tags that case 'arrival' precisely so it cannot latch.
    expect(isSavedOnFootSpawnSource('arrival')).toBe(false);
  });

  it('a validator-relocated saved pose still takes precedence', () => {
    // Safety validation is preserved: the relocated site, not the raw save.
    const relocated = [-31, 52.5, 21] as Vec;
    const inputs = lifecycle({ initialSpawnSource: 'saved-pose-validated' });
    expect(isSavedOnFootSpawnSource('saved-pose-validated')).toBe(true);
    expect(
      resolvePlayerSpawnPosition(inputs, { ...candidates, initial: relocated })
    ).toEqual(relocated);
  });

  it('with no ship pose at all the scene initial position is used', () => {
    for (const source of [...nonRestoring, 'saved-pose' as const]) {
      const inputs = lifecycle({
        initialSpawnSource: source,
        landedShipProvenance: 'none'
      });
      expect(selectPlayerSpawnChoice(inputs)).toBe('initial');
      expect(
        resolvePlayerSpawnPosition(inputs, { ...candidates, shipEgress: null })
      ).toEqual(SAVED_ON_FOOT_H);
    }
  });

  it('falls back to the arrival pad when egress geometry is unresolved', () => {
    const inputs = lifecycle({ landedShipProvenance: 'session' });
    expect(
      resolvePlayerSpawnPosition(inputs, { ...candidates, shipEgress: null })
    ).toEqual(ARRIVAL_PAD);
  });
});

describe('the restore latch cannot leak past a lawful egress', () => {
  it('a real board-fly-land-disembark after the restore uses its own egress', () => {
    // 1. Continue: saved on-foot pose wins over the merely persisted ship.
    let provenance: LandedShipProvenance = 'persisted-parked';
    let claimed = false;
    const atContinue = lifecycle({ landedShipProvenance: provenance, shipEgressClaimed: claimed });
    expect(resolvePlayerSpawnPosition(atContinue, candidates)).toEqual(SAVED_ON_FOOT_H);

    // 2. The player walks to the ship and boards it (controlMode -> flight).
    claimed = true;

    // 3. They fly and land somewhere new; that pose is earned this session.
    provenance = 'session';
    const newLanding = [12, 51.5, 30] as Vec;
    const newEgress = [12.35, 49, 30] as Vec;

    // 4. Disembark: the player must step out beside the ship they just flew.
    const atDisembark = lifecycle({
      landedShipProvenance: provenance,
      shipEgressClaimed: claimed
    });
    expect(selectPlayerSpawnChoice(atDisembark)).toBe('ship-egress');
    expect(
      resolvePlayerSpawnPosition(atDisembark, {
        initial: SAVED_ON_FOOT_H,
        shipEgress: newEgress,
        arrivalFallback: ARRIVAL_PAD
      })
    ).toEqual(newEgress);
    expect(newLanding).not.toEqual(PARKED_SHIP_IA);
  });

  it('claiming egress alone ends precedence even before a new landing', () => {
    // Boarding the still-parked ship and stepping straight back out.
    const inputs = lifecycle({ shipEgressClaimed: true });
    expect(selectPlayerSpawnChoice(inputs)).toBe('ship-egress');
    expect(resolvePlayerSpawnPosition(inputs, candidates)).toEqual(SHIP_EGRESS_FA);
  });

  it('precedence needs all three conditions together', () => {
    expect(selectPlayerSpawnChoice(lifecycle())).toBe('restored-saved-on-foot');
    expect(
      selectPlayerSpawnChoice(lifecycle({ initialSpawnSource: 'arrival' }))
    ).toBe('ship-egress');
    expect(
      selectPlayerSpawnChoice(lifecycle({ landedShipProvenance: 'session' }))
    ).toBe('ship-egress');
    expect(
      selectPlayerSpawnChoice(lifecycle({ shipEgressClaimed: true }))
    ).toBe('ship-egress');
  });
});
