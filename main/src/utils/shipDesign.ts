import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { seededUnit } from './worldCoordinates';

// =============================================================================
// SHIP DESIGN — the player's mini starfighter ("Kestrel").
//
// A compact one-seater in this game's own visual language rather than a realist
// spacecraft: HEX-FACETED everything (hexagonal cross-sections + flat shading,
// echoing the crystalline low-poly world), swept delta wings with upturned
// accent tip-fins, twin under-wing thruster nacelles, a faceted crystal canopy —
// and instead of hovering over its landing clearance, it PERCHES on four tall
// kinked insect legs, borrowing the fauna silhouette. The accent color attunes
// to each planet's seed (same hue family the placeholder used).
//
// Local axes: +X = nose, +Y = up, +Z = starboard. The parked ship's origin is
// the flight rest point ~2.5 wu above the touchdown voxel (SHIP_GROUND_CLEARANCE
// in ShipController), which is exactly the stance height the legs are built for.
// =============================================================================

/** Overall dimensions (world units; player standing height is 3.6). */
export const SHIP_LENGTH = 6.6;
export const SHIP_WINGSPAN = 6.0;
/** Legs reach this far below the ship origin (the flight rest height). */
export const SHIP_LEG_REACH = 2.42;

export interface ShipHullColors {
  light: THREE.Color;
  mid: THREE.Color;
  dark: THREE.Color;
  accent: THREE.Color;
}

function lin(hex: number): THREE.Color {
  return new THREE.Color(hex).convertSRGBToLinear();
}

/** Fixed hull identity; only the accent varies per planet. */
export function shipHullColors(accent: THREE.Color): ShipHullColors {
  return {
    light: lin(0xe6eaf1),
    mid: lin(0xb3bcc9),
    dark: lin(0x4a5464),
    accent
  };
}

/**
 * Upright, horizon-facing orientation at a surface position: -Z points along a
 * horizon tangent (camera convention), +Y is local up (away from the planet
 * center). The flight controller levels the ship to THIS at touchdown, so the
 * parked exterior must use the same frame — a fixed world-space rotation is
 * upside down on the bottom face and sideways on the walls of the cube planet.
 */
export function shipLevelOrientation(pos: THREE.Vector3): THREE.Quaternion {
  const up = pos.clone().normalize();
  let ref = new THREE.Vector3(0, 0, 1);
  if (Math.abs(up.dot(ref)) > 0.9) ref = new THREE.Vector3(1, 0, 0);
  const forward = new THREE.Vector3().crossVectors(ref, up).normalize();
  const m = new THREE.Matrix4().lookAt(new THREE.Vector3(), forward, up);
  return new THREE.Quaternion().setFromRotationMatrix(m);
}

/**
 * Full parked-exterior orientation: the level frame above, plus the local twist
 * mapping the hull's +X nose onto the frame's -Z forward — so the exterior
 * points exactly where the cockpit was facing when you set down.
 */
export function shipParkedOrientation(pos: THREE.Vector3): THREE.Quaternion {
  return shipLevelOrientation(pos).multiply(
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)
  );
}

/**
 * Planet-attuned accent (same seeded cyan-blue family the placeholder used, so
 * saves/screenshots keep their hue identity). `active` brightens it while an
 * approach highlight is on.
 */
export function shipAccentColor(terrainSeed: number, active = false): THREE.Color {
  const hue = 0.52 + seededUnit(terrainSeed, 73) * 0.12;
  return new THREE.Color().setHSL(hue, 0.72, active ? 0.62 : 0.48).convertSRGBToLinear();
}

// -----------------------------------------------------------------------------
// Geometry helpers — every part is non-indexed with a per-vertex color so the
// whole hull merges into ONE flat-shaded draw.
// -----------------------------------------------------------------------------

const _v = new THREE.Vector3();

function paint(geo: THREE.BufferGeometry, color: THREE.Color): THREE.BufferGeometry {
  const work = geo.index ? geo.toNonIndexed() : geo;
  work.deleteAttribute('uv');
  work.computeVertexNormals();
  const pos = work.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  work.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return work;
}

/** Hexagonal frustum along +X: radius r0 at x0 -> r1 at x1 (the hull motif). */
function hexSection(x0: number, r0: number, x1: number, r1: number, color: THREE.Color, y = 0): THREE.BufferGeometry {
  const length = Math.abs(x1 - x0);
  const geo = new THREE.CylinderGeometry(r1, r0, length, 6, 1, false);
  geo.rotateZ(-Math.PI / 2); // cylinder +Y axis -> +X
  geo.translate((x0 + x1) / 2, y, 0);
  return paint(geo, color);
}

function box(
  cx: number, cy: number, cz: number,
  sx: number, sy: number, sz: number,
  color: THREE.Color,
  rx = 0, ry = 0, rz = 0
): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(sx, sy, sz);
  geo.rotateX(rx);
  geo.rotateY(ry);
  geo.rotateZ(rz);
  geo.translate(cx, cy, cz);
  return paint(geo, color);
}

function beam(a: THREE.Vector3, b: THREE.Vector3, thickness: number, color: THREE.Color): THREE.BufferGeometry {
  const dir = _v.copy(b).sub(a);
  const len = Math.max(0.001, dir.length());
  const geo = new THREE.BoxGeometry(thickness, len, thickness);
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  geo.applyQuaternion(quat);
  geo.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return paint(geo, color);
}

/** Flat double-face sheet from 4 corners (wings/fins), colored per vertex. */
function sheet(
  corners: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3],
  color: THREE.Color
): THREE.BufferGeometry {
  const [a, b, c, d] = corners;
  const positions = new Float32Array([
    // top winding
    a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z,
    a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z,
    // bottom winding (reversed) so the sheet is solid from both sides
    a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z,
    a.x, a.y, a.z, d.x, d.y, d.z, c.x, c.y, c.z
  ]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return paint(geo, color);
}

/** Kinked insect leg: hip -> knee (out+down) -> foot, with a foot pad. */
function insectLeg(
  hip: THREE.Vector3,
  spreadZ: number,
  spreadX: number,
  color: THREE.Color
): THREE.BufferGeometry[] {
  const knee = hip.clone().add(new THREE.Vector3(spreadX * 0.4, -SHIP_LEG_REACH * 0.42 - hip.y * 0.5, spreadZ * 0.85));
  const foot = new THREE.Vector3(hip.x + spreadX, -SHIP_LEG_REACH + 0.06, hip.z + spreadZ * 1.45);
  return [
    beam(hip, knee, 0.09, color),
    beam(knee, foot, 0.07, color),
    box(foot.x, foot.y - 0.03, foot.z, 0.3, 0.07, 0.22, color)
  ];
}

// -----------------------------------------------------------------------------
// Exterior hull (one merged flat-shaded geometry)
// -----------------------------------------------------------------------------

export function createShipHullGeometry(colors: ShipHullColors): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [
    // Fuselage: nose spike -> fore hull -> aft hull -> engine flare, all hex.
    hexSection(2.1, 0.13, 3.3, 0.02, colors.light, 0.05),
    hexSection(1.05, 0.38, 2.1, 0.13, colors.light, 0.02),
    hexSection(0.2, 0.52, 1.05, 0.38, colors.light),
    hexSection(-1.3, 0.44, 0.2, 0.52, colors.mid),
    hexSection(-1.72, 0.5, -1.3, 0.44, colors.dark),
    // Dorsal spine ridge.
    box(-0.35, 0.5, 0, 1.9, 0.14, 0.16, colors.dark),
    // Chin intake wedge.
    box(0.9, -0.34, 0, 1.0, 0.2, 0.34, colors.mid),

    // Delta wings, swept back with slight anhedral.
    sheet([
      new THREE.Vector3(0.55, 0.05, 0.4),
      new THREE.Vector3(-0.95, 0.02, 0.46),
      new THREE.Vector3(-1.55, -0.16, 3.0),
      new THREE.Vector3(-0.45, -0.13, 3.0)
    ], colors.mid),
    sheet([
      new THREE.Vector3(0.55, 0.05, -0.4),
      new THREE.Vector3(-0.95, 0.02, -0.46),
      new THREE.Vector3(-1.55, -0.16, -3.0),
      new THREE.Vector3(-0.45, -0.13, -3.0)
    ], colors.mid),
    // Upturned wingtip fins (the dragonfly gesture), accent-edged.
    sheet([
      new THREE.Vector3(-0.45, -0.13, 3.0),
      new THREE.Vector3(-1.55, -0.16, 3.0),
      new THREE.Vector3(-1.35, 0.62, 3.28),
      new THREE.Vector3(-0.75, 0.55, 3.24)
    ], colors.accent),
    sheet([
      new THREE.Vector3(-0.45, -0.13, -3.0),
      new THREE.Vector3(-1.55, -0.16, -3.0),
      new THREE.Vector3(-1.35, 0.62, -3.28),
      new THREE.Vector3(-0.75, 0.55, -3.24)
    ], colors.accent),

    // Tail fin with a swept trailing edge.
    sheet([
      new THREE.Vector3(-0.55, 0.5, 0),
      new THREE.Vector3(-1.62, 0.42, 0),
      new THREE.Vector3(-1.95, 1.25, 0),
      new THREE.Vector3(-1.35, 1.15, 0)
    ], colors.mid),

    // Nacelle intake lips (accent).
    box(0.32, -0.14, 1.05, 0.1, 0.34, 0.34, colors.accent),
    box(0.32, -0.14, -1.05, 0.1, 0.34, 0.34, colors.accent)
  ];

  // Under-wing thruster nacelles (hex) at their spanwise stations.
  for (const side of [1, -1]) {
    const nacelle = hexSection(-1.05, 0.19, 0.25, 0.16, colors.dark, -0.14);
    nacelle.translate(0, 0, side * 1.05);
    parts.push(nacelle);
  }

  // Four perched insect legs (front pair shorter spread, rear pair wider).
  parts.push(...insectLeg(new THREE.Vector3(0.85, -0.3, 0.28), 0.55, 0.35, colors.dark));
  parts.push(...insectLeg(new THREE.Vector3(0.85, -0.3, -0.28), -0.55, 0.35, colors.dark));
  parts.push(...insectLeg(new THREE.Vector3(-0.95, -0.28, 0.3), 0.75, -0.3, colors.dark));
  parts.push(...insectLeg(new THREE.Vector3(-0.95, -0.28, -0.3), -0.75, -0.3, colors.dark));

  const geo = mergeGeometries(parts, false);
  if (!geo) throw new Error('Failed to merge ship hull geometry');
  geo.computeVertexNormals();
  return geo;
}

/** Faceted crystal canopy bubble (rendered as a separate transparent mesh). */
export function createShipCanopyGeometry(): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1, 0);
  geo.scale(0.72, 0.42, 0.5);
  geo.translate(0.72, 0.52, 0);
  geo.computeVertexNormals();
  return geo;
}

// -----------------------------------------------------------------------------
// Cockpit frame (one merged flat-shaded geometry, camera space, z negative)
// -----------------------------------------------------------------------------

/**
 * Hexagonal canopy rim + dashboard, authored in CAMERA space: everything sits at
 * z in [-2.2 .. -3.8] (near plane is 1) and hugs the frustum edges so the view
 * center stays clear. Emissive instruments are separate meshes (ShipCockpit).
 */
export function createCockpitFrameGeometry(colors: ShipHullColors): THREE.BufferGeometry {
  const t = 0.13;
  const topY = 1.62;
  const midY = 0.28;
  const dashY = -0.98;
  const parts: THREE.BufferGeometry[] = [
    // Hex rim: top bar, upper diagonals, lower diagonals down to the dash corners.
    beam(new THREE.Vector3(-1.05, topY, -3.5), new THREE.Vector3(1.05, topY, -3.5), t, colors.dark),
    beam(new THREE.Vector3(-1.05, topY, -3.5), new THREE.Vector3(-2.05, midY, -3.1), t, colors.dark),
    beam(new THREE.Vector3(1.05, topY, -3.5), new THREE.Vector3(2.05, midY, -3.1), t, colors.dark),
    beam(new THREE.Vector3(-2.05, midY, -3.1), new THREE.Vector3(-1.5, dashY, -2.6), t, colors.dark),
    beam(new THREE.Vector3(2.05, midY, -3.1), new THREE.Vector3(1.5, dashY, -2.6), t, colors.dark),

    // Dashboard: shallow-V of three slabs closing the hex at the bottom.
    box(0, -1.12, -2.55, 1.7, 0.42, 0.5, colors.dark, 0.42),
    box(-1.28, -1.06, -2.72, 1.35, 0.4, 0.5, colors.dark, 0.42, 0.42, 0),
    box(1.28, -1.06, -2.72, 1.35, 0.4, 0.5, colors.dark, 0.42, -0.42, 0),
    // Center binnacle the holo ring floats above.
    box(0, -0.86, -2.42, 0.56, 0.16, 0.3, colors.mid, 0.5),
    // Side sills closing the lower peripheral gaps.
    box(-2.0, -0.7, -2.7, 0.5, 1.1, 0.9, colors.dark, 0, 0.5, 0.15),
    box(2.0, -0.7, -2.7, 0.5, 1.1, 0.9, colors.dark, 0, -0.5, -0.15),
    // Overhead spine stub with the status-light housing.
    box(0, 1.52, -2.7, 0.5, 0.12, 1.1, colors.dark, -0.12),

    // Control stick (starboard) and throttle lever (port), silhouetted low.
    beam(new THREE.Vector3(0.95, -1.32, -2.2), new THREE.Vector3(0.86, -0.78, -2.3), 0.07, colors.mid),
    box(0.84, -0.72, -2.32, 0.13, 0.13, 0.13, colors.accent),
    beam(new THREE.Vector3(-0.95, -1.3, -2.25), new THREE.Vector3(-1.02, -0.92, -2.42), 0.09, colors.mid),
    box(-1.03, -0.88, -2.44, 0.2, 0.09, 0.12, colors.mid)
  ];

  const geo = mergeGeometries(parts, false);
  if (!geo) throw new Error('Failed to merge cockpit frame geometry');
  geo.computeVertexNormals();
  return geo;
}
