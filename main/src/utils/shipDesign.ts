import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FACE_NORMALS, dominantFaceForPosition } from './surfaceControls';
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
// the flight rest point ~2.5 wu above the touchdown surface
// (SHIP_GROUND_CLEARANCE in ShipController), which is exactly the stance height
// the legs are built for. Static voxel queries add the voxel half-extent first.
// =============================================================================

/** Overall dimensions (world units; player standing height is 3.6). */
export const SHIP_LENGTH = 6.6;
export const SHIP_WINGSPAN = 6.0;
/** Hull-origin height above the visible touchdown surface. */
export const SHIP_REST_CLEARANCE = 2.5;
/** Legs reach this far below the ship origin (the flight rest height). */
export const SHIP_LEG_REACH = 2.42;
/** Tail-side capsule centre: clears the 1.95wu hull tail and stays boardable. */
export const SHIP_PLAYER_EGRESS_DISTANCE = 2.5;

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
 * Resolve the flat cube-face normal supporting the ship. Callers that own a
 * sticky/resolved surface frame can pass that exact normal (important at the
 * shared edge itself); otherwise the position's dominant cube face is the
 * deterministic authority. Radial `position.normalize()` is deliberately wrong
 * here: it tilts a parked ship farther and farther off level toward a face edge.
 */
export function shipSurfaceUp(pos: THREE.Vector3, resolvedUp?: THREE.Vector3): THREE.Vector3 {
  if (resolvedUp && resolvedUp.lengthSq() > 0) return resolvedUp.clone().normalize();
  if (pos.lengthSq() === 0) return FACE_NORMALS.top.clone();
  return FACE_NORMALS[dominantFaceForPosition(pos)].clone();
}

/**
 * Upright, horizon-facing orientation at a surface position: -Z points along a
 * horizon tangent (camera convention), +Y is the supporting CUBE FACE normal.
 * The flight controller levels the ship to THIS at touchdown, so the parked
 * exterior must use the same frame.
 */
export function shipLevelOrientation(
  pos: THREE.Vector3,
  resolvedUp?: THREE.Vector3
): THREE.Quaternion {
  const up = shipSurfaceUp(pos, resolvedUp);
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
export function shipParkedOrientation(
  pos: THREE.Vector3,
  resolvedUp?: THREE.Vector3
): THREE.Quaternion {
  return shipLevelOrientation(pos, resolvedUp).multiply(
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)
  );
}

/** Safe on-foot spawn offset behind the parked hull, tangent to its surface. */
export function shipPlayerEgressOffset(
  pos: THREE.Vector3,
  resolvedUp?: THREE.Vector3
): THREE.Vector3 {
  return new THREE.Vector3(-1, 0, 0)
    .applyQuaternion(shipParkedOrientation(pos, resolvedUp))
    .setLength(SHIP_PLAYER_EGRESS_DISTANCE);
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

    // Controls animate separately in ShipCockpit so this merged draw stays static.
  ];

  const geo = mergeGeometries(parts, false);
  if (!geo) throw new Error('Failed to merge cockpit frame geometry');
  geo.computeVertexNormals();
  return geo;
}

/**
 * Broad camera-space cockpit tub. Large faceted walls own the peripheral view
 * on ultrawide screens while the forward aperture remains unobstructed.
 */
export function createCockpitInteriorGeometry(colors: ShipHullColors): THREE.BufferGeometry {
  const cabinDark = lin(0x202b38);
  const cabinMid = lin(0x4d6074);
  const cabinLight = lin(0x91a2b2);
  const inset = lin(0x101820);
  const parts: THREE.BufferGeometry[] = [
    // Sectioned pressure shell. The middle gap becomes a narrow peripheral
    // window instead of an undifferentiated black sidewall.
    box(-5.05, 0, -2.65, 1.75, 3.65, 1.65, cabinDark, 0, -0.08, -0.04),
    box(5.05, 0, -2.65, 1.75, 3.65, 1.65, cabinDark, 0, 0.08, 0.04),
    box(-3.45, 1.38, -2.58, 2.15, 0.92, 1.55, cabinDark, 0, -0.1, -0.08),
    box(3.45, 1.38, -2.58, 2.15, 0.92, 1.55, cabinDark, 0, 0.1, 0.08),
    box(-3.5, -1.18, -2.38, 2.35, 1.18, 1.8, cabinDark, 0, -0.08, 0.05),
    box(3.5, -1.18, -2.38, 2.35, 1.18, 1.8, cabinDark, 0, 0.08, -0.05),
    box(0, 2.03, -2.78, 8.25, 0.62, 1.55, cabinDark, -0.04),
    box(0, -1.8, -2.42, 8.45, 0.76, 1.9, cabinDark, 0.07),

    // Layered canopy hinges and sill ribs establish scale without blocking view.
    beam(new THREE.Vector3(-2.04, 1.58, -3.48), new THREE.Vector3(-3.25, 1.84, -2.25), 0.13, cabinLight),
    beam(new THREE.Vector3(2.04, 1.58, -3.48), new THREE.Vector3(3.25, 1.84, -2.25), 0.13, cabinLight),
    beam(new THREE.Vector3(-2.05, -1.02, -2.6), new THREE.Vector3(-3.55, -1.58, -1.82), 0.14, cabinMid),
    beam(new THREE.Vector3(2.05, -1.02, -2.6), new THREE.Vector3(3.55, -1.58, -1.82), 0.14, cabinMid),
    beam(new THREE.Vector3(-4.15, 0.72, -1.83), new THREE.Vector3(-4.15, -0.38, -1.67), 0.11, cabinLight),
    beam(new THREE.Vector3(4.15, 0.72, -1.83), new THREE.Vector3(4.15, -0.38, -1.67), 0.11, cabinLight),

    // Recessed acoustic panels, small enough to read as trim rather than wings.
    box(-3.0, 0.02, -1.74, 0.62, 1.48, 0.11, inset, 0, -0.12, -0.05),
    box(3.0, 0.02, -1.74, 0.62, 1.48, 0.11, inset, 0, 0.12, 0.05),
    box(-4.78, 0.06, -1.88, 0.75, 1.72, 0.1, inset, 0, -0.08),
    box(4.78, 0.06, -1.88, 0.75, 1.72, 0.1, inset, 0, 0.08),

    // Deep side consoles, central seat tub and overhead avionics cassette.
    box(-2.38, -1.17, -1.92, 1.48, 0.34, 1.25, cabinMid, 0.1, 0.18, 0.06),
    box(2.38, -1.17, -1.92, 1.48, 0.34, 1.25, cabinMid, 0.1, -0.18, -0.06),
    box(0, 1.61, -2.13, 2.65, 0.32, 0.68, cabinMid, -0.08),
    box(0, 1.48, -1.76, 1.72, 0.13, 0.12, inset, -0.08),
    box(0, -1.43, -1.55, 1.3, 0.5, 0.82, inset, 0.16),

    // Panel seams and latch rails add a second readable scale to the silhouette.
    beam(new THREE.Vector3(-5.5, 1.16, -2.12), new THREE.Vector3(-4.45, 0.98, -1.82), 0.055, cabinLight),
    beam(new THREE.Vector3(5.5, 1.16, -2.12), new THREE.Vector3(4.45, 0.98, -1.82), 0.055, cabinLight),
    beam(new THREE.Vector3(-5.5, -0.94, -2.05), new THREE.Vector3(-4.42, -0.8, -1.75), 0.05, colors.accent),
    beam(new THREE.Vector3(5.5, -0.94, -2.05), new THREE.Vector3(4.42, -0.8, -1.75), 0.05, colors.accent)
  ];
  const geo = mergeGeometries(parts, false);
  if (!geo) throw new Error('Failed to merge cockpit interior geometry');
  // Keep even the rotated floor corners safely beyond the flight camera near=1.
  geo.translate(0, 0, -0.22);
  geo.computeVertexNormals();
  return geo;
}

/** One merged emissive rail draw used for engine and avionics reflections. */
export function createCockpitLightGeometry(colors: ShipHullColors): THREE.BufferGeometry {
  const amber = lin(0xff9a47);
  const parts = [
    beam(new THREE.Vector3(-5.25, -0.76, -1.53), new THREE.Vector3(-4.35, -0.66, -1.36), 0.04, colors.accent),
    beam(new THREE.Vector3(5.25, -0.76, -1.53), new THREE.Vector3(4.35, -0.66, -1.36), 0.04, amber),
    beam(new THREE.Vector3(-3.28, 0.58, -1.4), new THREE.Vector3(-3.28, -0.25, -1.29), 0.035, colors.accent),
    beam(new THREE.Vector3(3.28, 0.58, -1.4), new THREE.Vector3(3.28, -0.25, -1.29), 0.035, amber),
    beam(new THREE.Vector3(-1.18, 1.46, -1.73), new THREE.Vector3(-0.22, 1.46, -1.73), 0.032, colors.accent),
    beam(new THREE.Vector3(0.22, 1.46, -1.73), new THREE.Vector3(1.18, 1.46, -1.73), 0.032, amber),
    box(-2.28, -1.01, -1.28, 0.72, 0.038, 0.045, colors.accent, 0.16, 0.1),
    box(2.28, -1.01, -1.28, 0.72, 0.038, 0.045, amber, 0.16, -0.1),
    box(-0.62, 1.43, -1.62, 0.18, 0.045, 0.045, colors.accent),
    box(0.62, 1.43, -1.62, 0.18, 0.045, 0.045, amber),
    // Side-panel status ladders and dash annunciators.
    box(-3.0, 0.36, -1.49, 0.38, 0.026, 0.025, colors.accent),
    box(-3.0, 0.24, -1.49, 0.28, 0.026, 0.025, colors.accent),
    box(-3.0, 0.12, -1.49, 0.18, 0.026, 0.025, colors.accent),
    box(3.0, 0.36, -1.49, 0.38, 0.026, 0.025, amber),
    box(3.0, 0.24, -1.49, 0.28, 0.026, 0.025, amber),
    box(3.0, 0.12, -1.49, 0.18, 0.026, 0.025, amber),
    box(-1.08, -0.84, -2.33, 0.32, 0.028, 0.025, colors.accent, 0.28),
    box(1.08, -0.84, -2.33, 0.32, 0.028, 0.025, amber, 0.28)
  ];
  const geo = mergeGeometries(parts, false);
  if (!geo) throw new Error('Failed to merge cockpit light geometry');
  geo.computeVertexNormals();
  return geo;
}
