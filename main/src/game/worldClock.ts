export const DAY_LENGTH_SECONDS = 240;
export const DAY_LENGTH_MS = DAY_LENGTH_SECONDS * 1000;
export const STATIC_DAY_PHASE = 0.25;

export type WorldClockOwner = 'local_client' | 'server';

export interface WorldClockSource {
  owner: WorldClockOwner;
  worldId?: string;
  worldTimeMs: number;
  updatedAtMs?: number;
}

export interface DayPhaseInput {
  source: WorldClockSource;
  forcedDayPhase?: number | null;
  dayLengthMs?: number;
}

let dayPhaseOffset = 0;
let liveDayPhase = STATIC_DAY_PHASE;
let serverClock: WorldClockSource | null = null;

export function normalizeDayPhase(phase: number): number {
  if (!Number.isFinite(phase)) return STATIC_DAY_PHASE;
  return ((phase % 1) + 1) % 1;
}

export function createLocalWorldClockSource(elapsedSeconds: number, worldId?: string): WorldClockSource {
  const elapsedMs = Number.isFinite(elapsedSeconds) ? Math.max(0, elapsedSeconds * 1000) : 0;
  return {
    owner: 'local_client',
    worldId,
    worldTimeMs: elapsedMs
  };
}

export function setServerWorldClock(source: Omit<WorldClockSource, 'owner'>): void {
  serverClock = {
    ...source,
    owner: 'server',
    worldTimeMs: Math.max(0, source.worldTimeMs)
  };
}

export function clearServerWorldClock(): void {
  serverClock = null;
}

export function getWorldClockSource(elapsedSeconds: number, worldId?: string, nowMs = Date.now()): WorldClockSource {
  if (serverClock && (!serverClock.worldId || serverClock.worldId === worldId)) {
    const elapsedSinceSync = serverClock.updatedAtMs
      ? Math.max(0, nowMs - serverClock.updatedAtMs)
      : 0;
    return {
      ...serverClock,
      worldTimeMs: serverClock.worldTimeMs + elapsedSinceSync
    };
  }
  return createLocalWorldClockSource(elapsedSeconds, worldId);
}

export function setDayPhaseOffset(phase: number): void {
  dayPhaseOffset = normalizeDayPhase(phase);
}

export function getDayPhaseOffset(): number {
  return dayPhaseOffset;
}

export function setCurrentDayPhase(phase: number): void {
  liveDayPhase = normalizeDayPhase(phase);
}

export function getCurrentDayPhase(): number {
  return liveDayPhase;
}

export function resolveWorldDayPhase({
  source,
  forcedDayPhase = null,
  dayLengthMs = DAY_LENGTH_MS
}: DayPhaseInput): number {
  if (forcedDayPhase != null) return normalizeDayPhase(forcedDayPhase);
  const duration = Number.isFinite(dayLengthMs) && dayLengthMs > 0 ? dayLengthMs : DAY_LENGTH_MS;
  const offset = source.owner === 'server' ? 0 : dayPhaseOffset;
  return normalizeDayPhase(source.worldTimeMs / duration + offset);
}
