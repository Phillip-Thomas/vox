# common-manual-focused runtime — reference/deviation manual COMMON capture

**VERDICT: BLOCKED BEFORE GAMEPLAY.** Both owned reference sessions stopped at the first
shared prerequisite — the browser refused pointer lock — so the shipped controller never became
active. **No manual COMMON passage was proved, no deviation run, no defect closed.**

The commissioned pre-capture correction was applied before the first browser and passes its
pure tests, but it could not be exercised live.

## What was actually run

| run | mode | started (UTC) | exit | verdict | stopped at | legs |
|---|---|---|---|---|---|---|
| reference-1 | reference | 16:28:06 | 2 | STOPPED-PREREQUISITE | `pointer-lock-and-focus` | 0 |
| reference-2 | reference | 16:31:12 | 2 | STOPPED-PREREQUISITE | `pointer-lock-and-focus` | 0 |
| deviation | — | not run | — | — | — | — |

Deviation was **not** run: it would fail at the identical prerequisite, and the commission
forbids rerunning a known failure.

Gates that did pass, in both runs: browser identity on hardware (ANGLE / NVIDIA GB10, headed,
served index `1f699b4a…`), manual lane (`movie` null, no autopilot), world bound with a
non-initial body, settled supported body (8-sample spread 0.0022 u), story policy permits
movement (`moveSpeedScale 1`, `lookMode free`).

## The blocker

Three ordinary real canvas clicks, 5 s of waiting each:

| measurement | value |
|---|---|
| element at the click point | `canvas`, `isCanvas: true`, `pointerEvents: auto`, `zIndex: auto` |
| `document.pointerLockElement` | `null` |
| `document.hasFocus()` | `true` |
| `document.visibilityState` | `visible` |
| `document.activeElement` | `body` |
| lock acquired | **no**, on all three attempts |

This rules out an overlay eating the click, a lock held elsewhere, a hidden/unfocused document,
an unmet story input policy, and an unready world. `CameraControls.tsx:103` grants the lock when
the target is the canvas, no lock is held and `allowsMousePointerLock` passes — all satisfiable
here — so the refusal is at the **browser/OS layer**, not an unmet game condition. The page's own
`requestPointerLock` rejection reason goes to `console.warn` and this probe does not capture the
console.

The same recipe **passed on this machine and display earlier today** (`GATE PASS
pointer-lock-active` at 15:17:01, 15:21:45, 15:24:29 in the manual-focused role). What changed is
not knowable from inside this role: foreign Chrome processes from other sessions are alive and may
hold the X11 input focus. Per commission no foreign process or window was touched or killed, and
OS window activation could not be measured (no `xdotool`/`xprop` here).

## The one commissioned pre-capture correction

Applied **before the first browser**, to owned probe files only.

Problem: `walkTo(original vertex, arrive 0.6)` can end 0.6 u short of an original corner and then
turn — the body need never cross the signed incoming corner plane. Omitted-corner recovery had the
same weakness at `arrive 0.5`.

Added (pure, in `commonPassageLogic.mjs`):

- `incomingPlaneAt(route, i)` — the ORIGINAL incoming plane at a frozen vertex, normal = unit XZ
  direction of segment `i-1 -> i`.
- `signedPlaneOffset` / `planeLateralOffset` — directional signed offset and in-plane distance
  from the corner.
- `planeCrossingVerdict` — needs an observed sample strictly **before** the plane and a later one
  **on or past** it, within 1.0 u of that corner, `supported: true`; reports overshoot.
- `orderedFrontierVerdict` — crossings in route order, in time order, with the game's own credited
  `terraUnits` finite and non-decreasing across them.
- `earlyTurnVerdict` — the deviation body must measure strictly before the original z=16 plane; an
  overshot 16+ body is refused as *not* the intended deviation.

In the probe, `walkThroughPlane` + `mustCross` replace the 0.6/0.5 radius targets at intended-
completed COMMON vertices: ordinary held keys and the same live calibration, but the termination
condition is an actual crossing, and each pulse is capped by the distance remaining **to the
plane** — short feedback-driven nudges at corners 3/6 and terminal 9 rather than a 0.6 target into
water. A non-crossing stops the probe before any later action or `[F]`.

Nothing was relaxed: no widened epsilon, no forged gate, no state writing, no game geometry or
radius change, and no requirement of exact floating-point coincidence. The chapter's own credited
`terraUnits` remains the proof; the plane predicate is an extra requirement, never a substitute.
Plane predicates apply only at COMMON vertices — navigation to W/S/T/E and the deviation's
excursion legs keep ordinary `walkTo`.

`node selftest.mjs` → **OK 95/95** (83 pre-existing + 12 new), including: a 0.6-short arrival is
not a crossing; a corner cut 2 u off the corner is not the omitted corner; an unsupported crossing
sample cannot close a corner; an unsafe 2 u overshoot is reported; the ordered frontier rejects a
missing/out-of-order vertex and falling credit; an overshot 16+ body is not the deviation;
fail-before-F.

**These predicates have static proof only** — the run never reached COMMON.

## Second, focused repair

Reference-1's failure detail was bare. One focused instrumentation repair recorded *why* the lock
was refused (`pointerLockElement`, `elementFromPoint` at the click point with its computed
`pointer-events`, visibility, active element) and let an ordinary player's repeat click happen up
to three times. **The gate was not relaxed**, and only the invalidated reference work was rerun.
No further repair loop was attempted.

## Integrity

- Source manifest `dc63…36c` before **and** after; 0 game files modified
  (`find main/src main/tools -newermt '2026-09-06 16:24'` → empty). Each capture wrote its own
  before/after `source-snapshot/`; the manifest name alone was never used as the proof.
- Heavy lock `/home/thomasphillip/Projects/Paraform/harness/output/.heavy.lock` fd 9,
  `owned=true`, FLOCK WRITE on inode 8397196, independent contention probe *refused (lock is live)*.
- Preview binding ok: served index `1f699b4a…` and bundle `4f39f1ea…` matched root ownership
  (11 dist files) against the 99-file source manifest. Root's preview was never touched, and no
  other role's process was touched.
- Both probe-owned browser sessions were stopped in the probe's `finally` block.

## Not proved by this role

Survey drawing/offer/W route test, COMMON entry, W at H, Terra's ordered 18, T `[F]` and
occupancy, W's own 18, final commit/anchors/hand-back, and the whole deviation path. Out of scope
as commissioned: hearing, full-story continuity, earned Continue, variants, acceptance,
publication.

The known **movie** stall at COMMON rail cursor 3 (`[-44.6, 51.05, 16]`, Terra 5.8/18) was **not**
inherited as a manual verdict — the manual lane never reached COMMON and says nothing about it.

Closes no defect. Requires independent review.

## Artifacts

- `logs/common-manual-runtime/reference-1.log`, `reference-2.log` (exact command, UTC, real node exit)
- `logs/common-manual-runtime/selftest-after-correction.log`
- `logs/common-manual-runtime/pre-correction-probe-snapshot/` + `SHA256SUMS.txt` (original
  qualified bytes, matching the closure report's `afterSha256`)
- `verifier/captures/common-manual-focused/reference-1/`, `reference-2/`
  (`trace.ndjson`, `summary.json`, `stop-pointer-lock-and-focus.png`, `source-snapshot/`)
