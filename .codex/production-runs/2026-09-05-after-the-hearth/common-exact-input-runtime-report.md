# Exact-input COMMON credit discriminator — RUNTIME

**VERDICT: instrumentation gate PASSED at runtime on the exact immutable bundle.
The discriminator itself was NOT run. No accounting verdict. Not acceptance.**

Prerequisites were read first and all existed before launch:
`common-exact-input-prep-report.json/.md` and
`producer-common-exact-input-prep-review.json`.

## Identity, verified before GPU and re-verified after

| Item | Value | Result |
|---|---|---|
| source manifest sha256 | `6ef957c3…fee5d6` | unchanged before **and** after |
| 99 game source files | rehashed twice | 0 drift, 0 missing |
| active role | `common-exact-input-runtime` | assigned |
| contract | scene-v3 | unchanged |
| `index.html` | `6c8c378b…cbb207` | matches root ownership |
| served bundle | `efc87feb…9a068`, 5 667 345 B | matches, and **unchanged after instrumentation** |
| CDP `scriptParsed` hash | `efc87feb…9a068` | same sha256, no source map |

## What was actually proved at runtime (observed, not inferred)

The producer's open qualification was *"actual debugger resolved locations and
successful scope records remain unproved."* Half of that is now closed.

All 10 gates passed:

| Gate | Result |
|---|---|
| served bundle is the root-published immutable bundle | PASS |
| callee first-statement column is exactly `7839:193729` | PASS |
| caller guarded-credit statement column is exactly `7839:219885` | PASS |
| `bodiesClear` (`TKA`) **absent** from this credit guard | PASS (reported absent, never fabricated true) |
| bundle script parsed exactly once | PASS (scriptId 7) |
| `193729` is an **actual** `getPossibleBreakpoints` location | PASS |
| `219885` is an **actual** `getPossibleBreakpoints` location | PASS |
| LP-A resolved with **no relocation** | PASS — 7839:193729 |
| LP-B resolved with **no relocation** | PASS — 7839:219885 |
| logpoints never paused the debugger | PASS — 0 pauses |

Root's stated column `7839:219956` is the `t.terraUnits=pwe(…)` assignment; I
confirmed it byte-for-byte and then bound LP-B one step earlier, at `219885`,
the start of the whole guarded statement, so that `g`, `i`, `I`, `t.stage` and
the **old** credit are all still live and the guard has not yet been evaluated.
I did not assume the requested columns survived resolution — I asked the
debugger and it offered both.

Live caller source, quoted from the served bytes:

```
g = Xe.lastPlayer ? {...Xe.lastPlayer} : null;   // prior FOOT
i = FC();                                        // current FOOT
I = ZKA(i);                                      // actual displacement
…
(g ? fL(g,i,o,{extraSolids:n}) : o.isSupported(i)) && GH(Q,RH(i),zKA()).ok
  && (t.terraUnits = pwe(tQ, i, t.terraUnits, I))
```

## Prior-call point: location AVAILABLE, scope retention UNPROVEN

This is the omission the commission asked me to close, and I closed only part
of it. The caller-scope site **resolves**. Whether `g`/`i`/`I` are actually
**retained** there (not optimised away) is **not proved**: the sink captured
**0 records**, because the credit call only runs in the COMMON beat at stage
`holding-h`, which this session never reached. I claim nothing further. No
adjacent eligible call across skipped updates was substituted.

## What was NOT run, stated plainly

- **Grounded E: not achieved. Held H reference: not achieved.** Neither was
  attempted. Per the commission I report the actual prerequisite rather than
  diagnosing accounting.
- **D1 positive post-plane overshoot (vertex 2 → 3 → 4): NOT RUN.**
- The before-plane / squared-corner control **C1 was not run and was not
  silently substituted**. The exact early **z15.82 before-plane refusal was not
  retested** and is unchanged.

**Why:** the 20-minute cap went to mandatory prerequisite reading, exact static
site derivation, and the instrumentation gate plus its one authorized retry.
The survey → E → `holding-h` chain costs ~80 s of ordinary play (measured
previously by reference-3 / deviation-1) and was never started.

## Accounting: neither proved nor falsified

Projection debt at vertex 3 is **NEITHER PROVED NOR FALSIFIED**. There are no
actual credit-call records, so nothing is inferred and **no repair is
recommended**. No patch was made.

### `refusedByCeiling` — qualified as ordered

The prepared field name asserts a cause it cannot support: `gain==0 &&
displacement>0` is also satisfied by backwards motion or by a body outside the
corridor. Renamed to **`zeroGainWithPositiveDisplacement_causeUnattributed`**.
Ceiling may be attributed only after replaying `routeProgressUnits` from the
exact captured arguments and showing the candidate projection is inside the
unchanged 2.5-unit corridor but beyond `previous + actualDisplacement`. No such
replay was possible. Not applied.

## Failures kept

`attempt-1` failed with `ERR_MODULE_NOT_FOUND` (playwright-core lives under
`main/node_modules`, not the repo root). One retry used, as authorized, for that
concrete private-harness failure; the empty `attempt-1` folder is retained, not
deleted. The known private pulse false-stall was **not reused** this session;
the correction that would apply is to compare measured displacement against
`unitsPerMs × the CLAMPED pulse ms`, never the full remaining commanded
distance. Original probe files and snapshots are unmodified.

## Limitations

- Conditional breakpoints deoptimise/re-JIT the function and can shift the
  **distribution** of per-update displacement; each record would still be an
  actual measurement. Untested here — no records.
- `scriptParsed` length 5 666 733 is UTF-16 code units, not the 5 667 345 served
  bytes; the sha256 is the identity evidence.
- **The heavy-lock contention probe was malformed** (`flock` fd-form does not
  accept `-c`) and printed `CONTENTION-PROBE-UNEXPECTEDLY-ACQUIRED`. That output
  is **not** valid evidence the lock was free. The exclusive `flock -w 60 -x 9`
  itself succeeded and was held across the whole run; contention is simply
  **unproven** this session.
- **Hardware adapter not recorded** this session — the page was not queried for
  its renderer string before close. Prior roles on this box recorded
  ANGLE (NVIDIA GB10/PCIe, OpenGL 4.5.0).
- Ordinary keys: none were pressed. No screenshots; there was no critical corner
  to perturb.

## Hygiene

One probe-owned browser, opened in `try/finally`, closed in the `finally`
(`cleanupCompleted: true`). The root preview was never stopped. All 18 surviving
Chromium processes have elapsed times far exceeding this ~15 s session and are
**foreign — none were killed**.

## Artifacts

- `verifier/captures/common-exact-input/attempt-2/location-resolution.json`
- `verifier/captures/common-exact-input/attempt-1/` (preserved failure, empty)
- `verifier/probes/common-exact-input/resolveLocations.mjs` (owned)
- `common-exact-input-runtime-report.json`

## Not a claim

No runtime discriminator result, no acceptance, no defect closure, no chapter
acceptance. Full 18-unit passage, manual UX and full story/score remain out of
scope.
