import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';

import { CONTACT_TOLERANCE, createFooting, renderedRadiusCells } from './CommonGroundWorld.tsx';
import { STORY_PRIMARY_WORLD_ID, STORY_SEED } from './storyWorldIdentity.ts';
import { getWorldGen } from '../../utils/worldGenCache.ts';
import { voxelSystem } from '../../utils/efficientVoxelSystem.ts';
import { VOXEL_SCALE } from '../../utils/cubeGravityConstants.ts';
import {
  CG_POSES,
  CG_ROUTE_COMMON,
  CG_ROUTE_LONG,
  CG_ROUTE_SHORT,
  clearAllCommonGroundWorlds
} from '../commonGroundState.ts';
import { PLAYER_BODY_HEIGHT, firstUnsupportedSegment } from '../commonGroundRoute.ts';
import {
  CG_PLAYER_GROUND_OFFSET,
  commitCommonGroundSurveyStart,
  commonGroundPlayerPose,
  commonGroundRailPlan,
  commonGroundSnapshot,
  enterCommonGroundBeat,
  getCommonGroundProbeSnapshot,
  registerCommonGroundWorld,
  resetCommonGroundRuntime
} from '../commonGroundDirector.ts';
import { getPlayerUp, setPlayerUp, setPlayerWorldPosition } from '../../state/playerFrame.ts';

// --- The LIVE footing boundary --------------------------------------------------------
//
// VF3-FOOTING-1. On hardware the body booted on foot, walked ~60 units to S,
// satisfied the corrected physical arrival (0.303 of a 0.35 radius) and invoked
// the shipped F resolver TWO HUNDRED times, and `survey.phase` never left
// `awaiting-start`: the chapter's own diagnostic reported `supported: false` for
// 1501 of 1555 world-bound samples at a pose the player was demonstrably
// standing on.
//
// Every earlier regression in this chapter injected an IDEAL footing — a fixture
// that answers `|y - 51.05| < 0.001`, or an authored flat plot — so not one of
// the 3068 tests ever ran `CommonGroundWorld.createFooting` over
// `createLiveAgentSurfaceTerrain`. This file is that missing boundary: the REAL
// generator, the REAL voxel system, the REAL seed and world identity the debug
// HUD recorded (seed 3215739679, world -1,-1, planet 50, voxel scale 2), and the
// real director seam on top of it. A dummy footing is not a footing.

const PLANET_SIZE = 50;
/** The rendered/collided cube stops here; the generator does not. */
const RADIUS_CELLS = renderedRadiusCells(PLANET_SIZE);
/** The ch13 audit site's support column, and its nominal top face. */
const SITE_CELL = 25;
const SITE_FACE_Y = SITE_CELL * VOXEL_SCALE + VOXEL_SCALE / 2;

/** The authored, signed ch13 ground plane. */
const AUTHORED_Y = 51.05;
/** The pose the hardware actually rested at, to full published precision. */
const MEASURED_STAND = {
  x: -26.303071599579624,
  y: 50.98897476203079,
  z: 12.015123338214817
};

function liveFooting() {
  return createFooting(PLANET_SIZE, STORY_SEED, STORY_PRIMARY_WORLD_ID);
}

function feetAt(x: number, y: number, z: number) {
  return { x, y, z };
}

/** Place the REAL capsule centre, the way the physics publishes it. */
function standCapsuleCentreAt(point: { x: number; y: number; z: number }): void {
  setPlayerWorldPosition(new THREE.Vector3(point.x, point.y, point.z));
}

function standFeetAt(point: { x: number; y: number; z: number }): void {
  const up = getPlayerUp();
  standCapsuleCentreAt({
    x: point.x + up.x * CG_PLAYER_GROUND_OFFSET,
    y: point.y + up.y * CG_PLAYER_GROUND_OFFSET,
    z: point.z + up.z * CG_PLAYER_GROUND_OFFSET
  });
}

const cell = (v: number) => Math.round(v / VOXEL_SCALE);

describe('the live footing reads the world the player is actually standing in', () => {
  beforeEach(() => {
    voxelSystem.reset();
    setPlayerUp(new THREE.Vector3(0, 1, 0));
  });

  afterEach(() => {
    voxelSystem.reset();
  });

  it('reproduces the CAUSE: the generator keeps answering outside the rendered cube', () => {
    // Not an assumption and not a rounding claim. The real generator, at the
    // real seed, on the real world identity.
    const { generator } = getWorldGen(PLANET_SIZE, STORY_SEED, STORY_PRIMARY_WORLD_ID);
    const cx = cell(CG_POSES.S.x);
    const cz = cell(CG_POSES.S.z);

    expect(RADIUS_CELLS).toBe(25);
    // The column she stands on is real and rendered...
    expect(generator.shouldVoxelExist(cx, SITE_CELL, cz)).toBe(true);
    // ...and the generator ALSO claims the cell above it, which is one cell
    // OUTSIDE the cube that is meshed, collided and drawn. That logical bulge is
    // what the old unclipped `isSolidVoxel(cx, cy + 1, cz)` read as a ceiling.
    expect(generator.shouldVoxelExist(cx, SITE_CELL + 1, cz)).toBe(true);
    expect(SITE_CELL + 1).toBeGreaterThan(RADIUS_CELLS);

    // And it is LOCALISED, exactly as the hardware measured: at the landing area
    // the generator stops at the same cell the body stands on, which is why
    // `supported` was TRUE there and false for the whole approach to the site.
    const landingX = cell(6.836);
    const landingZ = cell(-6);
    expect(generator.shouldVoxelExist(landingX, SITE_CELL, landingZ)).toBe(true);
    expect(generator.shouldVoxelExist(landingX, SITE_CELL + 1, landingZ)).toBe(false);
  });

  it('carries the measured standing body and the authored pose at S', () => {
    const ground = liveFooting();
    // The exact hardware pose that was refused 200 times.
    expect(ground.isSupported(MEASURED_STAND)).toBe(true);
    // And the qualified authored plane, unchanged.
    expect(ground.isSupported(CG_POSES.S)).toBe(true);
    expect(CG_POSES.S.y).toBe(AUTHORED_Y);
    // Both sit within a hair of the column's nominal face; nothing was widened
    // to make them pass.
    expect(Math.abs(MEASURED_STAND.y - SITE_FACE_Y)).toBeLessThan(0.02);
    expect(Math.abs(AUTHORED_Y - SITE_FACE_Y)).toBeCloseTo(0.05, 10);
  });

  it('refuses every airborne height the jump diagnostic recorded, cell 25 included', () => {
    const ground = liveFooting();
    // The verifier's measured height response, replayed against the repaired
    // predicate. Cell 25 hovering FIRST: these still round into the standing
    // cell, so clipping the outside-cube ceiling alone would have called a body
    // most of a voxel up in the air "grounded".
    for (const y of [51.4, 51.5, 51.7, 51.908]) {
      expect(cell(y - 1.05)).toBe(SITE_CELL);
      expect(ground.isSupported(feetAt(CG_POSES.S.x, y, CG_POSES.S.z))).toBe(false);
    }
    // Cell 26: the old predicate said TRUE for all 59 samples here, because the
    // logical bulge at 26 was "solid" and 27 was not. It is outside the rendered
    // cube; nothing carries a body there.
    for (const y of [52.12282485971417, 53.0, 54.04677505493555]) {
      expect(cell(y - 1.05)).toBe(SITE_CELL + 1);
      expect(ground.isSupported(feetAt(CG_POSES.S.x, y, CG_POSES.S.z))).toBe(false);
    }
    // Cell 27, false before and false now.
    expect(ground.isSupported(feetAt(CG_POSES.S.x, 54.2, CG_POSES.S.z))).toBe(false);
  });

  it('refuses a body sunk into the ground, and a body of zero height', () => {
    const ground = liveFooting();
    // The capsule CENTRE dropped onto the authored mark puts her feet 1.8 units
    // inside the terrain. That is not a place a body can be.
    expect(ground.isSupported(feetAt(CG_POSES.S.x, AUTHORED_Y - CG_PLAYER_GROUND_OFFSET, CG_POSES.S.z)))
      .toBe(false);
    // Half a voxel under the face is still under it.
    expect(ground.isSupported(feetAt(CG_POSES.S.x, SITE_FACE_Y - 0.6, CG_POSES.S.z))).toBe(false);
  });

  it('states the contact band it uses, and contains both qualified poses inside it', () => {
    expect(CONTACT_TOLERANCE).toBeCloseTo(0.25, 10);
    // It is a quarter of the +/-1 cell rounding window, not a new radius: it can
    // only ever reject poses the old predicate accepted.
    expect(CONTACT_TOLERANCE).toBeLessThan(VOXEL_SCALE / 2);
    expect(Math.abs(MEASURED_STAND.y - SITE_FACE_Y)).toBeLessThan(CONTACT_TOLERANCE);
    expect(Math.abs(AUTHORED_Y - SITE_FACE_Y)).toBeLessThan(CONTACT_TOLERANCE);
  });

  it('carries the landing area the hardware reported supported=TRUE at', () => {
    // The one place the two models already agreed. It must still agree.
    const ground = liveFooting();
    expect(ground.isSupported(feetAt(6.836, 51.186, -6))).toBe(true);
  });

  it('carries every signed pose and every column of both authored survey routes', () => {
    const ground = liveFooting();
    for (const [name, pose] of Object.entries(CG_POSES)) {
      expect(`${name}:${ground.isSupported(pose)}`).toBe(`${name}:true`);
    }
    for (const [name, route] of [
      ['short', CG_ROUTE_SHORT],
      ['long', CG_ROUTE_LONG],
      ['common', CG_ROUTE_COMMON]
    ] as const) {
      route.forEach((point, index) => {
        expect(`${name}[${index}]:${ground.isSupported(point)}`).toBe(`${name}[${index}]:true`);
      });
      // ...and the swept BODY, which is what the guide actually draws.
      expect(`${name}:${firstUnsupportedSegment(route, ground, { bodyHeight: PLAYER_BODY_HEIGHT })}`)
        .toBe(`${name}:-1`);
    }
  });
});

describe('the live footing still refuses ground that is not there', () => {
  const cx = cell(CG_POSES.S.x);
  const cz = cell(CG_POSES.S.z);

  beforeEach(() => {
    voxelSystem.reset();
    setPlayerUp(new THREE.Vector3(0, 1, 0));
  });

  afterEach(() => {
    voxelSystem.reset();
  });

  it('refuses a dug hole under the body — the live delete, not a fixture', () => {
    // Register the site column as original terrain so a real dig persists.
    voxelSystem.setOriginalTerrain([
      { x: cx, y: SITE_CELL, z: cz, material: 'grass', color: new THREE.Color('#3a7') },
      { x: cx, y: SITE_CELL - 1, z: cz, material: 'dirt', color: new THREE.Color('#963') }
    ] as never);
    const ground = liveFooting();
    expect(ground.isSupported(CG_POSES.S)).toBe(true);

    voxelSystem.addVoxel(cx, SITE_CELL, cz, 'grass', new THREE.Color('#3a7'));
    expect(voxelSystem.removeVoxel(cx, SITE_CELL, cz)).toBe(true);
    expect(voxelSystem.isDeleted(cx, SITE_CELL, cz)).toBe(true);

    // The generator still believes in that voxel; the live world does not.
    expect(ground.isSupported(CG_POSES.S)).toBe(false);
  });

  it('refuses a body with only ONE FOOT over the hole', () => {
    // The disc's four lateral offsets are not decorative. This pose's CENTRE is
    // over an intact neighbouring column and only its -x sample reaches the dug
    // one, so a centre-only test would call it supported.
    const halfOver = feetAt(-24.8, AUTHORED_Y, CG_POSES.S.z);
    expect(cell(halfOver.x)).not.toBe(cx);
    expect(cell(halfOver.x - 0.5)).toBe(cx);

    voxelSystem.setOriginalTerrain([
      { x: cx, y: SITE_CELL, z: cz, material: 'grass', color: new THREE.Color('#3a7') }
    ] as never);
    const ground = liveFooting();
    // Intact: supported, so the rejection below is the hole and nothing else.
    expect(ground.isSupported(halfOver)).toBe(true);

    voxelSystem.addVoxel(cx, SITE_CELL, cz, 'grass', new THREE.Color('#3a7'));
    voxelSystem.removeVoxel(cx, SITE_CELL, cz);
    expect(voxelSystem.isDeleted(cx, SITE_CELL, cz)).toBe(true);
    expect(ground.isSupported(halfOver)).toBe(false);
  });

  it('still treats a RENDERED solid above the body as a ceiling', () => {
    // At the audit site the cell above the ground is outside the cube, so the
    // ceiling clause is exercised one cell down, where it is real: a dug pit
    // with a block placed back over it.
    voxelSystem.setOriginalTerrain([
      { x: cx, y: SITE_CELL, z: cz, material: 'grass', color: new THREE.Color('#3a7') }
    ] as never);
    voxelSystem.addVoxel(cx, SITE_CELL, cz, 'grass', new THREE.Color('#3a7'));
    voxelSystem.removeVoxel(cx, SITE_CELL, cz);

    const ground = liveFooting();
    const pitFeet = feetAt(CG_POSES.S.x, SITE_FACE_Y - VOXEL_SCALE, CG_POSES.S.z);
    expect(cell(pitFeet.y - 1.05)).toBe(SITE_CELL - 1);
    expect(ground.isSupported(pitFeet)).toBe(true);

    // Now roof it with an ordinary placed block, INSIDE the rendered cube.
    voxelSystem.addVoxel(cx, SITE_CELL, cz, 'stone', new THREE.Color('#888'));
    expect(cell(pitFeet.y - 1.05) + 1).toBeLessThanOrEqual(RADIUS_CELLS);
    expect(ground.isSupported(pitFeet)).toBe(false);
  });

  it('accepts a real placed block as ground, and invalidates on the live edit', () => {
    const ground = liveFooting();
    const before = ground.revision;
    voxelSystem.addVoxel(cx, SITE_CELL, cz, 'stone', new THREE.Color('#888'));
    expect(ground.revision).not.toBe(before);
    expect(ground.isSupported(CG_POSES.S)).toBe(true);
  });

  it('refuses a REAL placed lava block as ground, inside the cube and outside it', () => {
    const ground = liveFooting();
    // Inside the rendered cube: an ordinary placed hazard.
    voxelSystem.addVoxel(cx, SITE_CELL, cz, 'stone', new THREE.Color('#f40'), undefined, {
      blockId: 'lava'
    } as never);
    expect(voxelSystem.getVoxel(cx, SITE_CELL, cz)?.blockId).toBe('lava');
    expect(ground.isSupported(CG_POSES.S)).toBe(false);
    voxelSystem.removeVoxel(cx, SITE_CELL, cz);
    expect(ground.isSupported(CG_POSES.S)).toBe(true);

    // Outside it: a real placed voxel is real wherever it is, so a lava block
    // she has built out beyond the procedural cube is not walkable either.
    const outsideFeet = feetAt(CG_POSES.S.x, (SITE_CELL + 1) * VOXEL_SCALE + 1.05, CG_POSES.S.z);
    expect(cell(outsideFeet.y - 1.05)).toBe(SITE_CELL + 1);
    voxelSystem.addVoxel(cx, SITE_CELL + 1, cz, 'stone', new THREE.Color('#f40'), undefined, {
      blockId: 'lava'
    } as never);
    expect(ground.isSupported(outsideFeet)).toBe(false);
  });

  it('keeps a REAL placed block outside the procedural cube both solid and standable', () => {
    // Root's review: `addVoxel` has no radius guard — it stores the voxel,
    // writes its mesh slot and requests a collider — so a block placed at cell
    // 26 is visible and solid even though the generator's own cell 26 is not
    // rendered. Clipping the phantom must not clip the thing she built.
    const ground = liveFooting();
    expect(SITE_CELL + 1).toBeGreaterThan(RADIUS_CELLS);
    expect(ground.isSupported(CG_POSES.S)).toBe(true);

    // 1. It OBSTRUCTS: standing under it is no longer standing in the open.
    voxelSystem.addVoxel(cx, SITE_CELL + 1, cz, 'stone', new THREE.Color('#888'));
    expect(voxelSystem.hasVoxel(cx, SITE_CELL + 1, cz)).toBe(true);
    expect(ground.isSupported(CG_POSES.S)).toBe(false);

    // 2. It CARRIES: its own top face is real ground, one voxel higher.
    const onTop = feetAt(CG_POSES.S.x, (SITE_CELL + 1) * VOXEL_SCALE + 1, CG_POSES.S.z);
    expect(cell(onTop.y - 1.05)).toBe(SITE_CELL + 1);
    expect(ground.isSupported(onTop)).toBe(true);
    // ...but only in contact with it. The phantom above it still carries nobody.
    expect(ground.isSupported(feetAt(CG_POSES.S.x, onTop.y + 0.6, CG_POSES.S.z))).toBe(false);

    // 3. And REMOVING it restores both answers exactly.
    expect(voxelSystem.removeVoxel(cx, SITE_CELL + 1, cz)).toBe(true);
    expect(voxelSystem.hasVoxel(cx, SITE_CELL + 1, cz)).toBe(false);
    expect(ground.isSupported(CG_POSES.S)).toBe(true);
    expect(ground.isSupported(onTop)).toBe(false);
  });

  it('refuses a real water column at the support cell', () => {
    const { generator } = getWorldGen(PLANET_SIZE, STORY_SEED, STORY_PRIMARY_WORLD_ID);
    const ground = liveFooting();
    // A REAL water cell on this planet, found by scanning the site's own
    // neighbourhood rather than asserted from a fixture.
    let wet: { x: number; z: number } | null = null;
    for (let dx = -40; dx <= 40 && !wet; dx += 1) {
      for (let dz = -40; dz <= 40; dz += 1) {
        if (generator.isWaterVoxel(cx + dx, SITE_CELL, cz + dz)) {
          wet = { x: cx + dx, z: cz + dz };
          break;
        }
      }
    }
    expect(wet).not.toBeNull();
    if (!wet) return;
    expect(generator.isWaterVoxel(wet.x, SITE_CELL, wet.z)).toBe(true);
    expect(ground.isSupported(feetAt(wet.x * VOXEL_SCALE, AUTHORED_Y, wet.z * VOXEL_SCALE)))
      .toBe(false);
  });

  it('is not an always-true answer: far off the plot it says no', () => {
    const ground = liveFooting();
    // Off the cube entirely.
    expect(ground.isSupported(feetAt(400, AUTHORED_Y, 400))).toBe(false);
    // Deep inside the planet, where there is no top face at this height.
    expect(ground.isSupported(feetAt(CG_POSES.S.x, 11.05, CG_POSES.S.z))).toBe(false);
    // High above it.
    expect(ground.isSupported(feetAt(CG_POSES.S.x, 71.05, CG_POSES.S.z))).toBe(false);
  });
});

describe('the survey start seam, over the live world rather than an injected plane', () => {
  beforeEach(() => {
    voxelSystem.reset();
    setPlayerUp(new THREE.Vector3(0, 1, 0));
    resetCommonGroundRuntime();
    clearAllCommonGroundWorlds();
  });

  afterEach(() => {
    resetCommonGroundRuntime();
    clearAllCommonGroundWorlds();
    voxelSystem.reset();
  });

  it('starts the recording from the exact hardware body, through the real predicate', () => {
    const release = registerCommonGroundWorld({
      worldId: STORY_PRIMARY_WORLD_ID,
      footing: liveFooting(),
      extraSolids: []
    });
    try {
      enterCommonGroundBeat('ch13-survey');
      commonGroundSnapshot().survey.phase = 'awaiting-start';

      // The published hardware capsule centre, to full precision.
      standCapsuleCentreAt({ x: -26.303087, y: 52.788975, z: 12.015123 });
      const pose = commonGroundPlayerPose();
      expect(pose.y).toBeCloseTo(MEASURED_STAND.y, 4);

      const diagnostic = getCommonGroundProbeSnapshot();
      expect(diagnostic.supported).toBe(true);

      expect(commitCommonGroundSurveyStart()).toBe(true);
      expect(commonGroundSnapshot().survey.phase).toBe('drawing');
      const first = commonGroundSnapshot().survey.working?.samples[0];
      expect(first?.y).toBeCloseTo(MEASURED_STAND.y, 4);
    } finally {
      release();
    }
  });

  it('grants nothing to a hovering body a HALF voxel over the same cell', () => {
    const release = registerCommonGroundWorld({
      worldId: STORY_PRIMARY_WORLD_ID,
      footing: liveFooting(),
      extraSolids: []
    });
    try {
      enterCommonGroundBeat('ch13-survey');
      commonGroundSnapshot().survey.phase = 'awaiting-start';

      // Horizontally perfect, vertically airborne — and still rounding into the
      // cell she stands on, so only a real contact test refuses it.
      standFeetAt({ x: CG_POSES.S.x, y: 51.6, z: CG_POSES.S.z });
      expect(cell(commonGroundPlayerPose().y - 1.05)).toBe(SITE_CELL);
      expect(getCommonGroundProbeSnapshot().supported).toBe(false);
      expect(commitCommonGroundSurveyStart()).toBe(false);
      expect(commonGroundSnapshot().survey.phase).toBe('awaiting-start');
      // The rail's arrival is TANGENTIAL range, so it legitimately still asks
      // for the verb from a hovering body — exactly the hardware shape, where
      // the prompt stayed live. What must not happen is the verb succeeding:
      // twenty attempts in the air record nothing at all.
      expect(commonGroundRailPlan().action).toBe('interact');
      for (let attempt = 0; attempt < 20; attempt += 1) {
        expect(commitCommonGroundSurveyStart()).toBe(false);
      }
      expect(commonGroundSnapshot().survey.working?.samples.length ?? 0).toBe(0);

      // She lands. The same ordinary act now works from the same place.
      standFeetAt(MEASURED_STAND);
      expect(commitCommonGroundSurveyStart()).toBe(true);
    } finally {
      release();
    }
  });
});
