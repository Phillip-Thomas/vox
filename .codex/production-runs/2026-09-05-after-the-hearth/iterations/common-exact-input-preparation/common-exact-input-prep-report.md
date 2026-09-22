# Exact-input discriminator preparation — manual COMMON credit plateau 6

**State: PREPARED, NOT RUN.** CPU only. No browser, no GPU, no build, no game-source edit,
no shared-probe edit, no contract change. All 99 live source hashes verified unchanged
against `implementation-source-manifest.json`
(`6ef957c3dd4a1af04852773b3e5f608d2247e212eb27d05a95ba6f40c1fee5d6`): 99 checked, 0 mismatched, 0 missing.

## Intent, read first

`chapter-manual-corner-interpretation.json` rules that ordinary eligible **positive
post-plane overshoot** within existing bounds must not permanently freeze credit, and that
freezing it is an implementation-fidelity defect rather than a creative choice. The producer
review accepts that reading and requires exactly this: a CPU-only prepared exact-input
discriminator before any material correction, preserving the exact early z15.82 refusal.
Both were read before any other artifact and both are obeyed.

## What the call chain actually is (static evidence, no game code executed)

Credit is assigned at `commonGroundDirector.ts:1320`:

```
common.terraUnits = routeProgressUnits(CG_ROUTE_COMMON, body, common.terraUnits, displacement)
```

- **Point representation is a FOOT projection**, not the body centre:
  `commonGroundPlayerPose() = playerWorldPosition − up * CG_PLAYER_GROUND_OFFSET`
  (`commonGroundDirector.ts:791-799`). On the curved surface `up` is not +Y, so this point
  differs from body centre **horizontally as well as vertically**. Earlier body-centre poses
  are not directly comparable without restating that offset.
- **Displacement is per DIRECTOR UPDATE**, measured not timed
  (`playerDisplacement`, `:911-919`, teleport guard `moved > 2 → 0`). The audit's
  `~0.0836` per-frame ceiling was an *inferred* 60 Hz figure and is **not** reused as fact.
- **Ceiling** is `previousUnits + displacementUnits`, computed once per call from **credit**,
  not from the body's true arc (`commonGroundRoute.ts:481`).

### Predicates actually evaluated at the credit site — exhaustive

| Predicate | When | What it actually covers |
|---|---|---|
| `walkedSegmentSupported(previousBody, body, ground, {extraSolids})` | every update with a previous body | dense 0.25-unit `isSupported` samples across the walked span; capsule **footprint** vs `CG_APPARATUS_SOLIDS` (r 0.5, h 3.6) and vs `extraSolids` |
| `ground.isSupported(body)` | **first update only** (previousBody null) | single-point support, **no swept footprint** |
| `checkReference(workerSocket, playerSocket(body), {extraSolids}).ok` | **only if** the support term was true (`&&` short-circuit) | reference **range**; solid **sight** occlusion vs apparatus solids and extra solids |

### Presumed clearance branch that is NOT actually in the Terra call chain

Reported absent rather than fabricated true:

- **`bodiesClear`** (body–body clearance, `commonGroundRoute.ts:433`) is called at
  `commonGroundDirector.ts:1213` and `:2419`, **neither of which is on the path to the
  credit call at :1320**. Credit is *not* gated on body clearance.
- **`spanClearance`** (`:2054`, used at `:2104`) is standby placement only, not a credit gate.

This is confirmed in the shipped bundle: the minified guard is literally
`(g?fL(g,i,o,{extraSolids:n}):o.isSupported(i))&&GH(Q,RH(i),zKA()).ok&&(t.terraUnits=pwe(...))`
— support, then reference, then credit. `TKA` (`bodiesClear`) does not appear.

### Reasons a predicate is uncalled or skipped

- `short-circuit-support-false` — `checkReference` is never reached when support is false;
  its outcome is **MISSING**, not false.
- `first-update-no-previous-body` — swept walked-segment/footprint test is **unevaluated**.
- `guard-false-no-credit-call` — no record exists; absence proves *a* guard failed but does
  **not** identify which.
- `no-displacement-early-return` — `!(displacement > 0)` returns `previousUnits` before any scan.
- **Which guard failed is not recoverable** without re-evaluating physical predicates, which is
  forbidden. It stays missing.

## The discriminator (one only, plus one control)

Run-local, non-mutating observation on the **unchanged immutable 34413 build**: a single CDP
conditional logpoint whose condition records bounded data and evaluates to **false**, so the
debugger never pauses and no predicate is called again.

- Bundle `/assets/index-BiDWGouH.js`, sha256
  `efc87feb0068671e6ac297f808fe61ea320b208a13fd9a8c40fa051077a9a068`, from
  `verifier/artifacts/preview-ownership.json`. **No source map is shipped.**
- Binding is by **unique minified signature, never a guessed variable**:
  `=2.5){` occurs **exactly once** in 5,666,730 chars; `function pwe(e,A,t,i,g=2.5)` once;
  `pwe(` exactly twice (declaration + one call site). `pwe` is a character-for-character
  match of `routeProgressUnits`. Binding is reliable, so **no instrumentation-only source
  patch candidate was needed and none is staged**.
- Site: `index-BiDWGouH.js` **7839:193729** (first statement of the credit function).
- Records per actual credit call: prior credit, foot-projected point, per-update displacement,
  corridor radius, route length. **Returned credit is chained from the next call's
  `previousUnits`** — actual, not interpolated. The **final call's return is MISSING** and is
  reported as such.

**Input plan.** Reuse the existing manual preparation/physics path and the existing successful
movie survey prerequisite **only as an explicitly labelled diagnostic fixture**
(`?story=ch13-survey`), reaching a **verified grounded E** — the prior reference-3 E entry was
**airborne** due to the direct W→E shortcut and is neither repeated nor called grounded. Then
ordinary held WASD for a bounded **vertex 2 → 3 → 4** crossing with an ordinary positive
post-plane overshoot. The before-plane/squared target is a **labelled diagnostic control only**
and must never be silently substituted for the discriminator.

## Instrumentation effect on timing and identity

Served bytes and bundle sha256 are **unchanged**; a conditional breakpoint patches nothing on
disk. V8 deoptimises and re-JITs the instrumented function for the session. Each condition
evaluation runs once per director update inside `tickCommon` and can slightly lengthen a frame,
changing dt and therefore the **distribution** of per-update displacement — each recorded
displacement is still the actual one, but near-ceiling comparisons must state this caveat.
Volume is ~360–600 records for the bounded leg against a hard cap of 2400, with drops counted;
the sink is an inert array that nothing reads back into game state, so it cannot grant credit.

## CPU tests actually run

`node verifier/probes/common-exact-input/selftest.mjs` → **exit 0, 12/12 checks passed**
(log `logs/common-exact-input-prep/selftest.json`). It proves the served bundle hash still
matches, the binding is still unique, the call-site and guard literals still match, `bodiesClear`
is absent from the guard, the line/column are exact, the condition returns false on every
evaluation, the record shape and bounded cap behave, and returned-credit chaining leaves the
final call MISSING rather than interpolated.

## Owned artifacts

| Path | sha256 |
|---|---|
| `verifier/probes/common-exact-input/creditCallLogpoints.mjs` | `c1e15bfb939b72380b5397fd976c54b71e7ed526b8ccf32210b05c903a2fc566` |
| `verifier/probes/common-exact-input/selftest.mjs` | `26e0019a0aa4b0b7702c6cbb8c583a001786770b5d45e88f8e91635b8a657191` |
| `verifier/probes/common-exact-input/invocation.json` | `cd3b604298a48212a3219401eb13dcfd6c3d733a1eac41e23e7f6facf3501f28` |
| `logs/common-exact-input-prep/selftest.json` | `7a27073e0fa6b5263d1db8bb6ced54000b59ef05f9b08c1da8cbf62e871f957c` |

## Smallest next step

When SHORT releases GPU/browser access: attach CDP to the already-running 34413 preview,
install the sink, set the single LP-A logpoint at `index-BiDWGouH.js` 7839:193729, enter via the
labelled `ch13-survey` fixture to a **verified grounded** E, drive one ordinary-WASD
vertex 2→3→4 leg with a positive post-plane overshoot, then the squared-corner control, drain
once, and chain returns. Nothing else.

## Not a claim

No runtime result, no acceptance, no defect closure, no correction proposed, and no authority
to change any algorithm, tolerance, geometry or signature. Full-route and manual-UX acceptance
remain outside this diagnostic. The exact early z15.82 refusal, all physical predicates and the
strict eighteen-unit ordered passage are untouched.
