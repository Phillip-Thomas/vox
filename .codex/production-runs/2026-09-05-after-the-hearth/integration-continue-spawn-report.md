# Integration report — Continue saved on-foot spawn precedence (CG-IMPL-011)

Material repair iteration 9 · scene-v3 unchanged (`5ef85a32…`) · no contract, schema,
metadata, manifest or profile change · no self-acceptance, no publication.

## Gate check before any mutation

- `continue-spawn-repair-direction.json` → `sourceMutationAuthorized: true`,
  handoff at `2026-09-06T23:15:21Z`.
- Budget, boundary and disposition documents agree on the same four allowed
  paths and the same handoff timestamp.
- Verifier cleanup receipt (`…closure-review.json#cleanup`) records
  `state: stopped`, `cleanupCompleted: true`, post-finally. Gate satisfied.
- Live `EfficientScene.tsx` bytes equalled the recorded pre-implementation hash
  `ab95dfe4…`, confirming a clean starting point.

## Root cause

```ts
const landedPlayerSpawn = landedShipPos
  ? landedPlayerEgress ?? arrivalPose.playerSurfacePosition
  : initialPlayerPosition;
```

`landedShipPos` is seeded at mount from the **validated persisted parked ship**.
So on any Continue where a ship is parked, the correctly loaded saved on-foot
pose `H` was discarded before `EfficientPlayer` hydrated — matching the capture
exactly: selector chose `GA = FA [53.85, 21.5, -24]`, the player mount received
that as `initialPosition_g` at +762 ms, and the rAF centre became
`[53.849998474121094, 21.5, -24]` between +687/+802 ms.

Per the closure review qualification, this is described as a **selector →
controller-input → physics-body** chain. The direct Rapier API call was *not*
instrumented and is not claimed. `validatedPersistedParked` local and the
derived face were unmeasured and were **not** invented.

## Fix

Precedence is scoped by **provenance**, not by "save beats ship":

| input | meaning |
|---|---|
| `initialSpawnSource` | how the initial on-foot position was obtained (`saved-pose`, `saved-pose-validated`, `arrival`, `approach`, `system-restore`, `authored-dive-recovery`) |
| `landedShipProvenance` | `none` / `persisted-parked` (rehydrated at mount) / `session` (earned by actually flying) |
| `shipEgressClaimed` | monotonic; set the moment the player takes the ship |

A saved on-foot pose wins **only** when all three hold: the source is a
safety-validated saved pose, the ship pose is merely persisted, and no egress
has been claimed. Every other combination resolves exactly as before.

Because the latch is spent on boarding and never clears, a real
board → fly → land → disembark after the restored session uses its **current
lawful egress**. `EfficientPlayer` unmounts during flight and remounts on
disembark with the fresh egress, which is precisely the path preserved.

## What was deliberately not changed

- Ship pose, hatch, rendering and persistence: `landedShipPos` still drives
  `SpaceshipPlaceholder`, `ShipController` boarding, Tidegarden and
  `persistShipFlightLocation`. The ship stays parked on +X and correct even when
  the player resumes far from it.
- Safety validation: `isDryClearResumePosition` / `findValidSpawnSite` called
  identically. **No forced top-face, no pose projection, no terrain-safety
  bypass.**
- An unsafe save with no valid nearby site degrades to `'arrival'` and therefore
  carries **no** precedence — the safe fallback is preserved, not latched over.
- `resetPosition` preserved byte-equivalently via `landedPlayerResetPosition`.
- Actor/world matching, pose orientation semantics, story-anchored spawn
  suppression, Chapter 6 dive recovery, and all arrival/route/score/audio
  predicates: untouched.

## Touched paths

| path | before | after |
|---|---|---|
| `main/src/components/EfficientScene.tsx` | `ab95dfe4…a776f995` | `9114c71a…022f39a9` |
| `main/src/utils/playerSpawnSelection.ts` | *(absent)* | `005e3b8f…9c9e08b3` |
| `main/src/utils/playerSpawnSelection.test.ts` | *(absent)* | `e5cc2f8f…7cf7fe26` |

`EfficientScene.test.tsx` was allowed but not used. `EfficientPlayer.tsx`
unchanged (`c46bfd67…`). The large pre-existing dirty tree was preserved
untouched.

## Focused checks (only)

| command | result |
|---|---|
| `tsc --noEmit -p tsconfig.json` | exit 0 |
| `vitest run` × 8 focused files | **101 passed**, exit 0 |

Covers the new selection suite plus the existing `spawnValidation`,
`worldArrival`, `shipFlightContinuity`, `diveReloadRecovery`, `persistence`,
`waterVoxels` and `App` suites — all still green.

**Counterfactual:** reverting `selectPlayerSpawnChoice` to the pre-repair rule
produces **4 failed / 11 passed**; the file was restored and its sha256 verified
identical to the candidate. The test additionally encodes the prior
EfficientScene expression verbatim (`oldSourceSpawn`) and shows it selecting
`FA` instead of `H`.

Not run, by instruction: `npm run verify`, build, browser/GPU, full suite, dist.

## Unresolved concerns for root

1. **(medium)** The decision is proven at the selection seam, not by mounting
   `EfficientScene`. Nothing test-asserts that the scene *wires* provenance and
   the claim flag correctly. Mounting `EfficientScene` needs Physics plus ~50
   module mocks; within the 20-minute bound that would have been a fragile,
   largely artificial fixture, and the scene test file was optional. The wiring
   diff is small and reviewable at
   `logs/integration-continue-spawn/EfficientScene.diff`. **The independent
   verifier's real-browser Continue should be treated as the binding proof of
   the wiring.**
2. **(low)** `shipEgressClaimed` seeds `true` when the scene mounts already in
   flight. Behavior is unchanged from baseline there (source is
   `system-restore`, which never had precedence); recorded for transparency.
3. **(informational)** `validatedPersistedParked` local and derived face remain
   unmeasured; the repair does not depend on them and none were invented.
4. **(informational)** No additional necessary seam was demonstrated. No
   boundary broadening is requested.

The prior 3192-test count is **baseline context, not candidate proof**. The
independent verifier owns the build, the real affected action and the one stable
full suite. No defect closure or chapter acceptance is claimed here.
