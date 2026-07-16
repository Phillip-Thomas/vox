# Repo Survey

## Stack And Evidence

- React 19, TypeScript, React Three Fiber/Three.js, inline HUD styles, Vitest, Vite, chapter-acceptance browser harness.
- Baseline mobile evidence: `main/captures/chapter-acceptance/ch7-repair-smoke-final-2026-07-16/`.
- Clean mechanical evidence: `main/captures/chapter-acceptance/ch7-repair-smoke-final2-2026-07-16/`.

## Existing System And Assets

- Scene: `HifiWreck`, `SpaceshipPlaceholder`, code-native Kestrel geometry in `shipDesign.ts`, camera-child `ShipCockpit`.
- UI: `StoryCaptions`, `StoryGuidanceHud`, `InteractionPrompt`, `TouchControls`, shared theme/HUD chrome.
- Identity: faceted low-poly geometry, glass telemetry, cyan navigation, amber propulsion, mono operational copy.
- Asset decision: reuse and recompose code-native geometry/materials; no bitmap or imported model is needed for this defect pass.

## State Ownership

- `physicalBoarding.ts` owns hatch/seal/handback phases and exact evidence.
- `HifiWreck.tsx` owns the physical hatch, boarding camera, and reconstruction additions.
- `ShipCockpit.tsx`/`shipDesign.ts` own camera-space cockpit fit and focal geometry.
- UI components own their responsive safe areas; controls/bindings remain unchanged.

## Constraints And Opportunities

- Preserve signed/council continuity and one-draw shell/frame/light architecture.
- Repair seams are local: camera standoff/tunnel, portrait scale floor and focal values, touch-safe caption placement, input-aware work-order copy, and occluding wreck additions.
- Risk: a software/POTATO portrait screenshot is useful for occlusion but cannot approve lighting taste or performance.

## Gate

- Components, identity, assets, state, and constraints understood: `pass`
