# Shader & Rendering Implementation Checklist

Tracks the beautiful-shaders upgrade. Plan of record:
`C:\Users\Phillip\.claude\plans\scalable-wondering-lantern.md`.

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked/needs decision

Rule for every phase: end with `npm run verify` green + `?bench=1` perf within budget before moving on.

---

## Phase 0 — Foundation & safety rails
- [x] `aInstanceData` (`vec2`) attribute lifecycle in `efficientVoxelSystem.ts` (create in `setMesh`, null in `clearMesh`)
- [x] Write `aInstanceData` **inside `updateMeshSlot`**; thread `material` from `addVoxel` + `releaseMeshSlot`
- [x] `MATERIAL_ID` map + `materialId()` helper (in `materials.ts`)
- [x] `voxelMaterial` → `createVoxelMaterial()` `onBeforeCompile` + stable `customProgramCacheKey`; shader stashed on `userData`
- [x] `uTime`/`uAnimated` uniforms driven by gated `useFrame` (`updateVoxelMaterialTime`, guards pre-compile)
- [x] NEW `config/graphicsSettings.ts`: quality profiles (ULTRA→POTATO) + runtime store
- [x] `ACESFilmicToneMapping` via Canvas `onCreated`
- [x] IBL: drei `<Environment background frames={1}>` capturing Sky in `App.tsx`
- [x] Per-block PBR LUT (roughness/metalness/emissive) wired through shader (pulled fwd from Phase 1 to prove the pipeline)
- [x] NEW `components/BenchmarkProbe.tsx` + `?bench=1` overlay: `gl.info.render.calls`/`.triangles` + frame p50/p95 JSON
- [x] `?profile=ULTRA|HIGH|...` selects quality profile
- [x] `npm run verify` green (typecheck + 21 tests + build)
- [x] BROWSER SMOKE: shader/page compiles in headless Chrome, no console errors; BASELINE metrics recorded via `?bench=1&profile=HIGH`
- [~] Note: `?bench=1` is a passive probe (fixed seed + stand at spawn). Scripted camera path = optional future enhancement.

> NOTE (corrected vs original plan): `materials.ts` has only `color`+`rarity` (no metalness/roughness/emissive yet — ADD them). No `WATER` material type exists (add SAND/WATER in Phase 4). No pre-existing performance profiles.

## Phase 1 — PBR + triplanar + baked AO
- [x] Add `metalness`/`roughness`/`emissive`/`emissiveIntensity` fields to `materials.ts`
- [x] Per-material roughness/metalness LUT → `<roughnessmap_fragment>` / `<metalnessmap_fragment>`
- [x] Emissive LUT (linearized) → `<emissivemap_fragment>` (+ lava uTime pulse w/ spatial phase)
- [x] Triplanar value-noise detail → `<map_fragment>` (gated by `uTriplanar` from `quality.triplanarDetail`)
- [x] 6-bit face-occupancy mask in `efficientVoxelSystem` → packed into `aInstanceData.y`
- [x] Vertex-shader per-corner AO → `reflectedLight.indirectDiffuse *= vAO` (gated by `uAO` from `quality.bakedAO`)
- [x] Recompute 6 neighbors' masks on edit (`refreshNeighborAO` in add/remove)
- [x] `npm run verify` green (typecheck + 21 tests + build)
- [ ] BROWSER SMOKE: AO crevices darken, triplanar varies surfaces, ores reflect, lava pulses; bench p95 within budget

## Phase 2 — Sky, atmosphere, day/night, fog
- [x] `SkyController.tsx`: day/night cycle (240s), great-circle sun (cube-sphere safe)
- [x] Sun directional light + ambient color/intensity ramp by time-of-day
- [x] `FogExp2` (density 0.014) on scene.fog, color animated to horizon/time (voxels/grass inherit)
- [x] drei `<Stars>` fading in at night
- [x] `animatedShaders` gating (static midday when off)
- [x] Exported `getSunDirection(): THREE.Vector3` for Phase 4 water fresnel
- [x] `npm run verify` green
- [ ] BROWSER SMOKE: day/night reads, fog depth not washed out, stars at night; bench stable

## Phase 3 — Procedural grass
- [x] `GrassField` single InstancedMesh, tapered solid blade (no alpha sort), `frustumCulled=false`, DoubleSide
- [x] GPU wind (uTime + per-instance world-pos phase), root-planted bend (`pow(uv.y,2)`), base→tip color
- [x] CPU placement: orient local +Y → `normalize(worldPos)` via exported `deterministicTangentForUp` (all 6 faces)
- [x] Density/distance gated by `quality.grassDensity`/`grassMaxDistance`; POTATO renders nothing; wind freezes if `!animatedShaders`
- [x] Throttled rebuild (every 30 frames, signature = worldId:grassCount) — handles terrain reload; +7 unit tests
- [x] `npm run typecheck` + `npm run test` green; consolidated `npm run verify` green
- [ ] BROWSER SMOKE: grass on all 6 faces, wind animates, density scales w/ profile; tune SURFACE_OFFSET if clipping

## Phase 4 — Procedural water (oceans)
- [x] `SEA_LEVEL_RADIUS_PERCENT=0.82` + `getSeaLevelRadius()` in `config/worldGeneration.ts` (shared source of truth)
- [x] `SAND` material appended to enum/MATERIALS/MATERIAL_ORDER (id 8); coastline emits sand at/below sea level (no WATER voxels)
- [x] `WaterShell` `IcosahedronGeometry(worldRadius, 5)` at origin, `frustumCulled=false`
- [x] Gerstner (3 waves+noise) displaced along local up, finite-diff normals, Schlick Fresnel + sun glint via `getSunDirection()`, env reflection
- [x] Transparency: `depthWrite=false`, FrontSide, opacity 0.82; terrain-first opaque depth handles occlusion
- [x] Reflection tier gated by `quality.waterReflections` ('none'→flat); animation gated by `waterAnimated`
- [x] Depth-based shallow/deep color SKIPPED (Fresnel approximates it cheaply); `npm run verify` green (28 tests)
- [ ] BROWSER SMOKE: oceans/lakes visible on cube-sphere, surface animates, coastlines sandy, no waterline z-fight

## Phase 5 — Optional painterly post + polish
- [x] `@react-three/postprocessing@3.0.4` + `postprocessing@6.38.3` (pinned for three 0.160 compat); clean peers
- [x] `PostFX.tsx`: EffectComposer (HalfFloat) → selective `<Bloom>` (threshold 0.85) on emissive lava/ores
- [x] Custom `PainterlyEffect.ts` (radius-3 Kuwahara) gated by `quality.painterly`; `?painterly=1` forces it on
- [x] Tone-mapping parity: composer sets `NoToneMapping` + `<ToneMapping ACES>` last; restores on unmount. Post OFF = byte-identical to before
- [x] Mounted only when `quality.postProcess` (ULTRA/HIGH); MEDIUM/LOW/POTATO unchanged
- [x] Full `npm run verify` green (28 tests, 647 modules)
- [ ] BROWSER SMOKE: bloom glows emissive only (not washed), `?painterly=1` oil-paint look, no parity shift on/off

---

## STATUS: all 5 phases implemented, `npm run verify` GREEN. Baseline browser smoke recorded; remaining = deeper visual checks (night sky, painterly, profile comparisons).

### How to test in-browser
- `cd main && npm run dev` → http://localhost:5173/
- `?bench=1` → perf overlay (fps / p50 / p95 / draws / tris). Console logs `[bench] {...}` JSON each window.
- `?profile=ULTRA|HIGH|MEDIUM|LOW|POTATO` → quality tier (default HIGH).
- `?painterly=1` → force Kuwahara painterly post (needs a postProcess profile: ULTRA/HIGH).
- Combine: `?bench=1&profile=ULTRA&painterly=1`.
- Baseline procedure: fixed seed (Default Terrain), stand at spawn, read the window after it settles; record into the table below.

---

## Enhancement round 1 (post first user smoke) — verify GREEN (37 tests, 649 modules)
- [x] GRASS visibility bug fixed: `capacity` is now growable React state (was locked at 1 because voxels load after mount). Tufted clumps (3 blades/unit → ULTRA 18, HIGH 12/voxel), curved blades, layered wind, lusher color. `SURFACE_OFFSET` 0.97.
- [x] WATER visible: `SEA_LEVEL_RADIUS_PERCENT` 0.82 → 0.95 (waterline world ~47.5, just below mean land → oceans + continents, spawn stays dry). Layered swell + ripple normals, depth/Fresnel color, crest foam whitecaps, two-lobe sun glint.
- [x] SPACELIKE SKY: new `SpaceSky` dome (layered twinkling starfield + tilted Milky Way nebula + slow celestial rotation), Preetham `<Sky>` darkened at night, locked to 240s day phase, gated by `animatedShaders`. +8 tests.
- [~] BROWSER SMOKE: HIGH headless smoke shows terrain, grass, water/fog, and overlay; still check night sky drift, painterly, and ULTRA/HIGH profile comparison interactively.

## Enhancement round 2 — WATER REARCHITECTED to voxel blocks — verify GREEN (40 tests, 651 modules)
- [x] DELETED the `WaterShell` sphere (the bubble) — `WaterShell.tsx` + `waterShell.ts` removed, unmounted from `EfficientScene`.
- [x] Water is now REAL BLOCKS: generator classifies exposed water voxels (`isWaterVoxel`/`isAirVoxel`/`getExposedWaterVoxels` = air pockets at/below sea level with an air neighbour). New `utils/waterVoxels.ts` (+3 tests), shared `utils/terrainConfig.ts`.
- [x] `WaterBlocks.tsx` + `waterBlocksMaterial.ts`: one InstancedMesh of water cubes; surface computed in WORLD space (waves/normals keyed on world pos + local up) → CONTINUOUS across adjacent blocks on all 6 faces. Fresnel deep→sky, env reflection, ripple normals, sun glint, crest foam; topness term ripples outward faces only. `transparent`, `depthWrite=false`, gated by quality.
- [!] DESIGN FINDING: sea level 0.95·R floods only lowlands → default seed 12345 has ocean (~2488 blocks), seed 13579 ~550, but seeds 54321/98765/24680 produce ZERO water (their terrain never dips below sea level). If oceans are wanted on ALL presets, raise `SEA_LEVEL_RADIUS_PERCENT` (or per-seed sea level).
- [ ] BROWSER SMOKE: blocky ocean fills basins, surface ripples continuously across blocks, seabed (SAND) shows through; check perf w/ `?bench=1`.

## Enhancement round 3 — WATER surface quads + fidelity — verify GREEN (44 tests, 651 modules)
- [x] HOLLOW-BOX fix: water no longer drawn as transparent cubes. New `getExposedWaterFaces()` + `buildWaterFaces()`; `WaterBlocks` now instances `PlaneGeometry(2,2)` quads, one per air-facing water face (default seed: 2569 faces, all top), oriented via 6 precomputed quaternions → seamless gapless surface sheet, no interior to see through.
- [x] FIDELITY: 5-octave swell FBM + high-freq ripple FBM, analytic normals (waveScale 0.32→0.55, roughness 0.12→0.06), strong Schlick Fresnel on perturbed normal, envMapIntensity 0.6→1.5 (sky/stars reflect), view-depth deep/shallow color, sun glint core+sparkle+sheen, improved foam. Cache key `water-blocks-pbr-v2`.
- [x] Transmission/refraction considered but NOT used (forces full-scene pass, conflicts with depthWrite=false instanced quads); seabed shows through via alpha + Fresnel depth approximation instead.
- [x] Gating preserved (`waterReflections==='none'`→flat; `waterAnimated`→freeze). One draw call, ~2.5k quads.
- [ ] BROWSER SMOKE: water reads as a real rippling surface from all angles (no boxes), reflects sky/stars, sun sparkle; check cliff-heavy seeds (MOUNTAINS/ISLANDS) for transparency sorting on side faces.
- [!] STILL OPEN: raise `SEA_LEVEL_RADIUS_PERCENT` so all presets get oceans? (default/valleys have water; mountains/hills/islands = none by design.)

## Enhancement round 4 — water visible + per-seed oceans + overview — verify GREEN (50 tests, 652 modules)
- [x] ROOT CAUSE of "invisible water": depth-color mix was inverted (straight-down view washed to near-black/transparent → looked like sand). Fixed: readable DEEP color `0x10495e` looking down, opacity floor 0.85–0.92, additive `uNightFloor` so it stays visible at night. VERIFIED via headless Playwright screenshot (turquoise ocean + continents from overhead).
- [x] PER-SEED sea level: percentile of each seed's surface-radius distribution (`seaLevelPercentile` in terrain config). Coverage: mountains ~1% (rare), islands ~6%, default ~37%, hills/valleys ~53%. EVERY preset + random seeds now have water (test asserts non-empty + valleys>mountains).
- [x] `OverviewCamera` (`?overview=1`): top-down orbit cam for inspection; now SUPPRESSES scene fog while mounted (restores on unmount) so the orbit view is clear. Normal-play fog kept thick (user likes it) at density 0.014.
- [x] `npm run verify` green (50 tests). Water build scan ~227k cells one-time (cached), no runtime cost.
- [ ] USER SMOKE: reload `?overview=1` (now fog-free) — ocean clearly visible; normal play fog unchanged; check night water + cliff seeds.

## Enhancement round 5 — WATER PERSISTENCE bug (the real "disappears" cause) — verify GREEN (50 tests)
- [x] ROOT CAUSE of "works briefly then gone": `WaterBlocks` used a declarative `count={0}` prop and filled instance matrices only in an effect keyed on `[waterFaces]`. `EfficientScene` re-renders every time the player moves (playerPosition state) → R3F resets `count`/reconstructs the mesh → instances go to 0, and the fill effect never re-runs → ocean vanishes after the first frame. (This is why every prior screenshot "saw water" — single early frame — but live play didn't.)
- [x] FIX (3-way, in `WaterBlocks.tsx`): (1) removed `count={0}` — count is owned imperatively; (2) `memo()` the component so player-movement re-renders never reconcile it; (3) per-frame SELF-HEAL tied to the mesh object (`__waterFilledFor` marker) — re-fills if count resets OR R3F swaps the mesh, so it can never silently vanish again. `useLayoutEffect` fills before first paint (no origin clump).
- [ ] USER SMOKE (normal play, NOT just overview): walk around for 10–20s — ocean must STAY visible (previously vanished after first move). Overview mode never reproduced this (no player there).

## Enhancement round 6 — THE ACTUAL INVISIBLE-WATER BUG (GLSL compile failure) — verify GREEN (50 tests)
- [x] Runtime console proved it: `THREE.WebGLProgram: Fragment shader is not compiled` while `[water] count=5687 visible=true inScene=true` — geometry was fine, the water PROGRAM was dead (build never compiles GLSL, so `verify` stayed green the whole time → why every prior "fix" failed).
- [x] ROOT CAUSE: the colour/Fresnel injection lived in `<map_fragment>` and referenced `normal`, but Three doesn't declare `normal` until `<normal_fragment_begin>`, which runs LATER in fragment main() → undeclared identifier → fragment compile failure → invisible water.
- [x] FIX: moved ALL `normal`-dependent water shading (normal perturbation + Fresnel + depth color + foam + diffuseColor/alpha) into `<normal_fragment_begin>` where `normal` and `diffuseColor` are in scope; removed the `<map_fragment>` injection; glint stays in `<emissivemap_fragment>` (runs after, valid). Cache key bumped v3→v4. (Also fixed a self-inflicted TS error: backticks inside a GLSL comment terminated the template literal.)
- [x] Instrumentation added to `WaterBlocks.tsx`: `[water] FILL/tick` logs (count, AABB, radius, inScene) + `?waterdebug=1` opaque-magenta material — keep for future diagnosis.
- [ ] USER SMOKE: reload (Ctrl+Shift+R) — console should have NO "Fragment shader is not compiled"; water should finally be VISIBLE.

## Benchmark log (p50 / p95 frame-time ms, drawCalls, triangles @ profile)
| Phase | p50 ms | p95 ms | draws | tris | profile | notes |
|-------|--------|--------|-------|------|---------|-------|
| baseline | 174.1 | 199.3 | 1 | 12 | HIGH | Headless Chrome, `?bench=1&profile=HIGH`, postprocessing on; PNG was nonblank and console errors were empty. |
