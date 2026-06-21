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
  /** Blossom cards (subset of leaf clusters); empty when bloomAmount is 0. */
  blossomGeometry: THREE.BufferGeometry;
  /** 2-quad cross billboard for far-distance LOD. */
  impostorGeometry: THREE.BufferGeometry;
}

export type TreeSilhouette =
  | 'round'
  | 'conical'
  | 'umbrella'
  | 'weeping'
  | 'wispy'
  | 'frond';

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
  /** Read-at-a-glance canopy shape; reshapes the attractor cloud + leaf placement. */
  silhouette?: TreeSilhouette;
  /** Trunk lean magnitude in radians (already clamped <=0.35). */
  leanTwist?: number;
  /** 0..1 fraction of leaf clusters baked as flowering (drives aFlower). */
  bloomAmount?: number;
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
  maxLeafCards: 420,
  silhouette: 'round',
  leanTwist: 0,
  bloomAmount: 0
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

export interface GrowNode {
  pos: THREE.Vector3;
  parent: number; // index into nodes, -1 for root
  order: number; // branch order (0 trunk, grows with branching depth)
  dist: number; // graph distance from root (in steps)
}

/**
 * Which skeleton nodes carry leaf clusters, per silhouette. Pure + exported so
 * the placement rule is unit-testable. The default (round/conical/umbrella) rule
 * is the approved canopy look; frond + weeping/wispy are restricted to OUTER
 * foliage so leaves don't sprout along their bare drooping stems.
 */
export function selectLeafCandidates(
  nodes: GrowNode[],
  silhouette: TreeSilhouette
): number[] {
  const maxDist = nodes.reduce((m, n) => Math.max(m, n.dist), 1);
  const maxOrder = nodes.reduce((m, n) => Math.max(m, n.order), 0);
  const childCount = new Array(nodes.length).fill(0);
  for (const n of nodes) if (n.parent >= 0) childCount[n.parent]++;

  const candidates: number[] = [];
  for (let i = 1; i < nodes.length; i++) {
    const isTip = childCount[i] === 0;
    const node = nodes[i];
    let ok: boolean;
    if (silhouette === 'frond') {
      // Inner rib + trunk are order 0 (bare); outer rib is order 1 (foliage).
      ok = node.order >= 1;
    } else if (silhouette === 'weeping' || silhouette === 'wispy') {
      // Outer droops only: a real branch (not trunk) AND a tip or far-out node.
      ok = node.order >= 1 && (isTip || node.dist >= maxDist * 0.65);
    } else {
      ok = isTip || node.order >= maxOrder - 1;
    }
    if (ok) candidates.push(i);
  }
  return candidates;
}

// --- Recursive L-system branching (replaces space colonization) --------------
//
// The old space-colonization crown read flat + non-fractal. This builds a
// genuinely RECURSIVE skeleton: trunk -> primary -> secondary -> twig, where
// every level emits `children` sub-branches plus an apical "leader shoot" that
// continues the dominant line (so the trunk stays believable). order increments
// per recursion level, so the existing radiusFor() (sqrt subtree weight) tapers
// trunk->twig automatically, and length *= lenFalloff per level gives the
// self-similar feel. Children diverge by the GOLDEN ANGLE around the branch
// axis -> spiral phyllotactic forks. Bounded by levels<=4, children<=3, NODE_CAP.

// A perpendicular unit vector to d (stable: avoids the degenerate parallel case).
function twPerp(d: THREE.Vector3): THREE.Vector3 {
  const a =
    Math.abs(d.y) < 0.95 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  return a.cross(d).normalize();
}

interface LSParams {
  levels: number;
  children: number;
  angle: number;
  twist: number;
  lenFalloff: number;
  segs: number;
  upLerp: number;
}

// Map the existing silhouette/density knobs to L-system tuning. Deterministic
// and bounded — no new TreeGenParams required (the overhaul derives everything
// from params already on disk).
function lsFromParams(p: TreeGenParams): LSParams {
  const density = Math.min(1, Math.max(0.4, p.attractorCount / 260));
  const base: LSParams = {
    levels: 3,
    children: 3,
    angle: 0.6,
    twist: 2.39996, // golden angle (radians)
    lenFalloff: 0.72,
    segs: 5,
    upLerp: 0.03
  };
  switch (p.silhouette) {
    case 'conical':
      return { ...base, levels: 4, children: 2, angle: 0.42, upLerp: 0.1, segs: 6 };
    case 'umbrella':
      // Broad dome (acacia-like). Uses the round tree's proven branching (moderate
      // angle + climbing upLerp) so foliage domes UP; the WIDER crownRadius (2.6,
      // from silhouettePreset) is what makes it broad. The old wide angle 0.85 +
      // negative upLerp fanned sub-branches DOWNWARD -> drooping "upside-down" canopy.
      return { ...base, levels: 3, children: 3, angle: 0.6, upLerp: 0.05 };
    case 'weeping':
      return { ...base, levels: 3, children: 3, angle: 0.65, upLerp: -0.1 };
    case 'wispy':
      return { ...base, levels: 4, children: 2, angle: 0.55, lenFalloff: 0.78 };
    case 'round':
    default:
      return {
        ...base,
        levels: density > 0.75 ? 4 : 3,
        children: density > 0.7 ? 3 : 2,
        angle: 0.6
      };
  }
}

function growLSystem(params: TreeGenParams, rng: () => number): GrowNode[] {
  const P = lsFromParams(params);
  const NODE_CAP = 520;
  const up = new THREE.Vector3(0, 1, 0);
  const nodes: GrowNode[] = [
    { pos: new THREE.Vector3(), parent: -1, order: 0, dist: 0 }
  ];
  const tmpAxis = new THREE.Vector3();

  // Internode length: the chain is laid one internode at a time up to an EXACT
  // length budget, so a branch is never longer than its budget (no oversizing).
  const STEP = Math.max(0.28, params.growStep * 1.7);

  // Grow ONE branch as a chain of internodes consuming `budget` total length
  // (this IS the apical line — no separate re-extending leader). Side branches
  // fork periodically ALONG the chain and recurse with a shrunken budget, so the
  // structure is genuinely fractal (trunk -> primary -> secondary -> twig) AND
  // bounded: order increments per fork (taper via radiusFor); NODE_CAP backstops.
  function grow(
    parentIdx: number,
    dir: THREE.Vector3,
    order: number,
    divergence: number,
    budget: number
  ) {
    if (order > P.levels || budget < STEP * 0.6 || nodes.length >= NODE_CAP) return;
    const d = dir.clone().normalize();
    let prev = parentIdx;
    let remaining = budget;
    let internode = 0;
    // Trunk climbs (strong gravitropism); branches follow their own dir (P.upLerp
    // may be negative for weeping droop).
    const grav = order === 0 ? 0.16 : P.upLerp;
    const forkEvery = order === 0 ? 2 : 1;
    while (remaining >= STEP * 0.6 && nodes.length < NODE_CAP) {
      // per-internode gnarl: spin the bend AXIS randomly around the branch so the
      // wander isn't biased into one plane (a fixed twPerp made stems one-sided).
      tmpAxis.copy(twPerp(d)).applyAxisAngle(d, rng() * Math.PI * 2);
      d.applyAxisAngle(tmpAxis, (rng() - 0.5) * 0.22); // per-internode gnarl
      d.lerp(up, grav).normalize();
      const seg = Math.min(STEP, remaining);
      const np = nodes[prev].pos.clone().addScaledVector(d, seg);
      nodes.push({ pos: np, parent: prev, order, dist: nodes[prev].dist + 1 });
      prev = nodes.length - 1;
      remaining -= seg;
      internode++;

      // Fork side branches along the chain (not just at the tip) for fractal fill.
      if (order < P.levels && internode % forkEvery === 0 && remaining > STEP) {
        const kids = order === 0 ? P.children : Math.max(1, P.children - 1);
        for (let k = 0; k < kids; k++) {
          divergence += P.twist; // GOLDEN-ANGLE azimuth between siblings
          const childDir = d.clone();
          // CRITICAL ORDER: tilt OFF the parent axis FIRST, THEN spin that tilted
          // vector around the axis. Spinning before tilting rotated d around its
          // own axis (a no-op), collapsing every child into one plane -> one-sided
          // trees. Tilt-then-spin fans the children radially around the trunk in a
          // golden-angle spiral, so the crown grows thick and all-round.
          childDir.applyAxisAngle(twPerp(d), P.angle * (0.7 + 0.6 * rng())); // tilt off parent
          childDir.applyAxisAngle(d, divergence); // radial spin around branch axis
          // Child reaches into the remaining crown, shorter than its parent.
          const childBudget = (remaining * 0.55 + STEP) * P.lenFalloff * (0.8 + 0.4 * rng());
          grow(prev, childDir, order + 1, divergence * 1.3, childBudget);
        }
      }
    }
  }

  const start = up
    .clone()
    .applyAxisAngle(new THREE.Vector3(1, 0, 0), (rng() - 0.5) * 0.1);
  // Trunk budget = the configured height exactly (it's laid as STEP internodes).
  grow(0, start, 0, rng() * 6.28318, params.height);
  shapeNodes(nodes, params); // existing lean/twist/weeping droop still applies
  return nodes;
}

// Public entry: frond palms stay hand-built, everything else is the L-system.
function growSkeleton(params: TreeGenParams, rng: () => number): GrowNode[] {
  const silhouette = params.silhouette ?? 'round';
  if (silhouette === 'frond') {
    return growFrondSkeleton(params, rng);
  }
  return growLSystem(params, rng);
}

// --- FROND (palm) skeleton ---------------------------------------------------
// Palms get a bare slightly-leaning trunk + a hand-built whorl of 7..11 frond
// rib chains arcing outward and drooping down. No space colonization (a palm
// crown is a fan, not a branching cloud).
function growFrondSkeleton(params: TreeGenParams, rng: () => number): GrowNode[] {
  const { height, growStep } = params;
  const nodes: GrowNode[] = [];
  nodes.push({ pos: new THREE.Vector3(0, 0, 0), parent: -1, order: 0, dist: 0 });

  // Straight-ish trunk up to the crown.
  const trunkSteps = Math.max(3, Math.floor(height / growStep));
  let prev = 0;
  for (let i = 1; i <= trunkSteps; i++) {
    nodes.push({
      pos: new THREE.Vector3(0, i * growStep, 0),
      parent: prev,
      order: 0,
      dist: i
    });
    prev = nodes.length - 1;
  }
  const crownIdx = prev;
  const crownY = trunkSteps * growStep;
  const crownDist = trunkSteps;

  // Whorl of fronds radiating from the crown apex.
  const fronds = 7 + Math.floor(rng() * 5); // 7..11
  const ribSteps = 5;
  const ribLen = Math.max(1.2, height * 0.45);
  for (let f = 0; f < fronds; f++) {
    const ang = (f / fronds) * Math.PI * 2 + rng() * 0.3;
    const dirX = Math.cos(ang);
    const dirZ = Math.sin(ang);
    let parent = crownIdx;
    let pdist = crownDist;
    for (let r = 1; r <= ribSteps; r++) {
      const t = r / ribSteps;
      // arc out then droop down (gravity on the frond tip).
      const out = ribLen * t;
      const droop = ribLen * t * t * 0.7;
      // Inner rib stays BARE (order 0, like the trunk); only the outer ~half of
      // the frond carries foliage (order 1) so leaves cluster toward the frond
      // ends instead of all along the stem. (buildLeafGeometry leafs order>=1.)
      const ribOrder = r >= Math.ceil(ribSteps * 0.55) ? 1 : 0;
      nodes.push({
        pos: new THREE.Vector3(dirX * out, crownY + 0.2 - droop, dirZ * out),
        parent,
        order: ribOrder,
        dist: pdist + 1
      });
      parent = nodes.length - 1;
      pdist += 1;
    }
  }

  shapeNodes(nodes, params);
  return nodes;
}

// --- Post-growth shaping: lean / twist / weeping droop -----------------------
// Applied AFTER growth so it bends the existing skeleton. leanTwist is clamped
// upstream (<=0.35) so trunk tube tangents don't kink. Weeping droops tip nodes.
function shapeNodes(nodes: GrowNode[], params: TreeGenParams): void {
  const lean = params.leanTwist ?? 0;
  const silhouette = params.silhouette ?? 'round';
  const weeping = silhouette === 'weeping';
  if (Math.abs(lean) < 1e-4 && !weeping) return;

  const maxDist = nodes.reduce((m, n) => Math.max(m, n.dist), 1);
  const base = nodes[0].pos;
  // lean axis: tilt around +X, spiral sign from lean's sign.
  const spiralSign = lean >= 0 ? 1 : -1;

  for (let i = 1; i < nodes.length; i++) {
    const node = nodes[i];
    const frac = node.dist / maxDist;

    if (Math.abs(lean) > 1e-4) {
      // Rotate node.pos around base by lean*frac, plus a gentle spiral in xz.
      const ang = lean * frac;
      const dx = node.pos.x - base.x;
      const dy = node.pos.y - base.y;
      const dz = node.pos.z - base.z;
      // tilt in the x/y plane
      const cx = Math.cos(ang);
      const sx = Math.sin(ang);
      const nx = dx * cx - dy * sx;
      const ny = dx * sx + dy * cx;
      // spiral twist around y grows with height
      const spin = spiralSign * lean * frac * 1.5;
      const cs = Math.cos(spin);
      const ss = Math.sin(spin);
      const sxz = nx * cs - dz * ss;
      const szx = nx * ss + dz * cs;
      node.pos.set(base.x + sxz, base.y + ny, base.z + szx);
    }

    if (weeping && frac > 0.6) {
      // pull tip nodes downward (willow droop), smooth falloff.
      const droopFrac = (frac - 0.6) / 0.4;
      node.pos.y -= droopFrac * droopFrac * params.crownRadius * 1.4;
    }
  }
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

// --- Leaf CLUSTER geometry ---------------------------------------------------
// A leaf CLUSTER is a chunky bunch of N cards (3..5 by silhouette) fanned around
// an OUTWARD direction = normalize(node.pos - crownCenter). The card normal IS
// that outward dir — CRITICAL so canopy AO/SSS read volumetric (cards facing
// random directions invert AO/SSS from below). New per-vertex attributes:
//   aCanopyY : 0 deep-interior .. 1 sun-kissed crust (baked CPU, drives gradient+AO)
//   aFlower  : 1 if this cluster blooms (baked from bloomAmount), else 0
//
// We build leaf + blossom in ONE pass so they share matrices/positions: leaf
// gets every cluster, blossom gets only the aFlower>0 clusters (smaller cards).
interface LeafBuildResult {
  leaf: THREE.BufferGeometry;
  blossom: THREE.BufferGeometry;
  /** Average crown world-local centre + colourable tip ratio for the impostor. */
  crownCenter: THREE.Vector3;
  crownRadius: number;
}

function buildLeafGeometry(
  nodes: GrowNode[],
  params: TreeGenParams,
  rng: () => number
): LeafBuildResult {
  const { leafSize, maxLeafCards } = params;
  const silhouette = params.silhouette ?? 'round';
  const bloomAmount = params.bloomAmount ?? 0;
  const maxDist = nodes.reduce((m, n) => Math.max(m, n.dist), 1);

  // Leaf-bearing nodes (per-silhouette; see selectLeafCandidates).
  const candidates = selectLeafCandidates(nodes, silhouette);

  // Crown centre = mean of candidate positions (so outward dirs are meaningful).
  const crownCenter = new THREE.Vector3();
  for (const idx of candidates) crownCenter.add(nodes[idx].pos);
  if (candidates.length > 0) crownCenter.multiplyScalar(1 / candidates.length);
  let crownRadius = 0.001;
  for (const idx of candidates) {
    crownRadius = Math.max(crownRadius, nodes[idx].pos.distanceTo(crownCenter));
  }

  // Leaf attribute buffers.
  const lPos: number[] = [];
  const lNrm: number[] = [];
  const lUv: number[] = [];
  const lStiff: number[] = [];
  const lPhase: number[] = [];
  const lCanopyY: number[] = [];
  const lFlower: number[] = [];
  const lRand: number[] = [];
  const lIdx: number[] = [];

  // Blossom attribute buffers (only flowering clusters).
  const bPos: number[] = [];
  const bNrm: number[] = [];
  const bUv: number[] = [];
  const bStiff: number[] = [];
  const bPhase: number[] = [];
  const bIdx: number[] = [];

  const outward = new THREE.Vector3();
  const u = new THREE.Vector3();
  const v = new THREE.Vector3();
  const cardN = new THREE.Vector3();
  const helper = new THREE.Vector3();
  const center = new THREE.Vector3();

  // Cards per cluster: chunkier for broad canopies, fewer for needle/wispy.
  const cardsPerCluster =
    silhouette === 'conical' || silhouette === 'wispy' ? 4 : silhouette === 'frond' ? 3 : 6;

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

  // emit one quad into a target set of buffers.
  const emitQuad = (
    pos: number[],
    nrm: number[],
    uv: number[],
    stiffArr: number[],
    phaseArr: number[],
    canopyArr: number[] | null,
    flowerArr: number[] | null,
    randArr: number[] | null,
    idxArr: number[],
    cx: number,
    cy: number,
    cz: number,
    ax: THREE.Vector3,
    ay: THREE.Vector3,
    nv: THREE.Vector3,
    hs: number,
    fl: number,
    ph: number,
    canopyY: number,
    flower: number,
    leafRand: number
  ) => {
    const base = pos.length / 3;
    for (let k = 0; k < 4; k++) {
      const [su, sv] = corners[k];
      pos.push(
        cx + (ax.x * su + ay.x * sv) * hs,
        cy + (ax.y * su + ay.y * sv) * hs,
        cz + (ax.z * su + ay.z * sv) * hs
      );
      nrm.push(nv.x, nv.y, nv.z);
      uv.push(cuv[k][0], cuv[k][1]);
      stiffArr.push(fl);
      phaseArr.push(ph);
      if (canopyArr) canopyArr.push(canopyY);
      if (flowerArr) flowerArr.push(flower);
      if (randArr) randArr.push(leafRand);
    }
    idxArr.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };

  // Golden-angle phyllotaxis spray: each TWIG node fans a Vogel disk of small,
  // leaf-SHAPED cards (alpha-cut in the shader). r = sqrt(t) packs them denser
  // at the centre — the reference's phyllotaxis look. More + smaller cards, but
  // because the alpha cut removes the card corners, filled area (overdraw)
  // actually drops vs the old square cards.
  const GOLDEN = Math.PI * (3 - Math.sqrt(5)); // 2.39996 rad
  const leavesPerTwig = Math.max(
    4,
    Math.round(cardsPerCluster * 2.4 * (params.attractorCount / 260))
  );
  // Keep the total leaf count bounded by the existing budget.
  const maxNodes = Math.max(1, Math.round(maxLeafCards / leavesPerTwig));
  let placed = 0;

  for (const idx of candidates) {
    if (placed >= maxNodes) break;
    center.copy(nodes[idx].pos);

    // Outward direction from crown centre (special-cased for weeping/frond).
    outward.copy(center).sub(crownCenter);
    if (outward.lengthSq() < 1e-6) outward.set(0, 1, 0);
    outward.normalize();
    if (silhouette === 'weeping') {
      outward.y -= 0.8; // droop the canopy normal downward
      outward.normalize();
    } else if (silhouette === 'umbrella') {
      outward.y += 0.6; // dome the wide canopy UP (was reading upside-down)
      outward.normalize();
    }

    // canopyY: 0 deep interior .. 1 crust (distance from centre, remapped).
    const baseCanopyY = Math.min(1, center.distanceTo(crownCenter) / crownRadius);
    const flower = bloomAmount > 0 && rng() < bloomAmount ? 1 : 0;
    const ph = rng() * Math.PI * 2;
    const fl = Math.min(1, 0.7 + (nodes[idx].dist / maxDist) * 0.5);

    for (let i = 0; i < leavesPerTwig; i++) {
      const t = (i + 0.5) / leavesPerTwig; // 0..1 outward through the spray
      const phi = i * GOLDEN;
      const r = Math.sqrt(t) * leafSize * 0.9; // Vogel: denser at centre

      // (u,v) basis perpendicular to outward for the spray disk.
      helper.set(0, 1, 0);
      if (Math.abs(outward.y) > 0.95) helper.set(1, 0, 0);
      u.copy(helper).cross(outward).normalize();
      v.copy(outward).cross(u).normalize();

      // card centre = node + in-plane offset + push outward along the twig.
      center.copy(nodes[idx].pos);
      center
        .addScaledVector(u, Math.cos(phi) * r)
        .addScaledVector(v, Math.sin(phi) * r)
        .addScaledVector(outward, leafSize * (0.2 + 0.5 * t));

      // card normal stays OUTWARD from crown centre (CRITICAL for AO/SSS volume).
      cardN.copy(center).sub(crownCenter);
      if (cardN.lengthSq() < 1e-6) cardN.copy(outward);
      cardN.normalize();
      if (silhouette === 'weeping') {
        cardN.y -= 0.5;
        cardN.normalize();
      } else if (silhouette === 'umbrella') {
        // Tilt the leaf normals UP so the wide canopy is lit/domed from above
        // instead of shading like undersides (the "upside-down canopy").
        cardN.y += 0.7;
        cardN.normalize();
      }

      // build a card basis perpendicular to cardN.
      helper.set(0, 1, 0);
      if (Math.abs(cardN.y) > 0.95) helper.set(1, 0, 0);
      u.copy(helper).cross(cardN).normalize();
      v.copy(cardN).cross(u).normalize();

      const hs = leafSize * (0.42 + 0.3 * rng()); // smaller cards, denser crown
      const leafRand = rng();
      const canopyY = Math.min(1, baseCanopyY + (t - 0.5) * 0.25);

      emitQuad(
        lPos, lNrm, lUv, lStiff, lPhase, lCanopyY, lFlower, lRand, lIdx,
        center.x, center.y, center.z, u, v, cardN, hs, fl, ph,
        Math.max(0, Math.min(1, canopyY)), flower, leafRand
      );

      // Blossom: a couple of smaller flower cards per flowering twig (outer ones).
      if (flower > 0 && i < 2) {
        emitQuad(
          bPos, bNrm, bUv, bStiff, bPhase, null, null, null, bIdx,
          center.x + cardN.x * hs * 0.3,
          center.y + cardN.y * hs * 0.3,
          center.z + cardN.z * hs * 0.3,
          u, v, cardN, hs * 0.6, fl, ph, 0, 0, leafRand
        );
      }
    }
    placed++;
  }

  const leaf = new THREE.BufferGeometry();
  leaf.setAttribute('position', new THREE.Float32BufferAttribute(lPos, 3));
  leaf.setAttribute('normal', new THREE.Float32BufferAttribute(lNrm, 3));
  leaf.setAttribute('uv', new THREE.Float32BufferAttribute(lUv, 2));
  leaf.setAttribute('aStiff', new THREE.Float32BufferAttribute(lStiff, 1));
  leaf.setAttribute('aPhase', new THREE.Float32BufferAttribute(lPhase, 1));
  leaf.setAttribute('aCanopyY', new THREE.Float32BufferAttribute(lCanopyY, 1));
  leaf.setAttribute('aFlower', new THREE.Float32BufferAttribute(lFlower, 1));
  leaf.setAttribute('aLeafRand', new THREE.Float32BufferAttribute(lRand, 1));
  leaf.setIndex(lIdx);
  leaf.computeBoundingSphere();

  const blossom = new THREE.BufferGeometry();
  blossom.setAttribute('position', new THREE.Float32BufferAttribute(bPos, 3));
  blossom.setAttribute('normal', new THREE.Float32BufferAttribute(bNrm, 3));
  blossom.setAttribute('uv', new THREE.Float32BufferAttribute(bUv, 2));
  blossom.setAttribute('aStiff', new THREE.Float32BufferAttribute(bStiff, 1));
  blossom.setAttribute('aPhase', new THREE.Float32BufferAttribute(bPhase, 1));
  // The shared leaf vertex shader declares aCanopyY/aFlower; blossoms don't use
  // them, but provide zeroed buffers so the attribute bindings are explicit.
  blossom.setAttribute('aCanopyY', new THREE.Float32BufferAttribute(new Array(bStiff.length).fill(0), 1));
  blossom.setAttribute('aFlower', new THREE.Float32BufferAttribute(new Array(bStiff.length).fill(0), 1));
  blossom.setAttribute('aLeafRand', new THREE.Float32BufferAttribute(new Array(bStiff.length).fill(0), 1));
  blossom.setIndex(bIdx);
  blossom.computeBoundingSphere();

  return { leaf, blossom, crownCenter, crownRadius };
}

// --- Impostor (far LOD) ------------------------------------------------------
// A 2-quad CROSS billboard spanning the crown — ~8 verts, one draw call for all
// far trees. Shares aStiff/aPhase/aCanopyY/aFlower attrs so it can reuse the leaf
// material (stripped variant) without per-attribute branching.
function buildImpostorGeometry(
  crownCenter: THREE.Vector3,
  crownRadius: number,
  height: number
): THREE.BufferGeometry {
  const cy = crownCenter.y;
  const r = Math.max(crownRadius, 0.6) * 1.15;
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const stiff: number[] = [];
  const phase: number[] = [];
  const canopyY: number[] = [];
  const flower: number[] = [];
  const leafRand: number[] = [];
  const indices: number[] = [];
  void height;

  // Two perpendicular vertical quads (X-plane and Z-plane).
  const planes: Array<[THREE.Vector3, THREE.Vector3]> = [
    [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1)],
    [new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0)]
  ];
  for (const [ax, nrm] of planes) {
    const base = positions.length / 3;
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
      const [sx, sy] = corners[k];
      positions.push(
        crownCenter.x + ax.x * sx * r,
        cy + sy * r,
        crownCenter.z + ax.z * sx * r
      );
      normals.push(nrm.x, nrm.y, nrm.z);
      uvs.push(cuv[k][0], cuv[k][1]);
      stiff.push(0.5);
      phase.push(0);
      canopyY.push((sy + 1) * 0.5);
      flower.push(0);
      leafRand.push(0);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('aStiff', new THREE.Float32BufferAttribute(stiff, 1));
  geo.setAttribute('aPhase', new THREE.Float32BufferAttribute(phase, 1));
  geo.setAttribute('aCanopyY', new THREE.Float32BufferAttribute(canopyY, 1));
  geo.setAttribute('aFlower', new THREE.Float32BufferAttribute(flower, 1));
  geo.setAttribute('aLeafRand', new THREE.Float32BufferAttribute(leafRand, 1));
  geo.setIndex(indices);
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Generate one deterministic tree archetype (trunk + leaf clusters + blossoms +
 * impostor) for `seed`. Same seed + params always yields identical geometry
 * (vertex counts and positions). Geometry is in LOCAL space, origin at trunk
 * base, +Y up.
 */
export function generateTree(
  seed: number,
  params: TreeGenParams = DEFAULT_TREE_PARAMS
): TreeArchetype {
  const rng = makeRng(seed);
  const nodes = growSkeleton(params, rng);
  const trunkGeometry = buildTrunkGeometry(nodes, params);
  const { leaf, blossom, crownCenter, crownRadius } = buildLeafGeometry(
    nodes,
    params,
    rng
  );
  const impostorGeometry = buildImpostorGeometry(
    crownCenter,
    crownRadius,
    params.height
  );
  return {
    trunkGeometry,
    leafGeometry: leaf,
    blossomGeometry: blossom,
    impostorGeometry
  };
}
