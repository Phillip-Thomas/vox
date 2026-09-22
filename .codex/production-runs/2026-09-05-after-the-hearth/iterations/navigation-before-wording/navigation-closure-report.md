# Navigation closure — CG-IMPL-011 restore-ownership lifetime

Author: integration engineer (Claude Opus 5 agent), under the standing owner
delegation recorded in `producer-navigation-budget-decision.json`.
Started 2026-09-06T13:52:24Z, written 2026-09-06T13:57Z.

This closes the ONE open finding from `producer-navigation-preclosure-review.json`
(`acceptedForIndependentVerification: false`). It is the same fifth material
repair, the same scene-v2 contract (`4dbf722b…f88e`, unchanged by me), not a new
repair loop, not a browser-triggered patch and not a budget escape.

**Not** an acceptance, **not** chapter verification complete, **no** chapter-complete
or hardware-success claim, **no** publication authorization.

## Inputs

| input | sha256 |
| --- | --- |
| `integration-navigation-repair-report.json` (input report) | `6118437e0c04f0a2b6c6e7ab5335fada264b7eb75e65c6730d32f533940ba8c0` |
| `producer-navigation-preclosure-review.json` | `df1b6736f53714c9d1b367610a2683777aae71bc297ec284d8bdc2b82a37638e` |
| scene contract (`scene-contract.json`) | `4dbf722b308b92b170313285854e3c9c2abac853b3407bf3e0f4efccfddff88e` |

Inbox entries read: 13:41:38, 13:44:44, 13:47:57 (the last two SAVE-ENTRY
messages plus the item they refer back to). `integration-inbox.md` was re-read
before the final checks and before this report; nothing has been appended since
13:47:57.

## Starting source

`iterations/navigation-preclosure/source` rehashed before any edit:
98 files present, 98 expected, **0** mismatches against the producer review, **0**
extras, and **0** drift between the archive and the live worktree.
(`tmp/navigation-closure/rehash-preclosure.py`, log `rehash-preclosure.log`.)

## Cause

`restoreCommonGroundForWorld` on a world with no CommonGround payload calls
`settleCommonGroundIfNothingStaged`, which adds the world to
`restoreSettledWorlds`; an empty live snapshot may then lawfully save. Later, in
the **same session**, a PRESENT payload is read and staged for that world.
`stageCommonGroundWorldPayload` set `pendingByWorld` but did **not** invalidate
the older settled membership. When `commonGroundSnapshot` rejects that payload
(foreign actor, wrong world, malformed), it consumes the pending bytes and
leaves an empty local snapshot. `isPristineCommonGround` then sees no pending,
sees the **stale** settled bit, answers `false`, and `saveWorld` serializes idle
over the raw payload that was just read off disk.

The pre-existing cold foreign-payload test never had an earlier empty restore in
the same session, so it could not observe this.

## Behavioural failure recorded BEFORE any source edit

Both cases drive the real persistence route (`restoreCommonGroundForWorld`,
`saveWorld`, actual stored bytes) — nothing is hand-staged.

- `before-fix-foreign-after-empty.log` — exit 1: after rejection,
  `isPristineCommonGround` is `false` on the empty snapshot.
- `before-fix-malformed-after-empty.log` — exit 1 **at the stored bytes**: the
  damaged field `{survey:'not-a-record', common:7}` was replaced on disk by this
  actor's idle serialization.

Honesty note: the malformed case's *final* assertion (survey phase after further
real play) originally expected `idle`; the chapter really advances to
`awaiting-start`, so that trailing assertion was corrected to observed lawful
behaviour. The retention assertion that demonstrates the defect was not
weakened, and the counterfactual below re-runs the **final** test bytes against
the pre-closure source.

## Fix

`main/src/story/commonGroundState.ts` → `stageCommonGroundWorldPayload`: a
non-null (PRESENT) payload now also removes the world from
`restoreSettledWorlds`. A newer present read may not borrow ownership from an
older ABSENT answer; ownership is re-earned only by real validation
(`markCommonGroundRestoreSettled` on hydration) or by a later read that
genuinely finds nothing (`settleCommonGroundIfNothingStaged`). The `raw == null`
path is byte-for-byte the previous behaviour.

Only stale ownership *knowledge* is invalidated. Preserved: genuine newer live
work (`hasNoCommonGroundProgress` is independent of this flag), successful
silent hydration, actual actor/world identity validation, the pending-before-
hydration window from the 13:41 item, the explicit scoped clear, legacy
absent/empty saves, and signed AV / no-replay conditions. No milestone granted,
no F/ACK replay, no global progression field. This is a state-lifetime
correction, not a feature.

## Changed paths (both allowed by the existing production lock)

| path | pre-closure sha256 | final sha256 |
| --- | --- | --- |
| `main/src/story/commonGroundState.ts` | `681846b7…1e87a6` | `900da8a2…b35784` |
| `main/src/story/commonGroundDirector.test.ts` | `8584dc5c…9087ac` | `3dc70095…0f67ec` |

The other **96** tracked source files are byte-identical to the pre-closure
archive, including all now-working navigation code. No file was created under
`main/src`; temporary work lives in `tmp/navigation-closure` and
`logs/navigation-closure`. No `git checkout/reset/restore/stash/clean` was used.

## Tests

Baseline 350 files / **3137** → final 350 files / **3139**. Added 2, removed 0,
changed 0, files added 0 — both additions in `commonGroundDirector.test.ts`.

## Counterfactual

`tmp/navigation-closure/counterfactual.py` restored the pre-closure
`commonGroundState.ts` (`681846b7…`), ran the final test bytes, and put the final
file back with a hash check in `finally` (`900da8a2…`, `restoredExactly: true`).
Result: **2 failed | 105 skipped**, exit 1 — both new cases fail without the fix,
every other selected case still passed. Logs `counterfactual-prefix-state.log`,
`counterfactual-summary.json`.

## Checks (exact)

All in cwd `/home/thomasphillip/Projects/vox/main`.

| command | start → finish (UTC) | exit | result | log |
| --- | --- | --- | --- | --- |
| `npx vitest run …commonGroundDirector/commonGroundState/persistence/CommonGroundWorld/storyState` | 13:55:42 → 13:55:45 | 0 | 5 files / 217 tests | `after-fix-focused.log` |
| `npm run verify` | 13:56:19 → 13:57:22 | 0 | 350 files / 3139 tests | `verify-navigation-closure.log` |
| `npm run story:ux:check` | 13:57:25 → 13:57:27 | 0 | 9 files / 94 tests | `story-ux-check.log` |

`npm run verify` is the composite gate and covers catalog, scene AV, creative
workflow, chapter registry, chapter journey, typecheck, preview, audio
diagnostic, story ladder, guidance targets, story authority, tests, audio and
build. No standalone component was re-run merely to fill a template. The full
pass is AFTER the last source edit, and verification was not broadened beyond
the changed source. Log sha256 values are in `navigation-closure-report.json`.

## Limits

Everything here is **source-level**: real module wiring, the real persistence
route, actual stored bytes. No browser, GPU, preview or hardware run was
performed or claimed, and no independent verifier has run against this closure.
Whether a real hardware Continue exercises this exact ordering is for
independent verification to say. The four other navigation review items were
closed in the original engineer's report; this closure neither re-certifies nor
withdraws them, and does not overwrite that report or any root-owned manifest,
gate, check-results, readiness, ledger or authority file.

## Carried-forward findings

- `HABITAT-CARRY-SYMMETRY` — unchanged observation, still flagged for routing.
- `FOREIGN-PAYLOAD-WORLD-STAYS-UNSETTLED` — now also true after an earlier
  in-session empty read: a world holding foreign or unreadable bytes does not
  settle, so this actor cannot write empty chapter state over them. Real new
  play still saves normally (covered by the malformed test); the explicit scoped
  clear remains the way to reclaim such a record.
- `VF4-HARNESS-MARKER-1` — pre-existing verifier harness gap, untouched.
