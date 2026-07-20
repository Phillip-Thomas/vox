import * as THREE from 'three';
import { FACE_NORMALS, deterministicTangentForUp, dominantFaceForPosition } from '../utils/surfaceControls.ts';
import type { CubeFace } from '../types/cube.ts';
import {
  planCrossFaceSurfaceLeg,
  surfaceFaceFromUp,
  type CrossFaceSurfaceLeg
} from './autopilotSteering.ts';

export interface DirectionalMarkerProjection {
  x: number;
  y: number;
  angle: number;
  offscreen: boolean;
  surfaceOccluded: boolean;
  /** Latched while an antipodal objective owns the same route. */
  routeNextFace?: CubeFace | null;
  routeViewerFace?: CubeFace | null;
  routeTargetFace?: CubeFace | null;
  routeKey?: string | null;
}

export type DirectionalMarkerSpace = 'surface' | 'spatial';

export interface DirectionalMarkerOptions {
  width: number;
  height: number;
  margin?: number;
  /** Surface goals follow cube-face tangents. Spatial goals (ships, planets,
   *  orbital signals) follow the unmodified camera-space ray. */
  space?: DirectionalMarkerSpace;
  /** Redacted/occluded subjects remain an edge direction even if their raw
   * through-terrain projection happens to land inside the viewport. */
  forceEdge?: boolean;
  /** Stable answer for a target exactly behind the viewer. */
  preferredSide?: -1 | 1;
  /** Physics-owned surface frame. Camera position is only a compatibility
   * fallback because it can disagree with player gravity at a cube seam. */
  surfaceOrigin?: THREE.Vector3;
  surfaceUp?: THREE.Vector3;
  surfaceForward?: THREE.Vector3;
  /** Authored ownership removes target-face ambiguity near an edge or corner. */
  targetUp?: THREE.Vector3 | null;
  /** Stable objective identity. A new owner may choose a new antipodal route
   * even when its viewer/target face pair matches the previous objective. */
  routeKey?: string | null;
  planetRadius?: number;
  edgeEntryRadius?: number;
  cornerInset?: number;
}

const _cameraPosition = new THREE.Vector3();
const _cameraQuaternion = new THREE.Quaternion();
const _cameraInverse = new THREE.Quaternion();
const _raw = new THREE.Vector3();
const _cameraSpaceRaw = new THREE.Vector3();
const _bearing = new THREE.Vector3();
const _up = new THREE.Vector3();
const _surfaceOrigin = new THREE.Vector3();
const _surfaceForward = new THREE.Vector3();
const _surfaceRight = new THREE.Vector3();
const _surfaceDelta = new THREE.Vector3();
const _ndc = new THREE.Vector3();
const _routeLeg: CrossFaceSurfaceLeg = {
  fromFace: 'top',
  nextFace: 'right',
  remainingTransitions: 1,
  approach: new THREE.Vector3(),
  continuationDirection: new THREE.Vector3()
};

/**
 * Project an objective or censored subject into an in-frame anchor / edge
 * chevron. Edge direction follows the local surface bearing, not the Euclidean
 * chord through a cube, so another-face goals never imply "look at the ground."
 */
export function projectDirectionalMarker(
  camera: THREE.PerspectiveCamera,
  target: THREE.Vector3,
  options: DirectionalMarkerOptions,
  out: DirectionalMarkerProjection = {
    x: 0,
    y: 0,
    angle: 0,
    offscreen: true,
    surfaceOccluded: false
  }
): DirectionalMarkerProjection {
  const halfW = options.width / 2;
  const halfH = options.height / 2;
  const margin = options.margin ?? 70;
  camera.getWorldPosition(_cameraPosition);
  camera.getWorldQuaternion(_cameraQuaternion);
  _cameraInverse.copy(_cameraQuaternion).invert();
  _raw.copy(target).sub(_cameraPosition);

  const space = options.space ?? 'surface';
  _cameraSpaceRaw.copy(_raw).applyQuaternion(_cameraInverse);
  const depth = -_cameraSpaceRaw.z;

  if (space === 'spatial') {
    out.surfaceOccluded = false;
    out.routeNextFace = null;
    out.routeViewerFace = null;
    out.routeTargetFace = null;
    out.routeKey = null;
    if (!options.forceEdge && depth > 0.5) {
      _ndc.copy(target).project(camera);
      const x = _ndc.x * halfW + halfW;
      const y = -_ndc.y * halfH + halfH;
      const onscreen = x >= margin && x <= options.width - margin
        && y >= margin && y <= options.height - margin;
      if (onscreen) {
        out.x = x;
        out.y = y;
        out.angle = 0;
        out.offscreen = false;
        return out;
      }
    }
    return writeEdgeProjection(
      _cameraSpaceRaw.x,
      -_cameraSpaceRaw.y,
      halfW,
      halfH,
      margin,
      options.preferredSide,
      out
    );
  }

  _surfaceOrigin.copy(options.surfaceOrigin ?? _cameraPosition);
  const hasSurfaceUp = Boolean(options.surfaceUp && options.surfaceUp.lengthSq() > 1e-8);
  if (hasSurfaceUp) _up.copy(options.surfaceUp!).normalize();
  else _up.copy(FACE_NORMALS[dominantFaceForPosition(_surfaceOrigin)]);
  const viewerFace = hasSurfaceUp
    ? surfaceFaceFromUp(_up)
    : dominantFaceForPosition(_surfaceOrigin);
  const targetFace = options.targetUp && options.targetUp.lengthSq() > 1e-8
    ? dominantFaceForPosition(options.targetUp)
    : dominantFaceForPosition(target);
  const sameFace = viewerFace === targetFace;
  out.surfaceOccluded = !sameFace;
  if (sameFace) {
    out.routeNextFace = null;
    out.routeViewerFace = viewerFace;
    out.routeTargetFace = targetFace;
    out.routeKey = null;
  }

  // Raw camera depth is used only to decide whether a same-face subject is
  // genuinely visible. World/local transforms are deliberately resolved above.
  let onscreen = false;
  if (!options.forceEdge && sameFace && depth > 0.5) {
    _ndc.copy(target).project(camera);
    const x = _ndc.x * halfW + halfW;
    const y = -_ndc.y * halfH + halfH;
    onscreen = x >= margin && x <= options.width - margin
      && y >= margin && y <= options.height - margin;
    if (onscreen) {
      out.x = x;
      out.y = y;
      out.angle = 0;
      out.offscreen = false;
      return out;
    }
  }

  if (sameFace) {
    _surfaceDelta.copy(target).sub(_surfaceOrigin);
    _bearing.copy(_surfaceDelta).addScaledVector(_up, -_surfaceDelta.dot(_up));
    if (_bearing.lengthSq() < 1e-8) deterministicTangentForUp(_up, _bearing);
    else _bearing.normalize();
    _bearing.applyQuaternion(_cameraInverse);

    return writeEdgeProjection(
      _bearing.x,
      -_bearing.y,
      halfW,
      halfH,
      margin,
      options.preferredSide,
      out
    );
  }

  camera.getWorldDirection(_surfaceForward);
  if (options.surfaceForward && options.surfaceForward.lengthSq() > 1e-8) {
    _surfaceForward.copy(options.surfaceForward);
  }
  _surfaceForward.addScaledVector(_up, -_surfaceForward.dot(_up));
  if (_surfaceForward.lengthSq() < 1e-8) deterministicTangentForUp(_up, _surfaceForward);
  else _surfaceForward.normalize();

  const routeStillOwned = out.routeViewerFace === viewerFace
    && out.routeTargetFace === targetFace
    && out.routeKey === (options.routeKey ?? null);
  const planetRadius = options.planetRadius ?? 50;
  const leg = planCrossFaceSurfaceLeg({
    player: _surfaceOrigin,
    goal: target,
    currentFace: viewerFace,
    goalFace: targetFace,
    lookForward: _surfaceForward,
    planetRadius,
    edgeEntryRadius: options.edgeEntryRadius ?? Math.max(0.1, planetRadius - 1.8),
    cornerInset: options.cornerInset ?? 2,
    preferredNextFace: routeStillOwned ? out.routeNextFace : null
  }, _routeLeg);

  if (leg) {
    out.routeNextFace = leg.nextFace;
    out.routeViewerFace = viewerFace;
    out.routeTargetFace = targetFace;
    out.routeKey = options.routeKey ?? null;
    _surfaceDelta.copy(leg.approach).sub(_surfaceOrigin);
    const nextUp = FACE_NORMALS[leg.nextFace];
    if (_surfaceOrigin.dot(nextUp) >= leg.approach.dot(nextUp) - 0.5) {
      // The player has reached/passed the inset but may still be aligning along
      // its edge. Remove only the stale backwards component; keep any lateral
      // correction, then cross once the seam coordinate is aligned.
      const staleBacktrack = _surfaceDelta.dot(nextUp);
      if (staleBacktrack < 0) _surfaceDelta.addScaledVector(nextUp, -staleBacktrack);
      if (_surfaceDelta.lengthSq() < 0.25) _surfaceDelta.copy(nextUp);
    }
    _bearing.copy(_surfaceDelta).addScaledVector(_up, -_surfaceDelta.dot(_up));
    // Once the inset has been reached, continue across the horizon instead of
    // reversing toward a waypoint that is now marginally behind the player.
    if (_bearing.lengthSq() < 0.25) {
      _bearing.copy(nextUp).addScaledVector(_up, -nextUp.dot(_up));
    }
  }
  if (_bearing.lengthSq() < 1e-8) deterministicTangentForUp(_up, _bearing);
  else _bearing.normalize();

  _surfaceRight.crossVectors(_surfaceForward, _up);
  if (_surfaceRight.lengthSq() < 1e-8) deterministicTangentForUp(_up, _surfaceRight);
  else _surfaceRight.normalize();
  const screenRight = _bearing.dot(_surfaceRight);
  const routeForward = _bearing.dot(_surfaceForward);

  return writeEdgeProjection(
    screenRight,
    // A hidden route straight ahead belongs at the top horizon. Preserve the
    // established lateral fallback behind the player so "behind" never looks
    // like an instruction to stare at the ground.
    routeForward > 1e-4 ? -routeForward : 0,
    halfW,
    halfH,
    margin,
    options.preferredSide,
    out
  );
}

function writeEdgeProjection(
  rawX: number,
  rawY: number,
  halfW: number,
  halfH: number,
  margin: number,
  preferredSide: -1 | 1 | undefined,
  out: DirectionalMarkerProjection
): DirectionalMarkerProjection {
  let sx = rawX;
  let sy = rawY;
  const length = Math.hypot(sx, sy);
  if (length < 1e-4) {
    // Dead astern has no mathematical 2D direction. A stable lateral choice is
    // more human/useful than the old arbitrary "down" (ground) chevron.
    sx = preferredSide ?? 1;
    sy = 0;
  } else {
    sx /= length;
    sy /= length;
  }
  const scale = Math.min(
    (halfW - margin) / Math.max(1e-4, Math.abs(sx)),
    (halfH - margin) / Math.max(1e-4, Math.abs(sy))
  );
  out.x = halfW + sx * scale;
  out.y = halfH + sy * scale;
  out.angle = Math.atan2(sy, sx);
  out.offscreen = true;
  return out;
}

/** Range uses the player's surface frame on foot and the actual render camera
 * for spatial flight, where the surface player-frame mailbox is intentionally
 * frozen while cruising. */
export function directionalMarkerRange(
  camera: THREE.PerspectiveCamera,
  target: THREE.Vector3,
  surfaceOrigin: THREE.Vector3,
  space: DirectionalMarkerSpace = 'surface',
  clearance = 1.5
): number {
  const origin = space === 'spatial'
    ? camera.getWorldPosition(_cameraPosition)
    : surfaceOrigin;
  return Math.max(0, origin.distanceTo(target) - clearance);
}
