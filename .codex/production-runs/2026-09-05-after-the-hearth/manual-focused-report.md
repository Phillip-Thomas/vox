# Manual-focused verification — ch13-survey (bounded role)

writtenAt (actual clock): 2026-09-06T15:29Z · role: manual-focused verifier · **not** chapter acceptance, not a creative verdict, not a defect closure.

Source frozen and rehashed **before and after**: 98/98 implementation-source-manifest files match,
manifest SHA256 `1a50c19f26ef11d17361810feb4ab7b872b215da67156b5db414abd85b8a61e8`
(`logs/manual-focused/rehash-before.json` 15:11:56Z, `rehash-after.json` 15:25:46Z, node exit 0 both).
Root preview `http://127.0.0.1:38803/` served index `ca7b448b72cc17407fc843afffe4808df7fc12ea5203a47b77ceece1c6dedc71`
(matches ownership); root daemon pid 1290230 untouched, never started or stopped by this role.
Hardware every capture: **ANGLE (NVIDIA Corporation, NVIDIA GB10/PCIe, OpenGL 4.5.0), headed** — no software fallback.
All six sessions ran under an exclusive `flock` on the shared heavy lock, one owned browser at a time; every
`summary.json .cleanup` records `state=stopped, cleanupCompleted=true, stopsRootPreview=false`.

## VERDICT

**Ordinary manual play at ch13-survey works on this source, and the whole survey — including an early
corner deviation with an ordinary return to the frontier, and W-7744's actual route test — completes.**
The prior manual failures were a harness bug in this repo's probes, **not** a game input defect.

## Root cause of the prior invalid manual attempts

`main/src/components/EfficientPlayer.tsx:1565` gates all movement on
`active = (controlsActive || touch || autopilot) && !boardingLock`, and `controlsActive` follows
**pointer lock**, which `main/src/components/CameraControls.tsx:100-114` grants only for a real click whose
target is the canvas. Manual-1..5 never clicked, so the shipped controller discarded every key they pressed;
their residual displacement was spawn settling. One real canvas click fixed it (lock acquired in 6 ms).

## Measurements

| step | measurement | value |
|---|---|---|
| settle before any key | 8-sample 3D spread | 0.00297 u (supported=true, worldBound=true, body [8, 52.789, -6]) |
| KeyW held 1.5 s | horizontal / vertical | **7.722 u** / -0.776 u |
| KeyD held 1.5 s | horizontal | **7.816 u**, 90.0° from KeyW |
| key-up | coast in 0.9 s | 0.053 u (KeyW), 0.027 u (KeyD) |
| key receipts | window-boundary hotkeys | 0 → 1 → 2, codes KeyW/KeyD |
| walk to W | travelled / arrival | 55.96 u / 1.17 u, 15.2 s |
| F at W | objective | `ch13:survey:offer` → `ch13:survey:start`, +`anc.cg.demonstration-opened` |
| walk to S, F | anchor | `anc.cg.survey-started`, survey phase `drawing` |
| **early corner deviation** | off-leg offset (KeyA, waypoint 2) | **4.36 u** |
| return to frontier | ordinary movement, no new F | reached within **0.236 u** |
| earned prefix across deviation | samples / lengthUnits | 4 → 11 and 2.672 → 9.958 u (monotonic, nothing discarded) |
| drawing resumed | at offer | 42 samples, 39.27 recorded units, 42.79 walked |
| F at survey end | objective | `ch13:survey:offer-span` → `ch13:survey:test` |
| hold observed | reason | **`reference-occluded-survey-housing`** (not body-clearance) |
| authored answer | objective / prompt | `ch13:survey:witness` — “Witness point · hold this end / Stand at the marked reference. [F] Offer this end, then remain here while W-7744 tests the span.” |
| witness point | walked arrival | 0.673 u of CG_POSES.W (-34, 51.05, 10) |
| W's test | worker travel / anchor | **32.10 u**, `witnessOffered/​witnessOccupied=true`, acceptedSamples 42, **`anc.cg.route-tested`** at +22.9 s |
| after test | objective | `ch13:common:reciprocal` — “Far reference · check my route” |

Contrast (witness-1): standing merely **clear** of the span on observed reachable ground (1.03 u clearance,
a position this body had actually walked — not an arithmetic `E.z-3`/`E.z-4` label) did **not** release the hold
across a 76.3 s watch; W travelled only 2.70 u. The release came from the **authored witness verb**, not clearance.

## Captures (all in `verifier/captures/manual-focused/`)

| capture | verdict | note |
|---|---|---|
| `input-gate-1` | INPUT-PROVEN | step 2 liveness, 13.6 s |
| `route-1` | W-REACHED | first asserted manual walk to W |
| `corner-1` | STOPPED (honest) | no rail target is published in the manual lane; walk targets re-derived from frozen source poses |
| `corner-2` | CORNER-RECOVERY-OBSERVED | full survey draw + deviation + return + offer |
| `witness-1` | CORNER-RECOVERY-OBSERVED, route **not** tested | stand-clear-only contrast |
| `witness-2` | CORNER-RECOVERY-OBSERVED + `anc.cg.route-tested` | authored witness verb completes the test |

Each capture carries `summary.json` + `summary.sha256`, `trace.ndjson`, `source-snapshot/`, and stamped PNGs
(`at-W`, `at-S`, `deviated-off-route`, `after-return-to-frontier`, `at-E-after-draw`, `at-witness-point`,
`after-witness-F`, `witness-watch-end`). Frames render the world and HUD; no blank/black frames were seen.

## Limitations (explicitly unattempted, not proved impossible)

- Beat fixture only (`?story=ch13-survey`): **not** full-story, station continuity, ch13-return flight/landing, or earned-return Continue.
- The 18-unit common route E→C and both reciprocal traversals were **not** walked; CG-IMPL-009's corner question
  applies to the **common** route and remains unmeasured. This run proves corner recovery inside the **survey** drawing.
- S/E/W and the long route were read from frozen source as walk targets. Nothing was granted, but this is not a
  no-private-knowledge first-time-player test of contract objective 13.
- `debug=1` was needed for the CG snapshot hook, so debug panels appear in frames — probe fixture, not a defect.
- No audio judged, no fps/AV/variant/reset-matrix work, no source, build, contract or defect edits, no full verify.

## Minimal next step

Extend this same guarded harness past `anc.cg.reciprocal-reference` through the common passage and the two
reciprocal traversals, deviating once mid-passage, to measure the CG-IMPL-009 question in ordinary manual play.
