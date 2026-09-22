# finale-window closure (CPU-only) — PREPARED, NOT EXECUTED

Lane: finale-window · run 2026-09-05-after-the-hearth · authored by a Claude Opus 5
(`claude-opus-5`) invocation. No audible, causal or acceptance verdict is made here:
nothing was launched, rendered, played or recorded.

## Six blockers closed (all inside verifier/probes/finale-window/)

1. **Import depth** — `main/tools/lib/*` now uses **six** `../` (probes→verifier→run→
   production-runs→.codex→vox). C2 shows the five-parent path does not exist.
2. **Dependency, found by actually importing** — `await import('playwright')` was
   unresolvable *and* the wrong package. The run folder is outside `main/`, so no
   `node_modules` lookup reaches `main/node_modules`, and the installed package is
   `playwright-core` (what `evidence.mjs` uses). Now resolved by path
   (`PLAYWRIGHT_CORE_URL`). **Nothing needs installing.**
3. **Snapshot shape** — the actual provider `JourneyRuntimeProbeBridge.buildSnapshot`
   exposes `state.signedSceneAv`, **not** `state.avFull`. The sampler now reads
   `activationHistoryAnchorIds` and tests **exact** membership of `anc.cg.complete`
   and `anc.cg.handback`. The JSON-substring regexes are gone. An absent member is
   `null` plus a `*Present:false` flag — never `false`-as-if-read.
4. **Completion edge** — requires, in ONE atomic sample: story done/inactive **and**
   both anchor ids **and** live `diagnostic.common.committed === true` with
   `workerUnits >= 18` (`CG_COMMON_ROUTE_UNITS`). The in-page predicate is the same
   function object, injected verbatim, so it cannot drift from the tested one.
5. **Custom unmuted browser** — adopted by the owned-session guard **immediately**
   after launch; `newContext`/`newPage`/`goto`/`assertHardwareGl` failures now close
   it and write `failure.json` + `cleanup-receipt.json`. Previously any of those
   throws leaked a live headed browser.
6. **Lock command** — `bash -c 'exec 9>LOCK; flock -w 60 -x 9 || exit 75; node … --heavy-lock-fd 9'`.
   Node inherits the locked open file description. The old `flock -c` + reopened
   `exec 9<` gave node an *unlocked* fd 9, making `--probe-lock-contention` vacuous.
7. **Audio wrapper** — `finale-window-runtime.mjs` (callable, the control role
   `finale-window-runtime`): owns one null sink by exact module id, points **only its
   own Chromium child** at it via `PULSE_SINK`, verifies every sink-input on that sink
   is in the **real** browser pid's process tree (pid published by the probe as
   `browser-pid.json`; never mocked), records **only `<sink>.monitor`** — no default
   sink, no default monitor, no microphone, no foreign stream, no global change —
   stops the recorder in a `finally` on every path, **preserves failure audio**,
   unloads the exact module and verifies it is gone, and re-reads the default sink to
   prove it is unchanged. Recorder lifetime ≥ **73.5 s** (observed ~62 s completion +
   11.5 s hold); session hard cap **360 s**. The old 60 s whole-run recording is now
   rejected by construction.

## Focused checks (19/19)

`node verifier/probes/finale-window/closure-checks.mjs` → exit 0,
`logs/finale-window-closure/closure-checks.json`. These **run** the actual sampler
(node:vm, exact bridge-shaped snapshot), the actual edge predicate, the actual session
guard with failing context/goto/assert stubs, and the actual wrapper's ownership and
teardown branches with pactl/spawn stubs. The prior 33 checks were structural source
searches and could not have caught any blocker above.

## One combined run, when root serializes GPU

`finale-window-runtime.mjs` produces the atomic state window **and** the actual unmuted
output in a single unmuted session. No duplicate state-only capture.

## Still missing, still honest

Cancellation reason/caller (discarded at `commonGroundScore.ts:259`),
`AudioContext.state`/mute/volume at the clearing frame, and App.tsx
`paused`/`hudBlockingOverlayOpen`/`downed`. No shipped hook exposes them; they stay
recorded as MISSING and are never inferred.

## Provenance

All **99** manifest-listed game files rehashed: **0 mismatches**. No source, contract,
package or global audio change. Original artefacts remain untouched in
`iterations/finale-window-initial-preparation/`. Owned hashes are in
`finale-window-closure-report.json`.
