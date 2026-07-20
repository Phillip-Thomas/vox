import * as THREE from 'three';
import type { FaunaKind } from './faunaModel.ts';
import { voxelSystem } from './efficientVoxelSystem.ts';
import { voxelCoordToWorld } from './cubeGravityConstants.ts';
import { dominantFaceForPosition, FACE_NORMALS } from './surfaceControls.ts';
import {
  FACE_DIRS,
  faceIndexForNormal,
  getPieceAt,
  getStructureVersion,
  getVolumeAt,
  isStructurePieceSolid,
  oppositeFace
} from '../game/systems/structureSystem.ts';
import { getTreeHarvestVersion, isTreeHarvested } from '../game/systems/treeHarvest.ts';
import type { PlanetArtDirection } from './planetArtDirection.ts';
import { shouldPlaceTreeAtVoxel } from './treePopulation.ts';

/**
 * Lightweight navigation collision contract for procedural fauna. Fauna are
 * instanced render agents rather than Rapier bodies, so their routes must query
 * the same world occupancy represented by tree instances and structure bodies.
 */
export interface FaunaNavigationObstacles {
  /** Monotonic world-occupancy identity used to gate in-flight revalidation. */
  revision?: () => string;
  /** True when the animal cannot stand/swim/hover at this surface anchor. */
  isAnchorBlocked(kind: FaunaKind, x: number, y: number, z: number): boolean;
  /** True when travelling between two adjacent surface anchors crosses a barrier. */
  isRouteBlocked(
    kind: FaunaKind,
    fromX: number,
    fromY: number,
    fromZ: number,
    toX: number,
    toY: number,
    toZ: number
  ): boolean;
}

export interface LiveFaunaNavigationObstacleOptions {
  terrainSeed: number;
  treeDensity: number;
  artDirection: PlanetArtDirection;
  /** Species-aware vertical body span expressed in build-grid cells. */
  clearanceCellsForKind?: (kind: FaunaKind) => number;
}

const _world = new THREE.Vector3();
const TANGENT_STEPS_X: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]
];
const TANGENT_STEPS_Y: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]
];
const TANGENT_STEPS_Z: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]
];

function surfaceUpStep(x: number, y: number, z: number): readonly [number, number, number] {
  voxelCoordToWorld(x, y, z, _world);
  const up = FACE_NORMALS[dominantFaceForPosition(_world)];
  return [Math.round(up.x), Math.round(up.y), Math.round(up.z)];
}

function cellAtLevel(
  x: number,
  y: number,
  z: number,
  up: readonly [number, number, number],
  level: number
): [number, number, number] {
  return [x + up[0] * level, y + up[1] * level, z + up[2] * level];
}

function solidPanelAt(cell: readonly [number, number, number], face: number): boolean {
  const piece = getPieceAt(cell[0], cell[1], cell[2], face);
  return piece !== undefined && isStructurePieceSolid(piece);
}

/**
 * A volume occupies the body cell over a terrain anchor. Tall animals also
 * reject a solid ceiling/foundation crossing their vertical clearance span;
 * the support-facing foundation under their feet is deliberately not queried.
 */
export function isFaunaStructureAnchorBlocked(
  x: number,
  y: number,
  z: number,
  clearanceCells = 1
): boolean {
  const up = surfaceUpStep(x, y, z);
  const upFace = faceIndexForNormal(up[0], up[1], up[2]);
  const levels = Math.max(1, Math.trunc(clearanceCells));
  for (let level = 1; level <= levels; level++) {
    const cell = cellAtLevel(x, y, z, up, level);
    const volume = getVolumeAt(cell[0], cell[1], cell[2]);
    if (volume !== undefined && isStructurePieceSolid(volume)) return true;
    if (level >= levels) continue;
    const above = cellAtLevel(x, y, z, up, level + 1);
    if (solidPanelAt(cell, upFace) || solidPanelAt(above, oppositeFace(upFace))) return true;
  }
  return false;
}

type ProjectedFace = number | 'radial' | null;

function projectedCardinalFace(
  dx: number,
  dy: number,
  dz: number,
  up: readonly [number, number, number]
): ProjectedFace {
  const alongUp = dx * up[0] + dy * up[1] + dz * up[2];
  const tx = dx - up[0] * alongUp;
  const ty = dy - up[1] * alongUp;
  const tz = dz - up[2] * alongUp;
  const tangentLength = Math.abs(tx) + Math.abs(ty) + Math.abs(tz);
  // An exact cube-edge tie may make a valid step radial in one endpoint's newly
  // selected face frame. The other endpoint still supplies the meaningful wall
  // edge; do not turn the cube seam into an artificial navigation fence.
  if (tangentLength === 0) return 'radial';
  if (tangentLength !== 1) return null;
  return faceIndexForNormal(tx, ty, tz);
}

function solidBoundaryAt(
  cell: readonly [number, number, number],
  face: number
): boolean {
  if (solidPanelAt(cell, face)) return true;
  const direction = FACE_DIRS[face];
  const adjacent: [number, number, number] = [
    cell[0] + direction[0],
    cell[1] + direction[1],
    cell[2] + direction[2]
  ];
  return solidPanelAt(adjacent, oppositeFace(face));
}

/**
 * Check both representations of a shared cell boundary. Panels are stored on
 * one cell face, but builders and restored saves may approach that boundary
 * from either side. Level changes retain one tangent grid step, so the climb
 * component is stripped before resolving the crossed face.
 */
export function isFaunaStructureRouteBlocked(
  fromX: number,
  fromY: number,
  fromZ: number,
  toX: number,
  toY: number,
  toZ: number,
  clearanceCells = 1
): boolean {
  if (fromX === toX && fromY === toY && fromZ === toZ) {
    return isFaunaStructureAnchorBlocked(toX, toY, toZ, clearanceCells);
  }

  const fromUp = surfaceUpStep(fromX, fromY, fromZ);
  const toUp = surfaceUpStep(toX, toY, toZ);
  const dx = toX - fromX;
  const dy = toY - fromY;
  const dz = toZ - fromZ;
  const outgoingFace = projectedCardinalFace(dx, dy, dz, fromUp);
  const incomingFace = projectedCardinalFace(-dx, -dy, -dz, toUp);
  if (outgoingFace === null || incomingFace === null ||
    (outgoingFace === 'radial' && incomingFace === 'radial')) {
    // Fauna currently take one cardinal surface step at a time. Conservatively
    // reject a malformed longer/diagonal route instead of allowing tunnelling.
    return true;
  }

  const levels = Math.max(1, Math.trunc(clearanceCells));
  for (let level = 1; level <= levels; level++) {
    const fromCell = cellAtLevel(fromX, fromY, fromZ, fromUp, level);
    const toCell = cellAtLevel(toX, toY, toZ, toUp, level);
    if ((outgoingFace !== 'radial' && solidBoundaryAt(fromCell, outgoingFace)) ||
      (incomingFace !== 'radial' && solidBoundaryAt(toCell, incomingFace))) return true;
  }
  return isFaunaStructureAnchorBlocked(toX, toY, toZ, levels);
}

export function isProceduralTreeObstacle(
  x: number,
  y: number,
  z: number,
  options: LiveFaunaNavigationObstacleOptions
): boolean {
  if (options.treeDensity <= 0 || isTreeHarvested(x, y, z)) return false;
  const voxel = voxelSystem.getVoxel(x, y, z);
  return voxel !== undefined && shouldPlaceTreeAtVoxel(
    voxel,
    x,
    y,
    z,
    options.treeDensity,
    options.terrainSeed,
    options.artDirection
  );
}

function isProceduralTreeClearanceObstacle(
  kind: FaunaKind,
  x: number,
  y: number,
  z: number,
  options: LiveFaunaNavigationObstacleOptions
): boolean {
  if (isProceduralTreeObstacle(x, y, z, options)) return true;
  // The largest bodies can overlap a flared root from the next 2wu lane once
  // their deterministic anchor scatter is applied. Reserve one tangent neighbor
  // for grazers/woollies; smaller fauna retain exact-cell clearance.
  if (kind !== 'grazer' && kind !== 'woolly') return false;
  const up = surfaceUpStep(x, y, z);
  const tangentSteps = up[0] !== 0
    ? TANGENT_STEPS_X
    : up[1] !== 0 ? TANGENT_STEPS_Y : TANGENT_STEPS_Z;
  for (const step of tangentSteps) {
    if (isProceduralTreeObstacle(x + step[0], y + step[1], z + step[2], options)) return true;
  }
  return false;
}

/**
 * Live queries intentionally read the module stores on every route decision.
 * Doors therefore become passable as soon as they open, felled trees stop
 * blocking immediately, and a wall placed during a stride is caught by the
 * per-frame route safety check without rebuilding navigation meshes.
 */
export function createLiveFaunaNavigationObstacles(
  options: LiveFaunaNavigationObstacleOptions
): FaunaNavigationObstacles {
  const clearanceByKind = new Map<FaunaKind, number>();
  const clearanceFor = (kind: FaunaKind): number => {
    const cached = clearanceByKind.get(kind);
    if (cached !== undefined) return cached;
    const clearance = Math.max(1, Math.trunc(options.clearanceCellsForKind?.(kind) ?? 1));
    clearanceByKind.set(kind, clearance);
    return clearance;
  };
  let cachedRevision = '';
  let cachedWorldId: ReturnType<typeof voxelSystem.getWorldId> | undefined;
  let cachedVoxelVersion = -1;
  let cachedStructureVersion = -1;
  let cachedHarvestVersion = -1;
  return {
    revision: () => {
      const worldId = voxelSystem.getWorldId();
      const voxelVersion = voxelSystem.getEditVersion();
      const structureVersion = getStructureVersion();
      const harvestVersion = getTreeHarvestVersion();
      if (worldId !== cachedWorldId || voxelVersion !== cachedVoxelVersion ||
        structureVersion !== cachedStructureVersion || harvestVersion !== cachedHarvestVersion) {
        cachedWorldId = worldId;
        cachedVoxelVersion = voxelVersion;
        cachedStructureVersion = structureVersion;
        cachedHarvestVersion = harvestVersion;
        cachedRevision = `${worldId}:${voxelVersion}:${options.terrainSeed}:${options.treeDensity}:${structureVersion}:${harvestVersion}`;
      }
      return cachedRevision;
    },
    isAnchorBlocked: (kind, x, y, z) =>
      isFaunaStructureAnchorBlocked(x, y, z, clearanceFor(kind))
      || isProceduralTreeClearanceObstacle(kind, x, y, z, options),
    isRouteBlocked: (kind, fromX, fromY, fromZ, toX, toY, toZ) =>
      isFaunaStructureRouteBlocked(
        fromX,
        fromY,
        fromZ,
        toX,
        toY,
        toZ,
        clearanceFor(kind)
      )
      || isProceduralTreeClearanceObstacle(kind, toX, toY, toZ, options)
  };
}
