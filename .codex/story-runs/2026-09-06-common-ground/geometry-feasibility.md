# Common Ground — Origin arena geometry feasibility (source-derived)

Status: read-only mechanical measurement, 2026-09-06. No source, tool, validator,
procedural generation, or dirty file was modified. No build, browser, GPU, or
server was used. This does **not** sign arena geometry; it reports what the
current world functions actually produce and what remains unestablished.

Evidence:

- Probe script: `.codex/story-runs/2026-09-06-common-ground/geometry-feasibility-probe.mts`
- Machine output: `.codex/story-runs/2026-09-06-common-ground/geometry-feasibility.json`
- Reproduce (CPU only, no vite dev server — `vite-node` fails here with the
  known `captures/` ENOSPC watcher trap, so the script is bundled with esbuild):

```bash
cd /home/thomasphillip/Projects/vox/main
TM=$PWD/node_modules/three
./node_modules/.bin/esbuild ../.codex/story-runs/2026-09-06-common-ground/geometry-feasibility-probe.mts \
  --bundle --platform=node --format=esm --outfile=/tmp/cg-probe.mjs \
  "--alias:three=$TM/build/three.module.js" \
  "--alias:three/examples/jsm/utils/BufferGeometryUtils.js=$TM/examples/jsm/utils/BufferGeometryUtils.js"
node /tmp/cg-probe.mjs > ../.codex/story-runs/2026-09-06-common-ground/geometry-feasibility.json
```

## Verdict

**One route class is established; the second is not.**

- A **shorter dry grounded route** exists between the hero-tree and pond-shore
  anchors, is fully walkable under the *existing* worker slope/clearance rules,
  and fits both the 128-point and 120-unit trace limits. It **does** lose a
  terrain-based witness line on part of its span — the treatment's "shorter bend
  needs repositioning" behaviour is real geometry here, not invented.
- A **longer outer route that keeps a continuously usable witness line** was
  **not** established. Every budget-legal outer candidate found breaks the
  witness line, and the search that would settle the question is witness-driven,
  which this bounded pass did not run.
- Two contract limits are internally inconsistent as written (see "Budget
  conflict"). This must be resolved before the scene contract signs geometry.

A qualified software baseline is therefore **not yet sufficient** to sign arena
geometry: the outer/continuous-witness route class is unproven, and the witness
predicate's endpoints are undefined in the treatment.

## Derivation classes

| Class | Meaning | Applies to |
| --- | --- | --- |
| source-derived | computed by the shipped runtime functions on the pinned world | all anchors, both route plans, lengths, sample counts |
| sampled | computed by *this probe's* geometric test, not a shipped function | witness/occlusion line-of-sight, trace sample counts |
| visually unverified | never rendered or observed | every visual/readability claim; canopy, grass, silhouette |

The terrain query used is the **pristine procedural** query
(`generator.shouldVoxelExist` / `isWaterVoxel` / lava), identical to
`storyAnchorResolver.proceduralAgentTerrain`. It is **not**
`createLiveAgentSurfaceTerrain`, which needs `voxelSystem` and therefore a live
client. All results assume an **unedited** world; player voxel edits can
invalidate any span.

## Actual anchor geometry (source-derived, pinned story world)

World: coordinate `(-1,-1)`, `worldId "-1,-1"`, `STORY_SEED 3215739679`,
`planetSize 50` (`components/EfficientScene.tsx::planetSize`), `VOXEL_SCALE 2`,
115 629 generated voxels.

| Anchor | World position | Source |
| --- | --- | --- |
| Hero apple tree | `(-24.00, 50.95, 22.00)` up `+Y` | `getHeroTreePose` |
| Pond surface | `(6.00, 50.50, -12.00)` | `getPondPose.surface` |
| Pond dry shore | `(4.00, 51.05, -10.00)` | `getPondPose.shore` |
| Pond floor / depth | `(6.00, 44.60, -12.00)`, depth 3 voxels | `getPondPose.floor/.depth` |
| Wreck relay | `(-2.00, 51.00, -2.00)` | `getWreckRelayPose` |
| Pod impact | `(3.00, 51.00, -6.00)` | `getPodImpactPose` |
| Signal mesa | `(36.00, 50.50, -22.00)` | `getSignalMesaPose` |
| Field pack (live-terrain) | `(-16.00, 51.18, 18.00)`, support voxel `(-8,25,9)`, `relocated: true` | `getFieldPackPose` |
| Existing audit walk | 24 path points | `getAuditWorkerPath` |

Derived dry standing references used as arena endpoints (nearest dry, worker-clear
column; the tree reference is forced ≥3 units clear of the trunk collider):

- Arena start at the tree: `(-26.00, 53.05, 20.00)` — 3.52 units from the trunk,
  standing one voxel step higher than the shore plain.
- Arena end on the pond shore: `(4.00, 51.05, -10.00)`.
- Approach reference beside the relay: `(-2.00, 51.05, -2.00)`.

Distances: tree→shore **42.47**, relay→tree **32.62**, relay→shore **10.00**.
The relay is *not* inside the tree/shore corridor; it is ~32 units off the tree
end, which matches the treatment's "wreck/relay as the approach" but means the
arena itself is the 42-unit tree↔shore corridor.

### Trunk shape and occlusion truth

The hero tree's only stable collision geometry is
`HeroAppleTree.tsx:190`: `CuboidCollider args=[0.55, trunkHeight/2, 0.55]`,
i.e. a **1.1 × 1.1 world-unit square column**, height **8.17** (from
`buildTreeProfile((STORY_SEED ^ 0xede9) >>> 0)`, floored at 7.2). The canopy is
an instanced render shell with **no collider** and therefore cannot be a witness
occluder without new geometry.

Sampled occlusion census over the corridor bounding box (846 dry standable
columns, eye height 1.6, witness line to the tree reference):

- terrain-blocked: **248 / 846** (29.3 %) — real relief exists, mostly the rise
  west of the tree around `x ≈ -46`.
- trunk-blocked: **56 / 846** (6.6 %) — a 1.1-unit column at 20–40 units of
  sightline occludes a razor-thin wedge.

**Truth for the cinematography constraint (CG-CIN-CH-02):** terrain can carry a
legible witness relation here; the trunk alone cannot. A witness predicate that
leans on trunk occlusion would be a sub-degree geometric knife-edge and would
read as arbitrary.

## Route candidates (source-derived plans, sampled trace metrics)

Planner: `planAgentSurfaceRoute` with the **verbatim** worker options from
`emergentStoryDirector.ts::moveAuditor` (`face: 'top'`,
`differentFaceFallback: 'unreachable'`, `clearanceCells: 2`, `maxSlopeCells: 1`,
`edgeMarginCells: 1`, `maxVisitedCells: 8192`, `waypointClearanceWorld: 1.05`,
`allowJetpackCrossing: false`). Length via `groundedSurfaceRouteLength`.

| | Route A (shorter) | Route B (longest budget-legal outer detour) |
| --- | --- | --- |
| Plan | 1 leg, `walk` / `dry-surface-path`, 37 visited cells | 2 legs, both `walk` / `dry-surface-path` |
| Detour vertex | — | `(4.00, 53.05, 42.00)` |
| Waypoints | 31 | 55 |
| Walked length | **60.00** units (≤120 ✓) | **108.00** units (≤120 ✓) |
| Trace samples | **76** (≤128 ✓) | **127** (≤128 ✓, 1 spare) |
| Witness to tree reference | 58 clear / **18 terrain-blocked** / 0 trunk / 3 near-field exempt | 44 clear / **83 blocked** (83 terrain, 23 trunk) |
| First witness break | `(-26.00, 51.05, 17.00)` | `(-26.00, 51.05, 23.00)` |
| Max witness distance | 42.47 | 42.47 |

Detour search: 582 dry candidates on rings 6–14 voxels around the tree, sorted by
lateral offset from the straight line, first 60 evaluated. Rejections:
18 not walkable, 31 over the **point** budget, 0 over the length budget,
0 "not longer", 11 witness-broken. **No candidate achieved zero witness breaks.**

Intermediate witness for Route A's first blocked span: a dry standable position
exists at `(-26.00, 53.05, 18.00)`, but it is only 2.00 units from the start
reference and 2.24 units from the blocked span — this is close-in relief at the
tree's own step, not a legible mid-corridor bend witness.

## Budget conflict (must be resolved before signing)

The treatment's sampling rule (one sample per ~1 unit of travel, 0.25-unit
minimum on direction change) makes the point budget bind before the length
budget. Measured:

| Walked length | Trace samples |
| --- | --- |
| 60 | 76 |
| 108 | 127 |
| 116 | 135 (over 128) |
| 120 | 139 (over 128) |

Effective maximum walked length under 128 points is ≈ **105–110 units**, not 120.
Either raise the point budget to ~150, lower the stated length budget, or widen
the nominal sample spacing. Do not silently decimate — the treatment forbids it.

## Answers to the commissioned questions

1. **Can current source/pure world functions establish two feasible routes?**
   Partially. They establish one (Route A: dry, worker-legal, in budget, with a
   genuine terrain witness break). They do **not** establish the second class
   (a materially longer outer route with *continuous* witness) — the bounded
   search found none, and the search was length-driven, not witness-driven.
2. **Do the routes traverse hidden collision?** No. Every leg is
   `mode: 'walk'`, `reason: 'dry-surface-path'` under `allowJetpackCrossing:
   false` and `differentFaceFallback: 'unreachable'`; no water, no cross-face, no
   automatic repair. Nothing was auto-routed around an invented obstacle.
3. **Is the witness relation legible from stable geometry?** From terrain, yes
   (29 % of corridor columns are terrain-occluded to the tree reference). From
   the trunk, effectively no (6.6 %, 1.1-unit column). No camera gaze, foliage,
   or invisible obstacle was used anywhere in this measurement.
4. **Undefined contract term found:** the treatment never states the witness
   line's *endpoints*. This probe assumed `player sample → fixed tree-side
   reference`. If the reference is instead the worker's held trace-end (which
   moves), every number above changes. The candidate must define the predicate's
   two endpoints and the eye height before geometry can be signed.

## Exact API to reuse in implementation

| Need | Symbol | File |
| --- | --- | --- |
| Anchor poses (tree/pond/relay/pack/mesa) | `getHeroTreePose`, `getPondPose`, `getWreckRelayPose`, `getFieldPackPose`, `getSignalMesaPose` | `main/src/story/world/storyWorld.ts` (facade) → `storyAnchorResolver.ts` |
| Prepared/worker-cached anchors | `prepareStoryAnchors`, `clonePreparedAnchor`, `CachedWorldGen.preparedStoryAnchors` | `storyAnchorResolver.ts`, `preparedStoryAnchors.ts`, `worldGenCache.ts` |
| Live-edit terrain query (runtime only) | `createLiveAgentSurfaceTerrain` (+ its `revision` string for replan gating) | `main/src/utils/agentSurfaceNavigationRuntime.ts` |
| Span/route legality under worker rules | `planAgentSurfaceRoute` with the `moveAuditor` option block | `main/src/utils/agentSurfaceNavigation.ts` |
| Walked length / actor sampling / turning | `groundedSurfaceRouteLength`, `sampleGroundedSurfaceRoute`, `turnGroundedHeadingToward`, `easedGroundedTravelProgress` | `main/src/utils/groundedSurfaceMotion.ts` |
| Worker body clearance constant | `AUDIT_WORKER_GROUND_CLEARANCE` (= 1.05, equals `waypointClearanceWorld`) | `storyAnchorResolver.ts` |
| Pinned world identity | `STORY_SEED`, `STORY_COORDINATE`, `STORY_PRIMARY_WORLD_ID`, `isStoryWorld` | `storyWorldIdentity.ts` |

Hard constraint discovered in source, not negotiable by options:
`agentSurfaceNavigation.ts:182` clamps `maxSlopeCells` to **≤ 1** —
"callers may tighten to flat-only but cannot silently turn this into a
cliff-climbing planner." A recorded player trace is **not** automatically
worker-traversable; each proposed span must be revalidated with
`planAgentSurfaceRoute` before it can be offered.

## What a qualified baseline still lacks, and the minimal diagnostic to close it

The outer/continuous-witness route class cannot be settled by more of the same
length-driven sampling. Minimal, bounded procedure — in this order:

1. **CPU, no runtime (extends this same script, no new approach):** define the
   witness predicate endpoints in the candidate, then run a *witness-driven*
   search: enumerate dry standable columns in the corridor, keep only those with
   a clear witness line to the chosen reference, and plan
   `planAgentSurfaceRoute` legs **restricted to that witness-clear set**. If a
   walkable chain start→end exists inside 128 points, the outer route is
   established from source. If none exists, the arena is geometrically incapable
   of the "repeatable outer route" and the bounded arena decision must be
   reopened (CG-CIN-CH-02 already requires this rather than an invented
   obstacle).
2. **Only if step 1 succeeds — live-terrain confirmation** requires a running
   client because `createLiveAgentSurfaceTerrain` reads `voxelSystem`. There is
   no existing debug API that exposes route planning or the anchor set to a
   probe. This needs a **contracted, story-scoped debug hook** (e.g.
   `window.__cgGeometry` publishing the resolved anchors, the live terrain
   `revision`, and a read-only `planSpan(a,b)` under an explicit probe flag),
   registered alongside the existing story debug surface. Do not fabricate one
   inline, and do not treat a passing screening or an elapsed timeout as proof.
3. Headed hardware/tier proof and readability remain unchanged and out of scope
   here; nothing in this report is visually verified.

## Hashes

Artifacts:

```
4dda6f78f5e114c604266738e8d3e111de4cc54a09b59593d9bb2d3ed01548fe  .codex/story-runs/2026-09-06-common-ground/geometry-feasibility-probe.mts
f33efd2cf6d0928602199aea8398958c2d23d9b6866cc1ec3ef8bee6619e73a2  .codex/story-runs/2026-09-06-common-ground/geometry-feasibility.json
```

Source read for this measurement (unchanged by it):

```
5009c44ac1c3e139cf3636288e9e796626030f31fef2632bb9104d465d998461  main/src/story/world/storyAnchorResolver.ts
5a904ec968f57d7c3c6ea530e0478b0a3ab480bec65f5216ba1a7874827de687  main/src/story/world/storyAnchorTypes.ts
fb5c06f70b820d7740f469d9736238edec53ca1d4406eff2b6745985e1bb1ed5  main/src/story/world/storyWorld.ts
54aaf17805f1f9e3aa1ed4bd93ceb69621ca3689448c4a210215dfd528239c67  main/src/story/world/storyWorldIdentity.ts
8890019f106f8a5baeff6c0c1209c90f3c7c2f7c87533404f74a9632f9ddc289  main/src/story/world/preparedStoryAnchors.ts
aa9a1177f1bf9d19c3df566a5b4edb96eff7c2664d273fafed5bbd579c264c61  main/src/story/world/HeroAppleTree.tsx
cdf09473848c93a5127984b434e5465f7941e51e4e8f24f83fbbead76b84b3ac  main/src/story/world/StoryWorldProps.tsx
88fc065747f9c82aa9896e59d686b85f54e0c007a2ae76b646b369c400a34f3e  main/src/story/world/AuditWorker.tsx
7e5046d37aeb21b2ef36988b98504ad37a117f9c9b536fa4619db0dda78f8279  main/src/utils/agentSurfaceNavigation.ts
9c00aff376851fa3ca708c3a860e38c978846fdec16d573517894779c46b0cdc  main/src/utils/agentSurfaceNavigationRuntime.ts
bb80319c0fbbf01736c6d2be969451eb7836a61b02bffc2744401ae9a2844ddb  main/src/utils/groundedSurfaceMotion.ts
7e900372322ec39acd9ab060c51b21eeae99f300c36ed01eba75c8811c369680  main/src/utils/resolvedWorldGenerator.ts
e8af26503f9b2459136e77e62a113fd21443da79a70fc71dfcdf93ac969e81ba  main/src/utils/worldGenCache.ts
7fb2d356a3702c5b060c2c17c2f37dffeab0ab153b7281da445b23d09f9d0829  main/src/utils/worldPrepProtocol.ts
c0a71ab046b5d5324a7a0562b4a7b0db720cba4451ac51aabd9336f5a133c399  main/src/utils/cubeGravityConstants.ts
ab95dfe4d2dbb59bbaa22e4fdf60faf8f4fa4f9fd959040bfe17fdb4a776f995  main/src/components/EfficientScene.tsx
d22984991cd46bad66d51841f288e695bc308b61dd999e9c46903893d295eadd  main/src/story/emergentStoryDirector.ts
```

## Retained failures / limits of this pass

- `npx vite-node` could not be used: ENOSPC file-watcher limit from the
  `captures/` tree (the documented trap in `CLAUDE.md`). Worked around with an
  esbuild bundle to `/tmp`; no repo file was added to `main/`.
- Two probe artifacts were found and corrected during the run, both recorded in
  the script: (a) the nearest dry column to the hero tree is the trunk's own
  column, which made every witness line trivially trunk-blocked — the reference
  is now forced ≥3 units clear; (b) samples within 3 units of the reference exit
  through the reference's own support column and are reported separately as
  `witnessNearFieldExemptSamples` rather than counted as occlusion.
- The detour search evaluated 60 of 582 candidates, ordered by lateral offset.
  A negative result on witness continuity is therefore **not** a proof of
  impossibility; it is an unestablished claim. See step 1 above.
- No live voxel edits, no rendering, no tier/device variance, no readability.
