# arrival-common-short-runtime — ordinary-input SHORT survey runtime

**VERDICT: `SHORT-NOT-PROVEN` (by this lane's own signed completion predicate).**

One SHORT trial was attempted and **physically performed end to end** with ordinary
input on hardware. 18 of 20 gates passed. The two that failed are both **probe-side
measurement mismatches**, not measured gameplay failures — and I did not repair them,
because they are the acceptance criterion of the very claim under test and my one
bounded correction was already spent.

No SHORT acceptance. No earned arrival, no first-time usability, no COMMON, no whole
chapter, no LONG claim, no score/audibility/taste claim, no defect closure, no
publication.

## Preflight — actual bindings

| binding | value | result |
|---|---|---|
| root `activeRole` | `arrival-common-short-runtime` | required, matched |
| URL (read live from control + ownership) | `http://127.0.0.1:34413/` | HTTP 200 |
| served `<title>` | `Paravoxia` | identity, not liveness |
| served index sha256 | `6c8c378b282e3edef451a6957a5b5ad52591e206fc771390cdc33f9859cbb207` | == root-owned |
| served bundle `/assets/index-BiDWGouH.js` | `efc87feb0068671e6ac297f808fe61ea320b208a13fd9a8c40fa051077a9a068` | == root-owned |
| root build hash | `aa52b0341b78d0931a5c91d431d9ba0ce81b5edde12b9b5b54449a5ee1c20d74` | matched |
| source manifest | `6ef957c3dd4a1af04852773b3e5f608d2247e212eb27d05a95ba6f40c1fee5d6` | matched |
| **all 99 source files, independently rehashed** | — | **0 drift, before and after** |
| contract | scene-v3 `5ef85a324f579ba1f627980002aab680f6c9b990fae84275daccc3dcb17eec54` | matched; the probe's `EXPECT_CONTRACT_SHA256` pin is already exact v3, **no repin needed** |
| 9 prepared probe files | all sha256 == the prep report | matched |
| unpinned shared `main/tools/lib/evidence.mjs` | `1997cf2a…5328` | matched, no drift |

No stale literals were used: every value above was read from `verifier-control.json`,
`verifier/artifacts/preview-ownership.json` and the live HTTP response at run time.

**Auxiliary:** the only mismatch is
`docs/…/paravoxia-creative-delta.run-profile.json` `a0b0ecdd…` → `605fb2ef…`, which
is exactly the recorded `producer-nonbinding-auxiliary-observation.json`. It is unused,
not a build input, **preserved**, and no fullverify was rerun for it. The other four
auxiliary hashes matched.

**Hardware / lock:** one headed browser, renderer
`ANGLE (NVIDIA Corporation, NVIDIA GB10/PCIe, OpenGL 4.5.0)` — no SwiftShader. An
**EXCLUSIVE `flock` was acquired by the invoking shell and inherited by node on fd 9**
of `/…/harness/output/.heavy.lock`; no other holder was present before or after, so
this was serial with all other GPU roles.

## Entry-harness evidence — inspected before GPU, neither defect present

- **Stale canvas rectangle.** *Absent.* This probe reads `ctl = await
  controlProbe(page)` **after** the `settled-grounded-body` wait and clicks the centre
  of that live rect. Measured: rect 1280×720, one ordinary click, pointer lock
  acquired, gate `pointer-lock-active-via-ordinary-click` **PASS**. **Not patched** —
  I did not patch by keyword.
- **Full-residual `commandedUnits` stall detector.** *Absent.* `walkTo` scores a stall
  on an **absolute measured step** (`step < 0.05u`) per **actually executed** pulse,
  never `commandedUnits` against 25 % of the full remaining distance. `planPulseMs`
  clamping cannot produce a false stall against that test. **Not patched.** Measured
  stalls this run: **0**.

## Attempt 1 — `short-1` (preserved, exit 2)

Stopped at `fixture-boot-seeds-no-short-completion`, **before any input**.

Causal evidence: the clean-fixture read landed at **+1953 ms**, before
`window.__paravoxiaCommonGround` published anything — `cgSnap` returned `null`
(beat/body/supported/anchors/survey all null) — and the predicate scored
"diagnostic not published yet" as an unclean fixture. The UX layer was already correct
at that instant (`ch13:survey:offer` / `W-7744 · offer a route`). **Harness fault, not
gameplay.** Retained in full at
`verifier/captures/arrival-common-short-runtime/short-1/` (nothing removed or
overwritten).

### The one bounded instrumentation correction (budget now spent)

`verifier/probes/arrival-common-short/short-survey-probe.mjs`
`03931214d21fe84219c0cd1b8fef9bbf3a7e4c54293787ca96fc831c9a9ffc4a` →
`82a49ba5787bcc113bf6d066e538df1876b214c612792c9413fb21008b796747`

Before the **byte-unchanged** `fixtureBootIsClean` gate, wait — bounded by the existing
`--ready-ms` budget, with **no input of any kind** — for the diagnostic to be published,
then read boot. Nothing is loosened: a fixture that actually boots with samples, a
tested prefix, an accepted class, a held/occupied witness, a tail revision or a survey
anchor still fails exactly as before. No game predicate, no global timeout increase, no
shared helper, no other file. `node --check`, the pure logic suite and the lane selftest
all re-ran at exit 0. No duplicate CPU suite was run.

## Attempt 2 — `short-2` (exit 0, 52 504 ms) — what physically happened

Fixture: `?story=ch13-survey&journeyprobe=1&debug=1` — a **labelled ch13-survey
fixture**, deep-linked, `movieRail: false`, clean boot verified.

Ordinary input only: four 700 ms calibration key holds, held WASD pulses, **one real
canvas click**, four authored `[F]` presses on shipped prompts. `autopilotPresent:
false`. No force-click, no `requestPointerLock`, no pose/store/camera/actor write, no
movie rescue.

| t | transition | measured |
|---|---|---|
| 11.4 s | calibration directional | W`[0,-1]` A`[-1,-0.007]` S`[0,1]` D`[1,0]`, 0.005029 u/ms |
| 26.5 s | leg to **W** `(-34,51.05,10)` | reached d=0.81, travelled 56.88 u |
| 28.1 s | `[F]` "Offer to demonstrate a route" | `ch13:survey:offer` → `:start`, phase `idle`→`awaiting-start`, +`anc.cg.repeated-measure`, +`anc.cg.demonstration-opened` |
| 30.7 s | leg to **S** `(-26,51.05,12)` | reached d=0.76 |
| 32.3 s | `[F]` "Begin recording your route" | → `ch13:survey:draw`, phase `drawing`, +`anc.cg.survey-started` |
| 33.2–36.8 s | **8 draw legs along z=12, x −26 → −42** | all reached, d 0.35–0.50 |
| 36.8 s | end of draw | runtime `samples 16`, `lengthUnits 15.2877`, `walkedUnits 15.6486` |
| 38.4 s | `[F]` "Offer the walked span" | phase `offered`, +`anc.cg.trace-drawn`, +`anc.cg.route-offered` |
| 41.6 s | **W-7744's real test** | phase `held`, hold `reference-occluded-survey-housing`, W leg `testing-span` at `(-26.3367, 50.9890, 11.3225)` |
| 44.3 s | leg to witness point | reached, radial **0.4979 u** (cylinder radius 1.25) |
| 45.9 s | `[F]` "Offer this end" | **new** offer (`witnessOffered` false→true), phase `testing`, +`anc.cg.witness-held` |
| 52.1 s | test completes | phase **`tested`**, **`acceptedClass: held-reference`**, `acceptedSamples 16`, +`anc.cg.route-tested`, +`anc.cg.reciprocal-reference`; objective → `ch13:common:reciprocal` |

### Accepted route geometry and class

Issued **SHORT**, actual **SHORT**, agrees. Straight span along constant **z = 12**,
x −26 → −42. Probe-walked **15.6485 u**; runtime `walkedUnits` **15.6486 u**;
deviation from the signed SHORT polyline **0.5002 u** versus **6.3953 u** from LONG.
This is the actual straight ~16-unit recorded path. **It is SHORT, and nothing here is
labelled LONG.** `mislabel: false`.

### Footing

**Footing was valid.** The hold W published was the named occlusion cause
`reference-occluded-survey-housing`, which the shipped predicate snapshot expects; it
was **not** `footing-invalid`. The tail-revision branch was therefore neither needed nor
exercised (`tailRevision` stayed 0), and no occupancy laundering of invalid footing
occurred or could occur. `testedPrefix` never advanced past 0 during the hold; on the
held reference the whole 16-sample span was accepted at once.

## The two failed gates — causal evidence, unresolved

**1. `the-reference-was-actually-held-throughout`** — probe-side **measurement-frame**
mismatch.

The radial term passes: 0.4979 u ≤ 1.25 u. The vertical term compares the **body centre**
y (`52.78897476196289`, constant for the entire run from spawn) against the **authored
ground pose** y (`51.05`); the residual **1.73897 u** exceeds the 0.6 u allowance. This
is the same body-centre-versus-foot frame gap already recorded for the earned lane. The
runtime's **own** occupancy judgement disagreed with the probe's: `witnessOccupied` was
true at every sample and at the completing tick (`occupiedThroughout: true`,
`anyVacant: false`), and the gate `arrived-inside-the-occupancy-cylinder` had **passed**
seconds earlier on the same 0.4979 u reading.

**2. `SHORT-completed-as-the-held-reference-class`** — probe-side **unit** mismatch.

`shortCompletionVerdict` compares `acceptedSamples` (**16** — the runtime free-recorder's
own sample count, which is exactly what it recorded while drawing) against
`drawn.sampleCount` (**8** — the number of waypoint **legs** this probe walked after S).
Different quantities: `CG_ROUTE_SHORT` has 9 vertices, hence 8 legs, while the free
recorder sampled 16 points over the 15.65 walked units. The runtime is internally
consistent: 16 recorded, 16 accepted. **Every other clause of the verdict passed** —
`anc.cg.route-tested` fired, phase `== 'tested'`, `acceptedClass == 'held-reference'`,
`drawn.actual == 'SHORT'`.

**Not repaired.** These are the acceptance criterion of the claim under test and my one
bounded correction is spent; relaxing them would launder the claim. Referred to the
producer, unresolved.

## Trials

Three trials were requested **conditional on the first SHORT really completing**. It did
not complete by the signed predicate, so the two additional cold runs were **withheld**:
the failure is deterministic geometry and counting in already-retained bytes, and a
repeat would be an identical failed capture.

## Cleanup — verified post-finally

`short-2` cleanup receipt: `phase: post-finally`, `state: stopped`,
`cleanupCompleted: true`, `sessionStopInvocations: 1`, `cleanupError: null`,
`stopsRootPreview: false`, `killsProcesses: false`. Closing receipt `ok: true`.
Independently after the run: **no ms-playwright renderer from this lane survives** (the
two surviving `chrome_crashpad_handler` PIDs 3583125/3583127 pre-date this role), **no
`short-survey-probe` node process**, **heavy lock free**, and the root preview is
untouched and still serving HTTP 200 (daemon PID 1802787). No abandoned browser or probe.

## Source unchanged

99/99 source files rehashed after the run: **0 drift**. Contract still
`5ef85a32…`. No game, canon, contract, manifest, gate or shared probe file was edited.
The single edited file is my owned
`verifier/probes/arrival-common-short/short-survey-probe.mjs`.

## Independent unknowns

- `cgSnap` reads `bodyPose`, but `snapStep` does not retain it, so the projected **foot**
  pose at the witness stand point was **not captured**; whether a foot-frame vertical
  falls inside 0.6 u is unmeasured here.
- Whether the shipped runtime's own occupancy test uses a foot frame, is radial-only, or
  uses a different vertical allowance was **not** read from source by this lane.
- The reference **leave/re-enter (witness-return)** contingency was **not** exercised or
  measured — not invented as completed.
- Only **one** physical trial exists; run-to-run variance is unmeasured.
- No FPS, screenshot-strip, audio, score, continuity, variant or reset-matrix
  measurement was in scope or performed.
- `supported` was false on all four calibration holds (spawn settling); the
  `settled-grounded-body` gate passed separately. Not investigated.

**Blockade:** none external. The lane is stopped by two of its own verdict predicates,
which only the producer may authorize correcting.

## Artifacts

- `verifier/captures/arrival-common-short-runtime/short-1/` (preserved failed attempt)
- `verifier/captures/arrival-common-short-runtime/short-2/` — `summary.json`
  `c3effdc5a7cf0bc735adfe932e419e8ad19f3240bafe8576adac0b137feceb0d`, `summary.sha256`,
  `trace.ndjson`, `preflight.json`, `source-snapshot/`, 11 hashed frames
- `logs/arrival-common-short-runtime/` — lock receipts, stdout/stderr per attempt,
  `probe-hash-before-correction.txt`, `probe-hash-after-correction.txt`
- `arrival-common-short-runtime-report.json`
