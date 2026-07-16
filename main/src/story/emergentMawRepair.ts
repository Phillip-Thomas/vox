import type { CommandContext, CommandResult } from '../game/commands.ts';
import type { BlockId } from '../game/data/blocks.ts';
import type { ItemId } from '../game/data/items.ts';
import { ECONOMY_CATALOG } from '../game/data/generatedEconomyCatalog.ts';
import { repairMawCommand } from '../game/gameplayCommands.ts';
import { recordAccomplishment } from '../game/systems/accomplishmentLedger.ts';
import { getItemCount } from '../game/systems/inventorySystem.ts';
import { hasMilestone, markMilestone } from '../game/systems/progressionSystem.ts';
import { emitEmergentStoryEvent } from './emergentStoryEvents.ts';
import { requestStoryUiCloseCrafting } from './storyUiRequests.ts';
import { dispatchStoryAuthorityCommand } from '../game/storyAuthorityDispatch.ts';
import {
  dispatchMawFirstDirectionAuthority,
  dispatchMawPondObservationBeginOnceAuthority,
  dispatchMawPondResonanceTransactionAuthority,
  resetMawPondAuthorityTransactions
} from '../game/mawStoryAuthority.ts';
import { isStoryPaused } from './storyClock.ts';
import { getLocalActorId, type ActorId } from '../game/playerActors.ts';
import { EMERGENT_UNIQUE_ITEM_MILESTONES } from './emergentUniqueItems.ts';
import type { GuidedStoryObjective } from './ux/objectiveDirector.ts';
import {
  advanceAuthoredForegroundClock,
  createAuthoredForegroundClock,
  documentIsHidden,
  resetAuthoredForegroundClock,
  type AuthoredForegroundClock
} from './authoredFrameTime.ts';

export interface MawRepairTransactionResult {
  ok: boolean;
  idempotent: boolean;
  pending?: boolean;
  reason?:
    | 'ritual-required'
    | 'missing-inputs'
    | 'out-of-order'
    | 'physical-response-required'
    | 'accepted-maw-test-required'
    | 'authoritative-receipt-required';
  commandResult?: CommandResult;
}

export const MAW_REPAIR_RITUAL_SECONDS = ECONOMY_CATALOG.storyTransactions.mawRepair.ritualSeconds;
export const MAW_PURPOSE_GAP_SECONDS = 2;
export const MAW_POND_OBSERVED_SECONDS = 0.55;

export function mawRepairAuthorityBeginCommandId(repairCommandId: string): string {
  return `${repairCommandId}:ritual-begun`;
}

export interface MawPondResponseObservation {
  playerNearPond: boolean;
  responseMeshMounted: boolean;
  cameraAlignment: number;
  visibleSeconds: number;
}

/** A mounted off-screen mesh is not observation. The authored response must
 * stay in the player's forward view while they remain at the dry pond shore. */
export function isMawPondResponseObserved(
  observation: MawPondResponseObservation
): boolean {
  return observation.playerNearPond
    && observation.responseMeshMounted
    && Number.isFinite(observation.cameraAlignment)
    && observation.cameraAlignment >= 0.94
    && observation.visibleSeconds >= MAW_POND_OBSERVED_SECONDS;
}

/** Direct Attend is the accessible equivalent of the passive gaze proof. */
export function isMawPondResponseAttendable(input: {
  playerNearPond: boolean;
  responseMeshMounted: boolean;
}): boolean {
  return input.playerNearPond && input.responseMeshMounted;
}

export type MawFirstDirectionChoice = 'lowered-and-listened' | 'harmless-test';

export const EMERGENT_MAW_MILESTONES = {
  directionResolved: 'story:maw:first-direction-resolved',
  directionLowered: 'story:maw:first-direction:lowered-and-listened',
  directionTested: 'story:maw:first-direction:harmless-test',
  pondResonance: 'story:maw:pond-resonance-visible'
} as const;

export function getMawFirstDirectionChoice(
  actorId: ActorId = getLocalActorId()
): MawFirstDirectionChoice | null {
  if (hasMilestone(EMERGENT_MAW_MILESTONES.directionTested, actorId)) return 'harmless-test';
  if (hasMilestone(EMERGENT_MAW_MILESTONES.directionLowered, actorId)) return 'lowered-and-listened';
  return null;
}

/**
 * One progression-derived copy source for the Chapter 5 HUD and its directional
 * marker. Every state names the next embodied action; the marker renderer uses
 * the same label so a healthy objective can never point at a differently named
 * target.
 */
export function getAuthoredMawGuidance(
  actorId: ActorId = getLocalActorId()
): GuidedStoryObjective {
  if (!hasMilestone(EMERGENT_UNIQUE_ITEM_MILESTONES.mawRepairKit, actorId)) {
    return {
      id: 'maw:recover-field-kit',
      kind: 'interact',
      markerLabel: 'W-7744 FIELD PACK · RECOVER KIT',
      workOrder: ['FOLLOW THE FIELD PACK MARKER.', '[F] RECOVER THE FIELD KIT.']
    };
  }

  const ritual = getMawRepairRitualSnapshot(actorId);
  if (!hasMilestone('maw_repaired', actorId)) {
    return ritual.phase === 'repairing' || ritual.phase === 'ready'
      ? {
          id: 'maw:attend-repair',
          kind: 'wait',
          markerLabel: 'W-7744 FIELD PACK · REPAIR MAW',
          workOrder: ['REMAIN AT THE OPEN FIELD PACK.', 'HOLD POSITION UNTIL THE MAW REPAIR COMPLETES.']
        }
      : {
          id: 'maw:begin-repair',
          kind: 'interact',
          markerLabel: 'W-7744 FIELD PACK · REPAIR MAW',
          workOrder: ['RETURN TO THE OPEN FIELD PACK.', '[F] BEGIN MAW REPAIR.']
        };
  }

  if (!hasMilestone(EMERGENT_MAW_MILESTONES.directionResolved, actorId)) {
    return ritual.directionAvailable
      ? {
          id: 'maw:choose-first-direction',
          kind: 'interact',
          markerLabel: 'REPAIRED MAW · CHOOSE DIRECTION',
          workOrder: [
            'TEST THE MAW ON STONE OR BASE METAL.',
            'OR REMAIN WITH IT AND [F] LOWER IT TO LISTEN.'
          ]
        }
      : {
          id: 'maw:purpose-gap',
          kind: 'wait',
          markerLabel: 'REPAIRED MAW · LISTEN',
          workOrder: ['REMAIN WITH THE REPAIRED MAW.', 'WAIT. LISTEN BEFORE ASSIGNING IT A PURPOSE.']
        };
  }

  if (!hasMilestone(EMERGENT_MAW_MILESTONES.pondResonance, actorId)) {
    return {
      id: 'maw:observe-pond-response',
      kind: 'interact',
      markerLabel: 'POND RESPONSE · ATTEND',
      workOrder: ['FOLLOW THE RESPONSE TO THE DRY SHORE.', 'WATCH IT, OR [F] ATTEND THE POND RESPONSE.']
    };
  }

  return {
    id: 'maw:resonance-settling',
    kind: 'wait',
    markerLabel: 'POND RESPONSE · RESOLVED',
    workOrder: ['REMAIN WITH THE RESONANCE.', 'LET THE STRUCTURE SETTLE.']
  };
}

export interface MawRepairRitualSnapshot {
  phase: 'idle' | 'repairing' | 'ready' | 'committed';
  attendedSeconds: number;
  progress: number;
  postRepairSeconds: number;
  directionAvailable: boolean;
}

interface MawRepairRitualRuntime {
  phase: MawRepairRitualSnapshot['phase'];
  attendedSeconds: number;
  postRepairSeconds: number;
  lastObservedAtMs: number | null;
  eventId: string;
  authorityBeginCommandId: string;
  repairClock: AuthoredForegroundClock;
  purposeClock: AuthoredForegroundClock;
}

const ritualByActor = new Map<string, MawRepairRitualRuntime>();
let nextRitualAttempt = 1;

/**
 * Starts the visible, cancel-safe repair without spending either input. The
 * component must continue attending the physical cradle for eight returned
 * seconds before commitEmergentMawRepair will accept the atomic debit.
 */
export function beginEmergentMawRepairRitual(
  context: CommandContext,
  eventIdInput: string
): MawRepairTransactionResult {
  const eventId = eventIdInput.trim();
  if (!eventId) return { ok: false, idempotent: false };
  if (hasMilestone('maw_repaired', context.actorId)) {
    return { ok: true, idempotent: true };
  }
  if (context.world.worldId !== ECONOMY_CATALOG.storyTransactions.mawRepair.originWorldId) {
    return { ok: false, idempotent: false, reason: 'out-of-order' };
  }
  if (
    getItemCount('maw_repair_kit', context.actorId) <= 0
    || getItemCount('faulty_maw', context.actorId) <= 0
  ) {
    return { ok: false, idempotent: false, reason: 'missing-inputs' };
  }
  const existing = ritualByActor.get(context.actorId);
  if (existing && existing.phase !== 'idle') return { ok: true, idempotent: true };

  const authorityBeginCommandId = mawRepairAuthorityBeginCommandId(eventId);
  const authorityLane = dispatchStoryAuthorityCommand(context, {
    commandId: authorityBeginCommandId,
    commandType: 'maw_repair_begun',
    payload: {}
  });
  if (authorityLane === 'blocked') return { ok: false, idempotent: false };

  ritualByActor.set(context.actorId, {
    phase: 'repairing',
    attendedSeconds: 0,
    postRepairSeconds: 0,
    lastObservedAtMs: context.now(),
    eventId,
    authorityBeginCommandId,
    repairClock: createAuthoredForegroundClock(),
    purposeClock: createAuthoredForegroundClock()
  });
  requestStoryUiCloseCrafting(`${eventId}:close-crafting`, 'authored-maw-repair');
  emitEmergentStoryEvent({
    id: `${eventId}:begun:${context.actorId}:${nextRitualAttempt++}`,
    type: 'maw_repair_begun',
    actorId: context.actorId,
    worldId: context.world.worldId,
    occurredAt: context.now(),
    payload: { toolId: 'faulty_maw', ritualSeconds: MAW_REPAIR_RITUAL_SECONDS }
  });
  return { ok: true, idempotent: false };
}

/**
 * Advances only time returned by the live scene. Large wall-clock gaps are
 * clamped, so pause/focus loss cannot finish the ritual. Leaving the cradle
 * cancels all uncommitted progress and consumes nothing.
 */
export function tickEmergentMawRepairRitual(
  context: CommandContext,
  attendingPhysicalCradle: boolean,
  nowMs = context.now()
): MawRepairTransactionResult {
  const runtime = ritualByActor.get(context.actorId);
  if (hasMilestone('maw_repaired', context.actorId)) {
    if (runtime) runtime.phase = 'committed';
    return { ok: true, idempotent: true };
  }
  if (!runtime || runtime.phase === 'idle') {
    return { ok: false, idempotent: false, reason: 'ritual-required' };
  }
  const paused = isStoryPaused();
  const hidden = documentIsHidden();
  const deltaSeconds = returnedDeltaSeconds(runtime.lastObservedAtMs, nowMs);
  runtime.lastObservedAtMs = nowMs;
  const foregroundDelta = advanceAuthoredForegroundClock(runtime.repairClock, deltaSeconds, {
    paused,
    hidden
  });
  if (paused || hidden) {
    // Discard inactive wall time instead of repaying even the bounded frame cap
    // on resume. The next live sample starts from this inactive observation.
    runtime.lastObservedAtMs = nowMs;
    return { ok: true, idempotent: false, pending: true };
  }
  if (!attendingPhysicalCradle) {
    emitRepairCancellation(context, runtime);
    ritualByActor.delete(context.actorId);
    return { ok: false, idempotent: false, reason: 'ritual-required' };
  }
  return advanceRepairRitual(context, runtime, foregroundDelta);
}

/** Render-loop form used by the physical scene; authored time is frame time. */
export function advanceEmergentMawRepairRitual(
  context: CommandContext,
  attendingPhysicalCradle: boolean,
  deltaSeconds: number
): MawRepairTransactionResult {
  const runtime = ritualByActor.get(context.actorId);
  if (hasMilestone('maw_repaired', context.actorId)) {
    if (runtime) runtime.phase = 'committed';
    return { ok: true, idempotent: true };
  }
  if (!runtime || runtime.phase === 'idle') {
    return { ok: false, idempotent: false, reason: 'ritual-required' };
  }
  const paused = isStoryPaused();
  const hidden = documentIsHidden();
  const foregroundDelta = advanceAuthoredForegroundClock(runtime.repairClock, deltaSeconds, {
    paused,
    hidden
  });
  if (paused || hidden) {
    return { ok: true, idempotent: false, pending: true };
  }
  if (!attendingPhysicalCradle) {
    emitRepairCancellation(context, runtime);
    ritualByActor.delete(context.actorId);
    return { ok: false, idempotent: false, reason: 'ritual-required' };
  }
  return advanceRepairRitual(context, runtime, foregroundDelta);
}

function advanceRepairRitual(
  context: CommandContext,
  runtime: MawRepairRitualRuntime,
  deltaSeconds: number
): MawRepairTransactionResult {
  if (runtime.phase === 'repairing') {
    runtime.attendedSeconds = Math.min(
      MAW_REPAIR_RITUAL_SECONDS,
      runtime.attendedSeconds + deltaSeconds
    );
    if (runtime.attendedSeconds >= MAW_REPAIR_RITUAL_SECONDS - 1e-6) {
      runtime.attendedSeconds = MAW_REPAIR_RITUAL_SECONDS;
      runtime.phase = 'ready';
    }
  }
  if (runtime.phase !== 'ready') return { ok: true, idempotent: false, pending: true };
  return commitEmergentMawRepair(context, runtime.eventId);
}

/** Atomic input debit, inaccessible until the physical ritual is ready. */
export function commitEmergentMawRepair(
  context: CommandContext,
  eventIdInput: string
): MawRepairTransactionResult {
  const eventId = eventIdInput.trim();
  if (!eventId) return { ok: false, idempotent: false };
  if (hasMilestone('maw_repaired', context.actorId)) {
    return { ok: true, idempotent: true };
  }
  const ritual = ritualByActor.get(context.actorId);
  if (!ritual || ritual.phase !== 'ready' || ritual.eventId !== eventId) {
    return { ok: false, idempotent: false, reason: 'ritual-required' };
  }

  const authorityLane = dispatchStoryAuthorityCommand(context, {
    commandId: eventId,
    commandType: 'maw_repaired',
    payload: { ritualBeginCommandId: ritual.authorityBeginCommandId }
  });
  if (authorityLane === 'pending') return { ok: true, idempotent: false, pending: true };
  if (authorityLane === 'blocked') return { ok: false, idempotent: false };

  const commandResult = repairMawCommand(context, { commandId: eventId });
  if (!commandResult.ok) return { ok: false, idempotent: false, commandResult };
  ritual.phase = 'committed';
  ritual.postRepairSeconds = 0;
  ritual.lastObservedAtMs = context.now();
  resetAuthoredForegroundClock(ritual.purposeClock);

  emitEmergentStoryEvent({
    id: eventId,
    type: 'maw_repaired',
    actorId: context.actorId,
    worldId: context.world.worldId,
    occurredAt: context.now(),
    payload: { toolId: 'iron_maw' }
  });
  if (recordAccomplishment('maw_repaired', {
    id: eventId,
    observedAt: context.now(),
    worldId: context.world.worldId,
    sourceKey: 'authored-maw-repair'
  }, context.actorId)) {
    emitEmergentStoryEvent({
      id: `${eventId}:accomplishment`,
      type: 'accomplishment_recorded',
      actorId: context.actorId,
      worldId: context.world.worldId,
      payload: { accomplishmentId: 'maw_repaired' }
    });
  }
  return { ok: true, idempotent: false, commandResult };
}

/** Two returned seconds preserve the signed purpose gap before a prompt exists. */
export function tickMawPurposeGap(
  context: CommandContext,
  nowMs = context.now()
): MawRepairRitualSnapshot {
  let runtime = ritualByActor.get(context.actorId);
  if (!runtime && hasMilestone('maw_repaired', context.actorId)) {
    runtime = {
      phase: 'committed',
      attendedSeconds: MAW_REPAIR_RITUAL_SECONDS,
      postRepairSeconds: 0,
      lastObservedAtMs: nowMs,
      eventId: `story:maw:${context.actorId}:restored-repair`,
      authorityBeginCommandId: `story:maw:${context.actorId}:restored-repair:ritual-begun`,
      repairClock: createAuthoredForegroundClock(MAW_REPAIR_RITUAL_SECONDS),
      purposeClock: createAuthoredForegroundClock()
    };
    ritualByActor.set(context.actorId, runtime);
  }
  if (runtime?.phase === 'committed') {
    const paused = isStoryPaused();
    const hidden = documentIsHidden();
    const deltaSeconds = returnedDeltaSeconds(runtime.lastObservedAtMs, nowMs);
    const foregroundDelta = advanceAuthoredForegroundClock(runtime.purposeClock, deltaSeconds, {
      paused,
      hidden
    });
    if (paused || hidden) {
      // As with the repair hold, visibility/pause time is observed only to move
      // the baseline. It never becomes purpose-gap progress after handback.
      runtime.lastObservedAtMs = nowMs;
    } else {
      runtime.postRepairSeconds = Math.min(
        MAW_PURPOSE_GAP_SECONDS,
        runtime.postRepairSeconds + foregroundDelta
      );
      runtime.lastObservedAtMs = nowMs;
    }
  }
  return getMawRepairRitualSnapshot(context.actorId);
}

export function advanceMawPurposeGap(
  context: CommandContext,
  deltaSeconds: number
): MawRepairRitualSnapshot {
  let runtime = ritualByActor.get(context.actorId);
  if (!runtime && hasMilestone('maw_repaired', context.actorId)) {
    runtime = {
      phase: 'committed',
      attendedSeconds: MAW_REPAIR_RITUAL_SECONDS,
      postRepairSeconds: 0,
      lastObservedAtMs: context.now(),
      eventId: `story:maw:${context.actorId}:restored-repair`,
      authorityBeginCommandId: `story:maw:${context.actorId}:restored-repair:ritual-begun`,
      repairClock: createAuthoredForegroundClock(MAW_REPAIR_RITUAL_SECONDS),
      purposeClock: createAuthoredForegroundClock()
    };
    ritualByActor.set(context.actorId, runtime);
  }
  if (runtime?.phase === 'committed') {
    const foregroundDelta = advanceAuthoredForegroundClock(runtime.purposeClock, deltaSeconds, {
      paused: isStoryPaused(),
      hidden: documentIsHidden()
    });
    runtime.postRepairSeconds = Math.min(
      MAW_PURPOSE_GAP_SECONDS,
      runtime.postRepairSeconds + foregroundDelta
    );
  }
  return getMawRepairRitualSnapshot(context.actorId);
}

export function commitMawFirstDirection(
  context: CommandContext,
  choice: MawFirstDirectionChoice,
  eventIdInput: string,
  targetKind = 'unassigned'
): MawRepairTransactionResult {
  const eventId = eventIdInput.trim();
  if (!eventId) return { ok: false, idempotent: false };
  if (hasMilestone(EMERGENT_MAW_MILESTONES.directionResolved, context.actorId)) {
    return { ok: true, idempotent: true };
  }
  const snapshot = getMawRepairRitualSnapshot(context.actorId);
  if (!hasMilestone('maw_repaired', context.actorId) || !snapshot.directionAvailable) {
    return { ok: false, idempotent: false, reason: 'out-of-order' };
  }
  const authorityLane = dispatchMawFirstDirectionAuthority(context, eventId, choice);
  if (authorityLane === 'pending') return { ok: true, idempotent: false, pending: true };
  if (authorityLane === 'blocked') return { ok: false, idempotent: false };
  markMilestone(
    choice === 'harmless-test'
      ? EMERGENT_MAW_MILESTONES.directionTested
      : EMERGENT_MAW_MILESTONES.directionLowered,
    context.actorId
  );
  markMilestone(EMERGENT_MAW_MILESTONES.directionResolved, context.actorId);
  emitEmergentStoryEvent({
    id: eventId,
    type: 'maw_direction_resolved',
    actorId: context.actorId,
    worldId: context.world.worldId,
    occurredAt: context.now(),
    payload: { targetKind, choice }
  });
  return { ok: true, idempotent: false };
}

const HARMLESS_MAW_TEST_BLOCKS = new Set<BlockId>(
  ECONOMY_CATALOG.storyTransactions.mawRepair.harmlessTestBlockIds
);

/**
 * Resolves the active-use branch only from the exact accepted mining intent.
 * Online, that mine and the direction command share ordered WebSocket delivery;
 * the server accepts the latter only after its canonical mine receipt exists.
 */
export function commitMawHarmlessTestFromAcceptedMine(
  context: CommandContext,
  proof: {
    result: CommandResult;
    toolId: ItemId | null;
    blockId: BlockId;
  }
): MawRepairTransactionResult {
  if (!proof.result.ok
    || proof.toolId !== 'iron_maw'
    || !HARMLESS_MAW_TEST_BLOCKS.has(proof.blockId)) {
    return { ok: false, idempotent: false, reason: 'accepted-maw-test-required' };
  }
  const acceptedMine = proof.result.events.find(event => {
    if (event.type !== 'voxel_mined'
      || event.actorId !== context.actorId
      || event.worldId !== context.world.worldId
      || typeof event.payload !== 'object'
      || event.payload === null
      || Array.isArray(event.payload)) return false;
    const payload = event.payload as Record<string, unknown>;
    return payload.blockId === proof.blockId
      && payload.toolId === proof.toolId
      && payload.toolId === 'iron_maw';
  });
  if (!acceptedMine) {
    return { ok: false, idempotent: false, reason: 'accepted-maw-test-required' };
  }
  return commitMawFirstDirection(
    context,
    'harmless-test',
    `story:maw:harmless-test:${acceptedMine.eventId}`,
    proof.blockId
  );
}

/** Starts the online observation receipt without completing the story gate. */
export function beginMawPondObservation(
  context: CommandContext,
  physicalResponseVisible: boolean,
  eventIdInput: string
): MawRepairTransactionResult {
  const eventId = eventIdInput.trim();
  if (!eventId) return { ok: false, idempotent: false };
  if (hasMilestone(EMERGENT_MAW_MILESTONES.pondResonance, context.actorId)) {
    return { ok: true, idempotent: true };
  }
  if (!hasMilestone(EMERGENT_MAW_MILESTONES.directionResolved, context.actorId)) {
    return { ok: false, idempotent: false, reason: 'out-of-order' };
  }
  if (!physicalResponseVisible) {
    return { ok: false, idempotent: false, reason: 'physical-response-required' };
  }
  const authorityLane = dispatchMawPondObservationBeginOnceAuthority(context, eventId);
  if (authorityLane === 'pending') return { ok: true, idempotent: false, pending: true };
  if (authorityLane === 'blocked') return { ok: false, idempotent: false };
  return { ok: true, idempotent: true };
}

export function commitMawPondResonance(
  context: CommandContext,
  physicalResponseVisible: boolean,
  eventIdInput: string
): MawRepairTransactionResult {
  const eventId = eventIdInput.trim();
  if (!eventId) return { ok: false, idempotent: false };
  if (hasMilestone(EMERGENT_MAW_MILESTONES.pondResonance, context.actorId)) {
    return { ok: true, idempotent: true };
  }
  if (!hasMilestone(EMERGENT_MAW_MILESTONES.directionResolved, context.actorId)) {
    return { ok: false, idempotent: false, reason: 'out-of-order' };
  }
  if (!physicalResponseVisible) {
    return { ok: false, idempotent: false, reason: 'physical-response-required' };
  }
  const authorityLane = dispatchMawPondResonanceTransactionAuthority(context, eventId);
  if (authorityLane === 'pending') return { ok: true, idempotent: false, pending: true };
  if (authorityLane === 'blocked') return { ok: false, idempotent: false };
  markMilestone(EMERGENT_MAW_MILESTONES.pondResonance, context.actorId);
  emitEmergentStoryEvent({
    id: eventId,
    type: 'keel_resonance_detected',
    actorId: context.actorId,
    worldId: context.world.worldId,
    occurredAt: context.now(),
    payload: {
      source: 'kestrel_keel_memory',
      response: 'structural-ripple',
      visible: true
    }
  });
  return { ok: true, idempotent: false };
}

export function getMawRepairRitualSnapshot(actorId = 'local'): MawRepairRitualSnapshot {
  const runtime = ritualByActor.get(actorId);
  const attendedSeconds = runtime?.attendedSeconds ?? 0;
  const postRepairSeconds = runtime?.postRepairSeconds ?? 0;
  const phase = runtime?.phase ?? 'idle';
  return {
    phase,
    attendedSeconds,
    progress: Math.max(0, Math.min(1, attendedSeconds / MAW_REPAIR_RITUAL_SECONDS)),
    postRepairSeconds,
    directionAvailable: phase === 'committed'
      && postRepairSeconds >= MAW_PURPOSE_GAP_SECONDS - 1e-6
  };
}

export function resetEmergentMawRepairRitual(): void {
  ritualByActor.clear();
  nextRitualAttempt = 1;
  resetMawPondAuthorityTransactions();
}

function returnedDeltaSeconds(previousMs: number | null, nowMs: number): number {
  if (previousMs === null || !Number.isFinite(previousMs) || !Number.isFinite(nowMs)) return 0;
  return Math.max(0, (nowMs - previousMs) / 1000);
}

function emitRepairCancellation(
  context: CommandContext,
  runtime: MawRepairRitualRuntime
): void {
  emitEmergentStoryEvent({
    id: `${runtime.eventId}:cancelled:${context.actorId}:${nextRitualAttempt++}`,
    type: 'maw_repair_cancelled',
    actorId: context.actorId,
    worldId: context.world.worldId,
    occurredAt: context.now(),
    payload: {
      toolId: 'faulty_maw',
      attendedSeconds: runtime.attendedSeconds
    }
  });
}
