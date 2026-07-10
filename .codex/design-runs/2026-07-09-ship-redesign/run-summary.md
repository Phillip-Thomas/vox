# Ship redesign — hex-faceted mini-fighter + cockpit

Date: 2026-07-09
Scope: `main/src/utils/shipDesign.ts` (new), `main/src/utils/shipDesign.test.ts` (new),
`main/src/components/SpaceshipPlaceholder.tsx` (rewrite), `main/src/components/ShipCockpit.tsx`
(new, extracted from ShipController's inline Cockpit), `main/src/components/ShipController.tsx`
(cockpit swap + live thrust ref).

## Direction

An NMS-fighter-shaped brief with this game's own identity instead of a copy:

- **Hex-faceted everything.** Hexagonal fuselage cross-sections + flat shading echo the
  crystalline low-poly world (voxels, icosahedron flora/fauna). Nose spike → fore hull →
  aft hull → engine flare, all 6-sided; a faceted icosahedron crystal canopy.
- **Perched, not parked.** The flight controller rests the ship 2.5 wu above the touchdown
  voxel (SHIP_GROUND_CLEARANCE); the placeholder simply floated there. The new ship stands
  on four tall KINKED INSECT LEGS built to exactly that stance height — the fauna language
  (dragonfly) carried into the vehicle, and the clearance now reads as intentional.
- **Planet-attuned accent.** `shipAccentColor(terrainSeed)` keeps the placeholder's seeded
  cyan-blue hue family on wingtip fins, nacelle lips, engine glow, and cockpit instruments —
  the ship subtly repaints per world like everything else.
- **Mini scale.** ~6.6 wu long / 6.0 span (≈3.3 m) vs the 3.6 wu player — a snug one-seater.
- Swept delta wings with upturned accent tip-fins, twin under-wing hex nacelles with
  breathing emissive exhaust discs, tail fin with a blinking warm beacon.

**Cockpit** (first person while flying): you sit inside the same faceted canopy — six beams
form a hexagonal rim around the view (center kept clear; every frame vertex verified outside
a central disc by unit test), shallow-V dashboard, side sills closing peripheral gaps,
stick + throttle silhouettes, overhead status pips, and a central **holo nav ring** (hex
torus) that idles slowly and spins up + brightens with live thrust (ShipController writes a
`thrustRef` each frame). A dim interior point light keeps the frame readable in deep space.

## Architecture

Geometry is authored in `shipDesign.ts` as merged, non-indexed, vertex-colored
BufferGeometry (fauna-style) — the hull and the cockpit frame are ONE flat-shaded draw each;
emissives (glow discs, beacon, holo ring, gauges) are separate small meshes. All boarding /
proximity / hide-while-flying logic in SpaceshipPlaceholder is unchanged, as are all flight
mechanics in ShipController. Groups are named `ship-exterior` / `ship-cockpit` for probes.

## Verification

578 tests green (4 new: accent determinism/brightening, hull footprint + leg reach ≈
rest height, canopy placement, cockpit frame beyond near plane + view-center clearance).
Headless captures: parked exterior on the verdant fixture world (two angles), cockpit in
deep space (hex rim + instruments + planet centered) and under thrust during descent.

## Open threads

- Landing/launch could kick dust surface-effect motes under the nacelles.
- The parked exterior could get a soft canopy interior glow at night.
- Multiplayer party members currently have no visible ship; the hull builder is ready to
  instance if/when remote ships are rendered.
