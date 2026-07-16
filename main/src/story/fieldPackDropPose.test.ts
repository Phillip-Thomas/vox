import { afterEach, describe, expect, it } from 'vitest';
import type { AgentSurfaceTerrainQuery } from '../utils/agentSurfaceNavigation.ts';
import {
  establishFieldPackDropPose,
  getFieldPackDropPoseAuthority,
  getFieldPackPose,
  resetFieldPackDropPoseAuthority,
  storyAnchors,
  STORY_SEED
} from './world/storyWorld.ts';
import { STORY_PRIMARY_WORLD_ID } from './tidegardenRoute.ts';

const SIZE = 50;
const RUN = 31;

function flatTerrain(extraSolid?: (x: number, y: number, z: number) => boolean): AgentSurfaceTerrainQuery {
  return {
    isSolidVoxel: (x, y, z) => y <= 10 || Boolean(extraSolid?.(x, y, z)),
    isWaterVoxel: () => false,
    isHazardousVoxel: () => false
  };
}

afterEach(() => resetFieldPackDropPoseAuthority());

describe('authoritative A4 field-pack drop pose', () => {
  it('relocates from an edited pristine site and gives every consumer one supported receipt', () => {
    const pristineTerrain = flatTerrain();
    const pristine = getFieldPackPose(SIZE, STORY_SEED, pristineTerrain);
    expect(pristine).not.toBeNull();
    if (!pristine) return;

    // A live edit occupies the capsule-clearance cell over the old preferred
    // support. The validator must choose another deterministic dry, level pad.
    const blockedTerrain = flatTerrain((x, y, z) => (
      x === pristine.supportVoxel.x
      && y === pristine.supportVoxel.y + 1
      && z === pristine.supportVoxel.z
    ));
    const authority = establishFieldPackDropPose({
      planetSize: SIZE,
      terrainSeed: STORY_SEED,
      terrain: blockedTerrain,
      worldId: STORY_PRIMARY_WORLD_ID,
      terrainRevision: `${STORY_PRIMARY_WORLD_ID}:edit-17:water-3`,
      storyRunId: RUN,
      source: 'physical-tear'
    });

    expect(authority).not.toBeNull();
    if (!authority) return;
    expect(authority.supportVoxel).not.toEqual(pristine.supportVoxel);
    expect(authority.relocated).toBe(true);
    expect(blockedTerrain.isSolidVoxel(
      authority.supportVoxel.x,
      authority.supportVoxel.y,
      authority.supportVoxel.z
    )).toBe(true);
    expect(blockedTerrain.isSolidVoxel(
      authority.supportVoxel.x,
      authority.supportVoxel.y + 1,
      authority.supportVoxel.z
    )).toBe(false);
    expect(authority).toMatchObject({
      worldId: STORY_PRIMARY_WORLD_ID,
      storyRunId: RUN,
      terrainRevision: `${STORY_PRIMARY_WORLD_ID}:edit-17:water-3`,
      source: 'physical-tear'
    });

    // A4 choreography, FieldPack, marker/camera/autopilot and pond resonance
    // all read this same object through the single authority/anchor seam.
    const consumerReads = [
      'a4-choreography',
      'field-pack-render-interaction',
      'story-marker-camera',
      'movie-autopilot',
      'maw-pond-resonance'
    ].map(() => getFieldPackDropPoseAuthority(STORY_PRIMARY_WORLD_ID, RUN));
    for (const observed of consumerReads) expect(observed).toBe(authority);
    expect(storyAnchors.fieldPack).toBe(authority);

    // Once the physical tear exists, later terrain revisions cannot fork the
    // already-rendered pack away from its interactions or camera target.
    expect(establishFieldPackDropPose({
      planetSize: SIZE,
      terrainSeed: STORY_SEED,
      terrain: pristineTerrain,
      worldId: STORY_PRIMARY_WORLD_ID,
      terrainRevision: `${STORY_PRIMARY_WORLD_ID}:edit-18:water-3`,
      storyRunId: RUN,
      source: 'direct-ch5-fallback'
    })).toBe(authority);
  });

  it('reconstructs a deterministic safe direct-Ch5 fallback and resets by run/world scope', () => {
    const terrain = flatTerrain();
    const request = {
      planetSize: SIZE,
      terrainSeed: STORY_SEED,
      terrain,
      worldId: STORY_PRIMARY_WORLD_ID,
      terrainRevision: `${STORY_PRIMARY_WORLD_ID}:edit-4:water-0`,
      storyRunId: RUN,
      source: 'direct-ch5-fallback' as const
    };
    const first = establishFieldPackDropPose(request);
    expect(first).not.toBeNull();
    if (!first) return;

    resetFieldPackDropPoseAuthority({ worldId: 'unrelated-world', storyRunId: RUN });
    expect(getFieldPackDropPoseAuthority(STORY_PRIMARY_WORLD_ID, RUN)).toBe(first);
    resetFieldPackDropPoseAuthority({ worldId: STORY_PRIMARY_WORLD_ID, storyRunId: RUN });
    expect(getFieldPackDropPoseAuthority()).toBeNull();
    expect(storyAnchors.fieldPack).toBeNull();

    const replayed = establishFieldPackDropPose(request);
    expect(replayed?.position.toArray()).toEqual(first.position.toArray());
    expect(replayed?.supportVoxel).toEqual(first.supportVoxel);

    const nextRun = establishFieldPackDropPose({ ...request, storyRunId: RUN + 1 });
    expect(nextRun?.storyRunId).toBe(RUN + 1);
    expect(getFieldPackDropPoseAuthority(STORY_PRIMARY_WORLD_ID, RUN)).toBeNull();
    expect(getFieldPackDropPoseAuthority(STORY_PRIMARY_WORLD_ID, RUN + 1)).toBe(nextRun);
  });
});
