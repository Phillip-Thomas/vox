import { beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { resetChartFrame, syncChartScreenUp } from './mapView';

const UP_TOP = new THREE.Vector3(0, 1, 0);
const UP_BOTTOM = new THREE.Vector3(0, -1, 0);
const UP_FRONT = new THREE.Vector3(0, 0, 1);
const UP_BACK = new THREE.Vector3(0, 0, -1);
const UP_RIGHT = new THREE.Vector3(1, 0, 0);

function expectVec(actual: THREE.Vector3, x: number, y: number, z: number) {
  expect(actual.x).toBeCloseTo(x, 6);
  expect(actual.y).toBeCloseTo(y, 6);
  expect(actual.z).toBeCloseTo(z, 6);
}

describe('chart rolling frame', () => {
  beforeEach(() => resetChartFrame());

  it('initializes canonically per face (-Z on ±Y faces, +Y on side faces)', () => {
    expectVec(syncChartScreenUp(UP_TOP), 0, 0, -1);
    resetChartFrame();
    expectVec(syncChartScreenUp(UP_BACK), 0, 1, 0);
    resetChartFrame();
    expectVec(syncChartScreenUp(UP_RIGHT), 0, 1, 0);
  });

  it('is idempotent while the face is unchanged', () => {
    const first = syncChartScreenUp(UP_TOP).clone();
    expectVec(syncChartScreenUp(UP_TOP), first.x, first.y, first.z);
  });

  it('rolls across an edge: walking off the top face onto the back face keeps screen-up ahead', () => {
    syncChartScreenUp(UP_TOP); // screen-up = -Z, walking toward the back edge
    // Cross onto the back face: the frame transports about the shared edge.
    expectVec(syncChartScreenUp(UP_BACK), 0, -1, 0);
  });

  it('entering the upward face puts the face you left at screen-bottom', () => {
    syncChartScreenUp(UP_BACK); // canonical +Y — walking screen-up toward the top face
    const rolled = syncChartScreenUp(UP_TOP);
    expectVec(rolled, 0, 0, 1);
    // The back face sits at -Z of the top face = opposite screen-up = bottom.
    expect(rolled.dot(new THREE.Vector3(0, 0, -1))).toBeLessThan(0);
  });

  it('round-trips: top → front → top restores the original frame', () => {
    const start = syncChartScreenUp(UP_TOP).clone();
    expectVec(syncChartScreenUp(UP_FRONT), 0, 1, 0);
    const back = syncChartScreenUp(UP_TOP);
    expectVec(back, start.x, start.y, start.z);
  });

  it('re-canonicalizes on an antiparallel jump (no edge travelled)', () => {
    syncChartScreenUp(UP_TOP);
    expectVec(syncChartScreenUp(UP_BOTTOM), 0, 0, -1);
  });

  it('stays an exact unit tangent after many rolls', () => {
    const walk = [UP_TOP, UP_FRONT, UP_RIGHT, UP_TOP, UP_BACK, UP_RIGHT, UP_BOTTOM, UP_FRONT, UP_TOP];
    let screenUp = new THREE.Vector3();
    for (const up of walk) screenUp = syncChartScreenUp(up).clone();
    expect(screenUp.length()).toBeCloseTo(1, 9);
    expect(Math.abs(screenUp.dot(UP_TOP))).toBeLessThan(1e-9);
    // Axis-snapped: exactly one nonzero component.
    const nonzero = [screenUp.x, screenUp.y, screenUp.z].filter(c => c !== 0);
    expect(nonzero).toHaveLength(1);
    expect(Math.abs(nonzero[0])).toBe(1);
  });
});
