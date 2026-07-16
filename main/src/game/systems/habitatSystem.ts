// --- Per-world Habitat Core truth ------------------------------------------
//
// A Habitat Core is player-global while carried, then world-local once
// installed. This store contains only committed physical facts. Site,
// enclosure, and rest validation live in the Tidegarden story adapter; loading
// a snapshot restores prior proof without re-emitting narrative events.

export const HABITAT_WORLD_SCHEMA_VERSION = 1 as const;

export type HabitatCell = [number, number, number];
export type HabitatVector = [number, number, number];

export interface HabitatCorePlacement {
  actorId: string;
  worldId: string;
  shelterId: string;
  cell: HabitatCell;
  supportCell: HabitatCell;
  position: HabitatVector;
  up: HabitatVector;
  eventId: string;
}

export interface HabitatShelterCertification {
  shelterId: string;
  cell: HabitatCell;
  insulation: number;
  interiorCellCount: number;
  eventId: string;
}

export interface HabitatSafeRest {
  shelterId: string;
  dayPhase: number;
  eventId: string;
}

export interface HabitatWorldState {
  schemaVersion: typeof HABITAT_WORLD_SCHEMA_VERSION;
  worldId: string;
  core: HabitatCorePlacement;
  shelterCertification?: HabitatShelterCertification;
  safeRest?: HabitatSafeRest;
}

const worlds = new Map<string, HabitatWorldState>();
const listeners = new Set<() => void>();
let revision = 0;

export function getHabitatWorldState(worldId: string): HabitatWorldState | null {
  const state = worlds.get(worldId.trim());
  return state ? cloneState(state) : null;
}

export function getHabitatWorldSnapshot(worldId: string): HabitatWorldState | null {
  return getHabitatWorldState(worldId);
}

export function commitHabitatCorePlacement(placement: HabitatCorePlacement): boolean {
  const normalized = parseCore(placement);
  if (!normalized || worlds.has(normalized.worldId)) return false;
  worlds.set(normalized.worldId, {
    schemaVersion: HABITAT_WORLD_SCHEMA_VERSION,
    worldId: normalized.worldId,
    core: normalized
  });
  changed();
  return true;
}

export function commitHabitatShelterCertification(
  worldId: string,
  certification: HabitatShelterCertification
): boolean {
  const state = worlds.get(worldId.trim());
  const normalized = parseCertification(certification);
  if (!state || state.shelterCertification || !normalized) return false;
  if (normalized.shelterId !== state.core.shelterId) return false;
  state.shelterCertification = normalized;
  changed();
  return true;
}

export function commitHabitatSafeRest(worldId: string, rest: HabitatSafeRest): boolean {
  const state = worlds.get(worldId.trim());
  const normalized = parseRest(rest);
  if (!state || !state.shelterCertification || state.safeRest || !normalized) return false;
  if (normalized.shelterId !== state.shelterCertification.shelterId) return false;
  state.safeRest = normalized;
  changed();
  return true;
}

export function applyHabitatWorldSnapshot(worldIdInput: string, snapshot: unknown): void {
  const worldId = worldIdInput.trim();
  if (!worldId) return;
  const parsed = parseState(snapshot);
  if (!parsed || parsed.worldId !== worldId) worlds.delete(worldId);
  else worlds.set(worldId, parsed);
  changed();
}

export function clearHabitatWorld(worldIdInput: string): void {
  const worldId = worldIdInput.trim();
  if (worldId && worlds.delete(worldId)) changed();
}

export function resetHabitats(): void {
  if (worlds.size === 0) return;
  worlds.clear();
  changed();
}

export function subscribeHabitats(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getHabitatRevision(): number {
  return revision;
}

function changed(): void {
  revision++;
  for (const listener of listeners) listener();
}

function parseState(value: unknown): HabitatWorldState | null {
  if (!isObject(value)) return null;
  const worldId = text(value.worldId);
  const core = parseCore(value.core);
  if (!worldId || !core || core.worldId !== worldId) return null;
  const shelterCertification = value.shelterCertification === undefined
    ? undefined
    : parseCertification(value.shelterCertification) ?? undefined;
  if (shelterCertification && shelterCertification.shelterId !== core.shelterId) return null;
  const safeRest = value.safeRest === undefined
    ? undefined
    : parseRest(value.safeRest) ?? undefined;
  if (safeRest && (!shelterCertification || safeRest.shelterId !== shelterCertification.shelterId)) return null;
  return {
    schemaVersion: HABITAT_WORLD_SCHEMA_VERSION,
    worldId,
    core,
    ...(shelterCertification ? { shelterCertification } : {}),
    ...(safeRest ? { safeRest } : {})
  };
}

function parseCore(value: unknown): HabitatCorePlacement | null {
  if (!isObject(value)) return null;
  const actorId = text(value.actorId);
  const worldId = text(value.worldId);
  const shelterId = text(value.shelterId);
  const eventId = text(value.eventId);
  const cell = intVector(value.cell);
  const supportCell = intVector(value.supportCell);
  const position = finiteVector(value.position);
  const up = finiteVector(value.up);
  if (!actorId || !worldId || !shelterId || !eventId || !cell || !supportCell || !position || !up) return null;
  const length = Math.hypot(up[0], up[1], up[2]);
  if (Math.abs(length - 1) > 0.001) return null;
  return { actorId, worldId, shelterId, cell, supportCell, position, up, eventId };
}

function parseCertification(value: unknown): HabitatShelterCertification | null {
  if (!isObject(value)) return null;
  const shelterId = text(value.shelterId);
  const eventId = text(value.eventId);
  const cell = intVector(value.cell);
  const insulation = finiteNumber(value.insulation);
  const interiorCellCount = positiveInt(value.interiorCellCount);
  return shelterId && eventId && cell && insulation !== null && insulation >= 0 && interiorCellCount !== null
    ? { shelterId, eventId, cell, insulation, interiorCellCount }
    : null;
}

function parseRest(value: unknown): HabitatSafeRest | null {
  if (!isObject(value)) return null;
  const shelterId = text(value.shelterId);
  const eventId = text(value.eventId);
  const dayPhase = finiteNumber(value.dayPhase);
  return shelterId && eventId && dayPhase !== null && dayPhase >= 0 && dayPhase < 1
    ? { shelterId, eventId, dayPhase }
    : null;
}

function cloneState(state: HabitatWorldState): HabitatWorldState {
  return {
    schemaVersion: HABITAT_WORLD_SCHEMA_VERSION,
    worldId: state.worldId,
    core: {
      ...state.core,
      cell: [...state.core.cell],
      supportCell: [...state.core.supportCell],
      position: [...state.core.position],
      up: [...state.core.up]
    },
    ...(state.shelterCertification ? {
      shelterCertification: {
        ...state.shelterCertification,
        cell: [...state.shelterCertification.cell]
      }
    } : {}),
    ...(state.safeRest ? { safeRest: { ...state.safeRest } } : {})
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function positiveInt(value: unknown): number | null {
  return Number.isSafeInteger(value) && (value as number) > 0 ? value as number : null;
}

function finiteVector(value: unknown): HabitatVector | null {
  if (!Array.isArray(value) || value.length !== 3) return null;
  return value.every(component => typeof component === 'number' && Number.isFinite(component))
    ? [value[0] as number, value[1] as number, value[2] as number]
    : null;
}

function intVector(value: unknown): HabitatCell | null {
  if (!Array.isArray(value) || value.length !== 3) return null;
  return value.every(component => Number.isSafeInteger(component))
    ? [value[0] as number, value[1] as number, value[2] as number]
    : null;
}
