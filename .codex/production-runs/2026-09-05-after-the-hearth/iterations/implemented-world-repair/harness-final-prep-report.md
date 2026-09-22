# Harness final prep — two bounded run-local changes

Run `2026-09-05-after-the-hearth`. Role: verifier-harness-final-preparer.
Started **2026-09-06T12:03:16Z**, finished **2026-09-06T12:16:20Z** (the last act was a confirming re-run of both gates: exit 0, 25/25 + 28/28).
Machine-readable twin with every hash:
`harness-final-prep-report.json`. Phase log: `harness-final-prep-progress.md`.

**This is not verification, not acceptance and not a chapter claim.** It is
mechanical preparation of this run's verifier probes. **No browser, preview,
GPU, game build, game test or network was used, so nothing here is evidence
about the game or the renderer.** The two blockers in
`verification-world-interim-report.md` are untouched and still open.

## Change 1 — a capture now retains the exact source it ran

Before a capture starts — after its output folder is created, **before** the
trace is truncated and before the browser opens — each probe writes into that
capture's own folder:

```
<outDir>/source-snapshot/manifest.json          per-file sha256 + paths
<outDir>/source-snapshot/files/<repo-rel-path>  byte-exact copies
```

It copies the run-local primary probe, the local libraries it really imports,
and the read-only repo probe helpers it imports — discovered by reading the
actual import statements, not from a hand-kept list. On the live journey probe
that is **11 files**: the probe, its six `lib/*.mjs` modules, and
`main/tools/lib/{evidence,previewServer,pixel-laws,previewSnapshot}.mjs`, with
**zero unresolved imports, no `node_modules` and no game source**.

Each entry keeps both the **relative** repo-shaped path and the **original
absolute path** as metadata. `manifestSha256` covers only the ordered
path/hash/size list — no timestamps, no absolute paths — so it is a function of
the source bytes alone. The ref (`manifestSha256`, `entrySha256`, file count) is
bound into `summary.json` alongside `probeSha256`, and into a
`kind:"source-snapshot"` line at the head of `trace.ndjson`.

That is the whole point: **`probeSha256` stays reconstructable after the harness
is edited again**, from the capture itself.

Rules kept:

- An existing snapshot in the same folder is a **hard refusal**, raised before
  the trace is truncated — so a re-run can never clobber an earlier capture.
- Bare/package specifiers are recorded as metadata, never copied. **No
  credentials, `.env`, config secrets or whole-workspace copies** — only
  executable source reachable from the probe's own import graph.
- **Old captures are not modified and are not claimed to have this.** They
  predate the feature; their `probeSha256` remains resolvable only while the
  referenced harness bytes are unchanged.
- Existing source/build/renderer/per-image provenance and every stop/outcome
  value are unchanged; this is an addition, not a replacement.

## Change 2 — the probe-owned browser is now stopped on any failure

Both probes previously ended with `await session.stop()` as the last top-level
statement. Any throw before it skipped that line and left the probe's own
Chromium running. `cg-footing-diag` hit exactly that at `frameStats(...).catch`
(`frameStats` is synchronous). **That TypeError was already corrected before this
task**; what was still missing was the guarantee for the *next* failure.

Both probes now adopt the session they open into a small shared guard
(`lib/ownedSession.mjs`) and wrap the measuring body in `try/catch/finally`:

- the `finally` calls `guard.stopOnce()`, which invokes **that session's own
  `stop()` at most once** — safe to call from the normal end and the finally;
- the `catch` writes `failure.json` and a `probe-failure` trace line and
  **re-throws the original error**, so the exit code still reports the failure;
- **the root-owned preview is never stopped** (the probes pass
  `preview: { url, stop() {} }` and nothing reaches past `session.stop`), no
  process is killed, no signal is sent, no global browser shutdown happens;
- a failure *inside* cleanup is recorded and logged but **never replaces the real
  error**, and a failed stop is not reported as stopped;
- the journey probe's stall `FAIL-STALL` **exit code 3 is unchanged** — it now
  sets the code and exits *after* cleanup instead of before it.

Partial evidence survives: whatever trace lines and frames were written stay as
written, and a crashed capture is recorded as `PROBE-ERROR-INCONCLUSIVE` with no
fabricated `summary.json`. A failed capture is reported as failed.

## What changed on disk

| path | before | after |
| --- | --- | --- |
| `verifier/probes/lib/sourceSnapshot.mjs` | *(absent)* | `f01e2d88…7205` |
| `verifier/probes/lib/ownedSession.mjs` | *(absent)* | `a692bd6c…4cf0` |
| `verifier/probes/cg-harness-prep-selftest.mjs` | *(absent)* | `998f4d86…f49f` |
| `verifier/probes/cg-journey-probe.mjs` | `d5e789ee…ab6d7` | `87d4985a…783e` |
| `verifier/probes/cg-footing-diag.mjs` | `e26fbb0f…acc0` | `3f23bb3e…fb7b` |
| `harness-final-prep-progress.md` | *(absent)* | `c2bb7c65…faa3` |

Plus new run-local evidence folders: the pre-edit archive
`verifier/artifacts/harness-final-prep-archive/pre-edit-2026-09-06T120510Z/`
(+ `.sha256`, `38545236…9084`), the mutation-check byte backups, the offline
snapshot dry run, and `verifier/logs/harness-final-prep/`.

Verified **unchanged**: `cg-harness-selftest.mjs` `5f0b8883…7d71`,
`lib/captureProvenance.mjs` `22492552…c968`, `lib/cgContract.mjs` `5f447ebd…c551`,
`lib/physicalPose.mjs` `a70e611f…e236`, `lib/stallWatch.mjs` `681fd58b…1d3f`.
**Physical pose, stall threshold, gameplay controls, markers, interaction
semantics and score were not touched**, nor was any game source, game test, old
capture, or any root-owned contract/gate/readiness/control/inbox/ledger.

Exact byte backups of every edited file were taken **before** the first edit and
restored from copies, never `git checkout/reset/restore` and never a generic
`/tmp` name. The journey probe's body was re-indented two spaces to sit inside
the `try`; `diff -w` against the archived original shows only the added lines.

## Tests — offline, cwd `…/verifier/probes`, run 2026-09-06T12:12:46Z

| command | exit | result | log sha256 |
| --- | --- | --- | --- |
| `node cg-harness-selftest.mjs --json …` | 0 | **25/25 passed** | `66d85c3c…8e14` |
| `node cg-harness-prep-selftest.mjs --json …` | 0 | **28/28 passed** | `1cc5cb06…d7e1` |
| `node cg-footing-diag.mjs --self-test` | 0 | OK | `ddbf1b53…440f` |
| `node cg-journey-probe.mjs --self-test` | 0 | own checks OK + 25/25 + 28/28 | `6ba42d38…2f39` |
| `node --check` × 6 touched files | 0 | clean | `ea7bf916…0da4` |

The existing 25-check suite is unchanged and still passes.
`cg-journey-probe.mjs --self-test` now runs **both** offline suites, so it
remains the single pre-session gate.

The new suite drives **stub sessions** and **deliberate thrown errors** — the
real `frameStats(...).catch` TypeError text, an `EACCES` summary write, a
malformed `verifier-control.json` — and proves: the owned `stop()` runs **exactly
once** in each case, explicit-plus-finally and three racing cleanups still
collapse to one, the **original error object** propagates (identity, not just
message), a failing cleanup never masks it, and the guard never touches the
preview stub. On the snapshot side it proves determinism across different
clocks, byte-identical copies, relative + absolute path fidelity, refusal to
overwrite (with the existing manifest bytes verified untouched), one-changed-byte
sensitivity, drift detection, and that `probeSha256` is reproducible from the
retained copy. `D1` composes both changes on a real temporary filesystem.

**Non-vacuity was checked, not assumed.** Two temporary mutations of the live
modules — cleanup made non-idempotent, and snapshot overwrite allowed — made
exactly the intended checks fail (`A5` "ran 2", `A6` "ran 3", `B7`), and both
files were restored from exact byte backups and re-hashed identical.

## Limitations — read these

- **No browser or game proof.** Every session in these tests is a stub. "Cleanup
  runs exactly once" means the harness control flow invokes the session's own
  `stop()` exactly once; **no real browser process was observed to exit**.
- The probes' own `try/catch/finally` blocks are covered by a static structure
  check plus behavioural tests of the helpers they call. They have not been run
  against a real capture, because that needs a browser.
- The import walker matches specifiers textually and does not strip comments, so
  a phrase like `import 'x'` in prose can add a phantom external entry. The bias
  is deliberately toward **over-recording, never omission**; the manifest states
  this itself. A computed dynamic import is flagged, not resolved.
- The snapshot proves which **source** ran. It says nothing about the build, the
  served bundle, the renderer or the outcome.
- Nothing here repairs, or bears on, the two measured blockers.

## Unrelated, reported not acted on

- The archived dry-run snapshot predates a final one-line limitation edit to
  `lib/sourceSnapshot.mjs`, so `compareToLive` on it now reports drift on exactly
  that one file (10 identical, 0 missing). That is the drift detector working on
  real data; the stale copy is kept rather than rewritten.
- Still open and out of this scope: `VF3-FOOTING-1`, the home AV / CG008 seam,
  and the inbox note that `verifier/tests/cg008-midbeat-continue.repro.test.ts`
  seeds milestone strings that do not look like committed constants. No test or
  game file was touched.

## Handoff

The probes are ready for the next independent verifier to own. Pre-session gate:
`node cg-journey-probe.mjs --self-test` from `verifier/probes`. The first capture
under a fresh `--out` name writes its own `source-snapshot/`; if that folder
already holds one the probe refuses to start rather than overwrite it — pick a
new `--out`. This invocation ends here; no permission question, no publication.
