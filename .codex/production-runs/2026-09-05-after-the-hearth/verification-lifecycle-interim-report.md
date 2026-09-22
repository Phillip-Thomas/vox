# Interim verification checkpoint — Common Ground (ch13)

**This is an interim failure checkpoint, not final chapter verification.** It is
not a scorecard, not a creative judgement, and not a publication decision.
Machine-readable twin: `verification-lifecycle-interim-report.json`.

- Role: independent story-verifier. **No game source was edited.**
- Contract: scene-v2, sha256 `4dbf722b308b92b170313285854e3c9c2abac853b3407bf3e0f4efccfddff88e`
- Source manifest: `58f275f6130914f878942774fd4b4c6ce74327755c33ae257965a9dbeed40e70`
  — all **96 files independently rehashed, 0 mismatch, 0 missing**
- Preview: root-owned `http://127.0.0.1:43617/`, index sha256
  `1f327268…c05b823a`, bundle `/assets/index-CVcXc2R8.js`
  (`c34f1850…c36fca9d9`), verified to contain the repair identifier
  `railTraversal` and the exact signed marker labels
- Renderer: `ANGLE (NVIDIA Corporation, NVIDIA GB10/PCIe, OpenGL 4.5.0)` —
  **real hardware, headed**, each probe under a non-blocking `flock` on the
  shared heavy lock, released on exit

## Verdict

**FAIL (interim).** The repaired build passes every static gate and the ch13-home
interaction repair genuinely holds — but two blocking runtime defects stop the
chapter before any route traversal can be measured at all.

## What passes

| gate | result |
| --- | --- |
| `npm --prefix main run verify` | **exit 0** — 348 test files, **3026 tests**, build ok |
| `creative:gate --phase implementation` | exit 0 — **1708 checks** |
| `story:ux:check` | exit 0 — 9 files / 94 tests |
| changed-source tests (`commonGround*`, `autopilot`) | exit 0 — 13 files / 212 tests |
| six registry/journey/authority/creative/accept smokes | all exit 0 |

Static and CPU only. It proves nothing about rendering, traversal, hearing,
hardware or the movie bridge — and both blockers below are invisible to it.

**CG-IMPL-004 is not reproducible.** On hardware, `ch13:home:review` entered at
7 ms with the exact signed label and work order, was performed through the
**shared** performer (`interactionTrace` source `resolver-perform`, outcome
`returned`, prompt cleared in 0 ms), `ch13:home:choose-return` followed at
2165 ms, and the beat advanced at 2777 ms — 0 nudges, 0 page errors. The
pre-repair capture sat on that same objective for the full 300 s.

Also confirmed: every objective observed carried its **exact** signed marker
label and work order, including the scene-v2 *preparation* conditional copy for
`ch13:common:reciprocal` verbatim; and when Terra's body was 0.38 units from
W-7744 he **held** rather than displacing her (0 teleports), consistent with the
signed rule — observed in a synthetic state, so an observation, not proof.

## Blocker 1 — VF-DEEPLINK-1: the chapter boots aboard the ship

`?story=ch13-survey&movie=1` boots the player **inside the landed Kestrel** and
can never recover. 243.2 s of exactly zero displacement: body frozen at
`[8, 53.85, -6]`, `walkedPathUnits 0.000` over 2237 samples, W-7744 mounted 44 m
away, `spaceFlight {phase:'surface', controlMode:'flight'}` in **every** sample
(the module default is `fps`). The rail is alive and asking correctly
(`routeAction 'walk'`, clock 3.1 → 238.3 s) — on-foot walk simply does nothing in
flight control mode. 0 nudges, 0 page errors, 0 acts attempted.
`post/survey-movie-1/0039-root-checkpoint.png` is shot from inside the cockpit;
the debug HUD reads `Ship: landed`, `Flight: surface / flight`.

Source candidate (read-only): `commonGroundRailPlan()` has an `exit-ship` branch
only under `case 'ch13-return'`; the `ch13-survey` and `ch13-common` cases never
inspect `controlMode`.

## Blocker 2 — VF-RAIL-2: she stands on the mark she cannot reach

With an explicitly labelled disembark fixture applied, the chapter came alive —
`anc.cg.repeated-measure` at 3.3 s, the offer performed,
`anc.cg.demonstration-opened` at 13.8 s, **58.6 real units walked**. Then it
stopped for the remaining ~286 s at `ch13:survey:start`.

| quantity | value |
| --- | --- |
| player body **centre** y | 52.79–52.80 in all 2643 samples |
| authored `CG_POSES.S` | `(-26, 51.05, 12)` |
| min 3D distance, **centre** → S | **1.745** (horizontal 0.13) |
| derived **feet** y (centre − 1.3 − 0.5) | **50.99** — within **0.06** of the authored ground plane |
| distance, **feet** → S | **0.143** |
| rail gate | `CG_RAIL_START_AIM 0.35 + CG_RAIL_ROUTE_ARRIVE 0.35 = 0.70` |
| resolver reach | `CG_POINT_REACH 2.0` — satisfied by 1.745 with 0.255 margin, which is why the prompt shows |
| time standing on the mark | 261 of 354 pose-ledger entries (~4.5 min) |
| live prompt throughout | `F | Begin recording your route` |
| acts performed | **0**, with 0 teleport nudges |

`post/survey-diag-1/0038-strip-ch13-survey.png` shows the marker reading
**`survey start · begin a route · 0m`** with the F prompt on screen.

**Reconciled against the real body, as root asked — and it sharpens rather than
dissolves the finding.** `getPlayerWorldPosition()` returns the Rapier capsule
*centre*; `EfficientPlayer.tsx:1525` itself derives feet as centre − half-height.
Her feet are on the authored plane. The body *has* arrived; only the comparison
frame disagrees. **This is a coordinate-frame (centre-vs-feet / vertical
inclusion) mismatch, not a too-tight radius.** How to reconcile it is the
integrator's decision — widening radii would mask it and could relax genuine
physical clearance rules.

Why 3026 tests miss it: `commonGroundDirector.test.ts:99` `standAt()` places the
world position at the authored pose y — **a body of zero height** — so every rail
regression runs at vertical offset 0. Gates below the live 1.745 offset:
`CG_RAIL_ROUTE_ARRIVE 0.35`, `CG_RAIL_POSE_ARRIVE 0.6` (offer-span at E),
`CG_RAIL_START_AIM+ARRIVE 0.70`, `CG_RAIL_CORNER_OVERSHOOT 0.6`.

## Open anomaly for the same pass — VF-ANCHOR-OBS-1 (revised)

I **withdraw** my earlier inference that all four ch13-home anchors are provable
only in a continuous journey; Score's interpretation rejects that reading and I
accept the correction. Only `anc.cg.cell-installed` needs the live install
boundary. So the fact that deep-linked ch13-home performed both real F acts and
set both milestones while `activationHistoryAnchorIds` stayed empty in-loop is an
**anomaly**, not expected behaviour.

Source candidates, unconfirmed: `noteAnchor()` latches `runtime.firedAnchors`
*before* calling `activateSignedSceneAnchorById` and discards its boolean, so a
rejected activation is spent locally and never retried; and `activateAnchor()`
refuses an anchor while an earlier pending ordered same-beat anchor is
unactivated. Not proven — I did not instrument the return value. **No audibility
claim:** nothing was listened to, and Score rightly notes local score dispatch
may continue despite a rejected AV activation.

Separately, the empty `anchorLedger` in `home-movie-2` is a capture-window
artefact, not missing instrumentation: the loop exited on its `--until-beat`
predicate at 2777 ms and `anc.cg.hatch-boarded` activated after that. Anchor
capture demonstrably works elsewhere.

## What was NOT measured — and is therefore NOT claimed

- **The CG-IMPL-005 ordered-cursor repair in a browser.** No route traversal was
  ever entered. Retarget-to-visited-start, corner shortcuts, the ordered 18
  units, long-vs-short route classes and first-try-legal long success: **all
  unmeasured**.
- **Manual-corner deviation and recovery — not reached.** The
  `commonGroundRoute.ts:444-479` projection risk stays a source/test risk,
  deliberately kept separate from the two measured blockers.
- Three cold focused journeys; both route classes; the continuous
  station→home→ch13 bridge; the full story movie from the beginning.
- The 28 anchors as a set; the 17+2 objective lifecycles end to end; the 8-trigger
  reset matrix; mobile / reduced-motion / lowest-tier; pause / focus / quit /
  deep-link / replay.
- Any performance, fps, draw-call, memory or timing figure.
- Any score, cue, spacing or release behaviour. **Nothing was listened to.**
- The headed `chapter:evidence` bundle for chapter13.
- The typed final artifacts (`verification-report`,
  `objective-lifecycle-evidence`, `chapter-journey-evidence`,
  `raw-audiovisual-evidence`, `evidence-registry`) are **deliberately not
  authored**: filling their schemas now would mean writing booleans without
  measurements.

## Prerequisite fixtures (labelled, and not journey evidence)

`post/survey-diag-1` and `post/common-diag-1` each pressed the shipped ordinary
disembark key once (`KeyF`, `App.tsx:1516-1525`), only because the entry had
booted aboard the ship, recorded with before/after state in
`summary.prerequisiteFixtures`. It grants no milestone, position, progress or
route credit. **Those two runs are diagnostics — not cold journeys, not
continuous proof, and are not reported as either.**

## Integrity

No game source edited. No threshold or predicate changed. No teleport, progress
grant or timeout-as-rescue anywhere. No unrun check marked passed. No creative
judgement offered. Pre-repair captures and `verifier/logs/verify.log` preserved
untouched; all new evidence lives under `verifier/captures/post/` and
`verifier/logs/post-repair/`. No server was started or orphaned by this role; the
root-owned preview at `http://127.0.0.1:43617/` is root's and remains running.

Raw media inventories with per-file sha256 are in the JSON twin, kept separate
from this prose so a blind viewer can receive only the media.
