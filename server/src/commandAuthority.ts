import type { JsonObject } from './protocol.js';

export type SharedMutationClaim =
  | { kind: 'voxel_mined'; key: string; coord: [number, number, number] }
  | { kind: 'resource_taken'; key: string; collectibleType: string; coord: [number, number, number] }
  | {
    kind: 'structure_placed';
    key: string;
    structureId: string;
    cell: [number, number, number];
    face: number;
    structureType: string;
    material: string;
    state: JsonObject;
  };

const CLAIMED_COMMAND_TYPES = new Set(['voxel_mined', 'resource_taken', 'structure_placed']);
const RESOURCE_SOURCES = new Set(['tree', 'loose_stone', 'forage']);

export function isClaimedSharedMutationType(commandType: string): boolean {
  return CLAIMED_COMMAND_TYPES.has(commandType);
}

export function sharedMutationClaimForCommand(commandType: string, payload: JsonObject): SharedMutationClaim | null {
  switch (commandType) {
    case 'voxel_mined': {
      const coord = readIntCoord(payload.coord);
      return coord ? { kind: 'voxel_mined', key: `voxel:${coordKey(coord)}`, coord } : null;
    }
    case 'resource_taken': {
      const coord = readIntCoord(payload.coord);
      const source = readString(payload.source);
      if (!coord || !source || !RESOURCE_SOURCES.has(source)) return null;
      const kind = source === 'forage' ? readString(payload.kind) ?? source : source;
      const collectibleType = `${source}:${kind}`;
      return {
        kind: 'resource_taken',
        key: `collectible:${collectibleType}:${coordKey(coord)}`,
        collectibleType,
        coord
      };
    }
    case 'structure_placed': {
      const cell = readIntCoord(payload.cell);
      const face = readInt(payload.face);
      const structureType = readString(payload.type);
      const material = readString(payload.material);
      if (!cell || face === null || !structureType || !material) return null;
      const state: JsonObject = {};
      if (Number.isInteger(payload.up)) state.up = payload.up;
      if (Number.isInteger(payload.orient)) state.orient = payload.orient;
      const structureId = `slot:${coordKey(cell)}:${face}`;
      return {
        kind: 'structure_placed',
        key: `structure:${structureId}`,
        structureId,
        cell,
        face,
        structureType,
        material,
        state
      };
    }
    default:
      return null;
  }
}

export function sharedMutationValidationError(commandType: string, payload: JsonObject): string | null {
  if (!isClaimedSharedMutationType(commandType)) return null;
  return sharedMutationClaimForCommand(commandType, payload)
    ? null
    : `Malformed ${commandType} payload for authoritative mutation claim.`;
}

function readIntCoord(value: unknown): [number, number, number] | null {
  if (!Array.isArray(value) || value.length !== 3) return null;
  const [x, y, z] = value;
  return Number.isInteger(x) && Number.isInteger(y) && Number.isInteger(z)
    ? [x, y, z]
    : null;
}

function readInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function coordKey(coord: [number, number, number]): string {
  return coord.join(',');
}
