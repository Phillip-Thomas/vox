export type EmergentCapabilityId =
  | 'oxygen'
  | 'maw_repaired'
  | 'jet'
  | 'boarding'
  | 'local_travel'
  | 'habitat_certification'
  | `station:${string}`;

export type ShipRepairStage =
  | 'wrecked'
  | 'bench_online'
  | 'frame_restored'
  | 'hull_sealed'
  | 'lift_online'
  | 'flight_ready';

export interface EmergentCapabilityFacts {
  oxygenSystemOnline: boolean;
  mawRepaired: boolean;
  jetInstalled: boolean;
  shipRepairStage: ShipRepairStage;
  tidegardenRouteOnline: boolean;
  activeStationIds: readonly string[];
  habitatCoreOnline: boolean;
  shelterCertified: boolean;
}

export interface EmergentCapabilityResult {
  enabled: boolean;
  missing: string[];
}

const SHIP_STAGE_ORDER: readonly ShipRepairStage[] = [
  'wrecked',
  'bench_online',
  'frame_restored',
  'hull_sealed',
  'lift_online',
  'flight_ready'
];

/**
 * Player-owned story capability receipts. Pure sandbox profiles retain the
 * systemic defaults; once a Story save exists, these receipts prevent water or
 * a held jump key from leaking oxygen/jet knowledge before the authored acts.
 */
export const EMERGENT_CAPABILITY_MILESTONES = {
  oxygenOnline: 'story:capability:oxygen-online',
  jetInstalled: 'story:capability:jet-installed'
} as const;

export function isStoryOxygenOnline(actorId?: ActorId): boolean {
  return !hasMilestone('story:started', actorId)
    || hasMilestone(EMERGENT_CAPABILITY_MILESTONES.oxygenOnline, actorId);
}

export function commitStoryOxygenOnline(actorId?: ActorId): boolean {
  if (hasMilestone(EMERGENT_CAPABILITY_MILESTONES.oxygenOnline, actorId)) return false;
  markMilestone(EMERGENT_CAPABILITY_MILESTONES.oxygenOnline, actorId);
  return true;
}

export function isStoryJetInstalled(actorId?: ActorId): boolean {
  return !hasMilestone('story:started', actorId)
    || hasMilestone(EMERGENT_CAPABILITY_MILESTONES.jetInstalled, actorId);
}

export function commitStoryJetInstalled(actorId?: ActorId): boolean {
  if (hasMilestone(EMERGENT_CAPABILITY_MILESTONES.jetInstalled, actorId)) return false;
  markMilestone(EMERGENT_CAPABILITY_MILESTONES.jetInstalled, actorId);
  return true;
}

export function resolveEmergentCapability(
  capability: EmergentCapabilityId,
  facts: EmergentCapabilityFacts
): EmergentCapabilityResult {
  const missing: string[] = [];
  if (capability === 'oxygen' && !facts.oxygenSystemOnline) missing.push('oxygen-system-offline');
  if (capability === 'maw_repaired' && !facts.mawRepaired) missing.push('maw-not-repaired');
  if (capability === 'jet') {
    if (!facts.jetInstalled) missing.push('lift-cell-not-installed');
    if (!atLeast(facts.shipRepairStage, 'lift_online')) missing.push('ship-lift-offline');
  }
  if (capability === 'boarding' && !atLeast(facts.shipRepairStage, 'flight_ready')) {
    missing.push('ship-not-flight-ready');
  }
  if (capability === 'local_travel') {
    if (!atLeast(facts.shipRepairStage, 'flight_ready')) missing.push('ship-not-flight-ready');
    if (!facts.tidegardenRouteOnline) missing.push('tidegarden-route-offline');
  }
  if (capability === 'habitat_certification') {
    if (!facts.habitatCoreOnline) missing.push('habitat-core-offline');
    if (!facts.shelterCertified) missing.push('shelter-not-certified');
  }
  if (capability.startsWith('station:')) {
    const stationId = capability.slice('station:'.length);
    if (!stationId || !facts.activeStationIds.includes(stationId)) {
      missing.push(`station-offline:${stationId || 'unknown'}`);
    }
  }
  return { enabled: missing.length === 0, missing };
}

export function nextShipRepairStage(current: ShipRepairStage): ShipRepairStage | null {
  const index = SHIP_STAGE_ORDER.indexOf(current);
  return index < 0 || index === SHIP_STAGE_ORDER.length - 1
    ? null
    : SHIP_STAGE_ORDER[index + 1]!;
}

export function atLeast(current: ShipRepairStage, required: ShipRepairStage): boolean {
  return SHIP_STAGE_ORDER.indexOf(current) >= SHIP_STAGE_ORDER.indexOf(required);
}
import { hasMilestone, markMilestone } from '../game/systems/progressionSystem.ts';
import type { ActorId } from '../game/playerActors.ts';
