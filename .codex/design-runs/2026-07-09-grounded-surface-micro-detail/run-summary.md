# Grounded voxel surface micro-detail (replaces the floating "aura" phenomena)

Date: 2026-07-09
Scope: `main/src/utils/surfaceEffects.ts` (rewrite), `main/src/utils/surfaceCritters.ts` (new),
`main/src/components/SurfaceEffectField.tsx` (rewrite), `main/src/utils/planetArtDirection.ts`
(+`grassLife` weight), `main/src/voxelTest.tsx` (harness fixes), `main/src/components/debug/AgentCamera.tsx`
(new material keys), tests.

## Problem

The spawned surface effects (2026-06-28 runs) placed lifted, per-voxel-seeded translucent
ribbons/cards 0.02–0.05 above every eligible face. From gameplay distance every voxel wore an
identical glowing motif — read as an "aura", not as world phenomena. Known-open checklist items
("surface effect offsets", "stay thin/atmospheric") confirmed the lift/thinness was unresolved.

## Direction

Three grounded primitives, all still driven by the shared contracts (WindProfile,
VoxelRealityEffects visibility channels, ecology weights/eligibility, palette roles, quality gates):

1. **Sheets** — one FrontSide quad flush on each exposed eligible face (offset 1.002 vs face 0.99).
   Fragment patterns sample WORLD-SPACE noise in the face tangent plane, so activity propagates
   seamlessly across adjacent same-material voxels instead of repeating per voxel.
   Kinds: `flow` (sand saltation streams, ash films — advected downwind through moving gust
   cells), `soil` (moisture mottle, worm casts, regional crawl-trail colonies), `glint`
   (frost feathers + sparkle, crystal/metal facets, lava crust cells via emissive).
2. **Motes** — the few genuinely airborne phenomena (pollen, fungal spores, lava embers) became
   tiny (0.035–0.045) drifting specks with wrap-cell wind travel and edge fades — atmosphere, not cards.
3. **Critters** (`surfaceCritters.ts`) — worm (dirt) and caterpillar (grass, new `grassLife`
   ecology weight) agents that crawl voxel-to-voxel restricted to the home MATERIAL, with
   vertex-shader gaits (peristalsis / inchworm). Close-inspection layer, max distance ≤ 26.

New correctness: effects only spawn where the outward face is actually open
(`isVoxelFaceOpen` — live voxel OR undug original terrain occludes); the old system decorated
buried faces.

## Defects found during verification (headless probes on voxel-test.html)

- **Mirrored instance basis culled every sheet.** The legacy `(tangent, up, up×tangent)` frame
  has negative determinant; DoubleSide layers never noticed, a FrontSide flush quad vanished
  entirely. Fixed with a right-handed frame; regression-tested via `matrix.determinant() > 0`.
- **Critter layer never recovered when voxels populate after mount** (world load, harness).
  Capacity is now re-grown from the per-frame edit-signature path, mirroring the sheet layer.
- **Harness was hostage to the seed's archetype** (seed 12345 = volcanic ⇒ dirt ineligible ⇒
  `?effects=dirt` rendered nothing by design). `voxel-test.html?effects=…` now deterministically
  scans to the nearest seed whose art direction supports the requested material and boosts
  effect density/distance for inspection.

## Evidence

- `npm run verify` green (typecheck, 570+ vitest incl. 20 new surface tests, build).
- Atlas smoke run captures + headless harness probes (sheets/motes/critter layers live with
  expected counts, uniforms, zero console errors; before/after screenshots show grounded flow
  on sand and quiet living topsoil + worms on dirt, patterns continuous across voxel seams).

## Open threads

- Caterpillars currently crawl the grass-voxel surface; attaching them to actual blade
  matrices (shared wind bend) is a future close-up upgrade.
- Sheet/mote alpha tuning at MEDIUM density and on glint archetypes (frost/crystal/metal/lava)
  had only smoke-level review; deserves a screenshot pass at material vantages.
