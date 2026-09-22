import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { VOXEL_SCALE } from '../../utils/cubeGravityConstants.ts';
import type { SideLens } from '../sideLens.ts';
import {
  SURVEY_BRACKET_LIMIT,
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

  it('only scans rows off the walked plane — the ones extraction can reach', () => {
    // Mirrors sideHarvestProbePointsOffRow: ground-level candidates sit one
    // voxel either side of the walked row, never in it.
    const probed: number[] = [];
    collectHarvestBracketTargets(player, lens, (_x, _y, z) => {
      probed.push(z);
      return null;
    });
    expect(probed.every(z => Math.abs(z) === 1)).toBe(true);
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
    expect(targets.map(t => t.key)).toEqual(['d:2', 'd:0']);
    expect(targets.every(t => t.label === 'DEBRIS')).toBe(true);
  });

  it('empties once the strip is clear', () => {
    expect(collectSalvageBracketTargets(player, positions, () => true)).toEqual([]);
    expect(collectSalvageBracketTargets(player, [], () => false)).toEqual([]);
  });
});

describe('bracket rect', () => {
  it('keeps the box fully inside the viewport', () => {
    const rect = solveSurveyBracketRect(-40, 900, 46, 800, 600);
    expect(rect.x).toBe(23);
    expect(rect.y).toBe(600 - 23);
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

  it('designates both when both are outstanding', () => {
    expect(surveyBracketDemand('ch1-raster', { fiber: true, debris: true }))
      .toEqual({ harvest: true, salvage: true });
  });

  it('goes dark when the beat has nothing outstanding', () => {
    expect(surveyBracketDemand('ch1-raster', { fiber: false, debris: false }))
      .toEqual({ harvest: false, salvage: false });
    // ch1-fixed's quota met means the rung has moved on to the camera hand-off.
    expect(surveyBracketDemand('ch1-fixed', { fiber: false, debris: true }))
      .toEqual({ harvest: false, salvage: false });
  });

  it('never designates debris on the beat that has none to give', () => {
    expect(surveyBracketDemand('ch1-fixed', { fiber: true, debris: true }))
      .toEqual({ harvest: true, salvage: false });
  });

  it('designates nothing outside the bracket beats', () => {
    for (const beat of ['ch1-depth', 'ch1-nav', 'ch2-color', null] as const) {
      expect(surveyBracketDemand(beat, { fiber: true, debris: true }))
        .toEqual({ harvest: false, salvage: false });
    }
  });
});
