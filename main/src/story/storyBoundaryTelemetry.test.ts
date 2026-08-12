import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  deriveStoryBoundaryState,
  publishStoryBoundaryTelemetry,
  type StoryBoundaryRuntimeSnapshot
} from './storyBoundaryTelemetry.ts';
import { STORY_PRIMARY_WORLD_ID, TIDEGARDEN_WORLD_ID } from './tidegardenRoute.ts';

function runtime(
  patch: Partial<StoryBoundaryRuntimeSnapshot> = {}
): StoryBoundaryRuntimeSnapshot {
  const base: StoryBoundaryRuntimeSnapshot = {
    story: { active: true, chapter: 'ch6', beat: 'ch6-dive', runId: 4 },
    app: { phase: 'playing', sceneReady: true },
    world: { systemId: '-1,-1', activePlanetId: STORY_PRIMARY_WORLD_ID , spaceStationTargetId: null},
    reality: { stage: 'alive' },
    control: { mode: 'fps', phase: 'surface' },
    shipRestoration: { repairStage: 'wrecked' },
    camera: {
      perspective: true,
      fov: 75,
      lookMode: 'free',
      feedBlend: 1,
      sideBlend: 1,
      externalCameraMix: 0,
      signedAuthority: 'player-camera'
    },
    maw: { repaired: true, ritualPhase: 'committed' },
    durable: {
      storyComplete: false,
      keelMemoryBanked: false,
      twoWorldHandoff: false,
      ch10BearingClaimed: false,
      ch10SeamPassed: false,
      stationDockingAuthorized: false
    }
  };
  return {
    ...base,
    ...patch,
    story: { ...base.story, ...patch.story },
    app: { ...base.app, ...patch.app },
    world: { ...base.world, ...patch.world },
    reality: { ...base.reality, ...patch.reality },
    control: { ...base.control, ...patch.control },
    shipRestoration: { ...base.shipRestoration, ...patch.shipRestoration },
    camera: { ...base.camera, ...patch.camera },
    maw: { ...base.maw, ...patch.maw },
    durable: { ...base.durable, ...patch.durable }
  };
}

describe('story boundary telemetry', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('derives the Chapter 5 exit contract from live runtime facts', () => {
    const telemetry = deriveStoryBoundaryState(runtime(), 1234);

    expect(telemetry).toMatchObject({
      schema: 'paravoxia.storyBoundaryState.v1',
      verified: true,
      sampledAt: 1234
    });
    expect(telemetry.stateRefs).toEqual(expect.arrayContaining([
      'state:world/origin',
      'state:story/active',
      'state:reality/alive',
      'state:control/on-foot',
      'state:space-flight/control-mode=fps',
      'state:space-flight/phase!=deep_space',
      'state:ship-restoration/wrecked',
      'state:camera/embodied',
      'state:camera/free-look',
      'state:maw/repaired'
    ]));
  });

  it('cannot echo a desired boundary when the actual world, camera, control, and Maw disagree', () => {
    const telemetry = deriveStoryBoundaryState(runtime({
      world: { systemId: '-1,-1', activePlanetId: TIDEGARDEN_WORLD_ID , spaceStationTargetId: null},
      reality: { stage: 'material' },
      control: { mode: 'flight', phase: 'deep_space' },
      camera: {
        perspective: true,
        fov: 52,
        lookMode: 'free',
        feedBlend: 1,
        sideBlend: 1,
        externalCameraMix: 0,
        signedAuthority: 'cinematic-look'
      },
      maw: { repaired: false, ritualPhase: 'repairing' }
    }));

    expect(telemetry.verified).toBe(true);
    expect(telemetry.stateRefs).toContain('state:world/tidegarden');
    expect(telemetry.stateRefs).toContain('state:control/flight');
    expect(telemetry.stateRefs).toContain('state:space-flight/control-mode=flight');
    expect(telemetry.stateRefs).not.toContain('state:space-flight/phase!=deep_space');
    expect(telemetry.stateRefs).not.toEqual(expect.arrayContaining([
      'state:world/origin',
      'state:reality/alive',
      'state:control/on-foot',
      'state:camera/free-look',
      'state:maw/repaired'
    ]));
  });

  it('publishes the exact Chapter 7 checkpoint vocabulary from live authority', () => {
    const telemetry = deriveStoryBoundaryState(runtime({
      story: { active: true, chapter: 'ch7', beat: 'ch7-board', runId: 7 },
      control: { mode: 'flight', phase: 'surface' },
      shipRestoration: { repairStage: 'flight_ready' }
    }));

    expect(telemetry.verified).toBe(true);
    expect(telemetry.stateRefs).toEqual(expect.arrayContaining([
      'state:ship-restoration/flight_ready',
      'state:space-flight/control-mode=flight',
      'state:control/flight',
      'state:space-flight/phase=surface'
    ]));
  });

  it('derives the final free-play handoff only from durable completion receipts', () => {
    const telemetry = deriveStoryBoundaryState(runtime({
      story: { active: false, chapter: 'complete', beat: 'done', runId: 7 },
      world: { systemId: '-1,-1', activePlanetId: TIDEGARDEN_WORLD_ID , spaceStationTargetId: null},
      durable: {
        storyComplete: true,
        keelMemoryBanked: true,
        twoWorldHandoff: true,
        ch10BearingClaimed: false,
        ch10SeamPassed: false,
        stationDockingAuthorized: false
      }
    }));

    expect(telemetry.stateRefs).toEqual(expect.arrayContaining([
      'state:story/complete',
      'state:free-play/two-world-handoff',
      'state:item/kestrel-keel-memory-banked',
      'state:world/tidegarden'
    ]));
  });

  it('refuses to verify a snapshot without an actual perspective camera sample', () => {
    const telemetry = deriveStoryBoundaryState(runtime({
      camera: {
        perspective: false,
        fov: null,
        lookMode: 'free',
        feedBlend: 1,
        sideBlend: 1,
        externalCameraMix: 0,
        signedAuthority: 'player-camera'
      }
    }));

    expect(telemetry.verified).toBe(false);
    expect(telemetry.stateRefs).not.toContain('state:camera/free-look');
  });

  it('publishes the live-derived snapshot on the browser acceptance seam', () => {
    vi.stubGlobal('window', {});

    const telemetry = publishStoryBoundaryTelemetry({ isPerspectiveCamera: true, fov: 75 });

    expect((window as Window & {
      __paravoxiaBoundaryState?: unknown;
    }).__paravoxiaBoundaryState).toBe(telemetry);
    expect(telemetry.runtime.camera).toMatchObject({ perspective: true, fov: 75 });
  });
});

describe('space station boundary claims', () => {
  /*
    A station is not a planet and never becomes the resident world. Without a
    claim of its own, a chapter cannot say "the player is on final at a station"
    at all — `active-planet` goes on naming the planet they left.
  */
  it('says nothing about stations when none is targeted', () => {
    const refs = deriveStoryBoundaryState(runtime()).stateRefs;
    expect(refs.some(ref => ref.startsWith('state:space-station/'))).toBe(false);
  });

  it('claims the station without disturbing the resident planet', () => {
    const refs = deriveStoryBoundaryState(runtime({
      world: {
        systemId: '-1,-1',
        activePlanetId: STORY_PRIMARY_WORLD_ID,
        spaceStationTargetId: '-1,-1:a0'
      }
    })).stateRefs;
    expect(refs).toContain('state:space-station/targeted');
    expect(refs).toContain('state:space-station/target=-1,-1:a0');
    // The planet the player left is still the world that is loaded.
    expect(refs).toContain(`state:system-flight/active-planet=${STORY_PRIMARY_WORLD_ID}`);
  });

  it('publishes the chapter 10 bearing and seam claims from durable facts only', () => {
    const claimed = deriveStoryBoundaryState(runtime({
      durable: {
        storyComplete: true,
        keelMemoryBanked: true,
        twoWorldHandoff: true,
        ch10BearingClaimed: true,
        ch10SeamPassed: true,
        stationDockingAuthorized: false
      }
    })).stateRefs;
    expect(claimed).toContain('state:story/ch10-bearing-claimed');
    expect(claimed).toContain('state:story/ch10-seam-passed');
    // Defined this run, granted by nothing: the fence must read as absent even
    // with every other chapter 10 fact true.
    expect(claimed).not.toContain('state:station/docking-authorized');
  });

  it('says nothing about chapter 10 before its facts are earned', () => {
    const refs = deriveStoryBoundaryState(runtime()).stateRefs;
    expect(refs).not.toContain('state:story/ch10-bearing-claimed');
    expect(refs).not.toContain('state:story/ch10-seam-passed');
    expect(refs).not.toContain('state:station/docking-authorized');
  });
});
