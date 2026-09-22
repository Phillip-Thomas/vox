# Navigation wording correction — mechanical integration report

Written 2026-09-06T14:07 UTC. Machine-readable twin: `navigation-wording-report.json`.

Scope: ONE non-behavioral terminology cleanup inside the same still-uncleared
navigation repair. Direction: `producer-navigation-wording-direction.json`
(recorded 2026-09-06T14:02:19.928168+00:00, `materialBehaviorChange: false`).
The implementation gate was NOT modified; the wording was made unambiguous
instead.

## Preflight

- Rehashed all **98** `sourceHashes` from the direction before touching anything.
  - Working tree: **0 mismatches**.
  - Archive `iterations/navigation-before-wording/source`: **0 mismatches** (98/98 files present).
- `iterations/navigation-before-wording/implementation-source-manifest.json`
  = `ba4c3349c5a5700db0ef3ec6a38e29f2d92dc8edd8fff12d1f1f3840e040f630`,
  matching `sourceManifestSha256` in the direction. "Before" bytes below come
  from that archive / manifest.

## What changed

The rejected bare word was replaced with "initial snapshot" or "uninitialized
snapshot" as grammar required, and the one test-local identifier `placeholder`
(plus its three references) was renamed to `initialSnapshot`. Nothing else.

| path | before sha256 | after sha256 | changed lines |
| --- | --- | --- | --- |
| main/src/game/systems/persistence.test.ts | 9c1dd65d948c17b37c12b26781966f7b36ee5b3aeca34c64cd3a333c4e99517a | f25a2374547b1d6b5f50d92cb0893c71706e0b9492baf2c0214566d03a91ee28 | 1 |
| main/src/game/systems/persistence.ts | f68be69f922abe670bf8a0a12246ad87ebb705e42b49ffd95466c6ca9cb631d7 | f01847c2695dcd636a3ba12f03b0b6e17ffc94614509a63097e19c21acd1f915 | 1 |
| main/src/story/commonGroundState.ts | 900da8a2a52a93cfce206748fb7a0a4ee6763db3c4a513deb85a8bc732b35784 | 7a3c03fb73cb715116ddbf1952fc2c312f52d1dac68b765b8097f4becdb0452e | 5 |
| main/src/story/commonGroundDirector.test.ts | 3dc70095f2aefcfb526b4cf289659bb625cbcc81f0a7742cc7d05c11e10f67ec | 8379b552bd076c4311ba333182e7f0399e0b82a60093a16feddcdc0ed1fb8492 | 15 |
| main/src/story/commonGroundDirector.ts | 23bd8ea59f156d9ba5c801e77acc353bd023cabbfde77af7a04cf195c2db921f | 980590b0add81f8e0ce6bdc182cb834940af336454435ff4d304a64e47ad11b5 | 3 |

Total 25 changed lines. The other **93** of the 98 tracked source paths hash
exactly as the direction records them — full before/after hash table is in the
JSON under `untouchedFiles`. No file outside the five allowed paths was written.

Two test titles were reworded (`persistence.test.ts` "…is an unentered initial
snapshot", `commonGroundDirector.test.ts` "the initial snapshot does not shadow
the payload staged behind it"). No test was added, removed, split or merged.

## Lexical-only proof

- Diff: `logs/navigation-wording/wording-lexical.diff`
  (sha256 `869f639b1ae082c89b3017dc86641d2f8b6920aa9246a2e1a7d7b071de034b8f`),
  25 removed / 25 added lines, all inside comments, one `it(...)` title string
  each in two files, and the renamed test-local const with its references.
- Mechanical check (`tmp/navigation-wording/prove-lexical.py`): for each of the
  five files the line count is unchanged, and every differing line, with the new
  wording substituted back to the rejected word, is byte-identical to the
  archived before line. **Non-lexical changed lines: 0.**
- No predicate, constant, call, argument, assertion, control flow, geometry,
  public narrative copy, generated artifact or gate script was touched.
- Residual case-insensitive occurrences of the rejected word in the five files: 0.

## Checks (run after the final wording edit)

cwd for both: `/home/thomasphillip/Projects/vox/main`

| command | started | finished | exit | log | log sha256 |
| --- | --- | --- | --- | --- | --- |
| `npm run verify` | 2026-09-06T14:04:14Z | 2026-09-06T14:05:16Z | 0 | logs/navigation-wording/verify.log | cf45406a988047111eddf84391ccda91e3e0340b42b8feb71e4dcf718c98dc99 |
| `npm run story:ux:check` | 2026-09-06T14:05:23Z | 2026-09-06T14:05:25Z | 0 | logs/navigation-wording/story-ux-check.log | f6389f56b462d9c30b430e2b9862ba5624cd3a251755a90f7c2af40915f0ac73 |

`npm run verify` is the composite gate command (catalog, scene AV, workflow,
chapter registry/journey, typecheck, preview, audio diagnostic, story ladder,
guidance targets, story authority, vitest, audio, build). Totals from
`verify.log` lines 588–589: **Test Files 350 passed (350)**, **Tests 3139 passed
(3139)** — unchanged from the baseline. `story:ux:check` subset: 9 files / 94
tests passed.

## Runtime unchanged (checked, not assumed)

`npm run build` was run in `main` on the pre-edit tree (after the 98-hash
rehash), and `npm run verify` ends in the same `vite build` after the edits.
Every `dist/**/*.js` hash is identical before and after:

- `dist/assets/index-CbB2rmHN.js` 2a5d6b2fed2298552963ca368cbc7c79a488b11d6b0fcabe3b16b3a130a654d9
- `dist/assets/SpaceStationSandbox-CabWoklJ.js` 1dafd9993c60df42bf1e02e5ed3e11be8462cde9a9e792e991657d29bac43ab6
- `dist/assets/worldPrep.worker-D9jfWRDd.js` 5c34b2579d4869bbb97ca0d692cf14c2ed050c8983dce442c1ffcca1676bd0de

The production JS bundle is byte-identical, which substantiates that the
shipped runtime did not change.

## Limitations

- Wording-only pass. No probe, GPU, browser, screenshot or acceptance
  measurement was run, and none is claimed here.
- The "before" bundle is a build of the same working tree immediately before the
  edits, not a rebuild from an archived commit.
- Bundle equality covers shipped `dist` JS only; test files are not bundled.
- A few rewritten comment lines now exceed the surrounding wrap width. They were
  deliberately NOT re-wrapped so the diff stays strictly lexical.
- The producer implementation gate was neither modified nor rerun here; root
  reruns it after collating this correction with the two retained engineering
  reports.

## Inbox

`integration-inbox.md` reread at 2026-09-06T14:06:20Z (sha256
`af3e452527af0c115715da3964c9382c77d82bcd6eed5e150661941a82586735`, 54932 bytes,
mtime 2026-09-06T13:47:57.749160+00:00). Latest entry is 13:47:57Z, "final
rejected-payload lifetime check". All entries predate this wording direction
(14:02:19Z); none adds or retracts scope for this terminology cleanup, and none
of them is addressed by it.

## Preservation

No prior engineer report, source manifest, check-results, gate log, readiness
file, ledger or contract was overwritten. New files only:
`navigation-wording-report.json`, `navigation-wording-report.md`,
`logs/navigation-wording/{verify.log,story-ux-check.log,wording-lexical.diff}`,
and run-private scripts under `tmp/navigation-wording/`. No temporary source
path was created anywhere in `main/src`. No child test process is running.
