export type Vec3Tuple = readonly [number, number, number];

/** Physical dorsal-hatch center in the parked Kestrel's local frame. */
export const BOARDING_HATCH_TARGET_LOCAL: Vec3Tuple = [0.5, 1, 0];

/**
 * The visible canopy is an ellipsoid centred at [0.72, 0.52, 0] with radii
 * [0.72, 0.42, 0.5]. This slightly inflated envelope keeps the camera's near
 * plane clear of the transparent shell as well as its triangles.
 */
export const BOARDING_CANOPY_SAFE_CENTER_LOCAL: Vec3Tuple = [0.72, 0.52, 0];
export const BOARDING_CANOPY_SAFE_RADII_LOCAL: Vec3Tuple = [0.88, 0.58, 0.66];
export const BOARDING_CANOPY_VISIBLE_CENTER_LOCAL: Vec3Tuple = [0.72, 0.52, 0];
export const BOARDING_CANOPY_VISIBLE_RADII_LOCAL: Vec3Tuple = [0.72, 0.42, 0.5];
export const BOARDING_CAMERA_MIN_STANDOFF = 0.68;
export const BOARDING_CAMERA_SHELL_CLEARANCE = 0.12;
export const BOARDING_CAMERA_PATH_MIN_LOCAL_Y = 1.62;
// The physical approach is on +Z. Keeping the hero eye on that same side lets
// the dorsal leaf swing away from the lens instead of through its near plane.
export const BOARDING_CAMERA_HERO_EYE_LOCAL: Vec3Tuple = [0.1, 2.8, 2];
// Boarding may legally begin from any radial side. The authored pose cranes
// above and around the complete hull to this +Z waypoint before settling on the
// hero eye, so a -Z/manual approach never follows the opening leaf into frame.
export const BOARDING_CAMERA_CLEARANCE_EYE_LOCAL: Vec3Tuple = [0.1, 5, 4.8];
export const BOARDING_CAMERA_CLEARANCE_PROGRESS = 0.65;
export const BOARDING_CAMERA_POSE_FULL_WEIGHT_PROGRESS = 0.62;
// Sample the leaf before the normal-priority transaction tick. CameraControls
// consumes the pose published by that same prior tick, so camera and hatch stay
// visually synchronized without moving story/score side effects out of order.
export const BOARDING_HATCH_FRAME_PRIORITY = -1;
// Keep the authoritative transaction on R3F's normal frame lane. Making this
// explicit prevents a visual synchronization repair from moving story, score,
// or signed-anchor side effects ahead of their established consumers again.
export const BOARDING_TRANSACTION_FRAME_PRIORITY = 0;
export const BOARDING_HATCH_OPEN_RADIANS = 1.18;
export const BOARDING_HATCH_HINGE_LOCAL: Vec3Tuple = [0.5, 1, -0.62];
export const BOARDING_HATCH_LEAF_CENTER_FROM_HINGE: Vec3Tuple = [0, 0, 0.62];
export const BOARDING_HATCH_LEAF_SIZE: Vec3Tuple = [1.28, 0.09, 1.22];

/** The dark, opaque pocket the exterior camera reads through the open rim. */
export const BOARDING_HATCH_THROAT_FOCUS_LOCAL: Vec3Tuple = [0.5, 0.98, 0];

/** Values >= 1 are outside the inflated transparent-canopy exclusion volume. */
export function boardingCanopySafetyMetric(point: Vec3Tuple): number {
  const dx = (point[0] - BOARDING_CANOPY_SAFE_CENTER_LOCAL[0])
    / BOARDING_CANOPY_SAFE_RADII_LOCAL[0];
  const dy = (point[1] - BOARDING_CANOPY_SAFE_CENTER_LOCAL[1])
    / BOARDING_CANOPY_SAFE_RADII_LOCAL[1];
  const dz = (point[2] - BOARDING_CANOPY_SAFE_CENTER_LOCAL[2])
    / BOARDING_CANOPY_SAFE_RADII_LOCAL[2];
  return dx * dx + dy * dy + dz * dz;
}

/** Values >= 1 are outside the actual visible transparent canopy. */
export function boardingVisibleCanopySafetyMetric(point: Vec3Tuple): number {
  const dx = (point[0] - BOARDING_CANOPY_VISIBLE_CENTER_LOCAL[0])
    / BOARDING_CANOPY_VISIBLE_RADII_LOCAL[0];
  const dy = (point[1] - BOARDING_CANOPY_VISIBLE_CENTER_LOCAL[1])
    / BOARDING_CANOPY_VISIBLE_RADII_LOCAL[1];
  const dz = (point[2] - BOARDING_CANOPY_VISIBLE_CENTER_LOCAL[2])
    / BOARDING_CANOPY_VISIBLE_RADII_LOCAL[2];
  return dx * dx + dy * dy + dz * dz;
}

/**
 * Resolve the closest safe point on the continuous exterior-eye -> hatch ray.
 * The endpoint never crosses the inflated canopy; a start already too close
 * simply stays where it is rather than snapping through the shell.
 */
export function resolveBoardingCameraStandoffLocal(
  startEye: Vec3Tuple,
  hatch: Vec3Tuple = BOARDING_HATCH_TARGET_LOCAL
): [number, number, number] {
  const rawX = startEye[0] - hatch[0];
  const rawY = startEye[1] - hatch[1];
  const rawZ = startEye[2] - hatch[2];
  const startDistance = Math.hypot(rawX, rawY, rawZ);
  if (!Number.isFinite(startDistance) || startDistance <= 1e-6) {
    return [...hatch];
  }

  const dx = rawX / startDistance;
  const dy = rawY / startDistance;
  const dz = rawZ / startDistance;
  const ox = hatch[0] - BOARDING_CANOPY_SAFE_CENTER_LOCAL[0];
  const oy = hatch[1] - BOARDING_CANOPY_SAFE_CENTER_LOCAL[1];
  const oz = hatch[2] - BOARDING_CANOPY_SAFE_CENTER_LOCAL[2];
  const rx = BOARDING_CANOPY_SAFE_RADII_LOCAL[0];
  const ry = BOARDING_CANOPY_SAFE_RADII_LOCAL[1];
  const rz = BOARDING_CANOPY_SAFE_RADII_LOCAL[2];
  const a = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) + (dz * dz) / (rz * rz);
  const b = 2 * (
    (ox * dx) / (rx * rx)
    + (oy * dy) / (ry * ry)
    + (oz * dz) / (rz * rz)
  );
  const c = (ox * ox) / (rx * rx) + (oy * oy) / (ry * ry) + (oz * oz) / (rz * rz) - 1;
  const discriminant = Math.max(0, b * b - 4 * a * c);
  const shellExit = a > 1e-9
    ? Math.max(0, (-b + Math.sqrt(discriminant)) / (2 * a))
    : 0;
  const requiredDistance = Math.max(
    BOARDING_CAMERA_MIN_STANDOFF,
    shellExit + BOARDING_CAMERA_SHELL_CLEARANCE
  );
  const distance = Math.min(startDistance, requiredDistance);
  const candidate: [number, number, number] = [
    hatch[0] + dx * distance,
    hatch[1] + dy * distance,
    hatch[2] + dz * distance
  ];

  // A malformed/embedded exterior pose must not be pulled farther through the
  // shell. Keeping the original eye is the only continuous safe fallback.
  return boardingCanopySafetyMetric(candidate) >= 1
    ? candidate
    : [startEye[0], startEye[1], startEye[2]];
}

/**
 * Carry an arbitrary exterior eye over the complete parked hull before
 * converging on a stable three-quarter hatch shot. The previous direct ray to
 * the canopy stopped outside its ellipsoid but still crossed the opaque wing,
 * fuselage, and incorrectly raised hatch panel on the way there.
 */
export function sampleBoardingCameraPathLocal(
  startEye: Vec3Tuple,
  progress: number
): [number, number, number] {
  const safeStart: [number, number, number] = [...startEye].every(Number.isFinite)
    ? [
        startEye[0],
        Math.max(startEye[1], BOARDING_CAMERA_PATH_MIN_LOCAL_Y),
        startEye[2]
      ]
    : [...BOARDING_CAMERA_HERO_EYE_LOCAL];
  const unit = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  const firstLeg = unit <= BOARDING_CAMERA_CLEARANCE_PROGRESS;
  const legProgress = firstLeg
    ? unit / BOARDING_CAMERA_CLEARANCE_PROGRESS
    : (unit - BOARDING_CAMERA_CLEARANCE_PROGRESS)
      / (1 - BOARDING_CAMERA_CLEARANCE_PROGRESS);
  const eased = legProgress * legProgress * (3 - 2 * legProgress);
  const from = firstLeg ? safeStart : BOARDING_CAMERA_CLEARANCE_EYE_LOCAL;
  const to = firstLeg ? BOARDING_CAMERA_CLEARANCE_EYE_LOCAL : BOARDING_CAMERA_HERO_EYE_LOCAL;
  return [
    from[0] + (to[0] - from[0]) * eased,
    from[1] + (to[1] - from[1]) * eased,
    from[2] + (to[2] - from[2]) * eased
  ];
}

/** Exact eye-position portion of CameraControls' non-cumulative pose blend. */
export function sampleBoardingRuntimeCameraEyeLocal(
  authoredStartEye: Vec3Tuple,
  liveBaseEye: Vec3Tuple,
  progress: number
): [number, number, number] {
  const unit = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  const authoredEye = sampleBoardingCameraPathLocal(authoredStartEye, unit);
  const weight = boardingCameraPoseWeight(unit);
  return [
    liveBaseEye[0] + (authoredEye[0] - liveBaseEye[0]) * weight,
    liveBaseEye[1] + (authoredEye[1] - liveBaseEye[1]) * weight,
    liveBaseEye[2] + (authoredEye[2] - liveBaseEye[2]) * weight
  ];
}

/** Smoothly hands off from embodied gaze, then fully owns the late hatch shot. */
export function boardingCameraPoseWeight(progress: number): number {
  const unit = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  const normalized = Math.min(1, unit / BOARDING_CAMERA_POSE_FULL_WEIGHT_PROGRESS);
  return normalized * normalized * (3 - 2 * normalized);
}

/** The dorsal panel is hinged along local X; rotating around Z made it a wall. */
export function boardingHatchRotationX(progress: number): number {
  const unit = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  return -unit * BOARDING_HATCH_OPEN_RADIANS;
}

function pointInUnrotatedHatchLeafFrame(
  point: Vec3Tuple,
  progress: number
): [number, number, number] {
  const angle = boardingHatchRotationX(progress);
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const x = point[0] - BOARDING_HATCH_HINGE_LOCAL[0];
  const y = point[1] - BOARDING_HATCH_HINGE_LOCAL[1];
  const z = point[2] - BOARDING_HATCH_HINGE_LOCAL[2];
  return [
    x - BOARDING_HATCH_LEAF_CENTER_FROM_HINGE[0],
    cosine * y + sine * z - BOARDING_HATCH_LEAF_CENTER_FROM_HINGE[1],
    -sine * y + cosine * z - BOARDING_HATCH_LEAF_CENTER_FROM_HINGE[2]
  ];
}

/**
 * True when the eye-to-subject segment crosses the moving hatch leaf. Keeping
 * this geometry contract beside the authored pose prevents a hinge or camera
 * edit from silently turning the panel into a full-frame near-plane slab.
 */
export function boardingHatchLeafOccludesSegment(
  start: Vec3Tuple,
  end: Vec3Tuple,
  progress: number,
  clearance = 0
): boolean {
  const localStart = pointInUnrotatedHatchLeafFrame(start, progress);
  const localEnd = pointInUnrotatedHatchLeafFrame(end, progress);
  let segmentMin = 0;
  let segmentMax = 1;

  for (let axis = 0; axis < 3; axis++) {
    const halfExtent = BOARDING_HATCH_LEAF_SIZE[axis]! / 2 + Math.max(0, clearance);
    const origin = localStart[axis]!;
    const delta = localEnd[axis]! - origin;
    if (Math.abs(delta) <= 1e-9) {
      if (origin < -halfExtent || origin > halfExtent) return false;
      continue;
    }
    const first = (-halfExtent - origin) / delta;
    const second = (halfExtent - origin) / delta;
    segmentMin = Math.max(segmentMin, Math.min(first, second));
    segmentMax = Math.min(segmentMax, Math.max(first, second));
    if (segmentMin > segmentMax) return false;
  }
  return segmentMax >= 0 && segmentMin <= 1;
}
