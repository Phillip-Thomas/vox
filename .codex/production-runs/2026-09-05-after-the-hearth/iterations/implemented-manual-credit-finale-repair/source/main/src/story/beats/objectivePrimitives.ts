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

// --- Chapter 13, Common Ground ------------------------------------------------------
//
// The seventeen signed rungs, spelled exactly as the frozen scene contract
// spells them. Sentence case is deliberate and is the contract's, not a slip:
// ch1-ch12 shout in REGULATION CAPITALS because a feed is talking; ch13 is the
// first chapter in which the work order is her own note to herself.
//
// Two rungs carry a PREPARATION variant under the SAME id. `ch13:survey:test`
// and `ch13:common:reciprocal` are both entered at an anchor that precedes the
// physical fact they describe — he is offered the span before he has walked to
// it, and the reciprocal work order enters before he is actually holding H. The
// signed acceptance criteria forbid claiming either fact early, so the standing
// order states the truth at each edge while the id, the marker label and the
// single entry acknowledgement stay exactly as signed.
export type Ch13HomeObjectiveState = 'review' | 'choose-return';
export type Ch13ReturnObjectiveState =
  | 'board'
  | 'launch'
  | 'origin'
  | 'origin-disembark'
  | 'origin-on-foot';
export type Ch13SurveyObjectiveState =
  | 'offer'
  | 'start'
  | 'draw'
  | 'offer-span'
  | 'test-preparing'
  | 'test'
  | 'revise'
  | 'witness'
  | 'witness-return';
export type Ch13CommonObjectiveState =
  | 'reciprocal-preparing'
  | 'reciprocal'
  | 'offer-final-reference'
  | 'release'
  | 'reference-return';

/**
 * The literal physical cause of a hold, in the exact words the contract fixes.
 * `REFERENCE OCCLUDED · SURVEY HOUSING` keeps its middle dot; it is quoted
 * copy, not a formatting choice.
 */
export const CH13_HOLD_REASON_TEXT = Object.freeze({
  'reference-out-of-range': 'REFERENCE OUT OF RANGE',
  'reference-occluded-survey-housing': 'REFERENCE OCCLUDED \u00b7 SURVEY HOUSING',
  'reference-occluded-other-solid': 'REFERENCE OCCLUDED \u00b7 SOLID IN THE WAY',
  'footing-invalid': 'UNSAFE FOOTING',
  'reference-vacant': 'REFERENCE VACANT'
} as const);

export type Ch13HoldReasonId = keyof typeof CH13_HOLD_REASON_TEXT;


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
  ch13HomeState: Ch13HomeObjectiveState;
  ch13ReturnState: Ch13ReturnObjectiveState;
  ch13SurveyState: Ch13SurveyObjectiveState;
  ch13CommonState: Ch13CommonObjectiveState;
  /** Null unless a hold is ACTUALLY outstanding; a voluntary revision has none. */
  ch13HoldReason: Ch13HoldReasonId | null;
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
    ch10TransitState: 'reboard',
    ch13HomeState: 'review',
    ch13ReturnState: 'board',
    ch13SurveyState: 'offer',
    // The reciprocal rung defaults to preparation: nobody is holding anything
    // until the live world says the worker has arrived at H.
    ch13CommonState: 'reciprocal-preparing',
    ch13HoldReason: null
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

// --- Chapter 13 rungs ---------------------------------------------------------------

export function ch13HomeObjective(state: Ch13HomeObjectiveState): GuidedStoryObjective {
  switch (state) {
    case 'review':
      return objective(
        'ch13:home:review',
        'interact',
        'Second hearth \u00b7 unfinished audit',
        ['Return to the working hearth.', '[F] Review the stored audit fault.']
      );
    case 'choose-return':
      return objective(
        'ch13:home:choose-return',
        'interact',
        'Second hearth \u00b7 choose the return',
        ['[F] Choose to revisit the Origin audit site. You can leave this open.']
      );
  }
}

export function ch13ReturnObjective(state: Ch13ReturnObjectiveState): GuidedStoryObjective {
  switch (state) {
    case 'board':
      return objective(
        'ch13:return:board',
        'interact',
        'Kestrel hatch \u00b7 board',
        ['Follow the hatch marker.', '[F] Board the Kestrel.']
      );
    case 'launch':
      // CONTROL-ONLY, TARGET NONE. The player already occupies the surface this
      // addresses, so there is no world target and no coordinate is invented;
      // the bracket token is the held [Space] control, and it stays that.
      return objective(
        'ch13:return:launch',
        'interact',
        'Kestrel controls \u00b7 lift',
        ['Hold [Space] to ignite and lift.'],
        false
      );
    // THREE PHASES OF ONE TRAVEL RUNG, under ONE id and ONE marker label.
    //
    // The signed scene-v3 amendment to `/guidance/objectives/4` binds the copy
    // to the actual state of the trip: the flight order while she is flying it,
    // disembarkation once the ship is actually down at Origin, and the walk to
    // the marker once she is back on her own feet. `Origin \u00b7 audit site` and
    // `ch13:return:origin` are the same in all three, so the standing order is
    // replaced silently \u2014 no second entry acknowledgement, no score event, no
    // extra input, no arrival credit. The rung still clears only at
    // `anc.cg.origin-landed`, which needs the physical reach of W-7744.
    case 'origin':
      return objective(
        'ch13:return:origin',
        'travel',
        'Origin \u00b7 audit site',
        ['Fly to Origin.', 'Follow the audit-site approach and land.']
      );
    case 'origin-disembark':
      // Landed at the audit site, still holding the flight controls. The
      // shipped disembark control owns the transition; this only names it.
      return objective(
        'ch13:return:origin',
        'travel',
        'Origin \u00b7 audit site',
        ['Disembark.', 'Follow the audit-site marker on foot.']
      );
    case 'origin-on-foot':
      // Embodied on the surface of Origin, walking to W-7744. One line: the
      // disembarkation it used to name has already happened.
      return objective(
        'ch13:return:origin',
        'travel',
        'Origin \u00b7 audit site',
        ['Follow the audit-site marker on foot.']
      );
  }
}

export function ch13SurveyObjective(
  state: Ch13SurveyObjectiveState,
  holdReason: Ch13HoldReasonId | null = null
): GuidedStoryObjective {
  switch (state) {
    case 'offer':
      return objective(
        'ch13:survey:offer',
        'interact',
        'W-7744 \u00b7 offer a route',
        ['Approach W-7744.', '[F] Offer to demonstrate a route.']
      );
    case 'start':
      return objective(
        'ch13:survey:start',
        'interact',
        'Survey start \u00b7 begin a route',
        ['Walk to the survey start.', '[F] Begin recording your route.']
      );
    case 'draw':
      return objective(
        'ch13:survey:draw',
        'interact',
        'Survey end \u00b7 demonstrate a route',
        ['Walk your route to the survey end.', '[F] Offer the recorded span.']
      );
    case 'offer-span':
      return objective(
        'ch13:survey:offer-span',
        'interact',
        'Trace end \u00b7 offer this span',
        ['[F] Offer the walked span for W-7744 to test.']
      );
    case 'test-preparing':
      // He has accepted the offer and is walking to the start of the span. The
      // standing order must not yet say he is testing it.
      //
      // EXACT v2 COPY (`scene-contract.json#/guidance/objectives/9/variantIntent`).
      // "preparing to test" stays true through a body-clearance suspension, when
      // "is walking" would be false, and the second line carries the clearance
      // guidance without naming a new input or a new destination.
      return objective(
        'ch13:survey:test',
        'travel',
        'W-7744 \u00b7 offered route',
        [
          'W-7744 is preparing to test the offered route.',
          'Keep his approach clear. Follow his progress, or return to the last tested point to revise.'
        ]
      );
    case 'test':
      return objective(
        'ch13:survey:test',
        'travel',
        // NEUTRAL, AND THE SAME IN BOTH STATES. The old "test in progress" label
        // asserted progress that the preparing state does not have, and a label
        // that changes with the copy would make the silent in-place replacement
        // read as a new objective.
        'W-7744 \u00b7 offered route',
        [
          'W-7744 is testing the offered route.',
          'Follow his progress, or return to the last tested point to revise.'
        ]
      );
    case 'revise':
      return objective(
        'ch13:survey:revise',
        'interact',
        'Last tested point \u00b7 revise route',
        holdReason
          ? [
              'Return to the last tested point.',
              '[F] Reopen the untested span and walk a new route.',
              CH13_HOLD_REASON_TEXT[holdReason]
            ]
          : ['Return to the last tested point.', '[F] Reopen the untested span and walk a new route.']
      );
    case 'witness':
      return objective(
        'ch13:survey:witness',
        'interact',
        'Witness point \u00b7 hold this end',
        [
          'Stand at the marked reference.',
          '[F] Offer this end, then remain here while W-7744 tests the span. Looking around is free.'
        ]
      );
    case 'witness-return':
      return objective(
        'ch13:survey:witness-return',
        'travel',
        'Witness point \u00b7 resume the test',
        [
          'Return to the marked reference to resume the test.',
          'To change the route, return to the last tested point.'
        ]
      );
  }
}

export function ch13CommonObjective(state: Ch13CommonObjectiveState): GuidedStoryObjective {
  switch (state) {
    case 'reciprocal-preparing':
      // ENTERS AT anc.cg.route-tested, in preparation. The holding claim, the
      // guide and any comparison credit are never published before his actual
      // arrival at H. The marker is already C and stays C: preparation
      // introduces no clearance target and no [F].
      return objective(
        'ch13:common:reciprocal',
        'travel',
        'Far reference \u00b7 check my route',
        [
          'W-7744 is taking up the reference position.',
          'Give him room to reach it. When the guide appears, follow it from the survey end.'
        ]
      );
    case 'reciprocal':
      // "Guide line", not "traced span": the common E-to-C line is a planned,
      // unverified comparison, and she has never walked it. Only the survey
      // trace behind her is walked evidence.
      return objective(
        'ch13:common:reciprocal',
        'travel',
        'Far reference \u00b7 check my route',
        ['W-7744 is holding the reference.', 'Walk the guide line to check your route from this end.']
      );
    case 'offer-final-reference':
      return objective(
        'ch13:common:offer-final-reference',
        'interact',
        'Far reference \u00b7 offer this end',
        ['Stand at the far reference, clear of the tested span.', '[F] Offer this end.']
      );
    case 'release':
      // WAIT is the honest classification: the required act is genuinely
      // remaining in place while another body does the thing being tested.
      return objective(
        'ch13:common:release',
        'wait',
        'Far reference \u00b7 keep this end',
        ['Remain at the far reference while W-7744 tests the span. Looking around is free.']
      );
    case 'reference-return':
      return objective(
        'ch13:common:reference-return',
        'travel',
        'Far reference \u00b7 resume the test',
        [
          'Return to the far reference, clear of the tested span, to resume the test. '
            + 'Looking around is free.'
        ]
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
