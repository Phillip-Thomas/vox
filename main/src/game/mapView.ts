import { useSyncExternalStore } from 'react';
import * as THREE from 'three';

// --- The survey chart (map view) ------------------------------------------------------
//
// [M] swaps the live camera to a straight-down overhead of the current face —
// the top-down NAV VIEW from the story's ch1-nav era, retained as a tool. Not a
// minimap texture: the REAL world, rendered from above (the map IS the
// territory here, which the Authority would hate). Story saves unlock it by
// completing the nav rung; pure sandbox saves always have it.

let open = false;
const listeners = new Set<() => void>();

export function isMapViewOpen(): boolean {
  return open;
}

export function setMapViewOpen(next: boolean): void {
  if (open === next) return;
  open = next;
  for (const listener of listeners) listener();
}

export function toggleMapView(): void {
  setMapViewOpen(!open);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): boolean {
  return open;
}

export function useMapViewOpen(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Camera height of the chart view (world units above the player). */
export const MAP_VIEW_HEIGHT = 46;

// --- Chart orientation: the rolling frame -------------------------------------
//
// Screen-up for the chart is a persistent face tangent that parallel-transports
// ("rolls") across cube edges: walk off the top of the chart and the next face
// scrolls in ahead while the face you left sits at screen-bottom. Cube edges are
// axis-aligned, so the rolled frame stays axis-aligned on every face. The SAME
// frame is the map-mode movement basis (W = screen-up), so controls never flip
// when the face changes mid-walk. Module-level (not React) — shared by
// CameraControls (view) and EfficientPlayer (movement).

const _chartLastUp = new THREE.Vector3(0, 0, 0); // zero-length = uninitialized
const _chartScreenUp = new THREE.Vector3(0, 0, -1);
const _chartRot = new THREE.Quaternion();
const _chartUpNorm = new THREE.Vector3();

function canonicalChartTangent(up: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
  const upIsY = Math.abs(up.y) >= Math.abs(up.x) && Math.abs(up.y) >= Math.abs(up.z);
  out.set(0, upIsY ? 0 : 1, upIsY ? -1 : 0);
  out.addScaledVector(up, -out.dot(up));
  if (out.lengthSq() < 1e-6) out.set(1, 0, 0);
  return out.normalize();
}

// After a roll between settled (axis) ups the tangent is axis-aligned up to
// float error — snap it exact so drift never accumulates across many edges.
// A mid-transition up (smooth-gravity experiments) fails the 0.999 gate and
// passes through untouched.
function snapAxisAligned(v: THREE.Vector3): void {
  const ax = Math.abs(v.x), ay = Math.abs(v.y), az = Math.abs(v.z);
  const max = Math.max(ax, ay, az);
  if (max < 0.999) return;
  v.set(ax === max ? Math.sign(v.x) : 0, ay === max ? Math.sign(v.y) : 0, az === max ? Math.sign(v.z) : 0);
}

/**
 * The chart's screen-up for the given surface up, rolling across face changes.
 * Idempotent per up — safe to call every frame from multiple systems (the
 * transport only fires when `up` actually changes). Returns a SHARED vector:
 * copy it, never mutate it.
 */
export function syncChartScreenUp(up: THREE.Vector3): THREE.Vector3 {
  _chartUpNorm.copy(up).normalize();
  if (_chartLastUp.lengthSq() < 0.5) {
    canonicalChartTangent(_chartUpNorm, _chartScreenUp);
  } else {
    const dot = _chartLastUp.dot(_chartUpNorm);
    if (dot < -0.9999) {
      // Opposite face with no edge travelled (teleport/tunnel-through): there
      // is no unique roll — fall back to the canonical alignment.
      canonicalChartTangent(_chartUpNorm, _chartScreenUp);
    } else if (dot < 0.9999) {
      _chartRot.setFromUnitVectors(_chartLastUp, _chartUpNorm);
      _chartScreenUp.applyQuaternion(_chartRot);
      snapAxisAligned(_chartScreenUp);
    }
  }
  _chartLastUp.copy(_chartUpNorm);
  // Re-project so the frame stays exactly tangent whatever error crept in.
  _chartScreenUp.addScaledVector(_chartUpNorm, -_chartScreenUp.dot(_chartUpNorm));
  if (_chartScreenUp.lengthSq() < 1e-6) canonicalChartTangent(_chartUpNorm, _chartScreenUp);
  _chartScreenUp.normalize();
  return _chartScreenUp;
}

/** Forget the rolled frame (respawn) — the next sync re-canonicalizes. */
export function resetChartFrame(): void {
  _chartLastUp.set(0, 0, 0);
}
