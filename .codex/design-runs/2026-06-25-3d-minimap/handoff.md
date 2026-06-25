# Implementation Handoff

## Build Target

Create `OrbitalMinimap` as a React HUD component with a small R3F canvas. Wire it into `App.tsx` while `appPhase === 'playing'`.

## Data Contract

- Local position/look/up: `getPlayerWorldPosition()`, `getPlayerLook()`, `getPlayerUp()`.
- Flight/control label: `useSpaceFlight()`.
- Remote players: `getPlayerPoses()` / `subscribePlayerPoses()`.
- Campfires: `getCampfires()` / `subscribeCampfires()`.
- Structures: `getPieces()` / `subscribeStructures()`.
- Ship marker: extend `shipProximity` with `setShipPosition()`, `getShipPosition()`, and `subscribeShipProximity()`.

## Visual Contract

- Right-side HUD panel under the pause/build/craft buttons, compact glass surface.
- Mini cube/wire shard inside a real 3D canvas.
- Local marker: green/cyan arrow.
- Remote markers: blue pips.
- Ship marker: amber diamond.
- Campfires: warm embers.
- Structures: pale construction points, capped.
- Text: `ORBITAL SCAN`, world coordinate, flight phase, and compact counts.

## Verification

- Unit-test marker projection/capping helpers.
- Run typecheck, targeted minimap tests, and build.
- Start one preview URL and take desktop/mobile screenshots.
- Record scorecard and lessons.
