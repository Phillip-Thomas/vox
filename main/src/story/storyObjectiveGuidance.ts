import type { StoryBeat } from './storyState.ts';
import type { GuidedStoryObjective } from './ux/objectiveDirector.ts';

/**
 * Pure authoring contract for the chapters that pre-date the shared objective
 * HUD, plus Chapter 8. Runtime systems provide facts; this module only decides
 * what the player should be able to read and find next.
 */

export type StoryObjectiveBeatDisposition = 'objective' | 'cinematic';

/**
 * Every beat in the authored scope is deliberately classified. A cinematic
 * entry is an intentional quiet frame, not an objective resolver omission.
 */
export const STORY_OBJECTIVE_GUIDANCE_CLASSIFICATION = {
  'ch1-fixed': 'objective',
  'ch1-track': 'objective',
  'ch1-raster': 'objective',
  'ch1-depth': 'objective',
  'ch1-nav': 'objective',
  'ch1-iso': 'objective',
  'ch1-lift': 'objective',
  'ch1-anomaly': 'objective',
  'a1-ramp': 'cinematic',
  'ch2-color': 'objective',
  'ch2-approach': 'objective',
  'a2-awakening': 'cinematic',
  'ch3-gather': 'objective',
  'ch3-dusk': 'cinematic',
  'ch3-await-rest': 'objective',
  'a3-dawn': 'cinematic',
  'ch3-thirst': 'objective',
  'ch3-forage': 'objective',
  'ch3-signal': 'objective',
  'ch4-vigil': 'objective',
  'ch4-arrival': 'cinematic',
  'ch4-audit': 'objective',
  'ch4-comply': 'objective',
  'ch4-defy': 'objective',
  'a4-exhale': 'cinematic',
  'ch8-launch': 'objective',
  'ch8-crossing': 'objective',
  'ch8-landfall': 'objective'
} as const satisfies Partial<Record<StoryBeat, StoryObjectiveBeatDisposition>>;

export type StoryObjectiveGuidanceBeat = keyof typeof STORY_OBJECTIVE_GUIDANCE_CLASSIFICATION;

type KeysWithValue<
  RecordType extends Record<PropertyKey, unknown>,
  Value
> = {
  [Key in keyof RecordType]: RecordType[Key] extends Value ? Key : never
}[keyof RecordType];

export type StoryObjectiveAuthoredBeat = KeysWithValue<
  typeof STORY_OBJECTIVE_GUIDANCE_CLASSIFICATION,
  'objective'
>;

export type GatherObjectiveStage =
  | 'materials'
  | 'hatchet'
  | 'pickaxe'
  | 'flint'
  | 'biofuel'
  | 'campfire';

export type RestObjectivePhase = 'wait-for-night' | 'rest-at-fire';
export type VigilObjectivePhase = 'remain-at-wreck' | 'observe-sky' | 'rest-at-fire';
export type AuditObjectiveStage = 'fire' | 'life' | 'tree' | 'complete';
export type ComplianceObjectiveStage = 'fire' | 'organics' | 'complete';
export type DefianceObjectiveStage = 'test-maw' | 'refuse' | 'complete';
export type Ch8LaunchObjectiveState = 'surface-flight' | 'launching' | 'deep-space';
export type Ch8CrossingObjectiveState = 'acquire-sibling' | 'hold-course' | 'approach-envelope';
export type Ch8LandfallObjectiveState = 'descent' | 'surface-flight' | 'surface-fps';

/**
 * Presentation facts only. None of these values is evidence that gameplay
 * completed; the owning story/economy/flight authorities remain authoritative.
 */
export interface StoryObjectiveGuidanceFacts {
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
}

export const DEFAULT_STORY_OBJECTIVE_GUIDANCE_FACTS: Readonly<StoryObjectiveGuidanceFacts> =
  Object.freeze({
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
    ch8LandfallState: 'descent'
  });

type ObjectiveResolver = (
  facts: Readonly<StoryObjectiveGuidanceFacts>
) => GuidedStoryObjective;

const OBJECTIVE_RESOLVERS = {
  'ch1-fixed': () => objective(
    'ch1:fixed:calibrate-extractor',
    'interact',
    'BIOFIBER · CALIBRATE EXTRACTOR',
    ['HARVEST BIOFIBER.', 'HOLD [E] TO EXTRACT.'],
    false
  ),
  'ch1-track': () => objective(
    'ch1:track:tracking-transfer',
    'wait',
    'TRACKING VIEW · CALIBRATING',
    ['TRACKING VIEW IS REASSIGNING.', 'HOLD POSITION.'],
    false
  ),
  'ch1-raster': () => objective(
    'ch1:raster:recover-quota',
    'interact',
    'SITE QUOTA · RECOVER MATERIALS',
    ['RECOVER HULL DEBRIS AND COMPLETE THE SITE QUOTA.', 'HOLD [E] TO EXTRACT.'],
    false
  ),
  'ch1-depth': () => objective(
    'ch1:depth:recover-supply-pods',
    'interact',
    'SUPPLY POD',
    ['FOLLOW THE NEXT SUPPLY POD MARKER.', 'RECOVER THE SUPPLY POD.']
  ),
  'ch1-nav': facts => {
    const markerLabel = `TRIANGULATION ${facts.navWaypointIndex + 1}/${facts.navWaypointCount}`;
    return objective(
      `ch1:nav:triangulation-${facts.navWaypointIndex + 1}-of-${facts.navWaypointCount}`,
      'travel',
      markerLabel,
      ['FOLLOW THE ACTIVE TRIANGULATION MARKER.', 'ENTER THE TRIANGULATION POINT.']
    );
  },
  'ch1-iso': () => objective(
    'ch1:iso:reach-signal-source',
    'travel',
    'SIGNAL SOURCE',
    ['FOLLOW THE SIGNAL SOURCE MARKER.', 'ASCEND TO THE SUMMIT.']
  ),
  'ch1-lift': () => objective(
    'ch1:lift:perspective-transfer',
    'wait',
    'FIRST-PERSON LINK · CALIBRATING',
    ['PERSPECTIVE TRANSFER IS ACTIVE.', 'HOLD POSITION.'],
    false
  ),
  'ch1-anomaly': facts => facts.anomalyDesignated
    ? objective(
        'ch1:anomaly:classify-mass',
        'interact',
        'UNCHARTED MASS',
        ['FOLLOW THE UNCHARTED MASS MARKER.', '[F] TOUCH THE MASS.']
      )
    : objective(
        'ch1:anomaly:calibrate-pan-tilt',
        'interact',
        'PAN-TILT SURVEY · CALIBRATE',
        ['SURVEY THE FULL PERIMETER.', 'LOOK ACROSS EVERY HEADING.'],
        false
      ),
  'ch2-color': () => objective(
    'ch2:color:approach-redaction',
    'travel',
    'REDACTED SUBJECT',
    ['FOLLOW THE REDACTED SUBJECT INDICATOR.', 'APPROACH THE SUBJECT.']
  ),
  'ch2-approach': () => objective(
    'ch2:approach:eat-fruit',
    'interact',
    'REDACTED SUBJECT · FRUIT',
    ['APPROACH THE FRUIT AT HAND HEIGHT.', '[F] EAT.']
  ),
  'ch3-gather': facts => gatherObjective(facts.gatherStage),
  'ch3-await-rest': facts => facts.restPhase === 'rest-at-fire'
    ? objective(
        'ch3:rest:rest-at-fire',
        'interact',
        'CAMPFIRE · REST',
        ['RETURN TO THE CAMPFIRE.', '[F] REST.']
      )
    : objective(
        'ch3:rest:wait-for-night',
        'wait',
        'CAMPFIRE · WAIT FOR NIGHT',
        ['REMAIN NEAR THE CAMPFIRE.', 'WAIT FOR NIGHT.']
      ),
  'ch3-thirst': () => objective(
    'ch3:thirst:drink-water',
    'interact',
    'DRINKABLE WATER',
    ['FOLLOW THE WATER MARKER.', 'LOOK AT THE WATER AND [F] DRINK.']
  ),
  'ch3-forage': facts => forageObjective(facts),
  'ch3-signal': () => objective(
    'ch3:signal:report-to-wreck',
    'travel',
    'THE WRECK',
    ['FOLLOW THE WRECK MARKER.', 'SPRINT TO THE RELAY.']
  ),
  'ch4-vigil': facts => vigilObjective(facts.vigilPhase),
  'ch4-audit': facts => auditObjective(facts.auditStage),
  'ch4-comply': facts => complianceObjective(facts.complianceStage),
  'ch4-defy': facts => defianceObjective(facts.defianceStage),
  'ch8-launch': facts => launchObjective(facts.ch8LaunchState),
  'ch8-crossing': facts => crossingObjective(facts.ch8CrossingState),
  'ch8-landfall': facts => landfallObjective(facts.ch8LandfallState)
} satisfies Record<StoryObjectiveAuthoredBeat, ObjectiveResolver>;

/** Returns the authored disposition without inferring one for unrelated beats. */
export function classifyStoryObjectiveGuidanceBeat(
  beat: StoryBeat
): StoryObjectiveBeatDisposition | 'outside-scope' {
  return STORY_OBJECTIVE_GUIDANCE_CLASSIFICATION[beat as StoryObjectiveGuidanceBeat]
    ?? 'outside-scope';
}

/**
 * Resolve the current HUD/marker contract without reading or mutating runtime
 * state. Unknown beats and explicitly cinematic beats intentionally return null.
 */
export function resolveStoryObjectiveGuidance(
  beat: StoryBeat,
  input: Readonly<Partial<StoryObjectiveGuidanceFacts>> = {}
): GuidedStoryObjective | null {
  const disposition = classifyStoryObjectiveGuidanceBeat(beat);
  if (disposition !== 'objective') return null;
  const resolver = OBJECTIVE_RESOLVERS[beat as StoryObjectiveAuthoredBeat];
  return resolver(normalizeFacts(input));
}

function normalizeFacts(
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

function gatherObjective(stage: GatherObjectiveStage): GuidedStoryObjective {
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

function forageObjective(
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
    'interact',
    'EDIBLE FRUIT',
    ['FOLLOW THE FOOD SOURCE MARKER.', '[F] GATHER FRUIT.']
  );
}

function vigilObjective(phase: VigilObjectivePhase): GuidedStoryObjective {
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

function auditObjective(stage: AuditObjectiveStage): GuidedStoryObjective {
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

function complianceObjective(stage: ComplianceObjectiveStage): GuidedStoryObjective {
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

function defianceObjective(stage: DefianceObjectiveStage): GuidedStoryObjective {
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

function launchObjective(state: Ch8LaunchObjectiveState): GuidedStoryObjective {
  switch (state) {
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

function crossingObjective(state: Ch8CrossingObjectiveState): GuidedStoryObjective {
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

function landfallObjective(state: Ch8LandfallObjectiveState): GuidedStoryObjective {
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

function objective(
  id: string,
  kind: GuidedStoryObjective['kind'],
  markerLabel: string,
  workOrder: readonly string[],
  requiresMarker = true
): GuidedStoryObjective {
  return { id, kind, markerLabel, workOrder, requiresMarker };
}

function finite(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
