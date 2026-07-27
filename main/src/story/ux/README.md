# Paravoxia story UX contract

This directory is the executable player-guidance boundary for authored story
objectives. It is runtime authority, not a general visual-design library and not
a second progression system.

## Runtime entry points

- `objectiveDirector.ts` owns the presentation-only objective store, exact
  marker-label contract, actionable work order, and `ready | missing-marker`
  health signal.
- `StoryGuidanceHud.tsx` keeps the current free-era action visible after the
  regulation feed is gone.
- `feedbackCues.ts` emits one semantic acknowledgement when an objective ID
  changes. Score and cinema may subscribe, but a cue may never write a
  milestone, dispatch a gameplay command, or advance the story.
- `StoryDirectorDriver.tsx` remains the bridge to the existing directional
  marker renderer. Do not introduce a competing marker language here.
- `inputGlyphs.ts` is the single presentation pass that swaps authored keyboard
  tokens (`[F]`, `[SPACE]`, …) for the labels a touch player sees on the mounted
  controls, per era context (`embodied` / `feed` / `prologue`). Authored copy
  keeps the keyboard names; every surface that shows an action prompt on touch
  (the guidance HUD, regulation feed, captions, prologue screens, map overlay,
  deflection minigame) routes through it at render time. Add a mobile variant by
  extending a token table here — never by forking the substitution or rewriting
  the canonical string.

## Hard guardrails

1. Objective IDs come from durable progression state and change only when the
   required player action changes.
2. Every guided non-cinematic objective names an exact marker label and ends
   with a concrete input or action. A mandatory objective may not remain in
   `missing-marker` health.
3. Work-order copy, marker copy, camera emphasis, and score feedback describe
   the same player verb without taking control from the player.
4. Objective entry feedback fires once per ID. It is semantic presentation,
   never proof that the objective was completed.
5. Beat transitions clear stale objectives. Deep links, replay, pause/focus,
   reduced motion, mobile, and lower quality tiers must reconstruct the same
   next action.
6. The HUD remains readable and screen-reader announced without competing with
   captions, interaction prompts, the focal subject, or safe-area constraints.

## Creative-council ownership

- Chapter Director owns the player verb, objective lifecycle, marker/work-order
  language, and whether guidance preserves agency.
- Score Director owns the non-authoritative audible acknowledgement and mix
  restraint.
- Cinematography Director owns focal competition, camera hand-back, HUD/marker
  legibility, and visual parity across variants.
- The integration engineer owns wiring and reset behavior. No director approves
  its own implementation.
- The independent Player Experience Auditor reviews objective actionability,
  exact marker parity, lifecycle/reset behavior, feedback ownership,
  accessibility, and evidence before cohesion judgement.

## Required production evidence

A creative run that touches guided story play records:

- `shipped-ux-baseline.json`: source revision and hashes plus the current
  objective, marker, work-order, health, and feedback contract;
- `objective-lifecycle-evidence.json`: objective enter/change/clear traces,
  exact marker parity, health transitions, one-shot feedback, variant coverage,
  and evidence refs;
- `ux-audit.md`: a fresh independent audit with findings, defects, ownership,
  and verdict.
- `chapter-journey-evidence.json`: an exact-revision, contract-hashed browser
  report for focus/typing, prompt arbitration and effects, entity absence,
  reload/Continue seams, and any other focused journey contracts owned by the
  target chapter.

The machine authority for those journeys is
`main/chapter-journey-contract.json`. It projects every registered mandatory
objective exactly and carries focused regression contracts for bugs that have
escaped unit tests. Runtime evidence is exposed only with `?journeyprobe=1` by
`JourneyRuntimeProbeBridge`; ordinary play does not mount a visible harness or
read probe state.

Direct-entry runs are diagnostic. They may prove a local interaction or input
contract, but never predecessor continuity. A production creative-council pass
still requires continuous, headed evidence; headless scripted input cannot
stand in for real pointer-lock or human taste.

Two escaped-defect diagnostics also use an explicit preparation receipt. The
bridge accepts preparation only when `journeyprobe=1`, `debug=1`,
`journeylane=direct-entry`, the exact `journeyscenario` is present, and the live
beat matches the URL. The Ch7 probe applies gaze assistance without moving the
player; the Voyage input probe reconstructs the prior cards and naming lines
but still uses the visible native field, trusted key events, real submit path,
and persisted worker name. Those reconstructed facts are embedded in the
report and are never accepted as timing or continuity evidence.

The portable workflow and project-local bindings live under
`docs/architecture/workflow-orchestration/` and
`.terra/context-source-bindings/`.

## Checks

```bash
npm --prefix main run story:ux:check
npm --prefix main run chapter:journey:check
npm --prefix main run chapter:journey:smoke
npm --prefix main run chapter:journey:probe:smoke
npm --prefix main run creative:workflow:check
npm --prefix main run creative:workflow:smoke
```
