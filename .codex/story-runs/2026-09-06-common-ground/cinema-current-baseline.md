# Cinematography — current software baseline

Inspected 2026-09-06. Read-only production grounding, not a treatment, scene-layout signature or rendered-quality approval. I viewed all four scene PNGs and their four HUD counterparts with `view_image`, and read the capture/source manifests, entry/exit state and current first-pass geometry report. No capture, runtime, build or GPU work was performed for this review.

The frames ground existing shore projection, foreground occlusion and HUD placement. They do **not** establish the proposed worker/reference/bend composition, both route classes, or restored-hearth staging. The source geometry pass establishes a dry short path under its stated assumptions; a longer continuously usable reference path remains unresolved. The commissioned reference-aware second pass was still underway when this review was written; its unfinished stream is not evidence used here.

## Evidence and provenance

All paths below are relative to this run. The baseline capture ran from `2026-09-06T04:52:52.490Z` to `04:58:51.428Z`. `evidence/software-baseline/baseline-report.json` records `fail-software`, two frames per chapter, headless SwiftShader, actual tier `swiftshader-low`, 1280×720 and nondeterministic wall-since-settle timing. The requested `HIGH` profile does not make these hardware/high-tier captures. The report was still labeled `software-diagnostic-captured-awaiting-frame-inspection`; this document records my inspection without rewriting that report or another reviewer's disposition.

`source-before-build.json`, `source-after-build.json` and `source-after-captures.json` each record the same 1,060-file source aggregate: `1bfeb00a390e599edc532dae4a7a25aa7a3ebc67c6c1190e7614bf2521377038`. The build-manifest aggregate is `4c9d71ceb6b142ad5e855e72eafc4e1325db44c77f489d8fc04aafc3a28b208e`; recorded base revision is `b631a52`. This pins the captured dirty-source snapshot, not a claim that HEAD alone describes it or that subsequent source remains identical.

Bundle frame records call their time field `simTime`, but capture metadata explicitly identifies a wall clock. The late frames are approximately 46 and 67 wall seconds after settle. These stills cannot establish authored cadence, continuous control, animation, input latency or performance. HUD and HUD-free counterparts visibly differ in intervening fauna position and, for the second Origin pair, sky/lighting state. They are useful separate observations, not a synchronized overlay comparison or matched day/night HUD pair.

## What was actually visible

| Viewed scene file under `evidence/software-baseline/` | Observation | Scope limit |
| --- | --- | --- |
| `ch4/evidence/bundle/frames/f0000_t2.01s_opening-2.0s.png` | A bright shore view: stepped water/soil/stone faces lead from the lower foreground toward the horizon. A large near trunk and leaves crop the left/top edges; dense grass occupies the dry banks. Stable block edges are distinguishable in this view. | No W-7744, instrument/reference exchange, or identified hero-tree-to-pond route is visible. The visible bank is not proof that the proposed route occupies it. |
| `ch4/evidence/bundle/frames/f0001_t66.97s_strip.png` | The same broad shore framing under a starry dark sky and bright moon. Near block edges and the water/soil boundary remain distinguishable in this software image; the middle-distance ground and vegetation carry less separation. | This shows one nighttime environment relation, not nighttime actor-footing, reference or route readability. No night color/light approval follows. |
| `ch9/evidence/bundle/frames/f0000_t2.00s_opening-2.0s.png` | A very near antlered animal fills much of the left and center, with cropped antlers. Blue leaves overhang at upper right; cyan vegetation, shoreline, water and small signal forms occupy the remaining view. | The animal obscures a large part of the ground and focal field. The restored core/install transaction and home invitation are not shown. |
| `ch9/evidence/bundle/frames/f0001_t46.09s_strip.png` | The foreground animal has changed position; its neck/body still blocks much of the lower-left field. Shoreline and signal forms remain visible on the right, with another small distant animal. | Two positions prove neither smooth movement nor a cleared observation window. This is still not a hearth or live restoration view. |

The four `hud/` counterparts were also viewed. Origin shows `CAMPFIRE · ATTEND`, a central `F Attend Fire Mismatch` prompt and a right-edge `campfire · attend · 0m` marker, while the corresponding actor/fire action is not identifiable in the scene. That is a concrete example of guidance being legible without its intended physical relationship being available in the chosen view; it is not proof of successful audit staging. Tidegarden shows `LIVING WATERLINE · SCAN` and a right-side waterline marker around 11m while the foreground animal competes strongly for attention. Neither example warrants changing old chapters as part of this commission.

State evidence narrows these observations. `ch4/software-state-{entry,exit}.json` reports Origin `-1,-1`, `ch4-audit`, unchanged `ch4:audit:attend-fire`, on-foot/free look and FOV 75. Its arrival-handback anchor is telemetry, not a viewed arrival or physical actor proof. `ch9/software-state-entry.json` reports Tidegarden `-1,-1:p1`, `ch9-hearth`, `settle:scan-waterline`; exit advances only to `settle:attend-waterline`. Both report FOV 75 and free look. The chapter name must not be mistaken for evidence that the late hearth/install boundary was reached.

## Geometry evidence, kept separate from the images

`geometry-feasibility.json`, generated `2026-09-06T05:02:00.263Z`, and `geometry-feasibility.md` describe a CPU measurement of pristine procedural Origin. These routes were not visible in the four frames, and the measurement is not live edited-terrain validation.

- The first pass reports a 60-unit, 76-sample worker-legal short path between its tree-side and shore endpoints. Its assumed reference test has 18 terrain-blocked samples. This supports a bounded candidate for a short grounded path with a real terrain obstruction; it does not yet prove the final reciprocal mechanic or an independently legible mid-route witness bend.
- The 108-unit, 127-sample detour is walkable but has 83 blocked samples under that same assumed test. It is **not** the promised continuously usable outer route. The limited, length-led search is also not proof that such a route is impossible.
- The first suggested intermediate witness lies only two units from the start reference. That small separation needs particular care: a numerically valid change cannot be presented as a substantial exchanged vantage without corresponding visible geometry.
- The report measures the hero trunk's stable collider as 1.1 units wide and distinguishes it from optional canopy. This supports caution about relying on a narrow trunk occlusion. It does not establish visual legibility of that trunk or any bend; the report's terrain visibility statements remain geometric inferences.
- The probe assumes a specific reference and 1.6-unit line height. The signed narrative candidate defines socket-to-socket world-state authority but leaves exact sockets/layout for production. Pass-one occlusion counts therefore cannot be transferred unchanged to the final predicate. The reference-aware pass is the appropriate pending evidence.
- Both the 128-point and 120-unit caps must be obeyed independently. The measured winding examples reach the point cap sooner; that is a practical route-budget constraint, not permission to raise either cap, promise every 120-unit trace fits, or silently decimate player evidence. Any actual contract change remains a separate decision.

## Existing scene-layout prerequisites, made concrete

These restate the signed candidate and Cinema reconciliation; they add no baseline stage or new production gate.

1. **Existing physical arena before exact blocking.** Settle both route classes with the actual proposed reference endpoints and worker support/clearance rules. Then inspect the existing ground, reference relation and held worker/last-tested-end/bend composition from attainable player-owned positions. These four broad shore views cannot supply that missing composition. Do not sign an assumed outer path or repair an infeasible arena with a hidden obstacle or automatic route.
2. **Readable bodies and ground at the existing 75-degree view.** The shore images support using stable stepped ground edges for spatial explanation. Dense grass, near trunks and wandering fauna can obscure the relevant contact area. Select attainable observation positions that expose actor feet, the relevant step and the reference direction together; no forced look or new vegetation-dependent success test is implied. Keep the causal cluster away from the demonstrated lower-left work order and central interaction prompt where feasible. Exact placement and size are still unsigned.
3. **Existing day/night spatial evidence.** The dark Origin frame shows that some near-ground shapes survive at night in this diagnostic. It does not establish the signed worker/reference relation or lowest-tier footing at that time. Apply the already agreed day/night check to the actual selected arena. Existing lighting authority and stable shape/value cues remain the bounds; a needed daylight-only amendment still returns to the peers before scene signature.
4. **Home boundary in its actual state.** Ground the previously required restored-home view and invitation against the real core/landing approach and active guidance. The current Tidegarden fauna/waterline frames identify occlusion risk but provide no core location, installation acknowledgement or home handback composition. No animal behavior rewrite or additional restoration spectacle is inferred.
5. **New behavior after signed implementation.** Proposed/tested trace graphics, specific reference-versus-footing refusal, hold/re-entry, reciprocal passage, independent completion and persistent revisit must be proved after those features exist. Their absence in the current baseline is not a circular pre-implementation requirement. Current baseline work concerns existing physical geometry and visibility.

The already signed final headed hardware, tier/device, reduced-motion, night, lifecycle and independent review requirements remain unchanged. This inspection makes no beauty, color, lighting-quality, audio, pace, feel, mobile or performance judgment and grants no runtime or publication approval.

## Inspected artifact hashes

The four scene-image hashes were verified against their bundle records. These hashes identify this review's evidence snapshot while the separate reports continue.

```text
e3969f53c809aea08873c4baf1a1e75302b7ce7fed29dc5b167f36d5ac752ef2  evidence/software-baseline/ch4/evidence/bundle/frames/f0000_t2.01s_opening-2.0s.png
f503338d77514177305c46a8ccff7aa7a17f751129a5b2acb438eb80fa160bae  evidence/software-baseline/ch4/evidence/bundle/frames/f0001_t66.97s_strip.png
05a0852132c074232ff484fe16d7a007118165f0c8e1e5ad1152e5df5cb56b02  evidence/software-baseline/ch9/evidence/bundle/frames/f0000_t2.00s_opening-2.0s.png
4f3e648b2f27ec0f88ca5c09e09589957a1c46c9285a703c0717cc026b48d28c  evidence/software-baseline/ch9/evidence/bundle/frames/f0001_t46.09s_strip.png
e57bdff83952d3c6cd3dc65da8865afe0fc8d676b692139e9fab8a0b1109f59f  geometry-feasibility.md
f33efd2cf6d0928602199aea8398958c2d23d9b6866cc1ec3ef8bee6619e73a2  geometry-feasibility.json
13ae191f3fe6e61f0843af247c14f0280a01cdf2de1d7c1b04b7fe5341524d07  evidence/software-baseline/baseline-report.json
79c2c3fd42d68f5f44840e1831b02f404f9f0c804d04f7c8bd024bafc19042b0  evidence/software-baseline/build-manifest.json
```
