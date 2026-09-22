# Harness final prep — progress log

Run: `2026-09-05-after-the-hearth`. Role: verifier-harness-final-preparer.
Scope: EXACTLY two bounded run-local harness changes, no game source, no
browser, no build, no GPU, no network, no publication, no acceptance.

1. Pre-capture exact source snapshot + SHA256 manifest inside each capture's own
   output folder, bound into summary/trace metadata (historical `probeSha256`
   stays reconstructable after later harness edits).
2. Guaranteed cleanup of the OWNED browser session when capture, frameStats,
   summary writing or a checkpoint throws — in both probes.

Nothing here is chapter verification, and nothing here proves browser or game
behaviour: every test is offline with stub sessions.

## Phase 0 — read-in and pre-edit archive (started 2026-09-06T12:03:16Z)

- Read `CLAUDE.md`, `verification-world-interim-report.md`, the final
  `verifier-inbox.md` coordination notes (read-only; not owned), and the current
  `verifier/probes/cg-journey-probe.mjs`, `cg-footing-diag.mjs`,
  `cg-harness-selftest.mjs` plus `probes/lib/{captureProvenance,cgContract,physicalPose,stallWatch}.mjs`.
- Confirmed the previously reported `frameStats(...).catch` TypeError is already
  corrected in `cg-footing-diag.mjs` (it now uses a synchronous try/catch), but
  the `await session.stop()` there and in `cg-journey-probe.mjs` is still the
  last top-level statement, so ANY throw before it still leaks the owned
  browser. That is what change 2 fixes.
- Exact byte backups of every file to be edited taken BEFORE any edit at
  `verifier/artifacts/harness-final-prep-archive/pre-edit-2026-09-06T120510Z/`
  with `pre-edit-2026-09-06T120510Z.sha256`. No `git checkout/reset/restore`,
  no generic `/tmp` name.

Status: COMPLETE.

## Phase 1 — new run-local helper modules

- `verifier/probes/lib/sourceSnapshot.mjs` (change 1): real import-graph walk,
  deterministic manifest hash over source bytes only, byte-exact copies under a
  repo-relative layout with original absolute paths as metadata, hard refusal to
  overwrite an existing snapshot, and live-drift comparison.
- `verifier/probes/lib/ownedSession.mjs` (change 2): adopt-one-session guard with
  idempotent `stopOnce`, `runGuarded` try/finally, a cleanup record, and an
  honest `failureRecord` for a crashed capture.

Status: COMPLETE.

## Phase 2 — probe wiring (both probes)

- `cg-journey-probe.mjs` and `cg-footing-diag.mjs` both: write the snapshot after
  `mkdirSync(outDir)` and BEFORE the trace is truncated or the browser opens;
  emit a `kind:'source-snapshot'` trace line; bind `sourceSnapshot`,
  `probeSha256Reconstructable` and `cleanup` into `summary.json` (and
  `sourceSnapshot` into the pre-browser checkpoint summary).
- Both wrap the measuring body in `try/catch/finally`: the session is adopted by
  the guard, a failure writes `failure.json` + a `probe-failure` trace line and
  is RE-THROWN unchanged, and `guard.stopOnce()` in the `finally` stops only the
  probe-owned browser, exactly once. The journey probe's stall exit 3 now sets an
  exit code and exits AFTER cleanup, so the code is unchanged.
- The journey-probe body was re-indented by two spaces to sit inside the `try`;
  `diff -w` against the pre-edit archive shows the added lines only.

Status: COMPLETE.

## Phase 3 — offline behavioural tests

- New `verifier/probes/cg-harness-prep-selftest.mjs`, 28 checks, stub sessions and
  an in-memory filesystem; wired into `cg-journey-probe.mjs --self-test` so that
  stays the single pre-session gate.
- Non-vacuity confirmed by two temporary mutations (cleanup made non-idempotent →
  A5/A6 fail; snapshot overwrite allowed → B7 fails). Both files were restored
  from exact byte backups and re-hashed identical.
- All suites green: existing `cg-harness-selftest` 25/25, prep suite 28/28, both
  probe `--self-test` gates exit 0, `node --check` clean on every touched file.

Status: COMPLETE.

## Phase 4 — final report

`harness-final-prep-report.json` / `.md` written with every changed/new run-local
path and before/after hashes, exact commands, cwd, exit codes, log hashes,
timestamps and limitations. No browser, preview, GPU, build, network or game
test was run, and nothing here is chapter acceptance.

Status: COMPLETE.
