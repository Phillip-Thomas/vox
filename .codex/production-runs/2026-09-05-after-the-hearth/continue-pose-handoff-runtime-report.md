# continue-pose-handoff-runtime — causal observation report

Role `continue-pose-handoff-runtime`. Window 2026-09-06T22:52:45Z → 22:58Z (actual UTC).
Capture: `verifier/captures/continue-pose-handoff/attempt-2026-09-06T2256Z` (99 s, exit 0).
Logs: `verifier/logs/continue-pose-handoff-runtime/`.

## Hashes
- source manifest `8962a7b25cbb7158df008737a8a902daa6c0b3bb3468ea0277084aa668b46962` (rehashed, no drift)
- bundle `index-C1X65dZp.js` sha256 `68c8be8435c5be5da681f3b5d4a16fcc071d03932e64b4e2fc985a30ab80328b`
- probe `earned-continue-3d-probe.mjs` sha256 `4d19d6a0078eb564812f23c041c43655e5d41109750e08cae59e46dfcf920d95`
- `poseHandoffObservation.mjs` sha256 `e9646ffbf900d010fbef06ced8791a08ff168ae631d4b10f40ec50d00bd97607`
- summary sha256 `a5876b7c66e9655fda46216f87f49838f947e60cc105a60f1d2b731ba6622727`, capture 6 349 296 bytes

## Gap 1 — point table (CLOSED)
Real minified locals resolved offline from the exact bundle; no fictional container object.
EfficientScene region is line 9361: `iA`=landedShipPos, `FA`=landedPlayerEgress,
`GA`=landedPlayerSpawn, `H`=initialPlayerPosition, `K`=arrivalPose, `G`=spawnTerrain,
`Bi`=planetSize, `e`=commandContext (`e.actorId`, `e.world.worldId`).
`aZ(e,A,t,i)` at 5208 is resolveShipPlayerEgressPosition with face as 4th positional.
Correction to commission: the `i.face ?? Vt(t)` choice is in **`MjA`**, a different helper, not in `aZ`.

Resolved locations vs actual hits (counted separately):

| site | requested (0-based) | actual | relocated |
|---|---|---|---|
| EfficientScene.landedPlayerSpawn | 9361:106767 | 9361:106770 | yes |
| resolveShipPlayerEgressPosition | 5208:17626 | 5208:17655 | yes |
| MjA.faceChoice | 5208:17790 | 5208:17800 | yes |
| EfficientPlayer.body.setTranslation.egress | 7990:69648 | 7990:69648 | no |

4/4 resolved, 0 unresolved. All relocations stayed inside the intended statement/scope.
Harvest: 23 events, **0 drops, 0 errors**, bounded 400 buffer. Always-false IIFE logpoints; no pause,
no setter, no monkeypatch.

## Gap 2 — `--pose-handoff-only` (CLOSED)
Now a real branch, not an annotation: `phases.newAction.attempted=false`,
`skippedByPoseHandoffOnly=true`, distinct verdict `pose-handoff-observation-only`.
The post-Continue walk and new [F] segment did not run. Raw savepoint prefix comparison,
5 s valid-foot HUD tail and event harvest still ran. Original 180 s/120 s/90 s budgets untouched.

## Observed
Live at the EfficientScene spawn selection (`GA = iA ? (FA ?? K.playerSurfacePosition) : H`):
- worldId `-1,-1`, actorId `local` (from `e.actorId`, not `world.actorId`)
- landedShipPos `[53.5, 20, -20]` — **non-null**
- landedPlayerEgress `[53.85, 17.5, -20]`
- initialPlayerPosition `[-31.71623992919922, 52.789695739746094, 20.15188980102539]`
- arrivalPose.playerSurfacePosition `[10.5, 53.85, -6]`, later `[8, 53.85, -6]`
- planetSize `50`

`resolveShipPlayerEgressPosition` was called two ways in the same frames: once with
`faceArgument:"top"` on shipPos `[8, 53.5, -6]` (generic arrival query) and once with
**`faceArgument:{absent:true}`** on shipPos `[53.5, 20, -20]` — the scene's own 3-arg call,
source-confirmed at `EfficientScene.tsx:517-521`.

Post-Continue saved on-foot pose: `[52.78897476196289, 17.5, -20]`. Its Y and Z equal
landedPlayerEgress exactly; the pre-Continue on-foot pose was not resumed.

## Activation path (for the producer's next bounded source handoff)
`EfficientScene.tsx:523-524` — `landedPlayerSpawn = landedShipPos ? (landedPlayerEgress ??
arrivalPose.playerSurfacePosition) : initialPlayerPosition`. Because `landedShipPos` is non-null
at Continue, the ternary short-circuits and `initialPlayerPosition` (the valid saved on-foot pose)
is never consulted. Measured, not inferred. Consistent with the audit's leading source path.

Face is **not** implicated: the parked ship really is near +X and the egress is +X-consistent.
The scope is saved-on-foot-pose precedence, not the face. No top-face fix is warranted.

## UNMEASURED (stated, not inferred)
- **The physical writer.** `EfficientPlayer.body.setTranslation` resolved but produced
  **zero hits**. The argument/callsite of the actual body write at Continue is unmeasured.
- The click split returned `clickMonotonicMs: undefined`, so before/after ordering around the
  Continue click is unestablished; all 23 events carry monotonic 3.4–8.0 s and their document
  provenance is not proven. Cause is therefore **not** closed on the writer.
- `validatedPersistedParked` — local not identified in the exact bundle.
- Derived face inside `Dn` — not exposed at the aZ entry position.

## Housekeeping
Exclusive flock held on inherited FD 9 of the shared `.heavy.lock` for the whole capture.
Existing preview 37395 reused; no new preview. Probe session cleanup receipt: `state:"stopped",
cleanupCompleted:true`. Remaining chrome PIDs belong to the pre-existing owned
`paraform-managed-webgpu` helper (port 9333) and were not touched.
No saves/world/pose/progress edited or seeded. No source patch. Prior captures/probes/archives preserved.
No chapter/defect closure, no publication.
