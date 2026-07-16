import { getLocalActorId, type ActorId } from '../game/playerActors.ts';
import { getItemCount } from '../game/systems/inventorySystem.ts';
import { attendObservation } from '../game/systems/observationLedger.ts';
import { hasMilestone, markMilestone } from '../game/systems/progressionSystem.ts';
import {
  commitStoryOxygenOnline,
  isStoryOxygenOnline
} from './emergentCapabilities.ts';
import { emitEmergentStoryEvent } from './emergentStoryEvents.ts';
import {
  acquireEmergentUniqueItem,
  acquireEmergentUniqueItemAuthoritatively,
  bankKestrelKeelMemory,
  bankKestrelKeelMemoryAuthoritatively,
  EMERGENT_UNIQUE_ITEM_MILESTONES
} from './emergentUniqueItems.ts';
import type { CommandContext } from '../game/commands.ts';
import type { GuidedStoryObjective } from './ux/objectiveDirector.ts';

export const AUTHORED_DIVE_MILESTONES = {
  waterlineEntered: 'story:dive:waterline-entered',
  oxygen75: 'story:dive:oxygen-75',
  oxygen50: 'story:dive:oxygen-50',
  oxygen25: 'story:dive:oxygen-25',
  keelSonarRevealed: 'story:dive:keel-sonar-revealed',
  surfacedWithKeel: 'story:dive:surfaced-with-keel'
} as const;

/** Optional interpretation receipt; Story progression must never read it. */
export const AUTHORED_DIVE_TWO_CLOCKS_OBSERVATION_ID = 'observation:dive:two-clocks';

export const AUTHORED_DIVE_ENTER_SUBMERGENCE = 0.55;
export const AUTHORED_DIVE_EXIT_SUBMERGENCE = 0.2;
export const AUTHORED_DIVE_MAX_SHORE_BANK_DISTANCE = 4.2;
export const AUTHORED_DIVE_KEEL_FREE_SECONDS = 1.6;
export const AUTHORED_DIVE_AUTHORITY_RETRY_SECONDS = 5;
const OXYGEN_THRESHOLDS = [75, 50, 25] as const;

/** One copy source for the objective store and the shared marker renderer. */
export function getAuthoredDiveGuidance(
  actorId: ActorId = getLocalActorId()
): GuidedStoryObjective {
  if (hasMilestone(EMERGENT_UNIQUE_ITEM_MILESTONES.keelMemoryBanked, actorId)) {
    return {
      id: 'dive:shore-handoff',
      kind: 'wait',
      markerLabel: 'KEEL MEMORY · SECURED',
      workOrder: ['KEEL MEMORY SECURED.', 'BREATHE. LET THE SHORE RETURN.'],
      requiresMarker: false
    };
  }
  if (
    hasMilestone(EMERGENT_UNIQUE_ITEM_MILESTONES.keelMemory, actorId)
    && !hasMilestone(AUTHORED_DIVE_MILESTONES.surfacedWithKeel, actorId)
  ) {
    return {
      id: 'dive:surface-with-keel',
      kind: 'travel',
      markerLabel: 'WATERLINE · SURFACE WITH KEEL',
      workOrder: [
        'CARRY THE KEEL MEMORY THROUGH THE WATERLINE.',
        'IF RECOVERY MOVED YOU TO SHORE, RE-ENTER THE WATER AND SURFACE.'
      ]
    };
  }
  return hasMilestone(EMERGENT_UNIQUE_ITEM_MILESTONES.keelMemory, actorId)
    ? {
        id: 'dive:return-to-shore',
        kind: 'travel',
        markerLabel: 'DRY SHORE · SECURE KEEL MEMORY',
        workOrder: ['FOLLOW THE DRY SHORE MARKER.', 'RETURN THE KEEL MEMORY TO DRY GROUND.']
      }
    : {
        id: 'dive:recover-keel-memory',
        kind: 'interact',
        markerLabel: 'KEEL MEMORY',
        workOrder: ['FOLLOW THE KEEL MEMORY MARKER BELOW.', 'INTERACT TO RECOVER THE KEEL MEMORY.']
      };
}

interface DiveRuntime {
  submerged: boolean;
  oxygen: number;
  /** Latched only by a continuous authored wet-to-dry body transition. */
  physicalWaterlineExitObserved: boolean;
}

export interface DiveShoreBankEvidence {
  feetInWater: boolean;
  physicallySupported: boolean;
  shoreDistance: number;
}

export interface KestrelKeelFreeingState {
  active: boolean;
  elapsedSeconds: number;
  readyToCommit: boolean;
  authorityWaitSeconds: number;
}

export function createKestrelKeelFreeingState(): KestrelKeelFreeingState {
  return { active: false, elapsedSeconds: 0, readyToCommit: false, authorityWaitSeconds: 0 };
}

export function beginKestrelKeelFreeing(): KestrelKeelFreeingState {
  return { active: true, elapsedSeconds: 0, readyToCommit: false, authorityWaitSeconds: 0 };
}

/** Cancel-safe physical hold; foreground/pause filtering belongs to the caller. */
export function advanceKestrelKeelFreeing(
  state: KestrelKeelFreeingState,
  deltaSeconds: number,
  physicallyEligible: boolean
): KestrelKeelFreeingState {
  if (!state.active || state.readyToCommit) return state;
  if (!physicallyEligible) return createKestrelKeelFreeingState();
  const elapsedSeconds = Math.min(
    AUTHORED_DIVE_KEEL_FREE_SECONDS,
    state.elapsedSeconds + Math.max(0, Number.isFinite(deltaSeconds) ? deltaSeconds : 0)
  );
  return {
    active: elapsedSeconds < AUTHORED_DIVE_KEEL_FREE_SECONDS,
    elapsedSeconds,
    readyToCommit: elapsedSeconds >= AUTHORED_DIVE_KEEL_FREE_SECONDS,
    authorityWaitSeconds: 0
  };
}

/** Give an online authority acknowledgement a bounded foreground-time window. */
export function advanceKestrelKeelAuthorityWait(
  state: KestrelKeelFreeingState,
  deltaSeconds: number,
  acknowledged: boolean
): KestrelKeelFreeingState {
  if (!state.readyToCommit || acknowledged) return state;
  const authorityWaitSeconds = state.authorityWaitSeconds
    + Math.max(0, Number.isFinite(deltaSeconds) ? deltaSeconds : 0);
  return authorityWaitSeconds >= AUTHORED_DIVE_AUTHORITY_RETRY_SECONDS
    ? createKestrelKeelFreeingState()
    : { ...state, authorityWaitSeconds };
}

export interface AuthoredDiveTickInput {
  /** True only while the contracted dive scene owns the medium. */
  authored: boolean;
  submergence: number;
  oxygen: number;
  worldId?: string;
  actorId?: ActorId;
}

const runtimeByActor = new Map<ActorId, DiveRuntime>();

/**
 * Converts the live swim/oxygen simulation into stable Story evidence. It does
 * not move the player, forgive oxygen, or award the Keel: medium crossings and
 * threshold receipts remain consequences of the actual body state.
 */
export function tickAuthoredDive(input: AuthoredDiveTickInput): void {
  const actorId = input.actorId ?? getLocalActorId();
  const submergence = clamp01(input.submergence);
  const oxygen = clamp100(input.oxygen);
  const previous = runtimeByActor.get(actorId) ?? {
    submerged: false,
    oxygen: 100,
    physicalWaterlineExitObserved: false
  };

  if (!input.authored) {
    runtimeByActor.set(actorId, {
      submerged: submergence >= AUTHORED_DIVE_ENTER_SUBMERGENCE,
      oxygen,
      physicalWaterlineExitObserved: false
    });
    return;
  }

  const submerged = previous.submerged
    ? submergence > AUTHORED_DIVE_EXIT_SUBMERGENCE
    : submergence >= AUTHORED_DIVE_ENTER_SUBMERGENCE;
  const exitedWaterlineThisTick = !submerged && previous.submerged;
  const physicalWaterlineExitObserved = previous.physicalWaterlineExitObserved
    || exitedWaterlineThisTick;

  if (submerged && !previous.submerged) {
    if (!hasMilestone(AUTHORED_DIVE_MILESTONES.waterlineEntered, actorId)) {
      markMilestone(AUTHORED_DIVE_MILESTONES.waterlineEntered, actorId);
      emitEmergentStoryEvent({
        id: `story:dive:${actorId}:waterline-entered`,
        type: 'submersion_changed',
        actorId,
        worldId: input.worldId,
        payload: { submerged: true, amount: submergence }
      });
    }
    if (commitStoryOxygenOnline(actorId)) {
      // HUD knowledge arrives with the first meaningful authored submersion,
      // never from an incidental pre-scene wade.
      markMilestone('story:sense:oxygen', actorId);
    }
  }

  if (exitedWaterlineThisTick) {
    emitEmergentStoryEvent({
      id: `story:dive:${actorId}:waterline-exited`,
      type: 'submersion_changed',
      actorId,
      worldId: input.worldId,
      payload: { submerged: false, amount: submergence }
    });
  }

  // Reconcile on every continuous post-exit surface frame, not only the edge. A
  // multiplayer item acknowledgement can arrive just after the body crosses
  // the waterline. A reload or reset deliberately clears the in-memory exit
  // latch, so safe-spawn relocation can never impersonate embodied surfacing.
  if (
    !submerged
    && physicalWaterlineExitObserved
    && hasMilestone(AUTHORED_DIVE_MILESTONES.waterlineEntered, actorId)
    && getItemCount('kestrel_keel_memory', actorId) > 0
    && !hasMilestone(AUTHORED_DIVE_MILESTONES.surfacedWithKeel, actorId)
  ) {
    markMilestone(AUTHORED_DIVE_MILESTONES.surfacedWithKeel, actorId);
    emitEmergentStoryEvent({
      id: `story:dive:${actorId}:surfaced-with-keel`,
      type: 'dive_surfaced',
      actorId,
      worldId: input.worldId,
      payload: { oxygen }
    });
  }

  if (isStoryOxygenOnline(actorId)) {
    for (const threshold of OXYGEN_THRESHOLDS) {
      const milestone = thresholdMilestone(threshold);
      if (
        previous.oxygen > threshold
        && oxygen <= threshold
        && !hasMilestone(milestone, actorId)
      ) {
        markMilestone(milestone, actorId);
        emitEmergentStoryEvent({
          id: `story:dive:${actorId}:oxygen-${threshold}`,
          type: 'oxygen_threshold',
          actorId,
          worldId: input.worldId,
          payload: { oxygen, threshold, direction: 'falling' }
        });
        if (threshold === 75 && submerged) {
          recordTwoClocksObservation(actorId, input.worldId, oxygen, submergence);
        }
      }
    }
  }

  runtimeByActor.set(actorId, { submerged, oxygen, physicalWaterlineExitObserved });
}

export function acquireKestrelKeelFromDive(
  eventId: string,
  submergence: number,
  actorId?: ActorId,
  commandContext?: CommandContext
): boolean {
  const actor = actorId ?? getLocalActorId();
  if (
    !hasMilestone(AUTHORED_DIVE_MILESTONES.keelSonarRevealed, actor)
    || getItemCount('iron_maw', actor) <= 0
    || clamp01(submergence) < AUTHORED_DIVE_ENTER_SUBMERGENCE
  ) return false;
  if (commandContext) {
    return acquireEmergentUniqueItemAuthoritatively(
      commandContext,
      'kestrel_keel_memory',
      eventId
    ).ok;
  }
  return acquireEmergentUniqueItem('kestrel_keel_memory', eventId, actor).ok;
}

/** The repaired Maw localizes the Keel once its physical response is visible.
 * Oxygen remains a survival signal, never a navigation or progress gate. */
export function commitKeelSonarReveal(
  physicalSonarVisible: boolean,
  distance: number,
  submergence: number,
  cameraAlignment: number,
  worldId?: string,
  actorId?: ActorId
): boolean {
  const actor = actorId ?? getLocalActorId();
  if (hasMilestone(AUTHORED_DIVE_MILESTONES.keelSonarRevealed, actor)) return true;
  if (
    !physicalSonarVisible
    || !Number.isFinite(distance)
    || distance < 0
    || distance > 18
    || clamp01(submergence) < AUTHORED_DIVE_ENTER_SUBMERGENCE
    || !Number.isFinite(cameraAlignment)
    || cameraAlignment < 0.75
  ) return false;
  markMilestone(AUTHORED_DIVE_MILESTONES.keelSonarRevealed, actor);
  emitEmergentStoryEvent({
    id: `story:dive:${actor}:keel-revealed`,
    type: 'keel_revealed',
    actorId: actor,
    worldId,
    payload: {
      source: 'repaired-maw-sonar',
      structuralPinVisible: true,
      distance
    }
  });
  return true;
}

export function bankSurfacedKestrelKeel(
  eventId: string,
  oxygen: number,
  submergence: number,
  actorId?: ActorId,
  commandContext?: CommandContext,
  shoreEvidence?: DiveShoreBankEvidence
): boolean {
  const actor = actorId ?? getLocalActorId();
  if (clamp01(submergence) > AUTHORED_DIVE_EXIT_SUBMERGENCE) return false;
  if (!isSupportedDryDiveBankEvidence(shoreEvidence)) return false;
  if (!hasMilestone(AUTHORED_DIVE_MILESTONES.surfacedWithKeel, actor)) return false;
  if (!hasMilestone(EMERGENT_UNIQUE_ITEM_MILESTONES.keelMemory, actor)) return false;
  if (commandContext) {
    return bankKestrelKeelMemoryAuthoritatively(commandContext, eventId, oxygen).ok;
  }
  return bankKestrelKeelMemory(eventId, oxygen, actor).ok;
}

export function isSupportedDryDiveBankEvidence(
  evidence: DiveShoreBankEvidence | undefined
): evidence is DiveShoreBankEvidence {
  return Boolean(
    evidence
    && evidence.feetInWater === false
    && evidence.physicallySupported === true
    && Number.isFinite(evidence.shoreDistance)
    && evidence.shoreDistance >= 0
    && evidence.shoreDistance <= AUTHORED_DIVE_MAX_SHORE_BANK_DISTANCE
  );
}

/**
 * Call before any teleport, respawn, or safe-position correction. The next dry
 * sample becomes initialization, never a forged wet-to-dry Story transition.
 */
export function invalidateAuthoredDiveMotionContinuity(actorId?: ActorId): void {
  runtimeByActor.delete(actorId ?? getLocalActorId());
}

export function resetAuthoredDiveRuntime(): void {
  runtimeByActor.clear();
}

function thresholdMilestone(threshold: typeof OXYGEN_THRESHOLDS[number]): string {
  if (threshold === 75) return AUTHORED_DIVE_MILESTONES.oxygen75;
  if (threshold === 50) return AUTHORED_DIVE_MILESTONES.oxygen50;
  return AUTHORED_DIVE_MILESTONES.oxygen25;
}

function recordTwoClocksObservation(
  actorId: ActorId,
  rawWorldId: string | undefined,
  oxygen: number,
  submergence: number
): void {
  const worldId = rawWorldId?.trim();
  if (!worldId) return;
  const eventId = `story:dive:${actorId}:${worldId}:two-clocks-observed`;
  const recorded = attendObservation(
    AUTHORED_DIVE_TWO_CLOCKS_OBSERVATION_ID,
    {
      id: `${eventId}:evidence`,
      worldId,
      sourceKey: 'sc.dive.two-clocks',
      data: {
        oxygen,
        oxygenThreshold: 75,
        submergence,
        worldClockSignal: 'underwater-harmonic-stretch',
        bodyClockSignal: 'oxygen-pulse-accelerating'
      }
    },
    { id: `${eventId}:attend` },
    actorId
  );
  if (!recorded) return;
  emitEmergentStoryEvent({
    id: eventId,
    type: 'observation_recorded',
    actorId,
    worldId,
    payload: {
      observationId: AUTHORED_DIVE_TWO_CLOCKS_OBSERVATION_ID,
      revisionKind: 'attend'
    }
  });
}

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

function clamp100(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
}
