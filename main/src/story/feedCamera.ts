import type * as THREE from 'three';
import { clampCameraPitch, rotateCameraForwardYaw } from '../utils/gravityCamera.ts';

// --- Regulation Feed look quantization --------------------------------------------
//
// During the feed chapters the player stays pointer-locked (the whole input stack
// assumes lock) but the LOOK is quantized like a CCTV pan head: mouse travel
// accumulates and snaps the heading in 90° compass steps; pitch is pinned to a
// slight regulation down-angle. CameraControls' existing display smoothing turns
// each snap into a fast servo whip for free.
//
// `feedBlend` (0 feed → 1 free) is the A2 liberation axis: the continuous look
// component fades in, the snap component fades out, and the pitch clamp opens
// from the pinned angle to the full free-look range — all on the SAME
// surfaceForward/pitch state the free path uses, so the handoff is seamless.
//
// `smoothYaw` is an independent policy override (owner decision 2026-07-21): it
// forces the YAW to the continuous branch while leaving the pitch band on
// `feedBlend`. Playable first-person survey (ch1-anomaly, a1-ramp) turns it on
// so drag pans smoothly, but the surveillance-era pitch band stays pinned. The
// 90° snap machinery below is retained intact for the liberation blend and any
// future feed cutscene that leaves `smoothYaw` off.

export const FEED_PITCH = -0.06; // resting regulation down-angle (radians)
/** CCTV tilt band: enough DOWN to harvest at your feet, a little up. */
export const FEED_PITCH_MIN = -0.55;
export const FEED_PITCH_MAX = 0.35;
/** Tilt servo speed: slower than free look — a motor, not a neck. */
export const FEED_TILT_SENSITIVITY = 0.55;
/** Accumulated mouse travel (radians-equivalent) that triggers a 90° snap. */
export const FEED_SNAP_THRESHOLD = 0.34;
export const FEED_SNAP_ANGLE = Math.PI / 2;
const FEED_MOUSE_SENSITIVITY = 0.002; // matches CameraControls' MOUSE_SENSITIVITY

export interface FeedLookState {
  yawAccum: number;
}

export function createFeedLookState(): FeedLookState {
  return { yawAccum: 0 };
}

/**
 * Feed-mode replacement for the free-look mousemove math. Mutates
 * `surfaceForward` / `pitchRef` exactly like the free path does.
 */
export function feedAccumulateLook(
  state: FeedLookState,
  movementX: number,
  movementY: number,
  surfaceForward: THREE.Vector3,
  surfaceUp: THREE.Vector3,
  pitchRef: { current: number },
  feedBlend: number,
  smoothYaw = false
): void {
  const blend = Math.min(1, Math.max(0, feedBlend));
  const dx = movementX * FEED_MOUSE_SENSITIVITY;
  const dy = movementY * FEED_MOUSE_SENSITIVITY;

  // Continuous yaw fades IN with the blend; the snap accumulator fades OUT.
  // `smoothYaw` forces the yaw fully continuous regardless of blend (the pitch
  // band below still follows `feedBlend`, so the pinned CCTV tilt survives).
  const yawBlend = smoothYaw ? 1 : blend;
  if (yawBlend > 0) {
    rotateCameraForwardYaw(surfaceForward, surfaceUp, -dx * yawBlend, surfaceForward);
  }
  state.yawAccum += dx * (1 - yawBlend);
  while (state.yawAccum >= FEED_SNAP_THRESHOLD) {
    rotateCameraForwardYaw(surfaceForward, surfaceUp, -FEED_SNAP_ANGLE, surfaceForward);
    state.yawAccum = 0;
  }
  while (state.yawAccum <= -FEED_SNAP_THRESHOLD) {
    rotateCameraForwardYaw(surfaceForward, surfaceUp, FEED_SNAP_ANGLE, surfaceForward);
    state.yawAccum = 0;
  }

  // Pitch: a CCTV tilt band when locked (slow servo, enough down-angle to
  // harvest at your feet); the band and sensitivity open toward the free-look
  // clamp with the blend.
  const tiltSensitivity = FEED_TILT_SENSITIVITY + (1 - FEED_TILT_SENSITIVITY) * blend;
  const next = pitchRef.current - dy * tiltSensitivity;
  const freeClamped = clampCameraPitch(next);
  const maxPitch = clampCameraPitch(Math.PI); // the free-look clamp bound
  const min = FEED_PITCH_MIN + (-maxPitch - FEED_PITCH_MIN) * blend;
  const max = FEED_PITCH_MAX + (maxPitch - FEED_PITCH_MAX) * blend;
  pitchRef.current = Math.min(max, Math.max(min, freeClamped));
}
