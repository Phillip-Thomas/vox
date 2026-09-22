# Entry input discriminator — one bounded owned diagnostic

**Role** entry-discriminator · **Run** 2026-09-05-after-the-hearth · **Source** dc63fbae…dc36c (unchanged before and after) · **Preview** http://127.0.0.1:38007/ (index 1f699b4a…, bundle 4f39f1ea…) · **Session** ONE headed GB10 cold browser, 1 real canvas click of the 2 allowed, cleaned up in `finally`.

## VERDICT

**POINTER-LOCK-SUCCEEDED.** The question's premise did not reproduce. One ordinary real
canvas click took pointer lock on the **first** attempt at 16:40:59Z — same source, same
preview bytes, same URL `?story=ch13-survey&journeyprobe=1&debug=1`, same headed
ANGLE/GB10 recipe, nine minutes after the 16:31 failure. The 16:31 refusal is **not** a
deterministic property of this build/entry, and **its cause remains unproved**.

## Proved facts (measured this session)

| Fact | Value |
|---|---|
| click → `document.pointerLockElement === canvas` | yes, 15 ms |
| `pointerlockchange` / `pointerlockerror` | 1 / **0** |
| authored `console.warn('Pointer lock request failed:')` | **0** |
| `navigator.maxTouchPoints` | 0 |
| `'ontouchstart' in window` | false |
| `innerWidth` / `matchMedia(pointer:coarse)` | 1280 / false (`pointer:fine` true, `hover:none` false) |
| `isTouchDevice()` recomputed from those facts | **false** |
| shipped touch-controls DOM (`touch-joystick`, `touch-action-cluster`, any `touch-*` testid) | **none mounted** |
| pre-click state | hasFocus true, visible, activeElement body, lockElement null, elementFromPoint(centre) IS canvas (pointerEvents auto) |
| readiness | worldBound true, settle spread 0.0022 u, supported true, policy move 1 / look `free`, movie null, autopilot absent |
| `navigator.userActivation` at click | isActive true, hasBeenActive true |
| W pulse (100 ms, **diagnostic only**) | z −5.999999998 → −6.513055322, displacement **0.513055324 u**, non-zero, lock held |

Because the lock was granted, the authored `CameraControls.handleClick` necessarily passed
**all three** of its clauses (`target === canvas`, no lock held, `allowsMousePointerLock`
true) and `element.requestPointerLock()` **resolved**. There was no early return and no
rejection. The keyboard path is independently enabled.

## Corrections to `common-manual-runtime-report.json`

1. "allowsMousePointerLock passed" was an **assertion, not a measurement** — that probe
   never observed click `pointerType`, `sourceCapabilities.firesTouchEvents`, or
   touchActive / touch-controls DOM. Those facts are measured here (all mouse-compatible,
   no touch UI) but only for the 16:40 session; they cannot be back-applied to 16:31.
2. "the refusal came from the browser/OS layer" is **not established**. That session
   captured no page console, no `pointerlockerror`, no native rejection reason, and never
   measured OS-level window activation. The same recipe now passes, contradicting a
   standing browser/OS refusal.
3. `document.hasFocus() === true` does **not** rule out loss of OS-level window
   activation; the report's `rulesOut` list did not eliminate that candidate.

## Unknowns (explicitly unmeasured)

- **Per-click `pointerType` / `sourceCapabilities` / `isTrusted` were NOT captured.** Both
  read-only observers threw `TypeError: Cannot read properties of undefined (reading
  'toLowerCase')` at click time (2 pageerrors, 16:40:59.153/.155): this probe's own
  `describe()` called `tagName.toLowerCase()` on `event.currentTarget`, which is
  `window`/`document`. Defect in **this probe's bookkeeping only** — the game handler was
  untouched and the lock was granted on that very click.
- What differed at 16:31:26–16:31:38 is unrecoverable: no console, no `pointerlockerror`,
  no native reason, no OS activation state was recorded there, and that session is gone.
- Foreign window / X11 input-focus ownership at either time was not inspected (out of scope).
- A `shader-warmup` warning (`outcome: timeout, elapsedMs 3926`) occurred in this run;
  whether it also occurred at 16:31 is unknown because that console was never captured.

## Cause

**Not proved.** Proved only that under current conditions the shipped entry-input path —
real click → authored `handleClick` → `requestPointerLock` → lock → keyboard movement —
works end to end. OS blame is unsupported by any measurement.

## Minimal next action

1. Do not carry "browser/OS pointer-lock refusal" as a standing blocker: it did not reproduce.
2. Before any re-commissioned manual COMMON run, the **shared** probe (another role's file,
   not edited here) needs three read-only additions inside its existing pointer-lock loop:
   page console capture, a `pointerlockerror` listener, and the click-event fields. A future
   refusal then records its own native reason instead of being inferred.
3. One-line fix to this owned probe before reuse: guard `describe()` against non-Element
   targets.
4. No further manual retry loop from this role.

## Scope

Not manual playability, not a COMMON passage, not a defect closure, not chapter approval,
not a new workflow. Observer-only: no game-state writes, no forced/synthetic clicks, no
`requestPointerLock` call, no handler patch, no overlay hiding, no gate relaxation. The W
pulse instrumented the keyboard path only; no chapter progress was sought or made.
Historical 15:17/15:24 passes remain evidence of earlier success, not current acceptance.

## Artifacts

- `verifier/probes/entry-discriminator/entry-input-discriminator.mjs`
- `verifier/probes/entry-discriminator/commonPassageLogic.pinned.mjs` — byte-identical copy
  (sha256 `24d67c65…9060c`); the original was **not** edited
- `verifier/captures/entry-discriminator/diag-1/` (`summary.json`, `frame-before-click.png`,
  `frame-after-click-1.png`, `frame-after-w-pulse.png`, `frame-final.png`,
  `source-snapshot/`, `after/source-snapshot/`)
- `logs/entry-discriminator/entry-input-discriminator.log`
- `entry-discriminator-report.json`

Frames: all four render the ch13-survey world with HUD, objective card "W-7744 · offer a
route" and the `debug=1` panels. No blank/black frame, no pop, no missing HUD element that
the objective copy references.
