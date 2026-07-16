import type { ActorId } from '../game/playerActors.ts';
import {
  WRECK_SALVAGE_MILESTONE,
  canAffordShipRepairStage,
  claimWreckSalvage,
  commitShipRepairTransaction
} from '../game/systems/shipRepairTransactions.ts';
import { getShipRepairStage } from '../game/systems/shipRestoration.ts';
import { hasMilestone } from '../game/systems/progressionSystem.ts';
import { hasBankedKestrelKeelMemory } from './emergentUniqueItems.ts';
import { atLeast, nextShipRepairStage, type ShipRepairStage } from './emergentCapabilities.ts';
import type { CommandContext } from '../game/commands.ts';
import { dispatchStoryAuthorityCommand } from '../game/storyAuthorityDispatch.ts';
import {
  hasFirstLegalHoverReceipt,
  hasFirstHoverGroundedReturn,
  hasWreckDiagnosisReceipt
} from './reconstructionEmbodiment.ts';
import type { GuidedStoryObjective } from './ux/objectiveDirector.ts';
import { hasReconstructionCalibrationReceipt } from './reconstructionCalibration.ts';

type RepairTarget = Exclude<ShipRepairStage, 'wrecked'>;

export type WreckReconstructionAction =
  | { kind: 'salvage'; interactionId: 'story-wreck-salvage'; verb: string }
  | {
    kind: 'repair';
    interactionId: 'story-ship-repair';
    target: RepairTarget;
    verb: string;
  };

export interface WreckReconstructionResult {
  ok: boolean;
  idempotent: boolean;
  pending?: boolean;
  repairStage: ShipRepairStage;
}

/** One source of truth for the repair loop's text and persistent objective marker.
 * A required step must never become an invisible absence of an F interaction. */
export interface WreckReconstructionGuidance {
  id: string;
  kind: GuidedStoryObjective['kind'];
  markerLabel: GuidedStoryObjective['markerLabel'];
  workOrder: GuidedStoryObjective['workOrder'];
  requiresMarker?: GuidedStoryObjective['requiresMarker'];
}

export const WRECK_RECONSTRUCTION_EVENT_IDS = {
  salvage: 'story:reconstruct:wreck-salvage',
  stage: (stage: RepairTarget) => `story:reconstruct:${stage}`
} as const;

export const WRECK_BENCH_ACCESS_REACH = 5.6;

const REPAIR_VERBS: Readonly<Record<RepairTarget, string>> = {
  bench_online: 'Install Keel Workbench',
  frame_restored: 'Restore Strut Frame',
  hull_sealed: 'Seal Scarred Hull',
  lift_online: 'Install Lift Cell',
  flight_ready: 'Calibrate Flight Controls'
};

/** Live F-action at the wreck. Missing prerequisites intentionally yield no verb. */
export function getWreckReconstructionAction(actorId?: ActorId): WreckReconstructionAction | null {
  // Diagnosis is a distinct embodied act at the scar. Salvage and repair cannot
  // silently stand in for it, because the signed reconstruction rail begins at
  // the physical relationship trace.
  if (!hasWreckDiagnosisReceipt(actorId)) return null;
  const stage = getShipRepairStage();
  // The cache is one shared physical fact. A peer's accepted bench stage proves
  // it was already consumed even if this actor never owned the finite outputs.
  if (stage === 'wrecked' && !hasMilestone(WRECK_SALVAGE_MILESTONE, actorId)) {
    return {
      kind: 'salvage',
      interactionId: 'story-wreck-salvage',
      verb: 'Recover Wreck Salvage'
    };
  }

  const target = nextShipRepairStage(stage);
  if (!target || target === 'wrecked') return null;
  if (target === 'bench_online' && !hasBankedKestrelKeelMemory(actorId)) return null;
  if (target === 'flight_ready' && !hasFirstHoverGroundedReturn(actorId)) return null;
  if (!canAffordShipRepairStage(target, actorId)) return null;
  return {
    kind: 'repair',
    interactionId: 'story-ship-repair',
    target,
    verb: REPAIR_VERBS[target]
  };
}

export function getWreckReconstructionGuidance(actorId?: ActorId): WreckReconstructionGuidance {
  if (!hasWreckDiagnosisReceipt(actorId)) {
    return {
      id: 'diagnose',
      kind: 'interact',
      markerLabel: 'WRECK SCAR · TRACE RELATIONSHIPS',
      workOrder: ['FOLLOW THE WRECK MARKER.', 'AIM AT THE SCAR. [F] TRACE RELATIONSHIPS.']
    };
  }

  const stage = getShipRepairStage();
  const liftInstalled = stage === 'lift_online' || stage === 'flight_ready';
  if (liftInstalled && !hasFirstLegalHoverReceipt(actorId)) {
    return {
      id: 'lift-test',
      kind: 'travel',
      markerLabel: 'UPPER ROUTE SOCKET · HOLD THRUST',
      workOrder: ['REACH THE UPPER ROUTE SOCKET.', 'HOLD JUMP / THRUST IN THE SOCKET, THEN RETURN TO GROUND.']
    };
  }
  if (liftInstalled && !hasFirstHoverGroundedReturn(actorId)) {
    return {
      id: 'lift-return',
      kind: 'travel',
      markerLabel: 'WRECK · LAND HERE',
      workOrder: ['RETURN TO GROUND AT THE WRECK.']
    };
  }

  const target = nextShipRepairStage(stage);
  if (!target || target === 'wrecked') {
    if (!hasReconstructionCalibrationReceipt(actorId)) {
      return {
        id: 'calibrating',
        kind: 'wait',
        markerLabel: 'KESTREL · CALIBRATING',
        workOrder: ['FLIGHT CALIBRATION IN PROGRESS.'],
        requiresMarker: false
      };
    }
    return {
      id: 'ready',
      kind: 'wait',
      markerLabel: 'WRECK · FLIGHT READY',
      workOrder: ['FLIGHT CONTROLS CALIBRATED.'],
      requiresMarker: false
    };
  }
  const action = getWreckReconstructionAction(actorId);
  if (action) {
    return {
      id: `repair:${target}`,
      kind: 'interact',
      markerLabel: `WRECK BENCH · ${action.verb.toUpperCase()}`,
      workOrder: [`RETURN TO THE WRECK BENCH.`, `[F] ${action.verb.toUpperCase()}.`]
    };
  }
  return {
    id: `craft:${target}`,
    kind: 'craft',
    markerLabel: `WRECK BENCH · CRAFT ${craftLabel(target)}`,
    workOrder: ['RETURN TO THE WRECK BENCH.', `[C] OPEN FABRICATOR. CRAFT ${craftLabel(target)}.`]
  };
}

/** Execute a previously resolved action through the finite canonical transactions. */
export function performWreckReconstructionAction(
  action: WreckReconstructionAction,
  actorId?: ActorId,
  commandContext?: CommandContext
): WreckReconstructionResult {
  // Revalidate physical receipts at commit time. UI-resolved actions are only
  // hints: a stale closure, scripted caller, or authority retry must not be
  // able to turn a forged action object into salvage before diagnosis or route
  // calibration before the grounded first-hover return.
  if (!hasWreckDiagnosisReceipt(actorId)
    || (action.kind === 'repair'
      && action.target === 'flight_ready'
      && !hasFirstHoverGroundedReturn(actorId))) {
    return {
      ok: false,
      idempotent: false,
      repairStage: getShipRepairStage()
    };
  }
  if (commandContext) {
    const commandId = action.kind === 'salvage'
      ? WRECK_RECONSTRUCTION_EVENT_IDS.salvage
      : WRECK_RECONSTRUCTION_EVENT_IDS.stage(action.target);
    const lane = dispatchStoryAuthorityCommand(commandContext, {
      commandId,
      commandType: action.kind === 'salvage' ? 'wreck_salvage_claimed' : 'ship_repair_stage',
      payload: action.kind === 'salvage' ? {} : { stage: action.target }
    });
    if (lane === 'pending') {
      return { ok: true, idempotent: false, pending: true, repairStage: getShipRepairStage() };
    }
    if (lane === 'blocked') {
      return { ok: false, idempotent: false, repairStage: getShipRepairStage() };
    }
  }
  if (action.kind === 'salvage') {
    const claimed = claimWreckSalvage(WRECK_RECONSTRUCTION_EVENT_IDS.salvage, actorId);
    return {
      ok: true,
      idempotent: !claimed,
      repairStage: getShipRepairStage()
    };
  }

  const result = commitShipRepairTransaction(
    WRECK_RECONSTRUCTION_EVENT_IDS.stage(action.target),
    action.target,
    actorId
  );
  return {
    ok: result.ok,
    idempotent: result.idempotent,
    repairStage: result.state.repairStage
  };
}

export function wreckRepairVerb(stage: RepairTarget): string {
  return REPAIR_VERBS[stage];
}

function craftLabel(stage: RepairTarget): string {
  if (stage === 'lift_online') return 'LIFT CELL';
  if (stage === 'flight_ready') return 'LOGIC WAFER';
  return REPAIR_VERBS[stage].toUpperCase();
}

export function isWreckBenchStationAccessActive(
  stage: ShipRepairStage,
  distanceSquared: number
): boolean {
  return atLeast(stage, 'bench_online')
    && Number.isFinite(distanceSquared)
    && distanceSquared <= WRECK_BENCH_ACCESS_REACH ** 2;
}

/** Deterministic physical righting of the one existing exterior across stages. */
export function wreckTiltForStage(stage: ShipRepairStage): number {
  switch (stage) {
    case 'wrecked': return 0.28;
    case 'bench_online': return 0.245;
    case 'frame_restored': return 0.19;
    case 'hull_sealed': return 0.125;
    case 'lift_online': return 0.055;
    case 'flight_ready': return 0;
  }
}
