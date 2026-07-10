import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  SHIP_LEG_REACH,
  SHIP_LENGTH,
  SHIP_WINGSPAN,
  createCockpitFrameGeometry,
  createShipCanopyGeometry,
  createShipHullGeometry,
  shipAccentColor,
  shipHullColors,
  shipLevelOrientation,
  shipParkedOrientation
} from './shipDesign.ts';

function bounds(geo: THREE.BufferGeometry): THREE.Box3 {
  geo.computeBoundingBox();
  return geo.boundingBox!;
}

describe('shipDesign', () => {
  it('derives a deterministic planet-attuned accent that brightens when active', () => {
    const a = shipAccentColor(12345);
    const b = shipAccentColor(12345);
    const other = shipAccentColor(999);
    const active = shipAccentColor(12345, true);
    expect(a.getHex()).toBe(b.getHex());
    expect(a.getHex()).not.toBe(other.getHex());
    const hslA = { h: 0, s: 0, l: 0 };
    const hslActive = { h: 0, s: 0, l: 0 };
    a.getHSL(hslA);
    active.getHSL(hslActive);
    expect(hslActive.l).toBeGreaterThan(hslA.l);
  });

  it('builds a merged vertex-colored hull within the mini-fighter footprint', () => {
    const geo = createShipHullGeometry(shipHullColors(shipAccentColor(12345)));
    expect(geo.attributes.position.count).toBeGreaterThan(0);
    expect(geo.attributes.color.count).toBe(geo.attributes.position.count);
    expect(geo.attributes.normal.count).toBe(geo.attributes.position.count);

    const box = bounds(geo);
    // Compact one-seater: bounded by the published dimensions (+small margin).
    expect(box.max.x - box.min.x).toBeLessThanOrEqual(SHIP_LENGTH + 0.5);
    expect(box.max.z - box.min.z).toBeLessThanOrEqual(SHIP_WINGSPAN + 0.7);
    expect(box.max.x - box.min.x).toBeGreaterThan(4); // still reads as a ship, not a drone

    // The insect legs must reach (nearly) down to the touchdown surface at
    // -SHIP_LEG_REACH so the parked ship perches instead of hovering.
    expect(box.min.y).toBeLessThan(-SHIP_LEG_REACH + 0.15);
    expect(box.min.y).toBeGreaterThan(-SHIP_LEG_REACH - 0.15);
    geo.dispose();
  });

  it('builds a faceted canopy sitting over the fore hull', () => {
    const geo = createShipCanopyGeometry();
    expect(geo.attributes.position.count).toBeGreaterThan(0);
    const box = bounds(geo);
    expect(box.min.y).toBeGreaterThan(0); // above the hull centerline
    expect(box.max.x).toBeLessThan(SHIP_LENGTH / 2); // within the nose half
    geo.dispose();
  });

  it('parks the ship upright on every face of the cube planet', () => {
    const R = 55;
    const spots = [
      new THREE.Vector3(0, R, 0),   // top
      new THREE.Vector3(0, -R, 0),  // bottom — the fixed-rotation bug rendered this upside down
      new THREE.Vector3(R, 0, 0),
      new THREE.Vector3(-R, 0, 0),
      new THREE.Vector3(0, 0, R),
      new THREE.Vector3(0, 0, -R),
      new THREE.Vector3(30, -40, 12) // off-center on the bottom face
    ];
    for (const pos of spots) {
      const localUp = pos.clone().normalize();

      // Level frame: +Y maps onto the local up, -Z onto a horizon tangent.
      const level = shipLevelOrientation(pos);
      const shipUp = new THREE.Vector3(0, 1, 0).applyQuaternion(level);
      expect(shipUp.dot(localUp)).toBeGreaterThan(0.999);
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(level);
      expect(Math.abs(forward.dot(localUp))).toBeLessThan(0.001);

      // Parked exterior: hull up still local up; the +X nose lies on the horizon
      // exactly along the frame's forward (where the cockpit faced at touchdown).
      const parked = shipParkedOrientation(pos);
      const hullUp = new THREE.Vector3(0, 1, 0).applyQuaternion(parked);
      expect(hullUp.dot(localUp)).toBeGreaterThan(0.999);
      const nose = new THREE.Vector3(1, 0, 0).applyQuaternion(parked);
      expect(Math.abs(nose.dot(localUp))).toBeLessThan(0.001);
      expect(nose.dot(forward)).toBeGreaterThan(0.999);
    }
  });

  it('keeps the cockpit frame beyond the near plane and out of the view center', () => {
    const geo = createCockpitFrameGeometry(shipHullColors(shipAccentColor(12345)));
    expect(geo.attributes.color.count).toBe(geo.attributes.position.count);
    const box = bounds(geo);
    // Everything in front of the camera, beyond the near plane at z=1.
    expect(box.max.z).toBeLessThan(-1.5);
    expect(box.min.z).toBeGreaterThan(-4.5);

    // View center stays clear: no frame vertex inside a generous central disc
    // around the forward axis at mid-height.
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const inCenter = Math.abs(x) < 0.5 && Math.abs(y) < 0.45;
      expect(inCenter).toBe(false);
    }
    geo.dispose();
  });
});
