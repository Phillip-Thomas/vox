import type { ActorId } from '../game/playerActors.ts';
import { recordAccomplishment } from '../game/systems/accomplishmentLedger.ts';
import {
  attendObservation,
  getObservation
} from '../game/systems/observationLedger.ts';
import type { ShipRepairStage } from './emergentCapabilities.ts';
import { emitEmergentStoryEvent } from './emergentStoryEvents.ts';
import { STORY_PRIMARY_WORLD_ID } from './tidegardenRoute.ts';

export const WRECK_SCAR_OBSERVATION_ID = 'wreck_scar_persistence';
export const WRECK_SCAR_ACCOMPLISHMENT_ID = 'the_scar_remains';
export const WRECK_SCAR_REQUIRED_STAGES = 3;

/** Optional attention only: this ledger never gates reconstruction. */
export function attendWreckScar(
  stage: ShipRepairStage,
  actorId: ActorId,
  worldId = STORY_PRIMARY_WORLD_ID
): { observed: boolean; distinctStages: number; accomplished: boolean } {
  if (worldId !== STORY_PRIMARY_WORLD_ID) {
    return { observed: false, distinctStages: 0, accomplished: false };
  }
  const evidenceId = `wreck-scar:${stage}`;
  const observed = attendObservation(
    WRECK_SCAR_OBSERVATION_ID,
    {
      id: evidenceId,
      worldId,
      sourceKey: 'physical-wreck-scar',
      data: { stage }
    },
    { id: `attend:${evidenceId}` },
    actorId
  );
  if (observed) {
    emitEmergentStoryEvent({
      id: `${evidenceId}:${actorId}:observed`,
      type: 'observation_recorded',
      actorId,
      worldId,
      payload: { observationId: WRECK_SCAR_OBSERVATION_ID, revisionKind: 'attend' }
    });
  }
  const observation = getObservation(WRECK_SCAR_OBSERVATION_ID, actorId);
  const stages = new Set(observation?.evidenceHistory.map(evidence => evidence.data?.stage)
    .filter((value): value is ShipRepairStage => typeof value === 'string') ?? []);
  const distinctStages = stages.size;
  const accomplished = distinctStages >= WRECK_SCAR_REQUIRED_STAGES
    && recordAccomplishment(WRECK_SCAR_ACCOMPLISHMENT_ID, {
      id: `wreck-scar:three-stages:${[...stages].sort().join('+')}`,
      worldId,
      sourceKey: 'optional-wreck-scar-observation',
      data: { distinctStages }
    }, actorId);
  if (accomplished) {
    emitEmergentStoryEvent({
      id: `wreck-scar:${actorId}:accomplishment`,
      type: 'accomplishment_recorded',
      actorId,
      worldId,
      payload: { accomplishmentId: WRECK_SCAR_ACCOMPLISHMENT_ID }
    });
  }
  return { observed, distinctStages, accomplished };
}
