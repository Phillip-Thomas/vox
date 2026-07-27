import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  SIDE_RIG,
  axisBandVelocityDelta,
  applyActiveRigTransform,
  applyLiftCameraTransform,
  applyRigCameraTransform,
  applySideCameraTransform,
  computeRigFrame,
  fixedScreenCellIndex,
  rigMoveBasis,
  setLensRig,
  sideHarvestProbePoints,
  sideHarvestProbePointsOffRow,
  type LensRig,
  type SideLens
} from './sideLens.ts';
import { applyGravityCameraTransform } from '../utils/gravityCamera.ts';

function makeLens(): SideLens {
  const up = new THREE.Vector3(0, 1, 0);
  const travelAxis = new THREE.Vector3(1, 0, 0);
  return {
    origin: new THREE.Vector3(0, 50, 0),
    travelAxis,
    depthAxis: travelAxis.clone().cross(up).normalize(), // (0,0,-1)
    up
  };
}

describe('sideLens', () => {
  it('side camera looks at the player from +depth with the lens up', () => {
    const lens = makeLens();
    const camera = new THREE.PerspectiveCamera(50);
    // no parent: world-space branch
    camera.position.copy(lens.origin).addScaledVector(lens.depthAxis, 16).addScaledVector(lens.up, 3);
    applySideCameraTransform(camera, lens);
    const lookDir = camera.getWorldDirection(new THREE.Vector3());
    // looking back along -depth (toward the player)
    expect(lookDir.dot(lens.depthAxis)).toBeLessThan(-0.9);
  });

  it('handedness: +travelAxis projects to screen-RIGHT (so D moves right)', () => {
    const lens = makeLens();
    const camera = new THREE.PerspectiveCamera(50);
    camera.position.copy(lens.origin).addScaledVector(lens.depthAxis, 16).addScaledVector(lens.up, 3);
    applySideCameraTransform(camera, lens);
    camera.updateMatrixWorld(true);
    // A point ahead of the player along +travel should land at +x in view space.
    const ahead = lens.origin.clone().addScaledVector(lens.travelAxis, 5);
    const inView = camera.worldToLocal(ahead.clone());
    expect(inView.x).toBeGreaterThan(0.5);
  });

  it('parented camera matches the unparented world transform', () => {
    const lens = makeLens();
    const parent = new THREE.Group();
    parent.position.copy(lens.origin);
    parent.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.7); // body yaw must not matter
    const camera = new THREE.PerspectiveCamera(50);
    parent.add(camera);
    parent.updateMatrixWorld(true);
    applySideCameraTransform(camera, lens);
    const eye = camera.getWorldPosition(new THREE.Vector3());
    const expected = lens.origin.clone().addScaledVector(lens.depthAxis, 16).addScaledVector(lens.up, 3);
    expect(eye.distanceTo(expected)).toBeLessThan(1e-4);
    const lookDir = camera.getWorldDirection(new THREE.Vector3());
    expect(lookDir.dot(lens.depthAxis)).toBeLessThan(-0.9);
  });

  it('lift blend endpoints match the pure side and first-person transforms', () => {
    // Parented cameras, as in-game (both pure transforms write LOCAL position
    // only when a parent exists).
    const lens = makeLens();
    const up = new THREE.Vector3(0, 1, 0);
    const forward = new THREE.Vector3(1, 0, 0);
    const pitch = -0.1;
    const eyeHeight = 1.0;
    const rig = (cam: THREE.PerspectiveCamera) => {
      const parent = new THREE.Group();
      parent.position.copy(lens.origin);
      parent.add(cam);
      parent.updateMatrixWorld(true);
    };
    const reference = new THREE.PerspectiveCamera(50);
    const camera = new THREE.PerspectiveCamera(50);
    rig(reference);
    rig(camera);

    // blend 0 == the side transform
    applySideCameraTransform(reference, lens);
    applyLiftCameraTransform(camera, lens, up, forward.clone(), pitch, eyeHeight, 0);
    expect(camera.position.distanceTo(reference.position)).toBeLessThan(1e-6);
    expect(Math.abs(camera.quaternion.dot(reference.quaternion))).toBeCloseTo(1, 5);

    // blend 1 == the first-person gravity transform
    applyGravityCameraTransform(reference, up, forward.clone(), pitch, eyeHeight);
    applyLiftCameraTransform(camera, lens, up, forward.clone(), pitch, eyeHeight, 1);
    expect(camera.position.distanceTo(reference.position)).toBeLessThan(1e-6);
    expect(Math.abs(camera.quaternion.dot(reference.quaternion))).toBeCloseTo(1, 5);

    // mid-blend travels away from the side vantage toward the eyes
    applySideCameraTransform(reference, lens);
    const sideEye = reference.position.clone();
    applyLiftCameraTransform(camera, lens, up, forward.clone(), pitch, eyeHeight, 0.5);
    expect(camera.position.distanceTo(sideEye)).toBeGreaterThan(1);
  });

  it('REGRESSION PIN: the side rig reproduces the classic side transform exactly', () => {
    const lens = makeLens();
    const rigCam = new THREE.PerspectiveCamera(50);
    const sideCam = new THREE.PerspectiveCamera(50);
    for (const cam of [rigCam, sideCam]) {
      const parent = new THREE.Group();
      parent.position.set(3, 52, -1);
      parent.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.4);
      parent.add(cam);
      parent.updateMatrixWorld(true);
    }
    applySideCameraTransform(sideCam, lens);
    applyRigCameraTransform(rigCam, lens, SIDE_RIG);
    expect(rigCam.getWorldPosition(new THREE.Vector3())
      .distanceTo(sideCam.getWorldPosition(new THREE.Vector3()))).toBeLessThan(1e-6);
    expect(Math.abs(rigCam.quaternion.dot(sideCam.quaternion))).toBeCloseTo(1, 6);
  });

  it('top-down rig hangs above the anchor looking down, travel axis screen-right', () => {
    const lens = makeLens();
    const rig: LensRig = { ...SIDE_RIG, elevation: Math.PI / 2, distance: 26 };
    const eye = new THREE.Vector3();
    const target = new THREE.Vector3();
    const up = new THREE.Vector3();
    const anchor = new THREE.Vector3(5, 50, 2);
    computeRigFrame(lens, rig, anchor, eye, target, up);
    // straight up off the anchor (plus the lift)
    expect(eye.x).toBeCloseTo(anchor.x, 5);
    expect(eye.z).toBeCloseTo(anchor.z, 5);
    expect(eye.y).toBeGreaterThan(anchor.y + 25);
    // screen-up sweeps to -depthAxis so left/right reads the same as the side era
    expect(up.dot(lens.depthAxis)).toBeLessThan(-0.99);
  });

  it('fixed-screen quantization holds the crash frame until the worker crosses an adjacent frame', () => {
    const lens = makeLens();
    const rig: LensRig = { ...SIDE_RIG, followQuant: 20 };
    const eye = new THREE.Vector3();
    const target = new THREE.Vector3();
    const up = new THREE.Vector3();
    // The opening cell is centred on the arrival/crash origin; vertical wobble
    // and travel inside either half of the screen must not move the frame.
    computeRigFrame(lens, rig, new THREE.Vector3(-9.9, 51.5, 0), eye, target, up);
    const eyeA = eye.clone();
    computeRigFrame(lens, rig, new THREE.Vector3(9.9, 50.2, 0), eye, target, up);
    expect(eye.distanceTo(eyeA)).toBeLessThan(1e-6);
    expect(eyeA.x).toBeCloseTo(0, 5);
    // Crossing either edge flips exactly one full screen.
    computeRigFrame(lens, rig, new THREE.Vector3(10.1, 50, 0), eye, target, up);
    expect(eye.x).toBeCloseTo(20, 5);
    computeRigFrame(lens, rig, new THREE.Vector3(-10.1, 50, 0), eye, target, up);
    expect(eye.x).toBeCloseTo(-20, 5);
  });

  it('keeps the first fixed frame identical to the crash frame at the arrival origin', () => {
    const lens = makeLens();
    const fixedRig: LensRig = { ...SIDE_RIG, followQuant: 24 };
    const sideEye = new THREE.Vector3();
    const sideTarget = new THREE.Vector3();
    const sideUp = new THREE.Vector3();
    const fixedEye = new THREE.Vector3();
    const fixedTarget = new THREE.Vector3();
    const fixedUp = new THREE.Vector3();

    computeRigFrame(lens, SIDE_RIG, lens.origin, sideEye, sideTarget, sideUp);
    computeRigFrame(lens, fixedRig, lens.origin, fixedEye, fixedTarget, fixedUp);

    expect(fixedEye.distanceTo(sideEye)).toBeLessThan(1e-6);
    expect(fixedTarget.distanceTo(sideTarget)).toBeLessThan(1e-6);
    expect(fixedUp.distanceTo(sideUp)).toBeLessThan(1e-6);
  });

  it('uses one centred cell index for camera framing and SITE CAM bookkeeping', () => {
    expect(fixedScreenCellIndex(0, 24)).toBe(0);
    expect(fixedScreenCellIndex(11.9, 24)).toBe(0);
    expect(fixedScreenCellIndex(-11.9, 24)).toBe(0);
    expect(fixedScreenCellIndex(12.1, 24)).toBe(1);
    expect(fixedScreenCellIndex(-12.1, 24)).toBe(-1);
  });

  it('rigMoveBasis: side is (-depth, +travel); nav and iso stay orthonormal + screen-consistent', () => {
    const lens = makeLens();
    const fwd = new THREE.Vector3();
    const right = new THREE.Vector3();
    rigMoveBasis(lens, SIDE_RIG, fwd, right);
    expect(fwd.dot(lens.depthAxis)).toBeLessThan(-0.99);
    expect(right.dot(lens.travelAxis)).toBeGreaterThan(0.99);
    // nav (top-down): W pushes toward screen-up (-depth), D stays screen-right (+travel)
    rigMoveBasis(lens, { ...SIDE_RIG, elevation: Math.PI / 2 }, fwd, right);
    expect(fwd.dot(lens.depthAxis)).toBeLessThan(-0.99);
    expect(right.dot(lens.travelAxis)).toBeGreaterThan(0.99);
    // iso (45/45): diagonal basis, still orthonormal and tangent to the surface
    rigMoveBasis(lens, { ...SIDE_RIG, elevation: Math.PI / 4, azimuth: Math.PI / 4 }, fwd, right);
    expect(fwd.length()).toBeCloseTo(1, 6);
    expect(right.length()).toBeCloseTo(1, 6);
    expect(Math.abs(fwd.dot(right))).toBeLessThan(1e-6);
    expect(Math.abs(fwd.dot(lens.up))).toBeLessThan(1e-6);
    expect(fwd.dot(lens.depthAxis)).toBeLessThan(0); // still leads away from the camera
    expect(fwd.dot(lens.travelAxis)).toBeLessThan(0); // az>0 swings the camera toward +travel
  });

  it('active rig transform settles onto the retargeted rig after the transition', () => {
    const lens = makeLens();
    const rig: LensRig = { ...SIDE_RIG, elevation: Math.PI / 4, azimuth: Math.PI / 4, distance: 22 };
    const parentFor = (cam: THREE.PerspectiveCamera) => {
      const parent = new THREE.Group();
      parent.position.copy(lens.origin);
      parent.add(cam);
      parent.updateMatrixWorld(true);
    };
    const cam = new THREE.PerspectiveCamera(50);
    const reference = new THREE.PerspectiveCamera(50);
    parentFor(cam);
    parentFor(reference);
    setLensRig({ ...SIDE_RIG }, 0);
    applyActiveRigTransform(cam, lens, 0.016); // settle at side
    setLensRig(rig, 1.0);
    applyActiveRigTransform(cam, lens, 0.5); // mid-flight: neither endpoint
    applyRigCameraTransform(reference, lens, rig);
    expect(cam.position.distanceTo(reference.position)).toBeGreaterThan(0.5);
    applyActiveRigTransform(cam, lens, 0.6); // past the end: settled
    expect(cam.position.distanceTo(reference.position)).toBeLessThan(1e-6);
    expect(Math.abs(cam.quaternion.dot(reference.quaternion))).toBeCloseTo(1, 6);
    setLensRig({ ...SIDE_RIG }, 0); // leave global state clean for other tests
  });

  it('movie probes never touch the walked row at or below ground level', () => {
    const lens = makeLens();
    const position = new THREE.Vector3(10, 52, 0);
    const out = Array.from({ length: 6 }, () => new THREE.Vector3());
    sideHarvestProbePointsOffRow(position, lens, 1, out);
    for (const p of out) {
      const rel = p.clone().sub(position);
      const depthOff = Math.abs(rel.dot(lens.depthAxis));
      const upOff = rel.dot(lens.up);
      // Same-row candidates must be above ground; ground candidates must be
      // a full row off the walked plane — the movie cannot pothole its path.
      if (depthOff < 0.5) expect(upOff).toBeGreaterThan(-1);
      else expect(depthOff).toBeGreaterThanOrEqual(1.5);
    }
  });

  it('harvest probes lead with the facing side and include underfoot', () => {
    const lens = makeLens();
    const position = new THREE.Vector3(10, 52, 0);
    const out = Array.from({ length: 5 }, () => new THREE.Vector3());
    sideHarvestProbePoints(position, lens, 1, out);
    expect(out[0].x).toBeGreaterThan(position.x); // ahead of +facing
    sideHarvestProbePoints(position, lens, -1, out);
    expect(out[0].x).toBeLessThan(position.x); // flips with facing
    expect(out[2].y).toBeLessThan(position.y); // underfoot probe
  });

  // --- Travel-band edge clamp (the cube-face wall for the pure-2D eras) --------
  //
  // axisBandVelocityDelta returns the signed velocity correction to add ALONG
  // the band axis, mirroring EfficientPlayer's depth clamp: free inside the
  // band, cancel outward + spring back past the edge, no-op when free (Infinity).
  describe('axisBandVelocityDelta (travel wall)', () => {
    const BAND = 36;

    it('is a no-op inside the band (free travel)', () => {
      expect(axisBandVelocityDelta(0, BAND, 5)).toBe(0);
      expect(axisBandVelocityDelta(10, BAND, -5)).toBe(0);
      expect(axisBandVelocityDelta(BAND, BAND, 8)).toBe(0); // exactly at the edge is still free
      expect(axisBandVelocityDelta(-BAND, BAND, -8)).toBe(0);
    });

    it('is always a no-op when the band is Infinity, regardless of drift/speed', () => {
      expect(axisBandVelocityDelta(1e6, Infinity, 50)).toBe(0);
      expect(axisBandVelocityDelta(-1e6, Infinity, -50)).toBe(0);
    });

    it('past the + edge cancels outward velocity and springs back (negative delta)', () => {
      const drift = BAND + 2; // 2 m past the + edge
      const speed = 5; // moving further outward (+)
      const delta = axisBandVelocityDelta(drift, BAND, speed);
      // cancel outward (−5) + spring overshoot 2 inward (−2*4 = −8) = −13
      expect(delta).toBe(-13);
      // the correction opposes the outward drift
      expect(Math.sign(delta)).toBe(-Math.sign(drift));
    });

    it('past the − edge cancels outward velocity and springs back (positive delta)', () => {
      const drift = -(BAND + 3); // 3 m past the − edge
      const speed = -4; // moving further outward (−)
      const delta = axisBandVelocityDelta(drift, BAND, speed);
      // cancel outward (+4) + spring overshoot 3 inward (+3*4 = +12) = +16
      expect(delta).toBe(16);
      expect(Math.sign(delta)).toBe(-Math.sign(drift));
    });

    it('past the edge but already moving INWARD only springs (does not add outward speed)', () => {
      const drift = BAND + 2; // past the + edge
      const inwardSpeed = -6; // already heading back inward
      const delta = axisBandVelocityDelta(drift, BAND, inwardSpeed);
      // no outward component to cancel; only the spring: −2*4 = −8
      expect(delta).toBe(-8);
    });
  });
});
