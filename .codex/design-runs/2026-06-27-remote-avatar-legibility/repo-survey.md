# Repo Survey

## Stack

- React 19, Vite, TypeScript.
- Three.js through `@react-three/fiber` and `@react-three/drei`.
- Verification scripts in `main/package.json`: `typecheck`, `test`, `build`, `verify`.

## Current Components

- `main/src/components/PlayerAvatar.tsx`: render-only 3D avatar, transform/presentation helpers, label billboard.
- `main/src/components/PlayerAvatarPoseHarness.tsx`: filters remote poses, maps roster display names, renders `PlayerAvatar`.
- `main/src/components/EfficientScene.tsx`: mounts the harness inside the physics scene for the active world.
- `main/src/game/playerPose.ts`: pose schema includes action, submergence, mining progress, jetpack, torch, ship phase.

## Current Strengths

- Remote avatar does not mount `EfficientPlayer`.
- Local singleton safety is already covered in `PlayerAvatar.test.ts`.
- Action states already affect body color and show mining/build/jetpack accessories.
- Nameplates are roster-backed and stable.

## Current Weaknesses

- State recognition leans too heavily on body color.
- Idle/walk silhouette is too generic at distance.
- The label plate is functional but not strongly tied into the Paravoxia cockpit visual language.
- No helper-level tests assert non-color legibility cues.

## Brand And Assets

- Brand identity: dark void, cyan accent, glass/cockpit UI, compact telemetry, elevated sci-fi.
- Existing non-audio visual assets are mostly code-native Three.js geometry; this pass should use code-native geometry.
- Audio assets are irrelevant to avatar legibility.

## Constraints

- Do not add large model assets or new networking state.
- Preserve render-only behavior.
- Keep geometry cheap enough for several remote players.
- Avoid screen-space panels that fight the HUD.
