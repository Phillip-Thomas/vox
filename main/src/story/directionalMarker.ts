import * as THREE from 'three';
import { FACE_NORMALS, deterministicTangentForUp, dominantFaceForPosition } from '../utils/surfaceControls.ts';

export interface DirectionalMarkerProjection {
  x: number;
  y: number;
  angle: number;
  offscreen: boolean;
  surfaceOccluded: boolean;
}

export interface DirectionalMarkerOptions {
  width: number;
  height: number;
  margin?: number;
  /** Redacted/occluded subjects remain an edge direction even if their raw
   * through-terrain projection happens to land inside the viewport. */
  forceEdge?: boolean;
  /** Stable answer for a target exactly behind the viewer. */
  preferredSide?: -1 | 1;
}

const _cameraPosition = new THREE.Vector3();
const _cameraQuaternion = new THREE.Quaternion();
const _cameraInverse = new THREE.Quaternion();
const _raw = new THREE.Vector3();
const _cameraSpaceRaw = new THREE.Vector3();
const _bearing = new THREE.Vector3();
const _up = new THREE.Vector3();
const _ndc = new THREE.Vector3();

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

  const viewerFace = dominantFaceForPosition(_cameraPosition);
  const targetFace = dominantFaceForPosition(target);
  const sameFace = viewerFace === targetFace;
  out.surfaceOccluded = !sameFace;

  // Raw camera depth is used only to decide whether a same-face subject is
  // genuinely visible. World/local transforms are deliberately resolved above.
  _cameraSpaceRaw.copy(_raw).applyQuaternion(_cameraInverse);
  const depth = -_cameraSpaceRaw.z;
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

  _up.copy(FACE_NORMALS[viewerFace]);
  _bearing.copy(_raw).addScaledVector(_up, -_raw.dot(_up));
  if (_bearing.lengthSq() < 1e-8 && !sameFace) {
    _bearing.copy(FACE_NORMALS[targetFace])
      .addScaledVector(_up, -FACE_NORMALS[targetFace].dot(_up));
  }
  if (_bearing.lengthSq() < 1e-8) deterministicTangentForUp(_up, _bearing);
  else _bearing.normalize();
  _bearing.applyQuaternion(_cameraInverse);

  let sx = _bearing.x;
  let sy = -_bearing.y;
  const length = Math.hypot(sx, sy);
  if (length < 1e-4) {
    // Dead astern has no mathematical 2D direction. A stable lateral choice is
    // more human/useful than the old arbitrary "down" (ground) chevron.
    sx = options.preferredSide ?? 1;
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
