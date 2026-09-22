import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  SHIP_LEG_REACH,
  SHIP_LENGTH,
  SHIP_WINGSPAN,
  createCockpitFrameGeometry,
  createCockpitInteriorGeometry,
  createCockpitLightGeometry,
  createShipCanopyGeometry,
  createShipHullGeometry,
  shipAccentColor,
  shipHullColors,
  shipLevelOrientation,
  shipParkedOrientation,
  shipSurfaceUp
} from './shipDesign.ts';
import { createCockpitScreenGeometry } from './cockpitScreens.ts';

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

  it('parks the ship upright on the flat normal of every cube face', () => {
    const R = 55;
    const spots: Array<[THREE.Vector3, THREE.Vector3]> = [
      [new THREE.Vector3(0, R, 0), new THREE.Vector3(0, 1, 0)],
      [new THREE.Vector3(0, -R, 0), new THREE.Vector3(0, -1, 0)],
      [new THREE.Vector3(R, 0, 0), new THREE.Vector3(1, 0, 0)],
      [new THREE.Vector3(-R, 0, 0), new THREE.Vector3(-1, 0, 0)],
      [new THREE.Vector3(0, 0, R), new THREE.Vector3(0, 0, 1)],
      [new THREE.Vector3(0, 0, -R), new THREE.Vector3(0, 0, -1)],
      // Deliberately far off-center on the bottom face. Radial up would lean the
      // hull by ~39 degrees here; cube-face up must remain exactly -Y.
      [new THREE.Vector3(30, -40, 12), new THREE.Vector3(0, -1, 0)]
    ];
    for (const [pos, faceUp] of spots) {
      const localUp = shipSurfaceUp(pos);
      expect(localUp.dot(faceUp)).toBeGreaterThan(0.999);

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

  it('accepts the resolved current-face normal at an exact cube edge', () => {
    const edge = new THREE.Vector3(55, 55, 4);
    const topUp = new THREE.Vector3(0, 1, 0);

    // Dominant-axis ties have a deterministic default, but the live sticky face
    // is the stronger authority when a caller has it.
    expect(shipSurfaceUp(edge)).toEqual(new THREE.Vector3(1, 0, 0));
    expect(shipSurfaceUp(edge, topUp)).toEqual(topUp);

    const level = shipLevelOrientation(edge, topUp);
    const shipUp = new THREE.Vector3(0, 1, 0).applyQuaternion(level);
    expect(shipUp.dot(topUp)).toBeGreaterThan(0.999);

    const parked = shipParkedOrientation(edge, topUp);
    const parkedUp = new THREE.Vector3(0, 1, 0).applyQuaternion(parked);
    expect(parkedUp.dot(topUp)).toBeGreaterThan(0.999);
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

  it('authors a surface channel and bakes contact occlusion into the cabin', () => {
    const colors = shipHullColors(shipAccentColor(12345));
    const interior = createCockpitInteriorGeometry(colors);
    const frame = createCockpitFrameGeometry(colors);

    for (const geo of [interior, frame]) {
      const surface = geo.attributes.aSurf;
      expect(surface).toBeDefined();
      expect(surface.itemSize).toBe(4);
      expect(surface.count).toBe(geo.attributes.position.count);

      let minAo = 1;
      let maxAo = 0;
      const materials = new Set<number>();
      for (let i = 0; i < surface.count; i++) {
        const material = surface.getX(i);
        const ao = surface.getY(i);
        materials.add(material);
        // Every part declares a real material id and a non-zero detail scale.
        expect(material).toBeGreaterThanOrEqual(0);
        expect(material).toBeLessThanOrEqual(4);
        expect(surface.getW(i)).toBeGreaterThan(0);
        minAo = Math.min(minAo, ao);
        maxAo = Math.max(maxAo, ao);
      }
      // More than one material, and the bake actually found both open surfaces
      // and occluded ones — a uniform result means it silently did nothing.
      expect(materials.size).toBeGreaterThan(1);
      expect(maxAo).toBeGreaterThan(0.9);
      expect(minAo).toBeLessThan(0.6);
    }
    interior.dispose();
    frame.dispose();
  });

  it('builds the same cabin twice for the same seed', () => {
    const colors = shipHullColors(shipAccentColor(12345));
    const a = createCockpitInteriorGeometry(colors);
    const b = createCockpitInteriorGeometry(colors);
    expect(Array.from(a.attributes.aSurf.array))
      .toEqual(Array.from(b.attributes.aSurf.array));
    a.dispose();
    b.dispose();
  });

  it('keeps every display panel inside the cabin and off the boresight', () => {
    const geo = createCockpitScreenGeometry();
    const position = geo.attributes.position;
    const screen = geo.attributes.aScreen;
    expect(position.count).toBeGreaterThan(0);
    expect(screen.count).toBe(position.count);

    const ids = new Set<number>();
    for (let i = 0; i < position.count; i++) {
      const z = position.getZ(i);
      // In front of the pilot and beyond the flight camera's near plane at 1.
      expect(z).toBeLessThan(-1.2);
      expect(z).toBeGreaterThan(-4.2);
      // Never in the forward flight aperture: the displays flank the view.
      const inAperture = Math.abs(position.getX(i)) < 0.45
        && Math.abs(position.getY(i)) < 0.4;
      expect(inAperture).toBe(false);
      ids.add(Math.floor(screen.getX(i) + 0.5));
    }
    // Attitude, power and nav are all present; an MFD wall showing one program
    // is a texture, not an instrument panel.
    expect(ids.size).toBeGreaterThanOrEqual(4);
    geo.dispose();
  });

  it('builds a bounded ultrawide cockpit enclosure within the triangle budget', () => {
    const colors = shipHullColors(shipAccentColor(12345));
    const interior = createCockpitInteriorGeometry(colors);
    const lights = createCockpitLightGeometry(colors);
    const box = bounds(interior);
    expect(box.min.x).toBeLessThan(-5.5);
    expect(box.max.x).toBeGreaterThan(5.5);
    expect(box.max.z).toBeLessThan(-1);
    expect(interior.attributes.position.count / 3).toBeLessThan(5000);
    expect(lights.attributes.position.count / 3).toBeLessThan(500);
    interior.dispose();
    lights.dispose();
  });
});
