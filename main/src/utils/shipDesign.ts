import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FACE_NORMALS, dominantFaceForPosition } from './surfaceControls';
import { seededUnit } from './worldCoordinates';
import {
  SURFACE_COMPOSITE,
  SURFACE_INSET,
  SURFACE_METAL,
  SURFACE_PAD,
  SURFACE_TRIM
} from './cockpitSurface';

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
// Cockpit surface authoring
//
// Every cockpit part carries a four-channel `aSurf` attribute that the shared
// cockpit shader (utils/cockpitSurface.ts) reads instead of a texture set:
// which material it is, how occluded it is, a per-part variation seed, and the
// object-space frequency of its procedural panelling. Authoring it here — next
// to the geometry — keeps the two in step; a part cannot be added without
// saying what it is made of.
// -----------------------------------------------------------------------------

export interface SurfaceSpec {
  /** SURFACE_* material id from utils/cockpitSurface.ts. */
  mat: number;
  /** Object-space panel/seam frequency. Small parts want a higher number. */
  scale: number;
}

const S_PANEL: SurfaceSpec = { mat: SURFACE_COMPOSITE, scale: 1.15 };
const S_METAL: SurfaceSpec = { mat: SURFACE_METAL, scale: 2.6 };
const S_INSET: SurfaceSpec = { mat: SURFACE_INSET, scale: 3.6 };
const S_TRIM: SurfaceSpec = { mat: SURFACE_TRIM, scale: 5.0 };
const S_PAD: SurfaceSpec = { mat: SURFACE_PAD, scale: 6.0 };

let surfaceSeedCounter = 0;

/**
 * Reset the per-part variation sequence. Every builder calls this first so the
 * same seed always produces the same panel breakup: a module-level counter that
 * kept running across builds would make the cabin's finish depend on how many
 * cockpits had been built before it, which is exactly the kind of drift that
 * makes a screenshot diff meaningless.
 */
function beginSurfaceAssembly(): void {
  surfaceSeedCounter = 0;
}

/**
 * Tag a part with its surface identity. AO starts open and is replaced by the
 * bake below once the whole assembly is known — a part cannot know what
 * shadows it until it has neighbours.
 */
function surf(geo: THREE.BufferGeometry, spec: SurfaceSpec): THREE.BufferGeometry {
  const count = (geo.attributes.position as THREE.BufferAttribute).count;
  const data = new Float32Array(count * 4);
  const seed = (surfaceSeedCounter = (surfaceSeedCounter * 1103515245 + 12345) & 0x7fffffff)
    / 0x7fffffff;
  for (let i = 0; i < count; i++) {
    data[i * 4] = spec.mat;
    data[i * 4 + 1] = 1;
    data[i * 4 + 2] = seed;
    data[i * 4 + 3] = spec.scale;
  }
  geo.setAttribute('aSurf', new THREE.BufferAttribute(data, 4));
  return geo;
}

// Cosine-ish hemisphere taps in tangent space (+Z = surface normal). Six is
// enough: this bake is for contact darkening and crevice grime, not GI.
const AO_TAPS: Array<[number, number, number]> = [
  [0, 0, 1],
  [0.62, 0, 0.78],
  [-0.62, 0, 0.78],
  [0, 0.62, 0.78],
  [0, -0.62, 0.78],
  [0.45, 0.45, 0.77]
];
const AO_MAX_DISTANCE = 2.4;

/** Slab test: distance to the first entry into `box`, or -1 for a miss. */
function rayBox(
  ox: number, oy: number, oz: number,
  dx: number, dy: number, dz: number,
  box: THREE.Box3
): number {
  let tmin = 0;
  let tmax = AO_MAX_DISTANCE;
  // X
  if (Math.abs(dx) < 1e-8) {
    if (ox < box.min.x || ox > box.max.x) return -1;
  } else {
    const inv = 1 / dx;
    let t0 = (box.min.x - ox) * inv;
    let t1 = (box.max.x - ox) * inv;
    if (t0 > t1) { const s = t0; t0 = t1; t1 = s; }
    tmin = Math.max(tmin, t0);
    tmax = Math.min(tmax, t1);
    if (tmin > tmax) return -1;
  }
  // Y
  if (Math.abs(dy) < 1e-8) {
    if (oy < box.min.y || oy > box.max.y) return -1;
  } else {
    const inv = 1 / dy;
    let t0 = (box.min.y - oy) * inv;
    let t1 = (box.max.y - oy) * inv;
    if (t0 > t1) { const s = t0; t0 = t1; t1 = s; }
    tmin = Math.max(tmin, t0);
    tmax = Math.min(tmax, t1);
    if (tmin > tmax) return -1;
  }
  // Z
  if (Math.abs(dz) < 1e-8) {
    if (oz < box.min.z || oz > box.max.z) return -1;
  } else {
    const inv = 1 / dz;
    let t0 = (box.min.z - oz) * inv;
    let t1 = (box.max.z - oz) * inv;
    if (t0 > t1) { const s = t0; t0 = t1; t1 = s; }
    tmin = Math.max(tmin, t0);
    tmax = Math.min(tmax, t1);
    if (tmin > tmax) return -1;
  }
  return tmin;
}

/**
 * Bake per-vertex ambient occlusion into `aSurf.y` by tracing a short hemisphere
 * of rays against the assembly's own part boxes.
 *
 * This is the change that makes the cabin read as a built volume rather than a
 * lit diagram: corners go dark, undersides of consoles go dark, the recess
 * behind every rib goes dark, and the shader then pools grime in exactly those
 * places. It runs once per merged geometry (memoised by the caller), and it
 * dedupes by quantised position + face so a flat-shaded box costs 6 traces
 * rather than 36.
 */
function bakeAmbientOcclusion(
  geo: THREE.BufferGeometry,
  occluders: THREE.Box3[],
  strength = 0.85
): void {
  const position = geo.attributes.position as THREE.BufferAttribute;
  const normal = geo.attributes.normal as THREE.BufferAttribute;
  const surface = geo.attributes.aSurf as THREE.BufferAttribute;
  if (!position || !normal || !surface) return;

  const cache = new Map<string, number>();
  const tangent = new THREE.Vector3();
  const bitangent = new THREE.Vector3();
  const n = new THREE.Vector3();
  const helper = new THREE.Vector3();

  for (let i = 0; i < position.count; i++) {
    const px = position.getX(i);
    const py = position.getY(i);
    const pz = position.getZ(i);
    n.set(normal.getX(i), normal.getY(i), normal.getZ(i));
    if (n.lengthSq() < 1e-8) continue;
    n.normalize();

    // Quantise to 5cm and to the normal's octant: flat-shaded parts collapse to
    // a handful of distinct traces.
    const key = `${Math.round(px * 20)},${Math.round(py * 20)},${Math.round(pz * 20)},`
      + `${Math.round(n.x * 4)},${Math.round(n.y * 4)},${Math.round(n.z * 4)}`;
    let ao = cache.get(key);

    if (ao === undefined) {
      helper.set(Math.abs(n.y) > 0.9 ? 1 : 0, Math.abs(n.y) > 0.9 ? 0 : 1, 0);
      tangent.crossVectors(helper, n).normalize();
      bitangent.crossVectors(n, tangent);

      // Lift off the surface so a part never occludes itself at t=0.
      const ox = px + n.x * 0.02;
      const oy = py + n.y * 0.02;
      const oz = pz + n.z * 0.02;

      let occlusion = 0;
      for (const tap of AO_TAPS) {
        const dx = tangent.x * tap[0] + bitangent.x * tap[1] + n.x * tap[2];
        const dy = tangent.y * tap[0] + bitangent.y * tap[1] + n.y * tap[2];
        const dz = tangent.z * tap[0] + bitangent.z * tap[1] + n.z * tap[2];
        let nearest = -1;
        for (let b = 0; b < occluders.length; b++) {
          const hit = rayBox(ox, oy, oz, dx, dy, dz, occluders[b]);
          if (hit >= 0.03 && (nearest < 0 || hit < nearest)) nearest = hit;
        }
        // Near contacts darken hard, distant ones barely at all.
        if (nearest >= 0) occlusion += 1 - nearest / AO_MAX_DISTANCE;
      }
      ao = Math.max(0.16, 1 - (occlusion / AO_TAPS.length) * strength);
      cache.set(key, ao);
    }

    surface.setY(i, ao);
  }
  surface.needsUpdate = true;
}

/** Bounding boxes of the parts, used as the AO bake's occluder set. */
function occluderBoxes(parts: THREE.BufferGeometry[]): THREE.Box3[] {
  const boxes: THREE.Box3[] = [];
  for (const part of parts) {
    part.computeBoundingBox();
    const box = part.boundingBox;
    // Skip zero-thickness sheets and hair-thin trim: they occlude nothing
    // meaningful and only cost trace time.
    if (!box) continue;
    const size = box.getSize(new THREE.Vector3());
    if (size.x * size.y * size.z < 0.0008) continue;
    boxes.push(box.clone());
  }
  return boxes;
}

/** Merge a tagged part list, bake its contact occlusion, and hand it over. */
function assemble(parts: THREE.BufferGeometry[], label: string): THREE.BufferGeometry {
  const boxes = occluderBoxes(parts);
  const geo = mergeGeometries(parts, false);
  if (!geo) throw new Error(`Failed to merge ${label} geometry`);
  geo.computeVertexNormals();
  bakeAmbientOcclusion(geo, boxes);
  return geo;
}

// -----------------------------------------------------------------------------
// Cockpit frame (one merged geometry, camera space, z negative)
// -----------------------------------------------------------------------------

/**
 * Canopy rim, glareshield and dashboard structure, authored in CAMERA space:
 * everything sits at z in [-1.6 .. -3.8] (near plane is 1) and hugs the frustum
 * edges so the view center stays clear.
 *
 * The rim is built as a chamfered assembly rather than a single bar — a rolled
 * outer edge, a machined inner lip, and a raised seal channel between them. A
 * canopy rim is the closest structure to the pilot's eye and the one the light
 * rakes across, so it is where a flat box is most obvious and where three
 * layers of shape buy the most.
 */
export function createCockpitFrameGeometry(colors: ShipHullColors): THREE.BufferGeometry {
  beginSurfaceAssembly();
  const t = 0.13;
  const topY = 1.62;
  const midY = 0.28;
  const dashY = -0.98;
  const seal = lin(0x1c242e);
  const rimMetal = lin(0x9aa5b2);

  /** Rolled rim member: structural bar + inner machined lip + seal channel. */
  const rimRun = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    inward: THREE.Vector3
  ): THREE.BufferGeometry[] => {
    const lipA = a.clone().addScaledVector(inward, 0.1);
    const lipB = b.clone().addScaledVector(inward, 0.1);
    const sealA = a.clone().addScaledVector(inward, -0.06);
    const sealB = b.clone().addScaledVector(inward, -0.06);
    return [
      surf(beam(a, b, t, colors.dark), S_PANEL),
      surf(beam(lipA, lipB, t * 0.42, rimMetal), S_METAL),
      surf(beam(sealA, sealB, t * 0.3, seal), S_INSET)
    ];
  };

  const parts: THREE.BufferGeometry[] = [
    // Hex rim: top bar, upper diagonals, lower diagonals to the dash corners.
    ...rimRun(new THREE.Vector3(-1.05, topY, -3.5), new THREE.Vector3(1.05, topY, -3.5),
      new THREE.Vector3(0, -1, 0)),
    ...rimRun(new THREE.Vector3(-1.05, topY, -3.5), new THREE.Vector3(-2.05, midY, -3.1),
      new THREE.Vector3(0.7, -0.7, 0)),
    ...rimRun(new THREE.Vector3(1.05, topY, -3.5), new THREE.Vector3(2.05, midY, -3.1),
      new THREE.Vector3(-0.7, -0.7, 0)),
    ...rimRun(new THREE.Vector3(-2.05, midY, -3.1), new THREE.Vector3(-1.5, dashY, -2.6),
      new THREE.Vector3(0.75, 0.66, 0)),
    ...rimRun(new THREE.Vector3(2.05, midY, -3.1), new THREE.Vector3(1.5, dashY, -2.6),
      new THREE.Vector3(-0.75, 0.66, 0)),

    // Rim corner castings: the joints a fabricated frame actually has.
    surf(box(-1.05, topY, -3.5, 0.22, 0.22, 0.2, rimMetal, 0, 0, 0.5), S_METAL),
    surf(box(1.05, topY, -3.5, 0.22, 0.22, 0.2, rimMetal, 0, 0, -0.5), S_METAL),
    surf(box(-2.05, midY, -3.1, 0.24, 0.24, 0.22, rimMetal, 0, 0, 0.35), S_METAL),
    surf(box(2.05, midY, -3.1, 0.24, 0.24, 0.22, rimMetal, 0, 0, -0.35), S_METAL),

    // Dashboard: shallow-V of three slabs closing the hex at the bottom.
    surf(box(0, -1.12, -2.55, 1.7, 0.42, 0.5, colors.dark, 0.42), S_PANEL),
    surf(box(-1.28, -1.06, -2.72, 1.35, 0.4, 0.5, colors.dark, 0.42, 0.42, 0), S_PANEL),
    surf(box(1.28, -1.06, -2.72, 1.35, 0.4, 0.5, colors.dark, 0.42, -0.42, 0), S_PANEL),

    // Glareshield: a padded hood over the dash. It shades the instruments, and
    // its dark underside is what stops the dash from reading as a lit shelf.
    surf(box(0, -0.86, -2.72, 1.9, 0.1, 0.34, lin(0x232a33), 0.34), S_PAD),
    surf(box(-1.42, -0.8, -2.88, 1.3, 0.1, 0.32, lin(0x232a33), 0.34, 0.42, 0), S_PAD),
    surf(box(1.42, -0.8, -2.88, 1.3, 0.1, 0.32, lin(0x232a33), 0.34, -0.42, 0), S_PAD),

    // Center binnacle the holo ring floats above, on a machined pedestal.
    surf(box(0, -0.86, -2.42, 0.56, 0.16, 0.3, colors.mid, 0.5), S_METAL),
    surf(box(0, -1.0, -2.44, 0.4, 0.16, 0.24, lin(0x3a434f), 0.5), S_PANEL),

    // Side sills closing the lower peripheral gaps, with a wear-strip capping
    // the edge the pilot's arms rest against.
    surf(box(-2.0, -0.7, -2.7, 0.5, 1.1, 0.9, colors.dark, 0, 0.5, 0.15), S_PANEL),
    surf(box(2.0, -0.7, -2.7, 0.5, 1.1, 0.9, colors.dark, 0, -0.5, -0.15), S_PANEL),
    surf(box(-1.94, -0.16, -2.72, 0.42, 0.09, 0.86, lin(0x2a323c), 0, 0.5, 0.15), S_PAD),
    surf(box(1.94, -0.16, -2.72, 0.42, 0.09, 0.86, lin(0x2a323c), 0, -0.5, -0.15), S_PAD),

    // Overhead spine stub with the status-light housing, plus its shroud.
    surf(box(0, 1.52, -2.7, 0.5, 0.12, 1.1, colors.dark, -0.12), S_PANEL),
    surf(box(0, 1.63, -2.7, 0.66, 0.1, 1.0, colors.mid, -0.12), S_METAL),

    // Controls animate separately in ShipCockpit so this merged draw stays static.
  ];

  // Rivet lines along the rim diagonals: small, but they set the scale of every
  // other feature in the cabin, which is what the eye actually measures against.
  for (const side of [1, -1]) {
    for (let i = 0; i < 5; i++) {
      const k = i / 4;
      parts.push(surf(box(
        side * THREE.MathUtils.lerp(1.05, 2.05, k),
        THREE.MathUtils.lerp(topY, midY, k),
        THREE.MathUtils.lerp(-3.5, -3.1, k) + 0.09,
        0.05, 0.05, 0.05,
        rimMetal
      ), S_METAL));
    }
  }

  return assemble(parts, 'cockpit frame');
}

// -----------------------------------------------------------------------------
// Cockpit interior shell
// -----------------------------------------------------------------------------

/**
 * The camera-space cockpit tub: pressure shell, structural ribs, consoles and
 * equipment.
 *
 * The shell boxes are the light-tight envelope and nothing more. What makes the
 * cabin read is everything hung in FRONT of them — ribs, conduit, junction
 * boxes, instrument housings — because an interior is legible at the scale of
 * its smallest repeated feature, and a bare slab has none.
 */
export function createCockpitInteriorGeometry(colors: ShipHullColors): THREE.BufferGeometry {
  beginSurfaceAssembly();
  // The cabin palette sits deliberately higher than it used to. The old values
  // only ever read because a strong `emissive` term was mixed in on top of
  // them; with the surface shader doing real analytic lighting, the albedo has
  // to be an actual albedo or every practical lands on black.
  const cabinDark = lin(0x3d4a5a);
  const cabinMid = lin(0x76889b);
  const cabinLight = lin(0xb6c3ce);
  const inset = lin(0x1b232d);
  const shellDark = lin(0x333f4d);
  const conduit = lin(0x5a6672);
  const padding = lin(0x272e38);

  const parts: THREE.BufferGeometry[] = [
    // --- pressure shell -----------------------------------------------------
    // Sectioned so the middle gap becomes a narrow peripheral window instead of
    // an undifferentiated black sidewall.
    surf(box(-5.05, 0, -2.65, 1.75, 3.65, 1.65, shellDark, 0, -0.08, -0.04), S_PANEL),
    surf(box(5.05, 0, -2.65, 1.75, 3.65, 1.65, shellDark, 0, 0.08, 0.04), S_PANEL),
    surf(box(-3.45, 1.38, -2.58, 2.15, 0.92, 1.55, cabinDark, 0, -0.1, -0.08), S_PANEL),
    surf(box(3.45, 1.38, -2.58, 2.15, 0.92, 1.55, cabinDark, 0, 0.1, 0.08), S_PANEL),
    surf(box(-3.5, -1.18, -2.38, 2.35, 1.18, 1.8, cabinDark, 0, -0.08, 0.05), S_PANEL),
    surf(box(3.5, -1.18, -2.38, 2.35, 1.18, 1.8, cabinDark, 0, 0.08, -0.05), S_PANEL),
    surf(box(0, 2.03, -2.78, 8.25, 0.62, 1.55, cabinDark, -0.04), S_PANEL),
    surf(box(0, -1.8, -2.42, 8.45, 0.76, 1.9, cabinDark, 0.07), S_PANEL),

    // Roof liner. The pressure shell's own ceiling sits high enough to leave a
    // band of open sky between it and the canopy rim; anything mounted up there
    // then reads as debris floating over the aperture instead of as structure.
    // This closes the volume at head height and gives the ribs a surface to die
    // into, which is the whole reason they read as ribs.
    surf(box(0, 1.86, -2.35, 8.8, 0.24, 2.2, cabinDark, -0.02), S_PANEL),
    surf(box(0, 1.7, -3.32, 6.4, 0.2, 0.5, cabinDark, 0.22), S_PANEL),

    // --- canopy hinges and sill ribs ---------------------------------------
    surf(beam(new THREE.Vector3(-2.04, 1.58, -3.48), new THREE.Vector3(-3.25, 1.84, -2.25), 0.13, cabinLight), S_METAL),
    surf(beam(new THREE.Vector3(2.04, 1.58, -3.48), new THREE.Vector3(3.25, 1.84, -2.25), 0.13, cabinLight), S_METAL),
    surf(beam(new THREE.Vector3(-2.05, -1.02, -2.6), new THREE.Vector3(-3.55, -1.58, -1.82), 0.14, cabinMid), S_METAL),
    surf(beam(new THREE.Vector3(2.05, -1.02, -2.6), new THREE.Vector3(3.55, -1.58, -1.82), 0.14, cabinMid), S_METAL),
    surf(beam(new THREE.Vector3(-4.15, 0.72, -1.83), new THREE.Vector3(-4.15, -0.38, -1.67), 0.11, cabinLight), S_METAL),
    surf(beam(new THREE.Vector3(4.15, 0.72, -1.83), new THREE.Vector3(4.15, -0.38, -1.67), 0.11, cabinLight), S_METAL),

    // --- display recesses ---------------------------------------------------
    // The MFDs (utils/cockpitScreens.ts) sit just in front of these; the dark
    // backing plate is what gives an emissive panel a housing to live in.
    surf(box(-3.0, 0.02, -1.74, 0.72, 1.58, 0.11, inset, 0, -0.12, -0.05), S_INSET),
    surf(box(3.0, 0.02, -1.74, 0.72, 1.58, 0.11, inset, 0, 0.12, 0.05), S_INSET),
    surf(box(-4.78, 0.06, -1.88, 0.75, 1.72, 0.1, inset, 0, -0.08), S_INSET),
    surf(box(4.78, 0.06, -1.88, 0.75, 1.72, 0.1, inset, 0, 0.08), S_INSET),

    // --- consoles, seat tub, avionics cassette ------------------------------
    surf(box(-2.38, -1.17, -1.92, 1.48, 0.34, 1.25, cabinMid, 0.1, 0.18, 0.06), S_PANEL),
    surf(box(2.38, -1.17, -1.92, 1.48, 0.34, 1.25, cabinMid, 0.1, -0.18, -0.06), S_PANEL),
    surf(box(0, 1.61, -2.13, 2.65, 0.32, 0.68, cabinMid, -0.08), S_PANEL),
    surf(box(0, 1.48, -1.76, 1.72, 0.13, 0.12, inset, -0.08), S_INSET),
    surf(box(0, -1.43, -1.55, 1.3, 0.5, 0.82, inset, 0.16), S_INSET),

    // --- panel seams and latch rails ---------------------------------------
    surf(beam(new THREE.Vector3(-5.5, 1.16, -2.12), new THREE.Vector3(-4.45, 0.98, -1.82), 0.055, cabinLight), S_METAL),
    surf(beam(new THREE.Vector3(5.5, 1.16, -2.12), new THREE.Vector3(4.45, 0.98, -1.82), 0.055, cabinLight), S_METAL),
    surf(beam(new THREE.Vector3(-5.5, -0.94, -2.05), new THREE.Vector3(-4.42, -0.8, -1.75), 0.05, colors.accent), S_TRIM),
    surf(beam(new THREE.Vector3(5.5, -0.94, -2.05), new THREE.Vector3(4.42, -0.8, -1.75), 0.05, colors.accent), S_TRIM)
  ];

  // --- structural hoop ribs -------------------------------------------------
  // Four frames march aft along the cabin, each stepping outboard. They are the
  // reason the peripheral view now has depth cues instead of one flat value:
  // successive ribs occlude each other and the AO bake pools shadow behind them.
  // Every crown stays UNDER the roof liner: a hoop that pokes above it becomes a
  // bar hanging across open sky, which is the single loudest way to break an
  // interior. The ribs step outboard as they march aft, so successive frames
  // stay separable in the periphery.
  const RIBS: Array<{ z: number; halfW: number; top: number; bottom: number; t: number }> = [
    { z: -3.05, halfW: 2.95, top: 1.6, bottom: -1.38, t: 0.11 },
    { z: -2.55, halfW: 3.45, top: 1.62, bottom: -1.44, t: 0.12 },
    { z: -2.05, halfW: 3.95, top: 1.64, bottom: -1.5, t: 0.13 },
    { z: -1.55, halfW: 4.35, top: 1.66, bottom: -1.54, t: 0.13 }
  ];
  for (const rib of RIBS) {
    const shoulderY = rib.top - 0.5;
    for (const side of [1, -1]) {
      const sill = new THREE.Vector3(side * (rib.halfW - 0.5), rib.bottom, rib.z);
      const waist = new THREE.Vector3(side * rib.halfW, rib.bottom + 0.9, rib.z);
      const shoulder = new THREE.Vector3(side * (rib.halfW - 0.35), shoulderY, rib.z);
      const crown = new THREE.Vector3(side * (rib.halfW - 1.5), rib.top, rib.z);
      parts.push(surf(beam(sill, waist, rib.t, cabinMid), S_METAL));
      parts.push(surf(beam(waist, shoulder, rib.t, cabinMid), S_METAL));
      parts.push(surf(beam(shoulder, crown, rib.t * 0.9, cabinMid), S_METAL));
      // Gusset plate at the shoulder knuckle.
      parts.push(surf(box(
        side * (rib.halfW - 0.35), shoulderY, rib.z,
        0.26, 0.26, 0.1, cabinLight, 0, 0, side * 0.5
      ), S_METAL));
    }
    // Crown splice across the roof.
    parts.push(surf(beam(
      new THREE.Vector3(-(rib.halfW - 1.5), rib.top, rib.z),
      new THREE.Vector3(rib.halfW - 1.5, rib.top, rib.z),
      rib.t * 0.85, cabinMid
    ), S_METAL));
  }

  // --- longitudinal conduit runs -------------------------------------------
  // Cable trunks and their clamps, running fore-aft over the ribs. Long thin
  // horizontals are what give a boxy interior a readable direction of travel.
  for (const side of [1, -1]) {
    for (const [y, radius, tone] of [
      [1.42, 0.075, conduit],
      [1.24, 0.055, cabinMid],
      [-1.22, 0.085, conduit]
    ] as Array<[number, number, THREE.Color]>) {
      parts.push(surf(beam(
        new THREE.Vector3(side * 3.05, y, -3.05),
        new THREE.Vector3(side * 4.4, y - 0.12, -1.45),
        radius * 2, tone
      ), S_METAL));
      for (let i = 0; i < 4; i++) {
        const k = i / 3;
        parts.push(surf(box(
          side * THREE.MathUtils.lerp(3.05, 4.4, k),
          THREE.MathUtils.lerp(y, y - 0.12, k),
          THREE.MathUtils.lerp(-3.05, -1.45, k),
          0.09, radius * 3.2, radius * 3.2, cabinLight
        ), S_METAL));
      }
    }

    // Equipment boxes bolted to the sidewall between the ribs.
    parts.push(surf(box(side * 3.72, 0.78, -2.24, 0.5, 0.44, 0.62, cabinMid, 0, side * -0.2, 0), S_PANEL));
    parts.push(surf(box(side * 3.72, 0.78, -2.24, 0.34, 0.1, 0.5, inset, 0, side * -0.2, 0), S_INSET));
    parts.push(surf(box(side * 4.28, -0.62, -2.0, 0.44, 0.72, 0.5, cabinMid, 0, side * -0.14, 0), S_PANEL));
    parts.push(surf(box(side * 4.28, -0.62, -1.79, 0.3, 0.5, 0.06, inset, 0, side * -0.14, 0), S_INSET));
    // Ducting elbow up into the roof.
    parts.push(surf(beam(
      new THREE.Vector3(side * 4.5, 0.3, -2.5),
      new THREE.Vector3(side * 4.2, 1.6, -2.5),
      0.18, conduit
    ), S_METAL));

    // Grab handle above the door line: human-scale, and the eye reads it as such.
    parts.push(surf(beam(
      new THREE.Vector3(side * 3.3, 1.5, -2.9),
      new THREE.Vector3(side * 3.55, 1.5, -2.05),
      0.055, cabinLight
    ), S_METAL));
    parts.push(surf(box(side * 3.3, 1.61, -2.9, 0.09, 0.18, 0.09, cabinLight), S_METAL));
    parts.push(surf(box(side * 3.55, 1.61, -2.05, 0.09, 0.18, 0.09, cabinLight), S_METAL));

    // Display bezel: a raised frame around each main MFD recess.
    for (const [bx, by, bz, bw, bh, ry] of [
      [side * 3.0, 0.02, -1.68, 0.78, 1.64, side * -0.12]
    ] as Array<[number, number, number, number, number, number]>) {
      parts.push(surf(box(bx, by + bh / 2, bz, bw, 0.07, 0.12, cabinLight, 0, ry, 0), S_METAL));
      parts.push(surf(box(bx, by - bh / 2, bz, bw, 0.07, 0.12, cabinLight, 0, ry, 0), S_METAL));
      parts.push(surf(box(bx, by, bz, 0.07, bh, 0.12, cabinLight, 0, ry, 0), S_METAL));
    }
  }

  // --- overhead breaker panel ----------------------------------------------
  // A shallow rack of switch rows directly above the pilot. It is mostly seen
  // edge-on, which is exactly why it needs relief rather than a printed look.
  parts.push(surf(box(0, 1.5, -1.9, 3.1, 0.28, 0.5, cabinMid, 0.42), S_PANEL));
  for (let i = 0; i < 11; i++) {
    const x = THREE.MathUtils.lerp(-1.4, 1.4, i / 10);
    parts.push(surf(box(x, 1.42, -2.03, 0.14, 0.1, 0.16, cabinLight, 0.42), S_METAL));
    parts.push(surf(box(x, 1.57, -2.08, 0.16, 0.06, 0.2, inset, 0.42), S_INSET));
  }

  // --- dash coaming and console stacks -------------------------------------
  for (const side of [1, -1]) {
    // Padded arm rest capping each side console.
    parts.push(surf(box(side * 2.38, -0.97, -1.92, 1.4, 0.11, 1.16, padding, 0.1, side * 0.18, side * 0.06), S_PAD));
    // Switch cluster sunk into the console face.
    for (let i = 0; i < 3; i++) {
      parts.push(surf(box(
        side * (2.05 + i * 0.3), -1.02, -2.02 + i * 0.05,
        0.2, 0.05, 0.2, inset, 0.1, side * 0.18, 0
      ), S_INSET));
      parts.push(surf(box(
        side * (2.05 + i * 0.3), -0.99, -2.02 + i * 0.05,
        0.09, 0.07, 0.09, cabinLight, 0.1, side * 0.18, 0
      ), S_METAL));
    }
  }

  // --- dash display housings ----------------------------------------------
  // The main MFDs moved out of the peripheral walls and onto the dash, where a
  // 70-degree flight camera can actually see them. Each gets a canted backing
  // plate and a raised bezel so the emissive panel is a fitted instrument.
  for (const side of [1, -1]) {
    parts.push(surf(box(side * 1.28, -0.87, -2.57, 1.02, 0.68, 0.1, inset,
      -0.92, side * 0.42, side * 0.1), S_INSET));
    parts.push(surf(box(side * 1.28, -0.9, -2.62, 1.12, 0.78, 0.08, cabinMid,
      -0.92, side * 0.42, side * 0.1), S_METAL));
  }

  // --- footwell ------------------------------------------------------------
  // Barely in frame at rest, but it closes the volume when you look down and it
  // is where the floor bounce in the shader comes from.
  parts.push(surf(box(0, -1.62, -1.9, 2.6, 0.14, 1.5, cabinMid, 0.12), S_METAL));
  for (let i = 0; i < 7; i++) {
    parts.push(surf(box(
      THREE.MathUtils.lerp(-1.15, 1.15, i / 6), -1.54, -1.9,
      0.08, 0.05, 1.4, inset, 0.12
    ), S_INSET));
  }

  const geo = assemble(parts, 'cockpit interior');
  // Keep even the rotated floor corners safely beyond the flight camera near=1.
  geo.translate(0, 0, -0.22);
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

  // Cove lighting: continuous strips washing the roof ribs and the footwell.
  // Practical strips beat point lights here — they are one merged draw, they
  // trace the architecture, and they give the AO bake something to fight.
  for (const side of [1, -1]) {
    parts.push(beam(
      new THREE.Vector3(side * 2.9, 1.68, -3.0),
      new THREE.Vector3(side * 4.2, 1.7, -1.5),
      0.035, side > 0 ? amber : colors.accent
    ));
    parts.push(beam(
      new THREE.Vector3(side * 2.6, -1.5, -2.6),
      new THREE.Vector3(side * 3.9, -1.56, -1.5),
      0.03, side > 0 ? amber : colors.accent
    ));
    // Rib end-caps read as running lights marching aft.
    for (let i = 0; i < 4; i++) {
      parts.push(box(
        side * (2.9 + i * 0.47), 1.66 + i * 0.02, -3.05 + i * 0.5,
        0.06, 0.05, 0.05, side > 0 ? amber : colors.accent
      ));
    }
  }
  // Overhead dome wash and the glareshield underlight that grazes the dash.
  parts.push(box(0, 1.71, -2.4, 1.5, 0.04, 0.05, colors.accent));
  parts.push(box(0, -0.92, -2.74, 1.8, 0.03, 0.04, amber, 0.34));

  const geo = mergeGeometries(parts, false);
  if (!geo) throw new Error('Failed to merge cockpit light geometry');
  geo.computeVertexNormals();
  return geo;
}
