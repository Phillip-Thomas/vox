# Critic Report

## Defects Found And Resolved

1. **Critical — replay cleanup could clear the wrong live world.** The first target-world clear also reset global live singleton stores. Replaying while a non-Story world was mounted could therefore let cleanup autosave that world empty. The final implementation removes only the Story site's persisted blob; the keyed Story remount performs the normal live reset and restore.
2. **High — pause was visual, not temporal.** The Story director, physics, player vitals/actions, ship input, and touch surface could continue behind the pause menu. A shared pause-aware Story clock and explicit scene/input gates now freeze them.
3. **High — active Story exposed unrelated world travel.** The Star Map is now removed from the Story pause surface and the travel command is defensively rejected while Story is active.
4. **High — completed saves had ambiguous continuation.** Completed saves now say `Return to Site`, expose a separate confirmed replay action, and show a completion recovery dialog at the real transition.
5. **Medium — initial modal focus scrolled the pause heading out of view.** Pause is now a fixed header/body/footer shell; only secondary content scrolls.
6. **Medium — the narrow landing wordmark clipped.** Responsive sizing and spacing now keep `PARAVOXIA`, `Make no mistakes`, and touch controls readable at 390x844.
7. **Medium — controls were incomplete and split across memory/guesswork.** A single mode-aware read-only reference now drives landing and pause without remapping bindings.
8. **Medium — browser zoom and keyboard focus were suppressed.** The viewport no longer disables zoom; visible focus, focus trapping/restoration, Escape handling, and reduced-motion behavior are present.
9. **High — same-page replay retained director one-shots.** The Story `runId` now reconstructs the complete director runtime before the replay beat enters; a repeated-caption regression proves the second run is authored, not silent.
10. **High — Return to Site raced destination readiness.** A pending transition now holds the landing shell until W-7744 is mounted and painted, then persists the Story coordinate and enters play after old-world cleanup.
11. **High — the Fabricator did not own keyboard focus.** It is now an inert-background modal with initial focus, Tab containment, Escape, blur recovery, and restoration.
12. **Medium — several control labels overstated live policy.** Side-lens movement, touch jump/look, flight chart access, and exact touch B/C/M actions now reflect the runtime gates.

## Residual Risks

- Touch gameplay remains a preview until a real-device smoke decides whether it ships or is labeled experimental.
- Browser automation cannot reliably prove pointer-lock restoration in headless Chromium; the keyboard focus contract is covered, but headed golden-path testing remains required for the release candidate.
- The complete current Story still needs the separate full screening/hero-route batch. This run deliberately added no narrative content.
- Visual shell approval does not supersede the broader game's `3.78 / 5` baseline or the final `4.75 / 5` target.

## Scope Compliance

- New story content: none
- Audio engine/assets: untouched
- Desktop bindings: unchanged
- New world/biome breadth: none
- Batch result: no known Batch 1 blocker remains
