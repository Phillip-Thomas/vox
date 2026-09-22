# SHORT survey lane — probe preparation (CPU-only)

**Status: `prepared-not-run`.** No acceptance, no defect closure, no publishing.
No browser, GPU, preview, dev server or build was used. No game, canon, contract,
manifest, gate or shared probe was edited.

## Why a new lane was necessary

The movie rail and every existing manual witness capture deliberately draw the
**LONG** span. `manual-focused/manual-witness-hold-probe.mjs` hardcodes the
18-waypoint z=14..22 detour — which is `CG_ROUTE_LONG` minus its first vertex —
and LONG is supported end to end by the fixed reference, so it can only ever
complete as `fixed-reference`. **No existing artefact can be re-read as a SHORT
proof.** The SHORT class is earned only when an *offered and occupied* witness
holds the end the fixed socket cannot see past the apparatus backing, so this
lane draws the short span itself.

The old `manual-survey/` filename was not trusted or used, and no geometry was
inferred from any filename: every constant is quoted from frozen source and
**mechanically re-extracted and compared** by `selftest.mjs`.

## What the current contract and runtime actually say

- `scene-contract.json` — sha `5ef85a32…`, **scene-v3**, `frozen`. Survey
  objectives read: `offer`, `start`, `draw`, `offer-span`, `test`, `revise`,
  `witness`, `witness-return`.
- `commonGroundState.ts` — `CG_ROUTE_SHORT` is 9 samples straight along **z=12**,
  S(-26,51.05,12) → E(-42,51.05,12), **16 walked units**; `CG_ROUTE_LONG` is 19
  samples, 36 units; `CG_POSES.W` = (-34,51.05,10) is **off** the short span.
- `commonGroundDirector.ts` — `routeClass = held ? 'held-reference' :
  'fixed-reference'`, and `held` requires the witness to be **both offered and
  occupied** at the completing tick. `footing-invalid` is never repaired by
  occupancy; its authored repair is an actual revision.
- `commonGroundRoute.test.ts` (the **shipped** predicate snapshot this lane
  defers to rather than writing a looser proof of its own): short + fixed only
  holds with a named cause (`reference-occluded-survey-housing` or
  `reference-out-of-range`); short + held socket at `playerSocket(W)` completes;
  long + fixed only completes.

## What was prepared

`verifier/probes/arrival-common-short/` (owned; originals preserved byte-exactly):

| file | sha256 |
|---|---|
| `short-survey-probe.mjs` (entrypoint) | `03931214d21fe84219c0cd1b8fef9bbf3a7e4c54293787ca96fc831c9a9ffc4a` |
| `shortSurveyLogic.mjs` (pure predicates) | `83981677b9ccf69629e90aaa1e03ce56c1d3a105385a15aa18c248790a4a99fb` |
| `selftest.mjs` (integrity suite) | `226ef9380fee642dbe37cd0c6baa9009031320599acf38481f62a671ece0c250` |
| `pin.json` | `7a3e4c8c927500f1ee86e42496f310ed39be9b9c9cc5564612f772f3f351fa10` |
| `cgContract.pinned.mjs` (copy) | `5f447ebd…c551` |
| `ownedSession.pinned.mjs` (copy) | `9a5c2556…9d4b` |
| `sourceSnapshot.pinned.mjs` (copy) | `b3e7f681…3a20` |
| `commonPassageLogic.mjs` (copy) | `24d67c65…060c` |
| `entryObservation.mjs` (copy) | `4eb7ec5d…94f4` |

Unpinned shared dependency, recorded so drift is detectable:
`main/tools/lib/evidence.mjs` `1997cf2a…5328` (copying it would break the
relative imports of `previewServer.mjs`/`assertHardwareGl`).

## What the runtime will do

Ordinary shipped input only: held WASD, a **real** canvas click for pointer lock,
and `[F]` pressed **only** where the shipped prompt offers the authored verb under
the authored objective id. No pose / control-state / progress / milestone / route
write, no forged save, no direct predicate call, no teleport, no forced pointer
lock, no forced click, no `movie=1`, no autopilot.

1. **Refuse before any browser** unless: `verification-ready`, `activeRole
   arrival-common-short-runtime`, an already-acquired **inherited EXCLUSIVE flock
   on fd 9** of `/home/thomasphillip/Projects/Paraform/harness/output/.heavy.lock`,
   the root-published URL from `verifier/artifacts/preview-ownership.json` (no
   hardcoded port), the frozen source-manifest sha, the **scene-v3 contract sha**,
   the **actual served index+bundle bytes**, and an absolute **empty** `--out`.
2. One owned browser, `try/finally`, post-cleanup receipt; the root preview is
   never stopped. Identity gate: title `Paravoxia`, headed **hardware ANGLE**
   (existing `assertHardwareGl` path), served index sha == root-owned index sha.
3. Fixture boot must be clean — no seeded SHORT completion, accepted class, held
   reference, working samples, tested prefix, tail revision or survey anchors.
4. Walk to **W** from live state → `[F]` offer → walk to **S** → `[F]` begin →
   **draw the SHORT z=12 span** → `[F]` offer the span → watch the **real** test.
5. Branch on the **actual** published hold: an occlusion/range hold is answered by
   the authored reference `[F]` inside the 1.25u occupancy cylinder plus
   **maintained** occupancy; a `footing-invalid` hold is answered by an **actual
   revision** and a redraw along the signed LONG geometry (occupancy may never
   launder unsafe footing).
6. Verdict only from `shortCompletionVerdict`: drawn route classified SHORT **and**
   `acceptedClass === 'held-reference'` **and** `anc.cg.route-tested` **and**
   phase `tested`. A held class on a LONG drawing is reported as
   `MISLABELLED-NOT-SHORT`, never as a SHORT proof.

Bounded waits throughout; a ~20 s no-progress window writes a stall diagnosis
(body/support/hold/pointer-lock/focus/policy/objective). A failed required gate
refuses every dependent act and names the first failure. Raw telemetry, action
events, frames (with hashes), the probe/library source snapshot and
`summary.json`/`summary.sha256` are all retained. The passive Window/Document
input observer is reused unchanged, and its failure is recorded as an
**instrumentation** limitation, never as gameplay.

## Commands run (exact) and results

| command | exit |
|---|---|
| `node verifier/probes/arrival-common-short/shortSurveyLogic.mjs --self-test` | **0** |
| `node verifier/probes/arrival-common-short/selftest.mjs` | **0** |
| `node verifier/probes/arrival-common-short/short-survey-probe.mjs --out /tmp/nonexistent-short-check` | **3** (`REFUSED-PREREQUISITE`, **no browser launched**) |

The refusal listed: foreign `activeRole=arrival-common-verifier`, missing
`--url`, no inherited exclusive flock fd, missing `--expect-source-manifest`, and
an unbound served build. Retained at
`logs/arrival-common-short-prep/refusal-dryrun.json`.

CPU coverage: SHORT-vs-issued classification (with `UNCLASSIFIED` never defaulting
to SHORT), mislabel detection, new `[F]` vs a pre-existing hold, required
occupancy and the cylinder radius, failure-refuses-downstream, revision
bump/anchor agreement and prefix monotonicity, fixture-vs-earned labels, clean
fixture boot, and the cleanup/identity/active-role closing receipt. Plus
mechanical re-extraction of the quoted geometry from frozen source and
re-verification that the shipped predicate suite and the director's class
decision are unchanged. No broad test suite was run.

## Source integrity

`implementation-source-manifest.json` = `6ef957c3dd4a1af04852773b3e5f608d2247e212eb27d05a95ba6f40c1fee5d6`
(matches `verifier-control.json`). Hashes before/after in
`logs/arrival-common-short-prep/`: **no drift** — all game source, the contract,
`verifier-control.json`, `verifier/probes/lib/*`, `arrival-common-manual/*`,
`manual-focused/*` and `cg-journey-probe.mjs` are byte-identical after this
preparation. No external tooling drift was observed.

## Limitations

- Prepared, **not run**: this is not evidence about the chapter. The SHORT
  completion is unproven until released and run on hardware; the hold reason (and
  therefore the witness-vs-revision branch) is a prediction from the shipped unit
  suite, not a measurement.
- The `?story=ch13-survey` deep link is a **labelled fixture** for an isolated
  survey proof. It is never an earned continuous arrival, and this lane can
  support no first-time-usability or naive-UX claim. Waypoints came from frozen
  source — private knowledge a player does not have.
- **Reported, not fixed:** the shared `verifier/probes/lib/cgContract.mjs` (and
  its pinned copies) still carries the scene-v2 `SIGNED_CONTRACT_SHA256`
  `4dbf722b…`, while the current contract is scene-v3 `5ef85a32…`. Its
  `loadContract()` would therefore throw. This lane does not call it and binds to
  the scene-v3 bytes directly; repairing that shared helper is not this role's.
- Witness-return (vacate/re-enter) and the `ch13-common` beat are out of scope.

**No instrumentation blocker was found:** the current shipped logic can support a
truthful SHORT completion via the offered-and-occupied witness path.

**Next step for root:** release `activeRole arrival-common-short-runtime` with the
current URL/index/bundle/source-manifest facts and an inherited fd-9 exclusive
flock, then run the unexecuted command in the probe header with an absolute,
empty `--out`.
