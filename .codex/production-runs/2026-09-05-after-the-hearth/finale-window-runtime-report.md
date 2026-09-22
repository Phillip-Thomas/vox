# finale-window-runtime — combined atomic-state + isolated-output finale measurement

**VERDICT: FAIL — the real route was not reached. Frontier reported, evidence retained, nothing accepted.**

Clock: invocation `startedAt` 19:58:23Z, finished ~20:06Z — **~8 min of the 20 min cap**, measured
from `date -u`, not estimated.

## Gate (read FIRST, before any launch)

| File | Result |
|---|---|
| `finale-wrapper-transport-report.json` | `PREPARED NOT RUN`, 31/31 focused checks, source 99 clean |
| `producer-finale-wrapper-transport-review.json` | `acceptedForBoundedRuntime: true` |
| `verifier-control.json` | `activeRole=finale-window-runtime`, `action=continue` |
| `verification-ready.json` | `ready: true` |

Launch was authorized. Preview `34413` served the pinned index **and** bundle hashes; 99 game files
rehashed clean before and after.

## What was actually measured

**Nothing about the chapter.** Both attempts aborted inside the probe's *pre-browser* guard chain.
No browser, no GPU, no page load, no recorder, no WAV.

Therefore, reported as **NOT MEASURED**, not as negative observations:
finalTexture token timing · score cue · AV anchors · storyActive · visible · focus · done ·
audio duration/peak/energy · output coverage.
`pause` / `AudioContext` / `mute` / `cancelReason` remain **MISSING BY CONSTRUCTION** — unchanged
by this lane.

## Attempts

| Trial | Sink (index) | Probe exit | Actual refusal |
|---|---|---|---|
| `window-1` (original, preserved) | `…20260906` (16082) | 1 @ 276 ms | **discarded by the wrapper** |
| `window-2` (single authorized correction + retry) | `…20260906_w2` (16094) | 1 | `heavy lock: fd 9 points at /proc/<pid>/fd/9, not …/.heavy.lock` |

The wrapper reported only `probe never published browser-pid.json` both times. The retry was **not**
an identical-fault rerun: the harness was corrected first, and that correction is precisely what
exposed the real refusal.

## Authorized private corrections applied

1. **Root-required #1 — real cleanup-receipt shape.** `stopProbe` checked `receipt.stopped` /
   `stopError`, fields the real receipt never publishes, so a *missing* field was read as success.
   Now requires the actual `ownedSessionCleanupReceipt.v1`: `state==='stopped' &&
   cleanupCompleted===true && sessionStopped===true && cleanupError===null` (strictly null — absent
   is not success). `no-session` / `stop-failed` / `stop-invoked-not-confirmed` / `never-requested`
   are retained as **unproved**, never as teardown.
2. **Root-required #2 — 3 stale self-test expectations.** `avFullHasComplete/Handback` →
   `avHasCgComplete/avHasCgHandback/signedSceneAv/activationHistoryAnchorIds`; the positive edge
   fixture now carries the dual-18 committed COMMON route (Terra 18 **and** Worker 18 **and**
   committed) alongside both AV anchors. Negatives preserved, **4 added**
   (`edge-needs-terra-18`, `edge-needs-worker-18`, `edge-needs-committed`,
   `edge-absent-units-are-not-false`). Self-test: **33/3 failed → 37/0 failed**.
3. **The single authorized harness correction.** `probeLog` was persisted only on the success path,
   so an early abort discarded the child console. It is now owned before the `try` and written on
   **every** path.

Applying #1 correctly turned closure-checks C17a/C17c **red**, because their fixtures still emitted
the obsolete `{stopped:true}` — the intended rejection of an unproved shape. Fixtures updated to the
real receipt: **31/31**.

## Frontier — observed vs inferred

**OBSERVED (isolated diagnostic, `logs/finale-window-runtime/fd-transport-diagnostic.mjs`, driving
the wrapper's OWN `buildStdio` under a real `exec 9>LOCK; flock -x 9`):**

- child in-process `readlinkSync('/proc/self/fd/9')` → **the heavy lock path** ✓
- child `/proc/locks` → `FLOCK ADVISORY WRITE` on the lock inode ✓
- child independent `flock -n -x` → **REFUSED** ✓ (exclusivity genuinely held)
- child via *spawned* `readlink -f /proc/self/fd/9` → `/proc/<readlink's own pid>/fd/9` ✗

**The fd transport is correct.** Exclusive fd 9 really is inherited across wrapper **and** child.

**INFERRED (not directly instrumented):** `verifyHeavyLock` resolves the descriptor with
`execFileSync('readlink', ['-f', '/proc/self/fd/9'])`. In that *spawned* readlink, `/proc/self` is
the readlink process, whose own fd 9 is not the inherited lock (node's duped stdio fd is
close-on-exec) — so readlink echoes the unresolved path and **the probe refuses its own valid lock.**

**One-line fix (NOT applied):** resolve the fd with in-process
`fs.readlinkSync('/proc/self/fd/' + fd)` instead of a spawned `readlink`.
Not applied because the single authorized correction/retry was already spent, and the transport lane
pinned *"verifyHeavyLock in the probe is unchanged and not weakened"* as a retained prior fix.
That is root's call, not a routine instrumentation fix.

## Isolation and cleanup

Default sink **unchanged** (`alsa_output.platform-NVDA2014_00.hdmi-stereo`) before and after.
No owned sink or module left loaded. No recorder started, no microphone, no default monitor, no
foreign stream. **No foreign process signalled** — the probe self-exited. Root's 34413 preview
untouched. `browserTeardownProven: false`, honestly: there was no browser to tear down.

## Not claimed

No audible, causal, repair or acceptance claim. Nothing is asserted about the final texture's
lifetime or cancellation cause. The `StoryDirectorDriver`-treats-done-as-visibility-loss suspicion is
neither supported nor refuted here. No gesture proof — no page was ever loaded.
