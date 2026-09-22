import * as THREE from 'three';
import {
  FAUNA_JOINT_ID,
  FAUNA_MATERIAL_SLOT_ID,
  FAUNA_REGION_ID,
  type FaunaJoint,
  type FaunaMaterialSlot,
  type FaunaRegion
} from './faunaModel';

/**
 * Signed-distance sculpting for fauna bodies.
 *
 * A creature's mass (torso, neck, head, haunches, fleece, abdomen) is authored
 * as a handful of analytic primitives joined with smooth unions, then meshed
 * with naive surface nets on a bounded grid. Normals come from the field
 * gradient, so the result is a single continuous skin with no seams, no
 * intersecting hulls, and no faceting. Every mesh vertex inherits colour and
 * rig semantics (region, joint, pivot, weight) as a distance-weighted blend of
 * the primitives that shaped it, which gives soft skinning across the neck and
 * shoulders for free.
 *
 * Thin features (legs, antlers, ears, wings, fins) stay explicit tube/sheet
 * geometry in faunaGeometry.ts — a uniform grid cannot resolve them.
 */

export interface SculptSemantics {
  region: FaunaRegion;
  joint?: FaunaJoint;
  jointPivot?: THREE.Vector3;
  jointWeight?: number;
  bendPivot?: THREE.Vector3;
  bendWeight?: number;
  materialSlot?: FaunaMaterialSlot;
  /** 0..1 wind/secondary-motion pliancy sampled by the vertex shader. */
  flex?: number;
}

export interface SculptNoise {
  amplitude: number;
  frequency: number;
  seed?: number;
  /** Fractal octaves (1..3). */
  octaves?: number;
}

export interface SculptPrimitive {
  distance(x: number, y: number, z: number): number;
  readonly bounds: THREE.Box3;
  readonly color: THREE.Color;
  readonly semantics: SculptSemantics;
  /** Smooth-union radius when this primitive joins the running field. */
  readonly blend: number;
  readonly subtract: boolean;
  readonly noise?: SculptNoise;
}

export interface SculptOptions {
  /** Grid cell size in local units. Smaller = finer skin, more triangles. */
  cell: number;
  /** Extra padding around the primitive bounds (defaults to blend + noise). */
  margin?: number;
  /** Softness of the semantic weight falloff (local units). */
  semanticFalloff?: number;
}

interface PrimitiveInit {
  color: THREE.Color;
  semantics: SculptSemantics;
  blend?: number;
  subtract?: boolean;
  noise?: SculptNoise;
}

const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

// ---------------------------------------------------------------------------
// Deterministic value noise (3D), used for fleece, fur tufts, and organic wobble.

function hashInt(x: number, y: number, z: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + z * 1274126177 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

function smoothUnit(t: number): number {
  return t * t * (3 - 2 * t);
}

export function valueNoise3(x: number, y: number, z: number, seed = 0): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = smoothUnit(x - ix);
  const fy = smoothUnit(y - iy);
  const fz = smoothUnit(z - iz);
  const c000 = hashInt(ix, iy, iz, seed);
  const c100 = hashInt(ix + 1, iy, iz, seed);
  const c010 = hashInt(ix, iy + 1, iz, seed);
  const c110 = hashInt(ix + 1, iy + 1, iz, seed);
  const c001 = hashInt(ix, iy, iz + 1, seed);
  const c101 = hashInt(ix + 1, iy, iz + 1, seed);
  const c011 = hashInt(ix, iy + 1, iz + 1, seed);
  const c111 = hashInt(ix + 1, iy + 1, iz + 1, seed);
  const x00 = c000 + (c100 - c000) * fx;
  const x10 = c010 + (c110 - c010) * fx;
  const x01 = c001 + (c101 - c001) * fx;
  const x11 = c011 + (c111 - c011) * fx;
  const y0 = x00 + (x10 - x00) * fy;
  const y1 = x01 + (x11 - x01) * fy;
  return (y0 + (y1 - y0) * fz) * 2 - 1;
}

function fractalNoise(x: number, y: number, z: number, noise: SculptNoise): number {
  const octaves = clamp(Math.round(noise.octaves ?? 2), 1, 3);
  const seed = noise.seed ?? 0;
  let amplitude = 1;
  let frequency = noise.frequency;
  let sum = 0;
  let norm = 0;
  for (let octave = 0; octave < octaves; octave++) {
    sum += valueNoise3(x * frequency + octave * 17.3, y * frequency - octave * 9.1, z * frequency + octave * 4.7, seed + octave * 31) * amplitude;
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2.1;
  }
  return (sum / norm) * noise.amplitude;
}

// ---------------------------------------------------------------------------
// Primitives

function makePrimitive(
  distance: (x: number, y: number, z: number) => number,
  bounds: THREE.Box3,
  init: PrimitiveInit
): SculptPrimitive {
  return {
    distance,
    bounds,
    color: init.color.clone(),
    semantics: init.semantics,
    blend: Math.max(0.0001, init.blend ?? 0.06),
    subtract: init.subtract ?? false,
    noise: init.noise
  };
}

/**
 * Ellipsoid (Inigo Quilez's bound-improved approximation), optionally rotated.
 * `orientation` rotates the ellipsoid's local axes into creature space.
 */
export function sculptEllipsoid(
  center: THREE.Vector3,
  radii: THREE.Vector3,
  init: PrimitiveInit,
  orientation?: THREE.Quaternion
): SculptPrimitive {
  const cx = center.x;
  const cy = center.y;
  const cz = center.z;
  const rx = Math.max(1e-4, radii.x);
  const ry = Math.max(1e-4, radii.y);
  const rz = Math.max(1e-4, radii.z);
  const inverse = orientation ? orientation.clone().invert() : null;
  const maxRadius = Math.max(rx, ry, rz);
  const bounds = new THREE.Box3(
    new THREE.Vector3(cx - maxRadius, cy - maxRadius, cz - maxRadius),
    new THREE.Vector3(cx + maxRadius, cy + maxRadius, cz + maxRadius)
  );
  if (!inverse) {
    bounds.min.set(cx - rx, cy - ry, cz - rz);
    bounds.max.set(cx + rx, cy + ry, cz + rz);
  }
  const distance = (x: number, y: number, z: number): number => {
    let px = x - cx;
    let py = y - cy;
    let pz = z - cz;
    if (inverse) {
      _v.set(px, py, pz).applyQuaternion(inverse);
      px = _v.x;
      py = _v.y;
      pz = _v.z;
    }
    const ax = px / rx;
    const ay = py / ry;
    const az = pz / rz;
    const k0 = Math.sqrt(ax * ax + ay * ay + az * az);
    const bx = ax / rx;
    const by = ay / ry;
    const bz = az / rz;
    const k1 = Math.sqrt(bx * bx + by * by + bz * bz);
    if (k1 < 1e-9) return -Math.min(rx, ry, rz);
    return (k0 * (k0 - 1)) / k1;
  };
  return makePrimitive(distance, bounds, init);
}

/** Exact round cone (capsule with different end radii) between two points. */
export function sculptRoundCone(
  a: THREE.Vector3,
  b: THREE.Vector3,
  ra: number,
  rb: number,
  init: PrimitiveInit
): SculptPrimitive {
  const ax = a.x;
  const ay = a.y;
  const az = a.z;
  const bax = b.x - ax;
  const bay = b.y - ay;
  const baz = b.z - az;
  const l2 = Math.max(1e-8, bax * bax + bay * bay + baz * baz);
  const rr = ra - rb;
  const a2 = Math.max(1e-6, l2 - rr * rr);
  const il2 = 1 / l2;
  const bounds = new THREE.Box3(
    new THREE.Vector3(Math.min(a.x - ra, b.x - rb), Math.min(a.y - ra, b.y - rb), Math.min(a.z - ra, b.z - rb)),
    new THREE.Vector3(Math.max(a.x + ra, b.x + rb), Math.max(a.y + ra, b.y + rb), Math.max(a.z + ra, b.z + rb))
  );
  const distance = (x: number, y: number, z: number): number => {
    const pax = x - ax;
    const pay = y - ay;
    const paz = z - az;
    const yv = pax * bax + pay * bay + paz * baz;
    const zv = yv - l2;
    const qx = pax * l2 - bax * yv;
    const qy = pay * l2 - bay * yv;
    const qz = paz * l2 - baz * yv;
    const x2 = qx * qx + qy * qy + qz * qz;
    const y2 = yv * yv * l2;
    const z2 = zv * zv * l2;
    const k = Math.sign(rr) * rr * rr * x2;
    if (Math.sign(zv) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - rb;
    if (Math.sign(yv) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - ra;
    return (Math.sqrt(x2 * a2 * il2) + yv * rr) * il2 - ra;
  };
  return makePrimitive(distance, bounds, init);
}

/**
 * Smooth chain of round cones through `points` with per-point radii. Used for
 * necks, tails, and segmented insect abdomens.
 */
export function sculptChain(
  points: readonly THREE.Vector3[],
  radii: readonly number[],
  init: PrimitiveInit,
  linkBlend = 0.02
): SculptPrimitive {
  const links: SculptPrimitive[] = [];
  for (let index = 0; index < points.length - 1; index++) {
    links.push(sculptRoundCone(
      points[index],
      points[index + 1],
      radii[Math.min(index, radii.length - 1)],
      radii[Math.min(index + 1, radii.length - 1)],
      init
    ));
  }
  const bounds = new THREE.Box3();
  for (const link of links) bounds.union(link.bounds);
  const distance = (x: number, y: number, z: number): number => {
    let d = Infinity;
    for (const link of links) d = smoothMin(d, link.distance(x, y, z), linkBlend);
    return d;
  };
  return makePrimitive(distance, bounds, init);
}

// ---------------------------------------------------------------------------
// Field composition

export function smoothMin(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

function smoothMax(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.max(a, b) + h * h * k * 0.25;
}

function primitiveDistance(primitive: SculptPrimitive, x: number, y: number, z: number): number {
  let d = primitive.distance(x, y, z);
  if (primitive.noise) d += fractalNoise(x, y, z, primitive.noise);
  return d;
}

function outsidePad(primitive: SculptPrimitive, x: number, y: number, z: number, pad: number): boolean {
  const b = primitive.bounds;
  return x < b.min.x - pad || x > b.max.x + pad
    || y < b.min.y - pad || y > b.max.y + pad
    || z < b.min.z - pad || z > b.max.z + pad;
}

export class SculptField {
  readonly unions: SculptPrimitive[];
  readonly subtracts: SculptPrimitive[];
  private readonly pads: number[];
  private readonly subtractPads: number[];

  constructor(primitives: readonly SculptPrimitive[]) {
    this.unions = primitives.filter(primitive => !primitive.subtract);
    this.subtracts = primitives.filter(primitive => primitive.subtract);
    this.pads = this.unions.map(primitive => primitive.blend + (primitive.noise?.amplitude ?? 0) + 0.06);
    this.subtractPads = this.subtracts.map(primitive => primitive.blend + 0.04);
  }

  evaluate(x: number, y: number, z: number): number {
    let d = Infinity;
    const unions = this.unions;
    for (let index = 0; index < unions.length; index++) {
      const primitive = unions[index];
      if (outsidePad(primitive, x, y, z, this.pads[index])) continue;
      d = smoothMin(d, primitiveDistance(primitive, x, y, z), primitive.blend);
    }
    if (d === Infinity) return 1;
    const subtracts = this.subtracts;
    for (let index = 0; index < subtracts.length; index++) {
      const primitive = subtracts[index];
      if (outsidePad(primitive, x, y, z, this.subtractPads[index])) continue;
      d = smoothMax(d, -primitiveDistance(primitive, x, y, z), primitive.blend);
    }
    return d;
  }

  bounds(margin: number): THREE.Box3 {
    const box = new THREE.Box3();
    for (const primitive of this.unions) box.union(primitive.bounds);
    box.expandByScalar(margin);
    return box;
  }
}

// ---------------------------------------------------------------------------
// Surface nets mesher

const CORNER_OFFSETS: ReadonlyArray<readonly [number, number, number]> = [
  [0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0],
  [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]
];
const CELL_EDGES: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [2, 3], [4, 5], [6, 7],
  [0, 2], [1, 3], [4, 6], [5, 7],
  [0, 4], [1, 5], [2, 6], [3, 7]
];

/**
 * Meshes the zero iso-surface of `field` with naive surface nets. Returns an
 * indexed geometry with gradient normals, blended vertex colours, uv, and the
 * fauna rig attributes. Triangles are wound outward (front-face culling safe).
 */
export function meshSculpt(primitives: readonly SculptPrimitive[], options: SculptOptions): THREE.BufferGeometry {
  const field = new SculptField(primitives);
  const cell = Math.max(0.004, options.cell);
  let margin = options.margin ?? 0;
  for (const primitive of field.unions) {
    margin = Math.max(margin, primitive.blend * 0.5 + (primitive.noise?.amplitude ?? 0) + cell * 2);
  }
  const box = field.bounds(margin);
  const size = box.getSize(new THREE.Vector3());
  const nx = Math.min(220, Math.ceil(size.x / cell) + 1);
  const ny = Math.min(220, Math.ceil(size.y / cell) + 1);
  const nz = Math.min(220, Math.ceil(size.z / cell) + 1);
  const hx = size.x / (nx - 1);
  const hy = size.y / (ny - 1);
  const hz = size.z / (nz - 1);
  const ox = box.min.x;
  const oy = box.min.y;
  const oz = box.min.z;

  const values = new Float32Array(nx * ny * nz);
  const sampleIndex = (i: number, j: number, k: number) => (k * ny + j) * nx + i;
  for (let k = 0; k < nz; k++) {
    const z = oz + k * hz;
    for (let j = 0; j < ny; j++) {
      const y = oy + j * hy;
      const row = (k * ny + j) * nx;
      for (let i = 0; i < nx; i++) {
        values[row + i] = field.evaluate(ox + i * hx, y, z);
      }
    }
  }

  const cellsX = nx - 1;
  const cellsY = ny - 1;
  const cellsZ = nz - 1;
  const cellVertex = new Int32Array(cellsX * cellsY * cellsZ).fill(-1);
  const cellIndex = (i: number, j: number, k: number) => (k * cellsY + j) * cellsX + i;
  const positions: number[] = [];
  const corner = new Float32Array(8);
  for (let k = 0; k < cellsZ; k++) {
    for (let j = 0; j < cellsY; j++) {
      for (let i = 0; i < cellsX; i++) {
        let mask = 0;
        for (let c = 0; c < 8; c++) {
          const [di, dj, dk] = CORNER_OFFSETS[c];
          const value = values[sampleIndex(i + di, j + dj, k + dk)];
          corner[c] = value;
          if (value < 0) mask |= 1 << c;
        }
        if (mask === 0 || mask === 255) continue;
        let sx = 0;
        let sy = 0;
        let sz = 0;
        let crossings = 0;
        for (const [ea, eb] of CELL_EDGES) {
          const va = corner[ea];
          const vb = corner[eb];
          if ((va < 0) === (vb < 0)) continue;
          const t = va / (va - vb);
          const [ai, aj, ak] = CORNER_OFFSETS[ea];
          const [bi, bj, bk] = CORNER_OFFSETS[eb];
          sx += ai + (bi - ai) * t;
          sy += aj + (bj - aj) * t;
          sz += ak + (bk - ak) * t;
          crossings++;
        }
        if (crossings === 0) continue;
        cellVertex[cellIndex(i, j, k)] = positions.length / 3;
        positions.push(
          ox + (i + sx / crossings) * hx,
          oy + (j + sy / crossings) * hy,
          oz + (k + sz / crossings) * hz
        );
      }
    }
  }

  const indices: number[] = [];
  const pushQuad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) {
      const swap = b;
      b = d;
      d = swap;
    }
    pushTriangle(positions, indices, a, b, c);
    pushTriangle(positions, indices, a, c, d);
  };
  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const v0 = values[sampleIndex(i, j, k)];
        const inside0 = v0 < 0;
        // Edge along +x: quad spans cells (j-1..j, k-1..k). Vertex order
        // (y-,z-),(y+,z-),(y+,z+),(y-,z+) faces +x; flip when inside is at +x.
        if (i < cellsX && j > 0 && k > 0 && j < ny - 1 && k < nz - 1) {
          const v1 = values[sampleIndex(i + 1, j, k)];
          if ((v1 < 0) !== inside0) {
            pushQuad(
              cellVertex[cellIndex(i, j - 1, k - 1)],
              cellVertex[cellIndex(i, j, k - 1)],
              cellVertex[cellIndex(i, j, k)],
              cellVertex[cellIndex(i, j - 1, k)],
              !inside0
            );
          }
        }
        // Edge along +y: order (z-,x-),(z+,x-),(z+,x+),(z-,x+) faces +y.
        if (j < cellsY && i > 0 && k > 0 && i < nx - 1 && k < nz - 1) {
          const v1 = values[sampleIndex(i, j + 1, k)];
          if ((v1 < 0) !== inside0) {
            pushQuad(
              cellVertex[cellIndex(i - 1, j, k - 1)],
              cellVertex[cellIndex(i - 1, j, k)],
              cellVertex[cellIndex(i, j, k)],
              cellVertex[cellIndex(i, j, k - 1)],
              !inside0
            );
          }
        }
        // Edge along +z: order (x-,y-),(x+,y-),(x+,y+),(x-,y+) faces +z.
        if (k < cellsZ && i > 0 && j > 0 && i < nx - 1 && j < ny - 1) {
          const v1 = values[sampleIndex(i, j, k + 1)];
          if ((v1 < 0) !== inside0) {
            pushQuad(
              cellVertex[cellIndex(i - 1, j - 1, k)],
              cellVertex[cellIndex(i, j - 1, k)],
              cellVertex[cellIndex(i, j, k)],
              cellVertex[cellIndex(i - 1, j, k)],
              !inside0
            );
          }
        }
      }
    }
  }

  const vertexCount = positions.length / 3;
  const positionArray = new Float32Array(positions);
  const normals = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const flex = new Float32Array(vertexCount);
  const surface = new Float32Array(vertexCount * 4);
  const pivots = new Float32Array(vertexCount * 3);
  const bends = new Float32Array(vertexCount * 4);
  const uv = new Float32Array(vertexCount * 2);
  const eps = Math.min(hx, hy, hz) * 0.4;
  const falloff = options.semanticFalloff ?? 0.035;
  const unions = field.unions;
  const weights = new Float64Array(unions.length);
  const jointScore = new Float64Array(FAUNA_JOINT_ID.fin + 1);
  const regionScore = new Float64Array(FAUNA_REGION_ID.fleece + 1);
  const slotScore = new Float64Array(FAUNA_MATERIAL_SLOT_ID.bioluminescent + 1);
  const spanX = Math.max(1e-4, size.x);
  const spanZ = Math.max(1e-4, size.z);

  for (let vertex = 0; vertex < vertexCount; vertex++) {
    const x = positionArray[vertex * 3];
    const y = positionArray[vertex * 3 + 1];
    const z = positionArray[vertex * 3 + 2];
    // Gradient normal.
    let gx = field.evaluate(x + eps, y, z) - field.evaluate(x - eps, y, z);
    let gy = field.evaluate(x, y + eps, z) - field.evaluate(x, y - eps, z);
    let gz = field.evaluate(x, y, z + eps) - field.evaluate(x, y, z - eps);
    const length = Math.hypot(gx, gy, gz);
    if (length > 1e-9) {
      gx /= length;
      gy /= length;
      gz /= length;
    } else {
      gx = 0;
      gy = 1;
      gz = 0;
    }
    normals[vertex * 3] = gx;
    normals[vertex * 3 + 1] = gy;
    normals[vertex * 3 + 2] = gz;

    // Semantic blend: every union primitive votes with exp(-distance/falloff).
    let total = 0;
    for (let index = 0; index < unions.length; index++) {
      const d = Math.max(0, primitiveDistance(unions[index], x, y, z));
      const w = Math.exp(-d / falloff);
      weights[index] = w;
      total += w;
    }
    if (total < 1e-12) {
      weights.fill(1 / unions.length);
      total = 1;
    }
    jointScore.fill(0);
    regionScore.fill(0);
    slotScore.fill(0);
    let r = 0;
    let g = 0;
    let b = 0;
    let flexSum = 0;
    let bendWeightSum = 0;
    let bestIndex = 0;
    let bestWeight = -1;
    for (let index = 0; index < unions.length; index++) {
      const w = weights[index] / total;
      const primitive = unions[index];
      const semantics = primitive.semantics;
      r += primitive.color.r * w;
      g += primitive.color.g * w;
      b += primitive.color.b * w;
      flexSum += (semantics.flex ?? 0) * w;
      regionScore[FAUNA_REGION_ID[semantics.region]] += w;
      slotScore[FAUNA_MATERIAL_SLOT_ID[semantics.materialSlot ?? 'coat']] += w;
      const jointWeight = clamp(semantics.jointWeight ?? 0, 0, 1);
      if (semantics.joint && jointWeight > 0) {
        jointScore[FAUNA_JOINT_ID[semantics.joint]] += w * jointWeight;
        // Unweighted remainder votes for the rigid root so a mostly-body
        // vertex near a joint keeps most of its mass still.
        jointScore[FAUNA_JOINT_ID.root] += w * (1 - jointWeight);
      } else {
        jointScore[FAUNA_JOINT_ID.root] += w;
      }
      bendWeightSum += w * clamp(semantics.bendWeight ?? 0, 0, 1);
      if (w > bestWeight) {
        bestWeight = w;
        bestIndex = index;
      }
    }
    // The strongest non-root joint owns the vertex whenever it carries real
    // influence; its blended weight (not a hard 1) is what the shader rotates by.
    let joint = FAUNA_JOINT_ID.root;
    let jointBest = 0;
    for (let id = 0; id < jointScore.length; id++) {
      if (id === FAUNA_JOINT_ID.root) continue;
      if (jointScore[id] > jointBest) {
        jointBest = jointScore[id];
        joint = id;
      }
    }
    if (jointBest < 0.02) joint = FAUNA_JOINT_ID.root;
    const jointWeightSum = jointBest;
    let region = FAUNA_REGION_ID[unions[bestIndex].semantics.region];
    let regionBest = -1;
    for (let id = 0; id < regionScore.length; id++) {
      if (regionScore[id] > regionBest) {
        regionBest = regionScore[id];
        region = id;
      }
    }
    let slot = FAUNA_MATERIAL_SLOT_ID.coat;
    let slotBest = -1;
    for (let id = 0; id < slotScore.length; id++) {
      if (slotScore[id] > slotBest) {
        slotBest = slotScore[id];
        slot = id;
      }
    }
    // Pivot: the heaviest primitive that belongs to the chosen joint.
    let pivotPrimitive: SculptPrimitive | null = null;
    let pivotWeight = -1;
    let bendPrimitive: SculptPrimitive | null = null;
    let bendWeight = -1;
    for (let index = 0; index < unions.length; index++) {
      const semantics = unions[index].semantics;
      if (semantics.joint && FAUNA_JOINT_ID[semantics.joint] === joint && weights[index] > pivotWeight) {
        pivotWeight = weights[index];
        pivotPrimitive = unions[index];
      }
      if ((semantics.bendWeight ?? 0) > 0 && weights[index] > bendWeight) {
        bendWeight = weights[index];
        bendPrimitive = unions[index];
      }
    }
    const pivot = pivotPrimitive?.semantics.jointPivot ?? _v.set(0, 0, 0);
    const bendPivot = bendPrimitive?.semantics.bendPivot ?? pivot;
    colors[vertex * 3] = r;
    colors[vertex * 3 + 1] = g;
    colors[vertex * 3 + 2] = b;
    flex[vertex] = clamp(flexSum, 0, 1);
    surface[vertex * 4] = region;
    surface[vertex * 4 + 1] = joint;
    surface[vertex * 4 + 2] = joint === FAUNA_JOINT_ID.root ? 0 : clamp(jointWeightSum, 0, 1);
    surface[vertex * 4 + 3] = slot;
    pivots[vertex * 3] = pivot.x;
    pivots[vertex * 3 + 1] = pivot.y;
    pivots[vertex * 3 + 2] = pivot.z;
    bends[vertex * 4] = bendPivot.x;
    bends[vertex * 4 + 1] = bendPivot.y;
    bends[vertex * 4 + 2] = bendPivot.z;
    bends[vertex * 4 + 3] = clamp(bendWeightSum, 0, 1);
    uv[vertex * 2] = (x - ox) / spanX;
    uv[vertex * 2 + 1] = (z - oz) / spanZ;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positionArray, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aFaunaFlex', new THREE.BufferAttribute(flex, 1));
  geometry.setAttribute('aFaunaSurface', new THREE.BufferAttribute(surface, 4));
  geometry.setAttribute('aFaunaJointPivot', new THREE.BufferAttribute(pivots, 3));
  geometry.setAttribute('aFaunaBend', new THREE.BufferAttribute(bends, 4));
  geometry.setIndex(indices);
  return geometry;
}

function pushTriangle(positions: number[], indices: number[], a: number, b: number, c: number): void {
  if (a === b || b === c || a === c) return;
  const ax = positions[a * 3];
  const ay = positions[a * 3 + 1];
  const az = positions[a * 3 + 2];
  const abx = positions[b * 3] - ax;
  const aby = positions[b * 3 + 1] - ay;
  const abz = positions[b * 3 + 2] - az;
  const acx = positions[c * 3] - ax;
  const acy = positions[c * 3 + 1] - ay;
  const acz = positions[c * 3 + 2] - az;
  const cx = aby * acz - abz * acy;
  const cy = abz * acx - abx * acz;
  const cz = abx * acy - aby * acx;
  // Surface nets can pinch a sliver on a grazing cell; drop it rather than
  // ship a zero-area face.
  if (cx * cx + cy * cy + cz * cz < 1e-13) return;
  indices.push(a, b, c);
}

/** Quaternion that tilts an ellipsoid's +x axis toward `direction`. */
export function orientAlong(direction: THREE.Vector3): THREE.Quaternion {
  return _q.clone().setFromUnitVectors(new THREE.Vector3(1, 0, 0), direction.clone().normalize());
}
