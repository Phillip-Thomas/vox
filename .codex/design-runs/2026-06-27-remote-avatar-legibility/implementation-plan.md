# Implementation Plan

## Iteration 1

1. Extend `PlayerAvatarPresentation` with beacon/action fields and footing marker fields.
2. Add small code-native geometry:
   - footing ring and facing wedge below the avatar,
   - beacon plate above the label,
   - tiny beacon shape per action.
3. Keep existing nameplate and action accessories.
4. Add helper tests for non-color state cues and label/beacon bounds.
5. Run targeted tests, then full `npm run verify` if targeted checks pass.
6. Start canonical Vite preview and capture desktop/mobile screenshots via Playwright MCP.

## Risks

- Extra geometry could clutter the scene with 8 players.
- Text in 3D can become too small on mobile.
- Screenshot route may need a seeded/debug harness to show remote avatars without live co-op.

## Mitigation

- Keep geometry small and mostly transparent.
- Use test helper outputs to bound label/beacon sizes.
- If no live co-op remote pose exists in preview, add or use existing debug pose harness data only if it remains clearly scoped to debug mode.
