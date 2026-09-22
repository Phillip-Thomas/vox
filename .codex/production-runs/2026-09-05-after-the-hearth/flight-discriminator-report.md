# ch13-return flight discriminator — one bounded 90 s live capture

Recorded 2026-09-06T15:19Z. Read-only flight-discriminator role, opus.
**Not** an acceptance, not a chapter verification, not a defect finding, not a
repair authorization. Companion: `flight-discriminator-report.json`.

Authority: `flight-discriminator-control.json` only. Nothing in `main/`, the
contract, `defects.json`, the existing capture tree, or any other role's
artifacts was written. No build, no dev server, no preview of my own.

All 98 manifest files rehashed **before** (15:14:00.818Z) and **after**
(15:18:30.772Z): 98/98 match, aggregate
`a2f8a691…04ce7f6` identical both times. Root preview index re-hashed before
(15:13:26Z) and after (15:18:30Z): `ca7b448b…dedc71` both times; daemon 1290230
still running, never touched.

One browser session, headed, renderer
`ANGLE (NVIDIA Corporation, NVIDIA GB10/PCIe, OpenGL 4.5.0)` — a software
renderer would have been refused. Exclusive `flock` on
`/home/thomasphillip/Projects/Paraform/harness/output/.heavy.lock` held
15:15:20.017Z → 15:16:52.510Z, uncontended, never bypassed. One capture of the
two authorized; the second was not needed.

Entry: `http://127.0.0.1:38803/?story=ch13-return&journeyprobe=1&debug=1&movie=1`
— identical fixture label to the earned-1/earned-2 lanes. Shipped rail only: no
teleports, no nudges, no progression grants, no forced landing, no camera
override. 340 samples at 250 ms, streamed live to
`logs/flight-discriminator/telemetry.jsonl`.

## Answer

**The ch13-return crossing is flown correctly and then undone. It is a
37.21-second loop, not a stall and not a speed budget.**

Origin (slot 0) centre is `[0,0,0]`, so celestial centre distance is
`|systemFlight.pose.position|` read straight off the shipped journey bridge.

| cycle | starts at | deepest centre distance | at | reset at | activationEpoch |
|---|---|---|---|---|---|
| 1 | 4 123 ms | **181.23** | 39 840 ms | 40 130 ms | 3 → **5** |
| 2 | 41 090 ms | **169.09** | 77 081 ms | 77 340 ms | 6 → **8** |

Each cycle the ship leaves the hearth pad at centre distance **2 736.8**, thrusts
inward continuously (peak speed **102.84**), closes ~2 568 of the ~2 737 units,
and passes **inside the 185-unit activation envelope**. Then, in a single step
shorter than one 250 ms sample:

```
77 081 ms  d=169.09  spd=55.00  local_space  deep_space  epoch 6  apid=-1,-1:p1  target=-1,-1
77 340 ms  d=2736.67 spd= 4.04  atmosphere   descent     epoch 8  apid=-1,-1:p1  target=null
                       ^ pose replaced by the departure boarding pad [2187.81,-58.50,-1642.99]
```

`systemFlight.activePlanetId` is `'-1,-1:p1'` in **340 of 340** samples. The
Origin value `'-1,-1'` was never observed. Therefore
`onOrigin()` (`commonGroundDirector.ts:804-806`) never flips, the ch13 rail can
never leave `fly` (`:2270`), and `tickReturn`'s milestone / anchor / advance
block (`:862-869`) is never reached. `story:ch13-origin-landed` stayed false.

## Candidates: what this refutes

- **(A) "the ship parks on the unready ~300 approach shell" — REFUTED.**
  Measured centre distance reached 181.23 and 169.09. Measured speeds fit the
  **ready** corridor law exactly and are impossible under the unready law:

  | at ms | d | measured speed | unready limit | ready limit |
  |---|---|---|---|---|
  | 74 548 | 310.30 | 102.64 | 6.70 | 117.5 |
  | 76 575 | 197.19 | 61.59 | 0.00 | **61.09** |
  | 76 828 | 182.77 | **55.00** | 0.00 | **55.00** |
  | 77 081 | 169.09 | **55.00** | 0.00 | **55.00** |

  This is derived arithmetic on captured pose/velocity against frozen source
  constants, not a live read of the flag — but the fit is exact and the unready
  branch is arithmetically excluded.
- **(B) "aim-cone flicker starves `targetReady`" — REFUTED as the operative
  cause.** Same evidence. `systemFlight.target` does flap `-1,-1` → `null`, but
  it flaps **at** the reset, as part of it, not before it.
- **(C) "the ship never moved" — REFUTED.** Continuous inward velocity all run.
- **(D) the earlier marker first/last CLOSING heuristic — superseded.** The DOM
  marker oscillation (2730 → 50 → 2000+) was an artifact of this reset cycle;
  in the celestial frame each cycle is monotone inward.
- **(E) the same-system planet handoff — IMPLICATED, not proven in detail.** At
  the envelope the boundary emits exactly the `commitSystemPlanetHandoff`
  signature (`locationMode:'atmosphere'`, `target:null`, epoch advanced) yet
  `activePlanetId` ends unchanged and the canonical pose is replaced by the
  departure pad. Net effect: the crossing is undone and restarted.

The source auditor's "unready 300-unit shell" candidate was a reasonable source
inference and it does not fit these cycles. It is refuted by measurement.

## Precise source handoff implicated

`components/SystemTravelDriver.tsx:108-260` → `state/systemFlight.ts`
(`commitSystemPlanetHandoff` / `setActiveSystemPlanet`). Two `activationEpoch`
increments land inside one sub-260 ms boundary and the world returns to
`-1,-1:p1` with the departure pose. **This report does not assert which module
issues the second increment.** No repair is proposed or authorized.

## Remaining unknown

- The intermediate epoch (4 and 7) was never sampled: the whole two-step
  boundary fits inside one 250 ms gap (259 ms / 290 ms). A transient
  `activePlanetId === '-1,-1'` inside that gap **cannot be excluded**.
- Which mutator produces the second increment (`setActiveSystemPlanet`,
  `commitSystemBodyTarget`, `clearSystemTarget`, or the interstellar reset) is
  undetermined from window-exposed state. The smallest next read is the already
  shipped `subscribeSystemPlanetHandoffCommits` receipt channel, which is not on
  `window` today.
- `getSystemTravelAssistTarget().ready`, `SystemTravelDriver.targetReady`, the
  6° aim-cone state, `getAutopilotFlightDirective()`, and
  `__paravoxiaShipProbe.getFeedback().approachLimited` (bridge absent in
  338/340 samples) were **not** read. Recorded as unavailable; nothing was
  injected to fake them.

## Observed, non-flight

- Objective ladder: `ch13:return:board` @1 813 ms (marker `Kestrel hatch ·
  board`) → `ch13:return:launch` @2 647 ms (`Kestrel controls · lift`) →
  `ch13:return:origin` @4 123 ms (`Origin · audit site`), health `ready` for all
  335 later samples; never replaced, never cleared, never `missing-marker`.
- HUD world identity stable all run: coordinate `-1,-1:p1`, seed `1600321158`.
- Page `visible` and focused in 340/340 samples.
- `__autopilot.teleportNudgesTotal` 0; `routeAction` `walk` throughout. The
  seated capsule body is still **by design** and is not used as evidence here.
- `verifier/captures/flight-discriminator/0150-phase.png` and `999-final.png`
  are near-white full-screen frames taken at/after a reset boundary. Reported as
  a raw observation of the loop, not a defect verdict.

## Probe limitation, explicitly not a game failure

The probe process exited 1. Cause: this probe's own log `WriteStream` was ended
before the last `say()` in its `finally` (`ERR_STREAM_WRITE_AFTER_END`). It
fired **after** the 90 126 ms capture completed, after `run.json` was written and
after the owned browser was stopped. Telemetry is complete (340 samples). The
bounded window elapsing is a probe stop, not a landing failure, and no long run
was repeated to change the outcome.

## Artifacts

- `verifier/probes/flight-discriminator/flight-discriminator-probe.mjs`
- `verifier/probes/flight-discriminator/rehash.py`
- `logs/flight-discriminator/telemetry.jsonl` (340 live samples)
- `logs/flight-discriminator/probe.log`, `run-console.log`
- `logs/flight-discriminator/source-rehash-{before,after}.json`
- `verifier/captures/flight-discriminator/run.json` + 13 frames

Out of scope by commission: chapter acceptance, the full ch13 run, the final
flight, any Continue attempt, manual-input lanes (concurrent role), creative
acceptance, any budget extension.
