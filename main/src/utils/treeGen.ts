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
// base, growing along +Y. Profiled trees are canopy-scale (~6-11 world units
// before instance variation) so the player looks up into them without crossing
// into giant-tree territory. TreeField instances this archetype across the planet.

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
  /** Child branch emergence angle in radians. */
  branchJointAngle?: number;
  /** New lateral branches attempted per fork. */
  whorlCount?: number;
  /** Per-internode random wander. */
  gnarl?: number;
  /** Branch tendency to steer upward. */
  gravitropism?: number;
  /** 0..1 central leader priority over lateral growth. */
  apicalDominance?: number;
  /** 0..1 how quickly apical dominance fades by branch order. */
  apicalDominanceDecay?: number;
  /** 0..1 resistance to weight sag. */
  branchStiffness?: number;
  /** Foliage cluster spacing multiplier; lower is denser. */
  foliageSpacing?: number;
  /** Legacy inward placement knob; kept at 0 so leaves stay attached to branches. */
  foliageThreshold?: number;
  /** Downward foliage hang angle/position bias. */
  foliageDroop?: number;
  /** Base buttress spread. */
  trunkFlare?: number;
  /** Bark/trunk silhouette roughness. */
  trunkRoughness?: number;
  /** Terminal branch geometry pruning passes. */
  thinFineBranches?: number;
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
  bloomAmount: 0,
  branchJointAngle: 0.6,
  whorlCount: 3,
  gnarl: 0.18,
  gravitropism: 0.08,
  apicalDominance: 0.52,
  apicalDominanceDecay: 0.14,
  branchStiffness: 0.72,
  foliageSpacing: 0.9,
  foliageThreshold: 0,
  foliageDroop: 0.25,
  trunkFlare: 0.12,
  trunkRoughness: 0.06,
  thinFineBranches: 0
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

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function hash01(n: number): number {
  return Math.abs(Math.sin(n * 12.9898) * 43758.5453) % 1;
}

export interface GrowNode {
  pos: THREE.Vector3;
  parent: number; // index into nodes, -1 for root
  order: number; // branch order (0 trunk, grows with branching depth)
  dist: number; // graph distance from root (in steps)
}

/**
 * Which skeleton nodes carry leaf clusters, per silhouette. Pure + exported so
 * the placement rule is unit-testable. Every species starts from the same rule:
 * visible foliage belongs to real branch/rib nodes, not the order-0 trunk. The
 * silhouette-specific clauses then decide how much of that branch skeleton is
 * clothed so dense species are full while wispy/frond still keep their identity.
 */
export function selectLeafCandidates(
  nodes: GrowNode[],
  silhouette: TreeSilhouette
): number[] {
  const maxDist = nodes.reduce((m, n) => Math.max(m, n.dist), 1);
  const maxOrder = nodes.reduce((m, n) => Math.max(m, n.order), 0);
  const maxY = nodes.reduce((m, n) => Math.max(m, n.pos.y), 0);
  const minY = nodes.reduce((m, n) => Math.min(m, n.pos.y), maxY);
  const heightSpan = Math.max(1e-5, maxY - minY);
  const childCount = new Array(nodes.length).fill(0);
  for (const n of nodes) if (n.parent >= 0) childCount[n.parent]++;

  const candidates: number[] = [];
  for (let i = 1; i < nodes.length; i++) {
    const isTip = childCount[i] === 0;
    const node = nodes[i];
    const height01 =
      maxY > 1e-5
        ? clamp((node.pos.y - minY) / heightSpan, 0, 1)
        : clamp(node.dist / maxDist, 0, 1);
    const realBranch = node.order >= 1;
    const outerTwigOrder = node.order >= Math.max(1, maxOrder - 1);
    let ok: boolean;
    if (silhouette === 'frond') {
      // Palm trunk and short inner rib are bare; the outer rib carries leaflets.
      ok = realBranch && (isTip || node.dist >= maxDist * 0.38);
    } else if (silhouette === 'wispy') {
      // Lacy, but not unfinished: real branches only, with enough mid/outer
      // coverage that the canopy reads as fine hair instead of sparse shelves.
      ok =
        realBranch &&
        (isTip || outerTwigOrder || node.dist >= maxDist * 0.34 || height01 >= 0.38);
    } else if (silhouette === 'conical') {
      // Dense conifers need clothed side branches, not vertical leaf bands glued
      // to the central leader. Only the very top order-0 tip may become an apex.
      ok =
        (realBranch &&
          (isTip || outerTwigOrder || node.dist >= maxDist * 0.2 || height01 >= 0.18)) ||
        (node.order === 0 && isTip && height01 >= 0.9);
    } else if (silhouette === 'umbrella') {
      // Broad, high canopy: branch-owned foliage that favors the upper/lateral
      // crown and avoids dressing the stem below the canopy table.
      ok =
        realBranch &&
        (isTip || outerTwigOrder || node.dist >= maxDist * 0.42 || height01 >= 0.45);
    } else if (silhouette === 'weeping') {
      // The willow crown can be full, but leaves must hang from side branches;
      // the straight trunk and leader stay visually clear.
      ok =
        realBranch &&
        (isTip || outerTwigOrder || node.dist >= maxDist * 0.36 || height01 >= 0.4);
    } else {
      // Round broadleaf: denser branch coverage than pure tip placement, but no
      // trunk-owned shelves when a seed produces a shallow branch order.
      ok =
        realBranch &&
        (isTip || outerTwigOrder || node.dist >= maxDist * 0.34 || height01 >= 0.32);
    }
    if (ok) candidates.push(i);
  }
  if (candidates.length === 0) {
    // Pathological fallback for tiny/generated test skeletons: keep a visible
    // crown rather than emitting empty leaf geometry.
    for (let i = 1; i < nodes.length; i++) {
      if (childCount[i] === 0) candidates.push(i);
    }
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
  gnarl: number;
  apicalDominance: number;
  apicalDominanceDecay: number;
  /** Fraction of the trunk budget the central leader climbs before terminating;
   *  <1 stops a dominant leader from spiking bare above the crown (weeping). */
  leaderFrac: number;
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
    upLerp: 0.03,
    gnarl: 0.18,
    apicalDominance: 0.52,
    apicalDominanceDecay: 0.14,
    leaderFrac: 1 // full-height central leader (default)
  };
  const applySpecies = (shape: LSParams): LSParams => {
    const angle = clamp(p.branchJointAngle ?? shape.angle, 0.32, 1.05);
    const children = Math.max(
      shape.children,
      clamp(Math.round(p.whorlCount ?? shape.children), 2, 4)
    );
    const rawApicalDominance = clamp(
      p.apicalDominance ?? shape.apicalDominance,
      0,
      1
    );
    // High apical dominance is botanically useful, but conifers were degenerating
    // into a few side twigs plus a bare leader on some seeds. Cap only the
    // generator's growth priority; the profile still records the planet species.
    const apicalDominance =
      p.silhouette === 'conical'
        ? Math.min(rawApicalDominance, 0.68)
        : rawApicalDominance;
    const gravitropism = clamp(p.gravitropism ?? 0.08, 0.0, 0.28);
    return {
      ...shape,
      angle,
      children,
      upLerp: clamp(shape.upLerp + (gravitropism - 0.08) * 0.75, -0.1, 0.24),
      gnarl: clamp(p.gnarl ?? shape.gnarl, 0.02, 0.34),
      apicalDominance,
      apicalDominanceDecay: clamp(p.apicalDominanceDecay ?? shape.apicalDominanceDecay, 0, 0.5)
    };
  };
  switch (p.silhouette) {
    case 'conical':
      // Conifer (spruce/cypress): a tapered, dense, taller-than-wide crown. The
      // budget taper shortens branches toward the top (wide base -> narrow top);
      // a LOW leaderFrac stops the central leader early so the upper forks dome
      // over into a solid leafy top instead of a bare leader spiking out (the same
      // fix that cured weeping). Inclusive candidates + denser budget + larger
      // cards keep the cone solid with no trunk showing through.
      return applySpecies({
        ...base,
        levels: 4,
        children: 3,
        angle: 0.48,
        upLerp: 0.09,
        lenFalloff: 0.78,
        segs: 6,
        leaderFrac: 0.72
      });
    case 'umbrella':
      // Broad dome (acacia-like). Uses the round tree's proven branching (moderate
      // angle + climbing upLerp) so foliage domes UP; the WIDER crownRadius (2.6,
      // from silhouettePreset) is what makes it broad. The old wide angle 0.85 +
      // negative upLerp fanned sub-branches DOWNWARD -> drooping "upside-down" canopy.
      return applySpecies({
        ...base,
        levels: 3,
        children: 3,
        angle: 0.62,
        upLerp: 0.05,
        leaderFrac: 0.78
      });
    case 'weeping':
      // Branches CLIMB into a full ROUNDED crown that envelops the apex (so there
      // is no bare spiking top); the willow "weep" then lives entirely in the
      // draping leaf cards (radial curtains, see buildLeafGeometry) plus a mild
      // outer-tip curl (shapeNodes). leaderFrac<1 terminates the central leader
      // early so the upper forks dome over instead of a thin bare leader spiking
      // up. The old upLerp:-0.1 sagged bare boughs up/out while foliage bunched
      // low -> upside-down canopy.
      return applySpecies({
        ...base,
        levels: 3,
        children: 3,
        angle: 0.66,
        upLerp: 0.13,
        lenFalloff: 0.82,
        leaderFrac: 0.6
      });
    case 'wispy':
      // Airy, taller habit (birch-like): enough children to keep fine twigs clothed
      // (no bare boughs) but a low canopy density (treeProfile wispyMul) keeps the
      // crown light and lacy; a leaderFrac cutoff domes the top so no bare leader
      // spikes up. Taller proportion distinguishes it from the compact round crown.
      return applySpecies({
        ...base,
        levels: 4,
        children: 3,
        angle: 0.62,
        upLerp: 0.04,
        lenFalloff: 0.8,
        leaderFrac: 0.66
      });
    case 'round':
    default:
      return applySpecies({
        ...base,
        levels: density > 0.75 ? 4 : 3,
        children: density > 0.7 ? 3 : 2,
        angle: 0.62,
        leaderFrac: 0.82
      });
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
    const forkEvery = order === 0 && P.apicalDominance > 0.72 ? 3 : order === 0 ? 2 : 1;
    while (remaining >= STEP * 0.6 && nodes.length < NODE_CAP) {
      // Central-leader cutoff: a dominant straight leader grown to full height
      // spikes BARE above off-axis climbing branches. For shapes with leaderFrac<1
      // (weeping) stop the apical line once it has climbed leaderFrac of its budget
      // and let the upper forks dome the crown over (no bare spike).
      if (order === 0 && budget - remaining >= P.leaderFrac * budget) break;
      // per-internode gnarl: spin the bend AXIS randomly around the branch so the
      // wander isn't biased into one plane (a fixed twPerp made stems one-sided).
      tmpAxis.copy(twPerp(d)).applyAxisAngle(d, rng() * Math.PI * 2);
      d.applyAxisAngle(tmpAxis, (rng() - 0.5) * P.gnarl); // per-internode gnarl
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
          const dominance = clamp(
            P.apicalDominance * Math.pow(1 - P.apicalDominanceDecay, Math.max(0, order)),
            0,
            1
          );
          const lateralScale = 1.08 - dominance * 0.46;
          const childBudget =
            (remaining * 0.55 + STEP) *
            P.lenFalloff *
            lateralScale *
            (0.8 + 0.4 * rng());
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
// Palms get a bare slightly-leaning trunk + a hand-built whorl of dense frond
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

  // Whorl of fronds radiating from the crown apex. Palms were the sparsest
  // silhouette visually: a handful of ribs made the crown look like a propeller.
  // More ribs and internodes give the existing leaf builder many more natural
  // attachment points without changing the instanced render path.
  const fronds = 16 + Math.floor(rng() * 7); // 16..22
  const ribSteps = 8;
  const ribLen = Math.max(1.7, height * 0.56);
  for (let f = 0; f < fronds; f++) {
    const ang = (f / fronds) * Math.PI * 2 + rng() * 0.3;
    const dirX = Math.cos(ang);
    const dirZ = Math.sin(ang);
    const lengthMul = 0.86 + rng() * 0.3;
    const liftMul = -0.16 + rng() * 0.42;
    const droopMul = 0.34 + rng() * 0.22;
    let parent = crownIdx;
    let pdist = crownDist;
    for (let r = 1; r <= ribSteps; r++) {
      const t = r / ribSteps;
      // arc out then droop down (gravity on the frond tip).
      const out = ribLen * lengthMul * t;
      const arch = Math.sin(t * Math.PI) * ribLen * (0.08 + Math.max(0, liftMul) * 0.08);
      const droop = ribLen * t * t * droopMul;
      // Only a short base petiole stays BARE (order 0, like the trunk); the rest
      // of the rib carries foliage (order 1) so fronds read leafy along most of
      // their length (palm fronds are leafy nearly to the base) instead of showing
      // a long bare rachis arcing over the crown. (buildLeafGeometry leafs order>=1.)
      const ribOrder = r >= Math.ceil(ribSteps * 0.2) ? 1 : 0;
      nodes.push({
        pos: new THREE.Vector3(
          dirX * out,
          crownY + 0.18 + arch + liftMul * (1 - t * 0.45) - droop,
          dirZ * out
        ),
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
  const stiffness = clamp(params.branchStiffness ?? 0.72, 0.18, 1);
  const weightSag = params.crownRadius * (1 - stiffness) * 0.44;
  if (Math.abs(lean) < 1e-4 && !weeping && weightSag < 1e-4) return;

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

    if (weeping && node.order >= 1 && frac > 0.55) {
      // Fountain droop: curl only the OUTER BRANCH tips down (not the trunk,
      // order 0) and gently — the canopy must stay seated ON the climbing crown,
      // not be dragged below it. Cumulative along a chain (children droop more),
      // so boughs arch over willow-style. Most of the weep is in the leaf cards.
      const droopFrac = (frac - 0.55) / 0.45;
      node.pos.y -= droopFrac * droopFrac * params.crownRadius * 0.55;
    }

    if (node.order >= 1 && weightSag > 0) {
      // Florasynth-style branch weight, kept cheap: softer species let lateral
      // branches grow into a subtle permanent sag. It is applied after lean/twist
      // so the canopy shape changes, not just the final leaf cards.
      const branchLoad = Math.pow(frac, 1.35) * clamp(node.order / 3, 0.35, 1);
      node.pos.y -= branchLoad * weightSag;
    }
  }
}

function pruneTerminalBranchGeometry(nodes: GrowNode[], passes: number): GrowNode[] {
  const count = Math.max(0, Math.min(2, Math.round(passes)));
  if (count <= 0 || nodes.length <= 2) return nodes;

  const keep = new Array(nodes.length).fill(true);
  for (let pass = 0; pass < count; pass++) {
    const childCount = new Array(nodes.length).fill(0);
    for (let i = 1; i < nodes.length; i++) {
      if (keep[i] && keep[nodes[i].parent]) childCount[nodes[i].parent]++;
    }
    const drop: number[] = [];
    for (let i = 1; i < nodes.length; i++) {
      if (keep[i] && childCount[i] === 0 && nodes[i].order >= 2) drop.push(i);
    }
    if (drop.length === 0) break;
    for (const i of drop) keep[i] = false;
  }

  const remap = new Map<number, number>();
  const out: GrowNode[] = [];
  for (let i = 0; i < nodes.length; i++) {
    if (!keep[i]) continue;
    const parent = nodes[i].parent;
    if (parent >= 0 && !keep[parent]) continue;
    remap.set(i, out.length);
    out.push({
      pos: nodes[i].pos.clone(),
      parent: -1,
      order: nodes[i].order,
      dist: nodes[i].dist
    });
  }
  for (let i = 0; i < nodes.length; i++) {
    const mapped = remap.get(i);
    if (mapped == null) continue;
    const parent = nodes[i].parent;
    out[mapped].parent = parent >= 0 ? remap.get(parent) ?? -1 : -1;
  }
  return out.length > 1 ? out : nodes;
}

function pruneBroadleafLeaderTips(
  nodes: GrowNode[],
  silhouette: TreeSilhouette
): GrowNode[] {
  if (silhouette === 'conical' || silhouette === 'frond' || nodes.length <= 2) {
    return nodes;
  }

  const maxY = nodes.reduce((m, n) => Math.max(m, n.pos.y), 0);
  const keep = new Array(nodes.length).fill(true);
  for (let pass = 0; pass < 3; pass++) {
    const childCount = new Array(nodes.length).fill(0);
    for (let i = 1; i < nodes.length; i++) {
      if (keep[i] && keep[nodes[i].parent]) childCount[nodes[i].parent]++;
    }
    let dropped = false;
    for (let i = 1; i < nodes.length; i++) {
      if (
        keep[i] &&
        nodes[i].order === 0 &&
        childCount[i] === 0 &&
        nodes[i].pos.y >= maxY * 0.62
      ) {
        keep[i] = false;
        dropped = true;
      }
    }
    if (!dropped) break;
  }
  if (keep.every(Boolean)) return nodes;

  const remap = new Map<number, number>();
  const out: GrowNode[] = [];
  for (let i = 0; i < nodes.length; i++) {
    if (!keep[i]) continue;
    const parent = nodes[i].parent;
    if (parent >= 0 && !keep[parent]) continue;
    remap.set(i, out.length);
    out.push({
      pos: nodes[i].pos.clone(),
      parent: -1,
      order: nodes[i].order,
      dist: nodes[i].dist
    });
  }
  for (let i = 0; i < nodes.length; i++) {
    const mapped = remap.get(i);
    if (mapped == null) continue;
    const parent = nodes[i].parent;
    out[mapped].parent = parent >= 0 ? remap.get(parent) ?? -1 : -1;
  }
  return out.length > 1 ? out : nodes;
}

function pruneFrondRibGeometry(nodes: GrowNode[]): GrowNode[] {
  if (nodes.length <= 2) return nodes;

  const childCount = new Array(nodes.length).fill(0);
  for (let i = 1; i < nodes.length; i++) {
    childCount[nodes[i].parent]++;
  }

  const keep = new Array(nodes.length).fill(false);
  for (let i = 0; i < nodes.length; i++) {
    const parent = nodes[i].parent;
    keep[i] =
      parent < 0 ||
      (nodes[i].order === 0 && childCount[parent] <= 1);
  }

  const remap = new Map<number, number>();
  const out: GrowNode[] = [];
  for (let i = 0; i < nodes.length; i++) {
    if (!keep[i]) continue;
    const parent = nodes[i].parent;
    if (parent >= 0 && !keep[parent]) continue;
    remap.set(i, out.length);
    out.push({
      pos: nodes[i].pos.clone(),
      parent: -1,
      order: nodes[i].order,
      dist: nodes[i].dist
    });
  }
  for (let i = 0; i < nodes.length; i++) {
    const mapped = remap.get(i);
    if (mapped == null) continue;
    const parent = nodes[i].parent;
    out[mapped].parent = parent >= 0 ? remap.get(parent) ?? -1 : -1;
  }
  return out.length > 1 ? out : nodes;
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
  const trunkFlare = clamp(params.trunkFlare ?? 0, 0, 0.6);
  const trunkRoughness = clamp(params.trunkRoughness ?? 0, 0, 0.22);

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const stiff: number[] = [];
  const indices: number[] = [];

  const up = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const children: number[][] = Array.from({ length: nodes.length }, () => []);
  for (let i = 1; i < nodes.length; i++) {
    const p = nodes[i].parent;
    if (p >= 0) children[p].push(i);
  }

  const axes = nodes.map(() => new THREE.Vector3(0, 1, 0));
  const tangents = nodes.map(() => new THREE.Vector3(1, 0, 0));
  const bitangents = nodes.map(() => new THREE.Vector3(0, 0, 1));
  const ringStart = new Array(nodes.length).fill(-1);

  const stableTangentForAxis = (axis: THREE.Vector3, out: THREE.Vector3) => {
    if (Math.abs(axis.y) < 0.95) out.set(0, 1, 0).cross(axis).normalize();
    else out.set(1, 0, 0).cross(axis).normalize();
  };

  // radius for a node: scales with sqrt(subtree weight) so trunk is fat, twigs thin.
  const radiusFor = (i: number) => {
    const w = weight[i] / rootWeight;
    const r = baseRadius * Math.sqrt(Math.max(w, 0.0001));
    const rootFrac = nodes[i].dist / maxDist;
    const flare = 1 + trunkFlare * 2.3 * Math.pow(Math.max(0, 1 - rootFrac * 4.0), 2);
    return Math.max(r * flare, baseRadius * 0.07);
  };

  // Build one shared ring per skeleton node, then connect parent->child rings.
  // The old emitter duplicated both rings per segment; even a straight stem was
  // visually stacked from disconnected chunks with separate normals/frames.
  // Shared rings keep the low-poly style while removing those horizontal seams.
  if (nodes.length > 0) {
    const firstChild = children[0]?.[0];
    if (firstChild !== undefined) {
      axes[0].copy(nodes[firstChild].pos).sub(nodes[0].pos);
      if (axes[0].lengthSq() < 1e-8) axes[0].set(0, 1, 0);
      else axes[0].normalize();
    }
    stableTangentForAxis(axes[0], tangents[0]);
    bitangents[0].copy(axes[0]).cross(tangents[0]).normalize();
  }

  for (let i = 1; i < nodes.length; i++) {
    const node = nodes[i];
    const parent = nodes[node.parent];
    axes[i].copy(node.pos).sub(parent.pos);
    if (axes[i].lengthSq() < 1e-8) axes[i].copy(axes[node.parent]);
    else axes[i].normalize();
    tangent.copy(tangents[node.parent]);
    tangent.addScaledVector(axes[i], -tangent.dot(axes[i]));
    if (tangent.lengthSq() < 1e-8) stableTangentForAxis(axes[i], tangent);
    else tangent.normalize();
    tangents[i].copy(tangent);
    bitangents[i].copy(axes[i]).cross(tangents[i]);
    if (bitangents[i].lengthSq() < 1e-8) {
      stableTangentForAxis(axes[i], tangents[i]);
      bitangents[i].copy(axes[i]).cross(tangents[i]);
    }
    bitangents[i].normalize();
  }

  for (let i = 0; i < nodes.length; i++) {
    const c = nodes[i].pos;
    const r = radiusFor(i);
    const flex = nodes[i].dist / maxDist;
    const roughFade = Math.pow(
      Math.max(0, 1 - nodes[i].dist / Math.max(maxDist, 1)),
      0.7
    );
    ringStart[i] = positions.length / 3;
    for (let s = 0; s <= radialSegments; s++) {
      const ang = (s / radialSegments) * Math.PI * 2;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      const nx = tangents[i].x * ca + bitangents[i].x * sa;
      const ny = tangents[i].y * ca + bitangents[i].y * sa;
      const nz = tangents[i].z * ca + bitangents[i].z * sa;
      const rough =
        (hash01(i * 19.17 + s * 7.31) - 0.5) *
        trunkRoughness *
        baseRadius *
        roughFade;
      const rr = Math.max(baseRadius * 0.035, r + rough);
      positions.push(c.x + nx * rr, c.y + ny * rr, c.z + nz * rr);
      normals.push(nx, ny, nz);
      uvs.push(s / radialSegments, nodes[i].dist / Math.max(maxDist, 1));
      stiff.push(flex);
    }
  }

  // For every node with a parent, connect its shared node ring to the parent
  // ring. Interior stem rings are now referenced by both neighbouring segments,
  // so lighting interpolates across the joint instead of breaking at each chunk.
  for (let i = 1; i < nodes.length; i++) {
    const node = nodes[i];
    const parent = nodes[node.parent];
    up.copy(node.pos).sub(parent.pos);
    if (up.lengthSq() < 1e-10) continue;
    const baseIdx = ringStart[node.parent];
    const childIdx = ringStart[i];
    if (baseIdx < 0 || childIdx < 0) continue;
    for (let s = 0; s < radialSegments; s++) {
      const a = baseIdx + s;
      const b = baseIdx + s + 1;
      const c = childIdx + s;
      const d = childIdx + s + 1;
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
  const lTuft: number[] = [];
  const lIdx: number[] = [];

  // Blossom attribute buffers (only flowering clusters).
  const bPos: number[] = [];
  const bNrm: number[] = [];
  const bUv: number[] = [];
  const bStiff: number[] = [];
  const bPhase: number[] = [];
  const bTuft: number[] = [];
  const bIdx: number[] = [];

  const outward = new THREE.Vector3();
  const u = new THREE.Vector3();
  const v = new THREE.Vector3();
  const cardN = new THREE.Vector3();
  const helper = new THREE.Vector3();
  const center = new THREE.Vector3();
  const branchDir = new THREE.Vector3();
  const side = new THREE.Vector3();
  const leafAxis = new THREE.Vector3();
  const leafNormal = new THREE.Vector3();
  const upVec = new THREE.Vector3(0, 1, 0);

  // Cards per cluster: higher density everywhere, but with silhouette-specific
  // restraint so wispy stays lacy and conical stays tight instead of blobby.
  const cardsPerCluster =
    silhouette === 'frond'
      ? 9
      : silhouette === 'wispy'
        ? 8
        : silhouette === 'conical'
          ? 9
          : silhouette === 'umbrella'
            ? 12
            : silhouette === 'weeping'
              ? 12
              : 11;

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
    tuftArr: number[] | null,
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
    leafRand: number,
    tuftShade: number
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
      if (tuftArr) tuftArr.push(tuftShade);
    }
    idxArr.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };

  // Golden-angle phyllotaxis spray: each TWIG node fans a Vogel disk of small,
  // leaf-SHAPED cards (alpha-cut in the shader). r = sqrt(t) packs them denser
  // at the centre — the reference's phyllotaxis look. More + smaller cards, but
  // because the alpha cut removes the card corners, filled area (overdraw)
  // actually drops vs the old square cards.
  const GOLDEN = Math.PI * (3 - Math.sqrt(5)); // 2.39996 rad
  const sparseClusterBoost = clamp(1 + Math.max(0, 24 - candidates.length) / 12, 1, 2.4);
  const leavesPerTwig = Math.max(
    6,
    Math.round(
      cardsPerCluster *
        2.05 *
        Math.min(2.2, params.attractorCount / 260) *
        sparseClusterBoost
    )
  );
  // Keep the total leaf count bounded by the existing budget.
  const foliageSpacing = clamp(params.foliageSpacing ?? 0.9, 0.5, 1.5);
  const spacingBoost =
    foliageSpacing < 1 ? 1 + (1 - foliageSpacing) * 0.55 : 1 / foliageSpacing;
  // Fronds emit a small, structured ribbon set per rib node rather than the
  // generic phyllotaxis disk. Budget them against that actual emission count so
  // palms use their intended foliage budget instead of looking half-populated.
  const budgetCardsPerNode = silhouette === 'frond' ? 16 : leavesPerTwig;
  const maxNodes = Math.max(1, Math.round((maxLeafCards / budgetCardsPerNode) * spacingBoost));
  // Even coverage under the card budget. Taking the first N candidates in
  // (depth-first) creation order piles foliage onto the earliest-explored
  // branches and leaves the upper crown + apex bare — the bare-spiking-top
  // symptom. Instead: clothe every TIP first (branch/leader ENDS read as dead
  // spikes when bare), then fill the remaining budget by uniformly SAMPLING the
  // interior nodes so the whole skeleton is enveloped.
  const childCount = new Array(nodes.length).fill(0);
  for (const n of nodes) if (n.parent >= 0) childCount[n.parent]++;
  const strideSample = (arr: number[], n: number): number[] => {
    if (n >= arr.length) return arr.slice();
    const out: number[] = [];
    const stride = arr.length / n;
    for (let k = 0; k < n; k++) out.push(arr[Math.floor(k * stride)]);
    return out;
  };
  let leafNodes: number[];
  if (candidates.length <= maxNodes) {
    leafNodes = candidates;
  } else {
    const tips = candidates.filter(i => childCount[i] === 0);
    const interior = candidates.filter(i => childCount[i] !== 0);
    // ALWAYS clothe the highest tips. Plain stride sampling can skip the single
    // topmost tip, leaving a bare twig/leader poking above the crown (the most
    // common residual defect across silhouettes). Force-include the top tips by
    // height, then stride-sample the rest for even coverage.
    const tipBudget = Math.min(tips.length, maxNodes);
    const topCount = Math.min(tipBudget, Math.max(3, Math.round(tipBudget * 0.18)));
    const byHeight = tips.slice().sort((a, b) => nodes[b].pos.y - nodes[a].pos.y);
    const tipSet = new Set(byHeight.slice(0, topCount));
    const rest = tips.filter(i => !tipSet.has(i));
    for (const i of strideSample(rest, tipBudget - tipSet.size)) tipSet.add(i);
    const tipPick = [...tipSet];
    leafNodes = tipPick.concat(strideSample(interior, maxNodes - tipPick.length));
  }

  const frondStartDist =
    silhouette === 'frond'
      ? nodes.reduce((m, n) => (n.order >= 1 ? Math.min(m, n.dist) : m), maxDist)
      : 0;

  for (const idx of leafNodes) {
    const attachIdx = idx;
    center.copy(nodes[attachIdx].pos);

    // Outward direction from crown centre, blended toward the branch tangent so
    // foliage grows off the selected branch instead of forming detached rings
    // around the trunk.
    outward.copy(center).sub(crownCenter);
    if (outward.lengthSq() < 1e-6) outward.set(0, 1, 0);
    outward.normalize();
    const parentIdx = nodes[attachIdx].parent;
    if (parentIdx >= 0) {
      branchDir.copy(center).sub(nodes[parentIdx].pos);
      if (branchDir.lengthSq() < 1e-6) branchDir.copy(outward);
      branchDir.normalize();
      const branchAlign =
        silhouette === 'frond'
          ? 0.88
          : silhouette === 'wispy'
            ? 0.64
            : silhouette === 'conical'
              ? 0.46
              : silhouette === 'umbrella'
                ? 0.5
                : silhouette === 'weeping'
                  ? 0.38
                  : 0.58;
      outward.lerp(branchDir, branchAlign).normalize();
    }
    if (silhouette === 'umbrella') {
      outward.y += 0.6; // dome the wide canopy UP (was reading upside-down)
      outward.normalize();
    }

    // canopyY: 0 deep interior .. 1 crust (distance from centre, remapped).
    const baseCanopyY = Math.min(1, center.distanceTo(crownCenter) / crownRadius);
    const flower = bloomAmount > 0 && rng() < bloomAmount ? 1 : 0;
    const ph = rng() * Math.PI * 2;
    const fl = Math.min(1, 0.7 + (nodes[attachIdx].dist / maxDist) * 0.5);
    const tuftShade = rng();

    if (silhouette === 'frond') {
      const parentIdx = nodes[attachIdx].parent;
      if (parentIdx < 0) continue;
      const parentPos = nodes[parentIdx].pos;
      branchDir.copy(nodes[attachIdx].pos).sub(nodes[parentIdx].pos);
      if (branchDir.lengthSq() < 1e-6) continue;
      branchDir.normalize();
      side.copy(branchDir).cross(upVec);
      if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
      side.normalize();
      const along = clamp(
        (nodes[attachIdx].dist - frondStartDist) / Math.max(1, maxDist - frondStartDist),
        0,
        1
      );
      const localCanopyY = Math.min(1, 0.18 + along * 0.82);
      const segmentCount = along > 0.86 ? 3 : 4;
      const tipDroop = along * along;

      if (along < 0.18) {
        const crownT = 1 - along / 0.18;
        const leafRand = rng();
        center
          .copy(parentPos)
          .addScaledVector(branchDir, leafSize * (0.28 + 0.24 * crownT))
          .addScaledVector(side, (rng() - 0.5) * leafSize * 0.34)
          .addScaledVector(upVec, leafSize * (0.14 + 0.22 * crownT));
        leafAxis
          .copy(branchDir)
          .addScaledVector(upVec, 0.18 * crownT)
          .normalize()
          .multiplyScalar(1.5);
        u.copy(side).multiplyScalar(0.74);
        leafNormal.copy(upVec).addScaledVector(branchDir, 0.24).normalize();
        emitQuad(
          lPos, lNrm, lUv, lStiff, lPhase, lCanopyY, lFlower, lRand, lTuft, lIdx,
          center.x, center.y, center.z, u, leafAxis, leafNormal,
          leafSize * (0.4 + 0.08 * rng()), fl, ph + 0.37,
          localCanopyY, flower, leafRand, tuftShade
        );
      }

      for (let segment = 0; segment < segmentCount; segment++) {
        const pairT = (segment + 0.55) / segmentCount;
        const segT = clamp((segment + 0.42) / segmentCount, 0, 1);
        center.copy(parentPos).lerp(nodes[attachIdx].pos, segT);

        leafAxis
          .copy(branchDir)
          .addScaledVector(upVec, -0.04 - 0.16 * tipDroop)
          .normalize()
          .multiplyScalar(1.88);
        u.copy(side).multiplyScalar(0.86 + 0.16 * (1 - along));
        cardN
          .copy(upVec)
          .multiplyScalar(0.72)
          .addScaledVector(branchDir, 0.26)
          .normalize();
        emitQuad(
          lPos, lNrm, lUv, lStiff, lPhase, lCanopyY, lFlower, lRand, lTuft, lIdx,
          center.x, center.y, center.z, u, leafAxis, cardN,
          leafSize * (0.46 + 0.08 * rng()), fl, ph + segment * 0.19,
          localCanopyY, flower, rng(), tuftShade
        );

        for (const sign of [-1, 1] as const) {
          const leafRand = rng();
          const ph2 = ph + sign * 0.47 + segment * 0.31;
          const width = leafSize * (0.46 + 0.36 * pairT) * (1.05 + 0.5 * along);
          center
            .copy(parentPos)
            .lerp(nodes[attachIdx].pos, segT)
            .addScaledVector(side, sign * width)
            .addScaledVector(upVec, -leafSize * (0.04 + 0.28 * tipDroop) * pairT);

          leafAxis
            .copy(branchDir)
            .addScaledVector(upVec, -0.08 - 0.22 * tipDroop)
            .normalize()
            .multiplyScalar(1.74);
          u.copy(side).multiplyScalar(0.72);
          cardN
            .copy(upVec)
            .multiplyScalar(0.66)
            .addScaledVector(side, sign * 0.24)
            .addScaledVector(branchDir, 0.24)
            .normalize();

          emitQuad(
            lPos, lNrm, lUv, lStiff, lPhase, lCanopyY, lFlower, lRand, lTuft, lIdx,
            center.x, center.y, center.z, u, leafAxis, cardN,
            leafSize * (0.48 + 0.1 * rng()), fl, ph2,
            localCanopyY, flower, leafRand, tuftShade
          );
        }
      }

      if (childCount[attachIdx] === 0) {
        const leafRand = rng();
        center
          .copy(nodes[attachIdx].pos)
          .addScaledVector(branchDir, leafSize * 0.42)
          .addScaledVector(upVec, -leafSize * 0.12);
        leafAxis
          .copy(branchDir)
          .addScaledVector(upVec, -0.16)
          .normalize()
          .multiplyScalar(1.82);
        u.copy(side).multiplyScalar(0.42);
        leafNormal.copy(upVec).addScaledVector(branchDir, 0.22).normalize();
        emitQuad(
          lPos, lNrm, lUv, lStiff, lPhase, lCanopyY, lFlower, lRand, lTuft, lIdx,
          center.x, center.y, center.z, u, leafAxis, leafNormal,
          leafSize * 0.46, fl, ph + 0.8,
          1, flower, leafRand, tuftShade
        );
      }
      continue;
    }

    // Weeping curtain weight = how PERIPHERAL the twig is (horizontal radius from
    // the crown axis) x how LOW it sits in the crown. Curtains hang from the SIDES
    // and the LOWER crown; the rounded top + central axis barely droop, so the
    // apex/upper crown stay domed and clothed (no bare spike). 0 for other shapes.
    const horiz = Math.hypot(
      nodes[attachIdx].pos.x - crownCenter.x,
      nodes[attachIdx].pos.z - crownCenter.z
    );
    const vy = (nodes[attachIdx].pos.y - crownCenter.y) / Math.max(crownRadius, 1e-3);
    const weepW =
      silhouette === 'weeping'
        ? Math.min(1, horiz / Math.max(crownRadius, 1e-3)) *
          Math.max(0, Math.min(1, 0.62 - 0.6 * vy))
        : 0;

    for (let i = 0; i < leavesPerTwig; i++) {
      const t = (i + 0.5) / leavesPerTwig; // 0..1 outward through the spray
      const phi = i * GOLDEN;
      const sprayMul =
        silhouette === 'weeping'
          ? 1.18
          : silhouette === 'umbrella'
            ? 1.12
            : silhouette === 'conical'
              ? 0.86
              : silhouette === 'wispy'
                ? 1.18
                : 1.1;
      const r = Math.sqrt(t) * leafSize * sprayMul; // Vogel: denser at centre

      // (u,v) basis perpendicular to outward for the spray disk.
      helper.set(0, 1, 0);
      if (Math.abs(outward.y) > 0.95) helper.set(1, 0, 0);
      u.copy(helper).cross(outward).normalize();
      v.copy(outward).cross(u).normalize();

      // card centre = node + in-plane offset + push outward along the twig.
      // Weeping pushes out LESS (strands hang ~vertically); conical also pushes
      // out less so cards stay near the leader and overlap to hide the trunk.
      const outPush =
        silhouette === 'conical'
          ? leafSize * (0.06 + 0.24 * t)
          : silhouette === 'weeping'
            ? leafSize * (0.1 + 0.34 * t)
            : leafSize * (0.18 + 0.48 * t);
      center.copy(nodes[attachIdx].pos);
      center
        .addScaledVector(u, Math.cos(phi) * r)
        .addScaledVector(v, Math.sin(phi) * r)
        .addScaledVector(outward, outPush);

      // card normal stays OUTWARD from crown centre (CRITICAL for AO/SSS volume).
      cardN.copy(center).sub(crownCenter);
      if (cardN.lengthSq() < 1e-6) cardN.copy(outward);
      cardN.normalize();
      if (silhouette === 'weeping') {
        // Willow weep: drape the card DOWNWARD into a hanging strand, AFTER the
        // normal is fixed so AO/SSS still read from the crown volume (the old
        // `cardN.y -= 0.5` tilted normals down and inverted the canopy shading —
        // drop the POSITION, not the normal). weepW already domes the top, so
        // side/lower twigs cascade while the apex + upper crown stay clothed.
        center.y -= leafSize * (0.2 + 3.4 * weepW) * (0.35 + 0.95 * t);
      } else if (silhouette === 'conical') {
        // Face cards mostly HORIZONTAL (radial from the trunk axis) so foliage
        // covers the near-vertical leader + branches from any side view. A card
        // facing UP (the default for high on-axis nodes) reads edge-on and leaves
        // the stem showing — the conifer's persistent bare-top/shelf artifact.
        cardN.set(
          center.x - crownCenter.x,
          (center.y - crownCenter.y) * 0.2,
          center.z - crownCenter.z
        );
        if (cardN.lengthSq() < 1e-6) cardN.set(1, 0, 0);
        cardN.normalize();
      } else if (silhouette === 'umbrella') {
        // Tilt the leaf normals UP so the wide canopy is lit/domed from above
        // instead of shading like undersides (the "upside-down canopy").
        cardN.y += 0.7;
        cardN.normalize();
      }

      const speciesDroop = clamp(params.foliageDroop ?? 0.25, 0, 1);
      if (speciesDroop > 0 && silhouette !== 'weeping') {
        const droopFactor = speciesDroop * (0.15 + 0.85 * t);
        center.y -= leafSize * 0.36 * droopFactor;
        cardN.y -= 0.18 * speciesDroop;
        cardN.normalize();
      }

      // build a card basis perpendicular to cardN.
      helper.set(0, 1, 0);
      if (Math.abs(cardN.y) > 0.95) helper.set(1, 0, 0);
      u.copy(helper).cross(cardN).normalize();
      v.copy(cardN).cross(u).normalize();

      const hs =
        leafSize *
        (silhouette === 'conical'
          ? 0.42 + 0.22 * rng()
          : silhouette === 'weeping'
            ? 0.42 + 0.22 * rng()
            : silhouette === 'wispy'
              ? 0.32 + 0.18 * rng()
              : 0.34 + 0.24 * rng());
      const leafRand = rng();
      const canopyY = Math.min(1, baseCanopyY + (t - 0.5) * 0.25);

      emitQuad(
        lPos, lNrm, lUv, lStiff, lPhase, lCanopyY, lFlower, lRand, lTuft, lIdx,
        center.x, center.y, center.z, u, v, cardN, hs, fl, ph,
        Math.max(0, Math.min(1, canopyY)), flower, leafRand, tuftShade
      );

      // Blossom: a couple of smaller flower cards per flowering twig (outer ones).
      if (flower > 0 && i < 2) {
        emitQuad(
          bPos, bNrm, bUv, bStiff, bPhase, null, null, null, bTuft, bIdx,
          center.x + cardN.x * hs * 0.3,
          center.y + cardN.y * hs * 0.3,
          center.z + cardN.z * hs * 0.3,
          u, v, cardN, hs * 0.6, fl, ph, 0, 0, leafRand, tuftShade
        );
      }
    }
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
  leaf.setAttribute('aTuftShade', new THREE.Float32BufferAttribute(lTuft, 1));
  leaf.setIndex(lIdx);
  leaf.computeBoundingSphere();

  const blossom = new THREE.BufferGeometry();
  blossom.setAttribute('position', new THREE.Float32BufferAttribute(bPos, 3));
  blossom.setAttribute('normal', new THREE.Float32BufferAttribute(bNrm, 3));
  blossom.setAttribute('uv', new THREE.Float32BufferAttribute(bUv, 2));
  blossom.setAttribute('aStiff', new THREE.Float32BufferAttribute(bStiff, 1));
  blossom.setAttribute('aPhase', new THREE.Float32BufferAttribute(bPhase, 1));
  blossom.setAttribute('aTuftShade', new THREE.Float32BufferAttribute(bTuft, 1));
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
  const tuftShade: number[] = [];
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
      tuftShade.push(0);
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
  geo.setAttribute('aTuftShade', new THREE.Float32BufferAttribute(tuftShade, 1));
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
  const trunkGuideNodes =
    (params.silhouette ?? 'round') === 'frond'
      ? pruneFrondRibGeometry(nodes)
      : pruneBroadleafLeaderTips(nodes, params.silhouette ?? 'round');
  const trunkNodes = pruneTerminalBranchGeometry(
    trunkGuideNodes,
    params.thinFineBranches ?? 0
  );
  const trunkGeometry = buildTrunkGeometry(trunkNodes, params);
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
