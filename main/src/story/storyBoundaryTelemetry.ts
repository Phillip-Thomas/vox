import type { AppPhase } from '../state/appState.ts';
import { getAppStateSnapshot } from '../state/appState.ts';
import type { ControlMode, FlightPhase } from '../state/spaceFlight.ts';
import { getSpaceFlightSnapshot } from '../state/spaceFlight.ts';
import { getSystemFlightSnapshot } from '../state/systemFlight.ts';
import { getLocalActorId } from '../game/playerActors.ts';
import { hasMilestone } from '../game/systems/progressionSystem.ts';
import { getShipRepairStage } from '../game/systems/shipRestoration.ts';
import {
  getVoxelRealitySnapshot,
  VOXEL_REALITY_STAGES,
  type VoxelRealityStage
} from '../game/systems/realityRenderSystem.ts';
import type { ShipRepairStage } from './emergentCapabilities.ts';
import { getFeedRuntime } from './feedRuntime.ts';
import { getMawRepairRitualSnapshot, type MawRepairRitualSnapshot } from './emergentMawRepair.ts';
import { getSignedSceneAvDebugSnapshot } from './signedSceneAvRuntime.ts';
import { getStoryInputPolicy, type StoryInputPolicy } from './storyInputPolicy.ts';
import {
  getStoryStateSnapshot,
  STORY_MILESTONES,
  type StoryBeat,
  type StoryChapter
} from './storyState.ts';
import { STORY_PRIMARY_WORLD_ID, TIDEGARDEN_WORLD_ID } from './tidegardenRoute.ts';

export interface BoundaryCameraLike {
  readonly isPerspectiveCamera?: boolean;
  readonly fov?: number;
}

export interface StoryBoundaryRuntimeSnapshot {
  readonly story: {
    readonly active: boolean;
    readonly chapter: StoryChapter;
    readonly beat: StoryBeat | null;
    readonly runId: number;
  };
  readonly app: {
    readonly phase: AppPhase;
    readonly sceneReady: boolean;
  };
  readonly world: {
    readonly systemId: string;
    readonly activePlanetId: string | null;
    /**
     * The space station the ship is currently aimed at, if any.
     *
     * Separate from `activePlanetId` because a station is not a planet and never
     * becomes the resident world — flying to one changes nothing about which
     * terrain is loaded. Without its own claim, station approach is invisible to
     * the registry gate: `active-planet` keeps naming the planet you left, so a
     * chapter cannot say "the player is on final at a station" at all.
     */
    readonly spaceStationTargetId: string | null;
  };
  readonly reality: {
    readonly stage: VoxelRealityStage;
  };
  readonly control: {
    readonly mode: ControlMode;
    readonly phase: FlightPhase;
  };
  readonly shipRestoration: {
    readonly repairStage: ShipRepairStage;
  };
  readonly camera: {
    readonly perspective: boolean;
    readonly fov: number | null;
    readonly lookMode: StoryInputPolicy['lookMode'];
    readonly feedBlend: number;
    readonly sideBlend: number;
    readonly externalCameraMix: number;
    readonly signedAuthority: string | null;
  };
  readonly maw: {
    readonly repaired: boolean;
    readonly ritualPhase: MawRepairRitualSnapshot['phase'];
  };
  readonly durable: {
    readonly storyComplete: boolean;
    readonly keelMemoryBanked: boolean;
    readonly twoWorldHandoff: boolean;
    /**
     * Chapter 10's three durable station facts.
     *
     * `ch10BearingClaimed` is the targeting fence: it is what allows the story
     * to aim at a station at all, and being durable it is never un-claimed.
     * `ch10SeamPassed` is the one-shot seam latch (one milestone, two trigger
     * paths). `stationDockingAuthorized` is earned at Chapter 10's threshold
     * hand-back, so the boundary proves the dock stays inert before the reveal
     * and becomes actionable afterwards.
     */
    readonly ch10BearingClaimed: boolean;
    readonly ch10SeamPassed: boolean;
    readonly stationDockingAuthorized: boolean;
  };
}

export interface StoryBoundaryStateTelemetry {
  readonly schema: 'paravoxia.storyBoundaryState.v1';
  /** True means the live authority sources were readable and internally typed. */
  readonly verified: boolean;
  readonly sampledAt: number;
  readonly stateRefs: readonly string[];
  readonly runtime: StoryBoundaryRuntimeSnapshot;
}

const CAMERA_BLEND_EPSILON = 0.01;

function finiteUnit(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

/**
 * Convert live runtime facts into the registry's state-ref vocabulary. This is
 * deliberately one-way: the registry is never read here, so a run cannot pass
 * by echoing the state it was expected to reach.
 */
export function deriveStoryBoundaryState(
  runtime: StoryBoundaryRuntimeSnapshot,
  sampledAt = Date.now()
): StoryBoundaryStateTelemetry {
  const refs = new Set<string>();
  const storyComplete = runtime.durable.storyComplete
    || runtime.story.chapter === 'complete'
    || runtime.story.beat === 'done';

  if (runtime.story.active) refs.add('state:story/active');
  if (runtime.story.active && runtime.app.phase === 'menu') refs.add('state:story/active-menu');
  if (storyComplete) refs.add('state:story/complete');

  if (runtime.world.activePlanetId === STORY_PRIMARY_WORLD_ID) refs.add('state:world/origin');
  if (runtime.world.activePlanetId === TIDEGARDEN_WORLD_ID) refs.add('state:world/tidegarden');
  if (runtime.world.activePlanetId) {
    refs.add(`state:system-flight/active-planet=${runtime.world.activePlanetId}`);
  }
  if (runtime.world.spaceStationTargetId) {
    refs.add(`state:space-station/target=${runtime.world.spaceStationTargetId}`);
    refs.add('state:space-station/targeted');
  }

  refs.add(`state:reality/${runtime.reality.stage}`);
  refs.add(runtime.control.mode === 'fps' ? 'state:control/on-foot' : 'state:control/flight');
  refs.add(`state:space-flight/control-mode=${runtime.control.mode}`);
  refs.add(`state:space-flight/phase=${runtime.control.phase}`);
  if (runtime.control.phase !== 'deep_space') refs.add('state:space-flight/phase!=deep_space');
  refs.add(`state:ship-restoration/${runtime.shipRestoration.repairStage}`);

  const embodied = runtime.camera.perspective
    && runtime.camera.sideBlend >= 1 - CAMERA_BLEND_EPSILON
    && runtime.camera.externalCameraMix <= CAMERA_BLEND_EPSILON;
  const playerOwnsCamera = runtime.camera.signedAuthority === null
    || runtime.camera.signedAuthority === 'player-camera';
  if (embodied) refs.add('state:camera/embodied');
  if (
    embodied
    && playerOwnsCamera
    && runtime.camera.lookMode === 'free'
    && runtime.camera.feedBlend >= 1 - CAMERA_BLEND_EPSILON
  ) refs.add('state:camera/free-look');

  if (runtime.maw.repaired) refs.add('state:maw/repaired');
  if (runtime.durable.keelMemoryBanked) refs.add('state:item/kestrel-keel-memory-banked');
  if (runtime.durable.twoWorldHandoff) refs.add('state:free-play/two-world-handoff');
  // Chapter 10's station claims. The bearing and seam lead the reveal; docking
  // authorization appears only at the terminal hand-back.
  if (runtime.durable.ch10BearingClaimed) refs.add('state:story/ch10-bearing-claimed');
  if (runtime.durable.ch10SeamPassed) refs.add('state:story/ch10-seam-passed');
  if (runtime.durable.stationDockingAuthorized) refs.add('state:station/docking-authorized');

  const verified = (
    Number.isInteger(runtime.story.runId)
    && runtime.story.runId >= 0
    && (runtime.story.beat !== null || storyComplete)
    && (runtime.app.phase === 'menu' || runtime.app.phase === 'playing')
    && typeof runtime.world.systemId === 'string'
    && (runtime.world.activePlanetId === null || typeof runtime.world.activePlanetId === 'string')
    && VOXEL_REALITY_STAGES.includes(runtime.reality.stage)
    && (runtime.control.mode === 'fps' || runtime.control.mode === 'flight')
    && ['surface', 'launch', 'deep_space', 'approach', 'descent'].includes(runtime.control.phase)
    && [
      'wrecked',
      'bench_online',
      'frame_restored',
      'hull_sealed',
      'lift_online',
      'flight_ready'
    ].includes(runtime.shipRestoration.repairStage)
    && runtime.camera.perspective
    && runtime.camera.fov !== null
    && Number.isFinite(runtime.camera.fov)
    && finiteUnit(runtime.camera.feedBlend)
    && finiteUnit(runtime.camera.sideBlend)
    && finiteUnit(runtime.camera.externalCameraMix)
    && typeof runtime.maw.repaired === 'boolean'
  );

  return Object.freeze({
    schema: 'paravoxia.storyBoundaryState.v1',
    verified,
    sampledAt,
    stateRefs: Object.freeze([...refs].sort()),
    runtime
  });
}

export function readStoryBoundaryRuntime(
  camera: BoundaryCameraLike | null
): StoryBoundaryRuntimeSnapshot {
  const story = getStoryStateSnapshot();
  const app = getAppStateSnapshot();
  const system = getSystemFlightSnapshot();
  const flight = getSpaceFlightSnapshot();
  const reality = getVoxelRealitySnapshot();
  const policy = getStoryInputPolicy();
  const feed = getFeedRuntime();
  const sceneAv = getSignedSceneAvDebugSnapshot();
  const actorId = getLocalActorId();
  const ritual = getMawRepairRitualSnapshot(actorId);

  return Object.freeze({
    story: Object.freeze({
      active: story.active,
      chapter: story.chapter,
      beat: story.beat,
      runId: story.runId
    }),
    app: Object.freeze({ phase: app.phase, sceneReady: app.sceneReady }),
    world: Object.freeze({
      systemId: system.systemId,
      activePlanetId: system.activePlanetId,
      spaceStationTargetId:
        system.target?.kind === 'space_station' ? system.target.worldId : null
    }),
    reality: Object.freeze({ stage: reality.stage }),
    control: Object.freeze({ mode: flight.controlMode, phase: flight.phase }),
    shipRestoration: Object.freeze({ repairStage: getShipRepairStage() }),
    camera: Object.freeze({
      perspective: camera?.isPerspectiveCamera === true,
      fov: Number.isFinite(camera?.fov) ? Number(camera?.fov) : null,
      lookMode: policy.lookMode,
      feedBlend: policy.feedBlend,
      sideBlend: policy.sideBlend,
      externalCameraMix: feed.externalCameraMix,
      signedAuthority: sceneAv.shot?.cameraAuthority ?? null
    }),
    maw: Object.freeze({
      repaired: hasMilestone('maw_repaired', actorId),
      ritualPhase: ritual.phase
    }),
    durable: Object.freeze({
      storyComplete: hasMilestone(STORY_MILESTONES.complete, actorId),
      keelMemoryBanked: hasMilestone('story:item:kestrel-keel-memory:banked', actorId),
      twoWorldHandoff: hasMilestone('story:tidegarden:two-world-handoff', actorId),
      ch10BearingClaimed: hasMilestone(STORY_MILESTONES.ch10BearingClaimed, actorId),
      ch10SeamPassed: hasMilestone(STORY_MILESTONES.ch10SeamPassed, actorId),
      stationDockingAuthorized: hasMilestone(STORY_MILESTONES.stationDockingAuthorized, actorId)
    })
  });
}

/** Publish a browser-readable, live-derived snapshot for deterministic acceptance. */
export function publishStoryBoundaryTelemetry(
  camera: BoundaryCameraLike | null
): StoryBoundaryStateTelemetry {
  const telemetry = deriveStoryBoundaryState(readStoryBoundaryRuntime(camera));
  if (typeof window !== 'undefined') {
    (window as Window & {
      __paravoxiaBoundaryState?: StoryBoundaryStateTelemetry;
    }).__paravoxiaBoundaryState = telemetry;
  }
  return telemetry;
}
