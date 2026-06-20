import * as THREE from 'three';

// --- Procedural tree archetype generator (space colonization) ----------------
//
// Pure, deterministic, NO GLSL. Given a seed we:
//   1. Scatter attractor points in a crown volume (an ellipsoid sitting above
//      the trunk base) with a seeded hash RNG.
//   2. Grow a node graph upward from the root: each iteration every attractor
//      pulls its nearest node, nodes step toward the averaged pull direction,
//      and attractors inside a kill radius are consumed. Standard Runions/Palubicki
//      space colonization, iteration-capped.
//   3. Build TRUNK/BRANCH geometry: tapered tube rings swept along each node->
//      parent segment, radius tapering with branch order + distance from root.
//      Per-vertex attribute `aStiff` (0 at root -> 1 at tips) drives wind.
//   4. Build LEAF geometry: camera-agnostic quad cards at branch tips / young
//      nodes, merged into one BufferGeometry. Each card carries `aPhase` (wind
//      flutter offset) and `aStiff` (~1, also a stiffness ref).
//
// Output: { trunkGeometry, leafGeometry } in LOCAL space — origin at the trunk
// base, growing along +Y. Modest size (~4-7 world units tall) so it reads
// against 2-unit voxels. TreeField instances this archetype across the planet.

export interface TreeArchetype {
  trunkGeometry: THREE.BufferGeometry;
  leafGeometry: THREE.BufferGeometry;
}

export interface TreeGenParams {
  /** Approx total tree height in world units. */
  height: number;
  /** Crown (attractor cloud) ellipsoid radius in world units. */
  crownRadius: number;
  /** Vertical center of the crown above the base (fraction of height). */
  crownCenterFrac: number;
  /** Number of attractor points scattered in the crown. */
  attractorCount: number;
  /** Distance a node steps toward attractors each iteration. */
  growStep: number;
  /** Attractors within killRadius*growStep of a node are consumed. */
  killRadiusMul: number;
  /** Attractors only influence nodes within influenceRadiusMul*growStep. */
  influenceRadiusMul: number;
  /** Hard cap on growth iterations. */
  maxIterations: number;
  /** Trunk base radius in world units. */
  baseRadius: number;
  /** Radial segments per tube ring (low-poly stylized). */
  radialSegments: number;
  /** Half-size of a leaf card in world units. */
  leafSize: number;
  /** Max leaf cards placed (keeps vert count bounded). */
  maxLeafCards: number;
}

export const DEFAULT_TREE_PARAMS: TreeGenParams = {
  height: 5.5,
  crownRadius: 2.1,
  crownCenterFrac: 0.72,
  attractorCount: 260,
  growStep: 0.32,
  killRadiusMul: 2.0,
  influenceRadiusMul: 8.0,
  maxIterations: 240,
  baseRadius: 0.32,
  radialSegments: 5,
  leafSize: 0.55,
  maxLeafCards: 320
};

// --- Seeded hash RNG ---------------------------------------------------------
// Deterministic: same seed -> same stream. Mulberry32 driven by a hashed seed.
function makeRng(seed: number): () => number {
  let s = (seed * 1831565813 + 1013904223) >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface GrowNode {
  pos: THREE.Vector3;
  parent: number; // index into nodes, -1 for root
  order: number; // branch order (0 trunk-ish, grows with branching depth)
  dist: number; // graph distance from root (in steps)
}

// --- Space colonization ------------------------------------------------------
function growSkeleton(params: TreeGenParams, rng: () => number): GrowNode[] {
  const {
    height,
    crownRadius,
    crownCenterFrac,
    attractorCount,
    growStep,
    killRadiusMul,
    influenceRadiusMul,
    maxIterations
  } = params;

  const killRadius = killRadiusMul * growStep;
  const influenceRadius = influenceRadiusMul * growStep;
  const crownCenterY = height * crownCenterFrac;

  // Scatter attractors in an ellipsoid (slightly squashed vertically) above base.
  const attractors: THREE.Vector3[] = [];
  let guard = 0;
  while (attractors.length < attractorCount && guard < attractorCount * 20) {
    guard++;
    // rejection-sample a unit ball
    const x = rng() * 2 - 1;
    const y = rng() * 2 - 1;
    const z = rng() * 2 - 1;
    if (x * x + y * y + z * z > 1) continue;
    attractors.push(
      new THREE.Vector3(
        x * crownRadius,
        crownCenterY + y * crownRadius * 1.05,
        z * crownRadius
      )
    );
  }

  // Seed nodes: a short straight trunk reaching toward the crown so the first
  // attractors have something to pull on (otherwise growth can stall).
  const nodes: GrowNode[] = [];
  nodes.push({ pos: new THREE.Vector3(0, 0, 0), parent: -1, order: 0, dist: 0 });
  const trunkSeedTop = Math.max(0, crownCenterY - crownRadius * 0.9);
  const seedSteps = Math.max(1, Math.floor(trunkSeedTop / growStep));
  for (let i = 1; i <= seedSteps; i++) {
    nodes.push({
      pos: new THREE.Vector3(0, i * growStep, 0),
      parent: i - 1,
      order: 0,
      dist: i
    });
  }

  const alive = new Array(attractors.length).fill(true);
  let remaining = attractors.length;
  const pull = new THREE.Vector3();
  const dir = new THREE.Vector3();

  for (let iter = 0; iter < maxIterations && remaining > 0; iter++) {
    // For each node accumulate the averaged direction toward influencing attractors.
    const influence = new Map<number, THREE.Vector3>();

    for (let a = 0; a < attractors.length; a++) {
      if (!alive[a]) continue;
      const ap = attractors[a];
      // nearest node
      let best = -1;
      let bestD = Infinity;
      for (let n = 0; n < nodes.length; n++) {
        const d = nodes[n].pos.distanceToSquared(ap);
        if (d < bestD) {
          bestD = d;
          best = n;
        }
      }
      if (best < 0) continue;
      const bd = Math.sqrt(bestD);
      if (bd > influenceRadius) continue;
      dir.copy(ap).sub(nodes[best].pos).normalize();
      const acc = influence.get(best);
      if (acc) acc.add(dir);
      else influence.set(best, dir.clone());
    }

    if (influence.size === 0) break; // nothing in range; stop

    // Spawn a new node from each influenced node, stepping toward the mean pull.
    const newNodes: GrowNode[] = [];
    influence.forEach((sum, nodeIdx) => {
      if (sum.lengthSq() < 1e-8) return;
      pull.copy(sum).normalize();
      const parent = nodes[nodeIdx];
      const np = parent.pos.clone().addScaledVector(pull, growStep);
      // Branch order increases when a node sprouts more than one child over its
      // lifetime; approximate by bumping order if the parent already has a child.
      const childCount = newNodes.filter(nn => nn.parent === nodeIdx).length;
      newNodes.push({
        pos: np,
        parent: nodeIdx,
        order: parent.order + (childCount > 0 ? 1 : 0),
        dist: parent.dist + 1
      });
    });

    if (newNodes.length === 0) break;
    const base = nodes.length;
    for (let i = 0; i < newNodes.length; i++) {
      // remap parent indices unchanged (they reference existing nodes)
      nodes.push(newNodes[i]);
    }
    void base;

    // Kill attractors close to ANY node (consumed).
    for (let a = 0; a < attractors.length; a++) {
      if (!alive[a]) continue;
      const ap = attractors[a];
      for (let n = 0; n < nodes.length; n++) {
        if (nodes[n].pos.distanceToSquared(ap) <= killRadius * killRadius) {
          alive[a] = false;
          remaining--;
          break;
        }
      }
    }
  }

  return nodes;
}

// Count descendants per node so we can taper radius by "how much wood hangs above".
function computeSubtreeWeight(nodes: GrowNode[]): number[] {
  const children: number[][] = nodes.map(() => []);
  for (let i = 0; i < nodes.length; i++) {
    const p = nodes[i].parent;
    if (p >= 0) children[p].push(i);
  }
  const weight = new Array(nodes.length).fill(1);
  // process in reverse (children created after parents -> higher index)
  for (let i = nodes.length - 1; i >= 0; i--) {
    for (const c of children[i]) weight[i] += weight[c];
  }
  return weight;
}

// --- Trunk / branch tube geometry -------------------------------------------
function buildTrunkGeometry(
  nodes: GrowNode[],
  params: TreeGenParams
): THREE.BufferGeometry {
  const { baseRadius, radialSegments } = params;
  const weight = computeSubtreeWeight(nodes);
  const rootWeight = weight[0] || 1;
  const maxDist = nodes.reduce((m, n) => Math.max(m, n.dist), 1);

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const stiff: number[] = [];
  const indices: number[] = [];

  const up = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const bitangent = new THREE.Vector3();
  const ringCenters: THREE.Vector3[] = [];

  // radius for a node: scales with sqrt(subtree weight) so trunk is fat, twigs thin.
  const radiusFor = (i: number) => {
    const w = weight[i] / rootWeight;
    const r = baseRadius * Math.sqrt(Math.max(w, 0.0001));
    return Math.max(r, baseRadius * 0.07);
  };

  // For every node with a parent, emit a tube segment (two rings) between
  // parent and node. Rings are duplicated per-segment (no shared welding) which
  // is cheap and fine for a low-poly stylized trunk.
  for (let i = 1; i < nodes.length; i++) {
    const node = nodes[i];
    const parent = nodes[node.parent];
    up.copy(node.pos).sub(parent.pos);
    const segLen = up.length();
    if (segLen < 1e-5) continue;
    up.normalize();

    // a tangent perpendicular to the segment axis
    if (Math.abs(up.y) < 0.95) tangent.set(0, 1, 0).cross(up).normalize();
    else tangent.set(1, 0, 0).cross(up).normalize();
    bitangent.copy(up).cross(tangent).normalize();

    const rParent = radiusFor(node.parent);
    const rNode = radiusFor(i);
    const stiffParent = 1 - parent.dist / maxDist; // root~1
    const stiffNode = 1 - node.dist / maxDist;
    // We want aStiff = 0 at root, 1 at tips, so invert: stiffness of the spring
    // is HIGH at root. We store "flexibility" = 1 - that, so tips bend most.
    const flexParent = parent.dist / maxDist;
    const flexNode = node.dist / maxDist;
    void stiffParent;
    void stiffNode;

    const baseIdx = positions.length / 3;
    ringCenters.length = 0;
    ringCenters.push(parent.pos, node.pos);
    const rings = [rParent, rNode];
    const flex = [flexParent, flexNode];

    for (let ring = 0; ring < 2; ring++) {
      const c = ringCenters[ring];
      const r = rings[ring];
      for (let s = 0; s <= radialSegments; s++) {
        const ang = (s / radialSegments) * Math.PI * 2;
        const ca = Math.cos(ang);
        const sa = Math.sin(ang);
        const nx = tangent.x * ca + bitangent.x * sa;
        const ny = tangent.y * ca + bitangent.y * sa;
        const nz = tangent.z * ca + bitangent.z * sa;
        positions.push(c.x + nx * r, c.y + ny * r, c.z + nz * r);
        normals.push(nx, ny, nz);
        uvs.push(s / radialSegments, ring);
        stiff.push(flex[ring]);
      }
    }

    const cols = radialSegments + 1;
    for (let s = 0; s < radialSegments; s++) {
      const a = baseIdx + s;
      const b = baseIdx + s + 1;
      const c = baseIdx + cols + s;
      const d = baseIdx + cols + s + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('aStiff', new THREE.Float32BufferAttribute(stiff, 1));
  geo.setIndex(indices);
  geo.computeBoundingSphere();
  return geo;
}

// --- Leaf card geometry ------------------------------------------------------
// A leaf card is a quad centred on a tip/young node, oriented with a random-ish
// basis so the canopy isn't all coplanar. Cards are pre-merged. Each card gets
// an aPhase (random) for wind flutter and aStiff ~1 (tips flex most).
function buildLeafGeometry(
  nodes: GrowNode[],
  params: TreeGenParams,
  rng: () => number
): THREE.BufferGeometry {
  const { leafSize, maxLeafCards } = params;
  const maxDist = nodes.reduce((m, n) => Math.max(m, n.dist), 1);

  // Candidate nodes: leaf-ish = tips (no children) plus young high nodes.
  const childCount = new Array(nodes.length).fill(0);
  for (const n of nodes) if (n.parent >= 0) childCount[n.parent]++;

  const candidates: number[] = [];
  for (let i = 1; i < nodes.length; i++) {
    const isTip = childCount[i] === 0;
    const young = nodes[i].dist / maxDist > 0.45;
    if (isTip || young) candidates.push(i);
  }

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const stiff: number[] = [];
  const phase: number[] = [];
  const indices: number[] = [];

  const u = new THREE.Vector3();
  const v = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  // Cards per candidate, scaled so we hit roughly maxLeafCards.
  const cardsPerCandidate = Math.max(1, Math.round(maxLeafCards / Math.max(candidates.length, 1)));
  let placed = 0;

  for (const idx of candidates) {
    if (placed >= maxLeafCards) break;
    const center = nodes[idx].pos;
    for (let c = 0; c < cardsPerCandidate && placed < maxLeafCards; c++) {
      // random orientation basis from two hashed directions
      u.set(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1);
      if (u.lengthSq() < 1e-6) u.set(1, 0, 0);
      u.normalize();
      tmp.set(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1);
      v.copy(tmp).sub(u.clone().multiplyScalar(tmp.dot(u)));
      if (v.lengthSq() < 1e-6) v.set(0, 1, 0);
      v.normalize();
      nrm.copy(u).cross(v).normalize();

      // small offset off the node so cards form a puff, not a single point
      const offMag = leafSize * 0.8;
      const ox = (rng() * 2 - 1) * offMag;
      const oy = (rng() * 2 - 1) * offMag;
      const oz = (rng() * 2 - 1) * offMag;
      const cx = center.x + ox;
      const cy = center.y + oy;
      const cz = center.z + oz;

      const hs = leafSize * (0.7 + rng() * 0.6);
      const base = positions.length / 3;
      const ph = rng() * Math.PI * 2;
      const fl = Math.min(1, 0.7 + nodes[idx].dist / maxDist * 0.5);

      // 4 corners: (-u-v),(+u-v),(+u+v),(-u+v)
      const corners: [number, number][] = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1]
      ];
      const cuv: [number, number][] = [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1]
      ];
      for (let k = 0; k < 4; k++) {
        const [su, sv] = corners[k];
        positions.push(
          cx + (u.x * su + v.x * sv) * hs,
          cy + (u.y * su + v.y * sv) * hs,
          cz + (u.z * su + v.z * sv) * hs
        );
        normals.push(nrm.x, nrm.y, nrm.z);
        uvs.push(cuv[k][0], cuv[k][1]);
        stiff.push(fl);
        phase.push(ph);
      }
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
      placed++;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('aStiff', new THREE.Float32BufferAttribute(stiff, 1));
  geo.setAttribute('aPhase', new THREE.Float32BufferAttribute(phase, 1));
  geo.setIndex(indices);
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Generate one deterministic tree archetype (trunk + leaves) for `seed`.
 * Same seed + params always yields identical geometry (vertex counts and
 * positions). Geometry is in LOCAL space, origin at trunk base, +Y up.
 */
export function generateTree(
  seed: number,
  params: TreeGenParams = DEFAULT_TREE_PARAMS
): TreeArchetype {
  const rng = makeRng(seed);
  const nodes = growSkeleton(params, rng);
  const trunkGeometry = buildTrunkGeometry(nodes, params);
  const leafGeometry = buildLeafGeometry(nodes, params, rng);
  return { trunkGeometry, leafGeometry };
}
