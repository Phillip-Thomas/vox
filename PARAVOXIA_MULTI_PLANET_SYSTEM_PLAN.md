# Paravoxia Multi-Planet Star System Plan

Status: **PLAYABLE SINGLE-PLAYER SYSTEM TRAVEL IMPLEMENTED - RELEASE PERFORMANCE GATE OPEN**

Owner request: some galaxy coordinates should contain multiple planets. A player
must be able to launch from one, fly through real continuous system space, see the
destination grow throughout the trip, enter its atmosphere, and land without an
interstellar warp or a visible world-swap mask. Sibling planets must also be
visible from the surface as high-quality, aggressively LOD-managed celestial
bodies.

This plan preserves the current single-planet game, story world, saves, generation,
and interstellar party warp. It does not make two complete voxel planets live at
once.

## Implementation Checkpoint - 2026-07-12

The first end-to-end P0-P4 slice is now playable behind the normal deterministic
system population (with `?systemBodies=0|1|2|3` overrides for comparison):

- deterministic one-to-three-body manifests preserve slot-0 IDs and seeds while
  giving secondary planets canonical `x,y:p1` / `x,y:p2` identities;
- the server accepts canonical secondary identities, and connected multiplayer
  deliberately disables local system travel until the P5 protocol exists;
- inactive siblings render from the surface and deep space with shared cuboid
  geometry/material programs, terrain palette, clouds, rings, terminators,
  atmosphere extinction, and quality-tier budgets;
- a canonical system-flight store owns position, velocity, orientation, render
  origin, target, activation epoch, and the single pose-writer lease;
- local-body aim lock, physical thrust travel, readiness-aware approach assist,
  and atmosphere activation work without calling interstellar warp or party warp;
- a cancellable module worker prepares packed terrain, exposed voxels, deposits,
  water cells/faces, and arrival data; cooperative hydration publishes the legacy
  cache atomically and validates readiness against both cache residency and the
  canonical world ID;
- source ecology demotes during departure and target terrain, water, structures,
  flora, and fauna stage during arrival; only one full planet runtime is mounted;
- offline persistence records the last canonical planet while retaining the
  legacy `lastWorld` fallback.

Current evidence on HIGH at `1440x900`, system `-19,-17`:

- 10,000-system determinism, separation, population, and envelope sweep passes;
- surface companion delta is 139 -> 145 draws, 961,590 -> 970,422 triangles,
  44 -> 45 shader programs, and p95 16.9 -> 16.8 ms;
- a real ShipController route crosses 2,221 units, activates `-19,-17:p1` in
  about 9.7 seconds, and preserves canonical pose, velocity, and orientation;
- no browser, React-depth, black-frame, loading-screen, warp, or party-warp error
  was observed in the route probe;
- final `npm run verify` passes with 925/925 client tests and 43/43 source server
  tests, both TypeScript builds, and the production Vite bundle;

This is not yet the release gate. The exact-runtime handoff still produces two
headless Long Tasks (65 ms and 93 ms in the latest route) while instance buffers
and the first exact frame become renderer-ready. CPU terrain population itself was
18.5 ms and water fill 3.5 ms. The next pass must stage GPU upload/readiness and
retain a pixel-matched proxy until the exact frame has painted. Byte-weighted cache
limits, full A -> B -> A edit preservation, persistent Physics/controller ownership,
and multiplayer system travel also remain open.

---

## 1. Architectural Decision

The implementation will use:

1. A deterministic star-system manifest containing one to three planets.
2. A persistent system-space ship/camera runtime.
3. Stable, physically positioned proxy representations for every inactive body.
4. Zero or one full voxel/physics/ecology planet runtime.
5. A cancellable worker that prepares one committed target off the main thread.
6. An atomic reference-frame rebase and opaque dither handoff between the target
   proxy and the sole full planet runtime.
7. Independent visual-LOD and data-residency state machines. Apparent size chooses
   what is drawn; route commitment and time-to-arrival choose what is prepared.

The central invariant is:

> During same-system travel, never render two full planets and never teleport the
> canonical ship. Preserve one continuous system-space pose while changing only
> the planet representation and render reference frame.

This is true seamless travel even though the renderer changes LOD internally. The
ship's position, velocity, orientation, target bearing, and the screen-space planet
remain continuous.

---

## 2. Non-Negotiable Invariants

- [x] Legacy primary planets keep `worldId = "x,y"`, their exact current seed,
      terrain, saves, bases, bookmarks, and multiplayer shard history.
- [x] The pinned story world remains primary planet slot `0` and single-body until
      explicitly authored otherwise.
- [x] Existing interstellar `beginTravel()` behavior remains available and uses
      warp. Same-system travel never calls it.
- [x] At most one `EfficientPlanet`, one bound `voxelSystem`, one Rapier terrain
      set, and one ecology runtime may be active.
- [ ] During mid-system cruise, zero full planets is valid and preferred.
- [x] Canonical travel state is stored in system space, never in rebased render
      coordinates.
- [x] Exactly one subsystem writes canonical ship pose during any simulation step;
      render-frame rebases never become a second source of truth.
- [ ] A saved or networked system pose pins its system-layout version. A
      content update may not silently move already-visited bodies around it.
- [x] Target generation cannot execute synchronously on aim, target lock, approach,
      or handoff.
- [x] All quality tiers show sibling planets. Quality changes representation cost,
      not their existence.
- [x] Offline single-player remains functional at every phase.
- [ ] Co-op cannot silently accept cross-planet mutations or poses.
- [ ] No black frame, white flash, loading screen, or forced interstellar warp may
      hide a same-system handoff.

---

## 3. Current Reality And Why A Direct Two-Planet Mount Is Wrong

### Identity and ownership

- `main/src/utils/worldCoordinates.ts:1-48` makes one `{x,y}` coordinate serve as
  galaxy location, planet identity, seed source, and `worldId`.
- `main/src/game/worldIdentity.ts:4-26` only adds generation schema metadata.
- `server/src/worldIdentity.ts:12-22` and `server/src/worldAuthority.ts:12-36`
  parse the same one-planet coordinate identity.
- `server/src/rooms.ts:59-69` owns one party-wide `activeWorldId`; commands and
  poses outside it are rejected in `server/src/stateServer.ts:420-423` and
  `server/src/stateServer.ts:1176-1182`.

### Rendering and travel

- `main/src/App.tsx:555-576` swaps `currentWorld` at warp whiteout.
- `main/src/App.tsx:889-905` keys the whole `EfficientScene` by world, destroying
  and remounting it on every swap.
- `main/src/components/EfficientScene.tsx:149-232` owns the full terrain, Physics,
  player/ship, water, vegetation, fauna, structures, and story props together.
- `main/src/components/EfficientPlanet.tsx:35-37,270-345` and
  `main/src/utils/efficientVoxelSystem.ts:67-108` expose one global terrain owner.
- `main/src/components/ShipController.tsx:136-220` stores flight pose in component
  refs and resets velocity on remount, so it cannot survive a seamless handoff.

### Existing planet impostors

- `main/src/components/GalaxyImpostors.tsx:110-191` creates up to 32 visual planets.
- `main/src/components/GalaxyImpostors.tsx:381-425` moves their parent group with
  the camera, so they have no parallax and can never be approached.
- Each visual planet can submit surface, cloud, atmosphere, and ring draws with its
  own `useFrame` and disabled frustum culling. Replacing this component with a
  batched interstellar layer plus at most two sibling bodies should reduce, not
  increase, steady draw calls.
- `main/src/components/SpaceSky.tsx:20-79` places an opaque radius-220 surface sky
  in front of the current 2,400+ unit impostors. Surface-visible siblings need an
  explicit celestial-body pass or a verified larger sky-depth arrangement.

### Generation and loading

- `main/src/utils/worldGenCache.ts:63-179` is a three-entry object-graph LRU.
- `scheduleWorldPrewarm()` at `main/src/utils/worldGenCache.ts:342-368` defers work
  but still performs the full generation synchronously on the main thread.
- `main/src/components/GalaxyImpostors.tsx:421-425` records that target-hover
  prewarming was removed because it froze frames.
- The existing representative world-load probe measured roughly:
  - 118,055 generated voxels
  - 824 ms cold voxel scan
  - 813 ms duplicate arrival-site scan
  - 711 ms water-face generation
  - 422 ms terrain materialization
  - 17,393 exposed terrain instances

This is over 2.7 seconds of synchronous CPU work before full ecology setup. A worker
and packed transfer format are mandatory.

### Radius terminology

The current `planetSize = 50` is a nominal face/control radius, not a spherical
physical bound. Generation uses voxel face radius `25`; `VOXEL_SCALE = 2` produces
nominal face radius `50`, exposed cube centers/half-extents reach about `51`, and a
corner can reach bounding radius about `sqrt(3) * 51 = 88.3` before any generator
relief audit. New code must name and measure these separately:

- `voxelFaceRadius`: generator lattice extent;
- `nominalFaceRadius`: current control/gravity compatibility value;
- `surfaceBoundRadius`: generated conservative culling/projection/collision bound;
- `atmosphereInnerRadius` / `atmosphereOuterRadius`: authored environment bands;
- `surfaceDistance(localPosition)`: cube/terrain-aware signed distance used for
  approach, gravity ownership, landing, and horizon decisions.

Separation, occultation, proxy projection, and far-plane math use the conservative
bound. Planet-local gameplay uses surface distance, not an assumed spherical radius.
The 2.7-second figures above are a one-run diagnostic, not a baseline; P0 replaces
them with repeated cold/warm measurements over representative seeds.

---

## 4. Target Player Experience

### From a planet surface

- A sibling occupies a stable direction in the sky with a real angular diameter,
  terminator, atmosphere rim, palette, water/land read, and optional rings/clouds.
- It is occluded by the current planet below the horizon and participates in the
  same sun direction and day/night logic.
- It remains visible on POTATO, but as a cheap shared proxy.

### Launch and cruise

- Crossing atmosphere changes sky/fog/audio continuously; it does not mini-warp for
  a same-system route once the continuous blend is complete.
- A sibling target is physically fixed in system space. Thrust produces parallax
  and a monotonically growing angular size.
- Interstellar markers remain a separate camera-relative layer and still engage
  warp.
- A distance-aware cruise assist may raise open-space speed and reduce closing
  speed near the destination, but never changes position discontinuously.

### Approach and landing

- The target worker job starts only after the route is committed or the target has
  remained stable, not whenever the reticle crosses a body.
- The proxy stays visible until the exact target representation is ready.
- Macro and exact surfaces overlap through an opaque screen-space dither shell.
- The full target runtime activates before the atmosphere/landing band. Existing
  local gravity, collision, vegetation, harvesting, structures, water, and story
  systems continue operating around an origin-centered active planet.

---

## 5. Domain And Compatibility Model

```ts
interface SystemCoordinate {
  x: number;
  y: number;
}

interface PlanetAddress {
  system: SystemCoordinate;
  slot: 0 | 1 | 2;
}

interface PlanetDescriptor {
  address: PlanetAddress;
  worldId: string;
  seed: number;
  systemPosition: [number, number, number];
  terrainOrientation: [number, number, number, number];
  nominalFaceRadius: number;
  surfaceBoundRadius: number;
  profile: PlanetProfileSummary;
}

interface StarSystemManifest {
  systemId: string;
  systemSeed: number;
  planetIdentityVersion: number;
  layoutVersion: number;
  star: StarProfile;
  planets: PlanetDescriptor[];
}
```

### Canonical identifiers

- System ID remains `coordinateKey({x,y})`.
- Slot `0` world ID remains exactly `"x,y"`.
- Secondary planet IDs use `"x,y:p1"` and `"x,y:p2"`.
- Slot `0` seed remains exactly `coordinateToSeed(x,y)`.
- Secondary seeds use a frozen `PLANET_IDENTITY_VERSION` namespace. Changing a
  secondary terrain seed requires a new world ID or an explicit data migration.
- `SYSTEM_LAYOUT_VERSION` is separate from planet identity and terrain schema.
  Changing layout must not invalidate terrain saves, but the layout version must be
  stored with system-space poses and room state so an update cannot reinterpret them.
- Secondary slot identity and terrain seed never change merely because layout or
  visual generation advances. Any body-count migration requires an explicit
  compatibility table rather than silently deleting a visited secondary world.
- `createCurrentWorld(coordinate)` remains a slot-0 compatibility constructor.
  New code uses `createPlanetIdentity(address)`.

### Initial system population

- Initial tuning hypothesis, pending visual/gameplay approval: 60% one planet, 30%
  two planets, 10% three planets.
- Maximum three total planets, therefore at most two surface-visible siblings.
- Primary planet remains at the compatibility slot and seed.
- Slot `0` is the V1 system-space origin so legacy arrivals map cleanly to
  `[0,0,0]`; companions receive deterministic fixed centers around it.
- Every body pair has at least 2,000 units of center separation (about 39 nominal
  face radii or 23 current conservative bounding radii).
- Initial system envelope is approximately `2,000-4,800` units from the primary;
  the maximum body-pair span is about `9,600`, and the flight far-plane spike starts
  at a derived `16,000` cap including route-overshoot margin.
- V1 body centers are deterministic and session-stable. Real orbital motion and
  N-body simulation are deferred; the manifest may reserve orbital fields.
- V1 voxel terrain orientation is identity for every body. Proxies may rotate
  clouds and rings, but never independently rotate the terrain beneath an exact
  handoff.
- V1 keeps the star as the existing shared directional light/celestial visual,
  outside the compressed interplanetary flight volume. A spatially approachable
  stellar hazard is a later feature, but every sibling uses the same star vector.
- Distances are gameplay-compressed rather than astronomical. They must still be
  crossed continuously, with no position skip, and route duration is a P6 tuning
  target rather than a reason to change system coordinates at runtime.
- The story system returns one body unless an authored override is introduced.

---

## 6. Runtime Ownership

```txt
App
  SolarSystemRuntime (persistent across planet activation)
    SystemClock / manifest / star
    SystemBodyRenderer
      sibling proxies
      TargetRenderRuntime (0 or 1: macro/exact render-only shells)
    InterstellarTargetRenderer
    SystemFlightStore
    EnvironmentFrame (system clock + nearest-body influences)
    Persistent ShipController + camera
    StreamingCoordinator
    Physics (persistent container)
      ActivePlanetRuntime (0 or 1, keyed by planet worldId)
        EfficientPlanet / voxelSystem binding
        water and atmosphere-near fields
        ecology and surface effects
        structures and per-planet persistence
        on-foot player while landed
```

Required ownership changes:

- [ ] Lift `Physics` out of the keyed planet component.
- [ ] Move `ShipController` and its camera outside `ActivePlanetRuntime`.
- [ ] Publish ship system position, velocity, orientation, thrust, and active frame
      into canonical flight state instead of component-only refs.
- [ ] Make `ActivePlanetRuntime` conditional: `null` during mid-system cruise.
- [ ] Keep all origin-assuming surface code planet-local.
- [ ] Give `SkyController`, audio, post-processing, fog, grading, and lighting one
      explicit `EnvironmentFrame`; none may infer an environment from a stale
      `currentWorld` while `activePlanet` is null.
- [ ] Use a shared system clock and per-body phase so proxy terminators, surface
      sun direction, sky, and target activation agree on the same frame.
- [ ] Split render-only macro/exact shells from active water, colliders, ecology,
      structures, and global `voxelSystem` binding.
- [ ] Replace `currentWorld` as the top-level render owner with `currentSystem`,
      `activePlanet`, and `residentPlanet` state.

---

## 7. Reference Frames And Continuity

Canonical state uses JavaScript double precision:

```txt
shipSystemPosition: position relative to the system origin
bodySystemPosition: deterministic center from the manifest
renderOrigin: system-space point mapped to Three/Rapier origin

renderPosition = systemPosition - renderOrigin
planetLocalPosition = shipSystemPosition - bodySystemPosition
```

Rules:

- Surface/atmosphere: `renderOrigin = activeBody.systemPosition` so every existing
  local radial/gravity computation still sees its planet centered at zero.
- Mid-system cruise: render origin can remain the departed body center within the
  bounded V1 system, then rebase to the target center. The abstraction must support
  ship-relative rebases later without changing canonical pose.
- Put persistent system renderables beneath one reference-frame transform and derive
  ship/camera render poses from canonical system pose. A rebase changes
  `renderOrigin` atomically rather than imperatively shifting an open-ended object
  list; it never modifies canonical system pose or velocity.
- V1 rebases only after the source active runtime is unmounted and the persistent
  Physics world has zero planet-local Rapier bodies, then mounts the target. This
  removes broadphase and one-frame collision ambiguity at the cost of requiring the
  aligned source macro to own the image before demotion.
- In flight, the ship controller/rigid body publishes canonical pose once per fixed
  step. While landed, the planet-local parked ship pose derives from the same
  canonical record. Promotion, demotion, and networking only request transitions.
- Dominant body selection uses nearest surface distance plus hysteresis. Never blend
  two cube-surface gravity fields.
- Interplanetary flight remains controllable and initially gravity-free. Analytic
  body attraction is optional later.
- Inactive proxies use analytic bounds/collision avoidance only. Rapier terrain
  belongs exclusively to the active planet.
- Boarding converts planet-local player/ship pose into the canonical system frame.
  Landing converts system pose into the target planet-local frame before on-foot
  state or surface persistence mounts. Both conversions preserve quaternion,
  velocity, and the existing planet-local `playerFrame` contract.

Continuity machine gate:

- canonical ship position/velocity delta: `<= 1e-9` system units and quaternion
  angular delta `<= 1e-7` radians across a rebase;
- every object-minus-camera vector represented on both sides changes by `<= 1e-5`
  render units (the raw camera world matrix is expected to translate);
- target projected center and apparent-radius discontinuity: `<= 2` framebuffer
  pixels each at the tested viewport/DPR;
- boarding/landing round-trip pose and quaternion tolerances pass in both directions.

---

## 8. Planet Representation Ladder

Visual representation uses conservative projected bound plus screen-space geometric
error with 20% hysteresis. Pixel values mean framebuffer pixels after DPR; desktop
and mobile thresholds are calibrated independently. Preparation and residency are a
separate state machine driven by committed target, estimated time to arrival, worker
progress, memory budget, and physical activation safety bands.

| Visual state | Typical trigger | Representation | Ownership |
| --- | ---: | --- | --- |
| metadata | offscreen | manifest/profile only | all bodies |
| interstellar marker | `<6px` | batched point/billboard | other systems |
| sky proxy | `6-96px` projected bound, low error | shared low-cost procedural body | all siblings |
| macro body | proxy error exceeds budget, or target is committed | cuboid terrain shell + atmosphere | committed/near body |
| exact terrain | target ready, entry safety band about 600 units | packed exposed terrain render shell, no gameplay owner | max one |
| active surface | before outer atmosphere/landing safety band, activation ready | water + colliders + ecology + structures + voxel owner | max one |

The physical bands are approach safety gates, not substitutes for visual error. A
small viewport may prepare exact terrain before a nominal pixel threshold; a large
viewport may draw the macro body early without retaining a full world. The final
numbers must be derived from the measured `surfaceBoundRadius`, atmosphere bounds,
braking distance, camera FOV, and slow-tier readiness time. The macro shell remains
available until exact activation is proven complete.

### Proxy fidelity

- Use a shared material/program and shared base geometry wherever possible.
- Use real system direction and physical angular size.
- Match planet art direction: land, rock, ocean, ice, atmosphere, cloud, bloom,
  rings, and sun terminator.
- The macro shell must sample the actual dominant-axis/cuboid terrain field. The
  current `worldPreview` sphere is suitable for metadata colors, not for the final
  approach silhouette.
- Construct the macro from six dominant-axis face heightfields produced by the real
  generator contract. Quantize toward the voxel silhouette; weld or skirt face
  seams; preserve ocean/material classification; test corners, seams, coastlines,
  and silhouette error against exact terrain.
- Use an opaque dither transition. Transparent alpha crossfades invite sorting and
  fill-rate problems.
- A safe handoff uses a conservative macro envelope, complementary screen-space
  masks with one shared threshold, and an explicit depth-bias rule. Silhouette gaps
  exposing the backdrop fail the transition even if center/radius continuity passes.
- Keep one atmosphere/cloud/ring owner through terrain handoff so additive rims,
  outlines, AO, and post-processing do not double.
- Bake clouds into lower-tier proxy maps; keep a separate cloud shell only where
  the quality budget permits.

### Celestial and depth composition

Use a dedicated surface celestial pass; do not expand the voxel camera far plane or
move the opaque sky beyond the whole system. On the surface, remap each sibling to a
depth-tested surrogate inside the radius-220 sky while preserving its physical
direction and angular diameter. Terrain remains nearer and therefore supplies real
horizon occlusion. The surrogate uses `fog=false`; explicit atmosphere extinction,
elevation, and daylight terms replace fake distance fog.

Composition order is background sky, opaque sibling body, active terrain/opaque
world geometry with normal depth, sibling atmosphere/cloud/ring transparencies,
local transparent effects, then post-processing. The P1 spike must verify actual
Three render order, depth writes, outlines, bloom, fog, and day/night extinction.

In flight, render siblings at their physical system positions. Replace the current
roughly 7,040-unit depth-writing backdrop with a fullscreen/depthless backdrop and
derive the ship-camera far plane from the maximum body-pair distance plus route
overshoot margin (initial cap `16,000`, to be proven). Surface and flight cameras get
separate depth-precision tests. The surrogate-to-physical switch must preserve the
same view direction and apparent radius through atmosphere blending.

---

## 9. Travel State Model

The current `phase` conflates environment, control, and interstellar handoff. Add
orthogonal state without breaking existing consumers:

```ts
type LocationMode = 'surface' | 'atmosphere' | 'local_space' | 'system_cruise';

type FlightTarget =
  | { kind: 'system_body'; address: PlanetAddress }
  | { kind: 'star_system'; coordinate: SystemCoordinate };

interface SystemFlightState {
  systemId: string;
  layoutVersion: number;
  activePlanetId: string | null;
  lastActivePlanetId: string;
  locationMode: LocationMode;
  target: FlightTarget | null;
  pose: SystemShipPose;
  residency: ResidencySnapshot;
  activationEpoch: number;
}
```

Transitions:

```txt
surface
  -> atmosphere (existing launch)
  -> local_space (leave atmosphere; source detail may demote)
  -> system_cruise (sibling target committed; no warp)
  -> local_space near target (deceleration + target preparation)
  -> atmosphere (target exact representation active)
  -> surface (existing landing)

local_space/system_cruise
  -> interstellar warp only for a star-system target
```

The existing whiteout-driven `beginTravel()` stays intact for interstellar travel.
The same-system path gets `commitSystemTarget()` / `beginSystemCruise()` and never
uses `WarpOverlay` as a loading mask. Interstellar warp is the sole allowed canonical
system-position discontinuity and creates a new system frame at its existing masked
handoff.

---

## 10. Streaming And Cache Pipeline

### Worker outputs

One Vite module worker prepares a committed target with cancellation generations:

1. manifest/profile metadata;
2. proxy surface map and macro shell;
3. base terrain positions/material/deposit data;
4. exposed terrain mesh buffers;
5. water faces/voxels;
6. arrival/approach data generated in the same scan;
7. optional field placement tables where this removes a later main-thread walk.

All large arrays are transferable typed buffers, never cloned object graphs.
Long scans must use cooperative checkpoints (or a worker-safe atomic generation
token) so a superseding target can be observed within the cancellation budget; a
queued `postMessage` alone cannot interrupt one monolithic CPU loop.

Worker output is not useful until every current consumer can hydrate it without
rescanning. P3 therefore adds explicit packed contracts for:

- `hydrateWorldGen(worldId, packedPayload)` with no generation scan;
- static and dynamic water occupancy/state;
- direct typed terrain/instance buffer binding;
- packed or incrementally reconstructed coordinate lookup for mining/collision;
- arrival, deposit, material, and block identities without `THREE.Color`, `Map`, or
  per-voxel object reconstruction in one frame.

All caches key mutable state by canonical `worldId`/`PlanetAddress`, generation
schema, and payload version. Seed is only a generation input; it is never a unique
cache identity because 32-bit collisions and sibling mutable water/edit state must
remain isolated.

### Main-thread activation

- Never mount target detail until its required payload is complete.
- Precompile target shader programs after target commit.
- Pace GPU upload at <= 3 ms of main-thread work per frame.
- Upload caps: 2 MB/frame ULTRA/HIGH, 1 MB MEDIUM, 0.5 MB LOW/POTATO.
- Stage runtime activation: terrain, essential water/atmosphere, then trees/grass,
  then secondary flora/fauna/effects.
- Budget collider creation and Rapier insertion as part of activation, not merely
  terrain upload. Essential approach/landing collision must be ready before the
  macro shell yields visual ownership.
- Keep the macro body occluding unfinished detail until the exact representation is
  ready for dither handoff.
- If target preparation is late, retain the orbital proxy and reduce inward cruise
  speed. Never fall back to synchronous generation.
- Readiness has a geometric deadline: the complete required payload and essential
  collision must be ready before `stoppingDistance + activationMargin`. On the
  slow-device/worst-seed tier, cruise assist must hold outside that boundary without
  oscillation or an indefinite invisible stall.

### Atomic owner transfer

Every activation uses a monotonic owner lease/epoch. The transaction freezes world
commands, persists the source, unbinds replication and voxel callbacks, removes old
colliders, clears world-scoped singletons, rebases with zero planet-local Rapier
bodies, hydrates target snapshot/payload, binds the target owner, and only then
resumes gameplay. Worker/network results carry the epoch and stale results are
discarded. Probe sampling supplements this transaction; a once-per-frame owner count
alone cannot prove that no same-commit overlap occurred.

### Residency and memory

```txt
METADATA: all bodies, <= 2 MB total system preview CPU data
SKY_PROXY: all siblings, quality-budgeted GPU resources
WARM_TARGET: exactly one target, packed CPU payload tier-capped below
ACTIVE: zero or one full runtime
DORMANT_RETURN: optional compact source shell/edit state in weighted LRU
```

Packed warm-target caps are 8 MB ULTRA/HIGH, 6 MB MEDIUM, and 4 MB LOW/POTATO.
Replace entry-count-only caching with byte-weighted eviction. Initial post-settle
main-heap delta caps over the matched single-planet baseline are:

- ULTRA/HIGH: 24 MB
- MEDIUM/LOW: 16 MB
- POTATO: 12 MB

Worker peak heap, post-transfer main heap, and GPU memory are reported separately;
transferable buffers are counted under exactly one current owner. P0 records the
worker peak baseline before setting its regression cap. Worker cancellation must be
observed within 100 ms by cooperative checkpoint or terminate/recreate. Gates assert
detached transfer ownership and dropped references immediately; GC timing is not an
acceptance condition, while repeated-retarget heap drift remains a soak failure.

---

## 11. Quality And Performance Budgets

These are total same-system proxy caps, not targets. The existing 32-world renderer
must be batched/reduced, so the new feature should produce a net draw-call reduction.
Measure sibling deltas against a one-body control using the same new batched
interstellar renderer, not against the old component-heavy renderer.

| Tier | Proxy triangles | Added draws | Proxy GPU maps | Program delta |
| --- | ---: | ---: | ---: | ---: |
| ULTRA | 120k | 12 | 8 MB | <=2 |
| HIGH | 96k | 12 | 4 MB | <=2 |
| MEDIUM | 48k | 8 | 2 MB | <=2 |
| LOW | 24k | 6 | 1 MB | <=1 |
| POTATO | 8k | 4 | 0.25 MB | <=1 |

The replacement interstellar layer has its own all-tier cap: up to 32 unselected
targets in <=2 batched draws, <=4k submitted triangles, <=0.35 ms p95 main-thread
targeting/update time, plus <=2 draws only for the selected interstellar target.

Target macro/approach shell caps:

- ULTRA: 250k triangles
- HIGH: 220k
- MEDIUM: 160k
- LOW: 50k
- POTATO: 16k

During source demotion or target promotion, the matched exact-only control may add
at most the tier's macro triangles, 6 transient draws, and 1 already-precompiled
program. Record opaque/transparent passes and GPU time separately; doubled
atmospheres, cloud shells, bloom rims, or post-process registrations are forbidden.

Add graphics controls in `main/src/config/graphicsSettings.ts` for:

- proxy surface resolution;
- cloud shell/baked cloud mode;
- ring segments;
- macro shell resolution;
- target upload budget;
- same-system body count visibility (never below all actual siblings as points).

Absolute atlas gates remain the existing profile limits in
`main/src/utils/proceduralAtlasReport.ts:69-75`. Delta evidence uses at least three
paired runs with identical commit, browser, power mode, seed, route, profile,
viewport/DPR, warmup, and minimum sample duration/frame count. Compare paired
medians and upper percentiles; exclude screenshot/atlas capture frames. Add gates
against the matched one-body control:

- steady surface and cruise p95 <= baseline + 2 ms;
- FPS loss <= 5%;
- surface sibling p95 target <= baseline + 1 ms;
- no frame gap >= 50 ms;
- handoff main-thread stall <= 16 ms HIGH/ULTRA, <= 25 ms lower tiers;
- shader programs <= matched baseline plus the explicit precompiled proxy key
  allowlist for that profile;
- exactly zero or one full planet owner at every sampled frame;
- no memory drift greater than 10% or 16 MB after ten round trips.

---

## 12. Persistence And Story Migration

### Offline save

Add a versioned location record while preserving legacy fallback:

```ts
interface SavedLocationV2 {
  system: SystemCoordinate;
  layoutVersion: number;
  lastActiveWorldId: string;
  planetSlot: number | null;
  mode: LocationMode;
  shipPose?: SystemShipPose;
  committedTarget?: PlanetAddress;
  transitionEpoch: number;
}
```

- Existing `lastWorld` loads as system `{x,y}`, slot `0`, surface mode.
- Surface player poses remain planet-local and keyed by `worldId`.
- Space ship poses are system-local and keyed by `systemId`.
- Secondary planet terrain/structures/resources use their canonical suffixed
  `worldId`; primary keys remain untouched.
- Booting with `planetSlot=null` starts `SolarSystemRuntime` directly, uses
  `lastActiveWorldId` only as an environment/persistence fallback, restores the
  pinned manifest version and ship pose, and does not mount a fake current world.
- Use a small transition journal: write pending epoch/target, durably save source
  edits, demote, activate and snapshot target, commit new location, then clear the
  journal. A reload/tab kill resumes or rolls back deterministically at every step.
- Activate target persistence only inside the atomic owner-transfer transaction.

### Story

- Story coordinate always resolves to slot `0` and a one-body manifest initially.
- Same-system travel remains locked behind a future authored A5/emergent travel
  milestone; until that runtime milestone exists, the story override remains
  single-body and the feature is debug/free-play only.
- Reality-stage and constellation/perceiver rules apply to sibling rendering.
- Do not let early story chapters gain smooth high-fidelity sky bodies before their
  rendering stage permits them.

---

## 13. Multiplayer Boundary

Current Phase 1 co-op is explicitly party-locked. Preserve that rule first.

### Before seamless co-op ships

- Offline feature work remains behind a deterministic/debug feature gate.
- Connected co-op continues using existing interstellar party warp until a protocol
  phase has passed its own gate. Do not create an unsynchronized client-only cruise.

### Preferred protocol model

- System-level realtime pose channel for canonical ship/system poses.
- Per-planet mutation shards remain authoritative for terrain, structures, water,
  resources, and collectibles.
- A player/party location record identifies system, body, and residency state.
- Server/DB schema stores the party layout version, route/activation epoch, active
  body, committed target, and per-player system pose; do not infer cruise location
  from the most recently updated planet shard.
- Same-system activation changes the active planet shard only after target promotion;
  it is not represented as an interstellar warp event.
- Cross-planet gameplay commands are rejected unless the actor's authoritative body
  matches the command body.
- Late join/reconnect restores cruise, approach, or surface state.

### First releasable co-op rule

The first release uses a **formation-locked convoy**. Players retain independent
ship poses and controls, but the server owns one party destination, route epoch, and
body-activation boundary. Route commit requires the party-ready rule; conflicting
targets are rejected. Before source demotion, a player turning back cancels the route
for everyone. After commit, cruise assist keeps ships inside a bounded convoy without
position jumps, and target activation waits for every quorum member to be payload-
ready and inside the corridor. A disconnected member follows deterministic hold/
autopilot during a grace window, then leaves the quorum; reconnect restores its
canonical convoy pose. Split destinations and split active planets remain deferred.

The server still replicates every continuous system pose and performs one explicit
authoritative body transfer. Do not overload current `party_warp` mid-cruise because
its semantics activate a new shard and broadcast a warp handoff immediately.

---

## 14. Implementation Phases And Gates

### P0 - Contracts, fixtures, and probe (no visible behavior)

- [x] Add `SystemCoordinate`, `PlanetAddress`, `PlanetIdentity`, and
      `StarSystemManifest` pure modules.
- [x] Add client/server canonical ID parsers and shared fixture JSON.
- [ ] Add `sameSystemCoordinate()` and `samePlanetAddress()` / `sameWorldId()`;
      audit equality, React keys, target locks, audio, arrival, cache, and warp call
      sites so siblings never collapse to the same `{x,y}` identity.
- [x] Prove slot-0 IDs, seeds, generation output, and persistence keys are unchanged.
- [ ] Prove two world IDs with the same 32-bit seed retain isolated generator,
      water, edit, and cache state.
- [x] Add deterministic body count/placement with min-separation validation.
- [x] Add screen-space-error LOD resolver and independent residency state machine.
- [x] Add `?systemprobe=1` runtime bridge and `tools/system-travel-probe.mjs`.
- [ ] Store the current single-planet perf/memory baseline with commit, browser,
      hardware, power mode, viewport, graphics profile, seed, route, warmup, sample
      count, and capture command so every delta gate is reproducible.

Gate:

- 10,000-system determinism/pairwise-separation/bounded-envelope test passes;
- zero slot-0 compatibility diffs;
- existing `npm run verify` and atlas stay unchanged;
- no runtime code path changes without the feature flag.

### P1 - Surface sky companions only

- [x] Split `GalaxyImpostors` into batched interstellar targets and local-system
      bodies.
- [x] Implement shared sibling proxy material/geometry and correct sun terminator.
- [ ] Implement the dedicated depth-tested surface celestial pass, explicit
      atmosphere extinction/composition order, and active-world horizon occlusion.
- [ ] Replace the deep-space depth-writing backdrop and prove the derived flight
      far plane without changing the surface voxel camera depth envelope.
- [x] Render stable siblings from surface and flight, with interaction enabled only
      for local-body targeting during deep-space flight.
- [ ] Add quality controls and day/night vantages.

Gate:

- all five quality proxy budgets pass;
- surface p95 regression <= 2 ms, target <= 1 ms;
- shader/program delta matches the profile allowlist and paired one-body control;
- no z-fighting, horizon leak, fake-distance fog, post-process duplication, or
  depth-precision regression on surface/flight cameras;
- correct palette, terminator, angular size, horizon occlusion, and no blank frames;
- human approval of sky scale on representative verdant, arid, fungal, oceanic,
  and volcanic worlds.

### P2 - Persistent system ownership

- [x] Add canonical system flight store and full `ShipPose` publication.
- [ ] Split `EfficientScene` into persistent system runtime and optional active
      planet runtime.
- [ ] Lift Physics and ShipController above the keyed planet boundary.
- [x] Add `EnvironmentFrame`, reference-frame root, planet/system pose conversions,
      and an activation lease/epoch, without enabling source demotion yet.
- [ ] Keep the legacy source runtime mounted on normal play paths until P3 can
      hydrate it without synchronous regeneration and P4 owns the visual demotion.
- [x] Preserve current single-planet launch, crash, landing, exit, and save behavior.

Gate:

- ship position/velocity/orientation survive active-world removal;
- harness-only active-runtime removal preserves canonical ship pose; normal play
  still keeps exactly one source world;
- no duplicate voxel/Physics owner;
- environment consumers remain valid with a harnessed `activePlanet=null`;
- current single-planet launch/landing tests and screenshots match baseline.

### P3 - Worker generation and packed weighted cache

- [ ] Move pure world scan, terrain materialization, arrival, water, and macro shell
      preparation to a module worker.
- [ ] Emit staged transferable buffers and cancellation progress.
- [ ] Add direct packed hydration for generator lookup, terrain buffers, water,
      arrival, deposits/materials, and staged collision/ecology inputs; forbid an
      implicit `getWorldGen()` rescan on activation.
- [x] Cache arrival data during generation instead of rescanning all voxels.
- [ ] Add byte-weighted warm/active/return caches.
- [ ] Key every mutable cache by canonical planet identity and payload/schema
      version, never seed alone.
- [ ] Pace GPU upload and precompile target programs.

Gate:

- occupancy, block, deposit, material, water, and arrival identities match exactly;
  deterministic packed hashes match, while declared float fields use named
  tolerances instead of blanket object-graph byte equality;
- feature-attributed activation/upload/collider spans stay <= 3 ms per frame, with
  zero feature Long Tasks >= 50 ms and profile p99 frame gates passing;
- cancellation < 100 ms, transferred buffers have one owner, and aborted jobs leave
  no retained references;
- every tier's packed payload and post-settle heap caps pass;
- worst-seed slow-tier preparation meets the stopping-distance readiness deadline;
- a harnessed packed source/target unmount-remount performs no generation scan or
  one-frame object-graph rebuild;
- repeated retargeting produces no heap drift.

### P4 - True same-system travel

- [x] Add physical local body targeting and equivalent canonical system-cruise state.
- [x] Keep interstellar targets on `beginTravel()`.
- [ ] Add source proxy demotion, target macro promotion, reference-frame rebase,
      exact terrain activation, and dither handoff.
- [ ] Generate and align the source macro before demotion; transfer image ownership
      to it before unmounting source terrain or colliders.
- [ ] Execute every body change through the atomic activation epoch/lease.
- [ ] Blend nearest-atmosphere sky/fog/grade/audio continuously.
- [ ] Replace the current origin-centered/camera-centered `SpaceSky` geometry jump
      with a unified camera-centered environment or a measured dual-dome handoff.
- [x] Add cruise assist/deceleration without teleportation.
- [ ] Land on target and return A -> B -> A with edits preserved.

Gate:

- no frame gap >= 50 ms;
- travel p95 <= baseline + 2 ms and FPS loss <= 5%;
- no white/black/loading mask;
- canonical/view-relative continuity and planet/system pose conversion tolerances
  pass every boarding, landing, demotion, rebase, and promotion;
- projected center/radius transition <= 2 framebuffer pixels, with no silhouette
  hole, seam, doubled atmosphere, or transition-peak budget failure;
- cold and warm A -> B -> A routes pass all quality profiles.

### P5 - Multiplayer system travel

- [ ] Add protocol-v2 system pose/location messages.
- [ ] Migrate server/DB persistence for layout version, route epoch, party location,
      committed target, active body, and per-player canonical system poses.
- [ ] Add authoritative party-locked system cruise state.
- [ ] Implement formation-locked convoy target, quorum, lag/turnback, disconnect,
      grace, and reconnect policy.
- [ ] Keep planet mutations in per-world shards.
- [ ] Transfer active planet authority only at target activation.
- [ ] Add late join/reconnect for cruise, approach, and surface.
- [ ] Preserve old-body command rejection and event replay.

Gate:

- 2/4/8-client route tests pass;
- authoritative location and body activation agree for every client;
- no cross-planet mutation acceptance;
- target snapshot is ready before gameplay activation;
- leader cancel, conflicting target, laggard turnback, disconnect grace, and quorum
  activation cases pass without a canonical position jump;
- source and destination edits survive round trip and reconnect.

### P6 - Content rollout and polish

- [ ] Enable curated deterministic multi-body fixtures behind a feature flag.
- [ ] Roll out by manifest cohort: internal, 10%, 50%, 100%.
- [ ] Keep genuine one-planet systems.
- [ ] Run ten-trip and overnight soak routes.
- [ ] Tune planet frequency, sky scale, travel duration, audio, rings, and palette
      relationships through human review.

Production gate:

- long-frame/error telemetry no worse than the single-planet cohort;
- memory and shader budgets pass;
- no save migration regressions;
- visual and gameplay approval across surface, launch, cruise, approach, and return.

---

## 15. Test And Evidence Matrix

### Pure tests

- `starSystem.test.ts`: determinism, 1-3 bodies, pair separation, bounded envelope,
  directional-star fixture, identity terrain orientation, canonical IDs, immutable
  identity seeds, pinned layout versions, and slot-0 compatibility.
- identity/cache tests: sibling equality, same-system equality, colliding 32-bit
  seeds with isolated world state, and client/server parser parity.
- `planetResidency.test.ts`: screen-space error tiers, DPR/mobile calibration, 20%
  hysteresis, independent visual/residency state, one-active invariant, weighted
  eviction, readiness deadline, and target cancellation.
- worker parity tests: generation/schema fixtures and transferred-buffer ownership.
- `systemFlight.test.ts`: reference-frame round trip, rebase invariance, target
  bearing, velocity continuity, no camera remount.
- proxy parity tests: palette, ocean/ice/relief classification, terminator direction,
  canonical terrain orientation, face seams/corners/coastlines, conservative macro
  envelope, depth bias, and silhouette error.
- persistence migration tests: legacy `lastWorld`, body-0 saves, secondary saves,
  pinned layout, cruise boot fallback, system-space ship pose, and transition-journal
  recovery at every commit boundary.

### Runtime probe

`tools/system-travel-probe.mjs` records every frame:

- p50/p95/p99 and maximum frame gap;
- Long Tasks;
- renderer draws, triangles, programs, geometries, and textures;
- JS heap where supported;
- worker peak heap, transferred-buffer ownership, and post-settle main heap;
- worker progress and cancellation;
- bytes uploaded per frame;
- current residency for every body;
- active full-world/Physics/collider owner counts;
- activation lease/epoch, owner-transfer spans, and stale-result rejection;
- ship system pose and render origin;
- target screen center and apparent radius.

### Required routes

- A -> B cold cache;
- A -> B warm cache;
- A -> B -> A with mined voxel, harvested tree, and structure persistence;
- commit B, cancel for C;
- oscillate around every LOD boundary;
- ten round trips for leak detection;
- max-cardinality three-body system;
- forced reload/tab termination during departure, cruise, target promotion, and
  immediately after landing;
- co-op late join/reconnect in cruise, approach, and surface.
- co-op leader cancel, conflicting target, laggard turnback, disconnect grace, and
  quorum activation at 2/4/8 clients.

### Atlas vantages

- `surfaceSiblingDay`
- `surfaceSiblingNight`
- `departure`
- `sourceDemotion`
- `cruise`
- `approachProxy`
- `macroExactHandoff` frame sequence
- `destinationAtmosphere`
- `destinationSurface`
- `returnSky`

Run all profiles on desktop/mobile and representative verdant, water-heavy,
fungal, volcanic, and sparse systems.

---

## 16. Risk Register

| Risk | Severity | Mitigation / proof |
| --- | --- | --- |
| Ship remount destroys continuity | critical | P2 persistent controller/store before travel implementation |
| Two full worlds fight global voxel state | critical | zero-or-one invariant sampled every probe frame |
| Main-thread generation hitch | critical | worker parity, transferable buffers, no sync fallback |
| Packed output is regenerated during hydration | critical | direct hydration contracts and feature-span probe |
| Stale async target takes ownership | critical | activation epoch/lease on worker, network, and runtime results |
| Proxy shape visibly morphs | high | actual cuboid terrain macro, projected-pixel handoff gate |
| Surface sky dome hides siblings | high | dedicated P1 depth/occultation spike and screenshots |
| GPU upload or shader compile hitch | high | paced upload, committed-target precompile, macro retained until ready |
| Server accepts wrong-body commands | high | explicit body authority and cross-planet rejection tests |
| Primary saves/seed change | high | slot-0 fixture lock over large coordinate sample |
| Seed-keyed cache aliases planets | high | canonical world cache keys and forced seed-collision test |
| Cruise has stale sky/audio owner | high | explicit EnvironmentFrame and active-null harness |
| Transparent cloud/atmosphere fill cost | medium | baked clouds below HIGH, shared programs, overdraw captures |
| System cache grows without bound | medium | byte-weighted residency and ten-trip leak gate |
| Story fidelity sequence is violated | medium | story one-body override and reality-stage proxy gate |

---

## 17. Explicit Non-Goals For The First Release

- Two simultaneous full voxel planets.
- General N-body physics or gravitational slingshots.
- Free split-party gameplay on different planets.
- Variable landable planet radii or non-cubic planet topology.
- Fully dynamic orbital simulation during travel.
- Background simulation of inactive planet ecology/water.
- Replacing interstellar warp.

These can be added after the reference-frame, residency, and multiplayer contracts
are proven.

---

## 18. Resume Here

Resume at the **P3/P4 renderer-readiness gate**, not P0:

1. keep the target proxy visible until the exact target reports one painted frame;
2. pace or pre-upload target instance buffers so every feature-attributed task is
   below 50 ms, then repeat cold/warm routes on all quality profiles;
3. replace count-only world-cache eviction with canonical, byte-weighted active,
   warm-target, and return reservations;
4. lift Physics and ShipController above the keyed active-planet runtime so cruise
   can hold zero full worlds rather than restoring pose across a remount;
5. run A -> B -> A with terrain, water, tree, and structure edits plus ten-trip heap
   soak evidence before enabling system travel for multiplayer.

Reproduce the implemented route with:

```bash
cd main
npm run dev -- --host 127.0.0.1 --port 5201
node tools/system-travel-probe.mjs \
  --url 'http://127.0.0.1:5201/?world=-19,-17&systemBodies=3&profile=HIGH&systemprobe=1'
```
