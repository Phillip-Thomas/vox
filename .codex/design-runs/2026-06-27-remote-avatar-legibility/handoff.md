# Handoff

## Accepted Design

Implement a compact EVA Beacon Stack for remote avatars:

- Body silhouette remains the primary remote player object.
- A low footing ring and facing wedge make position/facing readable.
- A small action beacon above the avatar communicates state independently from color.
- Existing mining/build/jetpack accessories remain, with minor polish allowed.
- Nameplate remains roster-backed and bounded.

## Component Mapping

- `PlayerAvatar.tsx`: extend presentation helper and JSX geometry.
- `PlayerAvatar.test.ts`: assert non-color cues and bounded label/beacon behavior.
- `MULTIPLAYER_IMPLEMENTATION_CHECKLIST.md`: update release gate evidence only after verification passes.

## Token Mapping

- Cyan/accent: default/idle/walk telemetry.
- Blue: swim.
- Violet: jetpack.
- Amber: mining.
- Green: build.
- Dark plate: nameplate/beacon backing.

## State Matrix

- Idle/walk: cyan ring, forward wedge, `CREW` or movement beacon.
- Swim: horizontal body plus wave/blue beacon.
- Jetpack: flame plus violet beacon.
- Mine: tool plus amber beacon and progress opacity.
- Build: hologram plate plus green beacon.
- Long label: nameplate width bounded.

## Responsive Notes

Avatar geometry is in-world and should work across desktop/mobile. Screenshot checks should include desktop and mobile gameplay route.

## Acceptance Criteria

- Remote avatar presentation exposes non-color cues for all relevant states.
- Tests cover render-only safety and presentation-state cues.
- `main` targeted tests pass at minimum; full `main` verify should pass before deployment.
- Screenshots show no obvious HUD or avatar label collisions.
