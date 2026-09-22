# Common manual-passage probe — preparation report

Prepared 2026-09-06T15:44:03Z · role: story-verifier (opus) · **HARNESS PREPARATION ONLY**

## NOT RUN

No browser, GPU, preview, build, `npm verify` or capture was executed. `verification-ready.json`
`ready=false` and `verifier-control.json` `action=hold`, so the probe's own preflight guard refuses
to launch. That refusal was exercised against the live control files: exit 3, `launched=false`, no
browser process (`logs/common-manual-focused-prep/refusal-demo.log`).

## New owned files

| file | sha256 |
| --- | --- |
| `verifier/probes/common-manual-focused/commonPassageLogic.mjs` | `917807d70b363922b433f2b5e3188f4ed93c8ddcc04fdf0b7bc3be742fe05dc6` |
| `verifier/probes/common-manual-focused/common-passage-probe.mjs` | `11c4a7d1373ae0aee603f80d828f487d284311244457696b9d4a8d6100b2cdc5` |
| `verifier/probes/common-manual-focused/selftest.mjs` | `52b2ba18368421174eb0f97172f7810197c90e4c3a0f8dc17b742dfdf4ffbce1` |

Plus `logs/common-manual-focused-prep/{node-check,selftest,refusal-demo}.log` and this report pair.
Nothing else was written: no game source, no existing probe, no canonical evidence/gate/manifest/
defect/control artifact, no capture bytes, no new game tests.

## What the probe earns, in order, through ordinary input

1. **Readiness/identity** — finite, non-initial, settled, *actually supported* body plus `worldBound`;
   `<title>Paravoxia</title>` + hardware ANGLE + headed; real shipped-canvas click **after** readiness;
   pointer lock, focus, input policy; four ordinary key receipts requiring **horizontal** motion with a
   direction (spawn settling is explicitly rejected). Capsule centre and grounded pose are reported
   separately, with `groundOffsetUnits` and the world's own `supported` predicate.
2. **Survey → common** — the known-good manual sequence: walk to W, `[F]`; walk to S, `[F]` (assert
   `anc.cg.survey-started`); draw the authored 18-vertex long route; `[F]` offer the span at E; answer
   the authored witness hold at W with the authored `[F]`; wait for `anc.cg.route-tested`; assert beat
   `ch13-common` and objective `ch13:common:reciprocal`.
3. **Reciprocal (H held by W)** — assert `stage=holding-h`, `anc.cg.reciprocal-reference` and the worker
   body actually at H; then Terra walks the ordered ten-vertex 18-unit `CG_ROUTE_COMMON` E→C, sampling
   `terraUnits`, support, pose and worker clearance every step.
4. **Early-corner deviation/recovery (`--mode deviation`)** — turn early at **z 15.82, before the z=16
   corner** (the COMMON case, strictly *not* the earlier survey free-drawing loop); cut to vertex 3;
   complete every remaining vertex to C and assert that far ground and the endpoint **bought no credit**;
   then return ordinarily back along the route to the frontier, physically traverse the omitted corner at
   (-42, 16), and resume the ordered remainder — **no extra F, no reset, no teleport, no endpoint pumping**.
5. **Far reference T** — exact objective `ch13:common:offer-final-reference` **and** the literal
   `[F] Offer this end` prompt are checked before F; assert `finalReferenceOffered && finalReferenceOccupied`
   and `anc.cg.final-reference-offered`.
6. **Release** — hold occupancy at T while W walks H→E and tests the span; assert `workerUnits >= 18`,
   `committed`, `anc.cg.complete`, `anc.cg.handback`, occupancy held, clearance maintained.

## Physical assertions (body at the endpoint is insufficient)

`terraUnits >= 18` **and** physical arrival within 1.0 unit of C **and** live `supported` **and** credit
actually accruing while walking (the source's proxy for live reference/sight/support) **and** every ordered
leg reached by measured distance **and** measured player↔worker clearance ≥ 1 unit **and** monotone earned
prefix with zero extra F/resets. Any missing runtime field yields `INCONCLUSIVE-UNAVAILABLE-FIELD`, never a pass.

## Stopping conditions

Preflight refusal (exit 3, before any launch) · identity/lane/readiness gate failure · **any leg not
reached** (timeout, stall, no calibrated key) stops the probe immediately and is never labelled arrived,
with no later F or action · any F whose exact objective/prompt is absent · per-phase budget exhaustion ·
passage verdict not ok at C (stops before T and release). Cleanup runs exactly once through the owned
guard in `finally`, and the final log line is written **after** the summary write.

## Static validation

`node --check` passes on all three files. `node verifier/probes/common-manual-focused/selftest.mjs` →
**43/43 pass**, covering zero-motion and vertical-only-settling receipts, uninitialised body, timeout and
stall never reading as arrival, mandatory prompt/objective negatives, preflight refusals (unready, hold,
foreign role, missing url, missing heavy lock, manifest drift), identity spoofing (right title + SwiftShader,
wrong title + ANGLE, headless), endpoint-only credit, endpoint pumping, unrestored credit and
unavailable-field inconclusiveness.

## Recommended root invocation (after the gate)

```
node verifier/probes/common-manual-focused/selftest.mjs
node verifier/probes/common-manual-focused/common-passage-probe.mjs \
  --mode reference --url <ROOT_CANONICAL_URL> \
  --out verifier/captures/common-manual-focused/reference-1 \
  --expect-source-manifest <NEW_MANIFEST_SHA256> --heavy-lock <LOCK_PATH>
node verifier/probes/common-manual-focused/common-passage-probe.mjs \
  --mode deviation --url <ROOT_CANONICAL_URL> \
  --out verifier/captures/common-manual-focused/deviation-1 \
  --expect-source-manifest <NEW_MANIFEST_SHA256> --heavy-lock <LOCK_PATH> --common-ms 600000
```

`--url` is mandatory (no hardcoded 38803 dependence); the heavy lock must be acquired externally; the
manifest sha binds the run to root's new immutable source. Two runs are required because `terraUnits` is
monotone within a session: the clean ordered route and the early-deviation/recovery case cannot share one.

## Known limitations

Not run, so nothing runtime is claimed. Entry is the **labelled fixture** `?story=ch13-survey` — no
Origin-landed continuity, no full story, no earned Continue, no first-time-naive UX. Waypoints were read
from frozen source, so this is instrumented manual play and can never support a no-private-knowledge
usability claim. Manual `rail` is expected null and no target is derived from it. No new source or telemetry
bridge is added, so the player's per-frame reference/sight predicate is only *inferred* from accruing credit.
The self-tests are harness tests, not game tests. CG-IMPL-009 and the conditional manual-corner risk remain
open and unmeasured; this preparation grants no acceptance and closes no defect.
