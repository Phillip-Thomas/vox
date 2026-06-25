import type { PlayerPose } from '../../game/playerPose.ts';
import type { StructurePiece } from '../../game/systems/structureSystem.ts';
import type { Campfire } from '../../game/systems/campfires.ts';
import type { CubeFace } from '../../types/cube.ts';

export type Vec3Tuple = [number, number, number];

export type OrbitalMarkerKind = 'remote' | 'ship' | 'campfire' | 'structure';

export interface OrbitalMarker {
  id: string;
  kind: OrbitalMarkerKind;
  worldPosition: Vec3Tuple;
  minimapPosition: Vec3Tuple;
  distance: number;
  stale?: boolean;
}

export interface LocalOrbitalMarker {
  worldPosition: Vec3Tuple;
  minimapPosition: Vec3Tuple;
  forward: Vec3Tuple;
  up: Vec3Tuple;
  heading: Vec3Tuple;
  tangentHeading: Vec3Tuple;
  face: CubeFace;
  faceNormal: Vec3Tuple;
  uAxis: Vec3Tuple;
  vAxis: Vec3Tuple;
}

export interface OrbitalMinimapModel {
  local: LocalOrbitalMarker;
  markers: OrbitalMarker[];
  counts: {
    remotePlayers: number;
    campfires: number;
    shownCampfires: number;
    structures: number;
    shownStructures: number;
    ship: number;
  };
}

export interface OrbitalMinimapInput {
  planetSize: number;
  worldId: string;
  localActorId: string;
  localPosition: Vec3Tuple;
  localForward: Vec3Tuple;
  localUp: Vec3Tuple;
  localPitch?: number;
  remotePlayers: readonly PlayerPose[];
  campfires: readonly Campfire[];
  structures: readonly StructurePiece[];
  shipPosition: Vec3Tuple | null;
  nowMs?: number;
}

export const MAX_REMOTE_MARKERS = 8;
export const MAX_CAMPFIRE_MARKERS = 10;
export const MAX_STRUCTURE_MARKERS = 18;
export const REMOTE_STALE_MS = 8_000;

const ZERO: Vec3Tuple = [0, 0, 0];
const FORWARD: Vec3Tuple = [0, 0, -1];
const UP: Vec3Tuple = [0, 1, 0];
export const MINIMAP_EXTENT = 0.84;

const FACE_UV: Record<CubeFace, { normal: Vec3Tuple; u: Vec3Tuple; v: Vec3Tuple }> = {
  top: { normal: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] },
  bottom: { normal: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  right: { normal: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
  left: { normal: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  front: { normal: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  back: { normal: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] }
};

export function buildOrbitalMinimapModel(input: OrbitalMinimapInput): OrbitalMinimapModel {
  const nowMs = input.nowMs ?? Date.now();
  const localPosition = sanitizeVec3(input.localPosition, ZERO);
  const localForward = normalizeVec3(sanitizeVec3(input.localForward, FORWARD), FORWARD);
  const localUp = normalizeVec3(sanitizeVec3(input.localUp, UP), UP);
  const localFace = faceFromUp(localUp);
  const uv = FACE_UV[localFace];
  const localPitch = clamp(finite(input.localPitch ?? 0, 0), -Math.PI / 2, Math.PI / 2);
  const tangentHeading = faceLocalTangentHeading(localForward, uv);
  const heading = normalizeVec3([
    tangentHeading[0] * Math.cos(localPitch) + uv.normal[0] * Math.sin(localPitch),
    tangentHeading[1] * Math.cos(localPitch) + uv.normal[1] * Math.sin(localPitch),
    tangentHeading[2] * Math.cos(localPitch) + uv.normal[2] * Math.sin(localPitch)
  ], tangentHeading);

  const remoteMarkers = input.remotePlayers
    .filter(player => player.playerId !== input.localActorId && player.worldId === input.worldId)
    .map(player => {
      const worldPosition = sanitizeVec3(player.position, ZERO);
      return createMarker({
        id: `remote:${player.playerId}`,
        kind: 'remote',
        worldPosition,
        localPosition,
        planetSize: input.planetSize,
        stale: nowMs - player.timeMs > REMOTE_STALE_MS
      });
    })
    .sort(byDistance)
    .slice(0, MAX_REMOTE_MARKERS);

  const shipMarkers = input.shipPosition
    ? [createMarker({
        id: 'ship:parked',
        kind: 'ship',
        worldPosition: sanitizeVec3(input.shipPosition, ZERO),
        localPosition,
        planetSize: input.planetSize
      })]
    : [];

  const campfireMarkers = input.campfires
    .map(campfire => createMarker({
      id: `campfire:${campfire.id}`,
      kind: 'campfire',
      worldPosition: sanitizeVec3(campfire.pos, ZERO),
      localPosition,
      planetSize: input.planetSize
    }))
    .sort(byDistance)
    .slice(0, MAX_CAMPFIRE_MARKERS);

  const structureCells = uniqueStructureCells(input.structures);
  const structureMarkers = structureCells
    .map(({ id, cell }) => createMarker({
      id: `structure:${id}`,
      kind: 'structure',
      worldPosition: sanitizeVec3(cell, ZERO),
      localPosition,
      planetSize: input.planetSize
    }))
    .sort(byDistance)
    .slice(0, MAX_STRUCTURE_MARKERS);

  return {
    local: {
      worldPosition: localPosition,
      minimapPosition: projectWorldToMinimap(localPosition, input.planetSize),
      forward: localForward,
      up: localUp,
      heading,
      tangentHeading,
      face: localFace,
      faceNormal: [...uv.normal],
      uAxis: [...uv.u],
      vAxis: [...uv.v]
    },
    markers: [
      ...structureMarkers,
      ...campfireMarkers,
      ...shipMarkers,
      ...remoteMarkers
    ],
    counts: {
      remotePlayers: remoteMarkers.length,
      campfires: input.campfires.length,
      shownCampfires: campfireMarkers.length,
      structures: structureCells.length,
      shownStructures: structureMarkers.length,
      ship: shipMarkers.length
    }
  };
}

export function faceFromUp(up: readonly [number, number, number]): CubeFace {
  const [x, y, z] = normalizeVec3(sanitizeVec3(up, UP), UP);
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  const az = Math.abs(z);
  if (ax >= ay && ax >= az) return x >= 0 ? 'right' : 'left';
  if (ay >= ax && ay >= az) return y >= 0 ? 'top' : 'bottom';
  return z >= 0 ? 'front' : 'back';
}

export function faceUvFrame(face: CubeFace): { normal: Vec3Tuple; u: Vec3Tuple; v: Vec3Tuple } {
  const uv = FACE_UV[face];
  return {
    normal: [...uv.normal],
    u: [...uv.u],
    v: [...uv.v]
  };
}

export function projectWorldToMinimap(position: readonly [number, number, number], planetSize: number): Vec3Tuple {
  const size = Number.isFinite(planetSize) && planetSize > 0 ? planetSize : 50;
  const scale = MINIMAP_EXTENT / size;
  return [
    clamp(position[0] * scale, -MINIMAP_EXTENT, MINIMAP_EXTENT),
    clamp(position[1] * scale, -MINIMAP_EXTENT, MINIMAP_EXTENT),
    clamp(position[2] * scale, -MINIMAP_EXTENT, MINIMAP_EXTENT)
  ];
}

function createMarker({
  id,
  kind,
  worldPosition,
  localPosition,
  planetSize,
  stale
}: {
  id: string;
  kind: OrbitalMarkerKind;
  worldPosition: Vec3Tuple;
  localPosition: Vec3Tuple;
  planetSize: number;
  stale?: boolean;
}): OrbitalMarker {
  return {
    id,
    kind,
    worldPosition,
    minimapPosition: projectWorldToMinimap(worldPosition, planetSize),
    distance: distance(worldPosition, localPosition),
    stale
  };
}

function faceLocalTangentHeading(forward: Vec3Tuple, uv: { u: Vec3Tuple; v: Vec3Tuple }): Vec3Tuple {
  const uAmount = dot(forward, uv.u);
  const vAmount = dot(forward, uv.v);
  const heading: Vec3Tuple = [
    uv.u[0] * uAmount + uv.v[0] * vAmount,
    uv.u[1] * uAmount + uv.v[1] * vAmount,
    uv.u[2] * uAmount + uv.v[2] * vAmount
  ];
  return normalizeVec3(heading, uv.v);
}

function uniqueStructureCells(structures: readonly StructurePiece[]): { id: string; cell: Vec3Tuple }[] {
  const cells = new Map<string, Vec3Tuple>();
  for (const piece of structures) {
    const cell = sanitizeVec3(piece.cell, ZERO);
    const key = `${cell[0]},${cell[1]},${cell[2]}`;
    if (!cells.has(key)) cells.set(key, cell);
  }
  return [...cells].map(([id, cell]) => ({ id, cell }));
}

function sanitizeVec3(value: readonly [number, number, number] | undefined, fallback: Vec3Tuple): Vec3Tuple {
  if (!value) return [...fallback];
  return [
    finite(value[0], fallback[0]),
    finite(value[1], fallback[1]),
    finite(value[2], fallback[2])
  ];
}

function normalizeVec3(value: Vec3Tuple, fallback: Vec3Tuple): Vec3Tuple {
  const len = Math.hypot(value[0], value[1], value[2]);
  if (len <= 1e-7) return [...fallback];
  return [value[0] / len, value[1] / len, value[2] / len];
}

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function distance(a: Vec3Tuple, b: Vec3Tuple): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function byDistance(a: OrbitalMarker, b: OrbitalMarker): number {
  return a.distance - b.distance;
}

function dot(a: Vec3Tuple, b: Vec3Tuple): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
