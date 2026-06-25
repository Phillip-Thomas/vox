import { describe, expect, it } from 'vitest';
import {
  buildOrbitalMinimapModel,
  faceFromUp,
  faceUvFrame,
  MAX_STRUCTURE_MARKERS,
  MINIMAP_EXTENT,
  projectWorldToMinimap
} from './orbitalMinimapModel.ts';
import type { Campfire } from '../../game/systems/campfires.ts';
import type { PlayerPose } from '../../game/playerPose.ts';
import type { StructurePiece } from '../../game/systems/structureSystem.ts';

function pose(playerId: string, worldId: string, position: [number, number, number], timeMs = 10_000): PlayerPose {
  return {
    playerId,
    worldId,
    seq: 1,
    timeMs,
    position,
    velocity: [0, 0, 0],
    forward: [0, 0, -1],
    up: [0, 1, 0],
    pitch: 0,
    action: 'idle',
    submergence: 0,
    miningProgress: 0,
    jetpackActive: false,
    torchActive: false
  };
}

function structure(id: number, cell: [number, number, number]): StructurePiece {
  return {
    id,
    cell,
    face: 0,
    type: 'foundation',
    material: 'wood'
  };
}

function campfire(id: number, pos: [number, number, number]): Campfire {
  return { id, pos, up: [0, 1, 0] };
}

describe('orbital minimap model', () => {
  it('projects world positions into the minimap cube and clamps extremes', () => {
    const projected = projectWorldToMinimap([500, -500, 0], 50);
    expect(projected[0]).toBeCloseTo(MINIMAP_EXTENT);
    expect(projected[1]).toBeCloseTo(-MINIMAP_EXTENT);
    expect(projected[2]).toBeCloseTo(0);
  });

  it('maps the gameplay cube surface close to the visible minimap face edge', () => {
    expect(projectWorldToMinimap([50, 0, 0], 50)[0]).toBeCloseTo(MINIMAP_EXTENT);
    expect(projectWorldToMinimap([0, -50, 0], 50)[1]).toBeCloseTo(-MINIMAP_EXTENT);
  });

  it('filters local and off-world players while keeping real world markers', () => {
    const model = buildOrbitalMinimapModel({
      planetSize: 50,
      worldId: '0,0',
      localActorId: 'local',
      localPosition: [0, 0, 0],
      localForward: [0, 0, -1],
      localUp: [0, 1, 0],
      nowMs: 12_000,
      remotePlayers: [
        pose('local', '0,0', [1, 0, 0]),
        pose('remote-a', '0,0', [4, 0, 0]),
        pose('remote-b', '1,0', [6, 0, 0])
      ],
      campfires: [campfire(1, [0, 5, 0])],
      structures: [structure(1, [1, 1, 1]), structure(2, [1, 1, 1]), structure(3, [2, 2, 2])],
      shipPosition: [8, 0, 0]
    });

    expect(model.counts.remotePlayers).toBe(1);
    expect(model.counts.campfires).toBe(1);
    expect(model.counts.structures).toBe(2);
    expect(model.counts.ship).toBe(1);
    expect(model.markers.some(marker => marker.id === 'remote:remote-a')).toBe(true);
    expect(model.markers.some(marker => marker.id === 'remote:remote-b')).toBe(false);
  });

  it('caps structure markers by nearest unique cells', () => {
    const structures = Array.from({ length: MAX_STRUCTURE_MARKERS + 7 }, (_, index) =>
      structure(index + 1, [index + 1, 0, 0])
    );

    const model = buildOrbitalMinimapModel({
      planetSize: 50,
      worldId: '0,0',
      localActorId: 'local',
      localPosition: [0, 0, 0],
      localForward: [0, 0, -1],
      localUp: [0, 1, 0],
      remotePlayers: [],
      campfires: [],
      structures,
      shipPosition: null,
      nowMs: 1_000
    });

    const structureMarkers = model.markers.filter(marker => marker.kind === 'structure');
    expect(model.counts.structures).toBe(MAX_STRUCTURE_MARKERS + 7);
    expect(model.counts.shownStructures).toBe(MAX_STRUCTURE_MARKERS);
    expect(structureMarkers).toHaveLength(MAX_STRUCTURE_MARKERS);
    expect(structureMarkers[structureMarkers.length - 1]?.worldPosition[0]).toBe(MAX_STRUCTURE_MARKERS);
  });

  it('resolves the active cube face from the local up vector', () => {
    expect(faceFromUp([0.1, 0.97, 0])).toBe('top');
    expect(faceFromUp([0.8, 0.1, 0.2])).toBe('right');
    expect(faceFromUp([0, -0.2, -0.9])).toBe('back');
  });

  it('uses a stable UV frame for side faces', () => {
    expect(faceUvFrame('right')).toEqual({
      normal: [1, 0, 0],
      u: [0, 0, -1],
      v: [0, 1, 0]
    });
    expect(faceUvFrame('back')).toEqual({
      normal: [0, 0, -1],
      u: [-1, 0, 0],
      v: [0, 1, 0]
    });
  });

  it('maps looking down to inward heading on the active cube face', () => {
    const top = buildOrbitalMinimapModel({
      planetSize: 50,
      worldId: '0,0',
      localActorId: 'local',
      localPosition: [0, 50, 0],
      localForward: [1, 0, 0],
      localUp: [0, 1, 0],
      localPitch: -Math.PI / 2,
      remotePlayers: [],
      campfires: [],
      structures: [],
      shipPosition: null,
      nowMs: 1_000
    });
    const right = buildOrbitalMinimapModel({
      planetSize: 50,
      worldId: '0,0',
      localActorId: 'local',
      localPosition: [50, 0, 0],
      localForward: [0, 1, 0],
      localUp: [1, 0, 0],
      localPitch: -Math.PI / 2,
      remotePlayers: [],
      campfires: [],
      structures: [],
      shipPosition: null,
      nowMs: 1_000
    });

    expect(dot(top.local.heading, [0, -1, 0])).toBeGreaterThan(0.999);
    expect(dot(right.local.heading, [-1, 0, 0])).toBeGreaterThan(0.999);
  });

  it('projects tangent heading through the active face UV frame', () => {
    const model = buildOrbitalMinimapModel({
      planetSize: 50,
      worldId: '0,0',
      localActorId: 'local',
      localPosition: [50, 0, 0],
      localForward: [0, 1, 0],
      localUp: [1, 0, 0],
      localPitch: 0,
      remotePlayers: [],
      campfires: [],
      structures: [],
      shipPosition: null,
      nowMs: 1_000
    });

    expect(model.local.face).toBe('right');
    expect(dot(model.local.heading, [0, 1, 0])).toBeGreaterThan(0.999);
    expect(dot(model.local.tangentHeading, model.local.vAxis)).toBeGreaterThan(0.999);
  });
});

function dot(a: [number, number, number], b: [number, number, number]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
