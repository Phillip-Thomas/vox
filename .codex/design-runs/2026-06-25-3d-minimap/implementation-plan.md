# Implementation Plan

1. Extend `shipProximity` to publish parked ship position and clear it on unmount.
2. Add pure minimap helper functions for projection, marker selection, capping, and counts.
3. Add the `OrbitalMinimap` HUD component and mini R3F scene.
4. Wire the component into `App.tsx`.
5. Add focused Vitest coverage for helper behavior.
6. Run verification and screenshot review.
