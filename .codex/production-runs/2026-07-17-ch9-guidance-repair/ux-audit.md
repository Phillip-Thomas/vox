# Chapter 9 Player Experience Audit

Reviewer: independent Chapter 9 UX audit lane

Run ID: `2026-07-17-ch9-guidance-repair`

## Initial verdict

`repair` — the objective card was globally mounted, but Tidegarden's opening
objectives read Origin-only anchors. Desktop and mobile/reduced-motion POTATO
probes failed 4/4 with `missing-marker`. Direct `ch9-hearth` was unrecoverable,
the optional observation could mask mandatory actions, night and foundation
predicates disagreed with their physical interactions, the Fabricator stayed
open after the Core craft, boarding competed with settlement, and scanning
advanced without a viewed target.

## Repair verification

- Tidegarden now publishes the exact world positions used by its interactions.
- Mandatory settlement verbs are evaluated before the optional observation.
- Night and foundation guidance use the same predicates as physical actions.
- Successful Habitat Core crafting closes the Fabricator as the objective
  changes.
- Ship boarding is unavailable until the Chapter 9 handoff.
- Scanner completion requires proximity plus sustained camera visibility.
- `ch9-hearth` can recover through the physical scanner/settlement chain when
  its habitat snapshot is absent.
- The automatic movie path reached every required action and story completion
  without rescue input.

The post-repair objective-HUD matrix passed all four desktop and
mobile/reduced-motion POTATO cases. Each case showed one viewport-safe marker,
ready objective health, and no objective/marker/vitals/caption/touch overlap.

## Remaining evidence boundaries

- This was direct-entry Chapter 9 evidence, not Chapter 8 to Chapter 9
  continuity certification.
- The direct hearth diagnostic is now recoverable but does not yet construct a
  late-half certified habitat for fast isolated hearth review.
- Headless SwiftShader captures do not certify pointer-lock feel, exposure,
  motion taste, real-GPU performance, or final beauty.

Verdict: `pass_for_functional_repair`; council taste and continuity gates remain
open.
