import * as THREE from 'three';
import { subscribeFinalizedLocalGameplayCommand } from '../game/commandDispatchAdapter.ts';
import { getLocalActorId } from '../game/playerActors.ts';
import { getCampfires } from '../game/systems/campfires.ts';
import { getShipRepairStage } from '../game/systems/shipRestoration.ts';
import { hasMilestone, markMilestone } from '../game/systems/progressionSystem.ts';
import {
  clearVoxelRealityOverrides,
  overrideVoxelRealityEffects
} from '../game/systems/realityRenderSystem.ts';
import { playSfx } from '../audio/sfxEngine.ts';
import { getSpaceFlightSnapshot } from '../state/spaceFlight.ts';
import { getSystemFlightSnapshot } from '../state/systemFlight.ts';
import { getAppStateSnapshot } from '../state/appState.ts';
import {
  commitA4Alive,
  EMERGENT_AUDIT_MILESTONES,
  FIELD_PACK_DROPPED_MILESTONE
} from './emergentAudit.ts';
import {
  hasBankedKestrelKeelMemory
} from './emergentUniqueItems.ts';
import { getAuthoredDiveGuidance } from './emergentDive.ts';
import {
  EMERGENT_MAW_MILESTONES,
  getAuthoredMawGuidance,
  getMawFirstDirectionChoice
} from './emergentMawRepair.ts';
import { emitEmergentStoryEvent } from './emergentStoryEvents.ts';
import { scoreHit, setScoreIntensity } from './storyScore.ts';
import {
  advanceToBeat,
  completeStory,
  getStoryStateSnapshot,
  STORY_MILESTONES,
  type StoryBeat
} from './storyState.ts';
import { showAuditLine, showCaption, showSystemLine, setWorkOrder } from './storyText.ts';
import { setStoryTargetFov, SANDBOX_FOV } from './storyInputPolicy.ts';
import {
  setCinematicLookTarget,
  setCinematicLookWeight
} from './cinematicLook.ts';
import { getFeedRuntime } from './feedRuntime.ts';
import { STORY_PRIMARY_WORLD_ID, TIDEGARDEN_WORLD_ID } from './tidegardenRoute.ts';
import {
  getTidegardenChosenHabitatSite,
  getTidegardenSettlementGuidance,
  tidegardenFoundationMatchesSiteChoice,
  TIDEGARDEN_SETTLEMENT_MILESTONES
} from './tidegardenSettlement.ts';
import { getPieces } from '../game/systems/structureSystem.ts';
import { getItemCount } from '../game/systems/inventorySystem.ts';
import { getCurrentDayPhase } from '../game/worldClock.ts';
import { storyAnchors } from './world/storyWorld.ts';
import { getAuditWorkerPose } from './world/AuditWorker.tsx';
import { heroTreeHandle } from './world/HeroAppleTree.tsx';
import { wreckRelayHandle } from './world/WreckRelay.tsx';
import { createLiveAgentSurfaceTerrain } from '../utils/agentSurfaceNavigationRuntime.ts';
import { planAgentSurfaceRoute } from '../utils/agentSurfaceNavigation.ts';
import {
  groundedSurfaceRouteLength,
  sampleGroundedSurfaceRoute,
  turnGroundedHeadingToward,
  type GroundedSurfaceSample
} from '../utils/groundedSurfaceMotion.ts';
import { resolveSystemBodyMusicIdentity } from '../audio/destinationMusicIdentity.ts';
import {
  enterSignedSceneAvBeat,
  tickSignedSceneAvRuntime
} from './signedSceneAvRuntime.ts';
import {
  activateVehicleSceneAvEvent,
  VEHICLE_SCENE_AV_EVENTS
} from './vehicleSceneAvAnchors.ts';
import {
  getPhysicalBoardingGuidance,
  getPhysicalBoardingSnapshot,
  hasCompletedPhysicalBoarding,
  hasSealedPhysicalBoarding,
  reconcilePhysicalBoardingSignedAvFromReceipt
} from './physicalBoarding.ts';
import {
  hasFirstHoverGroundedReturn,
  hasFirstLegalHoverReceipt,
  hasWreckDiagnosisReceipt,
  reconcileReconstructionSignedAvFromReceipts
} from './reconstructionEmbodiment.ts';
import {
  getReconstructionCalibrationSnapshot,
  hasReconstructionCalibrationReceipt
} from './reconstructionCalibration.ts';
import { getWreckReconstructionGuidance } from './wreckReconstruction.ts';
import {
  hydrateChapter7BoardingScore,
  syncChapter7ReconstructionScore
} from './emergentScoreDirector.ts';
import {
  activateGuidedStoryObjective,
  clearGuidedStoryObjective
} from './ux/objectiveDirector.ts';
import { resolveStoryObjectiveGuidance } from './storyObjectiveGuidance.ts';

const ORIGIN_WORLD_ID = STORY_PRIMARY_WORLD_ID;

interface EmergentDirectorRuntime {
  beat: StoryBeat | null;
  elapsed: number;
  latches: Set<string>;
  completionObservedAt: number;
}

const runtime: EmergentDirectorRuntime = {
  beat: null,
  elapsed: 0,
  latches: new Set(),
  completionObservedAt: -1
};
let finalizedLocalCommandStoryAdapterInstalled = false;

function syncEmergentObjectiveGuidance(beat: StoryBeat | null): void {
  if (!beat) return;
  const actorId = getLocalActorId();
  const guidance = (() => {
    switch (beat) {
      case 'ch4-audit':
        return resolveStoryObjectiveGuidance(beat, {
          auditStage: !hasMilestone(EMERGENT_AUDIT_MILESTONES.fireMismatch, actorId)
            ? 'fire'
            : !hasMilestone(EMERGENT_AUDIT_MILESTONES.lifeMismatch, actorId)
              ? 'life'
              : !hasMilestone(EMERGENT_AUDIT_MILESTONES.treeMismatch, actorId)
                ? 'tree'
                : 'complete'
        });
      case 'ch4-comply':
        return resolveStoryObjectiveGuidance(beat, {
          complianceStage: !hasMilestone(EMERGENT_AUDIT_MILESTONES.fireComplied, actorId)
            ? 'fire'
            : !hasMilestone(EMERGENT_AUDIT_MILESTONES.organicsComplied, actorId)
              ? 'organics'
              : 'complete'
        });
      case 'ch4-defy':
        return resolveStoryObjectiveGuidance(beat, {
          defianceStage: hasMilestone(EMERGENT_AUDIT_MILESTONES.refusalCommitted, actorId)
            ? 'complete'
            : hasMilestone(EMERGENT_AUDIT_MILESTONES.refusalAvailable, actorId)
              ? 'refuse'
              : 'test-maw'
        });
      case 'ch8-launch': {
        const flight = getSpaceFlightSnapshot();
        return resolveStoryObjectiveGuidance(beat, {
          ch8LaunchState: flight.phase === 'surface'
            ? 'surface-flight'
            : flight.phase === 'deep_space'
              ? 'deep-space'
              : 'launching'
        });
      }
      case 'ch8-crossing': {
        const system = getSystemFlightSnapshot();
        const tidegardenTargeted = system.target?.kind === 'system_body'
          && system.target.worldId === TIDEGARDEN_WORLD_ID;
        return resolveStoryObjectiveGuidance(beat, {
          // A surface/descent flight snapshot by itself is not evidence that
          // Tidegarden's approach envelope has been reached. During boot the
          // story snapshot can publish before flight continuity hydrates; only
          // system-body ownership may advance this objective to approach.
          ch8CrossingState: system.activePlanetId === TIDEGARDEN_WORLD_ID
            ? 'approach-envelope'
            : tidegardenTargeted
              ? 'hold-course'
              : 'acquire-sibling'
        });
      }
      case 'ch8-landfall': {
        const flight = getSpaceFlightSnapshot();
        return resolveStoryObjectiveGuidance(beat, {
          ch8LandfallState: flight.phase !== 'surface'
            ? 'descent'
            : flight.controlMode === 'flight'
              ? 'surface-flight'
              : 'surface-fps'
        });
      }
      default:
        return null;
    }
  })();
  if (guidance) activateGuidedStoryObjective(guidance);
}

interface AuditRouteRuntime {
  key: string | null;
  terrainRevision: string | null;
  route: Array<{ position: THREE.Vector3 }>;
  distance: number;
  length: number;
  sample: GroundedSurfaceSample;
}

const auditRoute: AuditRouteRuntime = {
  key: null,
  terrainRevision: null,
  route: [],
  distance: 0,
  length: 0,
  sample: {
    position: new THREE.Vector3(),
    heading: new THREE.Vector3(),
    distance: 0,
    segmentIndex: -1,
    segmentProgress: 0
  }
};
const AUDITOR_WALK_SPEED = 2.45;
const AUDITOR_TURN_SPEED = 5.2;

/** Called by the primary director at the same beat boundary as score/camera reset. */
export function enterEmergentStoryBeat(beat: StoryBeat | null): void {
  ensureFinalizedLocalCommandStoryAdapter();
  const leavingA4 = runtime.beat === 'a4-exhale' && beat !== 'a4-exhale';
  if (leavingA4) {
    clearVoxelRealityOverrides();
    getFeedRuntime().cinematic = 0;
    setCinematicLookWeight(0);
    setCinematicLookTarget(null);
    setStoryTargetFov(SANDBOX_FOV);
  }
  runtime.beat = beat;
  runtime.elapsed = 0;
  runtime.latches.clear();
  runtime.completionObservedAt = -1;
  clearGuidedStoryObjective();
  resetAuditRoute();
  if (beat === 'a4-exhale' && hasMilestone(STORY_MILESTONES.a4)) {
    // Reload after the authority commit reconstructs at the committed front; it
    // never rewinds the living world to the pre-refusal material floor.
    runtime.elapsed = 1.75;
  }

  switch (beat) {
    case 'ch4-audit':
      setWorkOrder(['FOLLOW THE INSPECTION.', 'ATTEND EACH MISMATCH.']);
      showAuditLine('AUDIT IN PROGRESS. THREE DEVIATIONS REQUIRE WITNESS.', 'W-7744');
      break;
    case 'ch4-comply':
      setWorkOrder(['RESOLVE HEAT SOURCE.', 'RESOLVE ORGANIC CONTAMINATION.']);
      showAuditLine('RESTORE THE SITE TO ITS VERIFIED FLOOR.', 'W-7744');
      break;
    case 'ch4-defy':
      setWorkOrder(['STERILIZE PRIMARY ORGANIC ANOMALY.']);
      showAuditLine('THE TREE IS THE REMAINING ERROR.', 'W-7744');
      break;
    case 'a4-exhale':
      setWorkOrder([]);
      setScoreIntensity(0.04);
      break;
    case 'ch5-maw':
      // Publish before the first rendered world tick. Cold/direct chapter loads
      // can spend tens of seconds preparing terrain; guidance must not look
      // absent while the Canvas is still waiting to drive tickMaw().
      activateGuidedStoryObjective(getAuthoredMawGuidance(getLocalActorId()));
      showCaption('(something tore free when he ran.)');
      break;
    case 'ch6-dive':
      activateGuidedStoryObjective(getAuthoredDiveGuidance(getLocalActorId()));
      showCaption('(the repaired tool has marked something beneath the water.)');
      break;
    case 'ch7-reconstruct':
      {
        const guidance = getWreckReconstructionGuidance(getLocalActorId());
        activateGuidedStoryObjective({
          ...guidance,
          id: `reconstruct:${guidance.id}`
        });
      }
      showCaption('(repair is not return.)');
      break;
    case 'ch7-board':
      activateGuidedStoryObjective(getPhysicalBoardingGuidance());
      showCaption('(the wreck is waiting for an owner.)');
      break;
    case 'ch8-launch':
      setWorkOrder(['IGNITE. LIFT. LEAVE THE ATMOSPHERE.']);
      break;
    case 'ch8-crossing':
      setWorkOrder(['FIND THE SIBLING WORLD.', 'HOLD COURSE INTO ITS APPROACH ENVELOPE.']);
      showCaption('(there is another world here. it was always here.)');
      break;
    case 'ch8-landfall':
      setWorkOrder(['LAND ON DRY, LEVEL GROUND.', 'EXIT THE KESTREL.']);
      break;
    case 'ch9-settle':
      activateSettlementGuidance(getLocalActorId());
      showCaption('(abundance is not permission. it is a question with many answers.)');
      break;
    case 'ch9-hearth':
      activateSettlementGuidance(getLocalActorId());
      break;
    default:
      break;
  }
  syncEmergentObjectiveGuidance(beat);
  // Story, score, camera and PostFX all enter the frozen council contract at
  // this same beat boundary. The rail changes presentation only; durable facts
  // above remain the sole progression authority.
  const story = getStoryStateSnapshot();
  enterSignedSceneAvBeat(
    beat,
    story.chapter === 'complete' ? 'completion' : story.chapter === 'none' ? 'sandbox' : 'quit'
  );
}

/**
 * Advances only from durable gameplay facts. Timers provide breathing room
 * after a committed act; they never substitute for it.
 */
export function emergentStoryDirectorTick(dt: number): void {
  const beat = runtime.beat;
  if (!beat) return;
  runtime.elapsed += Math.max(0, dt);
  syncEmergentObjectiveGuidance(beat);
  switch (beat) {
    case 'ch4-audit':
      tickAudit(dt);
      break;
    case 'ch4-comply':
      tickCompliance(dt);
      break;
    case 'ch4-defy':
      tickRefusal(dt);
      break;
    case 'a4-exhale':
      tickA4();
      break;
    case 'ch5-maw':
      tickMaw();
      break;
    case 'ch6-dive':
      tickDive();
      break;
    case 'ch7-reconstruct':
      tickReconstruction();
      break;
    case 'ch7-board':
      tickBoarding();
      break;
    case 'ch8-launch':
      tickLaunch();
      break;
    case 'ch8-crossing':
      tickCrossing();
      break;
    case 'ch8-landfall':
      tickLandfall();
      break;
    case 'ch9-settle':
      tickSettlement();
      break;
    case 'ch9-hearth':
      tickSecondHearth();
      break;
    default:
      break;
  }
  // Last presentation writer in the emergent lane: applies only contracted FOV
  // envelopes and leaves look, movement and interactions player-owned.
  tickSignedSceneAvRuntime(dt);
}

function tickAudit(dt: number): void {
  const actorId = getLocalActorId();
  moveAuditor(dt, currentAuditTarget(actorId));
  if (hasMilestone(EMERGENT_AUDIT_MILESTONES.fireMismatch, actorId)) {
    once('audit-fire', () => showAuditLine('HEAT SOURCE: PERSISTENT WITHOUT AUTHORIZATION.', 'W-7744'));
  }
  if (hasMilestone(EMERGENT_AUDIT_MILESTONES.lifeMismatch, actorId)) {
    once('audit-life', () => showAuditLine('BIOLOGICAL NOISE HAS BEEN MISCLASSIFIED AS SCENERY.', 'W-7744'));
  }
  if (!hasMilestone(EMERGENT_AUDIT_MILESTONES.treeMismatch, actorId)) return;
  once('audit-tree', () => {
    showAuditLine('PRIMARY ORGANIC ANOMALY CONFIRMED. STERILIZATION AUTHORIZED.', 'W-7744');
    emitEmergentStoryEvent({
      id: `story:audit:${actorId}:sterilization-authorized`,
      type: 'audit_directive_issued',
      actorId,
      worldId: ORIGIN_WORLD_ID,
      payload: { directive: 'sterilization' }
    });
    runtime.completionObservedAt = runtime.elapsed;
  });
  if (runtime.elapsed < runtime.completionObservedAt + 1.25) return;
  markMilestone(STORY_MILESTONES.ch4Audit, actorId);
  advanceToBeat('ch4-comply');
}

function tickCompliance(dt: number): void {
  const actorId = getLocalActorId();
  moveAuditor(dt, currentComplianceTarget(actorId));
  if (hasMilestone(EMERGENT_AUDIT_MILESTONES.fireComplied, actorId)) {
    once('comply-fire', () => showCaption('(the warmth goes out because a voice named it wrong.)'));
  }
  if (!hasMilestone(EMERGENT_AUDIT_MILESTONES.regressionSettled, actorId)) return;
  once('comply-organics', () => {
    showSystemLine('VERIFIED REALITY FLOOR RESTORED.');
    runtime.completionObservedAt = runtime.elapsed;
  });
  if (runtime.elapsed < runtime.completionObservedAt + 1.5) return;
  markMilestone(STORY_MILESTONES.ch4Complied, actorId);
  advanceToBeat('ch4-defy');
}

function tickRefusal(dt: number): void {
  const actorId = getLocalActorId();
  moveAuditor(dt, heroTreeHandle.position
    ? { key: 'refuse-tree', position: heroTreeHandle.position }
    : null);
  if (!hasMilestone(EMERGENT_AUDIT_MILESTONES.refusalCommitted, actorId)) return;
  once('refusal', () => {
    showCaption('no.', 4200);
    setWorkOrder([]);
    setScoreIntensity(0);
    runtime.completionObservedAt = runtime.elapsed;
  });
  if (runtime.elapsed < runtime.completionObservedAt + 2.2) return;
  markMilestone(STORY_MILESTONES.ch4Defied, actorId);
  advanceToBeat('a4-exhale');
}

function tickA4(): void {
  const actorId = getLocalActorId();
  if (runtime.elapsed >= 1.75) {
    once('a4-life-front', () => {
      const committed = commitA4Alive(ORIGIN_WORLD_ID, actorId);
      if (!committed.ok) {
        runtime.latches.delete('a4-life-front');
        return;
      }
      if (!committed.idempotent) {
        playSfx('storyAwaken');
        scoreHit('bloom');
      }
      setScoreIntensity(0.8);
      if (!committed.idempotent) {
        showCaption('(the world exhales where it had been holding still.)');
      }
    });
  }
  if (!hasMilestone(EMERGENT_AUDIT_MILESTONES.a4Alive, actorId)) return;
  const lifeProgress = smoothstep((runtime.elapsed - 1.75) / 3.4);
  overrideVoxelRealityEffects({
    organic: lifeProgress,
    detail: 0.82 + lifeProgress * 0.18,
    atmosphere: 0.72 + lifeProgress * 0.28
  });
  const feed = getFeedRuntime();
  feed.cinematic = sceneEnvelope(runtime.elapsed, 0.25, 1.2, 8.7, 10.5);
  const focus = a4FocusTarget();
  setCinematicLookTarget(focus);
  const gazeEnvelope = sceneEnvelope(runtime.elapsed, 1.5, 2.25, 8.7, 10.5);
  setCinematicLookWeight(focus ? Math.min(0.68, gazeEnvelope * 0.68) : 0);
  setStoryTargetFov(58 + smoothstep((runtime.elapsed - 7.2) / 3.3) * (SANDBOX_FOV - 58));
  if (hasMilestone(EMERGENT_AUDIT_MILESTONES.a4PondVisible, actorId)) {
    once('a4-pond', () => showCaption('(water answers first. then wings. then everything at once.)'));
  }
  if (hasMilestone(EMERGENT_AUDIT_MILESTONES.a4WorkerFlight, actorId)) once('a4-flight', () => {
    showAuditLine('FAULT: W-7744 / MODEL REFUSED BY OBSERVATION', 'AUDIT NETWORK', 5000);
  });
  if (runtime.elapsed < 10.5 || !hasMilestone(FIELD_PACK_DROPPED_MILESTONE, actorId)) return;
  markMilestone(STORY_MILESTONES.a4Handback, actorId);
  clearVoxelRealityOverrides();
  feed.cinematic = 0;
  setCinematicLookWeight(0);
  setCinematicLookTarget(null);
  setStoryTargetFov(SANDBOX_FOV);
  setScoreIntensity(0.42);
  advanceToBeat('ch5-maw');
}

function tickMaw(): void {
  const actorId = getLocalActorId();
  activateGuidedStoryObjective(getAuthoredMawGuidance(actorId));
  if (!hasMilestone('maw_repaired', actorId)) return;
  once('maw-repaired', () => {
    markMilestone(STORY_MILESTONES.senseMaw, actorId);
    showCaption('(it does not wake hungry. it wakes listening.)');
  });
  if (!hasMilestone(EMERGENT_MAW_MILESTONES.directionResolved, actorId)) return;
  once('maw-direction', () => {
    const choice = getMawFirstDirectionChoice(actorId);
    showCaption(choice === 'lowered-and-listened'
      ? '(you lower it. the world supplies no order.)'
      : choice === 'harmless-test'
        ? '(it cuts. the world supplies no order.)'
        : '(the world supplies no order. direction was yours.)');
  });
  if (!hasMilestone(EMERGENT_MAW_MILESTONES.pondResonance, actorId)) return;
  once('maw-resonance', () => {
    runtime.completionObservedAt = runtime.elapsed;
    showCaption('(the pond answers in structure, not instruction.)');
  });
  if (runtime.elapsed < runtime.completionObservedAt + 1.2) return;
  markMilestone(STORY_MILESTONES.ch5Maw, actorId);
  advanceToBeat('ch6-dive');
}

function tickDive(): void {
  const actorId = getLocalActorId();
  activateGuidedStoryObjective(getAuthoredDiveGuidance(actorId));
  if (!hasBankedKestrelKeelMemory(actorId)) return;
  once('dive-banked', () => {
    runtime.completionObservedAt = runtime.elapsed;
    showCaption('(returned with breath. returned with a way to leave.)');
  });
  if (runtime.elapsed < runtime.completionObservedAt + 2.6) return;
  markMilestone(STORY_MILESTONES.ch6Dive, actorId);
  advanceToBeat('ch7-reconstruct');
}

function tickReconstruction(): void {
  const actorId = getLocalActorId();
  const repairStage = getShipRepairStage();
  const calibration = getReconstructionCalibrationSnapshot();
  syncChapter7ReconstructionScore({
    repairStage,
    firstHoverComplete: hasFirstLegalHoverReceipt(actorId),
    groundedReturnComplete: hasFirstHoverGroundedReturn(actorId),
    calibrationState: hasReconstructionCalibrationReceipt(actorId)
      ? 'complete'
      : calibration.phase === 'running'
        ? 'active'
        : 'none'
  });
  const guidance = getWreckReconstructionGuidance(actorId);
  activateGuidedStoryObjective({
    ...guidance,
    id: `reconstruct:${guidance.id}`
  });
  reconcileReconstructionSignedAvFromReceipts(actorId, repairStage);
  // Fail closed on restored/authoritative snapshots as well as the live UI
  // path. A flight-ready scalar is not a substitute for the embodied scar,
  // hover, and grounded-return receipts that make that scalar legal.
  if (!hasWreckDiagnosisReceipt(actorId)) return;
  const liftInstalled = repairStage === 'lift_online' || repairStage === 'flight_ready';
  if (liftInstalled && !hasFirstLegalHoverReceipt(actorId)) {
    once('first-hover-caption', () => showCaption('(the ground has to release you before the route will.)'));
    return;
  }
  if (liftInstalled && !hasFirstHoverGroundedReturn(actorId)) {
    return;
  }
  if (repairStage === 'lift_online') {
    return;
  }
  if (getShipRepairStage() !== 'flight_ready') return;
  if (!hasReconstructionCalibrationReceipt(actorId)) return;
  once('calibration-complete', () => {
    runtime.completionObservedAt = runtime.elapsed;
    showCaption('(the scar remains. now it can carry you.)');
  });
  if (runtime.elapsed < runtime.completionObservedAt + 0.65) return;
  markMilestone(STORY_MILESTONES.ch7Reconstructed, actorId);
  advanceToBeat('ch7-board');
}

function tickBoarding(): void {
  const flight = getSpaceFlightSnapshot();
  const actorId = getLocalActorId();
  const boarding = getPhysicalBoardingSnapshot();
  const sealed = hasSealedPhysicalBoarding(actorId, ORIGIN_WORLD_ID);
  if (sealed && (boarding.phase === 'idle' || boarding.phase === 'cancelled')) {
    // A restored save reconstructs steady cockpit sound without replaying the
    // one-shot pressure silence. Live transactions retain their phase edge.
    once('board-score-hydrated', () => hydrateChapter7BoardingScore({
      sealed: true,
      transactionId: boarding.transactionId ?? undefined
    }));
  }
  activateGuidedStoryObjective(getPhysicalBoardingGuidance());
  reconcilePhysicalBoardingSignedAvFromReceipt(actorId, ORIGIN_WORLD_ID);
  // Control ownership changes behind the hatch before the pressure boundary
  // closes. Do not collapse that staged transaction into "flight mode exists".
  if (getSystemFlightSnapshot().activePlanetId !== ORIGIN_WORLD_ID) return;
  // Keep both state-evidence predicates independently inspectable: formal
  // acceptance must prove cockpit ownership and a still-grounded ship rather
  // than treating either half of the conjunction as implied by the other.
  if (flight.controlMode !== 'flight') return;
  if (flight.phase !== 'surface') return;
  if (!hasCompletedPhysicalBoarding(actorId, ORIGIN_WORLD_ID)) return;
  once('boarded', () => {
    markMilestone(STORY_MILESTONES.ch7Boarded, actorId);
    advanceToBeat('ch8-launch');
  });
}

function tickLaunch(): void {
  const flight = getSpaceFlightSnapshot();
  if (flight.controlMode !== 'flight' || flight.phase !== 'deep_space') return;
  const actorId = getLocalActorId();
  emitEmergentStoryEvent({
    id: `story:launch:${actorId}:origin-exit`,
    type: 'ship_launched',
    actorId,
    worldId: ORIGIN_WORLD_ID,
    payload: { worldId: ORIGIN_WORLD_ID }
  });
  markMilestone(STORY_MILESTONES.ch8Launched, actorId);
  advanceToBeat('ch8-crossing');
}

function tickCrossing(): void {
  const system = getSystemFlightSnapshot();
  const flight = getSpaceFlightSnapshot();
  const actorId = getLocalActorId();
  if (system.target?.kind === 'system_body' && system.target.worldId === TIDEGARDEN_WORLD_ID) {
    const identity = resolveSystemBodyMusicIdentity(system.target);
    if (identity) {
      once('sibling-targeted', () => emitEmergentStoryEvent({
        id: `story:crossing:${actorId}:sibling-targeted`,
        type: 'system_body_targeted',
        actorId,
        worldId: TIDEGARDEN_WORLD_ID,
        payload: {
          worldId: TIDEGARDEN_WORLD_ID,
          seed: identity.seed,
          profileId: identity.profileId,
          profileVersion: identity.profileVersion,
          profileHash: identity.profileHash,
          archetype: identity.archetype
        }
      }));
    }
  }
  if (
    system.activePlanetId !== TIDEGARDEN_WORLD_ID
    || flight.phase === 'deep_space'
    || !getAppStateSnapshot().sceneReady
  ) return;
  // The short handoff veil may time out before a low-tier renderer has painted
  // eight destination frames. The director owns the durable fallback: once the
  // same physical world/flight/paint predicate that permits progression is true,
  // authenticate approach before changing beats. The signed landfall shot that
  // starts here must remain live through the beat boundary until touchdown.
  activateVehicleSceneAvEvent(VEHICLE_SCENE_AV_EVENTS.crossingApproach);
  markMilestone(STORY_MILESTONES.ch8Crossed, actorId);
  advanceToBeat('ch8-landfall');
}

function tickLandfall(): void {
  const system = getSystemFlightSnapshot();
  const flight = getSpaceFlightSnapshot();
  if (system.activePlanetId !== TIDEGARDEN_WORLD_ID || flight.phase !== 'surface') return;
  const actorId = getLocalActorId();
  once('touchdown', () => emitEmergentStoryEvent({
    id: `story:landfall:${actorId}:touchdown`,
    type: 'planet_arrived',
    actorId,
    worldId: TIDEGARDEN_WORLD_ID,
    payload: { worldId: TIDEGARDEN_WORLD_ID }
  }));
  if (flight.controlMode !== 'fps') return;
  once('first-footfall', () => {
    runtime.completionObservedAt = runtime.elapsed;
    showCaption('(a world does not begin when you see it. it begins when it holds your weight.)');
  });
  if (runtime.elapsed < runtime.completionObservedAt + 3) return;
  markMilestone(STORY_MILESTONES.ch8Landfall, actorId);
  advanceToBeat('ch9-settle');
}

function activateSettlementGuidance(actorId: ReturnType<typeof getLocalActorId>): void {
  const chosen = getTidegardenChosenHabitatSite(actorId);
  const foundationPlaced = Boolean(chosen && getPieces().some(piece => (
    piece.type === 'foundation'
    && piece.cell[0] === chosen.cell[0]
    && piece.cell[1] === chosen.cell[1]
    && piece.cell[2] === chosen.cell[2]
  )));
  const settlementGuidance = getTidegardenSettlementGuidance({
    actorId,
    coreCarried: getItemCount('habitat_core', actorId) > 0,
    foundationPlaced,
    night: getCurrentDayPhase() >= 0.7 || getCurrentDayPhase() <= 0.1
  });
  activateGuidedStoryObjective({
    ...settlementGuidance,
    id: `settle:${settlementGuidance.id}`
  });
}

function tickSettlement(): void {
  const actorId = getLocalActorId();
  activateSettlementGuidance(actorId);
  if (hasMilestone(TIDEGARDEN_SETTLEMENT_MILESTONES.relationshipAttended, actorId)) {
    once('settlement-relationship', () => {
      showCaption('(roots hold the bank. the bank slows the water. neither stands alone.)');
    });
  }
  if (hasMilestone(TIDEGARDEN_SETTLEMENT_MILESTONES.coreOnline, actorId)) {
    once('settlement-core', () => {
      showSystemLine('HABITAT CORE ONLINE · ADDRESS NOT YET PROVEN');
    });
  }
  const proofComplete = hasMilestone(
    TIDEGARDEN_SETTLEMENT_MILESTONES.relationshipAttended,
    actorId
  ) && hasMilestone(
    TIDEGARDEN_SETTLEMENT_MILESTONES.coreOnline,
    actorId
  ) && hasMilestone(
    TIDEGARDEN_SETTLEMENT_MILESTONES.shelterCertified,
    actorId
  );
  if (!proofComplete) return;
  once('settlement-certified', () => {
    runtime.completionObservedAt = runtime.elapsed;
    showCaption('(not a claim on the world. an address inside a relationship.)');
    scoreHit('bloom');
  });
  if (runtime.elapsed < runtime.completionObservedAt + 2.4) return;
  markMilestone(STORY_MILESTONES.ch9Settled, actorId);
  advanceToBeat('ch9-hearth');
}

function tickSecondHearth(): void {
  const actorId = getLocalActorId();
  activateSettlementGuidance(actorId);
  const restCommitted = hasMilestone(
    TIDEGARDEN_SETTLEMENT_MILESTONES.safeRestCompleted,
    actorId
  );
  const handoffCommitted = hasMilestone(
    TIDEGARDEN_SETTLEMENT_MILESTONES.twoWorldHandoff,
    actorId
  );
  if (!restCommitted || !handoffCommitted) return;
  once('second-hearth-rest', () => {
    runtime.completionObservedAt = runtime.elapsed;
    setWorkOrder([]);
    setScoreIntensity(0.36);
    showCaption('(one fire behind you. one fire here. home is the distance you can keep alive.)', 6500);
  });
  if (runtime.elapsed < runtime.completionObservedAt + 5.5) return;
  completeStory();
}

/**
 * Building remains owned by the normal command lane. This adapter translates
 * only its accepted Tidegarden foundation receipt into Story vocabulary; it
 * cannot infer a foundation from selected UI state or an attempted placement.
 */
function ensureFinalizedLocalCommandStoryAdapter(): void {
  if (finalizedLocalCommandStoryAdapterInstalled) return;
  finalizedLocalCommandStoryAdapterInstalled = true;
  subscribeFinalizedLocalGameplayCommand(result => {
    if (runtime.beat !== 'ch9-settle') return;
    const actorId = getLocalActorId();
    for (const event of result.events) {
      if (
        event.type !== 'structure_placed'
        || event.worldId !== TIDEGARDEN_WORLD_ID
        || event.actorId !== actorId
      ) continue;
      const payload = foundationPlacementPayload(event.payload);
      if (!payload || !tidegardenFoundationMatchesSiteChoice(actorId, payload.cell)) continue;
      emitEmergentStoryEvent({
        id: `story:settle:${actorId}:foundation:${event.eventId}`,
        type: 'settlement_foundation_placed',
        actorId,
        worldId: event.worldId,
        occurredAt: event.timeMs,
        payload: {
          transactionEventId: event.eventId,
          ...payload
        }
      });
    }
  });
}

function foundationPlacementPayload(value: unknown): {
  cell: [number, number, number];
  face: number;
  material: string;
} | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const payload = value as Record<string, unknown>;
  if (
    payload.type !== 'foundation'
    || !Array.isArray(payload.cell)
    || payload.cell.length !== 3
    || !payload.cell.every(coordinate => Number.isInteger(coordinate))
    || !Number.isInteger(payload.face)
    || typeof payload.material !== 'string'
    || payload.material.length === 0
  ) return null;
  return {
    cell: [payload.cell[0] as number, payload.cell[1] as number, payload.cell[2] as number],
    face: payload.face as number,
    material: payload.material
  };
}

function once(id: string, action: () => void): void {
  if (runtime.latches.has(id)) return;
  runtime.latches.add(id);
  action();
}

/**
 * World-space half of the shared objective contract for the audit/refusal
 * sequence. The DOM card and edge marker both read the same progression stage;
 * the worker's locomotion reuses these exact target resolvers below.
 */
export function getEmergentStoryMarkerTarget(
  beat: StoryBeat | null,
  actorId: string = getLocalActorId()
): THREE.Vector3 | null {
  switch (beat) {
    case 'ch4-audit':
      return currentAuditTarget(actorId)?.position ?? null;
    case 'ch4-comply':
      return currentComplianceTarget(actorId)?.position ?? null;
    case 'ch4-defy':
      return heroTreeHandle.position;
    default:
      return null;
  }
}

function currentAuditTarget(actorId: string): { key: string; position: THREE.Vector3 } | null {
  if (!hasMilestone(EMERGENT_AUDIT_MILESTONES.fireMismatch, actorId)) {
    const fire = getCampfires()[0];
    return fire ? { key: 'audit-fire', position: tupleVector(fire.pos) } : null;
  }
  if (!hasMilestone(EMERGENT_AUDIT_MILESTONES.lifeMismatch, actorId)) {
    return storyAnchors.pond ? { key: 'audit-life', position: storyAnchors.pond.shore } : null;
  }
  if (!hasMilestone(EMERGENT_AUDIT_MILESTONES.treeMismatch, actorId)) {
    return heroTreeHandle.position ? { key: 'audit-tree', position: heroTreeHandle.position } : null;
  }
  return null;
}

function currentComplianceTarget(actorId: string): { key: string; position: THREE.Vector3 } | null {
  if (!hasMilestone(EMERGENT_AUDIT_MILESTONES.fireComplied, actorId)) {
    const fire = getCampfires()[0];
    return fire ? { key: 'comply-fire', position: tupleVector(fire.pos) } : null;
  }
  if (!hasMilestone(EMERGENT_AUDIT_MILESTONES.organicsComplied, actorId)) {
    return wreckRelayHandle.position ? { key: 'comply-organics', position: wreckRelayHandle.position } : null;
  }
  return null;
}

/**
 * W-7744 uses the same dry A* surface contract and grounded step sampler as the
 * movie agent. A terrain edit replans from his current validated root; no lerp
 * ever cuts through water, a voxel, or a height discontinuity.
 */
function moveAuditor(
  dt: number,
  target: { key: string; position: THREE.Vector3 } | null
): void {
  const size = storyAnchors.planetSize;
  const seed = storyAnchors.terrainSeed;
  const worker = getAuditWorkerPose();
  if (!target || size === null || seed === null || !worker.visible) {
    worker.walk = 0;
    resetAuditRoute();
    return;
  }
  const terrain = createLiveAgentSurfaceTerrain(size, seed, ORIGIN_WORLD_ID);
  if (auditRoute.key !== target.key || auditRoute.terrainRevision !== terrain.revision) {
    const planned = planAgentSurfaceRoute(terrain, size, worker.position, target.position, {
      face: 'top',
      differentFaceFallback: 'unreachable',
      clearanceCells: 2,
      maxSlopeCells: 1,
      edgeMarginCells: 1,
      maxVisitedCells: 8192,
      waypointClearanceWorld: 1.05,
      allowJetpackCrossing: false
    });
    auditRoute.key = target.key;
    auditRoute.terrainRevision = terrain.revision;
    auditRoute.route = planned.mode === 'walk' || planned.mode === 'direct'
      ? planned.waypoints.map(position => ({ position }))
      : [];
    auditRoute.distance = 0;
    auditRoute.length = groundedSurfaceRouteLength(auditRoute.route, worker.up);
  }
  if (auditRoute.route.length === 0 || auditRoute.length <= 0.01) {
    worker.walk = 0;
    return;
  }
  auditRoute.distance = Math.min(auditRoute.length, auditRoute.distance + dt * AUDITOR_WALK_SPEED);
  sampleGroundedSurfaceRoute(
    auditRoute.route,
    auditRoute.distance,
    worker.up,
    auditRoute.sample
  );
  worker.position.copy(auditRoute.sample.position);
  if (auditRoute.sample.heading.lengthSq() > 1e-6) {
    turnGroundedHeadingToward(
      worker.heading,
      auditRoute.sample.heading,
      worker.up,
      AUDITOR_TURN_SPEED * dt
    );
  }
  worker.stride = auditRoute.sample.distance;
  worker.walk = auditRoute.distance < auditRoute.length ? 1 : 0;
}

function resetAuditRoute(): void {
  auditRoute.key = null;
  auditRoute.terrainRevision = null;
  auditRoute.route = [];
  auditRoute.distance = 0;
  auditRoute.length = 0;
}

function tupleVector(value: readonly [number, number, number]): THREE.Vector3 {
  return new THREE.Vector3(value[0], value[1], value[2]);
}

function a4FocusTarget(): THREE.Vector3 | null {
  if (runtime.elapsed < 4.2) return heroTreeHandle.position;
  if (runtime.elapsed < 6.8) return storyAnchors.pond?.surface ?? heroTreeHandle.position;
  return storyAnchors.fieldPack?.position ?? heroTreeHandle.position;
}

function smoothstep(value: number): number {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function sceneEnvelope(time: number, inStart: number, inEnd: number, outStart: number, outEnd: number): number {
  const fadeIn = smoothstep((time - inStart) / Math.max(0.001, inEnd - inStart));
  const fadeOut = 1 - smoothstep((time - outStart) / Math.max(0.001, outEnd - outStart));
  return Math.min(fadeIn, fadeOut);
}
