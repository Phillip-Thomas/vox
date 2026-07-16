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
    world: { systemId: '-1,-1', activePlanetId: STORY_PRIMARY_WORLD_ID },
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
    durable: { storyComplete: false, keelMemoryBanked: false, twoWorldHandoff: false }
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
      world: { systemId: '-1,-1', activePlanetId: TIDEGARDEN_WORLD_ID },
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
      world: { systemId: '-1,-1', activePlanetId: TIDEGARDEN_WORLD_ID },
      durable: { storyComplete: true, keelMemoryBanked: true, twoWorldHandoff: true }
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
