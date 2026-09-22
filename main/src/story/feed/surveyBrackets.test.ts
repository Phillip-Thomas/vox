import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { VOXEL_SCALE } from '../../utils/cubeGravityConstants.ts';
import type { SideLens } from '../sideLens.ts';
import {
  SURVEY_BRACKET_LIMIT,
  pickSideHarvestVoxel,
  resolveSurveyTargetPresentation,
  surveyBracketDemand,
  collectHarvestBracketTargets,
  collectSalvageBracketTargets,
  solveSurveyBracketRect,
  surveyBracketMode
} from './surveyBrackets.ts';

function makeLens(): SideLens {
  return {
    origin: new THREE.Vector3(0, 50, 0),
    travelAxis: new THREE.Vector3(1, 0, 0),
    depthAxis: new THREE.Vector3(0, 0, 1),
    up: new THREE.Vector3(0, 1, 0)
  };
}

describe('survey bracket mode', () => {
  it('designates only the two beats whose order names an invisible target', () => {
    expect(surveyBracketMode('ch1-fixed')).toBe('harvest');
    expect(surveyBracketMode('ch1-raster')).toBe('salvage');
  });

  it('stays out of every beat that already has a marker or has chroma back', () => {
    for (const beat of ['descent', 'ch1-track', 'ch1-depth', 'ch1-nav', 'ch1-iso', 'ch1-lift', 'ch1-anomaly', 'ch2-color', 'ch3-gather'] as const) {
      expect(surveyBracketMode(beat)).toBeNull();
    }
    expect(surveyBracketMode(null)).toBeNull();
  });
});

describe('harvest bracket targets', () => {
  const lens = makeLens();
  const player = new THREE.Vector3(0, 50, 0);

  it('designates only blocks the extractor actually pays for', () => {
    // Every probed cell exists, but only one drops biofiber. A bracket over a
    // block that yields nothing would teach the player the wrong lesson — which
    // is the exact confusion the layer exists to remove.
    const yielding = new Set(['3,24,1']);
    const targets = collectHarvestBracketTargets(player, lens, (x, y, z) => ({
      yields: yielding.has(`${x},${y},${z}`)
    }));
    expect(targets).toHaveLength(1);
    expect(targets[0].label).toBe('BIOFIBER');
    expect(targets[0].position.x).toBe(3 * VOXEL_SCALE);
  });

  it('returns nothing when no reachable block yields', () => {
    expect(collectHarvestBracketTargets(player, lens, () => ({ yields: false }))).toEqual([]);
    expect(collectHarvestBracketTargets(player, lens, () => null)).toEqual([]);
  });

  it('caps the designation so brackets never tile the frame', () => {
    const targets = collectHarvestBracketTargets(player, lens, () => ({ yields: true }));
    expect(targets).toHaveLength(SURVEY_BRACKET_LIMIT);
  });

  it('designates nearest first, so the bracket in reach is always shown', () => {
    const targets = collectHarvestBracketTargets(player, lens, () => ({ yields: true }));
    const distances = targets.map(t => Math.abs(t.position.x - player.x));
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  it('shares ordinary off-row ground probes and only above-ground on-row probes', () => {
    // Mirrors sideHarvestProbePointsOffRow: ground-level candidates sit one
    // voxel either side of the walked row, never in it.
    const probed: { y: number; z: number }[] = [];
    collectHarvestBracketTargets(player, lens, (_x, y, z) => {
      probed.push({ y, z });
      return null;
    });
    expect(probed.every(({ y, z }) => Math.abs(z) === 1 || (z === 0 && y >= 25))).toBe(true);
  });

  it('gives every target a key stable across frames', () => {
    const once = collectHarvestBracketTargets(player, lens, () => ({ yields: true }));
    const twice = collectHarvestBracketTargets(player, lens, () => ({ yields: true }));
    expect(once.map(t => t.key)).toEqual(twice.map(t => t.key));
  });
});

describe('salvage bracket targets', () => {
  const player = new THREE.Vector3(0, 50, 0);
  const positions = [
    new THREE.Vector3(30, 50, 0),
    new THREE.Vector3(6, 50, 0),
    new THREE.Vector3(-14, 50, 0)
  ];

  it('designates only the pieces still outstanding', () => {
    // ch1-raster will not advance until every piece is recovered, so a
    // collected piece must stop being designated the moment it is taken.
    const targets = collectSalvageBracketTargets(player, positions, i => i === 1);
    expect(targets.map(t => t.key)).toEqual(['d:2']);
    expect(targets.every(t => t.label === 'DEBRIS')).toBe(true);
  });

  it('empties once the strip is clear', () => {
    expect(collectSalvageBracketTargets(player, positions, () => true)).toEqual([]);
    expect(collectSalvageBracketTargets(player, [], () => false)).toEqual([]);
  });
});

describe('bracket rect', () => {
  it('never moves a real offscreen target onto empty on-screen ground', () => {
    const rect = solveSurveyBracketRect(-40, 900, 46, 800, 600);
    expect(rect.x).toBe(-40);
    expect(rect.y).toBe(900);
  });

  it('flips the label inboard when it would leave the frame', () => {
    expect(solveSurveyBracketRect(400, 300, 46, 800, 600).labelFlipped).toBe(false);
    expect(solveSurveyBracketRect(780, 300, 46, 800, 600).labelFlipped).toBe(true);
  });

  it('survives a degenerate viewport and non-finite anchors', () => {
    expect(Number.isFinite(solveSurveyBracketRect(NaN, NaN, 46, 0, 0).x)).toBe(true);
    expect(Number.isFinite(solveSurveyBracketRect(10, 10, 46, 10, 10).y)).toBe(true);
  });
});

describe('survey bracket demand', () => {
  it('designates the fiber the player cannot see even on the salvage beat', () => {
    // The regression this exists to prevent: keying designation to the BEAT
    // meant ch1-raster only ever drew DEBRIS brackets, so clearing the debris
    // (which also completes the stone quota from its own loot) turned every
    // bracket off while the fiber gate — the real remaining condition — stayed
    // invisible in a world with no material cues.
    expect(surveyBracketDemand('ch1-raster', { fiber: true, debris: false }))
      .toEqual({ harvest: true, salvage: false });
  });

  it('designates required salvage alone before outstanding fiber', () => {
    expect(surveyBracketDemand('ch1-raster', { fiber: true, debris: true }))
      .toEqual({ harvest: false, salvage: true });
  });

  it('goes dark when the beat has nothing outstanding', () => {
    expect(surveyBracketDemand('ch1-raster', { fiber: false, debris: false }))
      .toEqual({ harvest: false, salvage: false });
    // ch1-fixed's quota met means the rung has moved on to the camera hand-off.
    expect(surveyBracketDemand('ch1-fixed', { fiber: false, debris: false }))
      .toEqual({ harvest: false, salvage: false });
  });

  it('opens fixed on actual debris0 before extraction', () => {
    expect(surveyBracketDemand('ch1-fixed', { fiber: true, debris: true }))
      .toEqual({ harvest: false, salvage: true });
  });

  it('designates nothing outside the bracket beats', () => {
    for (const beat of ['ch1-depth', 'ch1-nav', 'ch2-color', null] as const) {
      expect(surveyBracketDemand(beat, { fiber: true, debris: true }))
        .toEqual({ harvest: false, salvage: false });
    }
  });
});


describe('retained action and truthful horizontal bearing', () => {
  it.each([[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]])('maps the actual right movement axis %j, without using world X or screen sign', (x, y, z) => {
    const movementRight = new THREE.Vector3(x, y, z), player = new THREE.Vector3(8, 50, -3);
    for (const sign of [1, -1]) {
      const approach = player.clone().addScaledVector(movementRight, sign * 7);
      const result = resolveSurveyTargetPresentation({ ndc: new THREE.Vector3(-2, 0, 0), player, approach, movementRight, validApproach: true, nativeActionable: false });
      expect(result.direction).toBe(sign > 0 ? 'D' : 'A');
    }
  });
  it.each([[0.98, 0, 0], [2, 1.1, 0], [2, 0, 2], [NaN, 0, 0], [2, Infinity, 0], [2, 0, NaN]])('never turns label fit, vertical, behind or nonfinite projection %j into a bearing', (x, y, z) => {
    const result = resolveSurveyTargetPresentation({ ndc: new THREE.Vector3(x, y, z), player: new THREE.Vector3(), approach: new THREE.Vector3(6, 0, 0), movementRight: new THREE.Vector3(1, 0, 0), validApproach: true, nativeActionable: false });
    expect(result.direction).toBeNull();
  });
  it('preserves the exact supported approach and facing that select each yielded voxel through the native picker', () => {
    const lens = makeLens(), player = new THREE.Vector3(0, 50, 0);
    const probe = (x: number, y: number, z: number) => ({ yields: x === -3 && y === 24 && z === 1 });
    const support = (position: THREE.Vector3) => position.x < -2;
    const targets = collectHarvestBracketTargets(player, lens, probe, 10, support);
    expect(targets.length).toBeGreaterThan(0);
    for (const target of targets) {
      expect(support(target.approach!)).toBe(true);
      const picked = pickSideHarvestVoxel(target.approach!, lens, target.facing!, probe, true)!;
      expect(target.key).toBe(`v:${picked.x},${picked.y},${picked.z}`);
      expect(target.approach!.equals(target.position)).toBe(false);
    }
  });
  it('keeps native extraction canonical and refuses a missing, invalid or zero-distance approach', () => {
    const input = { ndc: new THREE.Vector3(2, 0, 0), player: new THREE.Vector3(), approach: new THREE.Vector3(8, 0, 0), movementRight: new THREE.Vector3(1, 0, 0), validApproach: true, nativeActionable: false };
    expect(resolveSurveyTargetPresentation({ ...input, nativeActionable: true }).direction).toBeNull();
    expect(resolveSurveyTargetPresentation({ ...input, validApproach: false }).direction).toBeNull();
    expect(resolveSurveyTargetPresentation({ ...input, approach: undefined }).direction).toBeNull();
    expect(resolveSurveyTargetPresentation({ ...input, approach: input.player }).direction).toBeNull();
  });
});
