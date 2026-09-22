# common-manual-focused — manual probe closure (instrumentation only)

`2026-09-06T12:04:12-04:00` → `2026-09-06T12:13:00-04:00` · **no browser, no capture, no GPU lock, no game edit.**
Verdict: **HARNESS-CLOSURE-COMPLETE-NO-GAMEPLAY-PROOF**.

Source frozen at `dc63fbae…adc36c` before **and** after; `find main/src main/tools main/*.json -newermt '2026-09-06 12:03'` is empty.

## Owned files (before → after)

| file | before | after | lines |
|---|---|---|---|
| `common-passage-probe.mjs` | `11c4a7d1…` | `06e2c54d…` | 579 → 718 |
| `commonPassageLogic.mjs` | `6e7cf4f1…` | `79f3e002…` | 697 → 717 |
| `selftest.mjs` | `52b2ba18…` | `116f7d18…` | 204 → 506 |

The prior closure's logic module was **preserved**; it took one targeted correction (below). The two callers were patched, not rewritten.

## Commands / logs (`logs/common-manual-focused-closure/`)

| command | result |
|---|---|
| `node --check` ×3 | CHECK-OK |
| `node selftest.mjs` | `selftest-run-1.log` — **FAIL 82/83** |
| `node selftest.mjs` | `selftest-run-2.log` — **OK 83/83** @ 12:11:19 |
| `node common-passage-probe.mjs` (no args) | `probe-refusal-A-noargs.log` — exit 3, 6 refusals, no browser |
| `--heavy-lock <tmp> --heavy-lock-fd 3` | `probe-refusal-B-unlocked.log` — exit 3, `owned:false` (wrong dev/ino) |
| `exec 9>lock; exec node … --heavy-lock-fd 9` (never flock'd) | `probe-refusal-B2-open-but-unlocked.log` — exit 3, *"the file exists but NO exclusive lock is held"* |
| `exec 9>lock; flock -n -x 9; exec node … --heavy-lock-fd 9` | `probe-refusal-C-reallock.log` — **`owned:true`**, lock refusal gone; still refused on `activeRole=handoff-standby-verifier` and the unbound URL |

## The one logic correction (real kernel semantics, not injected flags)

Run 1 failed the genuine-lock case. Measured on this kernel (6.17.0-1026-nvidia): a flock belongs to the **open file description**, and `/proc/locks` records the pid that *created* the lock — for `flock -n -x 9` that is the transient `flock(1)`, already dead while the lock is still held through the inherited fd. Requiring self-or-ancestor pid therefore misread a genuinely inherited lock as *somebody else's*.

Ownership authority moved to `/proc/<pid>/fdinfo/<fd>`, whose `lock:` line proves the lock is on **our** descriptor (nobody else's lock can appear there). `/proc/locks` is kept as system-wide liveness corroboration and its creator pid is recorded (`procLock`, `procLockCreatorInAncestry`) but is no longer the test.

## Failure cases now covered

- **Lock:** no path · no fd · non-inherited fd · fd for a different file · existing file open but never locked · **live lock held by an unrelated process** (kernel entry seen, not ours) · genuine inherited exclusive lock passes with `contentionProbe: "refused (lock is live)"`. Tests use task-private `mkdtemp` locks; the shared GPU/heavy lock was never opened.
- **Identity:** title+ANGLE+headed with no hashes **fails**; null measured hash with a required expectation fails; served index ≠ owned; served bundle ≠ owned; 404 bundle; unreachable URL; ownership publishing no expected hash; bytes never fetched; foreign URL; `state != running`; manifest drift; missing ownership file. Fixture is a task-private `node:http` server on `127.0.0.1:0`, closed in `finally`.
- **Steering:** uncalibrated → no pulse (leg stops); the old 120 ms floor shown to be 0.618 u vs 0.25–0.6 u radii; near-target pulses now < 120 ms and never command past the target; coast + half-radius subtracted; real ping-pong detected (≥4 flips, ≤0.05 u gain over 6 pulses); steady closing not called oscillation; **an oscillating leg is never an arrival**.
- **Stand clear at E:** she now walks by ordinary keys to **W** (authored *and* observed reached earlier this run) and clearance is measured from the occupied body against her own recorded span. `E.z-3` refused on **provenance** (unobserved water goal), a point on LONG refused because standing on his test is the deadlock, waiting at E measures 0 clearance, an unreached authored pose refused. A real witness prompt is still answered with the authored `[F]`.
- **F gate:** every press goes through `CG_F_CONTRACT` (exact authored objective id + prompt verb) plus a `requires[]` list of already-passed gates. `a-real-drawing-was-recorded` is now a hard stop and an enforced prerequisite of the E offer; the T offer requires the full-18 passage gate.

Preserved: reference/deviation modes, honest return to the missing z≈16 corner after the z=15.82 cut through the omitted ground, full actual Terra 18 and W 18, real H reference, T occupancy, final anchors, distinct capsule/ground/worker readings, labelled `?story=ch13-survey` fixture — **not** free-recorder recovery, **not** full story, **not** first-time-naive usability.

## Exact invocation (for a future, separately authorised capture — NOT authorised now)

```
cd .../verifier/probes/common-manual-focused && bash -c 'exec 9>"$PARAVOXIA_HEAVY_LOCK"; flock -n -x 9 || { echo "heavy lock busy"; exit 9; }; exec node common-passage-probe.mjs --mode reference --url http://127.0.0.1:38007/ --out ../../captures/common-manual-focused/reference-1 --heavy-lock "$PARAVOXIA_HEAVY_LOCK" --heavy-lock-fd 9 --expect-source-manifest dc63fbaeacea44166f41b4d9307bc2e31307fc28845c69512f75c7d641adc36c --probe-lock-contention'
```

`exec 9>lock; flock -n -x 9; exec node` is required so the lock is never dropped before Node starts; `flock -o` must never be used. Current control belongs to **handoff-standby-verifier**, so the probe refuses today (exit 3, no browser) — as run C shows.

## Open instrumentation items (plainly stated)

1. Byte-exact served coverage is the **index + the relevant bundle**; the other build files rest on root's published matched-file **count** (99). Stated in the decision's own `note`, not claimed as full byte coverage.
2. The pulse/oscillation constants are calibrated live, but could not be validated against real in-game motion because no capture was permitted; they are proved only against the measured 0.00515 u/ms and 0.053 u coast quoted from `manual-focused-report.md`.

Cleanup: no task-private lock child running, HTTP fixture closed in `finally`, `/tmp/cmp-*` removed.
