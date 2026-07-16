import type { ActorId } from '../game/playerActors.ts';
import { getLocalActorId } from '../game/playerActors.ts';
import { hasMilestone, markMilestone } from '../game/systems/progressionSystem.ts';
import { setVoxelRealityStage } from '../game/systems/realityRenderSystem.ts';
import { emitEmergentStoryEvent } from './emergentStoryEvents.ts';

export type AuditMismatch = 'fire' | 'life' | 'tree';
export type ComplianceAct = 'fire' | 'organics';

export const FIELD_PACK_DROPPED_MILESTONE = 'story:a4:field-pack-dropped';

export const EMERGENT_AUDIT_MILESTONES = {
  fireMismatch: 'story:audit:fire-mismatch',
  lifeMismatch: 'story:audit:life-mismatch',
  treeMismatch: 'story:audit:tree-mismatch',
  fireComplied: 'story:comply:fire-doused',
  organicsComplied: 'story:comply:organics-resolved',
  regressionSettled: 'story:comply:regression-settled',
  protectedToolRefused: 'story:defy:protected-tool-refused',
  refusalAvailable: 'story:defy:refusal-available',
  refusalCommitted: 'story:defy:refusal-committed',
  a4Alive: 'story:a4',
  a4PondVisible: 'story:a4:pond-response-visible',
  a4HerdVisible: 'story:a4:herd-route-visible',
  a4WorkerFlight: 'story:a4:w7744-fault-recorded'
} as const;

const AUDIT_ORDER: readonly AuditMismatch[] = ['fire', 'life', 'tree'];
const COMPLIANCE_ORDER: readonly ComplianceAct[] = ['fire', 'organics'];

export interface EmergentStoryCommitResult {
  ok: boolean;
  idempotent: boolean;
  reason?:
    | 'out-of-order'
    | 'physical-action-required'
    | 'dry-ground-required'
    | 'vegetation-contact-required';
}

export function commitAuditMismatch(
  kind: AuditMismatch,
  worldId: string,
  actorId?: ActorId
): EmergentStoryCommitResult {
  const actor = actorId ?? getLocalActorId();
  const milestone = auditMilestone(kind);
  if (hasMilestone(milestone, actor)) return success(true);
  const index = AUDIT_ORDER.indexOf(kind);
  if (index < 0 || AUDIT_ORDER.slice(0, index).some(entry => !hasMilestone(auditMilestone(entry), actor))) {
    return failure('out-of-order');
  }
  markMilestone(milestone, actor);
  emitEmergentStoryEvent({
    id: `story:audit:${actor}:${kind}-mismatch`,
    type: 'audit_mismatch',
    actorId: actor,
    worldId,
    payload: { kind }
  });
  return success(false);
}

export function commitComplianceAct(
  kind: ComplianceAct,
  physicalActionCommitted: boolean,
  worldId: string,
  actorId?: ActorId
): EmergentStoryCommitResult {
  const actor = actorId ?? getLocalActorId();
  const milestone = complianceMilestone(kind);
  if (hasMilestone(milestone, actor)) return success(true);
  if (!physicalActionCommitted) return failure('physical-action-required');
  if (!hasMilestone(EMERGENT_AUDIT_MILESTONES.treeMismatch, actor)) return failure('out-of-order');
  const index = COMPLIANCE_ORDER.indexOf(kind);
  if (COMPLIANCE_ORDER.slice(0, index).some(entry => !hasMilestone(complianceMilestone(entry), actor))) {
    return failure('out-of-order');
  }
  markMilestone(milestone, actor);
  if (kind === 'organics') markMilestone(EMERGENT_AUDIT_MILESTONES.regressionSettled, actor);
  emitEmergentStoryEvent({
    id: `story:comply:${actor}:${kind}-committed`,
    type: 'compliance_committed',
    actorId: actor,
    worldId,
    payload: { kind }
  });
  return success(false);
}

export function commitTreeRefusal(
  worldId: string,
  actorId?: ActorId
): EmergentStoryCommitResult {
  const actor = actorId ?? getLocalActorId();
  const milestone = EMERGENT_AUDIT_MILESTONES.refusalCommitted;
  if (hasMilestone(milestone, actor)) return success(true);
  if (!hasMilestone(EMERGENT_AUDIT_MILESTONES.refusalAvailable, actor)) return failure('out-of-order');
  markMilestone(milestone, actor);
  emitEmergentStoryEvent({
    id: `story:defy:${actor}:no-committed`,
    type: 'refusal_committed',
    actorId: actor,
    worldId,
    payload: { target: 'hero_tree' }
  });
  return success(false);
}

/**
 * The impossible order must first collide with a real, harmless tool use. The
 * bespoke tree has no harvest transaction, so this receipt proves both the
 * player's attempt and unchanged target integrity before the lowercase verb is
 * made available.
 */
export function commitProtectedTreeToolAttempt(
  worldId: string,
  actorId?: ActorId
): EmergentStoryCommitResult {
  const actor = actorId ?? getLocalActorId();
  if (hasMilestone(EMERGENT_AUDIT_MILESTONES.refusalAvailable, actor)) return success(true);
  if (!hasMilestone(EMERGENT_AUDIT_MILESTONES.regressionSettled, actor)) return failure('out-of-order');
  markMilestone(EMERGENT_AUDIT_MILESTONES.protectedToolRefused, actor);
  emitEmergentStoryEvent({
    id: `story:defy:${actor}:protected-tool-refused`,
    type: 'protected_tree_tool_refused',
    actorId: actor,
    worldId,
    payload: {
      target: 'hero_tree',
      toolId: 'faulty_maw',
      targetIntegrity: 'unchanged'
    }
  });
  markMilestone(EMERGENT_AUDIT_MILESTONES.refusalAvailable, actor);
  emitEmergentStoryEvent({
    id: `story:defy:${actor}:refusal-available`,
    type: 'tree_refusal_available',
    actorId: actor,
    worldId,
    payload: { target: 'hero_tree', verb: 'refuse.' }
  });
  return success(false);
}

/** Commits only the living authority front. Physical disclosures follow. */
export function commitA4Alive(
  worldId: string,
  actorId?: ActorId
): EmergentStoryCommitResult {
  const actor = actorId ?? getLocalActorId();
  if (hasMilestone(EMERGENT_AUDIT_MILESTONES.a4Alive, actor)) return success(true);
  if (!hasMilestone(EMERGENT_AUDIT_MILESTONES.refusalCommitted, actor)) return failure('out-of-order');
  markMilestone(EMERGENT_AUDIT_MILESTONES.a4Alive, actor);
  setVoxelRealityStage('alive');
  emitEmergentStoryEvent({
    id: `story:a4:${actor}:alive-authority-committed`,
    type: 'reality_stage_committed',
    actorId: actor,
    worldId,
    payload: { stage: 'alive', awakening: 'a4' }
  });
  return success(false);
}

export function commitA4PondResponse(
  visible: boolean,
  worldId: string,
  actorId?: ActorId
): EmergentStoryCommitResult {
  const actor = actorId ?? getLocalActorId();
  if (hasMilestone(EMERGENT_AUDIT_MILESTONES.a4PondVisible, actor)) return success(true);
  if (!hasMilestone(EMERGENT_AUDIT_MILESTONES.a4Alive, actor)) return failure('out-of-order');
  if (!visible) return failure('physical-action-required');
  markMilestone(EMERGENT_AUDIT_MILESTONES.a4PondVisible, actor);
  emitEmergentStoryEvent({
    id: `story:a4:${actor}:pond-response-visible`,
    type: 'a4_pond_response_visible',
    actorId: actor,
    worldId,
    payload: { response: 'structural-ripple', visible: true }
  });
  return success(false);
}

export function commitA4HerdCrest(
  visibleAgents: number,
  routeDistance: number,
  worldId: string,
  actorId?: ActorId
): EmergentStoryCommitResult {
  const actor = actorId ?? getLocalActorId();
  if (hasMilestone(EMERGENT_AUDIT_MILESTONES.a4HerdVisible, actor)) return success(true);
  if (!hasMilestone(EMERGENT_AUDIT_MILESTONES.a4PondVisible, actor)) return failure('out-of-order');
  if (visibleAgents < 3 || routeDistance <= 0) return failure('physical-action-required');
  markMilestone(EMERGENT_AUDIT_MILESTONES.a4HerdVisible, actor);
  emitEmergentStoryEvent({
    id: `story:a4:${actor}:herd-route-visible`,
    type: 'a4_herd_route_visible',
    actorId: actor,
    worldId,
    payload: { grounded: true, visibleAgents, routeDistance }
  });
  return success(false);
}

export function commitA4WorkerFlight(
  grounded: boolean,
  travelledDistance: number,
  worldId: string,
  actorId?: ActorId
): EmergentStoryCommitResult {
  const actor = actorId ?? getLocalActorId();
  if (hasMilestone(EMERGENT_AUDIT_MILESTONES.a4WorkerFlight, actor)) return success(true);
  if (!hasMilestone(EMERGENT_AUDIT_MILESTONES.a4HerdVisible, actor)) return failure('out-of-order');
  if (!grounded || travelledDistance < 0.75) return failure('physical-action-required');
  markMilestone(EMERGENT_AUDIT_MILESTONES.a4WorkerFlight, actor);
  emitEmergentStoryEvent({
    id: `story:a4:${actor}:w7744-fault-recorded`,
    type: 'a4_w7744_fault_recorded',
    actorId: actor,
    worldId,
    payload: { grounded: true, travelledDistance }
  });
  return success(false);
}

/** The pack exists only after W-7744 crosses the rendered branch on dry ground. */
export function commitA4FieldPackTear(
  dryGroundValidated: boolean,
  vegetationContact: boolean,
  workerGrounded: boolean,
  worldId: string,
  actorId?: ActorId
): EmergentStoryCommitResult {
  const actor = actorId ?? getLocalActorId();
  if (hasMilestone(FIELD_PACK_DROPPED_MILESTONE, actor)) return success(true);
  if (!hasMilestone(EMERGENT_AUDIT_MILESTONES.a4WorkerFlight, actor)) return failure('out-of-order');
  if (!dryGroundValidated) return failure('dry-ground-required');
  if (!vegetationContact) return failure('vegetation-contact-required');
  if (!workerGrounded) return failure('physical-action-required');
  markMilestone(FIELD_PACK_DROPPED_MILESTONE, actor);
  emitEmergentStoryEvent({
    id: `story:a4:${actor}:field-pack-dropped`,
    type: 'field_pack_dropped',
    actorId: actor,
    worldId,
    payload: {
      source: 'w7744',
      dryGroundValidated: true,
      vegetationContact: 'branch',
      workerGrounded: true
    }
  });
  return success(false);
}

function auditMilestone(kind: AuditMismatch): string {
  if (kind === 'fire') return EMERGENT_AUDIT_MILESTONES.fireMismatch;
  if (kind === 'life') return EMERGENT_AUDIT_MILESTONES.lifeMismatch;
  return EMERGENT_AUDIT_MILESTONES.treeMismatch;
}

function complianceMilestone(kind: ComplianceAct): string {
  return kind === 'fire'
    ? EMERGENT_AUDIT_MILESTONES.fireComplied
    : EMERGENT_AUDIT_MILESTONES.organicsComplied;
}

function success(idempotent: boolean): EmergentStoryCommitResult {
  return { ok: true, idempotent };
}

function failure(reason: EmergentStoryCommitResult['reason']): EmergentStoryCommitResult {
  return { ok: false, idempotent: false, reason };
}
