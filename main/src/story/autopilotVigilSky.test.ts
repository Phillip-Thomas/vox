import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { vigilSkyLookTarget } from './autopilot.ts';
import { STARGAZE } from './storyScript.ts';

// The ch4 vigil's stargaze shot. Owner report: "we don't always see the
// constellations forming when we hit that cut scene."
//
// The cause is structural. Constellation figures are generated inside the sky
// SHADER over a cube-face grid (~10 sky-wide) and no CPU-side position for any
// of them exists, so the camera cannot be aimed at one. The old framing locked
// a single bearing off the campfire and held it for the whole reveal, which
// made seeing a figure a coin flip decided by where the player was standing.
//
// The shot now sweeps. These are the two properties that fix has to keep.

const player = new THREE.Vector3(10, 52, -4);
const up = new THREE.Vector3(0, 1, 0);
const fire = new THREE.Vector3(13, 52, -4);
const scratch = new THREE.Vector3();

function pitchAt(clock: number): number {
  const target = vigilSkyLookTarget(player, up, fire, clock, scratch).clone();
  const dir = target.sub(player).normalize();
  return Math.asin(THREE.MathUtils.clamp(dir.dot(up), -1, 1));
}

function bearingAt(clock: number): THREE.Vector3 {
  const target = vigilSkyLookTarget(player, up, fire, clock, scratch).clone();
  const dir = target.sub(player);
  return dir.addScaledVector(up, -dir.dot(up)).normalize();
}

describe('vigil sky framing', () => {
  it('never drops below the director look-up gate, at any point in the sweep', () => {
    // If the pitch ever fell under STARGAZE.lookUpPitch the director's gate
    // would stop accumulating and the constellation ramp would never start —
    // the shot would sweep an empty sky forever.
    for (let clock = 0; clock <= 120; clock += 0.5) {
      expect(pitchAt(clock)).toBeGreaterThan(STARGAZE.lookUpPitch);
    }
  });

  it('holds a constant pitch so the sweep reads as a pan, not a wobble', () => {
    const first = pitchAt(0);
    for (const clock of [7, 19, 41, 88]) {
      expect(pitchAt(clock)).toBeCloseTo(first, 6);
    }
  });

  it('actually sweeps: the bearing keeps moving through the reveal', () => {
    const start = bearingAt(0);
    // By the time the reveal ramp completes the frame has crossed real sky.
    const atReveal = bearingAt(STARGAZE.revealSeconds);
    expect(start.angleTo(atReveal)).toBeGreaterThan(0.5);
    // And it is still moving afterwards, so a slow reveal is still covered.
    expect(bearingAt(60).angleTo(atReveal)).toBeGreaterThan(0.5);
  });

  it('sweeps a wide arc of the sky rather than pivoting near the zenith', () => {
    // A near-vertical framing would rotate about itself and show almost no new
    // sky. Over a minute the bearing must cover a substantial arc.
    let maxSeparation = 0;
    const origin = bearingAt(0);
    for (let clock = 0; clock <= 60; clock += 1) {
      maxSeparation = Math.max(maxSeparation, origin.angleTo(bearingAt(clock)));
    }
    expect(maxSeparation).toBeGreaterThan(2); // radians
  });

  it('survives a degenerate fire position directly underfoot', () => {
    const target = vigilSkyLookTarget(player, up, player.clone(), 3, scratch);
    expect(Number.isFinite(target.x)).toBe(true);
    expect(Number.isFinite(target.y)).toBe(true);
    expect(Number.isFinite(target.z)).toBe(true);
  });
});
