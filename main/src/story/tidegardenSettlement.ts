import * as THREE from 'three';
import type { ActorId } from '../game/playerActors.ts';
import type { CommandContext } from '../game/commands.ts';
import { dispatchStoryAuthorityCommand } from '../game/storyAuthorityDispatch.ts';
import { getItemCount, addItem, removeItem } from '../game/systems/inventorySystem.ts';
import {
  commitHabitatCorePlacement,
  commitHabitatSafeRest,
  commitHabitatShelterCertification,
  getHabitatWorldState,
  type HabitatCell
} from '../game/systems/habitatSystem.ts';
import { recordAccomplishment } from '../game/systems/accomplishmentLedger.ts';
import { attendObservation } from '../game/systems/observationLedger.ts';
import { hasMilestone, markMilestone } from '../game/systems/progressionSystem.ts';
import {
  FACE_DIRS,
  VOLUME_FACE,
  faceIndexForNormal,
  getPieces,
  oppositeFace,
  type StructurePiece
} from '../game/systems/structureSystem.ts';
import { analyzeShelterCell, type ShelterAnalysis } from '../game/systems/shelterSystem.ts';
import { setVitals } from '../game/systems/survivalVitals.ts';
import { VOXEL_SCALE, voxelCoordToWorld } from '../utils/cubeGravityConstants.ts';
import {
  findValidSpawnSite,
  type SpawnTerrainQuery
} from '../utils/spawnValidation.ts';
import { emitEmergentStoryEvent } from './emergentStoryEvents.ts';
import {
  STORY_PRIMARY_WORLD_ID,
  TIDEGARDEN_WORLD_ID
} from './tidegardenRoute.ts';
import { getPondPose } from './world/storyWorld.ts';
import {
  applyAuthoritativeTidegardenSiteChoiceReceipt,
  encodeTidegardenSiteChoice,
  getTidegardenSiteChoiceReceipt,
  tidegardenSiteChoiceMatchesCell,
  TIDEGARDEN_SITE_CHOICE_PREFIX
} from './tidegardenSiteChoice.ts';
import type { GuidedStoryObjective } from './ux/objectiveDirector.ts';

export const HABITAT_CORE_RECIPE_RECEIPT = 'story:item:habitat-core:crafted';
export const TIDEGARDEN_RELATIONSHIP_ID = 'tideline-root-water-exchange';
export const TIDEGARDEN_RELATIONSHIP_OBSERVATION_ID = 'observation:tidegarden:tideline-root-water-exchange';

export const TIDEGARDEN_SETTLEMENT_MILESTONES = {
  scannerOverload: 'story:tidegarden:scanner-overload',
  relationshipAttended: 'story:tidegarden:relationship-attended',
  siteChoicePrefix: TIDEGARDEN_SITE_CHOICE_PREFIX,
  coreOnline: 'story:tidegarden:habitat-core-online',
  shelterCertified: 'story:tidegarden:shelter-certified',
  safeRestCompleted: 'story:tidegarden:safe-rest-completed',
  twoWorldHandoff: 'story:tidegarden:two-world-handoff'
} as const;

export interface HabitatSiteProof {
  worldId: typeof TIDEGARDEN_WORLD_ID;
  cell: HabitatCell;
  supportCell: HabitatCell;
  position: THREE.Vector3;
  up: THREE.Vector3;
  shelterId: string;
}

export interface TidegardenRelationshipProof {
  worldId: typeof TIDEGARDEN_WORLD_ID;
  relationshipId: typeof TIDEGARDEN_RELATIONSHIP_ID;
  position: THREE.Vector3;
  waterDepth: number;
  sourceKey: 'deterministic-waterline';
}

export interface TidegardenScannerOverloadProof {
  worldId: typeof TIDEGARDEN_WORLD_ID;
  visibleSignalIds: readonly string[];
  relationshipKinds: readonly ('water-root' | 'canopy-shelter' | 'pollen-route')[];
  renderedFrames: number;
}

export type HabitatSiteFailure =
  | 'wrong-world'
  | 'relationship-not-attended'
  | 'site-not-dry-level-clear'
  | 'site-not-chosen'
  | 'different-site-chosen'
  | 'foundation-required'
  | 'site-obstructed'
  | 'core-already-online';

export type HabitatSiteValidation =
  | { ok: true; proof: HabitatSiteProof }
  | { ok: false; reason: HabitatSiteFailure };

export type SettlementCommitResult =
  | { ok: true; idempotent: boolean; pending?: boolean }
  | { ok: false; reason: string };

/** Shared Ch9 objective contract for the work order and the persistent HUD marker. */
export interface TidegardenSettlementGuidance {
  id: string;
  kind: GuidedStoryObjective['kind'];
  markerLabel: GuidedStoryObjective['markerLabel'];
  workOrder: GuidedStoryObjective['workOrder'];
}

export function getTidegardenSettlementGuidance(input: {
  actorId: ActorId;
  coreCarried: boolean;
  foundationPlaced: boolean;
  night: boolean;
}): TidegardenSettlementGuidance {
  const { actorId, coreCarried, foundationPlaced, night } = input;
  if (!hasMilestone(TIDEGARDEN_SETTLEMENT_MILESTONES.scannerOverload, actorId)) {
    return {
      id: 'scan-waterline',
      kind: 'travel',
      markerLabel: 'LIVING WATERLINE · SCAN',
      workOrder: ['FOLLOW THE LIVING WATERLINE MARKER.', 'READ THE SIGNAL FIELD.']
    };
  }
  if (!hasMilestone(TIDEGARDEN_SETTLEMENT_MILESTONES.relationshipAttended, actorId)) {
    return {
      id: 'attend-waterline',
      kind: 'interact',
      markerLabel: 'LIVING WATERLINE · ATTEND',
      workOrder: ['FOLLOW THE LIVING WATERLINE MARKER.', '[F] ATTEND THE RELATIONSHIP.']
    };
  }
  const habitat = getHabitatWorldState(TIDEGARDEN_WORLD_ID);
  if (!habitat) {
    const chosen = getTidegardenChosenHabitatSite(actorId);
    if (!chosen) {
      return {
        id: 'choose-site',
        kind: 'interact',
        markerLabel: 'RECOMMENDED HABITAT SITE · CHOOSE',
        workOrder: ['FOLLOW THE HABITAT SITE MARKER.', '[F] CHOOSE THIS DRY, LEVEL SITE.']
      };
    }
    if (!coreCarried) {
      return {
        id: 'craft-core',
        kind: 'craft',
        markerLabel: 'CHOSEN SITE · CRAFT HABITAT CORE',
        workOrder: [
          'THE FLIGHT-READY KESTREL FABRICATOR REMAINS LINKED.',
          '[C] CRAFT HABITAT CORE.'
        ]
      };
    }
    if (!foundationPlaced) {
      return {
        id: 'foundation',
        kind: 'build',
        markerLabel: 'CHOSEN SITE · PLACE FOUNDATION',
        workOrder: ['[B] PLACE A FOUNDATION AT THE CHOSEN SITE.']
      };
    }
    return {
      id: 'install-core',
      kind: 'interact',
      markerLabel: 'CHOSEN SITE · INSTALL HABITAT CORE',
      workOrder: ['RETURN TO THE CHOSEN FOUNDATION.', '[F] INSTALL HABITAT CORE.']
    };
  }
  if (!habitat.shelterCertification) {
    return {
      id: 'certify-shelter',
      kind: 'build',
      markerLabel: 'HABITAT CORE · ENCLOSE AND CERTIFY',
      workOrder: ['BUILD A CLOSED SHELTER AROUND THE CORE.', '[F] CERTIFY THE WORKING SHELTER.']
    };
  }
  return night
    ? {
        id: 'rest',
        kind: 'interact',
        markerLabel: 'SECOND HEARTH · REST INSIDE',
        workOrder: ['RETURN INSIDE THE CERTIFIED SHELTER.', '[F] REST AT THE SECOND HEARTH.']
      }
    : {
        id: 'wait-night',
        kind: 'wait',
        markerLabel: 'SECOND HEARTH · WAIT FOR NIGHT',
        workOrder: ['RETURN TO THE SECOND HEARTH.', 'REST BECOMES AVAILABLE AT NIGHT.']
      };
}

/**
 * Rebuild actor receipts from a validated world-local Habitat snapshot without
 * replaying narrative events. This closes the partial-save boundary where the
 * per-world write lands but the following global milestone write does not.
 * A committed core proves the prerequisite relationship was attended because
 * core placement cannot pass without it; later receipts imply the earlier ones.
 */
export function reconcileTidegardenSettlementMilestones(
  worldId: string,
  actorId: ActorId
): boolean {
  if (worldId !== TIDEGARDEN_WORLD_ID) return false;
  const state = getHabitatWorldState(worldId);
  if (!state) return false;
  let changed = false;
  const restore = (milestone: string) => {
    if (hasMilestone(milestone, actorId)) return;
    markMilestone(milestone, actorId);
    changed = true;
  };
  restore(TIDEGARDEN_SETTLEMENT_MILESTONES.scannerOverload);
  restore(TIDEGARDEN_SETTLEMENT_MILESTONES.relationshipAttended);
  if (!getTidegardenChosenHabitatSite(actorId)) {
    restore(siteChoiceMilestone({
      worldId: TIDEGARDEN_WORLD_ID,
      cell: [...state.core.cell],
      supportCell: [...state.core.supportCell],
      position: new THREE.Vector3(...state.core.position),
      up: new THREE.Vector3(...state.core.up),
      shelterId: state.core.shelterId
    }));
  }
  restore(HABITAT_CORE_RECIPE_RECEIPT);
  restore(TIDEGARDEN_SETTLEMENT_MILESTONES.coreOnline);
  if (state.shelterCertification) {
    restore(TIDEGARDEN_SETTLEMENT_MILESTONES.shelterCertified);
  }
  if (state.safeRest) {
    restore(TIDEGARDEN_SETTLEMENT_MILESTONES.safeRestCompleted);
    restore(TIDEGARDEN_SETTLEMENT_MILESTONES.twoWorldHandoff);
  }
  return changed;
}

export function createTidegardenRelationshipProof(
  planetSize: number,
  terrainSeed: number
): TidegardenRelationshipProof | null {
  const pond = getPondPose(planetSize, terrainSeed, TIDEGARDEN_WORLD_ID);
  if (!pond || pond.depth < 1) return null;
  return {
    worldId: TIDEGARDEN_WORLD_ID,
    relationshipId: TIDEGARDEN_RELATIONSHIP_ID,
    position: pond.shore.clone(),
    waterDepth: pond.depth,
    sourceKey: 'deterministic-waterline'
  };
}

/**
 * Commit the opening Tidegarden scanner beat only after cheap physical signal
 * geometry has survived at least one rendered frame. The proof is deliberately
 * semantic rather than post-process based so Potato and no-post modes can pass.
 */
export function commitTidegardenScannerOverload(
  proof: TidegardenScannerOverloadProof,
  eventId: string,
  actorId: ActorId
): SettlementCommitResult {
  if (proof.worldId !== TIDEGARDEN_WORLD_ID
    || proof.renderedFrames < 1
    || new Set(proof.visibleSignalIds).size < 6
    || new Set(proof.relationshipKinds).size < 3) {
    return { ok: false, reason: 'scanner-physical-proof-incomplete' };
  }
  if (hasMilestone(TIDEGARDEN_SETTLEMENT_MILESTONES.scannerOverload, actorId)) {
    return { ok: true, idempotent: true };
  }
  markMilestone(TIDEGARDEN_SETTLEMENT_MILESTONES.scannerOverload, actorId);
  emitEmergentStoryEvent({
    id: eventId,
    type: 'settlement_scanner_overload',
    actorId,
    worldId: proof.worldId,
    payload: {
      worldId: proof.worldId,
      visibleSignalCount: new Set(proof.visibleSignalIds).size,
      relationshipKinds: new Set(proof.relationshipKinds).size
    }
  });
  return { ok: true, idempotent: false };
}

/**
 * A direct physical Attend is sufficient Story comprehension. It records a
 * proven event/accomplishment, but deliberately does not write the optional
 * interpretation ledger.
 */
export function attendTidegardenRelationship(
  proof: TidegardenRelationshipProof,
  eventId: string,
  actorId: ActorId,
  commandContext?: CommandContext
): SettlementCommitResult {
  if (!validRelationshipProof(proof)) return { ok: false, reason: 'relationship-proof-invalid' };
  if (!hasMilestone(TIDEGARDEN_SETTLEMENT_MILESTONES.scannerOverload, actorId)) {
    return { ok: false, reason: 'scanner-overload-not-observed' };
  }
  if (hasMilestone(TIDEGARDEN_SETTLEMENT_MILESTONES.relationshipAttended, actorId)) {
    return { ok: true, idempotent: true };
  }
  if (commandContext) {
    const lane = dispatchStoryAuthorityCommand(commandContext, {
      commandId: eventId,
      commandType: 'tidegarden_relationship_attended',
      payload: {
        relationshipId: proof.relationshipId,
        waterDepth: proof.waterDepth,
        sourceKey: proof.sourceKey
      }
    });
    if (lane === 'pending') return { ok: true, idempotent: false, pending: true };
    if (lane === 'blocked') return { ok: false, reason: 'multiplayer-authority-unavailable' };
  }
  markMilestone(TIDEGARDEN_SETTLEMENT_MILESTONES.relationshipAttended, actorId);
  emitEmergentStoryEvent({
    id: eventId,
    type: 'ecology_relationship_observed',
    actorId,
    worldId: TIDEGARDEN_WORLD_ID,
    payload: {
      worldId: TIDEGARDEN_WORLD_ID,
      relationshipId: proof.relationshipId
    }
  });
  emitAccomplishment(
    'tidegarden_relationship_attended',
    eventId,
    actorId,
    TIDEGARDEN_WORLD_ID,
    {
      relationshipId: proof.relationshipId,
      waterDepth: proof.waterDepth,
      sourceKey: proof.sourceKey
    }
  );
  return { ok: true, idempotent: false };
}

/** Optional player-owned interpretation. Nothing in settlement progression reads it. */
export function recordTidegardenRelationshipObservation(
  proof: TidegardenRelationshipProof,
  eventId: string,
  actorId: ActorId
): SettlementCommitResult {
  if (!validRelationshipProof(proof)
    || !hasMilestone(TIDEGARDEN_SETTLEMENT_MILESTONES.relationshipAttended, actorId)) {
    return { ok: false, reason: 'relationship-not-attended' };
  }
  const recorded = attendObservation(
    TIDEGARDEN_RELATIONSHIP_OBSERVATION_ID,
    {
      id: `${eventId}:evidence`,
      worldId: TIDEGARDEN_WORLD_ID,
      sourceKey: proof.sourceKey,
      data: {
        relationshipId: proof.relationshipId,
        waterDepth: proof.waterDepth
      }
    },
    { id: `${eventId}:attend` },
    actorId
  );
  if (!recorded) return { ok: true, idempotent: true };
  emitEmergentStoryEvent({
    id: eventId,
    type: 'observation_recorded',
    actorId,
    worldId: TIDEGARDEN_WORLD_ID,
    payload: {
      observationId: TIDEGARDEN_RELATIONSHIP_OBSERVATION_ID,
      revisionKind: 'attend'
    }
  });
  return { ok: true, idempotent: false };
}

export interface TidegardenHabitatSiteInput {
  worldId: string;
  planetSize: number;
  playerPosition: THREE.Vector3;
  terrain: SpawnTerrainQuery;
  actorId: ActorId;
  pieces?: readonly StructurePiece[];
}

/** A dry, level, clear candidate before a foundation exists. */
export function surveyTidegardenHabitatSite(
  input: TidegardenHabitatSiteInput
): HabitatSiteValidation {
  if (input.worldId !== TIDEGARDEN_WORLD_ID) return { ok: false, reason: 'wrong-world' };
  if (getHabitatWorldState(input.worldId)) return { ok: false, reason: 'core-already-online' };
  if (!hasMilestone(TIDEGARDEN_SETTLEMENT_MILESTONES.relationshipAttended, input.actorId)) {
    return { ok: false, reason: 'relationship-not-attended' };
  }
  const site = findValidSpawnSite(
    input.terrain,
    input.planetSize,
    input.playerPosition,
    { kind: 'player', maxSearchRadius: 0 }
  );
  if (!site || site.searchDistanceCells > 0.001) {
    return { ok: false, reason: 'site-not-dry-level-clear' };
  }
  const upFace = faceIndexForNormal(site.up.x, site.up.y, site.up.z);
  const direction = FACE_DIRS[upFace];
  const cell: HabitatCell = [
    site.supportVoxel.x + direction[0],
    site.supportVoxel.y + direction[1],
    site.supportVoxel.z + direction[2]
  ];
  const pieces = input.pieces ?? getPieces();
  if (pieces.some(piece => sameCell(piece.cell, cell) && piece.face === VOLUME_FACE)) {
    return { ok: false, reason: 'site-obstructed' };
  }
  const position = voxelCoordToWorld(cell[0], cell[1], cell[2])
    .addScaledVector(site.up, 0.24);
  const shelterId = `habitat:${input.worldId}:${cell.join(',')}`;
  return {
    ok: true,
    proof: {
      worldId: TIDEGARDEN_WORLD_ID,
      cell,
      supportCell: [site.supportVoxel.x, site.supportVoxel.y, site.supportVoxel.z],
      position,
      up: site.up.clone(),
      shelterId
    }
  };
}

/**
 * Persist the player's first valid ground choice before construction. A choice
 * is actor-owned and immutable once made; placement elsewhere remains ordinary
 * free building but cannot satisfy the signed settlement rail.
 */
export function chooseTidegardenHabitatSite(input: TidegardenHabitatSiteInput & {
  eventId: string;
  commandContext?: CommandContext;
}): SettlementCommitResult {
  const candidate = surveyTidegardenHabitatSite(input);
  if (!candidate.ok) return candidate;
  const existing = getTidegardenChosenHabitatSite(input.actorId);
  if (existing) {
    return sameSite(existing, candidate.proof)
      ? { ok: true, idempotent: true }
      : { ok: false, reason: 'different-site-chosen' };
  }
  if (input.commandContext) {
    const lane = dispatchStoryAuthorityCommand(input.commandContext, {
      commandId: input.eventId,
      commandType: 'tidegarden_site_chosen',
      payload: siteChoicePayload(candidate.proof)
    });
    if (lane === 'pending') return { ok: true, idempotent: false, pending: true };
    if (lane === 'blocked') return { ok: false, reason: 'multiplayer-authority-unavailable' };
  }
  return applyAuthoritativeTidegardenSiteChoice(
    siteChoicePayload(candidate.proof),
    input.eventId,
    input.actorId
  );
}

/** Apply only a server-accepted or locally validated site-choice receipt. */
export function applyAuthoritativeTidegardenSiteChoice(
  payload: {
    worldId: string;
    cell: readonly [number, number, number];
    supportCell: readonly [number, number, number];
    up: readonly [number, number, number];
  },
  eventId: string,
  actorId: ActorId
): SettlementCommitResult {
  return applyAuthoritativeTidegardenSiteChoiceReceipt(payload, eventId, actorId);
}

export function getTidegardenChosenHabitatSite(actorId: ActorId): HabitatSiteProof | null {
  const receipt = getTidegardenSiteChoiceReceipt(actorId);
  return receipt ? habitatSiteProofFromPayload(receipt) : null;
}

export function tidegardenFoundationMatchesSiteChoice(
  actorId: ActorId,
  cell: readonly [number, number, number]
): boolean {
  return tidegardenSiteChoiceMatchesCell(actorId, cell);
}

export function validateTidegardenHabitatSite(
  input: TidegardenHabitatSiteInput
): HabitatSiteValidation {
  const candidate = surveyTidegardenHabitatSite(input);
  if (!candidate.ok) return candidate;
  const chosen = getTidegardenChosenHabitatSite(input.actorId);
  if (!chosen) return { ok: false, reason: 'site-not-chosen' };
  if (!sameSite(chosen, candidate.proof)) {
    return { ok: false, reason: 'different-site-chosen' };
  }
  const upFace = faceIndexForNormal(
    candidate.proof.up.x,
    candidate.proof.up.y,
    candidate.proof.up.z
  );
  const floorFace = oppositeFace(upFace);
  const pieces = input.pieces ?? getPieces();
  const foundation = pieces.find(piece => (
    sameCell(piece.cell, candidate.proof.cell)
    && piece.face === floorFace
    && piece.type === 'foundation'
  ));
  if (!foundation) return { ok: false, reason: 'foundation-required' };
  return candidate;
}

export function activateTidegardenHabitatCore(input: {
  proof: HabitatSiteProof;
  eventId: string;
  actorId: ActorId;
  commandContext?: CommandContext;
}): SettlementCommitResult {
  const { proof, eventId, actorId, commandContext } = input;
  if (proof.worldId !== TIDEGARDEN_WORLD_ID) return { ok: false, reason: 'wrong-world' };
  if (getHabitatWorldState(TIDEGARDEN_WORLD_ID)) return { ok: true, idempotent: true };
  if (!hasMilestone(TIDEGARDEN_SETTLEMENT_MILESTONES.relationshipAttended, actorId)) {
    return { ok: false, reason: 'relationship-not-attended' };
  }
  if (getItemCount('habitat_core', actorId) < 1) return { ok: false, reason: 'habitat-core-missing' };
  if (commandContext) {
    const lane = dispatchStoryAuthorityCommand(commandContext, {
      commandId: eventId,
      commandType: 'habitat_core_placed',
      payload: {
        shelterId: proof.shelterId,
        cell: [...proof.cell],
        supportCell: [...proof.supportCell],
        position: proof.position.toArray(),
        up: proof.up.toArray()
      }
    });
    if (lane === 'pending') return { ok: true, idempotent: false, pending: true };
    if (lane === 'blocked') return { ok: false, reason: 'multiplayer-authority-unavailable' };
  }
  if (!removeItem('habitat_core', 1, actorId)) return { ok: false, reason: 'habitat-core-missing' };
  const committed = commitHabitatCorePlacement({
    actorId,
    worldId: proof.worldId,
    shelterId: proof.shelterId,
    cell: [...proof.cell],
    supportCell: [...proof.supportCell],
    position: proof.position.toArray(),
    up: proof.up.toArray(),
    eventId
  });
  if (!committed) {
    addItem('habitat_core', 1, actorId);
    return { ok: false, reason: 'core-commit-conflict' };
  }
  // Old/offline saves may own the carried device before unique recipe receipts
  // existed. Installation closes that migration path without minting another.
  markMilestone(HABITAT_CORE_RECIPE_RECEIPT, actorId);
  markMilestone(TIDEGARDEN_SETTLEMENT_MILESTONES.coreOnline, actorId);
  emitEmergentStoryEvent({
    id: eventId,
    type: 'station_activated',
    actorId,
    worldId: proof.worldId,
    payload: { stationId: 'habitat_core' }
  });
  emitAccomplishment('habitat_core_activated', eventId, actorId, proof.worldId, {
    cell: proof.cell,
    supportCell: proof.supportCell,
    dryLevelClear: true,
    foundationPresent: true
  });
  return { ok: true, idempotent: false };
}

export function certifyTidegardenShelter(input: {
  worldId: string;
  playerPosition: THREE.Vector3;
  eventId: string;
  actorId: ActorId;
  pieces?: readonly StructurePiece[];
  commandContext?: CommandContext;
}): SettlementCommitResult {
  const state = getHabitatWorldState(input.worldId);
  if (!state) return { ok: false, reason: 'habitat-core-offline' };
  if (state.shelterCertification) return { ok: true, idempotent: true };
  const analysis = provenSharedShelter(state.core.cell, input.playerPosition, input.pieces ?? getPieces());
  if (!analysis) return { ok: false, reason: 'physical-enclosure-incomplete' };
  if (input.commandContext) {
    const lane = dispatchStoryAuthorityCommand(input.commandContext, {
      commandId: input.eventId,
      commandType: 'habitat_shelter_certified',
      payload: {
        shelterId: state.core.shelterId,
        cell: [...state.core.cell],
        insulation: analysis.insulation,
        interiorCellCount: analysis.interiorCells.length
      }
    });
    if (lane === 'pending') return { ok: true, idempotent: false, pending: true };
    if (lane === 'blocked') return { ok: false, reason: 'multiplayer-authority-unavailable' };
  }
  const committed = commitHabitatShelterCertification(input.worldId, {
    shelterId: state.core.shelterId,
    cell: [...state.core.cell],
    insulation: analysis.insulation,
    interiorCellCount: analysis.interiorCells.length,
    eventId: input.eventId
  });
  if (!committed) return { ok: false, reason: 'shelter-commit-conflict' };
  markMilestone(TIDEGARDEN_SETTLEMENT_MILESTONES.shelterCertified, input.actorId);
  emitEmergentStoryEvent({
    id: input.eventId,
    type: 'shelter_certified',
    actorId: input.actorId,
    worldId: input.worldId,
    payload: { worldId: input.worldId, shelterId: state.core.shelterId }
  });
  emitAccomplishment('living_address', input.eventId, input.actorId, input.worldId, {
    shelterId: state.core.shelterId,
    insulation: analysis.insulation,
    interiorCellCount: analysis.interiorCells.length,
    physicalEnclosure: true
  });
  return { ok: true, idempotent: false };
}

export function completeTidegardenSafeRest(input: {
  worldId: string;
  playerPosition: THREE.Vector3;
  dayPhase: number;
  eventId: string;
  actorId: ActorId;
  pieces?: readonly StructurePiece[];
  commandContext?: CommandContext;
}): SettlementCommitResult {
  const state = getHabitatWorldState(input.worldId);
  if (!state?.shelterCertification) return { ok: false, reason: 'shelter-not-certified' };
  if (state.safeRest) return { ok: true, idempotent: true };
  const phase = normalizeDayPhase(input.dayPhase);
  if (!isHabitatNight(phase)) return { ok: false, reason: 'rest-requires-night' };
  // Certification is a historical receipt. Rest rechecks the live panels so an
  // opened door or removed roof cannot complete from stale proof.
  const analysis = provenSharedShelter(state.core.cell, input.playerPosition, input.pieces ?? getPieces());
  if (!analysis) return { ok: false, reason: 'shelter-no-longer-safe' };
  if (input.commandContext) {
    const lane = dispatchStoryAuthorityCommand(input.commandContext, {
      commandId: input.eventId,
      commandType: 'habitat_safe_rest_completed',
      payload: { shelterId: state.core.shelterId, dayPhase: phase }
    });
    if (lane === 'pending') return { ok: true, idempotent: false, pending: true };
    if (lane === 'blocked') return { ok: false, reason: 'multiplayer-authority-unavailable' };
  }
  const committed = commitHabitatSafeRest(input.worldId, {
    shelterId: state.core.shelterId,
    dayPhase: phase,
    eventId: input.eventId
  });
  if (!committed) return { ok: false, reason: 'safe-rest-commit-conflict' };
  setVitals({ stamina: 100, warmth: 100 }, input.actorId);
  markMilestone(TIDEGARDEN_SETTLEMENT_MILESTONES.safeRestCompleted, input.actorId);
  markMilestone(TIDEGARDEN_SETTLEMENT_MILESTONES.twoWorldHandoff, input.actorId);
  emitEmergentStoryEvent({
    id: input.eventId,
    type: 'safe_rest_completed',
    actorId: input.actorId,
    worldId: input.worldId,
    payload: { worldId: input.worldId, shelterId: state.core.shelterId }
  });
  emitEmergentStoryEvent({
    id: `${input.eventId}:two-world-handoff`,
    type: 'two_world_story_handoff',
    actorId: input.actorId,
    worldId: input.worldId,
    payload: {
      originWorldId: STORY_PRIMARY_WORLD_ID,
      siblingWorldId: TIDEGARDEN_WORLD_ID
    }
  });
  emitAccomplishment('second_hearth', input.eventId, input.actorId, input.worldId, {
    shelterId: state.core.shelterId,
    dayPhase: phase,
    liveEnclosureRevalidated: true
  });
  return { ok: true, idempotent: false };
}

export function canCertifyTidegardenShelter(
  worldId: string,
  playerPosition: THREE.Vector3,
  pieces: readonly StructurePiece[] = getPieces()
): boolean {
  const state = getHabitatWorldState(worldId);
  return Boolean(state && !state.shelterCertification
    && provenSharedShelter(state.core.cell, playerPosition, pieces));
}

export function canRestAtTidegardenHabitat(
  worldId: string,
  playerPosition: THREE.Vector3,
  dayPhase: number,
  pieces: readonly StructurePiece[] = getPieces()
): boolean {
  const state = getHabitatWorldState(worldId);
  return Boolean(state?.shelterCertification && !state.safeRest
    && isHabitatNight(normalizeDayPhase(dayPhase))
    && provenSharedShelter(state.core.cell, playerPosition, pieces));
}

export function isHabitatNight(dayPhase: number): boolean {
  return dayPhase >= 0.55 && dayPhase <= 0.95;
}

function provenSharedShelter(
  coreCell: HabitatCell,
  playerPosition: THREE.Vector3,
  pieces: readonly StructurePiece[]
): ShelterAnalysis | null {
  const analysis = analyzeShelterCell(coreCell, pieces);
  if (!analysis.sheltered) return null;
  const playerCell: HabitatCell = [
    Math.round(playerPosition.x / VOXEL_SCALE),
    Math.round(playerPosition.y / VOXEL_SCALE),
    Math.round(playerPosition.z / VOXEL_SCALE)
  ];
  if (!analysis.interiorCells.some(cell => sameCell(cell, coreCell))) return null;
  if (!analysis.interiorCells.some(cell => sameCell(cell, playerCell))) return null;
  return analysis;
}

function validRelationshipProof(proof: TidegardenRelationshipProof): boolean {
  return proof.worldId === TIDEGARDEN_WORLD_ID
    && proof.relationshipId === TIDEGARDEN_RELATIONSHIP_ID
    && proof.sourceKey === 'deterministic-waterline'
    && Number.isFinite(proof.waterDepth)
    && proof.waterDepth >= 1
    && proof.position.toArray().every(Number.isFinite);
}

function siteChoicePayload(proof: HabitatSiteProof): {
  worldId: typeof TIDEGARDEN_WORLD_ID;
  cell: HabitatCell;
  supportCell: HabitatCell;
  up: [number, number, number];
} {
  return {
    worldId: TIDEGARDEN_WORLD_ID,
    cell: [...proof.cell],
    supportCell: [...proof.supportCell],
    up: [proof.up.x, proof.up.y, proof.up.z]
  };
}

function siteChoiceMilestone(proof: HabitatSiteProof): string {
  return encodeTidegardenSiteChoice(siteChoicePayload(proof));
}

function habitatSiteProofFromPayload(payload: {
  worldId: string;
  cell: readonly [number, number, number];
  supportCell: readonly [number, number, number];
  up: readonly [number, number, number];
}): HabitatSiteProof | null {
  const cell: HabitatCell = [...payload.cell];
  const supportCell: HabitatCell = [...payload.supportCell];
  const upCell: HabitatCell = [...payload.up];
  if (payload.worldId !== TIDEGARDEN_WORLD_ID
    || !cell.every(Number.isInteger)
    || !supportCell.every(Number.isInteger)
    || !upCell.every(Number.isInteger)
    || !isAxisCell(upCell)
    || !sameCell(cell, [
      supportCell[0] + upCell[0],
      supportCell[1] + upCell[1],
      supportCell[2] + upCell[2]
    ])) return null;
  const up = new THREE.Vector3(...upCell);
  return {
    worldId: TIDEGARDEN_WORLD_ID,
    cell,
    supportCell,
    position: voxelCoordToWorld(cell[0], cell[1], cell[2]).addScaledVector(up, 0.24),
    up,
    shelterId: `habitat:${TIDEGARDEN_WORLD_ID}:${cell.join(',')}`
  };
}

function isAxisCell(cell: HabitatCell): boolean {
  return cell.every(value => value === -1 || value === 0 || value === 1)
    && Math.abs(cell[0]) + Math.abs(cell[1]) + Math.abs(cell[2]) === 1;
}

function sameSite(left: HabitatSiteProof, right: HabitatSiteProof): boolean {
  return left.worldId === right.worldId
    && sameCell(left.cell, right.cell)
    && sameCell(left.supportCell, right.supportCell)
    && left.up.equals(right.up);
}

function emitAccomplishment(
  accomplishmentId: string,
  evidenceId: string,
  actorId: ActorId,
  worldId: string,
  data: Record<string, string | number | boolean | number[]>
): void {
  const recorded = recordAccomplishment(accomplishmentId, {
    id: evidenceId,
    worldId,
    sourceKey: 'story-event',
    data
  }, actorId);
  if (!recorded) return;
  emitEmergentStoryEvent({
    id: `${evidenceId}:accomplishment:${accomplishmentId}`,
    type: 'accomplishment_recorded',
    actorId,
    worldId,
    payload: { accomplishmentId }
  });
}

function sameCell(
  left: readonly [number, number, number],
  right: readonly [number, number, number]
): boolean {
  return left[0] === right[0] && left[1] === right[1] && left[2] === right[2];
}

function normalizeDayPhase(value: number): number {
  return Number.isFinite(value) ? ((value % 1) + 1) % 1 : 0;
}
