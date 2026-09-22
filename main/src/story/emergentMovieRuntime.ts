import { movieShelterLayout, habitatCoreGroundPosition } from './movieShelterLayout.ts';
import { getShipPosition } from '../state/shipProximity.ts';
import { getPlayerWorldPosition } from '../state/playerFrame.ts';
import { voxelCoordToWorld, VOXEL_SCALE } from '../utils/cubeGravityConstants.ts';
import { pieceCost } from '../game/data/buildMaterials.ts';
import * as THREE from 'three';
import {
  dispatchGameplayCommand,
  resolveMultiplayerCommandLane
} from '../game/commandDispatchAdapter.ts';
import { hasAuthoritativeStructureReceipt } from '../game/authoritativeStructureReceipts.ts';
import { isMultiplayerAuthoritativeCommandUnsettled } from '../game/multiplayerSession.ts';
import type { CommandContext } from '../game/commands.ts';
import { RECIPES, type Recipe } from '../game/data/recipes.ts';
import { performPlayerCraft } from '../game/playerCrafting.ts';
import {
  placeStructureCommand,
  placeDoorwayCommand,
  fitDoorCommand,
  toggleDoorCommand
} from '../game/gameplayCommands.ts';
import { getLocalActorId, type ActorId } from '../game/playerActors.ts';
import { getItemCount } from '../game/systems/inventorySystem.ts';
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

/** The finite salvage cache pays the full repair BOM for both player and movie. */
export function prepareEmergentMovieWreckCraft(actorId: ActorId = getLocalActorId()): boolean {
  const binding = wreckBinding;
  if (!binding || binding.commandContext.actorId !== actorId) return false;
  const stage = getShipRepairStage();
  if (stage === 'hull_sealed') {
    return craftFromCarriedInventory(
      binding.commandContext,
      RECIPES.lift_cell,
      `story:movie:${actorId}:craft-lift-cell`
    );
  }
  if (stage === 'lift_online') {
    return craftFromCarriedInventory(
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
  const chosen = getTidegardenChosenHabitatSite(binding.commandContext.actorId);
  const site = findValidSpawnSite(
    binding.terrain,
    binding.planetSize,
    chosen?.position ?? playerPosition,
    { kind: 'player', maxSearchRadius: chosen ? 0 : Math.min(18, Math.floor(binding.planetSize / 2)) }
  );
  return site?.position.clone() ?? null;
}

/** Carried Kestrel assembler fallback for a Tidegarden-started movie rehearsal. */
export function prepareEmergentMovieHabitatCore(
  actorId: ActorId = getLocalActorId()
): boolean {
  const binding = settlementBinding;
  if (!binding || binding.commandContext.actorId !== actorId) return false;
  return craftFromCarriedInventory(
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

  // The marker can be within interaction range while the player's feet are
  // still in a neighbouring voxel. Validate that physical site BEFORE the
  // foundation transaction can spend anything. Missing foundation is the only
  // preflight failure this placement is allowed to resolve.
  const preflight = validateTidegardenHabitatSite({
    worldId: binding.commandContext.world.worldId, planetSize: binding.planetSize,
    playerPosition, terrain: binding.terrain, actorId, pieces: getPieces()
  });
  if (!preflight.ok && preflight.reason !== 'foundation-required') return false;
  const chosen = getTidegardenChosenHabitatSite(actorId);
  if (!chosen) return false;
  const upFace = faceIndexForNormal(chosen.up.x, chosen.up.y, chosen.up.z);
  const cell: HabitatCell = [...chosen.cell];
  const floorFace = oppositeFace(upFace);
  const existingFoundation = getPieceAt(cell[0], cell[1], cell[2], floorFace);
  if (!existingFoundation) {
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

  const room = currentMovieShelterLayout();
  if (!room) return false;
  const { upFace, layout } = room;
  const placements = layout.panels;
  const commandLane = resolveMultiplayerCommandLane();
  if (commandLane === 'blocked') return false;
  for (const [index, placement] of placements.entries()) {
    const existing = getPieceAt(
      placement.cell[0],
      placement.cell[1],
      placement.cell[2],
      placement.face
    );
    if (existing && existing.type !== placement.type) return false;
    if (!existing) {
      const input = { ...placement, material: 'wood' as const, up: upFace,
        commandId: `story:movie:${actorId}:habitat-panel:${index}` };
      const placed = dispatchGameplayCommand(() => placement.type === 'doorway'
        ? placeDoorwayCommand(binding.commandContext, input)
        : placeStructureCommand(binding.commandContext, input));
      if (!placed.ok) return false;
      // Serialize the online build through one accepted panel per retry. This
      // prevents configured persistence from racing enclosure certification.
      if (commandLane === 'online') return false;
    }
    if (commandLane === 'online' && !hasAuthoritativeStructureReceipt({
      worldId: TIDEGARDEN_WORLD_ID,
      cell: placement.cell,
      face: placement.face,
      // Fitting a leaf replaces the slot's placement receipt with type 'door'.
      type: placement.type === 'doorway' && existing?.leaf ? 'door' : placement.type,
      playerId: actorId
    })) return false;
  }
  const door = getPieceAt(...layout.door.cell, layout.door.face);
  if (!door?.leaf) {
    const fitted = dispatchGameplayCommand(() => fitDoorCommand(binding.commandContext, {
      ...layout.door, material: 'wood', commandId: `story:movie:${actorId}:habitat-door-fit`
    }));
    if (!fitted.ok || commandLane === 'online') return false;
  }
  if (commandLane === 'online' && !hasAuthoritativeStructureReceipt({
    worldId: TIDEGARDEN_WORLD_ID, ...layout.door, type: 'door', playerId: actorId
  })) return false;
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

/** Open the fitted door through the player's toggle transaction, within reach. */
export function openEmergentMovieShelterEgress(
  requested: boolean,
  actorId: ActorId = getLocalActorId()
): boolean {
  if (!requested) return false;
  const binding = settlementBinding;
  const room = currentMovieShelterLayout();
  if (!binding || !room || binding.commandContext.actorId !== actorId) return false;
  const door = getPieceAt(...room.layout.door.cell, room.layout.door.face);
  if (!door?.leaf) return false;
  const doorPosition = voxelCoordToWorld(...room.layout.door.cell)
    .addScaledVector(new THREE.Vector3(...FACE_DIRS[room.layout.door.face]), VOXEL_SCALE / 2);
  if (getPlayerWorldPosition().distanceTo(doorPosition) > 3.8) return false;
  if (door.open) return true;
  return dispatchGameplayCommand(() => toggleDoorCommand(binding.commandContext, {
    piece: door, commandId: `story:movie:${actorId}:ch10-shelter-door`
  })).ok;
}

/** Waypoint outside the actual doorway; normal movement still owns the body. */
export function emergentMovieShelterEgressGoal(): THREE.Vector3 | null {
  const room = currentMovieShelterLayout();
  if (!room) return null;
  const goal = voxelCoordToWorld(...room.layout.annex)
    .addScaledVector(new THREE.Vector3(...FACE_DIRS[room.layout.door.face]), VOXEL_SCALE * 1.15);
  const direction = new THREE.Vector3(...FACE_DIRS[room.layout.door.face]);
  if (getPlayerWorldPosition().clone().sub(goal).dot(direction) >= -0.4) return null;
  return goal;
}

export function emergentMovieShelterView(): { position: THREE.Vector3; target: THREE.Vector3 } | null {
  const room = currentMovieShelterLayout();
  const habitat = getHabitatWorldState(TIDEGARDEN_WORLD_ID);
  if (!room || !habitat) return null;
  const offset = new THREE.Vector3(...FACE_DIRS[room.extensionFace]).multiplyScalar(VOXEL_SCALE);
  return {
    position: new THREE.Vector3(...habitat.core.position).add(offset),
    target: habitatCoreGroundPosition(habitat.core.cell, habitat.core.up)
      .addScaledVector(new THREE.Vector3(...habitat.core.up), 0.65)
  };
}

function currentMovieShelterLayout() {
  const habitat = getHabitatWorldState(TIDEGARDEN_WORLD_ID);
  const chosen = getTidegardenChosenHabitatSite(settlementBinding?.commandContext.actorId ?? getLocalActorId());
  const core = habitat?.core ?? (chosen ? {
    cell: chosen.cell, supportCell: chosen.supportCell,
    up: [chosen.up.x, chosen.up.y, chosen.up.z] as [number, number, number],
    position: [chosen.position.x, chosen.position.y, chosen.position.z] as [number, number, number]
  } : null);
  if (!core) return null;
  const upFace = faceIndexForNormal(core.up[0], core.up[1], core.up[2]);
  const candidates = [0, 1, 2, 3, 4, 5].filter(face => face !== upFace && face !== oppositeFace(upFace));
  const ship = getShipPosition();
  if (ship) candidates.sort((a, b) => {
    const direction = new THREE.Vector3(...ship).sub(new THREE.Vector3(...core.position));
    return direction.dot(new THREE.Vector3(...FACE_DIRS[b])) - direction.dot(new THREE.Vector3(...FACE_DIRS[a]));
  });
  // Once the annex floor is placed its identity survives player/ship motion.
  const existing = candidates.find(face => {
    const cell = core.cell.map((value, i) => value + FACE_DIRS[face][i]) as HabitatCell;
    return getPieceAt(...cell, oppositeFace(upFace))?.type === 'foundation';
  });
  const extensionFace = existing ?? candidates.find(face => {
    const offset = FACE_DIRS[face];
    const support = core.supportCell.map((value, i) => value + offset[i]) as HabitatCell;
    const cell = core.cell.map((value, i) => value + offset[i]) as HabitatCell;
    const terrain = settlementBinding?.terrain;
    return !terrain || (terrain.shouldVoxelExist(...support) && !terrain.shouldVoxelExist(...cell)
      && !terrain.isWaterVoxel(...cell));
  });
  if (extensionFace === undefined) return null;
  return { upFace, extensionFace, layout: movieShelterLayout(core.cell, upFace, extensionFace) };
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

function craftFromCarriedInventory(
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
  const crafted = performPlayerCraft(context, recipe, commandId);
  // Online output is optimistic until command acceptance applies the server
  // inventory delta and projects its event. Hold the movie at this action.
  return crafted.ok && commandLane === 'offline';
}

/** The same material costs the Build tool will debit for the remaining enclosure. */
export function emergentMovieConstructionWoodNeeded(): number {
  const habitat = getHabitatWorldState(TIDEGARDEN_WORLD_ID);
  if (habitat?.shelterCertification) return 0;
  const room = currentMovieShelterLayout();
  const layout = room?.layout ?? movieShelterLayout([0, 0, 0], 2, 0);
  let needed = 0;
  for (const panel of layout.panels) {
    if (!room || !getPieceAt(...panel.cell, panel.face)) {
      needed += pieceCost(panel.type, 'wood').find(stack => stack.id === 'wood')?.qty ?? 0;
    }
  }
  if (!room || !getPieceAt(...layout.door.cell, layout.door.face)?.leaf) {
    needed += pieceCost('door', 'wood').find(stack => stack.id === 'wood')?.qty ?? 0;
  }
  return needed;
}

export function resetEmergentMovieRuntimeForTests(): void {
  wreckBinding = null;
  settlementBinding = null;
}
