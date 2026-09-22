# integration-arrival-common — progress

Single integration engineer, material repair iteration 7. Contract scene-v3
`5ef85a32…`, direction `arrival-common-repair-direction.json`, defects CG-IMPL-010
and CG-IMPL-014. Times UTC.

1. **17:0x — read the boundary before touching anything.** `CLAUDE.md`, the final
   direction, `contract-gate-pass.json`, `producer-arrival-common-findings-review.json`,
   `producer-arrival-common-budget-decision.json`, `producer-v3-decision.json`,
   `repair-contract-disposition.json`, `producer-common-terminal-audit-review.json`,
   both chapter interpretations, `common-terminal-source-audit.json`, and the
   relevant source (`commonGroundDirector.ts` rail block,
   `autopilot/primitives.ts` handoff block, `commonGroundState.ts` routes,
   `beats/objectivePrimitives.ts`, `ux/objectiveDirector.ts`). No planner or
   treatment was performed.
2. **Rehashed the frozen 99-file manifest: zero drift.** The two game-source
   pre-hashes match the causal audit's recorded values exactly. Byte backups of all
   nine existing allowed paths written to
   `.private/arrival-common-repair-backups/`; `logs/arrival-common-repair/before-hashes.txt`.
3. **Baselines captured before mutation.** `npm run test` → 351 files / 3158 tests,
   exit 0 (matches the direction's baseline). `npm run chapter:registry:check` →
   exit 1 with two `common-ground@scene-v2` failures — recorded so the metadata
   blocker could not later be mistaken for mine.
4. **Reproduced the CG-IMPL-010 seam before patching.** Task-local probe
   (`verifier/probes/arrival-common-repair/margin-scan.mjs`) over the frozen
   handoff-standby bundle: the shipped planner and shipped Origin terrain refuse the
   0.6 aim at COMMON 3, 6 and 9 and certify every SURVEY corner. Then measured the
   thing the audit did not: the residue is a function of the **body's** tilted up, so
   the handoff flips to refused as the body approaches. That is what set the usable
   window — floor 0.2 (dead zone), ceiling ~0.244 at vertex 6. ~0.044 of slack.
5. **Patched, minimally.** `CG_RAIL_CORNER_OVERSHOOT` 0.6 → 0.24; split the walker's
   stop radius out of the cursor's vertex tolerance as `CG_RAIL_ROUTE_STOP = 0.15`
   (tighter than the old shared 0.35); `CG_RAIL_ROUTE_ARRIVE` left at 0.35.
   `commonGroundGuidanceFacts` asks the world before the control mode; two new
   arrival phases added to `ch13ReturnObjective` with the exact signed scene-v3 copy.
   `autopilot/primitives.ts` deliberately untouched — reasoning in the report.
6. **Reverted my own first idea.** I had exported rail constants and goal accessors
   for the tests, then removed them: driving the goals from the REAL published
   `commonGroundRailPlan()` instead means the new tests compile and fail *by value*
   on the pre-repair source, which is what a counterfactual is for.
7. **14 tests added, 0 removed.** One pre-existing case tightened in place (literal
   `0.35` assertions replaced by strictly stronger dead-zone-relative invariants).
   Full suite 351 files / 3172 tests, exit 0.
8. **Counterfactual on the exact pre-repair bytes** (private restore only; no git
   checkout/reset/stash anywhere in this task): 10 failures, all by value, naming
   vertices 3, 6 and 9 and the measured `'board'` regression. Fixed bytes restored
   and **proven** identical — the pre- and post-restore digest lists hash to the same
   value, `232ca05c…`.
9. **Checks on final source.** `story:ux:check` exit 0. `verify` exit 1, aborting at
   step 2 of 14 on `scene:av:check`; each of the 14 gates then run individually so
   nothing is credited to a command that did not execute it. 11 pass, 3 fail.
10. **Stopped at the boundary on part C and reported it.** The scene-v3 binding lives
    in three files the direction does not grant, and the generator throws before
    writing without one of them. I updated only `main/story-authority.json` (granted,
    and named in the direction), and proved with a task-private generator copy that
    the missing regeneration changes **nothing** but two provenance fields. The
    three-file patch is written out in the report for the producer to grant.

**Not done, deliberately:** no eighth loop, no ad-hoc repair outside the two
defects, no shared-primitive change, no browser, GPU, preview or publication, no
input patch, no acceptance or verification claim. Manual COMMON traversal and
earned Continue remain unmeasured and belong to other roles.
