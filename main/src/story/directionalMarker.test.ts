import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { CubeFace } from '../types/cube.ts';
import {
  areAdjacentFaces,
  deterministicTangentForUp,
  FACE_NORMALS
} from '../utils/surfaceControls.ts';
import {
  directionalMarkerRange,
  projectDirectionalMarker,
  type DirectionalMarkerProjection
} from './directionalMarker.ts';

function cameraAt(position: THREE.Vector3, target: THREE.Vector3): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000);
  camera.position.copy(position);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return camera;
}

const FACES = Object.keys(FACE_NORMALS) as CubeFace[];
const ADJACENT_FACE_PAIRS = FACES.flatMap(viewer => FACES
  .filter(target => areAdjacentFaces(viewer, target))
  .map(target => [viewer, target] as const));
const OPPOSITE_FACE_PAIRS = FACES.map(viewer => {
  const target = FACES.find(candidate => FACE_NORMALS[viewer].dot(FACE_NORMALS[candidate]) < -0.5)!;
  return [viewer, target] as const;
});

function cameraOnFace(face: CubeFace, forward: THREE.Vector3): THREE.PerspectiveCamera {
  const origin = FACE_NORMALS[face].clone().multiplyScalar(52);
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000);
  camera.position.copy(origin);
  camera.up.copy(FACE_NORMALS[face]);
  camera.lookAt(origin.clone().add(forward));
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return camera;
}

describe('surface directional marker', () => {
  it('projects a same-face subject in frame', () => {
    const camera = cameraAt(new THREE.Vector3(0, 52, 0), new THREE.Vector3(10, 52, 0));
    const marker = projectDirectionalMarker(camera, new THREE.Vector3(10, 51, 0), {
      width: 1600,
      height: 900
    });
    expect(marker.offscreen).toBe(false);
    expect(marker.surfaceOccluded).toBe(false);
    expect(marker.x).toBeGreaterThan(700);
    expect(marker.x).toBeLessThan(900);
  });

  it('honors camera world space under a transformed player parent', () => {
    const parent = new THREE.Group();
    parent.position.set(20, 52, -8);
    parent.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
    const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000);
    parent.add(camera);
    parent.updateMatrixWorld(true);
    camera.lookAt(new THREE.Vector3(20, 52, -20));
    camera.updateMatrixWorld(true);
    const marker = projectDirectionalMarker(camera, new THREE.Vector3(20, 52, -20), {
      width: 1600,
      height: 900
    });
    expect(marker.offscreen).toBe(false);
  });

  it('keeps an adjacent-face target on an edge bearing', () => {
    const camera = cameraAt(new THREE.Vector3(0, 52, 0), new THREE.Vector3(0, 52, -10));
    const marker = projectDirectionalMarker(camera, new THREE.Vector3(52, 0, 4), {
      width: 1600,
      height: 900
    });
    expect(marker.offscreen).toBe(true);
    expect(marker.surfaceOccluded).toBe(true);
    expect(marker.x).toBeGreaterThan(800);
    expect(Number.isFinite(marker.angle)).toBe(true);
  });

  it('points ahead over the horizon instead of choosing an arbitrary side', () => {
    const camera = cameraAt(
      new THREE.Vector3(0, 52, 0),
      new THREE.Vector3(10, 52, 0)
    );
    const marker = projectDirectionalMarker(camera, new THREE.Vector3(52, 0, 0), {
      width: 1600,
      height: 900,
      margin: 70,
      preferredSide: 1
    });

    expect(marker.offscreen).toBe(true);
    expect(marker.surfaceOccluded).toBe(true);
    expect(marker.x).toBeCloseTo(800, 5);
    expect(marker.y).toBeCloseTo(70, 5);
    expect(marker.angle).toBeCloseTo(-Math.PI / 2, 5);
  });

  it('uses the unfolded first seam leg when destination-face depth changes the route', () => {
    const camera = cameraAt(
      new THREE.Vector3(0, 52, -40),
      new THREE.Vector3(10, 52, -40)
    );
    const marker = projectDirectionalMarker(camera, new THREE.Vector3(52, -40, 40), {
      width: 1600,
      height: 900,
      margin: 70,
      preferredSide: 1
    });

    // The cube-unfolded first leg aims from (0, 52, -40) to the top/right
    // seam near (48, 52, -11.43). In the local ground compass that is about
    // 31 degrees right of straight ahead, not the raw chord's 57 degrees.
    expect(marker.offscreen).toBe(true);
    expect(marker.surfaceOccluded).toBe(true);
    expect(marker.x).toBeCloseTo(1025.25, 1);
    expect(marker.y).toBeCloseTo(70, 5);
    expect(marker.angle).toBeCloseTo(-1.034, 2);
  });

  it('uses a stable lateral icon rather than pointing down for dead astern', () => {
    const camera = cameraAt(new THREE.Vector3(0, 52, 0), new THREE.Vector3(0, 52, -10));
    const marker = projectDirectionalMarker(camera, new THREE.Vector3(0, 51, 20), {
      width: 1600,
      height: 900,
      preferredSide: -1
    });
    expect(marker.offscreen).toBe(true);
    expect(marker.x).toBeLessThan(800);
    expect(marker.y).toBeCloseTo(450, 5);
  });

  it.each(ADJACENT_FACE_PAIRS)(
    'uses the authored %s surface frame to route onto adjacent %s',
    (viewerFace, targetFace) => {
      const origin = FACE_NORMALS[viewerFace].clone().multiplyScalar(52);
      const target = FACE_NORMALS[targetFace].clone().multiplyScalar(52);
      const forward = deterministicTangentForUp(FACE_NORMALS[viewerFace], new THREE.Vector3());
      const marker = projectDirectionalMarker(cameraOnFace(viewerFace, forward), target, {
        width: 1600,
        height: 900,
        surfaceOrigin: origin,
        surfaceUp: FACE_NORMALS[viewerFace],
        surfaceForward: forward,
        targetUp: FACE_NORMALS[targetFace],
        planetRadius: 50
      });

      expect(marker.surfaceOccluded).toBe(true);
      expect(marker.offscreen).toBe(true);
      expect(marker.routeNextFace).toBe(targetFace);
      expect(Number.isFinite(marker.x)).toBe(true);
      expect(Number.isFinite(marker.y)).toBe(true);
      expect(Number.isFinite(marker.angle)).toBe(true);
    }
  );

  it.each(OPPOSITE_FACE_PAIRS)(
    'latches a stable intermediate face for opposite %s to %s travel',
    (viewerFace, targetFace) => {
      const origin = FACE_NORMALS[viewerFace].clone().multiplyScalar(52);
      const target = FACE_NORMALS[targetFace].clone().multiplyScalar(52);
      const firstForward = deterministicTangentForUp(FACE_NORMALS[viewerFace], new THREE.Vector3());
      const turnedForward = firstForward.clone().applyAxisAngle(FACE_NORMALS[viewerFace], Math.PI / 2);
      const out: DirectionalMarkerProjection = {
        x: 0,
        y: 0,
        angle: 0,
        offscreen: true,
        surfaceOccluded: true
      };
      const options = {
        width: 1600,
        height: 900,
        surfaceOrigin: origin,
        surfaceUp: FACE_NORMALS[viewerFace],
        targetUp: FACE_NORMALS[targetFace],
        planetRadius: 50
      };
      projectDirectionalMarker(cameraOnFace(viewerFace, firstForward), target, {
        ...options,
        surfaceForward: firstForward
      }, out);
      const latchedFace = out.routeNextFace;
      projectDirectionalMarker(cameraOnFace(viewerFace, turnedForward), target, {
        ...options,
        surfaceForward: turnedForward
      }, out);

      expect(latchedFace).toBeDefined();
      expect(out.routeNextFace).toBe(latchedFace);
      expect(areAdjacentFaces(viewerFace, latchedFace!)).toBe(true);
      expect(areAdjacentFaces(targetFace, latchedFace!)).toBe(true);
    }
  );

  it('reselects an antipodal route when objective ownership changes', () => {
    const viewerFace: CubeFace = 'top';
    const targetFace: CubeFace = 'bottom';
    const origin = FACE_NORMALS[viewerFace].clone().multiplyScalar(52);
    const target = FACE_NORMALS[targetFace].clone().multiplyScalar(52);
    const firstForward = new THREE.Vector3(1, 0, 0);
    const secondForward = new THREE.Vector3(0, 0, 1);
    const out: DirectionalMarkerProjection = {
      x: 0,
      y: 0,
      angle: 0,
      offscreen: true,
      surfaceOccluded: true
    };
    const options = {
      width: 1600,
      height: 900,
      surfaceOrigin: origin,
      surfaceUp: FACE_NORMALS[viewerFace],
      targetUp: FACE_NORMALS[targetFace],
      planetRadius: 50
    };

    projectDirectionalMarker(cameraOnFace(viewerFace, firstForward), target, {
      ...options,
      surfaceForward: firstForward,
      routeKey: 'objective-a'
    }, out);
    const firstRoute = out.routeNextFace;
    projectDirectionalMarker(cameraOnFace(viewerFace, secondForward), target, {
      ...options,
      surfaceForward: secondForward,
      routeKey: 'objective-b'
    }, out);

    expect(firstRoute).toBe('right');
    expect(out.routeNextFace).toBe('front');
    expect(out.routeNextFace).not.toBe(firstRoute);
    expect(out.routeKey).toBe('objective-b');
  });

  it('uses physics-owned up at an exact position tie', () => {
    const seam = new THREE.Vector3(50, 50, 0);
    const topTarget = new THREE.Vector3(0, 52, 0);
    const rightTarget = new THREE.Vector3(52, 0, 0);
    const topForward = new THREE.Vector3(1, 0, 0);
    const rightForward = new THREE.Vector3(0, 1, 0);
    const fromTop = projectDirectionalMarker(cameraOnFace('top', topForward), rightTarget, {
      width: 1600,
      height: 900,
      surfaceOrigin: seam,
      surfaceUp: FACE_NORMALS.top,
      surfaceForward: topForward,
      targetUp: FACE_NORMALS.right,
      planetRadius: 50
    });
    const fromRight = projectDirectionalMarker(cameraOnFace('right', rightForward), topTarget, {
      width: 1600,
      height: 900,
      surfaceOrigin: seam,
      surfaceUp: FACE_NORMALS.right,
      surfaceForward: rightForward,
      targetUp: FACE_NORMALS.top,
      planetRadius: 50
    });

    expect(fromTop.routeViewerFace).toBe('top');
    expect(fromTop.routeNextFace).toBe('right');
    expect(fromRight.routeViewerFace).toBe('right');
    expect(fromRight.routeNextFace).toBe('top');
  });

  it('continues across an edge after passing the inset instead of pointing backward', () => {
    const origin = new THREE.Vector3(49.2, 52, -11.43);
    const forward = new THREE.Vector3(1, 0, 0);
    const camera = cameraAt(origin, origin.clone().add(forward));
    const marker = projectDirectionalMarker(camera, new THREE.Vector3(52, -40, 40), {
      width: 1600,
      height: 900,
      margin: 70,
      surfaceOrigin: origin,
      surfaceUp: FACE_NORMALS.top,
      surfaceForward: forward,
      targetUp: FACE_NORMALS.right,
      planetRadius: 50
    });

    expect(marker.x).toBeCloseTo(800, 5);
    expect(marker.y).toBeCloseTo(70, 5);
    expect(marker.angle).toBeCloseTo(-Math.PI / 2, 5);
  });
});

describe('spatial directional marker', () => {
  const tidegarden = new THREE.Vector3(2180, -110, -1635);

  it('keeps the distant sibling bearing on the camera-space ray', () => {
    const camera = cameraAt(
      new THREE.Vector3(60, 0, 0),
      new THREE.Vector3(60, 0, -10)
    );
    const marker = projectDirectionalMarker(camera, tidegarden, {
      width: 1600,
      height: 900,
      margin: 70,
      space: 'spatial'
    });

    expect(marker.offscreen).toBe(true);
    expect(marker.surfaceOccluded).toBe(false);
    expect(marker.x).toBeGreaterThan(1500);
    expect(Math.abs(marker.y - 450)).toBeLessThan(100);
  });

  it('does not jump edges when the ship crosses a cube dominant-axis boundary', () => {
    const first = cameraAt(
      new THREE.Vector3(60, 59, 0),
      new THREE.Vector3(60, 59, -10)
    );
    const second = cameraAt(
      new THREE.Vector3(59, 60, 0),
      new THREE.Vector3(59, 60, -10)
    );
    const a = projectDirectionalMarker(first, tidegarden, {
      width: 1600,
      height: 900,
      space: 'spatial'
    }, { x: 0, y: 0, angle: 0, offscreen: true, surfaceOccluded: false });
    const b = projectDirectionalMarker(second, tidegarden, {
      width: 1600,
      height: 900,
      space: 'spatial'
    }, { x: 0, y: 0, angle: 0, offscreen: true, surfaceOccluded: false });

    expect(a.x).toBeGreaterThan(800);
    expect(b.x).toBeGreaterThan(800);
    expect(Math.abs(a.angle - b.angle)).toBeLessThan(0.01);
  });

  it('measures flight range from the live camera instead of the stale surface frame', () => {
    const camera = cameraAt(new THREE.Vector3(), new THREE.Vector3(0, 0, -10));
    const staleSurfaceOrigin = new THREE.Vector3(52, 0, 0);
    const before = directionalMarkerRange(
      camera,
      tidegarden,
      staleSurfaceOrigin,
      'spatial',
      0
    );
    camera.position.addScaledVector(tidegarden.clone().normalize(), 500);
    camera.updateMatrixWorld(true);
    const after = directionalMarkerRange(
      camera,
      tidegarden,
      staleSurfaceOrigin,
      'spatial',
      0
    );

    expect(before - after).toBeCloseTo(500, 5);
  });
});
