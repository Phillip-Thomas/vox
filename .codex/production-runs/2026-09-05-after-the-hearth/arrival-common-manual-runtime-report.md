# Manual COMMON runtime — arrival-common-manual

**Machine-readable:** `arrival-common-manual-runtime-report.json`

## Verdict

Both commissioned lanes were physically run in separate cold headed GB10 sessions
under the inherited exclusive fd-9 flock. **Neither proved COMMON.**

- **Reference lane (reference-3, valid):** earned survey → W [F] → S [F] → 18 draw
  legs → stand-clear → witness → E, then **failed the strict original-plane
  crossing at COMMON corner 1** (`[-42, 51.05, 14]`) with the body **unsupported**
  and descending from pose y 54.17 to 51.35 while z stayed frozen at 14.140832.
- **Deviation lane (deviation-1, valid):** made the intended early turn 0.246 u
  before the original z=16 plane, proved the far-C excursion bought nothing,
  physically returned to the frontier and traversed the omitted ground, crossed
  **all nine ordered COMMON frontiers**, and still ended with **6 of 18 credited
  units**, no final anchors and the objective **not** cleared.

No chapter, Continue, full-story, variant, audio, taste or defect closure is
claimed. This is instrumented manual play from a labelled `ch13-survey` fixture
with route waypoints read from frozen source; it cannot support a first-time
usability claim.

## Binding (verified live before every browser)

| Item | Value |
|---|---|
| URL | `http://127.0.0.1:34413/` (root-owned; untouched) |
| index.html sha256 | `6c8c378b…b207` (200) — matches `verifier-control.currentIndexSha256` |
| bundle `/assets/index-BiDWGouH.js` | `efc87feb…a068` (200) — matches preview-ownership |
| title | `Paravoxia` |
| renderer | `ANGLE (NVIDIA Corporation, NVIDIA GB10/PCIe, OpenGL 4.5.0)`, headed |
| source manifest | `6ef957c3…ee5d6` before **and** after; all **99** paths rehashed, **0** mismatches |
| contract | scene-v3 `5ef85a32…ec54` |
| heavy lock | `/home/thomasphillip/Projects/Paraform/harness/output/.heavy.lock`, fd 9, owned=true, contention probe `refused (lock is live)` |

**Auxiliary observation, reported separately as directed:** the delta run-profile
`docs/…/paravoxia-creative-delta.run-profile.json` hashes `605fb2ef…e828` live,
which equals the producer's `observedHash`. That path is **not** among the 99
paths of the current manifest — the recorded/observed mismatch belongs to the old
manifest. No full verify was rerun.

## Owned instrumentation (not game repair)

1. **Authorised re-pin.** `cgContract.pinned.mjs` still pinned scene-v2. Updated in
   my private copy only: `5f447ebd…c551` → `5f3dbc2e…83a5`; shared original
   `verifier/probes/lib/cgContract.mjs` remains `5f447ebd…c551`. Pin manifest
   updated and a new owned test asserts the constant equals both the
   `scene-contract.json` bytes and `verification-ready.contractSha256`. The probe
   never calls `loadContract()`, so the constant was inert for these measurements.
2. **The one authorised bounded harness correction.** reference-1 measured its own
   defect: every ordinary click was aimed at a canvas rect captured *before* the
   attempt loop, and that rect was the **unsized HTML default 300×150**, so the
   clicks landed at (150,75) and the browser reported their target as a `<p>`.
   Correction: re-measure the canvas rect immediately before each click, refuse an
   implausible rect rather than click blind, and record the live element stack at
   the intended point. Still one ordinary trusted click per attempt — no
   `requestPointerLock`, no synthetic/forced click, no handler patch, no focus or
   policy edit; the pointer-lock gate is byte-unchanged. CPU tests **119/119**.

**A second measured harness defect was left in place, not patched.** `walkTo`
scores a stall by comparing the achieved step against 25 % of
`pulse.commandedUnits`, but `planPulseMs` reports `commandedUnits` as the full
desired distance even when the pulse is clamped to `maxMs`; at the live
calibration a 400 ms ceiling can only deliver ~1.99 u, so every pulse on a leg
longer than ~8 u is scored a stall and the leg dies after 10 pulses. reference-2's
trace shows the body moving ~1.985 u per pulse with distance falling monotonically
43.25 → 27.48, supported throughout, zero oscillation flips — so this is the
harness, not the game. My one correction was already spent, so reference-3 and
deviation-1 instead used the **existing CLI budget** `--pulse-max-ms 2000` (an
ordinary longer held key). No second source edit was made.

## Runs

| Run | Mode | Valid | Node exit | Stopped at | Cleanup |
|---|---|---|---|---|---|
| reference-1 | reference | no (own click aim) | 2 | `pointer-lock-and-focus` | stopped, no error |
| reference-2 | reference | no (own false stall) | 2 | `leg-to-W-offer` | stopped, no error |
| reference-3 | reference | **yes** | 2 | `plane-common-1` | stopped, no error |
| deviation-1 | deviation | **yes** | 2 | `terra-full-eighteen-unit-ordered-passage` | stopped, no error |

Role shell exit was 0 for all four (it writes the receipt); the probe's own
non-zero exit is the measurement outcome and is reported separately.

### Entry (input boundary)

- reference-1: 3 ordinary trusted clicks, `pointerType` mouse,
  `sourceCapabilities.firesTouchEvents` false, `userActivation` active, hasFocus
  true, activeElement body, **0** `pointerlockchange`, **0** `pointerlockerror`,
  0 console errors, 0 page errors — and the browser reported the click **target as
  a `<p>`**. No movement test was performed, so nothing is claimed about keys, and
  no OS/browser cause is claimed.
- reference-2, reference-3, deviation-1: **one** ordinary trusted click at the live
  canvas centre (640,360) took pointer lock on **attempt 1**
  (`pointerLockElement === canvas`, 1 `pointerlockchange`, 0 `pointerlockerror`).

### reference-3 — proof boundary

Reached: W (`ch13:survey:offer`, "F | Offer to demonstrate a route"), S
(`ch13:survey:start`, "F | Begin recording your route"), draw-0…draw-17 all
reached, stand-clear at W, witness point, E common start; anchors
`repeated-measure`, `demonstration-opened`, `survey-started`.

Failure, raw: corner 1 plane `point [-42,51.05,14] normal [0,1] from [-42,51.05,12]`;
before-sample offset −2.381 at pose y 54.17; end pose `[-41.843, 51.353, 14.1408]`;
`maxOffsetObserved` 0.1408; `supportedAtEnd` **false**; `terraUnitsAtEnd` 0; status
`oscillating` (4 flips, improvement 0.013). Across 8 plane-step pulses z never
changed while the body fell. **Raw observation only** — the body was above the
nominal route height (51.05) and descending; no collision mechanism, terrain cause
or defect is claimed.

### deviation-1 — proof boundary

- Early turn: intended `[-42,51.05,15.82]`, achieved pose z 15.7542, signed offset
  to the original z=16 plane **−0.2458** (min shortfall 0.02) → the intended
  deviation was **physically achieved**, credit stalled at **3.754**.
- Far C excursion bought nothing (4.000). Returned to the frontier by ordinary
  movement; omitted ground actually traversed (4.008); earned prefix retained; no
  extra F, no reset.
- All nine ordered frontiers crossed, but credited units were 2.014 → 4.008 → **6**
  and then **stayed at 6** for frontiers 4…9. Final credit **6 / 18**;
  `comparisonProved` false; physical arrival at C true; live support at arrival
  true; reference held throughout; min body clearance 6.839 u at W and 1.602 u
  minimum during the passage (required 1).
- Anchors at stop: `repeated-measure, demonstration-opened, survey-started,
  trace-drawn, route-offered, specific-hold, witness-held, route-tested,
  reciprocal-reference`. The reciprocal-crossed and completion/hand-back anchors
  did **not** fire and the objective was **not** cleared.
- Raw visible guidance at stop (beat `ch13-common`, health `ready`):
  `CURRENT OBJECTIVE | Far reference · check my route | W-7744 is holding the
  reference. | Walk the guide line to check your route from this end.`

### Variance

reference-3 failed COMMON corner 1; deviation-1 crossed the same corner and every
later frontier. Two cold sessions on one build, opposite results at that corner.
Reported as measured variance; no cause claimed.

### Not met

Real T `[F]` + occupancy never reached; W 18/18 never observed (best 6/18); final
anchors and objective clear never observed. No endpoint pumping was credited and
no safe-footprint refusal was forced. No later F was pressed after a failed
prerequisite. No pose, velocity, anchor or store writes; no milestone grants; no
fixture-seeded final state.

## Cleanup

Four post-finally receipts, all `state: stopped`, `cleanupCompleted: true`,
`cleanupError: null`, `stopsRootPreview: false`. **Zero abandoned browsers.** No
process control, no software/headless/foreign-window use. Every attempted capture
directory (including the two invalidated ones) is preserved; nothing was removed.
