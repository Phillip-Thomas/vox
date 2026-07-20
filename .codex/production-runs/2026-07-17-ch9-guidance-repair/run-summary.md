# Chapter 9 Repair Summary

Status: `in_review`, deployed under explicit owner override — functional and
mechanical repair passed; protected score, continuity, and real-GPU taste gates
remain open.

Updated: `2026-07-17T17:51:46Z`

## What changed

- Replaced Origin-only Chapter 9 marker lookup with Tidegarden-owned stable
  targets for the relationship, recommended site, chosen site, Kestrel, and
  Habitat Core.
- Made required settlement interactions outrank the optional observation and
  blocked ship boarding until the settlement handoff.
- Aligned foundation and night predicates with the physical interaction rules.
- Closed the Fabricator when Habitat Core crafting advances the objective.
- Reworked automatic play to perform the authored settlement order and use
  reachable surface approach points.
- Kept the scanner resident through completion, gated scanning on actual gaze
  and proximity, removed both dynamic hero lights, prewarmed the site/Core
  visuals, corrected the site-ring facing and Core depth composition, and
  eased a correctly centered shelter-interior tint.
- Added Chapter 9 to the default objective-HUD matrix and added a journey
  escaped-defect contract for required-over-optional arbitration.

## Verification

- `npm --prefix main run verify`: passed; 247 files / 1,717 tests, TypeScript,
  story authority, workflow and journey gates, and production build.
- Focused settlement, target, input-policy, crafting, story-director,
  automatic-play, and visual-policy tests: passed.
- Objective-HUD browser probe: 4/4 passed across desktop and mobile/reduced
  motion at POTATO quality; one visible marker, viewport-safe labels, and no
  HUD/prompt/touch overlap.
- Final-source automatic movie run reached `done` in 226.31 seconds with all
  site, Core, certification, safe-rest, and two-world-handoff receipts; zero rescue
  nudges, water-contact violations, WebGL context losses, page errors, or
  crashes.

## Remaining gates

1. Score authority and destination-bed handoff are protected and require a
   separate Score Director lane.
2. Chapter 8 to Chapter 9 continuous traversal and reload continuation are not
   certified by the direct-entry diagnostic.
3. Headed real-GPU cinematography/taste review is required before visual or
   performance approval; SwiftShader screenshots cannot certify either.
4. Direct `ch9-hearth` now recovers functionally, but a late-half physical
   diagnostic seed remains useful for faster isolated review.
5. Creative/human taste approval remains open. The immutable locks still record
   `publishAllowed: false`; live publication occurred only under the separately
   recorded owner override in `release-override.json`.
6. The automatic trace caught a one-render-frame old marker label immediately
   after several objective changes. Settled-state parity passes, but literal
   transition-frame DOM parity remains a small global FreeMarker follow-up.

## Release

- Firebase Hosting deployment to `paravox-game`: passed.
- Firebase and custom domains both serve `assets/index-CVTXZYXZ.js` with HTTP
  200.
- The production state server remained healthy at `/readyz`, and `/play`
  returned WebSocket protocol version 1 after release.
- Cloud Run was not redeployed because the server worktree is unchanged and
  the verified live service is compatible with this client repair.
