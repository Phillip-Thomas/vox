# navigation-closure progress

Role: integration-navigation-closure (single source engineer for this closure).
Scope: ONE open producer review finding (CG-IMPL-011 restore-ownership lifetime)
under producer-navigation-budget-decision.json. Same fifth material repair, same
scene-v2 contract, no new loop.

## Phase 1 — inputs read, preclosure source rehashed (13:53 UTC)

Read only: producer-navigation-preclosure-review.json,
integration-navigation-repair-report.json, navigation-repair-direction.json,
production-lock.json, producer-navigation-budget-decision.json and the final two
SAVE-ENTRY inbox messages (13:44:44, 13:47:57) plus the 13:41:38 item they refer
to. No re-read of the story/design corpus.

Rehash (tmp/navigation-closure/rehash-preclosure.py, log
logs/navigation-closure/rehash-preclosure.log):
- iterations/navigation-preclosure/source: 98 files, 98 expected, 0 mismatches,
  0 extras.
- live worktree vs archive: 0 drift, 0 missing. Baseline 350 files / 3137 tests.

## Phase 2 — failure reproduced BEFORE any source edit (13:54 UTC)

Two regression cases added to the allowed test file
main/src/story/commonGroundDirector.test.ts, driven through the real persistence
route (restoreCommonGroundForWorld / saveWorld / actual stored localStorage
bytes), no hand-staging:

1. `an EARLIER empty restore never licenses erasing a payload read later`
   absent restore -> placeholder -> lawful empty save -> a PRESENT foreign
   record is on disk and is READ -> rejected -> save.
   Pre-fix: FAIL, `isPristineCommonGround` false on the post-rejection empty
   snapshot (log before-fix-foreign-after-empty.log, exit 1).
2. `keeps a MALFORMED payload read after an empty one, and still plays on`
   same lifetime, malformed record.
   Pre-fix: FAIL at the STORED BYTES — the damaged `{survey:'not-a-record',
   common:7}` field was replaced on disk by this actor's idle serialization
   (log before-fix-malformed-after-empty.log, exit 1).

Cause: `stageCommonGroundWorldPayload` sets `pendingByWorld` but leaves the
world's older `restoreSettledWorlds` membership, which was earned by an ABSENT
read. Once the rejected payload is consumed by `commonGroundSnapshot`, nothing
is pending, the stale settled bit answers, and `isPristineCommonGround` returns
false so `saveWorld` serializes idle over the payload just read.

## Phase 3 — narrow fix (13:55 UTC)

main/src/story/commonGroundState.ts, `stageCommonGroundWorldPayload`: a PRESENT
payload now also deletes the world from `restoreSettledWorlds`. `raw == null`
behaviour unchanged. Only stale ownership knowledge is invalidated.
681846b7... -> 900da8a2...

## Phase 4 — verification (13:55-13:57 UTC), all after the last source edit

- focused regression, 5 files / 217 tests, exit 0 (after-fix-focused.log)
- counterfactual on pre-closure state source with the final test bytes:
  2 failed, exit 1, file restored exactly (counterfactual-summary.json)
- npm run verify: 350 files / 3139 tests, exit 0 (verify-navigation-closure.log)
- npm run story:ux:check: 9 files / 94 tests, exit 0 (story-ux-check.log)

Exactly 2 source files changed (both lock-allowed), other 96 byte-identical.
Inbox re-read before final checks and before the report; unchanged since 13:47:57.

## Phase 5 — reported (13:58 UTC)

navigation-closure-report.json / .md written. No root-owned artifact and no
original engineer report touched. No running child test process.
