import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  FAUNA_JOINT_ID,
  FAUNA_MATERIAL_SLOT_ID,
  FAUNA_REGION_ID,
  type FaunaJoint,
  type FaunaKind,
  type FaunaMaterialSlot,
  type FaunaRegion
} from './faunaModel';
import {
  meshSculpt,
  orientAlong,
  sculptChain,
  sculptEllipsoid,
  sculptRoundCone,
  type SculptPrimitive,
  type SculptSemantics
} from './faunaSculpt';

/**
 * Fauna anatomy. Each species is an SDF sculpt for its mass (see
 * faunaSculpt.ts) plus explicit geometry for anything a grid cannot resolve:
 * legs, antlers, horns, ears, wings, fins, eyes.
 *
 * Local conventions: forward +x, up +y, feet on y=0. Head-top heights are part
 * of the world-scale contract in faunaScaleForKind (grazer ~1.45, woolly ~0.9,
 * runner ~0.85, hopper ~0.78).
 */

export type FaunaGeometryDetail = 'high' | 'medium' | 'low';

/** Colour and phenotype inputs the anatomy needs from the fauna profile. */
export interface FaunaAnatomyProfile {
  coatBase: THREE.Color;
  coatWarm: THREE.Color;
  coatCool: THREE.Color;
  woolColor: THREE.Color;
  darkColor: THREE.Color;
  accentColor: THREE.Color;
  wingColor: THREE.Color;
  phenotypes: Record<FaunaKind, {
    mass: number;
    bodyLength: number;
    bodyHeight: number;
    bodyWidth: number;
    shoulderHeight: number;
    hipHeight: number;
    limbSlenderness: number;
    neckLength: number;
    neckRise: number;
    muzzleLength: number;
    earScale: number;
    earSplay: number;
    tailLength: number;
    tailLift: number;
    appendageScale: number;
    fleece: number;
    crest: number;
  }>;
}

const TAU = Math.PI * 2;
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

/** Sculpt grid cell (local units) per species at the 'high' tier. */
const SCULPT_CELL: Readonly<Record<FaunaKind, number>> = {
  grazer: 0.034,
  woolly: 0.033,
  runner: 0.026,
  hopper: 0.026,
  dragonfly: 0.013,
  fish: 0.021
};

const DETAIL_CELL_SCALE: Readonly<Record<FaunaGeometryDetail, number>> = {
  high: 1,
  medium: 1.38,
  low: 1.85
};

const DETAIL_RADIAL: Readonly<Record<FaunaGeometryDetail, number>> = {
  high: 8,
  medium: 6,
  low: 5
};

interface BuildContext {
  detail: FaunaGeometryDetail;
  cell: number;
  radial: number;
  /** Chain subdivision for tubes. */
  subdivide: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function v3(x: number, y: number, z = 0): THREE.Vector3 {
  return new THREE.Vector3(x, y, z);
}

function speciesColor(base: number, planetTint: THREE.Color, tintAmount = 0.26): THREE.Color {
  return new THREE.Color(base).lerp(planetTint, clamp(tintAmount, 0, 0.45));
}

// ---------------------------------------------------------------------------
// Explicit-geometry helpers

interface FaunaVertexSemantics {
  region?: FaunaRegion;
  joint?: FaunaJoint;
  jointPivot?: THREE.Vector3;
  jointWeight?: number;
  bendPivot?: THREE.Vector3;
  bendWeight?: number;
  materialSlot?: FaunaMaterialSlot;
}

function defaultRegionForPart(part: number): FaunaRegion {
  if (part < 0.5) return 'body';
  if (part < 1.5) return 'head';
  if (part < 2.5) return 'frontLimb';
  if (part < 3.5) return 'hindLimb';
  if (part < 4.5) return 'tail';
  return 'wing';
}

function defaultMaterialForRegion(region: FaunaRegion): FaunaMaterialSlot {
  if (region === 'eye') return 'eye';
  if (region === 'horn') return 'horn';
  if (region === 'hoof') return 'hoof';
  if (region === 'fleece') return 'fleece';
  if (region === 'wing' || region === 'fin') return 'membrane';
  return 'coat';
}

function addAttributes(
  geo: THREE.BufferGeometry,
  color: THREE.Color,
  part: number,
  flexMul: number,
  semantics: FaunaVertexSemantics = {}
): THREE.BufferGeometry {
  const work = geo;
  if (!work.getAttribute('normal')) work.computeVertexNormals();
  work.computeBoundingBox();
  const box = work.boundingBox;
  const minY = box?.min.y ?? 0;
  const spanY = Math.max(0.001, (box?.max.y ?? 1) - minY);
  const pos = work.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const flex = new Float32Array(pos.count);
  const surface = new Float32Array(pos.count * 4);
  const jointPivots = new Float32Array(pos.count * 3);
  const bends = new Float32Array(pos.count * 4);
  const region = semantics.region ?? defaultRegionForPart(part);
  const joint = semantics.joint ?? 'root';
  const jointPivot = semantics.jointPivot ?? _a.set(0, 0, 0);
  const jointWeight = clamp(semantics.jointWeight ?? 0, 0, 1);
  const bendPivot = semantics.bendPivot ?? jointPivot;
  const bendWeight = clamp(semantics.bendWeight ?? 0, 0, 1);
  const materialSlot = semantics.materialSlot ?? defaultMaterialForRegion(region);
  for (let i = 0; i < pos.count; i++) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
    flex[i] = clamp(((pos.getY(i) - minY) / spanY) * flexMul, 0, 1);
    surface[i * 4] = FAUNA_REGION_ID[region];
    surface[i * 4 + 1] = FAUNA_JOINT_ID[joint];
    surface[i * 4 + 2] = jointWeight;
    surface[i * 4 + 3] = FAUNA_MATERIAL_SLOT_ID[materialSlot];
    jointPivots[i * 3] = jointPivot.x;
    jointPivots[i * 3 + 1] = jointPivot.y;
    jointPivots[i * 3 + 2] = jointPivot.z;
    bends[i * 4] = bendPivot.x;
    bends[i * 4 + 1] = bendPivot.y;
    bends[i * 4 + 2] = bendPivot.z;
    bends[i * 4 + 3] = bendWeight;
  }
  if (!work.getAttribute('uv')) {
    const uv = new Float32Array(pos.count * 2);
    const minX = box?.min.x ?? -1;
    const minZ = box?.min.z ?? -1;
    const spanX = Math.max(0.001, (box?.max.x ?? 1) - minX);
    const spanZ = Math.max(0.001, (box?.max.z ?? 1) - minZ);
    for (let i = 0; i < pos.count; i++) {
      uv[i * 2] = (pos.getX(i) - minX) / spanX;
      uv[i * 2 + 1] = (pos.getZ(i) - minZ) / spanZ;
    }
    work.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }
  work.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  work.setAttribute('aFaunaFlex', new THREE.BufferAttribute(flex, 1));
  // Packed to keep the WebGL instanced adapter below the guaranteed 16-attribute ceiling:
  // x=region, y=joint, z=joint weight, w=material slot.
  work.setAttribute('aFaunaSurface', new THREE.BufferAttribute(surface, 4));
  work.setAttribute('aFaunaJointPivot', new THREE.BufferAttribute(jointPivots, 3));
  work.setAttribute('aFaunaBend', new THREE.BufferAttribute(bends, 4));
  return work;
}

/** Catmull-Rom resampling of a joint chain and its radii. */
function smoothChain(
  points: readonly THREE.Vector3[],
  radii: readonly number[],
  subdivisions: number
): { points: THREE.Vector3[]; radii: number[] } {
  if (points.length < 3 || subdivisions <= 1) {
    return {
      points: points.map(point => point.clone()),
      radii: points.map((_p, index) => radii[Math.min(index, radii.length - 1)])
    };
  }
  const outPoints: THREE.Vector3[] = [];
  const outRadii: number[] = [];
  const radiusAt = (index: number) => radii[Math.min(Math.max(0, index), radii.length - 1)];
  for (let segment = 0; segment < points.length - 1; segment++) {
    const p0 = points[Math.max(0, segment - 1)];
    const p1 = points[segment];
    const p2 = points[segment + 1];
    const p3 = points[Math.min(points.length - 1, segment + 2)];
    const r1 = radiusAt(segment);
    const r2 = radiusAt(segment + 1);
    const steps = segment === points.length - 2 ? subdivisions + 1 : subdivisions;
    for (let step = 0; step < steps; step++) {
      const t = step / subdivisions;
      const t2 = t * t;
      const t3 = t2 * t;
      const point = new THREE.Vector3(
        0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
        0.5 * ((2 * p1.z) + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3)
      );
      outPoints.push(point);
      outRadii.push(r1 + (r2 - r1) * (t * t * (3 - 2 * t)));
    }
  }
  return { points: outPoints, radii: outRadii };
}

/**
 * Tapered tube along a chain with a rotation-minimising frame. Optional
 * elliptical section (`flatten` scales the binormal axis) and end caps.
 */
function limbTube(
  rawPoints: readonly THREE.Vector3[],
  rawRadii: readonly number[],
  color: THREE.Color,
  part: number,
  semantics: FaunaVertexSemantics,
  radialSegments = 8,
  caps: readonly [start: boolean, end: boolean] = [true, true],
  subdivisions = 1,
  flatten = 1
): THREE.BufferGeometry {
  const { points, radii } = smoothChain(rawPoints, rawRadii, subdivisions);
  const count = Math.max(2, points.length);
  const ringVertexCount = count * radialSegments;
  const positions = new Float32Array((ringVertexCount + 2) * 3);
  const normals = new Float32Array((ringVertexCount + 2) * 3);
  const tangent = new THREE.Vector3();
  const side = new THREE.Vector3();
  const binormal = new THREE.Vector3();
  const previousSide = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    tangent.copy(next).sub(prev);
    if (tangent.lengthSq() < 1e-10) tangent.set(1, 0, 0);
    tangent.normalize();
    if (i === 0) {
      side.set(0, 0, 1);
      if (Math.abs(tangent.z) > 0.88) side.set(0, 1, 0);
      binormal.crossVectors(tangent, side).normalize();
      side.crossVectors(binormal, tangent).normalize();
    } else {
      // Parallel transport: keep the previous side vector, re-orthogonalised.
      side.copy(previousSide).addScaledVector(tangent, -previousSide.dot(tangent));
      if (side.lengthSq() < 1e-8) side.set(0, 0, 1).addScaledVector(tangent, -tangent.z);
      side.normalize();
      binormal.crossVectors(tangent, side).normalize();
    }
    previousSide.copy(side);
    const radius = radii[Math.min(i, radii.length - 1)];
    for (let s = 0; s < radialSegments; s++) {
      const angle = (s / radialSegments) * TAU;
      const index = (i * radialSegments + s) * 3;
      const c = Math.cos(angle);
      const sn = Math.sin(angle);
      _a.copy(points[i])
        .addScaledVector(side, c * radius)
        .addScaledVector(binormal, sn * radius * flatten);
      positions[index] = _a.x;
      positions[index + 1] = _a.y;
      positions[index + 2] = _a.z;
      _b.set(0, 0, 0)
        .addScaledVector(side, c)
        .addScaledVector(binormal, sn / Math.max(0.2, flatten))
        .normalize();
      normals[index] = _b.x;
      normals[index + 1] = _b.y;
      normals[index + 2] = _b.z;
    }
  }
  const first = points[0];
  const last = points[points.length - 1];
  positions.set([first.x, first.y, first.z], ringVertexCount * 3);
  positions.set([last.x, last.y, last.z], (ringVertexCount + 1) * 3);
  _a.copy(points[1] ?? points[0]).sub(first).normalize().negate();
  normals.set([_a.x, _a.y, _a.z], ringVertexCount * 3);
  _a.copy(last).sub(points[points.length - 2] ?? last).normalize();
  normals.set([_a.x, _a.y, _a.z], (ringVertexCount + 1) * 3);
  const indices: number[] = [];
  for (let i = 0; i < count - 1; i++) {
    for (let s = 0; s < radialSegments; s++) {
      const next = (s + 1) % radialSegments;
      const a = i * radialSegments + s;
      const b = i * radialSegments + next;
      const c = (i + 1) * radialSegments + s;
      const d = (i + 1) * radialSegments + next;
      indices.push(a, b, c, b, d, c);
    }
  }
  const startCenter = ringVertexCount;
  const endCenter = ringVertexCount + 1;
  const lastRing = (count - 1) * radialSegments;
  for (let s = 0; s < radialSegments; s++) {
    const next = (s + 1) % radialSegments;
    if (caps[0]) indices.push(startCenter, next, s);
    if (caps[1]) indices.push(endCenter, lastRing + s, lastRing + next);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  return addAttributes(geometry, color, part, 1, semantics);
}

/**
 * Ear / leaf: a cupped, tapering blade from root to tip with an elliptical
 * section, widest at ~45% of its length and drawn to a point.
 */
function earLeaf(
  root: THREE.Vector3,
  tip: THREE.Vector3,
  halfWidth: number,
  thickness: number,
  color: THREE.Color,
  semantics: FaunaVertexSemantics,
  rings = 6,
  radialSegments = 6
): THREE.BufferGeometry {
  const axis = tip.clone().sub(root);
  const length = Math.max(1e-4, axis.length());
  axis.normalize();
  const widthAxis = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 0, 1), axis);
  if (widthAxis.lengthSq() < 1e-6) widthAxis.set(1, 0, 0);
  widthAxis.normalize();
  const depthAxis = new THREE.Vector3().crossVectors(axis, widthAxis).normalize();
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const ringCount = rings + 1;
  for (let ring = 0; ring < ringCount; ring++) {
    const t = ring / rings;
    // Width profile: narrow root, full at 0.45, pointed tip.
    const width = halfWidth * (0.32 + 0.68 * Math.sin(Math.PI * Math.min(1, t * 1.05))) * (1 - t * t * 0.9) + halfWidth * 0.03;
    const depth = thickness * (1 - t * 0.6);
    // Cupping: bend the blade slightly around its axis, curl the tip back.
    const curl = Math.sin(t * Math.PI * 0.5) * halfWidth * 0.18;
    const center = root.clone().addScaledVector(axis, length * t).addScaledVector(depthAxis, curl);
    for (let s = 0; s < radialSegments; s++) {
      const angle = (s / radialSegments) * TAU;
      const c = Math.cos(angle);
      const sn = Math.sin(angle);
      const cup = c * c * halfWidth * 0.12 * t;
      _a.copy(center).addScaledVector(widthAxis, c * width).addScaledVector(depthAxis, sn * depth - cup);
      positions.push(_a.x, _a.y, _a.z);
      _b.set(0, 0, 0).addScaledVector(widthAxis, c * depth).addScaledVector(depthAxis, sn * width).normalize();
      normals.push(_b.x, _b.y, _b.z);
    }
  }
  for (let ring = 0; ring < ringCount - 1; ring++) {
    for (let s = 0; s < radialSegments; s++) {
      const next = (s + 1) % radialSegments;
      const a = ring * radialSegments + s;
      const b = ring * radialSegments + next;
      const c = (ring + 1) * radialSegments + s;
      const d = (ring + 1) * radialSegments + next;
      indices.push(a, b, c, b, d, c);
    }
  }
  // Tip point + root cap.
  const tipIndex = positions.length / 3;
  const tipPoint = root.clone().addScaledVector(axis, length * 1.02).addScaledVector(depthAxis, halfWidth * 0.18);
  positions.push(tipPoint.x, tipPoint.y, tipPoint.z);
  normals.push(axis.x, axis.y, axis.z);
  const lastRing = (ringCount - 1) * radialSegments;
  for (let s = 0; s < radialSegments; s++) {
    const next = (s + 1) % radialSegments;
    indices.push(tipIndex, lastRing + s, lastRing + next);
  }
  const rootIndex = positions.length / 3;
  positions.push(root.x, root.y, root.z);
  normals.push(-axis.x, -axis.y, -axis.z);
  for (let s = 0; s < radialSegments; s++) {
    const next = (s + 1) % radialSegments;
    indices.push(rootIndex, next, s);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  return addAttributes(geometry, color, 4, 1, semantics);
}

/** Thin fin plate from a base edge and an outline; both faces plus a rim. */
function finFan(
  base: THREE.Vector3 | readonly [THREE.Vector3, THREE.Vector3],
  outline: readonly THREE.Vector3[],
  color: THREE.Color,
  semantics: FaunaVertexSemantics,
  halfThickness = 0.006
): THREE.BufferGeometry {
  const polygon = base instanceof THREE.Vector3
    ? [base, ...outline]
    : [base[0], ...outline, base[1]];
  const normal = new THREE.Vector3();
  for (let index = 0; index < polygon.length; index++) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    normal.x += (current.y - next.y) * (current.z + next.z);
    normal.y += (current.z - next.z) * (current.x + next.x);
    normal.z += (current.x - next.x) * (current.y + next.y);
  }
  if (normal.lengthSq() < 1e-8) normal.set(0, 0, 1);
  else normal.normalize();
  const positions: number[] = [];
  const indices: number[] = [];
  const sideVertexCount = polygon.length;
  for (let side = 0; side < 2; side++) {
    const offset = side === 0 ? halfThickness : -halfThickness;
    for (const point of polygon) {
      positions.push(
        point.x + normal.x * offset,
        point.y + normal.y * offset,
        point.z + normal.z * offset
      );
    }
  }
  for (let i = 1; i < polygon.length - 1; i++) {
    indices.push(0, i, i + 1);
    indices.push(sideVertexCount, sideVertexCount + i + 1, sideVertexCount + i);
  }
  for (let i = 0; i < polygon.length; i++) {
    const next = (i + 1) % polygon.length;
    indices.push(i, sideVertexCount + i, next);
    indices.push(next, sideVertexCount + i, sideVertexCount + next);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const geo = addAttributes(geometry, color, 4, 1, semantics);
  // Flex ramps with distance from the base so fins ripple at the trailing edge.
  const flex = geo.getAttribute('aFaunaFlex') as THREE.BufferAttribute;
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const baseA = base instanceof THREE.Vector3 ? base : base[0];
  const baseB = base instanceof THREE.Vector3 ? base : base[1];
  let maxDistance = 1e-4;
  const distances = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    _a.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    const distance = Math.min(_a.distanceTo(baseA), _a.distanceTo(baseB));
    distances[i] = distance;
    maxDistance = Math.max(maxDistance, distance);
  }
  for (let i = 0; i < pos.count; i++) flex.setX(i, distances[i] / maxDistance);
  return geo;
}

/** Glossy eyeball. The gaze axis rides in aFaunaBend.xyz (bend weight 0) for the iris shader. */
function eyeBall(
  center: THREE.Vector3,
  radius: number,
  color: THREE.Color,
  axis: THREE.Vector3,
  semantics: FaunaVertexSemantics,
  detail: FaunaGeometryDetail
): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(radius, detail === 'high' ? 12 : 9, detail === 'high' ? 8 : 6);
  geo.translate(center.x, center.y, center.z);
  return addAttributes(geo, color, 1, 0, {
    ...semantics,
    region: 'eye',
    materialSlot: 'eye',
    bendPivot: axis.clone().normalize(),
    bendWeight: 0
  });
}

/** Hoof / paw: a small rounded loft that seats over the tube end; sole sits on y = ankle.y - height. */
function footCap(
  ankle: THREE.Vector3,
  length: number,
  height: number,
  width: number,
  color: THREE.Color,
  part: number,
  semantics: FaunaVertexSemantics,
  radialSegments: number,
  paw = false
): THREE.BufferGeometry {
  const mid = ankle.y - height * 0.5;
  const points = [
    v3(ankle.x - length * 0.3, mid + height * 0.05, ankle.z),
    v3(ankle.x + length * 0.05, mid, ankle.z),
    v3(ankle.x + length * 0.4, mid - height * 0.06, ankle.z),
    v3(ankle.x + length * 0.7, mid - height * 0.1, ankle.z)
  ];
  const radii = paw
    ? [height * 0.5, height * 0.6, height * 0.58, height * 0.42]
    : [height * 0.52, height * 0.6, height * 0.56, height * 0.34];
  const tube = limbTube(points, radii, color, part, semantics, radialSegments, [true, true], 1, width / Math.max(0.001, height));
  // Flatten the sole so the animal stands on a plane.
  const pos = tube.getAttribute('position') as THREE.BufferAttribute;
  const sole = ankle.y - height;
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) < sole) pos.setY(i, sole);
  }
  pos.needsUpdate = true;
  return tube;
}

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const geo = mergeGeometries(parts, false);
  if (!geo) throw new Error('Failed to merge fauna geometry');
  return geo;
}

/**
 * Four-joint leg (hip, knee, hock, fetlock) as two smooth tubes plus a foot.
 * The lower tube bends about the knee; the whole chain swings about the hip.
 */
function articulatedLeg(
  chain: readonly [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3],
  color: THREE.Color,
  part: number,
  radius: number,
  ctx: BuildContext,
  footLength = radius * 3.4,
  footWidth = radius * 2.25,
  paw = false,
  footColor = color
): THREE.BufferGeometry[] {
  const [hip, knee, hock, foot] = chain;
  const z = hip.z;
  const joint: FaunaJoint = part === 2
    ? (z > 0 ? 'frontLeft' : 'frontRight')
    : (z > 0 ? 'hindLeft' : 'hindRight');
  const region = part === 2 ? 'frontLimb' : 'hindLimb';
  const common: FaunaVertexSemantics = {
    region,
    joint,
    jointPivot: hip,
    jointWeight: 1,
    materialSlot: 'skin'
  };
  const thighTop = hip.clone().add(v3(0, radius * 1.6, 0));
  const upperOverlap = knee.clone().lerp(hock, 0.08);
  const lowerOverlap = knee.clone().lerp(hip, 0.08);
  return [
    limbTube(
      [thighTop, hip, hip.clone().lerp(knee, 0.5), knee, upperOverlap],
      [radius * 1.35, radius * 1.3, radius * 1.1, radius * 0.98, radius * 0.94],
      color,
      part,
      common,
      ctx.radial,
      [true, false],
      ctx.subdivide
    ),
    limbTube(
      [lowerOverlap, knee, knee.clone().lerp(hock, 0.5), hock, hock.clone().lerp(foot, 0.5), foot],
      [radius * 1.0, radius * 0.98, radius * 0.84, radius * 0.72, radius * 0.66, radius * 0.6],
      color,
      part,
      { ...common, bendPivot: knee, bendWeight: 1 },
      ctx.radial,
      [false, true],
      ctx.subdivide
    ),
    footCap(
      foot.clone().add(v3(0, -foot.y * 0.08, 0)),
      footLength,
      Math.max(0.03, foot.y * 0.92),
      footWidth,
      footColor,
      part,
      {
        region: 'hoof', joint, jointPivot: hip, jointWeight: 1,
        bendPivot: knee, bendWeight: 1, materialSlot: paw ? 'skin' : 'hoof'
      },
      ctx.radial,
      paw
    )
  ];
}

/** Cambered insect wing with span/chord uv for the venation shader. */
function wingSheet(
  rootX: number,
  rootY: number,
  rootZ: number,
  side: number,
  chord: number,
  span: number,
  sweep: number,
  color: THREE.Color,
  detail: FaunaGeometryDetail
): THREE.BufferGeometry {
  const stations = detail === 'low' ? 5 : 8;
  const rows = detail === 'low' ? 3 : 5;
  const positions = new Float32Array(stations * rows * 3);
  const uv = new Float32Array(stations * rows * 2);
  for (let station = 0; station < stations; station++) {
    const t = station / (stations - 1);
    // Chord profile: narrow root, full mid-span, rounded tip.
    const chordScale = t < 0.12
      ? 0.25 + t / 0.12 * 0.65
      : 0.9 + 0.1 * Math.sin(Math.PI * Math.min(1, (t - 0.12) / 0.5)) - Math.max(0, t - 0.72) / 0.28 * 0.86;
    const centerX = rootX + sweep * t - chord * 0.06 * Math.sin(Math.PI * t);
    const halfChord = chord * Math.max(0.04, chordScale) * 0.5;
    const camber = Math.sin(Math.PI * t) * 0.012 - t * t * 0.01;
    for (let row = 0; row < rows; row++) {
      const chordPosition = 1 - (row / (rows - 1)) * 2;
      const vertex = station * rows + row;
      positions[vertex * 3] = centerX + halfChord * chordPosition;
      positions[vertex * 3 + 1] = rootY + camber + (1 - chordPosition * chordPosition) * 0.004;
      positions[vertex * 3 + 2] = rootZ + side * span * t;
      uv[vertex * 2] = row / (rows - 1);
      uv[vertex * 2 + 1] = t;
    }
  }
  const indices: number[] = [];
  for (let station = 0; station < stations - 1; station++) {
    for (let row = 0; row < rows - 1; row++) {
      const a = station * rows + row;
      const b = a + 1;
      const c = (station + 1) * rows + row;
      const d = c + 1;
      if (side > 0) indices.push(a, c, b, b, c, d);
      else indices.push(a, b, c, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const flex = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
    flex[i] = clamp(Math.abs(pos.getZ(i) - rootZ) / Math.max(0.001, span), 0, 1);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('aFaunaFlex', new THREE.BufferAttribute(flex, 1));
  const pivot = new Float32Array(pos.count * 3);
  const bend = new Float32Array(pos.count * 4);
  const surface = new Float32Array(pos.count * 4);
  for (let i = 0; i < pos.count; i++) {
    pivot[i * 3] = rootX;
    pivot[i * 3 + 1] = rootY;
    pivot[i * 3 + 2] = rootZ;
    bend[i * 4] = rootX;
    bend[i * 4 + 1] = rootY;
    bend[i * 4 + 2] = rootZ;
    surface[i * 4] = FAUNA_REGION_ID.wing;
    surface[i * 4 + 1] = FAUNA_JOINT_ID[side > 0 ? 'leftWing' : 'rightWing'];
    surface[i * 4 + 2] = 1;
    surface[i * 4 + 3] = FAUNA_MATERIAL_SLOT_ID.membrane;
  }
  geo.setAttribute('aFaunaSurface', new THREE.BufferAttribute(surface, 4));
  geo.setAttribute('aFaunaJointPivot', new THREE.BufferAttribute(pivot, 3));
  geo.setAttribute('aFaunaBend', new THREE.BufferAttribute(bend, 4));
  return geo;
}

// ---------------------------------------------------------------------------
// Sculpt shorthands

function ell(
  x: number, y: number, z: number,
  rx: number, ry: number, rz: number,
  color: THREE.Color,
  semantics: SculptSemantics,
  blend = 0.08,
  extra: { noise?: SculptPrimitive['noise']; tilt?: THREE.Vector3; subtract?: boolean } = {}
): SculptPrimitive {
  return sculptEllipsoid(
    v3(x, y, z),
    v3(rx, ry, rz),
    { color, semantics, blend, noise: extra.noise, subtract: extra.subtract },
    extra.tilt ? orientAlong(extra.tilt) : undefined
  );
}

function cone(
  a: THREE.Vector3, b: THREE.Vector3, ra: number, rb: number,
  color: THREE.Color, semantics: SculptSemantics, blend = 0.06,
  noise?: SculptPrimitive['noise']
): SculptPrimitive {
  return sculptRoundCone(a, b, ra, rb, { color, semantics, blend, noise });
}

function chain(
  points: THREE.Vector3[], radii: number[],
  color: THREE.Color, semantics: SculptSemantics, blend = 0.05,
  noise?: SculptPrimitive['noise']
): SculptPrimitive {
  return sculptChain(points, radii, { color, semantics, blend, noise });
}

// ---------------------------------------------------------------------------
// Species

/**
 * Grazer — an elk-silhouette browser: deep chest, high withers, long angled
 * neck with a bristled mane, a fine muzzle, branching antlers, and long slim
 * legs (~45% of standing height). Head top ~1.45, antler tips ~1.6.
 */
function createGrazerGeometry(profile: FaunaAnatomyProfile, ctx: BuildContext): THREE.BufferGeometry {
  const p = profile.phenotypes.grazer;
  const L = p.bodyLength;
  const H = p.bodyHeight / 0.74;
  const W = p.bodyWidth / 0.62;
  const nl = p.neckLength;
  const nr = p.neckRise / 0.9;
  const ml = p.muzzleLength;
  const earSpread = 0.05 + p.earSplay * 0.07;
  const neckPivot = v3(0.40, 0.86, 0);
  const tailPivot = v3(-0.58, 0.82, 0);
  const coat = speciesColor(0x8f8058, profile.coatBase);
  const coatLight = speciesColor(0xc8b283, profile.coatWarm, 0.22);
  const dark = speciesColor(0x2a2722, profile.darkColor, 0.18);
  const horn = speciesColor(0x7a6f56, profile.coatCool, 0.2);
  const leg = speciesColor(0x5a4e39, profile.coatCool, 0.24);
  const body: SculptSemantics = { region: 'body', materialSlot: 'coat', flex: 0.05 };
  const neck: SculptSemantics = { region: 'head', joint: 'neck', jointPivot: neckPivot, jointWeight: 1, materialSlot: 'coat', flex: 0.1 };
  const head: SculptSemantics = { ...neck, materialSlot: 'skin' };
  const mane: SculptSemantics = { region: 'mane', joint: 'neck', jointPivot: neckPivot, jointWeight: 1, materialSlot: 'coat', flex: 0.7 };
  const legJoint = (front: boolean, z: number): SculptSemantics => ({
    region: front ? 'frontLimb' : 'hindLimb',
    joint: front ? (z > 0 ? 'frontLeft' : 'frontRight') : (z > 0 ? 'hindLeft' : 'hindRight'),
    jointPivot: front ? v3(0.29, 0.66, z) : v3(-0.34, 0.66, z),
    jointWeight: front ? 0.3 : 0.4,
    materialSlot: 'coat'
  });
  const headNoise = { amplitude: 0.003, frequency: 26, seed: 3 };
  const primitives: SculptPrimitive[] = [
    // Torso: chest, barrel, rump, withers.
    ell(0.26 * L, 0.80, 0, 0.30, 0.26 * H, 0.20 * W, coat, body, 0.12),
    ell(-0.02 * L, 0.76, 0, 0.40, 0.235 * H, 0.215 * W, coat, body, 0.12),
    ell(-0.36 * L, 0.81, 0, 0.26, 0.24 * H, 0.19 * W, coat, body, 0.12),
    ell(0.30 * L, 0.93, 0, 0.17, 0.12, 0.10 * W, coat, body, 0.10),
    ell(-0.03 * L, 0.60, 0, 0.30, 0.10, 0.17 * W, coatLight, body, 0.12),
    // Shoulder and haunch masses carry a fraction of the leg swing.
    ...[-1, 1].flatMap(side => [
      ell(0.27 * L, 0.68, side * 0.14 * W, 0.13, 0.16, 0.07, coat, legJoint(true, side * 0.14), 0.08),
      ell(-0.33 * L, 0.66, side * 0.145 * W, 0.16, 0.19, 0.075, coat, legJoint(false, side * 0.145), 0.08)
    ]),
    // Neck and throat.
    chain(
      [v3(0.34, 0.84), v3(0.50 * nl + 0.02, 0.98 * nr + 0.02), v3(0.60 * nl + 0.04, 1.13 * nr + 0.06), v3(0.68, 1.245)],
      [0.155, 0.125, 0.10, 0.082],
      coat, neck, 0.09
    ),
    ell(0.50, 0.97, 0, 0.11, 0.065, 0.065, coatLight, { ...neck, jointWeight: 0.8 }, 0.08),
    // Head: cranium, brow, cheeks, muzzle, jaw, nose pad.
    ell(0.745, 1.27, 0, 0.12, 0.105, 0.09, coat, neck, 0.05, { noise: headNoise }),
    ell(0.79, 1.31, 0, 0.08, 0.05, 0.075, coat, neck, 0.05),
    ell(0.80, 1.22, 0.06, 0.075, 0.06, 0.045, coat, neck, 0.05),
    ell(0.80, 1.22, -0.06, 0.075, 0.06, 0.045, coat, neck, 0.05),
    cone(v3(0.80, 1.225), v3(1.0 * ml, 1.15), 0.085, 0.052, coatLight, head, 0.06),
    ell(0.87, 1.165, 0, 0.10, 0.045, 0.05, coatLight, head, 0.05),
    ell(1.01 * ml, 1.152, 0, 0.028, 0.022, 0.034, dark, head, 0.02),
    ell(1.005 * ml, 1.14, 0.028, 0.012, 0.011, 0.012, dark, head, 0.01, { subtract: true }),
    ell(1.005 * ml, 1.14, -0.028, 0.012, 0.011, 0.012, dark, head, 0.01, { subtract: true }),
    // Mane ridge along the neck crest.
    chain(
      [v3(0.34, 1.05), v3(0.46, 1.17), v3(0.56, 1.30), v3(0.64, 1.395), v3(0.70, 1.43)],
      [0.055, 0.056, 0.05, 0.04, 0.024],
      dark, mane, 0.03, { amplitude: 0.02, frequency: 28, seed: 11, octaves: 2 }
    )
  ];
  const parts: THREE.BufferGeometry[] = [meshSculpt(primitives, { cell: ctx.cell * SCULPT_CELL.grazer })];
  [-1, 1].forEach(side => {
    parts.push(eyeBall(v3(0.805, 1.268, side * 0.088), 0.024, dark, v3(0.35, 0.12, side * 0.93), neck, ctx.detail));
    parts.push(earLeaf(
      v3(0.68, 1.35, side * earSpread),
      v3(0.58, 1.49, side * earSpread * 1.55),
      0.05 * p.earScale, 0.009, coatLight,
      { region: 'ear', joint: 'neck', jointPivot: neckPivot, jointWeight: 1, materialSlot: 'skin' }
    ));
    // Antlers: main beam with a brow tine and two upper tines.
    const hornSemantics: FaunaVertexSemantics = { region: 'horn', joint: 'neck', jointPivot: neckPivot, jointWeight: 1, materialSlot: 'horn' };
    const s = p.appendageScale * (0.8 + p.crest * 0.35);
    const beam = [v3(0.70, 1.34, side * 0.05), v3(0.66, 1.44, side * 0.08), v3(0.58, 1.52, side * 0.105), v3(0.49, 1.56, side * 0.115)];
    parts.push(limbTube(beam, [0.022 * s, 0.018 * s, 0.014 * s, 0.006 * s], horn, 4, hornSemantics, Math.max(5, ctx.radial - 2), [true, true], ctx.subdivide));
    parts.push(limbTube([v3(0.70, 1.345, side * 0.05), v3(0.76, 1.42, side * 0.06), v3(0.79, 1.46, side * 0.065)], [0.014 * s, 0.009 * s, 0.004 * s], horn, 4, hornSemantics, 5, [false, true], ctx.subdivide));
    parts.push(limbTube([v3(0.66, 1.44, side * 0.08), v3(0.68, 1.53, side * 0.105), v3(0.69, 1.58, side * 0.12)], [0.013 * s, 0.009 * s, 0.004 * s], horn, 4, hornSemantics, 5, [false, true], ctx.subdivide));
    parts.push(limbTube([v3(0.58, 1.52, side * 0.105), v3(0.57, 1.60, side * 0.135), v3(0.56, 1.64, side * 0.15)], [0.012 * s, 0.008 * s, 0.004 * s], horn, 4, hornSemantics, 5, [false, true], ctx.subdivide));
  });
  // Tail with a tassel.
  const tailSemantics: FaunaVertexSemantics = { region: 'tail', joint: 'tail', jointPivot: tailPivot, jointWeight: 1, materialSlot: 'coat' };
  parts.push(limbTube(
    [tailPivot, v3(-0.64, 0.74 + p.tailLift * 0.06, 0.01), v3(-0.66, 0.62 + p.tailLift * 0.05, 0.02), v3(-0.66 - 0.1 * p.tailLength, 0.50 + p.tailLift * 0.08, 0.025)],
    [0.04, 0.034, 0.045, 0.012],
    dark, 4, tailSemantics, ctx.radial, [true, true], ctx.subdivide
  ));
  // Legs: long antelope limbs with distinct knee/hock chains and cloven hooves.
  [-0.135, 0.135].forEach(z => {
    const radius = 0.036 * p.limbSlenderness;
    parts.push(...articulatedLeg([
      v3(0.29, 0.66 * p.shoulderHeight, z * W),
      v3(0.27, 0.45, z * W),
      v3(0.33, 0.26, z * W),
      v3(0.33, 0.055, z * W)
    ], leg, 2, radius, ctx, 0.09, 0.062, false, leg.clone().lerp(dark, 0.6)));
    parts.push(...articulatedLeg([
      v3(-0.34, 0.66 * p.hipHeight, z * W),
      v3(-0.20, 0.47, z * W),
      v3(-0.41, 0.25, z * W),
      v3(-0.35, 0.055, z * W)
    ], leg, 3, radius * 1.06, ctx, 0.095, 0.066, false, leg.clone().lerp(dark, 0.6)));
  });
  return merge(parts);
}

/**
 * Woolly — a yak-bodied grazer: one continuous lumpy fleece over a low
 * skirt, a shoulder hump, a dark bare face under a wool cap, curled horns,
 * and short strong legs. Head top ~0.9.
 */
function createWoollyGeometry(profile: FaunaAnatomyProfile, ctx: BuildContext): THREE.BufferGeometry {
  const p = profile.phenotypes.woolly;
  const L = p.bodyLength / 0.88;
  const H = p.bodyHeight / 0.9;
  const W = p.bodyWidth;
  const massScale = 0.8 + p.mass * 0.2;
  const ml = p.muzzleLength / 0.72;
  const earSpread = 0.09 + p.earSplay * 0.06;
  const neckPivot = v3(0.30, 0.60, 0);
  const fleece = speciesColor(0xbdb6a8, profile.woolColor, 0.22);
  const fleeceDeep = speciesColor(0x9a9285, profile.woolColor, 0.3);
  const skin = speciesColor(0x36312d, profile.darkColor, 0.16);
  const horn = speciesColor(0x7d7158, profile.coatCool, 0.18);
  const eye = speciesColor(0x171513, profile.accentColor, 0.12);
  const wool: SculptSemantics = { region: 'fleece', materialSlot: 'fleece', flex: 0.2 };
  const neckWool: SculptSemantics = { ...wool, joint: 'neck', jointPivot: neckPivot, jointWeight: 0.6 };
  const headWool: SculptSemantics = { ...wool, joint: 'neck', jointPivot: neckPivot, jointWeight: 1 };
  const face: SculptSemantics = { region: 'head', joint: 'neck', jointPivot: neckPivot, jointWeight: 1, materialSlot: 'skin' };
  const woolNoise = { amplitude: 0.02 + p.fleece * 0.012, frequency: 13, seed: 5, octaves: 2 };
  const skirtNoise = { amplitude: 0.024, frequency: 9, seed: 9, octaves: 2 };
  const legJoint = (front: boolean, z: number): SculptSemantics => ({
    region: front ? 'frontLimb' : 'hindLimb',
    joint: front ? (z > 0 ? 'frontLeft' : 'frontRight') : (z > 0 ? 'hindLeft' : 'hindRight'),
    jointPivot: front ? v3(0.24, 0.42, z) : v3(-0.24, 0.42, z),
    jointWeight: 0.25,
    materialSlot: 'fleece'
  });
  const primitives: SculptPrimitive[] = [
    ell(0.02 * L, 0.585, 0, 0.44 * massScale, 0.29 * H * massScale, 0.27 * W * massScale, fleece, wool, 0.1, { noise: woolNoise }),
    ell(0.30 * L, 0.60, 0, 0.24 * massScale, 0.26 * H * massScale, 0.245 * W * massScale, fleece, wool, 0.1, { noise: woolNoise }),
    ell(-0.32 * L, 0.585, 0, 0.24 * massScale, 0.265 * H * massScale, 0.25 * W * massScale, fleece, wool, 0.1, { noise: woolNoise }),
    ell(0.0, 0.44, 0, 0.42 * massScale, 0.15, 0.29 * W * massScale, fleeceDeep, wool, 0.1, { noise: skirtNoise }),
    ell(0.16 * L, 0.80, 0, 0.19, 0.11, 0.15 * W, fleece, wool, 0.09, { noise: woolNoise }),
    ...[-1, 1].flatMap(side => [
      ell(0.24 * L, 0.42, side * 0.16 * W, 0.12, 0.12, 0.07, fleeceDeep, legJoint(true, side * 0.16), 0.08, { noise: skirtNoise }),
      ell(-0.24 * L, 0.42, side * 0.165 * W, 0.13, 0.13, 0.075, fleeceDeep, legJoint(false, side * 0.165), 0.08, { noise: skirtNoise })
    ]),
    // Wool neck flowing into the head.
    chain([v3(0.34, 0.62), v3(0.48, 0.665)], [0.16, 0.125], fleece, neckWool, 0.09, woolNoise),
    // Dark face: cranium, brow, muzzle, jaw.
    ell(0.53, 0.66, 0, 0.115, 0.095, 0.088, skin, face, 0.05),
    ell(0.57, 0.70, 0, 0.07, 0.035, 0.07, skin, face, 0.04),
    cone(v3(0.57, 0.625), v3(0.70 * ml, 0.555), 0.078, 0.05, skin, face, 0.05),
    ell(0.64 * ml, 0.565, 0, 0.085, 0.04, 0.05, skin, face, 0.05),
    ell(0.71 * ml, 0.555, 0.02, 0.012, 0.01, 0.012, skin, face, 0.01, { subtract: true }),
    ell(0.71 * ml, 0.555, -0.02, 0.012, 0.01, 0.012, skin, face, 0.01, { subtract: true }),
    // Wool cap over the brow and cheek tufts.
    ell(0.50, 0.745, 0, 0.10, 0.055, 0.09, fleece, headWool, 0.04, { noise: { amplitude: 0.012, frequency: 24, seed: 7 } }),
    ell(0.52, 0.60, 0.095, 0.06, 0.06, 0.04, fleece, headWool, 0.04, { noise: { amplitude: 0.01, frequency: 24, seed: 8 } }),
    ell(0.52, 0.60, -0.095, 0.06, 0.06, 0.04, fleece, headWool, 0.04, { noise: { amplitude: 0.01, frequency: 24, seed: 8 } }),
    // Wool stub tail.
    ell(-0.50 - 0.08 * p.tailLength, 0.59, 0, 0.07 + 0.06 * p.tailLength, 0.05, 0.045, fleece,
      { region: 'tail', joint: 'tail', jointPivot: v3(-0.44, 0.59, 0), jointWeight: 1, materialSlot: 'fleece', flex: 0.5 }, 0.06,
      { noise: { amplitude: 0.01, frequency: 26, seed: 12 } })
  ];
  const parts: THREE.BufferGeometry[] = [meshSculpt(primitives, { cell: ctx.cell * SCULPT_CELL.woolly })];
  [-1, 1].forEach(side => {
    parts.push(eyeBall(v3(0.59, 0.668, side * 0.086), 0.02, eye, v3(0.3, 0.1, side * 0.95), face, ctx.detail));
    parts.push(earLeaf(
      v3(0.46, 0.69, side * earSpread * 0.9),
      v3(0.45, 0.635, side * earSpread * 2.1),
      0.042 * p.earScale, 0.008, skin,
      { region: 'ear', joint: 'neck', jointPivot: neckPivot, jointWeight: 1, materialSlot: 'skin' }
    ));
    const s = p.appendageScale;
    parts.push(limbTube(
      [v3(0.46, 0.76, side * 0.075), v3(0.42, 0.84, side * 0.12), v3(0.38, 0.845, side * 0.19), v3(0.40, 0.79, side * 0.25), v3(0.47, 0.73, side * 0.265), v3(0.53, 0.71, side * 0.235)],
      [0.038 * s, 0.034 * s, 0.028 * s, 0.021 * s, 0.013 * s, 0.005 * s],
      horn, 4, { region: 'horn', joint: 'neck', jointPivot: neckPivot, jointWeight: 1, materialSlot: 'horn' },
      ctx.radial, [true, true], ctx.subdivide
    ));
  });
  [-0.155, 0.155].forEach(z => {
    const radius = 0.046 * p.limbSlenderness;
    parts.push(...articulatedLeg([
      v3(0.24, 0.50 * p.shoulderHeight / 0.88, z * W),
      v3(0.22, 0.27, z * W),
      v3(0.27, 0.13, z * W),
      v3(0.27, 0.045, z * W)
    ], skin, 2, radius, ctx, 0.085, 0.07));
    parts.push(...articulatedLeg([
      v3(-0.24, 0.50 * p.hipHeight / 0.86, z * W),
      v3(-0.16, 0.28, z * W),
      v3(-0.29, 0.14, z * W),
      v3(-0.27, 0.045, z * W)
    ], skin, 3, radius * 1.05, ctx, 0.09, 0.075));
  });
  return merge(parts);
}

/**
 * Runner — a fox-silhouette hunter: deep chest to a tucked waist, a pale
 * bib, cheek ruffs, tall ears, a fine muzzle with a dark nose, and a long
 * bushy tail with a pale tip. Head top ~0.85, ear tips ~0.97.
 */
function createRunnerGeometry(profile: FaunaAnatomyProfile, ctx: BuildContext): THREE.BufferGeometry {
  const p = profile.phenotypes.runner;
  const L = p.bodyLength / 1.08;
  const H = p.bodyHeight / 0.62;
  const W = p.bodyWidth / 0.48;
  const ml = p.muzzleLength / 1.22;
  const tl = p.tailLength / 1.18;
  const earSpread = 0.055 + p.earSplay * 0.09;
  const neckPivot = v3(0.30, 0.52, 0);
  const tailPivot = v3(-0.38, 0.49, 0);
  const coat = speciesColor(0xa8683f, profile.coatWarm, 0.24);
  const coatLight = speciesColor(0xdcc7a4, profile.woolColor, 0.18);
  const dark = speciesColor(0x2c2622, profile.darkColor, 0.16);
  const ear = speciesColor(0x7a5238, profile.coatCool, 0.2);
  const body: SculptSemantics = { region: 'body', materialSlot: 'coat', flex: 0.05 };
  const neck: SculptSemantics = { region: 'head', joint: 'neck', jointPivot: neckPivot, jointWeight: 1, materialSlot: 'coat', flex: 0.1 };
  const head: SculptSemantics = { ...neck, materialSlot: 'skin' };
  const tail: SculptSemantics = { region: 'tail', joint: 'tail', jointPivot: tailPivot, jointWeight: 1, materialSlot: 'coat', flex: 0.8 };
  const ruffNoise = { amplitude: 0.008, frequency: 24, seed: 4, octaves: 2 };
  const tailNoise = { amplitude: 0.012, frequency: 17, seed: 6, octaves: 2 };
  const legJoint = (front: boolean, z: number): SculptSemantics => ({
    region: front ? 'frontLimb' : 'hindLimb',
    joint: front ? (z > 0 ? 'frontLeft' : 'frontRight') : (z > 0 ? 'hindLeft' : 'hindRight'),
    jointPivot: front ? v3(0.24, 0.52, z) : v3(-0.29, 0.50, z),
    jointWeight: front ? 0.3 : 0.45,
    materialSlot: 'coat'
  });
  const primitives: SculptPrimitive[] = [
    ell(0.24 * L, 0.51, 0, 0.21, 0.215 * H, 0.15 * W, coat, body, 0.09),
    ell(-0.04 * L, 0.52, 0, 0.27, 0.125 * H, 0.105 * W, coat, body, 0.09),
    ell(-0.31 * L, 0.53, 0, 0.19, 0.165 * H, 0.135 * W, coat, body, 0.09),
    ell(0.30, 0.42, 0, 0.12, 0.10, 0.09 * W, coatLight, body, 0.07),
    ...[-1, 1].flatMap(side => [
      ell(0.22 * L, 0.43, side * 0.10 * W, 0.09, 0.12, 0.05, coat, legJoint(true, side * 0.10), 0.07),
      ell(-0.30 * L, 0.40, side * 0.11 * W, 0.12, 0.145, 0.06, coat, legJoint(false, side * 0.11), 0.07)
    ]),
    chain([v3(0.29, 0.56), v3(0.42, 0.655)], [0.115, 0.09], coat, neck, 0.08),
    // Cheek ruffs and head.
    ell(0.47, 0.645, 0, 0.09, 0.085, 0.10, coatLight, { ...neck, materialSlot: 'coat' }, 0.05, { noise: ruffNoise }),
    ell(0.53, 0.705, 0, 0.10, 0.085, 0.08, coat, neck, 0.05),
    ell(0.57, 0.735, 0, 0.06, 0.038, 0.065, coat, neck, 0.04),
    cone(v3(0.58, 0.675), v3(0.80 * ml, 0.605), 0.066, 0.03, coat, head, 0.05),
    ell(0.66 * ml, 0.63, 0, 0.09, 0.035, 0.042, coatLight, head, 0.045),
    ell(0.815 * ml, 0.607, 0, 0.022, 0.019, 0.025, dark, head, 0.015),
    // Bushy tail: root and body in coat, a pale tip that blends in.
    chain(
      [v3(-0.38, 0.49), v3(-0.58, 0.44 + p.tailLift * 0.03, 0.01), v3(-0.80, 0.40 + p.tailLift * 0.06, 0.02), v3(-0.98 * tl, 0.44 + p.tailLift * 0.08, 0.025)],
      [0.05, 0.085, 0.10, 0.075],
      coat.clone().lerp(dark, 0.15), tail, 0.06, tailNoise
    ),
    ell(-1.1 * tl, 0.49 + p.tailLift * 0.08, 0.02, 0.11, 0.055, 0.055, coatLight, tail, 0.06, { noise: tailNoise })
  ];
  const parts: THREE.BufferGeometry[] = [meshSculpt(primitives, { cell: ctx.cell * SCULPT_CELL.runner })];
  [-1, 1].forEach(side => {
    parts.push(eyeBall(v3(0.59, 0.712, side * 0.072), 0.02, dark, v3(0.5, 0.12, side * 0.86), neck, ctx.detail));
    parts.push(earLeaf(
      v3(0.50, 0.77, side * earSpread * 0.8),
      v3(0.43, 0.97, side * earSpread * 1.25),
      0.062 * p.earScale, 0.008, ear,
      { region: 'ear', joint: 'neck', jointPivot: neckPivot, jointWeight: 1, materialSlot: 'skin' }
    ));
  });
  [-0.115, 0.115].forEach(z => {
    const radius = 0.031 * p.limbSlenderness;
    parts.push(...articulatedLeg([
      v3(0.24, 0.53 * p.shoulderHeight / 0.82, z * W),
      v3(0.18, 0.33, z * W),
      v3(0.28, 0.12, z * W),
      v3(0.31, 0.045, z * W)
    ], dark, 2, radius, ctx, 0.085, 0.058, true));
    parts.push(...articulatedLeg([
      v3(-0.29, 0.50 * p.hipHeight / 0.74, z * W),
      v3(-0.10, 0.35, z * W),
      v3(-0.34, 0.17, z * W),
      v3(-0.27, 0.045, z * W)
    ], dark, 3, radius * 1.08, ctx, 0.09, 0.06, true));
  });
  return merge(parts);
}

/**
 * Hopper — a hare: a rounded haunch-heavy body, short neck, big lateral
 * eyes, long cupped ears, a cotton tail, and long hind feet. Body top ~0.78,
 * ear tips ~1.03.
 */
function createHopperGeometry(profile: FaunaAnatomyProfile, ctx: BuildContext): THREE.BufferGeometry {
  const p = profile.phenotypes.hopper;
  const H = p.bodyHeight / 0.7;
  const W = p.bodyWidth / 0.64;
  const ml = p.muzzleLength / 0.62;
  const earSpread = 0.04 + p.earSplay * 0.1;
  const neckPivot = v3(0.14, 0.58, 0);
  const tailPivot = v3(-0.36, 0.5, 0);
  const coat = speciesColor(0x8c7655, profile.coatCool, 0.24);
  const coatLight = speciesColor(0xc4b08a, profile.coatBase, 0.2);
  const dark = speciesColor(0x342e27, profile.darkColor, 0.16);
  const limbColor = speciesColor(0x64553f, profile.coatCool, 0.2);
  const body: SculptSemantics = { region: 'body', materialSlot: 'coat', flex: 0.05 };
  const neck: SculptSemantics = { region: 'head', joint: 'neck', jointPivot: neckPivot, jointWeight: 1, materialSlot: 'coat', flex: 0.1 };
  const head: SculptSemantics = { ...neck, materialSlot: 'skin' };
  const furNoise = { amplitude: 0.005, frequency: 22, seed: 2, octaves: 2 };
  const thigh = (z: number): SculptSemantics => ({
    region: 'hindLimb', joint: z > 0 ? 'hindLeft' : 'hindRight', jointPivot: v3(-0.23, 0.47, z), jointWeight: 0.55, materialSlot: 'coat'
  });
  const primitives: SculptPrimitive[] = [
    ell(-0.14, 0.46, 0, 0.29, 0.27 * H, 0.22 * W, coat, body, 0.12, { noise: furNoise }),
    ell(0.12, 0.50, 0, 0.21, 0.20 * H, 0.17 * W, coat, body, 0.12, { noise: furNoise }),
    ell(-0.02, 0.36, 0, 0.26, 0.12, 0.16 * W, coatLight, body, 0.1),
    ell(-0.12, 0.38, 0.14 * W, 0.21, 0.15, 0.085, coat, thigh(0.14), 0.08, { noise: furNoise, tilt: v3(1, -0.55, 0) }),
    ell(-0.12, 0.38, -0.14 * W, 0.21, 0.15, 0.085, coat, thigh(-0.14), 0.08, { noise: furNoise, tilt: v3(1, -0.55, 0) }),
    chain([v3(0.15, 0.585), v3(0.24, 0.645)], [0.115, 0.10], coat, neck, 0.09),
    ell(0.28, 0.685, 0, 0.105, 0.095, 0.088, coat, neck, 0.05),
    ell(0.32, 0.725, 0, 0.065, 0.035, 0.07, coat, neck, 0.04),
    cone(v3(0.32, 0.665), v3(0.44 * ml, 0.62), 0.068, 0.04, coatLight, head, 0.05),
    ell(0.30, 0.63, 0.07, 0.06, 0.05, 0.04, coatLight, head, 0.04),
    ell(0.30, 0.63, -0.07, 0.06, 0.05, 0.04, coatLight, head, 0.04),
    ell(0.445 * ml, 0.628, 0, 0.018, 0.014, 0.02, dark, head, 0.012),
    ell(-0.43, 0.51, 0, 0.065, 0.06, 0.058, coatLight,
      { region: 'tail', joint: 'tail', jointPivot: tailPivot, jointWeight: 1, materialSlot: 'coat', flex: 0.6 }, 0.05,
      { noise: { amplitude: 0.01, frequency: 26, seed: 14 } })
  ];
  const parts: THREE.BufferGeometry[] = [meshSculpt(primitives, { cell: ctx.cell * SCULPT_CELL.hopper })];
  [-1, 1].forEach(side => {
    parts.push(eyeBall(v3(0.315, 0.712, side * 0.083), 0.026, dark, v3(0.18, 0.22, side * 0.96), neck, ctx.detail));
    parts.push(earLeaf(
      v3(0.22, 0.76, side * earSpread * 0.8),
      v3(0.09, 1.03, side * earSpread * 1.3),
      0.068 * p.earScale, 0.009, coatLight,
      { region: 'ear', joint: 'neck', jointPivot: neckPivot, jointWeight: 1, materialSlot: 'skin' }
    ));
  });
  [-0.105, 0.105].forEach(z => {
    const frontHip = v3(0.15, 0.50, z * 0.8 * W);
    const frontJoint: FaunaJoint = z > 0 ? 'frontLeft' : 'frontRight';
    const frontElbow = v3(0.17, 0.34, z * 0.8 * W);
    const frontWrist = v3(0.21, 0.19, z * 0.8 * W);
    const frontToe = v3(0.27, 0.045, z * 0.8 * W);
    parts.push(limbTube([frontHip.clone().add(v3(0, 0.05, 0)), frontHip, frontElbow], [0.036, 0.032, 0.024], limbColor, 2, {
      region: 'frontLimb', joint: frontJoint, jointPivot: frontHip, jointWeight: 1, materialSlot: 'skin'
    }, ctx.radial, [true, false], ctx.subdivide));
    parts.push(limbTube([frontElbow, frontWrist, frontToe], [0.024, 0.02, 0.018], limbColor, 2, {
      region: 'frontLimb', joint: frontJoint, jointPivot: frontHip, jointWeight: 1,
      bendPivot: frontElbow, bendWeight: 1, materialSlot: 'skin'
    }, ctx.radial, [false, true], ctx.subdivide));
    parts.push(footCap(frontToe.clone(), 0.06, 0.042, 0.04, limbColor, 2, {
      region: 'hoof', joint: frontJoint, jointPivot: frontHip, jointWeight: 1,
      bendPivot: frontElbow, bendWeight: 1, materialSlot: 'skin'
    }, ctx.radial, true));
    parts.push(...articulatedLeg([
      v3(-0.23, 0.47, z * W),
      v3(0.02, 0.31, z * W),
      v3(-0.28, 0.12, z * W),
      v3(-0.12, 0.045, z * W)
    ], limbColor, 3, 0.05 * p.limbSlenderness, ctx, 0.22, 0.07, true));
  });
  return merge(parts);
}

/**
 * Dragonfly — a giant-insect flyer: two humped thorax lobes, a sphere head
 * with huge compound eyes, a nine-segment tapering abdomen, four veined
 * wings, and six wire legs.
 */
function createDragonflyGeometry(profile: FaunaAnatomyProfile, ctx: BuildContext): THREE.BufferGeometry {
  const p = profile.phenotypes.dragonfly;
  const abdomen = speciesColor(0x3f5a56, profile.accentColor, 0.24);
  const thorax = speciesColor(0x36473f, profile.darkColor, 0.16);
  const edge = speciesColor(0x65736d, profile.coatWarm, 0.18);
  const membrane = speciesColor(0xa9bdbd, profile.wingColor, 0.2);
  const eye = speciesColor(0x18292c, profile.accentColor, 0.16);
  const abdomenPivot = v3(-0.08, 0.5, 0);
  const foreSpan = 0.78 * p.appendageScale;
  const hindSpan = 0.63 * p.appendageScale;
  const bodySem: SculptSemantics = { region: 'body', materialSlot: 'skin', flex: 0.1 };
  const headSem: SculptSemantics = { region: 'head', materialSlot: 'skin', flex: 0.1 };
  const primitives: SculptPrimitive[] = [
    ell(0.04, 0.512, 0, 0.135, 0.10, 0.082, thorax, bodySem, 0.04),
    ell(0.0, 0.565, 0, 0.075, 0.045, 0.06, thorax, bodySem, 0.035),
    ell(0.10, 0.55, 0, 0.06, 0.04, 0.055, thorax, bodySem, 0.035),
    ell(0.235, 0.53, 0, 0.078, 0.07, 0.082, thorax, headSem, 0.025),
    ell(0.30, 0.50, 0, 0.03, 0.028, 0.04, thorax, headSem, 0.02)
  ];
  const parts: THREE.BufferGeometry[] = [meshSculpt(primitives, { cell: ctx.cell * SCULPT_CELL.dragonfly })];
  // Nine-segment abdomen: a tube whose radius swells at every segment collar.
  {
    const segments = 9;
    const abdomenLength = 0.86 * p.bodyLength;
    const ringsPerSegment = ctx.detail === 'low' ? 2 : 3;
    const points: THREE.Vector3[] = [];
    const radii: number[] = [];
    const total = segments * ringsPerSegment;
    for (let ring = 0; ring <= total; ring++) {
      const t = ring / total;
      const local = (ring % ringsPerSegment) / ringsPerSegment;
      const collar = 1 - 0.18 * Math.pow(Math.abs(local - 0.5) * 2, 1.5);
      points.push(v3(-0.09 - t * abdomenLength, 0.502 - t * 0.012 - Math.sin(t * Math.PI) * 0.004, 0));
      radii.push((0.046 - t * 0.034) * collar);
    }
    parts.push(limbTube(points, radii, abdomen, 4, {
      region: 'tail', joint: 'tail', jointPivot: abdomenPivot, jointWeight: 1, materialSlot: 'skin'
    }, ctx.radial, [false, true], 1, 0.92));
  }
  parts.push(eyeBall(v3(0.265, 0.55, 0.078), 0.052, eye, v3(0.35, 0.45, 0.82), headSem, ctx.detail));
  parts.push(eyeBall(v3(0.265, 0.55, -0.078), 0.052, eye, v3(0.35, 0.45, -0.82), headSem, ctx.detail));
  parts.push(
    wingSheet(0.05, 0.585, 0.058, 1, 0.2 * p.appendageScale, foreSpan, 0.04, membrane, ctx.detail),
    wingSheet(0.05, 0.585, -0.058, -1, 0.2 * p.appendageScale, foreSpan, 0.04, membrane, ctx.detail),
    wingSheet(-0.07, 0.575, 0.054, 1, 0.26 * p.appendageScale, hindSpan, -0.16, membrane, ctx.detail),
    wingSheet(-0.07, 0.575, -0.054, -1, 0.26 * p.appendageScale, hindSpan, -0.16, membrane, ctx.detail)
  );
  [-1, 1].forEach(side => {
    const wingJoint: FaunaJoint = side > 0 ? 'leftWing' : 'rightWing';
    parts.push(
      limbTube([
        v3(0.045, 0.585, side * 0.058),
        v3(0.105, 0.597, side * (0.058 + foreSpan * 0.31)),
        v3(0.105, 0.599, side * (0.058 + foreSpan * 0.68)),
        v3(0.08, 0.586, side * (0.058 + foreSpan))
      ], [0.0065, 0.0055, 0.0045, 0.002], edge, 5, {
        region: 'wing', joint: wingJoint, jointPivot: v3(0.045, 0.585, side * 0.058), jointWeight: 1, materialSlot: 'skin'
      }, 4, [true, true], ctx.subdivide),
      limbTube([
        v3(-0.055, 0.575, side * 0.054),
        v3(-0.015, 0.589, side * (0.054 + hindSpan * 0.34)),
        v3(-0.05, 0.589, side * (0.054 + hindSpan * 0.68)),
        v3(-0.2, 0.576, side * (0.054 + hindSpan))
      ], [0.0065, 0.0055, 0.004, 0.002], edge, 5, {
        region: 'wing', joint: wingJoint, jointPivot: v3(-0.055, 0.575, side * 0.054), jointWeight: 1, materialSlot: 'skin'
      }, 4, [true, true], ctx.subdivide)
    );
  });
  const legPairs: Array<[number, number, number]> = [
    [0.11, 0.26, 0.16],
    [0.03, -0.01, 0.19],
    [-0.06, -0.28, 0.18]
  ];
  legPairs.forEach(([rootX, footX, reach], pair) => {
    [-1, 1].forEach(side => {
      parts.push(limbTube([
        v3(rootX, 0.45, side * 0.05),
        v3(rootX + (footX - rootX) * 0.3, 0.40 - pair * 0.006, side * reach * 0.6),
        v3(rootX + (footX - rootX) * 0.62, 0.372 - pair * 0.007, side * reach * 0.86),
        v3(footX, 0.352 - pair * 0.008, side * reach)
      ], [0.009, 0.0065, 0.0045, 0.0025], thorax, 2, { region: 'frontLimb', materialSlot: 'skin' }, 4, [true, true], 1));
    });
  });
  return merge(parts);
}

/**
 * Fish — a reef swimmer: one fusiform hull with a dorsal ridge, a pale
 * keel, gill plates, a slit mouth, big glossy eyes, and a full fin set
 * (forked caudal, swept dorsal, anal, pelvic pair, pectoral pair).
 */
function createFishGeometry(profile: FaunaAnatomyProfile, ctx: BuildContext): THREE.BufferGeometry {
  const p = profile.phenotypes.fish;
  const bodyColor = speciesColor(0x557f86, profile.wingColor, 0.24);
  const headColor = speciesColor(0x73999c, profile.accentColor, 0.2);
  const bellyColor = speciesColor(0xa9c3c4, profile.woolColor, 0.2);
  const finColor = speciesColor(0x4c7178, profile.coatCool, 0.2);
  const eyeColor = speciesColor(0x142329, profile.darkColor, 0.1);
  const heightScale = 0.76 + p.bodyHeight * 0.16;
  const widthScale = 0.75 + p.bodyWidth * 0.75;
  const L = p.bodyLength / 1.1;
  const tailBaseX = -0.52 * p.bodyLength;
  const tailPivot = v3(-0.18, 0.35, 0);
  const noseX = 0.9 * p.muzzleLength / 0.58 * 0.58;
  const bodySem: SculptSemantics = { region: 'body', materialSlot: 'scale', flex: 0.05 };
  const headSem: SculptSemantics = { region: 'head', materialSlot: 'scale', flex: 0.05 };
  const tailSem = (weight: number): SculptSemantics => ({
    region: 'tail', joint: 'tail', jointPivot: tailPivot, jointWeight: weight, materialSlot: 'scale', flex: weight
  });
  const primitives: SculptPrimitive[] = [
    ell(0.04 * L, 0.36, 0, 0.46 * L, 0.21 * heightScale, 0.115 * widthScale, bodyColor, bodySem, 0.1),
    ell(0.38, 0.352, 0, 0.22, 0.155 * heightScale, 0.105 * widthScale, headColor, headSem, 0.1),
    cone(v3(0.55, 0.342), v3(noseX, 0.335), 0.09 * heightScale, 0.026, headColor, headSem, 0.06),
    chain([v3(-0.28 * L, 0.36), v3(-0.42 * L, 0.355), v3(tailBaseX, 0.35)], [0.115 * heightScale, 0.07, 0.036], bodyColor, tailSem(0.7), 0.08),
    ell(-0.36 * L, 0.36, 0, 0.12, 0.09 * heightScale, 0.06 * widthScale, bodyColor, tailSem(0.4), 0.09),
    ell(-0.02 * L, 0.505, 0, 0.26 * L, 0.075, 0.035 * widthScale, bodyColor, bodySem, 0.06),
    ell(0.05 * L, 0.215, 0, 0.30 * L, 0.07, 0.06 * widthScale, bellyColor, bodySem, 0.08),
    ell(0.31, 0.35, 0.10 * widthScale, 0.09, 0.105 * heightScale, 0.03, headColor, headSem, 0.025),
    ell(0.31, 0.35, -0.10 * widthScale, 0.09, 0.105 * heightScale, 0.03, headColor, headSem, 0.025),
    ell(noseX - 0.01, 0.325, 0, 0.055, 0.011, 0.045, headColor, headSem, 0.01, { subtract: true })
  ];
  const parts: THREE.BufferGeometry[] = [meshSculpt(primitives, { cell: ctx.cell * SCULPT_CELL.fish })];
  const caudalTipX = tailBaseX - 0.38 * p.tailLength;
  const eyeZ = 0.079 * widthScale;
  [-1, 1].forEach(side => {
    parts.push(eyeBall(v3(0.62, 0.405, side * eyeZ), 0.024, eyeColor, v3(0.3, 0.15, side * 0.94), headSem, ctx.detail));
  });
  const finSem = (joint: boolean, weight = 1): FaunaVertexSemantics => joint
    ? { region: 'fin', joint: 'fin', jointPivot: v3(tailBaseX, 0.35, 0), jointWeight: weight, materialSlot: 'membrane' }
    : { region: 'fin', materialSlot: 'membrane' };
  parts.push(
    // Forked caudal: two lobes leave a true notch.
    finFan(
      [v3(tailBaseX + 0.01, 0.375, 0), v3(tailBaseX - 0.04, 0.356, 0)],
      [v3(caudalTipX + 0.09, 0.56, 0), v3(caudalTipX + 0.03, 0.60, 0), v3(caudalTipX, 0.555, 0), v3(caudalTipX + 0.06, 0.45, 0), v3(caudalTipX + 0.1, 0.405, 0)],
      finColor, finSem(true), 0.011
    ),
    finFan(
      [v3(tailBaseX - 0.04, 0.344, 0), v3(tailBaseX + 0.01, 0.325, 0)],
      [v3(caudalTipX + 0.1, 0.295, 0), v3(caudalTipX + 0.06, 0.25, 0), v3(caudalTipX, 0.145, 0), v3(caudalTipX + 0.03, 0.10, 0), v3(caudalTipX + 0.09, 0.14, 0)],
      finColor, finSem(true), 0.011
    ),
    // Swept dorsal with a tall leading spine and a trailing sail.
    finFan(
      [v3(-0.28, 0.54, 0), v3(0.26, 0.525, 0)],
      [v3(-0.22, 0.60, 0), v3(-0.12, 0.66 + p.crest * 0.03, 0), v3(0.0, 0.70 + p.crest * 0.04, 0), v3(0.12, 0.66 + p.crest * 0.02, 0), v3(0.2, 0.59, 0)],
      finColor, finSem(false), 0.007
    ),
    finFan(
      [v3(-0.20, 0.16, 0), v3(0.12, 0.175, 0)],
      [v3(-0.14, 0.085, 0), v3(-0.02, 0.06, 0), v3(0.08, 0.11, 0)],
      finColor, finSem(false), 0.007
    )
  );
  [-1, 1].forEach(side => {
    const sideZ = side * 0.105 * widthScale;
    parts.push(
      finFan(
        [v3(0.22, 0.36, sideZ), v3(0.13, 0.30, sideZ)],
        [v3(-0.02, 0.24, side * 0.24 * widthScale), v3(0.06, 0.27, side * 0.24 * widthScale), v3(0.12, 0.30, side * 0.18 * widthScale)],
        finColor, finSem(true, 0.2), 0.006
      ),
      finFan(
        [v3(0.28, 0.24, sideZ * 0.6), v3(0.2, 0.22, sideZ * 0.6)],
        [v3(0.14, 0.12, side * 0.1 * widthScale), v3(0.22, 0.13, side * 0.1 * widthScale)],
        finColor, finSem(false), 0.005
      )
    );
  });
  return merge(parts);
}

// ---------------------------------------------------------------------------

function buildContext(detail: FaunaGeometryDetail): BuildContext {
  return {
    detail,
    cell: DETAIL_CELL_SCALE[detail],
    radial: DETAIL_RADIAL[detail],
    subdivide: detail === 'high' ? 2 : 1
  };
}

export function createFaunaGeometryForKind(
  kind: FaunaKind,
  profile: FaunaAnatomyProfile,
  detail: FaunaGeometryDetail = 'high'
): THREE.BufferGeometry {
  const ctx = buildContext(detail);
  switch (kind) {
    case 'grazer':
      return createGrazerGeometry(profile, ctx);
    case 'woolly':
      return createWoollyGeometry(profile, ctx);
    case 'runner':
      return createRunnerGeometry(profile, ctx);
    case 'hopper':
      return createHopperGeometry(profile, ctx);
    case 'dragonfly':
      return createDragonflyGeometry(profile, ctx);
    case 'fish':
      return createFishGeometry(profile, ctx);
  }
  return createGrazerGeometry(profile, ctx);
}

/** Triangle ceiling per detail tier (enforced by tests and tools/fauna-geometry-budget.ts). */
export const FAUNA_TRIANGLE_BUDGET: Readonly<Record<FaunaGeometryDetail, number>> = {
  high: 9500,
  medium: 5800,
  low: 3500
};
