import * as THREE from 'three';
import type { BlockId } from '../game/data/blocks.ts';
import type { CubeFace } from '../types/cube.ts';
import {
  PLAYER_CENTER_CLEARANCE,
  VOXEL_SCALE,
  voxelCoordToWorld
} from './cubeGravityConstants.ts';
import { SHIP_REST_CLEARANCE, shipPlayerEgressOffset } from './shipDesign.ts';
import { FACE_NORMALS, dominantFaceForPosition } from './surfaceControls.ts';

/** Static terrain queries shared by the procedural generator and focused tests. */
export interface SpawnTerrainQuery {
  shouldVoxelExist(x: number, y: number, z: number): boolean;
  isWaterVoxel(x: number, y: number, z: number): boolean;
  generateBlockForPosition(x: number, y: number, z: number): BlockId;
}

export type SpawnKind = 'player' | 'ship';

export interface SpawnSearchOptions {
  kind: SpawnKind;
  /** Force a supporting cube face. Otherwise the preferred position owns it. */
  face?: CubeFace;
  /** Bounded nearest-site search in terrain cells. */
  maxSearchRadius?: number;
  /** For a ship, also require a dry, level, boardable player exit behind it. */
  requirePlayerEgress?: boolean;
}

export interface ValidatedSpawnSite {
  kind: SpawnKind;
  face: CubeFace;
  up: THREE.Vector3;
  supportVoxel: { x: number; y: number; z: number };
  position: THREE.Vector3;
  searchDistanceCells: number;
  relocated: boolean;
}

/** True only for deliberate atmospheric/approach placement above the surface. */
export function shouldBypassSurfaceSpawnSettle(
  position: Pick<THREE.Vector3, 'x' | 'y' | 'z'>,
  planetWorldRadius: number,
  margin = 8
): boolean {
  const cubeSurfaceDistance = Math.max(
    Math.abs(position.x),
    Math.abs(position.y),
    Math.abs(position.z)
  );
  return cubeSurfaceDistance > planetWorldRadius + margin;
}

interface FaceFrame {
  up: readonly [number, number, number];
  tangentU: readonly [number, number, number];
  tangentV: readonly [number, number, number];
}

const FACE_FRAMES: Record<CubeFace, FaceFrame> = {
  top: { up: [0, 1, 0], tangentU: [1, 0, 0], tangentV: [0, 0, 1] },
  bottom: { up: [0, -1, 0], tangentU: [1, 0, 0], tangentV: [0, 0, 1] },
  right: { up: [1, 0, 0], tangentU: [0, 1, 0], tangentV: [0, 0, 1] },
  left: { up: [-1, 0, 0], tangentU: [0, 1, 0], tangentV: [0, 0, 1] },
  front: { up: [0, 0, 1], tangentU: [1, 0, 0], tangentV: [0, 1, 0] },
  back: { up: [0, 0, -1], tangentU: [1, 0, 0], tangentV: [0, 1, 0] }
};

const PLAYER_EXTRA_CLEARANCE = 1;
// Rapier deliberately shrinks voxel colliders from the visible 1.0wu half-size
// to 0.99wu. Permit that tiny grounded contact overlap while still rejecting a
// visibly embedded capsule or any contact with water.
const SOLID_CONTACT_TOLERANCE = 0.02;
// ShipController measures 2.5 from a Rapier contact surface. Static spawn
// queries start at the support voxel centre, so they must include its half
// extent or the Kestrel's 2.42wu legs are buried nearly a full unit.
const SHIP_GROUND_CLEARANCE = VOXEL_SCALE / 2 + SHIP_REST_CLEARANCE;

const PROFILE: Record<SpawnKind, {
  footprintRadius: number;
  clearanceCells: number;
  restClearance: number;
  maxDropCells: number;
}> = {
  // A 3x3 level patch prevents a capsule from starting against a step wall.
  player: {
    footprintRadius: 1,
    clearanceCells: 3,
    restClearance: PLAYER_CENTER_CLEARANCE + PLAYER_EXTRA_CLEARANCE,
    maxDropCells: 0
  },
  // The Kestrel's four feet sit inside a three-by-three-cell pad. The wing tips
  // overhang it visually, as aircraft wings should; they are not ground contacts.
  ship: {
    footprintRadius: 1,
    clearanceCells: 2,
    restClearance: SHIP_GROUND_CLEARANCE,
    maxDropCells: 0
  }
};

function dotCoord(
  x: number,
  y: number,
  z: number,
  axis: readonly [number, number, number]
): number {
  return x * axis[0] + y * axis[1] + z * axis[2];
}

function composeCoord(
  frame: FaceFrame,
  height: number,
  u: number,
  v: number
): { x: number; y: number; z: number } {
  return {
    x: frame.up[0] * height + frame.tangentU[0] * u + frame.tangentV[0] * v,
    y: frame.up[1] * height + frame.tangentU[1] * u + frame.tangentV[1] * v,
    z: frame.up[2] * height + frame.tangentU[2] * u + frame.tangentV[2] * v
  };
}

function addAxis(
  coord: { x: number; y: number; z: number },
  axis: readonly [number, number, number],
  amount: number
): { x: number; y: number; z: number } {
  return {
    x: coord.x + axis[0] * amount,
    y: coord.y + axis[1] * amount,
    z: coord.z + axis[2] * amount
  };
}

function surfaceInColumn(
  terrain: SpawnTerrainQuery,
  frame: FaceFrame,
  planetRadiusCells: number,
  u: number,
  v: number
): { coord: { x: number; y: number; z: number }; height: number } | null {
  // Terrain rendering is bounded to [-floor(radius), floor(radius)]. Starting at
  // the outer shell and walking inward selects the exposed support on this face.
  for (let height = planetRadiusCells; height >= 0; height--) {
    const coord = composeCoord(frame, height, u, v);
    if (!terrain.shouldVoxelExist(coord.x, coord.y, coord.z)) continue;
    const outward = addAxis(coord, frame.up, 1);
    // Noise can logically bulge outside the rendered/collider cube. A boundary
    // voxel is exposed by definition; an unrendered +1 cell is not a ceiling.
    if (
      height < planetRadiusCells
      && terrain.shouldVoxelExist(outward.x, outward.y, outward.z)
    ) continue;
    return { coord, height };
  }
  return null;
}

function isHazardousSupport(terrain: SpawnTerrainQuery, x: number, y: number, z: number): boolean {
  return terrain.generateBlockForPosition(x, y, z) === 'lava';
}

function inspectCandidate(
  terrain: SpawnTerrainQuery,
  frame: FaceFrame,
  planetRadiusCells: number,
  centerU: number,
  centerV: number,
  kind: SpawnKind
): { x: number; y: number; z: number } | null {
  const profile = PROFILE[kind];
  const center = surfaceInColumn(terrain, frame, planetRadiusCells, centerU, centerV);
  if (!center) return null;
  // Keep the entire pad owned by this cube face. Near an edge, a nominal "top"
  // column can have a tangent coordinate larger than its support height; gravity
  // then correctly resolves to a side face and the actor starts sideways against
  // the terrain. One-cell dominance margin prevents that ambiguous handoff.
  if (
    center.height < Math.abs(centerU) + profile.footprintRadius + 1
    || center.height < Math.abs(centerV) + profile.footprintRadius + 1
  ) {
    return null;
  }

  // Every cell under the entity must resolve to the same support height. Initial
  // placement and touchdown should be boringly reliable, not merely recoverable.
  for (let du = -profile.footprintRadius; du <= profile.footprintRadius; du++) {
    for (let dv = -profile.footprintRadius; dv <= profile.footprintRadius; dv++) {
      const support = surfaceInColumn(
        terrain,
        frame,
        planetRadiusCells,
        centerU + du,
        centerV + dv
      );
      if (
        !support
        || support.height > center.height
        || center.height - support.height > profile.maxDropCells
      ) return null;
      if (
        isHazardousSupport(terrain, support.coord.x, support.coord.y, support.coord.z)
        || terrain.isWaterVoxel(support.coord.x, support.coord.y, support.coord.z)
      ) return null;

      // Reject flooded feet/legs and terrain overhangs throughout the occupied
      // volume. This catches beaches below sea level as well as cave/cube spawns.
      const supportDrop = center.height - support.height;
      for (let lift = 1; lift <= profile.clearanceCells + supportDrop; lift++) {
        const cell = addAxis(support.coord, frame.up, lift);
        const cellHeight = support.height + lift;
        if (
          (cellHeight <= planetRadiusCells
            && terrain.shouldVoxelExist(cell.x, cell.y, cell.z))
          || terrain.isWaterVoxel(cell.x, cell.y, cell.z)
        ) {
          return null;
        }
      }
    }
  }

  return center.coord;
}

function orderedOffsets(radius: number): Array<{ du: number; dv: number; distanceSq: number }> {
  const offsets: Array<{ du: number; dv: number; distanceSq: number }> = [];
  for (let du = -radius; du <= radius; du++) {
    for (let dv = -radius; dv <= radius; dv++) {
      const distanceSq = du * du + dv * dv;
      if (distanceSq > radius * radius) continue;
      offsets.push({ du, dv, distanceSq });
    }
  }
  offsets.sort((a, b) =>
    a.distanceSq - b.distanceSq
    || Math.abs(a.du) + Math.abs(a.dv) - Math.abs(b.du) - Math.abs(b.dv)
    || a.du - b.du
    || a.dv - b.dv
  );
  return offsets;
}

/**
 * Resolve the requested capsule centre behind a validated parked ship. The
 * player is allowed to start between voxel centres, but the rounded cell must
 * own a strict 3x3 level pad on the same support plane and the real capsule
 * volume must be dry and clear at its eventual settled height.
 */
function playerEgressForShipSite(
  terrain: SpawnTerrainQuery,
  planetSize: number,
  shipSite: ValidatedSpawnSite
): THREE.Vector3 | null {
  const frame = FACE_FRAMES[shipSite.face];
  const planetRadiusCells = Math.floor(planetSize / VOXEL_SCALE);
  const supportCenter = voxelCoordToWorld(
    shipSite.supportVoxel.x,
    shipSite.supportVoxel.y,
    shipSite.supportVoxel.z
  );
  const requested = supportCenter
    .clone()
    .addScaledVector(shipSite.up, PLAYER_CENTER_CLEARANCE + PLAYER_EXTRA_CLEARANCE)
    .add(shipPlayerEgressOffset(shipSite.position, shipSite.up));
  const vx = Math.round(requested.x / VOXEL_SCALE);
  const vy = Math.round(requested.y / VOXEL_SCALE);
  const vz = Math.round(requested.z / VOXEL_SCALE);
  const u = dotCoord(vx, vy, vz, frame.tangentU);
  const v = dotCoord(vx, vy, vz, frame.tangentV);
  const playerSupport = inspectCandidate(
    terrain,
    frame,
    planetRadiusCells,
    u,
    v,
    'player'
  );
  if (!playerSupport) return null;

  const shipHeight = dotCoord(
    shipSite.supportVoxel.x,
    shipSite.supportVoxel.y,
    shipSite.supportVoxel.z,
    frame.up
  );
  const playerHeight = dotCoord(
    playerSupport.x,
    playerSupport.y,
    playerSupport.z,
    frame.up
  );
  if (playerHeight !== shipHeight) return null;

  const settled = requested.clone().addScaledVector(shipSite.up, -PLAYER_EXTRA_CLEARANCE);
  return isDryClearResumePosition(terrain, planetSize, settled, 'player')
    ? requested
    : null;
}

/**
 * Validate a persisted/live pose without forcing it back to a voxel centre.
 * Resumes may legitimately be mid-step, so they need dry capsule clearance and
 * support below—not the stricter new-arrival flat pad.
 */
export function isDryClearResumePosition(
  terrain: SpawnTerrainQuery,
  planetSize: number,
  position: THREE.Vector3,
  kind: SpawnKind = 'player'
): boolean {
  const face = dominantFaceForPosition(position);
  const frame = FACE_FRAMES[face];
  const planetRadiusCells = Math.floor(planetSize / VOXEL_SCALE);
  const vx = Math.round(position.x / VOXEL_SCALE);
  const vy = Math.round(position.y / VOXEL_SCALE);
  const vz = Math.round(position.z / VOXEL_SCALE);
  const u = dotCoord(vx, vy, vz, frame.tangentU);
  const v = dotCoord(vx, vy, vz, frame.tangentV);
  const support = surfaceInColumn(terrain, frame, planetRadiusCells, u, v);
  if (!support || isHazardousSupport(terrain, support.coord.x, support.coord.y, support.coord.z)) return false;

  const up = FACE_NORMALS[face];
  const along = position.dot(up);
  const physicalClearance = kind === 'player' ? PLAYER_CENTER_CLEARANCE : SHIP_GROUND_CLEARANCE;
  if (along < support.height * VOXEL_SCALE + physicalClearance - 0.2) return false;

  const halfExtent = kind === 'player' ? 1.8 : 2;
  const bodyRadius = kind === 'player' ? 0.5 : 1.5;
  const segmentHalfLength = Math.max(0, halfExtent - bodyRadius);
  // Validate against the visible voxel cube, not Rapier's intentionally 0.01wu
  // shrunken collider; a resume that visibly clips a corner is still invalid.
  const voxelHalfExtent = VOXEL_SCALE / 2;
  const shapeExtent = new THREE.Vector3(bodyRadius, bodyRadius, bodyRadius)
    .add(new THREE.Vector3(
      Math.abs(up.x),
      Math.abs(up.y),
      Math.abs(up.z)
    ).multiplyScalar(segmentHalfLength));
  const min = position.clone().sub(shapeExtent);
  const max = position.clone().add(shapeExtent);
  const minCell = new THREE.Vector3(
    Math.ceil((min.x - voxelHalfExtent) / VOXEL_SCALE),
    Math.ceil((min.y - voxelHalfExtent) / VOXEL_SCALE),
    Math.ceil((min.z - voxelHalfExtent) / VOXEL_SCALE)
  );
  const maxCell = new THREE.Vector3(
    Math.floor((max.x + voxelHalfExtent) / VOXEL_SCALE),
    Math.floor((max.y + voxelHalfExtent) / VOXEL_SCALE),
    Math.floor((max.z + voxelHalfExtent) / VOXEL_SCALE)
  );
  const segmentMin = along - segmentHalfLength;
  const segmentMax = along + segmentHalfLength;
  for (let cx = minCell.x; cx <= maxCell.x; cx++) {
    for (let cy = minCell.y; cy <= maxCell.y; cy++) {
      for (let cz = minCell.z; cz <= maxCell.z; cz++) {
        const insideRenderedTerrain = Math.max(Math.abs(cx), Math.abs(cy), Math.abs(cz)) <= planetRadiusCells;
        const solid = insideRenderedTerrain && terrain.shouldVoxelExist(cx, cy, cz);
        const water = terrain.isWaterVoxel(cx, cy, cz);
        if (!solid && !water) continue;

        // Exact squared distance from the face-aligned capsule centre segment
        // to this voxel AABB. Unlike perimeter samples, this catches a capsule
        // clipping only the corner of a wall voxel.
        const center = [cx * VOXEL_SCALE, cy * VOXEL_SCALE, cz * VOXEL_SCALE] as const;
        const point = [position.x, position.y, position.z] as const;
        let distanceSq = 0;
        for (let axis = 0; axis < 3; axis++) {
          const boxMin = center[axis] - voxelHalfExtent;
          const boxMax = center[axis] + voxelHalfExtent;
          if (frame.up[axis] !== 0) {
            const orientedBoxMin = frame.up[axis] > 0 ? boxMin : -boxMax;
            const orientedBoxMax = frame.up[axis] > 0 ? boxMax : -boxMin;
            if (segmentMax < orientedBoxMin) distanceSq += (orientedBoxMin - segmentMax) ** 2;
            else if (segmentMin > orientedBoxMax) distanceSq += (segmentMin - orientedBoxMax) ** 2;
          } else if (point[axis] < boxMin) {
            distanceSq += (boxMin - point[axis]) ** 2;
          } else if (point[axis] > boxMax) {
            distanceSq += (point[axis] - boxMax) ** 2;
          }
        }
        const collisionRadius = water
          ? bodyRadius
          : Math.max(0, bodyRadius - SOLID_CONTACT_TOLERANCE);
        if (distanceSq < collisionRadius * collisionRadius) return false;
      }
    }
  }
  return true;
}

/**
 * Resolve the nearest deterministic dry, level, clear surface site.
 *
 * Returns null when no valid patch exists inside the bounded search. Callers
 * performing an optional landing can then refuse it; world-entry callers can
 * retry from their canonical arrival site instead of accepting an unsafe pose.
 */
export function findValidSpawnSite(
  terrain: SpawnTerrainQuery,
  planetSize: number,
  preferredWorldPosition: THREE.Vector3,
  options: SpawnSearchOptions
): ValidatedSpawnSite | null {
  const kind = options.kind;
  const profile = PROFILE[kind];
  const face = options.face ?? dominantFaceForPosition(preferredWorldPosition);
  const frame = FACE_FRAMES[face];
  // planetSize is the rendered world radius and VOXEL_SCALE converts it back to
  // the generator's coordinate radius (50 world units -> 25 terrain cells).
  const planetRadiusCells = Math.floor(planetSize / VOXEL_SCALE);
  const preferredX = Math.round(preferredWorldPosition.x / VOXEL_SCALE);
  const preferredY = Math.round(preferredWorldPosition.y / VOXEL_SCALE);
  const preferredZ = Math.round(preferredWorldPosition.z / VOXEL_SCALE);
  const preferredU = dotCoord(preferredX, preferredY, preferredZ, frame.tangentU);
  const preferredV = dotCoord(preferredX, preferredY, preferredZ, frame.tangentV);
  const maxAllowedTangent = Math.max(0, planetRadiusCells - profile.footprintRadius - 1);
  const maxSearchRadius = Math.max(
    0,
    Math.min(options.maxSearchRadius ?? planetRadiusCells, planetRadiusCells * 3)
  );

  for (const offset of orderedOffsets(maxSearchRadius)) {
    const u = preferredU + offset.du;
    const v = preferredV + offset.dv;
    if (Math.abs(u) > maxAllowedTangent || Math.abs(v) > maxAllowedTangent) continue;
    const support = inspectCandidate(terrain, frame, planetRadiusCells, u, v, kind);
    if (!support) continue;
    const up = FACE_NORMALS[face].clone();
    const position = voxelCoordToWorld(support.x, support.y, support.z)
      .addScaledVector(up, profile.restClearance);
    const searchDistanceCells = Math.sqrt(offset.distanceSq);
    const site: ValidatedSpawnSite = {
      kind,
      face,
      up,
      supportVoxel: support,
      position,
      searchDistanceCells,
      relocated: searchDistanceCells > 0.001
        || preferredWorldPosition.distanceToSquared(position) > 0.01
    };
    if (
      kind === 'ship'
      && options.requirePlayerEgress
      && !playerEgressForShipSite(terrain, planetSize, site)
    ) continue;
    return site;
  }

  return null;
}

/**
 * Return the validated on-foot spawn request for an already parked ship.
 * Null means either the ship rest itself or its real tail-side capsule exit is
 * unsafe; callers must not materialize the player there.
 */
export function resolveShipPlayerEgressPosition(
  terrain: SpawnTerrainQuery,
  planetSize: number,
  shipPosition: THREE.Vector3,
  face?: CubeFace
): THREE.Vector3 | null {
  const shipSite = findValidSpawnSite(terrain, planetSize, shipPosition, {
    kind: 'ship',
    face,
    maxSearchRadius: 0
  });
  if (!shipSite || shipSite.position.distanceTo(shipPosition) > 0.15) return null;
  return playerEgressForShipSite(terrain, planetSize, shipSite);
}

/**
 * Revalidate an R/recovery target against the terrain as it exists now. Keeps a
 * safe between-cell ship exit unchanged, otherwise deterministically relocates
 * to a level player pad instead of dropping through a newly dug/flooded hole.
 */
export function resolveSafePlayerResetPosition(
  terrain: SpawnTerrainQuery,
  planetSize: number,
  preferredPosition: THREE.Vector3,
  options: {
    face?: CubeFace;
    shipPosition?: THREE.Vector3;
    maxSearchRadius?: number;
  } = {}
): THREE.Vector3 | null {
  const face = options.face ?? dominantFaceForPosition(preferredPosition);
  if (options.shipPosition) {
    const egress = resolveShipPlayerEgressPosition(
      terrain,
      planetSize,
      options.shipPosition,
      face
    );
    if (egress) return egress;
  }

  const up = FACE_NORMALS[face];
  const exact = findValidSpawnSite(terrain, planetSize, preferredPosition, {
    kind: 'player',
    face,
    maxSearchRadius: 0
  });
  const settled = preferredPosition.clone().addScaledVector(up, -PLAYER_EXTRA_CLEARANCE);
  if (
    exact
    && Math.abs(exact.position.dot(up) - preferredPosition.dot(up)) <= 0.15
    && isDryClearResumePosition(terrain, planetSize, settled)
  ) {
    return preferredPosition.clone();
  }

  const fallbackPreferred = preferredPosition.clone();
  if (options.shipPosition) {
    // If the parked ship or its immediate exit was undermined, bias the generic
    // reset farther down the established tail vector so the fallback cannot
    // materialize inside the hull.
    const away = preferredPosition.clone().sub(options.shipPosition);
    away.addScaledVector(up, -away.dot(up));
    if (away.lengthSq() > 1e-6) fallbackPreferred.addScaledVector(away.normalize(), 4);
  }
  return findValidSpawnSite(terrain, planetSize, fallbackPreferred, {
    kind: 'player',
    face,
    maxSearchRadius: options.maxSearchRadius ?? Math.floor(planetSize / VOXEL_SCALE) * 2
  })?.position ?? null;
}

/**
 * Revalidate a parked craft at the instant it is boarded. A zero-radius call is
 * suitable for the [F] affordance; a bounded radius lets the controller defend
 * against a last-frame edit race without ever spawning over water or a hole.
 */
export function resolveSafeShipBoardingPosition(
  terrain: SpawnTerrainQuery,
  planetSize: number,
  parkedPosition: THREE.Vector3,
  maxSearchRadius = 0
): THREE.Vector3 | null {
  const site = findValidSpawnSite(terrain, planetSize, parkedPosition, {
    kind: 'ship',
    face: dominantFaceForPosition(parkedPosition),
    maxSearchRadius,
    requirePlayerEgress: true
  });
  if (!site) return null;
  if (maxSearchRadius === 0 && site.position.distanceTo(parkedPosition) > 0.15) {
    // A real landed/persisted craft may rest between voxel centres while still
    // occupying the exact rounded support pad. Preserve that authored pose only
    // when its full live hull volume and its tail-side player egress both pass;
    // never silently relocate a zero-radius boarding check.
    const liveSite: ValidatedSpawnSite = {
      ...site,
      position: parkedPosition.clone(),
      relocated: false
    };
    if (!isDryClearResumePosition(terrain, planetSize, parkedPosition, 'ship')
      || !playerEgressForShipSite(terrain, planetSize, liveSite)) return null;
    return parkedPosition.clone();
  }
  return site.position.clone();
}

/** Exact contract check used by the headed playthrough gate. */
export function isValidatedSpawnPosition(
  terrain: SpawnTerrainQuery,
  planetSize: number,
  position: THREE.Vector3,
  kind: SpawnKind
): boolean {
  const site = findValidSpawnSite(terrain, planetSize, position, {
    kind,
    maxSearchRadius: 0
  });
  return site !== null && site.position.distanceTo(position) <= 0.15;
}
