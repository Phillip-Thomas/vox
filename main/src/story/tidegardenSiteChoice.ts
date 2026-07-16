import type { ActorId } from '../game/playerActors.ts';
import { getMilestones, markMilestone } from '../game/systems/progressionSystem.ts';
import { emitEmergentStoryEvent } from './emergentStoryEvents.ts';
import { TIDEGARDEN_WORLD_ID } from './tidegardenRoute.ts';

export const TIDEGARDEN_SITE_CHOICE_PREFIX = 'story:tidegarden:site-chosen:v1:';

export interface TidegardenSiteChoiceReceipt {
  worldId: typeof TIDEGARDEN_WORLD_ID;
  cell: [number, number, number];
  supportCell: [number, number, number];
  up: [number, number, number];
}

export type TidegardenSiteChoiceCommit =
  | { ok: true; idempotent: boolean }
  | { ok: false; reason: 'site-choice-proof-invalid' | 'different-site-chosen' };

export function applyAuthoritativeTidegardenSiteChoiceReceipt(
  input: {
    worldId: string;
    cell: readonly [number, number, number];
    supportCell: readonly [number, number, number];
    up: readonly [number, number, number];
  },
  eventId: string,
  actorId: ActorId
): TidegardenSiteChoiceCommit {
  const receipt = normalizeTidegardenSiteChoice(input);
  if (!receipt) return { ok: false, reason: 'site-choice-proof-invalid' };
  const existing = getTidegardenSiteChoiceReceipt(actorId);
  if (existing) {
    return sameReceipt(existing, receipt)
      ? { ok: true, idempotent: true }
      : { ok: false, reason: 'different-site-chosen' };
  }
  markMilestone(encodeTidegardenSiteChoice(receipt), actorId);
  emitEmergentStoryEvent({
    id: eventId,
    type: 'settlement_site_chosen',
    actorId,
    worldId: receipt.worldId,
    payload: receipt
  });
  return { ok: true, idempotent: false };
}

export function getTidegardenSiteChoiceReceipt(
  actorId: ActorId
): TidegardenSiteChoiceReceipt | null {
  const milestone = getMilestones(actorId).find(value => (
    value.startsWith(TIDEGARDEN_SITE_CHOICE_PREFIX)
  ));
  if (!milestone) return null;
  const [cellValue, supportValue, upValue] = milestone
    .slice(TIDEGARDEN_SITE_CHOICE_PREFIX.length)
    .split('|');
  const cell = parseCell(cellValue);
  const supportCell = parseCell(supportValue);
  const up = parseCell(upValue);
  return cell && supportCell && up
    ? normalizeTidegardenSiteChoice({
        worldId: TIDEGARDEN_WORLD_ID,
        cell,
        supportCell,
        up
      })
    : null;
}

export function tidegardenSiteChoiceMatchesCell(
  actorId: ActorId,
  cell: readonly [number, number, number]
): boolean {
  const chosen = getTidegardenSiteChoiceReceipt(actorId);
  return Boolean(chosen && sameCell(chosen.cell, cell));
}

export function encodeTidegardenSiteChoice(receipt: TidegardenSiteChoiceReceipt): string {
  return `${TIDEGARDEN_SITE_CHOICE_PREFIX}${receipt.cell.join(',')}`
    + `|${receipt.supportCell.join(',')}|${receipt.up.join(',')}`;
}

export function normalizeTidegardenSiteChoice(input: {
  worldId: string;
  cell: readonly [number, number, number];
  supportCell: readonly [number, number, number];
  up: readonly [number, number, number];
}): TidegardenSiteChoiceReceipt | null {
  const cell: [number, number, number] = [...input.cell];
  const supportCell: [number, number, number] = [...input.supportCell];
  const up: [number, number, number] = [...input.up];
  if (input.worldId !== TIDEGARDEN_WORLD_ID
    || !cell.every(Number.isInteger)
    || !supportCell.every(Number.isInteger)
    || !isAxis(up)
    || !sameCell(cell, [
      supportCell[0] + up[0],
      supportCell[1] + up[1],
      supportCell[2] + up[2]
    ])) return null;
  return { worldId: TIDEGARDEN_WORLD_ID, cell, supportCell, up };
}

function parseCell(value: string | undefined): [number, number, number] | null {
  if (!value) return null;
  const coordinates = value.split(',').map(Number);
  return coordinates.length === 3 && coordinates.every(Number.isInteger)
    ? [coordinates[0]!, coordinates[1]!, coordinates[2]!]
    : null;
}

function isAxis(cell: readonly [number, number, number]): boolean {
  return cell.every(value => value === -1 || value === 0 || value === 1)
    && Math.abs(cell[0]) + Math.abs(cell[1]) + Math.abs(cell[2]) === 1;
}

function sameReceipt(
  left: TidegardenSiteChoiceReceipt,
  right: TidegardenSiteChoiceReceipt
): boolean {
  return left.worldId === right.worldId
    && sameCell(left.cell, right.cell)
    && sameCell(left.supportCell, right.supportCell)
    && sameCell(left.up, right.up);
}

function sameCell(
  left: readonly [number, number, number],
  right: readonly [number, number, number]
): boolean {
  return left[0] === right[0] && left[1] === right[1] && left[2] === right[2];
}
