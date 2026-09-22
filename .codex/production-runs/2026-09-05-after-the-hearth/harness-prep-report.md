# Verifier harness preparation report — Common Ground (ch13)

**This is harness preparation, not verification.** It is not chapter acceptance,
not a scorecard, not a readiness signal and not a publication decision.
Machine-readable twin: `harness-prep-report.json`.

- Role: bounded mechanical verifier harness preparer, run-local only.
- Performed **while the integration-lifecycle-repair engineer was actively
  editing game source.**
- **No game source edited. No game test, `npm run verify` or build run. No
  browser, no preview, no GPU, no heavy lock, no network. No claim whatsoever
  about the current source.**
- Root-owned files (inbox / control / readiness / lock / contract / reports /
  ledgers) were read only, never written. `integration-inbox.md` was read solely
  for a published hook decision — there is none yet.
- All prior captures and summaries under `verifier/captures/` are preserved
  untouched, as are the five other probes. No `git checkout`/`reset`/`restore`.
- Signed scene-v2 contract `4dbf722b…ff88e` read only, unchanged; `cgContract.mjs`
  and its hash gate untouched.

## Changed paths

All under `.codex/production-runs/2026-09-05-after-the-hearth/`.

| path | before sha256 | after sha256 |
| --- | --- | --- |
| `verifier/probes/cg-journey-probe.mjs` *(modified in place — reused, not replaced)* | `faa94f1d…04bb` | `de99c4a8…62db` |
| `verifier/probes/lib/captureProvenance.mjs` *(new)* | — | `22492552…c968` |
| `verifier/probes/lib/physicalPose.mjs` *(new)* | — | `0892bf76…bb5c` |
| `verifier/probes/lib/stallWatch.mjs` *(new)* | — | `681fd58b…91d3` |
| `verifier/probes/cg-harness-selftest.mjs` *(new)* | — | `9f957f0d…d2ff` |

Unchanged, byte for byte: `cg-lifecycle-probe.mjs`, `cg-manual-input-probe.mjs`,
`cg-preservation-diff.mjs`, `cg-preview-daemon.mjs`, `cg-reset-matrix-probe.mjs`,
`lib/cgContract.mjs`. Exact hashes in the JSON twin.

## Commands and logs

| command | exit | log |
| --- | --- | --- |
| `node verifier/probes/cg-harness-selftest.mjs --json verifier/logs/harness-prep/selftest.json` | **0** — 23/23 | `verifier/logs/harness-prep/selftest.log` |
| `node verifier/probes/cg-journey-probe.mjs --self-test` | **0** | `verifier/logs/harness-prep/probe-selftest.log` |
| `node --check verifier/probes/cg-journey-probe.mjs` | **0** | `verifier/logs/harness-prep/syntax-check.log` |
| mutation check (5 defects reintroduced into **copies** under `tmp/harness-prep/`) | **1**, both batches | `verifier/logs/harness-prep/mutation-check.json` |

Log hashes are in the JSON twin. Nothing outside `verifier/probes/`,
`verifier/logs/harness-prep/`, `tmp/harness-prep/` and the three
`harness-prep-*` artifacts was written.

---

## HP-1 — Per-frame capture provenance

**Problem (root, `verifier-inbox.md` 10:02 UTC).** `post/home-movie-2` attributed
**one shared gameplay state** to a raw frame and its HUD-suppressed partner that
were captured up to ~1 s apart while gameplay advanced, and treated them as
simultaneous before/at/after anchor evidence.

**Change.** `shoot()` now delegates to `shootOne()`, which brackets **every**
screenshot with its own cheap pre-shot and post-shot observation
(`sampleProvenance()` — one small read-only `evaluate`, deliberately lighter than
the full sampler so bracketing does not starve the 10 Hz loop). Each frame
records:

- its **own** `provenance.window {startMs, endMs, durationMs}`,
- its **own** `provenance.pre` / `provenance.post` observations,
- its **own** `sha256`, `bytes`, `stats`,
- its **own** `role` — `raw-hud-inclusive` vs `perceptual-hud-suppressed`,
- `provenance.crossings` and `atStateClaimable`.

When `beat / objectiveId / markerLabel / workOrder / anchorId /
activationSequence / milestones` changes while the shutter is open,
`atStateClaimable` is **false** and the frame is reported as lying *inside a
window*. **No exact anchor instant is ever fabricated.**

`pairProvenance()` records `simultaneous: false` unconditionally, the **real**
`pairOffsetMs`, and any state that crossed *between* the two partners.

**Preserved.** Original pixels are written once, hashed, and never re-encoded,
cropped or filtered. HUD suppression remains the shipped `evidence.mjs`
`vox-hide-ui` behaviour, restored in a `finally`. Legacy per-frame
`atMs/beat/objectiveId/anchor` keys are retained — now each frame's **own**
post-shot values — so v1 readers still parse.

**Boot black frame.** `classifyLuma()` flags a blank frame as
`bootBlackFrameCandidate` and sets `visualAcceptance: false` on **every** frame
without exception. A boot black frame is progression evidence, never visual
acceptance. This harness makes no visible-content claim at all.

## HP-2 — Physical diagnostics

**Read-only source survey (dirty tree, 2026-09-06 — re-check after the engineer
finishes).**

| fact | consequence |
| --- | --- |
| `JourneyRuntimeProbeBridge.tsx#buildSnapshot` has **no player pose field at all** (`getPlayerWorldPosition` is imported but used only in `prepareScenario`'s gaze receipt) | **full-precision live player pose is not obtainable today** |
| `snapshot.entities` is a **`Record`, not an array** | the previous probe's `Array.isArray(s.entities)` recorded `null` for every entity in every sample — **fixed** |
| `journeyRuntime.roundedPosition` | entity positions quantised to `1e-2` |
| `autopilot/primitives.ts:2097` | `__autopilot.pos` = `getPlayerWorldPosition()` rounded to `1e-2`, **movie lane only** |
| `world/AuditWorker.tsx:143` | `__auditWorker.pos` rounded to `1e-1` — coarser than the entity record for the same actor |
| `state/playerFrame.ts` ← `EfficientPlayer` `body.translation()` | the pose is the **Rapier capsule CENTRE** |
| `cubeGravityConstants.ts` 1.3 / 0.5; `EfficientPlayer.tsx:1525` | `feetWorld = centre − up·1.3`; the **sole** is a further 0.5 below |

**Change.** `selectPlayerPose()` prefers a full-precision snapshot pose across
six candidate paths and otherwise falls back to `__autopilot.pos`, **always
retaining the rounded value as secondary**, and records `source`, `sourceClass`,
`declaredPrecisionUnits`, `observedQuantumUnits` (an independent cross-check on
the claim), `fullPrecisionAvailable`, `frame` and the lane limit.
`selectWorkerPose()` prefers the `1e-2` `entities['actor:w7744']` record over the
`1e-1` global. `deriveFootFrames()` emits `capsuleCentre`, `cylinderBottom` and
`sole`, with `upAssumed` flagged — the live `getPlayerUp()` is **not** exposed,
so `+Y` is an assumption and is invalid on a non-top cube face.

**CommonGround diagnostics.** `getCommonGroundDiagnostic()` and
`getCommonGroundScoreDiagnostic()` exist in source but a repo-wide grep finds
**no `window` assignment anywhere**. The harness therefore **feature-detects**
from an allow-list (plus an optional `--cg-diag-hook` operator override),
**assumes no hook name**, **does not edit the bridge**, and records
`available:false` with the exact list of names probed when nothing answers —
explicitly an *unmeasured gap*, never an implied pass. Self-test **D1** enforces
that the probe references no mutating routine (`prepareScenario`,
`commonGroundRailPlan`, `activateSignedSceneAnchorById`, progress grants, …) and
synthesises no key press other than the already-labelled shipped `KeyF`
disembark fixture.

**Metric semantics.** Every traversal figure now carries
`metricClass: 'measurement-lower-bound'`, `isRuntimeProof: false`, and the
chording / quantisation / centre-vs-feet / "walked distance is not credited
progress" caveats inline.

## HP-3 — Opt-in bounded stall FAIL predicate

**Default: OFF.** Only `--stall-fail-ms <n>` enables it.

**Exact predicate.** FAIL when, for a continuous window ≥ `windowMs` (× 2 while
the runtime reports its own non-null `holdReason`), **none** of these changed:

1. **story** — beat, objectiveId, markerLabel, workOrder, anchorId, signed-AV
   `activationSequence`, localActor milestones;
2. **physical progress** — the CommonGround diagnostic progress signature
   (`survey.*`, `common.stage/terraUnits/comparisonProved/finalReference*`,
   `holdReason`, `installWatch`, `worker.*`) — **only when that diagnostic is
   actually exposed**;
3. **player body** — accumulated |Δ capsule centre| ≥ `--stall-units`;
4. **actor body** — accumulated |Δ worker pose| ≥ `--stall-actor-units`;
5. **active flight** — ship pose accumulated ≥ `--stall-ship-units` while
   `controlMode === 'flight'`;

while the phase is in `--stall-fail-phases` and no deliberate manual wait is
declared.

**False-failure guards**, each covered by a behavioural test:

- **deliberate manual wait** — `--manual-hold-ms` makes the predicate inert;
- **active flight** — a genuinely moving ship resets the window. Flight mode
  **alone does not exempt**: the parked-ship VF-DEEPLINK-1 shape *must* still
  FAIL, and test C5 asserts exactly that;
- **ongoing actor motion** — W-7744 walking his own leg resets the window;
- **intentional cue holds** — a caption or cue window **suppresses firing
  without resetting the clock**, so a cue that never ends still fails, just
  later, and every suppression is disclosed in the FAIL record;
- **out-of-scope phases** (cutscene, flight lane) are not judged at all;
- a runtime-declared `holdReason` **widens** the window rather than disabling it.

**On fire**: append a `stall-fail` trace event, capture the frozen moment (raw +
percept when `--percept`), then fall through to the **ordinary graceful
finalization** — trace, frames, complete `summary.json`, `session.stop()` — and
exit 3. **No rescue, nudge, teleport, key press or progress grant.**

**Never success.** `summary.outcome` ∈ `FAIL-STALL` |
`CHECKPOINTED-INCONCLUSIVE` | `REACHED-STOP-PREDICATE` |
`BUDGET-EXHAUSTED-INCONCLUSIVE`, with `outcomeIsAcceptance: false`. Reaching a
stop predicate means the requested state was **observed**, not that the chapter
passed. Self-test **D2** asserts the harness never sets `isSuccess`,
`visualAcceptance` or `outcomeIsAcceptance` true anywhere.

**Root control intact.** `pollControl` still re-reads `verifier-control.json`
every `--control-ms` (default 10 000 ms, ≤ 10 s) and a checkpoint still exits 0
with `checkpointed: true` after a complete summary.

**Limits of the predicate.**

- sample-rate/quantisation bound — motion under the pose quantum between samples
  is invisible and can read as stagnation;
- without the CommonGround diagnostic, internal route/cursor progress is
  unobservable; the FAIL then covers only what could be observed and says so in
  `physicalProgressCaveat`;
- a legitimately very slow approach moving under `--stall-units` per window
  would be a false FAIL — widen `--stall-fail-ms`, do **not** relax
  `--stall-units`;
- the phase label is the probe's inference from the shipped autopilot
  `routeAction` and prompt presence, not a chapter-authored phase; a mislabelled
  phase can put the predicate out of scope and hide a real stall;
- it cannot distinguish "wedged" from "waiting for an input the probe was never
  asked to send" — manual lanes must declare `--manual-hold-ms` or leave it off.

## Offline tests

`node verifier/probes/cg-harness-selftest.mjs` — **23/23**, pure CPU, no browser,
no preview, no GPU, no game build/tests, no network. It drives the harness's own
pure modules with synthetic sequences.

Specifically covered: the shared-state capture collapse across a simulated
beat/objective change (A2); the ~1 s raw/percept pair being called simultaneous
(A3); boot-black frames never becoming acceptance (A4); the entities-`Record`
regression (B3); centre/cylinder-bottom/sole derivation matching the interim
report's 50.99 figure (B4); real stagnation firing (C1); and false positives for
slow real walking, advancing objective copy, ongoing actor motion, active
flight, cue holds, declared manual waits, out-of-scope phases and credited route
progress (C2–C10) — plus the guarantee that each exemption **delays but cannot
cancel** a real FAIL (C6, C7, C9).

**These are behaviour tests, not string mirrors,** and that is demonstrated
rather than asserted: five deliberate defects were reintroduced into **copies**
of the harness (cue suppression resetting the clock; pair marked simultaneous;
crossings ignored; blanket flight exemption; the `Array.isArray` entities bug)
and each was caught — `verifier/logs/harness-prep/mutation-check.json`, both
batches exit 1. The real harness was never mutated.

## Supported flags

Pre-existing flags are unchanged. Added:

| flag | default | meaning |
| --- | --- | --- |
| `--stall-fail-ms <n>` | `0` (**off**) | opt-in stall FAIL window |
| `--stall-fail-phases <csv>` | `walk,interact,on-foot` | phases the predicate may judge |
| `--stall-actor-units <n>` | `0.5` | worker displacement counting as ongoing actor motion |
| `--stall-ship-units <n>` | `1.0` | ship displacement counting as active flight |
| `--stall-hold-multiplier <n>` | `2` | window widening under a declared `holdReason` |
| `--stall-cue-grace-ms <n>` | `12000` | cue-hold suppression grace |
| `--manual-hold-ms <n>` | `0` | declared deliberate manual wait |
| `--cg-diag-hook <name>` | none | operator-supplied read-only diagnostic hook, prepended to the allow-list |
| `--cg-score-diag-hook <name>` | none | same, for the score diagnostic |

`--stall-units` keeps its meaning and is now shared by the observational stall
report and the opt-in FAIL predicate.

`summary.json` becomes `paravoxia.verifier.cgJourneyProbe.v2`, adding `outcome`,
`capturePolicy`, `poseSource`, `physicalDiagnostics`, `stallObservational`,
`stallPredicate`, `traversal.semantics` and the per-frame `provenance` / `role` /
`luma` / `pair` blocks. `summary.stall` is retained as an alias and legacy frame
keys still parse.

## Integration requirements

**IR-1 (high).** Expose `getCommonGroundDiagnostic()` and
`getCommonGroundScoreDiagnostic()` through a query-gated, read-only,
deep-copying surface — preferably as extra methods on the existing
`__paravoxiaJourneyProbe` bridge behind the same `?journeyprobe=1` gate. No
setters, no mutable references, no normal-play global, no new preparation
grants. **Any name works** — the next verifier passes `--cg-diag-hook`; no
harness edit is required either way. If declined, the harness records
`unavailable` with the names it probed and skips stall clause (2), saying so.
*Status: not published. Root has requested such a surface in
`integration-inbox.md`; no name is decided.*

**IR-2 (high).** Add a full-precision player pose to `buildSnapshot` — unrounded
`body.translation()` plus the live `getPlayerUp()` axis. Without it there is no
player pose in a manual lane at all, path metrics stay quantisation-bound lower
bounds, and the VF-RAIL-2 centre-vs-feet reconciliation rests on an unverified
`+Y` assumption on a cube-gravity world. The six candidate paths are already
probed, so publishing one needs **no harness change**.

**IR-3 (medium, next verifier).** After root's exact source gate, run **one
short throwaway probe** and confirm `poseSource`, `capturePolicy`,
`physicalDiagnostics` and `stallPredicate` appear in `summary.json` before
committing to a long capture.

## Honest limits

- **Nothing here measures, verifies or accepts the current game source.** The
  engineer was mid-edit throughout.
- The **Playwright wiring is unexercised**: offline tests cover the pure modules
  and a static safety scan, not a browser.
- Full-precision live player pose does not exist today. Every path metric is a
  quantisation- and sample-rate-bound **lower bound**, measured on the capsule
  **centre**, and is **not** runtime proof of credited progress.
- The local up-axis is not exposed; foot-frame derivations assume `+Y` and are
  invalid on a non-top cube face — flagged in every record, never used silently.
- CommonGround phase / cursor / hold / foot-frame state remains **unobservable**
  until IR-1 lands. A stall FAIL taken without it is a measured stagnation of
  everything observable, not a proof that no internal counter moved.
- **No chapter-acceptance, visual-taste, visible-content or audibility
  assertion** is made anywhere. `visualAcceptance` is hard-false on every frame;
  SFX counts remain queue observations, not hearing.
- No threshold or proof predicate was relaxed and no creative interpretation was
  made. The signed-contract hash gate is untouched.
- No publication, no readiness signal, no gate.

## Next verifier gate

```
node verifier/probes/cg-journey-probe.mjs --self-test        # expect exit 0
```

Run **after root's exact source gate**, before any browser work. Progress notes
and the diagnostic-hook coordination request are in `harness-prep-progress.md`.
