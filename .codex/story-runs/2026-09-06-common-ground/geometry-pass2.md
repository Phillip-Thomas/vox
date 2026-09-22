# Common Ground — geometry pass 2 (reference-aware, CPU only)

Status: read-only mechanical measurement, 2026-09-06. Production preflight
evidence. No source, worldgen, validator, canon, build, browser, GPU or server
was touched; no dirty file was modified. Pass-1 artifacts are unchanged (hashes
below match the ones recorded in `geometry-feasibility.md`). This does **not**
sign arena geometry and does not reopen council signatures.

- Probe: `.codex/story-runs/2026-09-06-common-ground/geometry-pass2-probe.mts`
- Machine output: `.codex/story-runs/2026-09-06-common-ground/geometry-pass2.json`
- CPU: **1.19 s** single run (budget was ≤5 min). One bounded search, finite
  limits, no relaxed caps, no decimated corners.

Reproduce:

```bash
cd /home/thomasphillip/Projects/vox/main
TM=$PWD/node_modules/three
./node_modules/.bin/esbuild ../.codex/story-runs/2026-09-06-common-ground/geometry-pass2-probe.mts \
  --bundle --platform=node --format=esm --outfile=/tmp/cg-pass2.mjs \
  "--alias:three=$TM/build/three.module.js" \
  "--alias:three/examples/jsm/utils/BufferGeometryUtils.js=$TM/examples/jsm/utils/BufferGeometryUtils.js"
node /tmp/cg-pass2.mjs > ../.codex/story-runs/2026-09-06-common-ground/geometry-pass2.json
```

---

## VERDICT

**Found, but degenerate.** Two same-endpoint route classes do exist on the
present Origin tree/shore geometry and both fit the caps — but the entire
distinction between them rests on the hero tree's 1.1-unit trunk collider,
because **the arena corridor has no terrain relief at all**. The outer route is
only **4 units / 4 samples** longer than the shorter one, and **981 of 1193**
standable positions (82 %) already satisfy the intermediate-witness predicate,
including the start reference itself. A "saved witness requirement" is
technically distinct here and practically near-vacuous.

Two objective defects were found first, both of which invalidate parts of the
pass-1 numbers.

---

## Part A — convention audit (pass-1 sampling was not shipped truth)

| # | Convention | Measured result |
| --- | --- | --- |
| A1 | Voxel frame | `voxelCoordToWorld` = `coord * 2` → voxel **centre**; occupancy AABB is centre ± 1.0; exact inverse is `round(w/2)`. Verified round-trip. Grounded pose = support centre + `AUDIT_WORKER_GROUND_CLEARANCE` 1.05 = top face + 0.05, and `AUDIT_WORKER_BOOT_SOLE_Y` −0.05 puts the sole exactly on the face. Pass-1 agreed here. |
| A2 | **Rendered-terrain gate — DEFECT in pass 1** | `generator.shouldVoxelExist` is **not** clipped to the rendered cube. `agentSurfaceNavigation.ts` gates it with `insideRenderedTerrain` (`max(|x|,|y|,|z|) ≤ radiusCells = 25`); pass-1's ray did not. **717** columns in the node field report solid at voxel y = 26 (example cell `[-26,4]`: pass-1 top 26, shipped top 19). On 48 comparison lines the pass-1 ray reported **48/48 blocked**; the gated DDA reports **0/48**. **48/48 disagreement.** Pass-1's "29.3 % terrain-blocked" census is an artifact of un-rendered logical voxels. |
| A3 | Column-top ceiling | Pass 1 scanned y down from `floor(planetSize/2)+6 = 31`; the shipped `cellAt` scans from `radiusCells = 25` and treats h = 25 as exposed. **717 / 1925** columns differ. |
| A4 | Ray method | Pass 1: 0.35-unit point sampling + `round()`. Pass 2: Amanatides–Woo DDA over the real voxel AABBs. |
| A5 | Near-field | Pass 1 used a blanket 3.0-unit horizontal exemption. With a correct DDA and socket heights this is unnecessary: exempting only the two endpoint support columns yields **0 self-column hits** on every route reported here. The 3.0-unit exemption can be dropped from the contract. |
| A6 | Socket heights (previously unsourced) | Pass 1 assumed eye 1.6 with no source. Real geometry, expressed **above the grounded pose**: worker visor **1.85** (`AuditWorker.tsx` torso group y 1.3 + visor mesh y 0.55), worker chest/instrument plate **1.30**, straight-held hand **1.25**, shipped player eye **1.35** (`PLAYER_EYE_HEIGHT`, used the same way in `autopilotInteractionGaze.test.ts`). |
| A7 | Occluder set | Stable rendered terrain inside the cube **plus** the hero trunk `CuboidCollider` 1.1 × 1.1 × **8.17** (`HeroAppleTree.tsx:190`). Excluded: canopy instances (no collider), fauna/grass, player-built `StructureField` pieces (not procedural), logical voxels outside the rendered cube. No new or invisible collision was introduced. |

**Socket sensitivity:** the reported result is stable across reference socket
heights 0.6 / 1.0 / 1.35 / 1.85 against an actor socket of 1.85 — outer route
fully clear and shorter route occluded in all four cases. The sockets are not
load-bearing for the answer; the trunk is.

---

## Part B — objective defect found while searching

**`planAgentSurfaceRoute` is blind to the hero trunk.** It knows terrain voxels
only, so the unrestricted shortest tree→shore route **walks straight through the
trunk collider**: it occupies cell `[-12, 11]`, grounded pose `(-24.00, 51.05,
22.00)`, which is inside the trunk box (`x ∈ [-24.55, -23.45]`, `z ∈ [21.45,
22.55]`, `y` up to 59.12).

Consequence for the first search: the shorter route's only "witness break" was
the actor standing **inside** the trunk, which no reference on the map can see
(1184 / 1193 candidate witnesses failed). That is a collision defect, not a
legible occlusion. All results below apply a guard banning cells whose grounded
pose lies inside the trunk XZ box. **This defect is in shipped navigation and
will affect any W-7744 route authored near the hero tree.**

---

## Part B — reference-aware search result

Node field: **1193** walkable dry nodes, bounds `u ∈ [-28, 16]`, `v ∈ [-19, 25]`,
4-neighbour, `|Δh| ≤ maxSlopeCells`, cell legality replicating
`agentSurfaceNavigation.ts::cellAt` for face `top` under the verbatim
`moveAuditor` options.

**Support-height histogram: `{ "25": 1193 }` — every walkable node in the arena
sits at the same support height.** The corridor is the flat cube-face plateau.
The pond is a depression (wet cells excluded) and nothing rises above a level
sightline. There is **no terrain relief available to occlude anything here.**

### Shared endpoints (identical for both classes, both trunk-guarded)

| Role | World | Support voxel |
| --- | --- | --- |
| Start reference at the tree | `(-28.00, 51.05, 22.00)` | `[-14, 25, 11]` (4.00 from the trunk axis) |
| End reference on the pond shore | `(4.00, 51.05, -10.00)` | `[2, 25, -5]` |
| (approach, unused by the routes) relay stand | `(-2.00, 51.05, -2.00)` | `[-1, 25, -1]` |

Straight start→end distance **45.25**.

### The two route classes (primary reported solution)

Fixed survey reference: **`(-30.00, 51.05, 32.00)`**, support voxel
`[-15, 25, 16]`, socket height 1.85 → socket world **`(-30.00, 52.90, 32.00)`**,
11.66 from the tree. 1147 / 1193 nodes are reference-clear to it.

| | Outer (reference-clear, **no witness needed**) | Shorter (**needs one witness**) |
| --- | --- | --- |
| Waypoints | 35 | 33 |
| Walked length | **68.00** (≤120 ✓, headroom 52) | **64.00** (≤120 ✓) |
| Trace samples | **96** (≤128 ✓, headroom 32) | **92** (≤128 ✓) |
| Witness samples clear / blocked | 96 / **0** | 90 / **2** |
| Blocked by terrain / trunk | 0 / 0 | **0 / 2** |
| Self-column artefacts | 0 | 0 |
| Max line-of-reference distance | 54.04 | 54.04 |
| Occluded span | — | samples 13–14, `(-23.00, 51.05, 20.00)` → `(-22.00, 51.05, 20.00)` |

Outer waypoints (XZ, all y = 51.05): `(-28,22) (-26,22) (-26,24) (-24,24)
(-22,24) (-20,24) (-18,24) (-16,24) (-14,24) (-12,24) (-12,22) (-12,20)
(-12,18) (-12,16) (-12,14) (-12,12) (-10,12) (-8,12) (-8,10) (-6,10) (-6,8)
(-4,8) (-2,8) (0,8) (2,8) (4,8) (4,6) (4,4) (4,2) (4,0) (4,-2) (4,-4) (4,-6)
(4,-8) (4,-10)`

Shorter waypoints differ **only** in the first bend: `(-26,22) (-26,20) (-24,20)
… (-12,20)` instead of passing at `z = 24`. The two "classes" are the same
corridor offset by 2 units on the far side of the trunk.

### Intermediate witness for the shorter route

**981** of 1193 nodes (82 %) individually cover both occluded samples, are
reachable under the same worker rules, and are ≥4 units from the fixed
reference.

| Band | Position | Max line-of-reference | Min distance to occluded span | Walk from start ref |
| --- | --- | --- | --- | --- |
| nearest | `(-22.00, 51.05, 20.00)` | 1.00 | 0.00 | 8.00 |
| off-span, shortest walk | `(-28.00, 51.05, 22.00)` | 6.32 | 5.39 | 0.00 — **this is the start reference itself** |
| median | `(8.00, 51.05, 22.00)` | 31.06 | 30.07 | 64.00 |
| farthest | `(32.00, 51.05, -30.00)` | 74.33 | 73.59 | 112.00 |

`savedWitnessRequirementIsDistinct: true` — the outer route needs no witness, the
shorter route does. The distinction is **real but 2 samples wide**, and the
cheapest qualifying witness position is the start reference, i.e. the player can
satisfy it without moving.

### Candidate reference sweep (reported, not authored)

96 dry columns 3–24 units from the tree were evaluated. **30 qualify**;
rejections: 52 where the reference-clear route is not longer than the
unrestricted one, 10 where an endpoint is not reference-clear, 4 over the point
budget, 0 over the length budget, 0 with no reference-clear chain.

- Across **all 30**, outer length is **68.00** and outer samples 93–96; shorter
  is always 64.00 / 92; detour is always **+4.00 units**.
- Occluded samples on the shorter route range **2 to 8**, and are
  **trunk-blocked in every single case. Terrain-blocked count is 0 for all 96
  candidates.**
- Widest trunk shadow: reference `(-22.00, 51.05, 26.00)`, support `[-11,25,13]`,
  4.47 from the tree → 8 occluded samples of 92 (8.7 % of the shorter trace).

### Budget bound actually reached

| | Value | Cap | Headroom |
| --- | --- | --- | --- |
| Outer walked length | 68.00 | 120 | 52.00 |
| Outer trace samples | 96 | 128 | 32 |

**Binding bound: points.** Nothing here approaches either cap, so this run does
not need the pass-1 "budget conflict" resolved to proceed; it neither confirms
nor refutes that a 120-unit path can fit 128 samples. The caps were not relaxed
and no corner was decimated.

### Shipped-planner cross-validation

| Check | Result |
| --- | --- |
| Outer route edges re-planned by `planAgentSurfaceRoute` | **34 / 34** accepted (`walk` / `dry-surface-path`, terminating on the goal) |
| Outer route corner-to-corner legs | **10 / 10** replanned as the identical straight run |
| Shorter route edges | **32 / 32** accepted |
| Shorter route corner legs | **10 / 10** identical |
| Rejected-cell sample (replica says unwalkable) | **26 / 26** — the shipped planner also refuses to land there |

No leg used water, jetpack, cross-face routing or automatic repair
(`allowJetpackCrossing: false`, `differentFaceFallback: 'unreachable'`).

---

## Factual geometry-choice packet for the directors

The commissioned outcome — a reference-clear grounded outer route **and** a
shorter occluded route with a viable intermediate witness — is **found and
reproducible**, so this is not a "not found" report. But three measured facts
should decide whether it is worth signing, and none of them is a taste call:

1. **Zero terrain relief.** All 1193 walkable nodes are at support height 25.
   Any witness occlusion in this neighbourhood must come from the trunk.
   Pass-1's contrary census (29.3 % terrain-blocked) is an un-rendered-voxel
   artifact (A2/A3).
2. **The whole mechanic rides on a 1.1 × 1.1 column.** Best case measured is 8
   occluded samples out of 92 (8.7 %) with the reference 4.47 units from the
   tree; the primary solution is 2 of 92 (2.2 %).
3. **The two classes differ by 4 units.** 68 vs 64, 96 vs 92 samples, same
   corridor, opposite sides of one trunk.

Options within the same established site, stated as geometry rather than
proposals:

- **(a) Accept as-is.** Sign the primary solution above. Deliverable distinction
  is real and mechanically verified, but it is a 2–8 sample trunk shadow and 82 %
  of the field discharges the witness requirement.
- **(b) Move the fixed reference close to the trunk** to widen the shadow —
  `(-22.00, 51.05, 26.00)` measured 8 occluded samples. This is the maximum this
  geometry offers; it does not change the +4-unit route delta.
- **(c) Change endpoints so the pond is between them.** The pond is the only
  non-flat feature; wet cells are already excluded from walkable nodes, so a
  pond-adjacent endpoint pair forces a genuine, terrain-driven detour of far more
  than 4 units. Not measured in this pass — it needs a new endpoint pair, which
  is a director decision, not a probe decision.
- **(d) Reopen the bounded arena decision**, which CG-CIN-CH-02 already requires
  in preference to inventing an obstacle. Adding relief means worldgen change,
  which is out of scope for every artifact in this run.

Either way, **the trunk-blindness defect (Part B) must be fixed before any route
near the hero tree is authored**, independent of which option is chosen.

---

## Limitations retained

- **Pristine procedural terrain only.** `generator.shouldVoxelExist` /
  `isWaterVoxel` / lava, not `createLiveAgentSurfaceTerrain`. Player voxel edits
  can invalidate any span. Live-edit confirmation still needs a running client
  and a contracted, story-scoped debug hook (pass-1 step 2, unchanged).
- **Nothing here is visually verified.** No render, no GPU, no readability,
  no night / mobile / reduced-motion / lowest-tier evidence, no silhouette or
  legibility claim. "82 % of positions satisfy the predicate" is a geometric
  statement, not a claim about whether a player can read the relation.
- **The reference sweep is finite**: 96 candidates, 3–24 units from the tree,
  ordered deterministically by distance. A negative terrain-occlusion result over
  that set is strong (the height histogram explains it) but the sweep itself is
  bounded, not exhaustive over the planet.
- The witness predicate's cylinders (1.25 / 1.75, ±0.6 / ±0.9) were **not**
  simulated; only the world-space line of reference was tested. Hysteresis,
  offer/resume, and hold-and-recovery behaviour remain implementation work.
- No reciprocating final comparison, no new mechanic, and no socket was written
  into canon: the socket heights above are **candidates measured from real body
  geometry**, reported for the scene contract to choose.

## Hashes

New artifacts:

```
098cb6575be60f774f83c8413b69f7274b5e2829cfc4130115dc2953dc2a5de3  .codex/story-runs/2026-09-06-common-ground/geometry-pass2-probe.mts
4c32f3e59ae0bf602698ce58befd63f3bc7711ef06dbd59d46c3dbf1d9ff3498  .codex/story-runs/2026-09-06-common-ground/geometry-pass2.json
```

Pass-1 artifacts, verified unchanged by this pass (identical to the hashes in
`geometry-feasibility.md`):

```
4dda6f78f5e114c604266738e8d3e111de4cc54a09b59593d9bb2d3ed01548fe  .codex/story-runs/2026-09-06-common-ground/geometry-feasibility-probe.mts
f33efd2cf6d0928602199aea8398958c2d23d9b6866cc1ec3ef8bee6619e73a2  .codex/story-runs/2026-09-06-common-ground/geometry-feasibility.json
```

Source read for this measurement (unchanged by it; all match the pass-1 record):

```
7e5046d37aeb21b2ef36988b98504ad37a117f9c9b536fa4619db0dda78f8279  main/src/utils/agentSurfaceNavigation.ts
c0a71ab046b5d5324a7a0562b4a7b0db720cba4451ac51aabd9336f5a133c399  main/src/utils/cubeGravityConstants.ts
5009c44ac1c3e139cf3636288e9e796626030f31fef2632bb9104d465d998461  main/src/story/world/storyAnchorResolver.ts
aa9a1177f1bf9d19c3df566a5b4edb96eff7c2664d273fafed5bbd579c264c61  main/src/story/world/HeroAppleTree.tsx
88fc065747f9c82aa9896e59d686b85f54e0c007a2ae76b646b369c400a34f3e  main/src/story/world/AuditWorker.tsx
bb80319c0fbbf01736c6d2be969451eb7836a61b02bffc2744401ae9a2844ddb  main/src/utils/groundedSurfaceMotion.ts
7e900372322ec39acd9ab060c51b21eeae99f300c36ed01eba75c8811c369680  main/src/utils/resolvedWorldGenerator.ts
54aaf17805f1f9e3aa1ed4bd93ceb69621ca3689448c4a210215dfd528239c67  main/src/story/world/storyWorldIdentity.ts
8fef6de812a8040e3291c715e6656ef3b6f8642e35f84822bf739cf8ff5efbaa  main/src/utils/treeProfile.ts
```
