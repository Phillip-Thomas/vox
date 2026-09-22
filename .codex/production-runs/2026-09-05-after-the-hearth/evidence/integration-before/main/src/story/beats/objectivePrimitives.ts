import type { GuidedStoryObjective } from '../ux/objectiveDirector.ts';

/**
 * Pure authoring contract for the chapters that pre-date the shared objective
 * HUD, plus Chapter 8. Runtime systems provide facts; this module only decides
 * what the player should be able to read and find next.
 */

export type StoryObjectiveBeatDisposition = 'objective' | 'cinematic';

export type GatherObjectiveStage =
  | 'materials'
  | 'hatchet'
  | 'pickaxe'
  | 'flint'
  | 'biofuel'
  | 'campfire';

/**
 * `ch1-fixed` advances on TWO conditions (storyDirector: biofiber quota AND
 * `fixedCells.size >= CH1_FIXED_TUTORIAL.screens`), but for a long time it
 * published a single immutable objective that only ever named the harvest.
 * A player who filled the fiber quota was then left reading `HARVEST BIOFIBER`
 * against a ledger reading `SCREENS 1/2` — a term defined nowhere in the
 * chapter — with no marker, no nudge and no director-side fallback. That state
 * was permanent, and it is the first playable beat in the game.
 *
 * Splitting the rung is what guardrail 1 in `ux/README.md` already required:
 * the id changes when the required player ACTION changes.
 */
export type Ch1FixedObjectiveState = 'salvage' | 'harvest' | 'traverse';

/**
 * `ch1-raster` advances on a THREE-way conjunction (`quotaCollected().met`:
 * biofiber quota AND stone quota AND every scattered debris piece), and it too
 * published a single immutable rung naming only the debris.
 *
 * The trap is measurable and reproducible. The first three debris pieces carry
 * 2+1+1 stone — exactly the stone quota — so a player who follows the debris
 * brackets completes stone and debris together and is left with only fiber
 * outstanding, while the standing order still tells them to recover hull
 * debris they have already recovered.
 *
 * A headless manual-input probe then found the second half: extraction held
 * from a STANDING position exhausts the biofiber within reach and stalls at
 * 4/6 permanently. Only holding the extract key WHILE WALKING finishes the
 * quota, and no copy in the chapter said so.
 */
export type Ch1RasterObjectiveState = 'salvage' | 'quota';

export type RestObjectivePhase = 'wait-for-night' | 'rest-at-fire';
export type VigilObjectivePhase = 'remain-at-wreck' | 'observe-sky' | 'rest-at-fire';
export type AuditObjectiveStage = 'fire' | 'life' | 'tree' | 'complete';
export type ComplianceObjectiveStage = 'fire' | 'organics' | 'complete';
export type DefianceObjectiveStage = 'test-maw' | 'refuse' | 'complete';
export type Ch8LaunchObjectiveState = 'surface-on-foot' | 'surface-flight' | 'launching' | 'deep-space';
export type Ch8CrossingObjectiveState = 'acquire-sibling' | 'hold-course' | 'approach-envelope';
export type Ch8LandfallObjectiveState = 'descent' | 'surface-flight' | 'surface-fps';
/** C1 → C2. The fault is read, then carried to a fabricator that refuses it. */
export type Ch10ColdObjectiveState = 'fault-read' | 'fabrication-attempt';
/**
 * A1 → A4 then the rite. The return crossing reuses the ch8 ladder's shape
 * rung for rung — deliberate reuse, in the opposite direction.
 */
export type Ch10AskObjectiveState =
  | 'reboard'
  | 'crossing'
  | 'landfall'
  | 'relay-query'
  | 'bearing-claim';
/**
 * The boarding rung, then T1 → T3. The claim is performed on foot at the relay,
 * so the beat opens with a locator to the Kestrel; `ignite` is state-derived and
 * only ever reached once the player is aboard, which is why `HOLD [SPACE]` can
 * never be shown to a player standing on the ground (it renders as the jetpack
 * glyph there). Only `reboard` and `hold` carry markers.
 */
export type Ch10TransitObjectiveState = 'reboard' | 'ignite' | 'hold' | 'resolve';

/**
 * Presentation facts only. None of these values is evidence that gameplay
 * completed; the owning story/economy/flight authorities remain authoritative.
 */
export interface StoryObjectiveGuidanceFacts {
  maw: { kit: boolean; repaired: boolean; direction: boolean; resonance: boolean;
    ritual: { phase: 'idle' | 'repairing' | 'ready' | 'committed'; directionAvailable: boolean } };
  dive: { banked: boolean; recovered: boolean; surfaced: boolean };
  reconstruction: { diagnosed: boolean; calibrated: boolean;
    target: import('../emergentCapabilities.ts').ShipRepairStage | null;
    action: { verb: string } | null; craftLabel: string };
  boarding: { phase: import('../physicalBoarding.ts').PhysicalBoardingState['phase']; inputMode: 'keyboard' | 'touch' };
  settlement: { scanned: boolean; attended: boolean; coreCarried: boolean; foundationPlaced: boolean;
    night: boolean; chosen: boolean; habitat: { shelterCertification?: unknown } | null };
  secondHearthComplete: boolean;
  ch1FixedState: Ch1FixedObjectiveState;
  ch1RasterState: Ch1RasterObjectiveState;
  anomalyDesignated: boolean;
  navWaypointIndex: number;
  navWaypointCount: number;
  gatherStage: GatherObjectiveStage;
  restPhase: RestObjectivePhase;
  forageHasEdible: boolean;
  forageAte: boolean;
  vigilPhase: VigilObjectivePhase;
  auditStage: AuditObjectiveStage;
  complianceStage: ComplianceObjectiveStage;
  defianceStage: DefianceObjectiveStage;
  ch8LaunchState: Ch8LaunchObjectiveState;
  ch8CrossingState: Ch8CrossingObjectiveState;
  ch8LandfallState: Ch8LandfallObjectiveState;
  ch10ColdState: Ch10ColdObjectiveState;
  ch10AskState: Ch10AskObjectiveState;
  ch10TransitState: Ch10TransitObjectiveState;
}

export const DEFAULT_STORY_OBJECTIVE_GUIDANCE_FACTS: Readonly<StoryObjectiveGuidanceFacts> =
  Object.freeze({
    maw: { kit: false, repaired: false, direction: false, resonance: false, ritual: { phase: 'idle' as const, directionAvailable: false } },
    dive: { banked: false, recovered: false, surfaced: false },
    reconstruction: { diagnosed: false, calibrated: false, target: 'bench_online' as const, action: null, craftLabel: 'INSTALL KEEL WORKBENCH' },
    boarding: { phase: 'idle' as const, inputMode: 'keyboard' as const },
    settlement: { scanned: false, attended: false, coreCarried: false, foundationPlaced: false, night: false, chosen: false, habitat: null },
    secondHearthComplete: false,
    ch1FixedState: 'salvage',
    ch1RasterState: 'salvage',
    anomalyDesignated: false,
    navWaypointIndex: 0,
    navWaypointCount: 3,
    gatherStage: 'materials',
    restPhase: 'wait-for-night',
    forageHasEdible: false,
    forageAte: false,
    vigilPhase: 'remain-at-wreck',
    auditStage: 'fire',
    complianceStage: 'fire',
    defianceStage: 'test-maw',
    ch8LaunchState: 'surface-flight',
    ch8CrossingState: 'acquire-sibling',
    ch8LandfallState: 'descent',
    ch10ColdState: 'fault-read',
    ch10AskState: 'reboard',
    // The beat is entered on foot at the wreck relay, so its default rung is the
    // locator, not the cockpit input.
    ch10TransitState: 'reboard'
  });

export type ObjectiveResolver = (
  facts: Readonly<StoryObjectiveGuidanceFacts>
) => GuidedStoryObjective;

/** Shared pure presentation adapter for both beat declarations and gameplay views.
 * Keep runtime state imports out of this module: importing a full beat from a
 * state system can initialize its input policy before inputPrimitives is ready.
 */
export function resolveAuthoredObjective(
  authored: (facts: Readonly<StoryObjectiveGuidanceFacts>) => GuidedStoryObjective,
  input: Readonly<Partial<StoryObjectiveGuidanceFacts>>
): GuidedStoryObjective {
  const candidate = authored(normalizeFacts(input));
  return { ...candidate, requiresMarker: candidate.requiresMarker ?? true };
}

export function normalizeFacts(
  input: Readonly<Partial<StoryObjectiveGuidanceFacts>>
): Readonly<StoryObjectiveGuidanceFacts> {
  const navWaypointCount = Math.max(
    1,
    Math.trunc(finite(input.navWaypointCount, DEFAULT_STORY_OBJECTIVE_GUIDANCE_FACTS.navWaypointCount))
  );
  const navWaypointIndex = Math.min(
    navWaypointCount - 1,
    Math.max(0, Math.trunc(finite(input.navWaypointIndex, DEFAULT_STORY_OBJECTIVE_GUIDANCE_FACTS.navWaypointIndex)))
  );
  return {
    ...DEFAULT_STORY_OBJECTIVE_GUIDANCE_FACTS,
    ...input,
    navWaypointIndex,
    navWaypointCount
  };
}

export function gatherObjective(stage: GatherObjectiveStage): GuidedStoryObjective {
  switch (stage) {
    case 'materials':
      return objective(
        'ch3:gather:collect-materials',
        'interact',
        'SURVIVAL MATERIALS',
        ['FIND WOOD, BIOFIBER, AND STONE.', 'HOLD [E] TO GATHER.']
      );
    case 'hatchet':
      return objective(
        'ch3:gather:craft-hatchet',
        'craft',
        'STONE HATCHET · CRAFT',
        ['OPEN THE FABRICATOR.', '[C] CRAFT A STONE HATCHET.'],
        false
      );
    case 'pickaxe':
      return objective(
        'ch3:gather:craft-pickaxe',
        'craft',
        'STONE PICKAXE · CRAFT',
        ['OPEN THE FABRICATOR.', '[C] CRAFT A STONE PICKAXE.'],
        false
      );
    case 'flint':
      return objective(
        'ch3:gather:recover-flint',
        'interact',
        'FLINT-BEARING STONE',
        ['FOLLOW THE STONE MARKER.', 'BREAK STONE TO RECOVER FLINT.']
      );
    case 'biofuel':
      return objective(
        'ch3:gather:craft-biofuel',
        'craft',
        'BIOFUEL · CRAFT',
        ['THE CAMPFIRE NEEDS PROCESSED FIBER.', '[C] CRAFT BIOFUEL.'],
        false
      );
    case 'campfire':
      return objective(
        'ch3:gather:craft-campfire',
        'craft',
        'CAMPFIRE · CRAFT',
        ['OPEN THE FABRICATOR.', '[C] CRAFT A CAMPFIRE.'],
        false
      );
  }
}

export function forageObjective(
  facts: Pick<StoryObjectiveGuidanceFacts, 'forageHasEdible' | 'forageAte'>
): GuidedStoryObjective {
  if (facts.forageAte) {
    return objective(
      'ch3:forage:first-meal-settling',
      'wait',
      'FIRST MEAL · SETTLING',
      ['THE FIRST MEAL IS COMPLETE.', 'LET THE MOMENT SETTLE.'],
      false
    );
  }
  if (facts.forageHasEdible) {
    return objective(
      'ch3:forage:eat-held-food',
      'interact',
      'HELD FOOD · EAT',
      ['FOOD IS READY IN INVENTORY.', '[G] EAT.'],
      false
    );
  }
  return objective(
    'ch3:forage:find-food',
    'travel',
    'EDIBLE FRUIT',
    ['FOLLOW THE FOOD SOURCE MARKER.', 'WALK THROUGH THE FRUIT TO GATHER IT.']
  );
}

export function vigilObjective(phase: VigilObjectivePhase): GuidedStoryObjective {
  switch (phase) {
    case 'remain-at-wreck':
      return objective(
        'ch4:vigil:remain-at-wreck',
        'wait',
        'WRECK RELAY · REMAIN',
        ['RETURN TO THE WRECK RELAY.', 'REMAIN UNTIL NIGHT.']
      );
    case 'observe-sky':
      return objective(
        'ch4:vigil:observe-night-sky',
        'interact',
        'NIGHT SKY · OBSERVE',
        ['THE SKY IS THE ONLY OPEN TASK.', 'LOOK UP AND HOLD YOUR GAZE.'],
        false
      );
    case 'rest-at-fire':
      return objective(
        'ch4:vigil:rest-at-fire',
        'interact',
        'CAMPFIRE · ORDERED REST',
        ['FOLLOW THE CAMPFIRE MARKER.', '[F] REST.']
      );
  }
}

export function auditObjective(stage: AuditObjectiveStage): GuidedStoryObjective {
  switch (stage) {
    case 'fire':
      return objective(
        'ch4:audit:attend-fire',
        'interact',
        'CAMPFIRE · ATTEND',
        ['FOLLOW W-7744 TO THE CAMPFIRE.', '[F] ATTEND THE FIRE MISMATCH.']
      );
    case 'life':
      return objective(
        'ch4:audit:attend-life',
        'interact',
        'POND SHORE · ATTEND',
        ['FOLLOW W-7744 TO THE POND.', '[F] ATTEND THE LIVING NOISE.']
      );
    case 'tree':
      return objective(
        'ch4:audit:attend-tree',
        'interact',
        'HERO TREE · ATTEND',
        ['FOLLOW W-7744 TO THE TREE.', '[F] ATTEND THE TREE MISMATCH.']
      );
    case 'complete':
      return objective(
        'ch4:audit:directive-settling',
        'wait',
        'AUDIT DIRECTIVE · RECEIVED',
        ['THE THREE MISMATCHES ARE RECORDED.', 'WAIT FOR THE DIRECTIVE.'],
        false
      );
  }
}

export function complianceObjective(stage: ComplianceObjectiveStage): GuidedStoryObjective {
  switch (stage) {
    case 'fire':
      return objective(
        'ch4:comply:douse-fire',
        'interact',
        'CAMPFIRE · DOUSE',
        ['FOLLOW THE CAMPFIRE MARKER.', '[F] DOUSE THE FIRE.']
      );
    case 'organics':
      return objective(
        'ch4:comply:resolve-organics',
        'interact',
        'WRECK RELAY · RESOLVE SAMPLES',
        ['RETURN TO THE WRECK RELAY.', '[F] RESOLVE ORGANIC SAMPLES.']
      );
    case 'complete':
      return objective(
        'ch4:comply:regression-settling',
        'wait',
        'VERIFIED FLOOR · SETTLING',
        ['THE ORDERED REGRESSION IS COMPLETE.', 'WAIT FOR THE NEXT DIRECTIVE.'],
        false
      );
  }
}

export function defianceObjective(stage: DefianceObjectiveStage): GuidedStoryObjective {
  switch (stage) {
    case 'test-maw':
      return objective(
        'ch4:defy:test-protected-tree',
        'interact',
        'HERO TREE · TEST MAW',
        ['FOLLOW THE TREE MARKER.', 'USE THE MAW ON THE PROTECTED TREE.']
      );
    case 'refuse':
      return objective(
        'ch4:defy:refuse-order',
        'interact',
        'HERO TREE · REFUSE',
        ['THE TREE REMAINS INTACT.', '[F] REFUSE.']
      );
    case 'complete':
      return objective(
        'ch4:defy:refusal-settling',
        'wait',
        'REFUSAL · COMMITTED',
        ['THE ORDER HAS BEEN REFUSED.', 'HOLD YOUR GROUND.'],
        false
      );
  }
}

export function launchObjective(state: Ch8LaunchObjectiveState): GuidedStoryObjective {
  switch (state) {
    case 'surface-on-foot':
      return objective(
        'ch8:launch:reboard',
        'travel',
        'KESTREL HATCH · REBOARD',
        ['RETURN TO THE KESTREL.', 'FOLLOW THE HATCH MARKER AND [F] BOARD.']
      );
    case 'surface-flight':
      return objective(
        'ch8:launch:ignite',
        'interact',
        'KESTREL FLIGHT CONTROLS · IGNITE',
        ['BRING THE KESTREL ONLINE.', 'HOLD [SPACE] TO IGNITE AND LIFT.'],
        false
      );
    case 'launching':
      return objective(
        'ch8:launch:climb',
        'travel',
        'ATMOSPHERIC EXIT · CLIMB',
        ['KEEP THE KESTREL ASCENDING.', 'HOLD COURSE THROUGH THE ATMOSPHERE.'],
        false
      );
    case 'deep-space':
      return objective(
        'ch8:launch:orbital-handoff',
        'wait',
        'DEEP SPACE · HANDOFF',
        ['ATMOSPHERIC EXIT IS COMPLETE.', 'LET THE SYSTEM RESOLVE.'],
        false
      );
  }
}

export function crossingObjective(state: Ch8CrossingObjectiveState): GuidedStoryObjective {
  switch (state) {
    case 'acquire-sibling':
      return objective(
        'ch8:crossing:acquire-sibling',
        'travel',
        'SIBLING WORLD',
        ['FIND THE SIBLING WORLD.', 'CENTER IT AND SET COURSE.']
      );
    case 'hold-course':
      return objective(
        'ch8:crossing:hold-course',
        'travel',
        'SIBLING WORLD · COURSE',
        ['FOLLOW THE SIBLING WORLD MARKER.', 'HOLD COURSE INTO ITS APPROACH ENVELOPE.']
      );
    case 'approach-envelope':
      return objective(
        'ch8:crossing:approach-envelope',
        'wait',
        'SIBLING WORLD · APPROACH',
        ['THE APPROACH ENVELOPE IS ACTIVE.', 'HOLD COURSE THROUGH THE HANDOFF.'],
        // Tidegarden is now the active enclosing world, so its companion-body
        // target has correctly left the system sky. This is a cockpit hold,
        // not a new destination search; do not fabricate a vanished marker.
        false
      );
  }
}

export function landfallObjective(state: Ch8LandfallObjectiveState): GuidedStoryObjective {
  switch (state) {
    case 'descent':
      return objective(
        'ch8:landfall:land-dry-level',
        'travel',
        'DRY LEVEL GROUND',
        ['READ THE SURFACE FOR A DRY, LEVEL SITE.', '[F] LAND ON DRY, LEVEL GROUND.'],
        false
      );
    case 'surface-flight':
      return objective(
        'ch8:landfall:exit-kestrel',
        'interact',
        'KESTREL HATCH · EXIT',
        ['THE KESTREL IS GROUNDED.', '[F] EXIT THE KESTREL.'],
        false
      );
    case 'surface-fps':
      return objective(
        'ch8:landfall:first-footfall',
        'wait',
        'SIBLING WORLD · FIRST FOOTFALL',
        ['STAND ON THE SIBLING WORLD.', 'LET IT HOLD YOUR WEIGHT.'],
        false
      );
  }
}

/**
 * Chapter 10's ladders. Every marker label and work-order line below is quoted
 * byte-for-byte from the frozen scene contract's guidance table; the runtime
 * objective ids keep their colons (the contract transposes them to hyphens only
 * because its own id schema forbids colons).
 */
export function ch10ColdObjective(state: Ch10ColdObjectiveState): GuidedStoryObjective {
  switch (state) {
    case 'fault-read':
      return objective(
        'station:fault-read',
        'interact',
        'HABITAT CORE · READ THE FAULT',
        // STAND, not RETURN: the order is issued while the player is already
        // inside the 12 m notice radius, so "return" lied at birth. This one is
        // true at entry and stays a valid instruction if she wanders first.
        ['STAND AT THE SECOND HEARTH CORE.', '[F] READ THE HEARTH FAULT.']
      );
    case 'fabrication-attempt':
      return objective(
        'station:fabrication-attempt',
        'craft',
        'KESTREL FABRICATOR · ATTEMPT REPLACEMENT',
        ['TAKE THE FAULT RECORD TO THE KESTREL FABRICATOR.', '[F] ATTEMPT TO FABRICATE A REPLACEMENT CELL.']
      );
  }
}

export function ch10AskObjective(state: Ch10AskObjectiveState): GuidedStoryObjective {
  switch (state) {
    case 'reboard':
      // Grammar identical to ch8:launch:reboard — deliberate reuse, and the
      // reason the crossing back reads as the same act in the other direction.
      return objective(
        'station:return:reboard',
        'travel',
        'KESTREL HATCH · REBOARD',
        ['RETURN TO THE KESTREL.', 'FOLLOW THE HATCH MARKER AND [F] BOARD.']
      );
    case 'crossing':
      return objective(
        'station:return:crossing',
        'travel',
        // ORIGIN, not FIRST: in caps on a HUD "FIRST WORLD" reads as
        // development-tier discourse, and it coined a third name for the place
        // ch8 already calls SIBLING WORLD. Label noun and order noun match
        // exactly, as every other rung's do.
        'ORIGIN WORLD · COURSE',
        ['FIND THE ORIGIN WORLD.', 'CENTER IT AND CROSS.']
      );
    case 'landfall':
      return objective(
        'station:return:landfall',
        'travel',
        'WRECK SITE · LAND',
        ['FOLLOW THE WRECK SITE MARKER DOWN.', 'LAND NEAR THE RELAY.']
      );
    case 'relay-query':
      return objective(
        'station:relay-query',
        'interact',
        'WRECK RELAY · REQUEST A SOURCE',
        ['FOLLOW THE WRECK RELAY MARKER.', '[F] REQUEST A SOURCE FOR A BONDED CELL.']
      );
    case 'bearing-claim':
      // The rite. It waits indefinitely and never acquires a timer, a nudge, or
      // an automated claim — the wait IS the meaning.
      return objective(
        'station:bearing-claim',
        'interact',
        'WRECK RELAY · CLAIM THE BEARING',
        ['A BEARING IS ATTACHED (ADVISORY).', '[F] CLAIM THE BEARING.']
      );
  }
}

export function ch10TransitObjective(state: Ch10TransitObjectiveState): GuidedStoryObjective {
  switch (state) {
    case 'reboard':
      // Grammar identical to ch8:launch:reboard and station:return:reboard —
      // boarding the Kestrel always looks the same. The marker resolves from the
      // ship's live pose, so the locator is honest wherever she landed.
      return objective(
        'station:transit:reboard',
        'travel',
        'KESTREL HATCH · REBOARD',
        ['RETURN TO THE KESTREL.', 'FOLLOW THE HATCH MARKER AND [F] BOARD.']
      );
    case 'ignite':
      return objective(
        'station:transit:ignite',
        'interact',
        'KESTREL FLIGHT CONTROLS · IGNITE',
        ['BRING THE KESTREL ONLINE.', 'HOLD [SPACE] TO IGNITE AND LIFT.'],
        false
      );
    case 'hold':
      return objective(
        'station:transit:hold',
        'travel',
        'ISSUED BEARING · HOLD',
        ['FLY THE CLAIMED BEARING.', 'FOLLOW IT UNTIL THE SOURCE RESOLVES.']
      );
    case 'resolve':
      // No marker: the cut line of the run is the first frame in which the
      // station exists with no guidance annotation, so this card clears to
      // nothing rather than handing the frame a chevron.
      return objective(
        'station:transit:resolve',
        'wait',
        'ISSUING STATION · RESOLVING',
        ['THE SOURCE IS RESOLVING.', 'HOLD.'],
        false
      );
  }
}

export function objective(
  id: string,
  kind: GuidedStoryObjective['kind'],
  markerLabel: string,
  workOrder: readonly string[],
  requiresMarker = true
): GuidedStoryObjective {
  return { id, kind, markerLabel, workOrder, requiresMarker };
}

export function finite(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
