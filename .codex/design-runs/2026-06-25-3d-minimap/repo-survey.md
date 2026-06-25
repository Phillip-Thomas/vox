# Repo Survey

## HUD Integration

- `main/src/App.tsx` owns the DOM HUD layer shown when `appPhase === 'playing'`.
- Existing HUD components are inline-styled React components under `main/src/components/hud/`.
- `CockpitReadout` and `MultiplayerStatusBadge` establish the sci-fi glass/mono telemetry language.
- Touch controls occupy bottom corners; inventory occupies top-left when items exist.

## Game State Sources

- `main/src/state/playerFrame.ts` exposes live local position, up, and look vectors.
- `main/src/game/systems/playerPoseSystem.ts` exposes `getPlayerPoses()` and `subscribePlayerPoses()` for local/remote player avatars.
- `main/src/game/systems/structureSystem.ts` exposes `getPieces()` and `subscribeStructures()` for placed building pieces.
- `main/src/game/systems/campfires.ts` exposes `getCampfires()` and `subscribeCampfires()` for placed fire markers.
- `main/src/state/spaceFlight.ts` exposes `useSpaceFlight()` for flight/control mode.
- `main/src/state/shipProximity.ts` currently publishes only boardable state from `SpaceshipPlaceholder`; it can be extended narrowly to publish parked ship position.

## Constraints

- Do not clone terrain or voxel data into the HUD.
- Use a mini `@react-three/fiber` canvas for the unique 3D read, but render a small abstract scene only.
- Cap pips to avoid per-frame HUD cost growing with large bases.
