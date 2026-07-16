// Typed evidence boundary for the post-arrival story batch. Runtime systems
// publish facts here; Story, score, cinematography, ledgers, and tests subscribe
// instead of re-inferring transactions from UI text or transient component state.

export interface EmergentStoryEventPayloads {
  audit_mismatch: { kind: 'fire' | 'life' | 'tree' };
  audit_directive_issued: { directive: 'sterilization' };
  compliance_committed: { kind: 'fire' | 'organics' };
  protected_tree_tool_refused: {
    target: 'hero_tree';
    toolId: 'faulty_maw';
    targetIntegrity: 'unchanged';
  };
  tree_refusal_available: { target: 'hero_tree'; verb: 'refuse.' };
  refusal_committed: { target: 'hero_tree' };
  reality_stage_committed: { stage: 'alive'; awakening: 'a4' };
  a4_pond_response_visible: { response: 'structural-ripple'; visible: true };
  a4_herd_route_visible: { grounded: true; visibleAgents: number; routeDistance: number };
  a4_w7744_fault_recorded: { grounded: true; travelledDistance: number };
  field_pack_dropped: {
    source: 'w7744';
    dryGroundValidated: true;
    vegetationContact: 'branch';
    workerGrounded: true;
  };
  maw_repair_kit_acquired: { itemId: 'maw_repair_kit' };
  maw_repair_begun: { toolId: 'faulty_maw'; ritualSeconds: number };
  maw_repair_cancelled: { toolId: 'faulty_maw'; attendedSeconds: number };
  maw_repaired: { toolId: 'iron_maw' };
  maw_direction_resolved: {
    targetKind: string;
    choice: 'lowered-and-listened' | 'harmless-test';
  };
  keel_resonance_detected: {
    source: 'kestrel_keel_memory';
    response: 'structural-ripple';
    visible: true;
  };
  submersion_changed: { submerged: boolean; amount: number };
  oxygen_threshold: { oxygen: number; threshold: number; direction: 'falling' | 'rising' };
  keel_revealed: {
    source: 'repaired-maw-sonar';
    structuralPinVisible: true;
    distance: number;
  };
  keel_memory_acquired: { componentId: string };
  keel_memory_banked: { componentId: 'kestrel_keel_memory'; oxygen: number };
  dive_surfaced: { oxygen: number };
  ship_repair_stage: { from: string; to: string };
  ship_boarded: { worldId: string };
  ship_launched: { worldId: string };
  system_body_targeted: {
    worldId: string;
    seed: number;
    profileId: string;
    profileVersion: number;
    profileHash: string;
    archetype: string;
  };
  planet_arrived: { worldId: string };
  station_activated: { stationId: string };
  shelter_certified: { worldId: string; shelterId: string };
  safe_rest_completed: { worldId: string; shelterId: string };
  two_world_story_handoff: { originWorldId: string; siblingWorldId: string };
  ecology_relationship_observed: { worldId: string; relationshipId: string };
  settlement_foundation_placed: {
    transactionEventId: string;
    cell: [number, number, number];
    face: number;
    material: string;
  };
  settlement_scanner_overload: {
    worldId: string;
    visibleSignalCount: number;
    relationshipKinds: number;
  };
  settlement_site_chosen: {
    worldId: string;
    cell: [number, number, number];
    supportCell: [number, number, number];
    up: [number, number, number];
  };
  ecology_route_changed: { worldId: string; routeId: string; reason: string };
  regrowth_stage_changed: { worldId: string; nodeId: string; stage: string };
  observation_recorded: { observationId: string; revisionKind: string };
  accomplishment_recorded: { accomplishmentId: string };
}

export type EmergentStoryEventType = keyof EmergentStoryEventPayloads;

export type EmergentStoryEvent<T extends EmergentStoryEventType = EmergentStoryEventType> = {
  [K in T]: {
    id: string;
    type: K;
    sequence: number;
    actorId?: string;
    worldId?: string;
    occurredAt?: number;
    payload: EmergentStoryEventPayloads[K];
  }
}[T];

export type EmergentStoryEventInput<T extends EmergentStoryEventType> = Omit<
  EmergentStoryEvent<T>,
  'sequence'
> & { sequence?: number };

const events: EmergentStoryEvent[] = [];
const ids = new Set<string>();
const listeners = new Set<(event: EmergentStoryEvent) => void>();
let nextSequence = 1;

export function emitEmergentStoryEvent<T extends EmergentStoryEventType>(
  input: EmergentStoryEventInput<T>
): EmergentStoryEvent<T> | null {
  const id = input.id.trim();
  if (!id || ids.has(id)) return null;
  const explicit = input.sequence;
  const sequence = explicit !== undefined && Number.isSafeInteger(explicit) && explicit >= 0
    ? explicit
    : nextSequence;
  const event = {
    ...input,
    id,
    sequence
  } as EmergentStoryEvent<T>;
  ids.add(id);
  events.push(event as EmergentStoryEvent);
  events.sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id));
  nextSequence = Math.max(nextSequence, sequence + 1);
  for (const listener of listeners) listener(event as EmergentStoryEvent);
  return event;
}

export function getEmergentStoryEvents(): EmergentStoryEvent[] {
  return events.map(event => ({ ...event, payload: { ...event.payload } } as EmergentStoryEvent));
}

export function subscribeEmergentStoryEvents(
  listener: (event: EmergentStoryEvent) => void
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resetEmergentStoryEvents(): void {
  events.length = 0;
  ids.clear();
  nextSequence = 1;
}
