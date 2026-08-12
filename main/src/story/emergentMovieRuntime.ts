import * as THREE from 'three';
import {
  dispatchGameplayCommand,
  resolveMultiplayerCommandLane
} from '../game/commandDispatchAdapter.ts';
import { hasAuthoritativeStructureReceipt } from '../game/authoritativeStructureReceipts.ts';
import { isMultiplayerAuthoritativeCommandUnsettled } from '../game/multiplayerSession.ts';
import type { CommandContext } from '../game/commands.ts';
import { RECIPES, type Recipe } from '../game/data/recipes.ts';
import { getAccessibleStations } from '../game/data/stations.ts';
import {
  craftRecipeCommand,
  placeStructureCommand,
  removeStructureCommand
} from '../game/gameplayCommands.ts';
import { getLocalActorId, type ActorId } from '../game/playerActors.ts';
import { getItemCount, addItem } from '../game/systems/inventorySystem.ts';
import { getHabitatWorldState, type HabitatCell } from '../game/systems/habitatSystem.ts';
import { getShipRepairStage } from '../game/systems/shipRestoration.ts';
import {
  FACE_DIRS,
  faceIndexForNormal,
  getPieceAt,
  getPieces,
  oppositeFace
} from '../game/systems/structureSystem.ts';
import type { SpawnTerrainQuery } from '../utils/spawnValidation.ts';
import { findValidSpawnSite } from '../utils/spawnValidation.ts';
import type { LiveAgentSurfaceTerrain } from '../utils/agentSurfaceNavigationRuntime.ts';
import {
  activateTidegardenHabitatCore,
  certifyTidegardenShelter,
  chooseTidegardenHabitatSite,
  completeTidegardenSafeRest,
  getTidegardenChosenHabitatSite,
  type TidegardenRelationshipProof,
  validateTidegardenHabitatSite
} from './tidegardenSettlement.ts';
import { TIDEGARDEN_WORLD_ID } from './tidegardenRoute.ts';

export interface EmergentMovieWreckBinding {
  commandContext: CommandContext;
  workstationPosition: THREE.Vector3;
}

export interface EmergentMovieSettlementBinding {
  commandContext: CommandContext;
  planetSize: number;
  terrain: SpawnTerrainQuery;
  agentTerrain?: LiveAgentSurfaceTerrain;
  relationship: TidegardenRelationshipProof | null;
}

let wreckBinding: EmergentMovieWreckBinding | null = null;
let settlementBinding: EmergentMovieSettlementBinding | null = null;

/**
 * Live scene bindings for movie mode. They expose the exact command context and
 * validated terrain already used by the player's interactions; the autopilot
 * never invents a parallel world or proof surface.
 */
export function registerEmergentMovieWreckBinding(
  binding: EmergentMovieWreckBinding
): () => void {
  wreckBinding = {
    ...binding,
    workstationPosition: binding.workstationPosition.clone()
  };
  return () => {
    if (wreckBinding?.commandContext === binding.commandContext) wreckBinding = null;
  };
}

export function getEmergentMovieWreckBinding(): EmergentMovieWreckBinding | null {
  return wreckBinding;
}

export function registerEmergentMovieSettlementBinding(
  binding: EmergentMovieSettlementBinding
): () => void {
  settlementBinding = binding;
  return () => {
    if (settlementBinding === binding) settlementBinding = null;
  };
}

export function getEmergentMovieSettlementBinding(): EmergentMovieSettlementBinding | null {
  return settlementBinding;
}

/**
 * The wreck's finite cache pays the first three reconstruction acts. Movie
 * screenings provision only the missing recipe inputs for the two fabrication
 * demonstrations, then submit the same craft command as the UI. Progress still
 * depends on the canonical repair transactions consuming those crafted parts.
 */
export function prepareEmergentMovieWreckCraft(actorId: ActorId = getLocalActorId()): boolean {
  const binding = wreckBinding;
  if (!binding || binding.commandContext.actorId !== actorId) return false;
  const stage = getShipRepairStage();
  if (stage === 'hull_sealed') {
    return provisionAndCraft(
      binding.commandContext,
      RECIPES.lift_cell,
      `story:movie:${actorId}:craft-lift-cell`
    );
  }
  if (stage === 'lift_online') {
    return provisionAndCraft(
      binding.commandContext,
      RECIPES.logic_wafer,
      `story:movie:${actorId}:craft-flight-wafer`
    );
  }
  return true;
}

export function findEmergentMovieHabitatGoal(
  playerPosition: THREE.Vector3
): THREE.Vector3 | null {
  const binding = settlementBinding;
  if (!binding || binding.commandContext.world.worldId !== TIDEGARDEN_WORLD_ID) return null;
  const site = findValidSpawnSite(
    binding.terrain,
    binding.planetSize,
    playerPosition,
    { kind: 'player', maxSearchRadius: Math.min(18, Math.floor(binding.planetSize / 2)) }
  );
  return site?.position.clone() ?? null;
}

/** Carried Kestrel assembler fallback for a Tidegarden-started movie rehearsal. */
export function prepareEmergentMovieHabitatCore(
  actorId: ActorId = getLocalActorId()
): boolean {
  const binding = settlementBinding;
  if (!binding || binding.commandContext.actorId !== actorId) return false;
  return provisionAndCraft(
    binding.commandContext,
    RECIPES.habitat_core,
    `story:movie:${actorId}:craft-habitat-core-tidegarden`
  );
}

/** Place a real foundation, validate it against live terrain, then spend the Core. */
export function installEmergentMovieHabitatCore(
  playerPosition: THREE.Vector3,
  actorId: ActorId = getLocalActorId()
): boolean {
  const binding = settlementBinding;
  if (!binding || binding.commandContext.actorId !== actorId) return false;
  if (getHabitatWorldState(TIDEGARDEN_WORLD_ID)) return true;
  const commandLane = resolveMultiplayerCommandLane();
  if (commandLane === 'blocked') return false;

  if (!getTidegardenChosenHabitatSite(actorId)) {
    const siteCommandId = `story:tidegarden:${actorId}:movie-site-chosen`;
    if (commandLane === 'online' && isMultiplayerAuthoritativeCommandUnsettled(
      siteCommandId,
      TIDEGARDEN_WORLD_ID
    )) return false;
    const chosen = chooseTidegardenHabitatSite({
      worldId: binding.commandContext.world.worldId,
      planetSize: binding.planetSize,
      playerPosition,
      terrain: binding.terrain,
      actorId,
      pieces: getPieces(),
      eventId: siteCommandId,
      commandContext: binding.commandContext
    });
    if (!chosen.ok || chosen.pending) return false;
  }

  const support = findValidSpawnSite(
    binding.terrain,
    binding.planetSize,
    playerPosition,
    { kind: 'player', maxSearchRadius: 0 }
  );
  if (!support) return false;
  const upFace = faceIndexForNormal(support.up.x, support.up.y, support.up.z);
  const up = FACE_DIRS[upFace];
  const cell: HabitatCell = [
    support.supportVoxel.x + up[0],
    support.supportVoxel.y + up[1],
    support.supportVoxel.z + up[2]
  ];
  const floorFace = oppositeFace(upFace);
  const existingFoundation = getPieceAt(cell[0], cell[1], cell[2], floorFace);
  if (!existingFoundation) {
    // Screening-only provisioning is an offline convenience. In co-op, local
    // inventory must already mirror resources the server can legally debit.
    if (commandLane === 'offline') provisionItem('wood', 4, actorId);
    const foundation = dispatchGameplayCommand(() => placeStructureCommand(
      binding.commandContext,
      {
        cell,
        face: floorFace,
        type: 'foundation',
        material: 'wood',
        up: upFace,
        commandId: `story:movie:${actorId}:habitat-foundation`
      }
    ));
    if (!foundation.ok) return false;
    // Online geometry is optimistic until the matching world event returns.
    if (commandLane === 'online') return false;
  } else if (existingFoundation.type !== 'foundation') {
    return false;
  }
  if (commandLane === 'online' && !hasAuthoritativeStructureReceipt({
    worldId: TIDEGARDEN_WORLD_ID,
    cell,
    face: floorFace,
    type: 'foundation',
    playerId: actorId
  })) return false;
  const validated = validateTidegardenHabitatSite({
    worldId: binding.commandContext.world.worldId,
    planetSize: binding.planetSize,
    playerPosition,
    terrain: binding.terrain,
    actorId,
    pieces: getPieces()
  });
  if (!validated.ok) return false;
  const coreCommandId = `story:tidegarden:${actorId}:movie-habitat-core-online`;
  if (commandLane === 'online' && isMultiplayerAuthoritativeCommandUnsettled(
    coreCommandId,
    TIDEGARDEN_WORLD_ID
  )) return false;
  const activated = activateTidegardenHabitatCore({
    proof: validated.proof,
    eventId: coreCommandId,
    actorId,
    commandContext: binding.commandContext
  });
  return activated.ok && !activated.pending;
}

/**
 * Build a two-cell sealed room through normal placement commands and certify it
 * through the same flood-fill proof used by the interaction prompt.
 */
export function buildAndCertifyEmergentMovieShelter(
  playerPosition: THREE.Vector3,
  actorId: ActorId = getLocalActorId()
): boolean {
  const binding = settlementBinding;
  const habitat = getHabitatWorldState(TIDEGARDEN_WORLD_ID);
  if (!binding || !habitat || binding.commandContext.actorId !== actorId) return false;
  if (habitat.shelterCertification) return true;

  const lower = habitat.core.cell;
  const upFace = faceIndexForNormal(
    habitat.core.up[0],
    habitat.core.up[1],
    habitat.core.up[2]
  );
  const up = FACE_DIRS[upFace];
  const upper: HabitatCell = [
    lower[0] + up[0],
    lower[1] + up[1],
    lower[2] + up[2]
  ];
  const floorFace = oppositeFace(upFace);
  const wallFaces = [0, 1, 2, 3, 4, 5].filter(face => face !== upFace && face !== floorFace);
  const placements = [
    { cell: upper, face: upFace, type: 'ceiling' as const },
    ...[lower, upper].flatMap(cell => wallFaces.map(face => ({
      cell,
      face,
      type: 'wall' as const
    })))
  ];
  const commandLane = resolveMultiplayerCommandLane();
  if (commandLane === 'blocked') return false;
  if (commandLane === 'offline') provisionItem('wood', 19, actorId);
  for (const [index, placement] of placements.entries()) {
    const existing = getPieceAt(
      placement.cell[0],
      placement.cell[1],
      placement.cell[2],
      placement.face
    );
    if (existing && existing.type !== placement.type) return false;
    if (!existing) {
      const placed = dispatchGameplayCommand(() => placeStructureCommand(binding.commandContext, {
        ...placement,
        material: 'wood',
        up: upFace,
        commandId: `story:movie:${actorId}:habitat-panel:${index}`
      }));
      if (!placed.ok) return false;
      // Serialize the online build through one accepted panel per retry. This
      // prevents configured persistence from racing enclosure certification.
      if (commandLane === 'online') return false;
    }
    if (commandLane === 'online' && !hasAuthoritativeStructureReceipt({
      worldId: TIDEGARDEN_WORLD_ID,
      cell: placement.cell,
      face: placement.face,
      type: placement.type,
      playerId: actorId
    })) return false;
  }
  const certificationCommandId = `story:tidegarden:${actorId}:movie-shelter-certified`;
  if (commandLane === 'online' && isMultiplayerAuthoritativeCommandUnsettled(
    certificationCommandId,
    TIDEGARDEN_WORLD_ID
  )) return false;
  const certified = certifyTidegardenShelter({
    worldId: TIDEGARDEN_WORLD_ID,
    playerPosition,
    eventId: certificationCommandId,
    actorId,
    pieces: getPieces(),
    commandContext: binding.commandContext
  });
  return certified.ok && !certified.pending;
}

/**
 * The chapter-10 egress face.
 *
 * The movie lane's shelter is sealed by its own certification, and chapter 10
 * opens with a night walk from the hearth to the Kestrel Fabricator — the run's
 * ST-0 evidence window. This opens ONE authored face so the autopilot can leave
 * a shelter it built itself.
 *
 * `outsideCameraFrustum` is supplied by the caller and is a precondition, not a
 * hint: the movie photographs neither the scaffolding nor its absence, so the
 * face may only open while it is off camera, and the caller holds a beat before
 * the first step so no strip frame straddles the change. Movie lane only — a
 * human-built shelter is never touched, because there is no binding outside a
 * screening.
 */
export function openEmergentMovieShelterEgress(
  outsideCameraFrustum: boolean,
  actorId: ActorId = getLocalActorId()
): boolean {
  if (!outsideCameraFrustum) return false;
  const binding = settlementBinding;
  const habitat = getHabitatWorldState(TIDEGARDEN_WORLD_ID);
  if (!binding || !habitat || binding.commandContext.actorId !== actorId) return false;
  const upFace = faceIndexForNormal(
    habitat.core.up[0],
    habitat.core.up[1],
    habitat.core.up[2]
  );
  const floorFace = oppositeFace(upFace);
  const wallFaces = [0, 1, 2, 3, 4, 5].filter(face => face !== upFace && face !== floorFace);
  const egressFace = wallFaces[0];
  const cell = habitat.core.cell;
  const existing = getPieceAt(cell[0], cell[1], cell[2], egressFace);
  if (!existing) return true;
  if (existing.type !== 'wall') return false;
  if (resolveMultiplayerCommandLane() !== 'offline') return false;
  const removed = dispatchGameplayCommand(() => removeStructureCommand(
    binding.commandContext,
    { cell, face: egressFace, commandId: `story:movie:${actorId}:ch10-shelter-egress` }
  ));
  return removed.ok;
}

export function completeEmergentMovieSafeRest(
  playerPosition: THREE.Vector3,
  dayPhase: number,
  actorId: ActorId = getLocalActorId()
): boolean {
  const binding = settlementBinding;
  if (!binding || binding.commandContext.actorId !== actorId) return false;
  const commandLane = resolveMultiplayerCommandLane();
  if (commandLane === 'blocked') return false;
  const restCommandId = `story:tidegarden:${actorId}:movie-safe-rest`;
  if (commandLane === 'online' && isMultiplayerAuthoritativeCommandUnsettled(
    restCommandId,
    TIDEGARDEN_WORLD_ID
  )) return false;
  const completed = completeTidegardenSafeRest({
    worldId: TIDEGARDEN_WORLD_ID,
    playerPosition,
    dayPhase,
    eventId: restCommandId,
    actorId,
    pieces: getPieces(),
    commandContext: binding.commandContext
  });
  return completed.ok && !completed.pending;
}

function provisionAndCraft(
  context: CommandContext,
  recipe: Recipe,
  commandId: string
): boolean {
  const commandLane = resolveMultiplayerCommandLane();
  if (commandLane === 'blocked') return false;
  if (commandLane === 'online' && isMultiplayerAuthoritativeCommandUnsettled(
    commandId,
    context.world.worldId
  )) return false;
  if (recipe.outputs.every(output => getItemCount(output.id, context.actorId) >= output.qty)) {
    return true;
  }
  const stations = getAccessibleStations();
  if (!stations.includes(recipe.station)) return false;
  if (commandLane === 'offline') {
    for (const input of recipe.inputs) provisionItem(input.id, input.qty, context.actorId);
  }
  const crafted = dispatchGameplayCommand(
    () => craftRecipeCommand(context, {
      recipe,
      craftContext: { stations },
      commandId
    }),
    {
      multiplayer: {
        commandType: 'recipe_crafted',
        payload: { recipeId: recipe.id }
      }
    }
  );
  // Online output is optimistic until command acceptance applies the server
  // inventory delta and projects its event. Hold the movie at this action.
  return crafted.ok && commandLane === 'offline';
}

function provisionItem(
  itemId: Parameters<typeof addItem>[0],
  required: number,
  actorId: ActorId
): void {
  const missing = required - getItemCount(itemId, actorId);
  if (missing > 0) addItem(itemId, missing, actorId);
}

export function resetEmergentMovieRuntimeForTests(): void {
  wreckBinding = null;
  settlementBinding = null;
}
