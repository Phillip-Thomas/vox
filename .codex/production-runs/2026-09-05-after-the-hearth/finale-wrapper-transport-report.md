# finale-wrapper-transport — PREPARED NOT RUN

CPU only. No browser, no GPU, no sink, no recorder, no preview, no build, no game edit.
All 99 manifest-listed game paths rehash clean (1 pre-declared non-binding auxiliary
mismatch on the delta run-profile). The only processes started in this lane were
short-lived `bash`/`flock`/`node` CPU children belonging to the fd-transport check.

## What the direction said was wrong, and what the code does now

**1. The inherited lock fd was dropped at spawn (line 184).**
`stdio: ['ignore','pipe','pipe']` closed fd 9, while the child's preflight requires
`--heavy-lock-fd 9`. Now: `validateInheritedLockFd()` proves the handed descriptor is
open and points at exactly the lock path (the wrapper never opens or flocks anything —
C16b greps for that), and `buildStdio()` keeps 0/1/2, fills 3..8 with `ignore`, and puts
the **parent's** descriptor at **child fd 9**. The child argv carries
`--heavy-lock <path> --heavy-lock-fd 9`, the same number. `verifyHeavyLock` in the probe
is untouched and not weakened.

*Proof (C16), and this is the one part that is genuinely real:* the check runs
`exec 9>LOCK; flock -x 9` in bash, then spawns a real node harness that uses the
**wrapper's own `buildStdio`** to spawn a real node grandchild. The grandchild reports
`readlink(/proc/self/fd/9) == lock`, `fstat(9)` dev+inode identical to the lock file,
and an independent `flock -n -x` that **fails** — the inherited flock is real. It never
takes a second lock: the contention probe is non-blocking and exits immediately.

**2. `sinkIndex: null` could never match a real stream (line 209).**
Real `pactl list sink-inputs` rows carry `Sink: <numeric index>`. Now `resolveSinkIndex()`
parses `pactl list short sinks` and returns the **exact numeric index** of the sink just
created; missing, ambiguous (duplicate name) and non-numeric all **refuse**.
`verifySinkOwnership` refuses outright on an unresolved index instead of quietly
comparing a name. The PID-tree ownership refusal is retained and re-asserted.
C17 uses realistic multi-row pactl fixtures; C17a drives the **actual**
`runCombinedCapture` against them.

**3. The child was never owned through the finally (line 239).**
The child handle is now declared before the `try` and owned from the instant `spawn`
returns. `stopProbe()` runs in the finally on every path: bounded cooperative
`stop-request.json`, then `SIGTERM` **to its own child only**, wait up to 25 s for real
exit, `SIGKILL` with an 8 s bound, then read the probe's `cleanup-receipt.json`. The sink
module is unloaded only after that, and the wrapper exits — which is when root's heavy
lock is released — only after that. The probe gained a bounded stop path: SIGTERM/SIGINT/
SIGHUP and the stop file both go through the **same** `createOwnedSessionGuard.stopOnce()`
that closes the probe's own adopted browser and writes a receipt, with a 20 s unref'd
hard-exit bound. Bring-up and sampler errors still clean up via the existing adopt-first
path. Nothing kills a foreign process, a global chrome or root's 34413 preview — C17e
greps both files for `pkill`/`killall`/`pgrep`/`chrome`/`34413` and finds none.
C17a/C17b/C17c inject real ownership, spawn-`error` and timeout failures into the actual
`runCombinedCapture` and assert **no live child after the finally**, plus the teardown
order recorder → probe → sink unload.

**4. The 360 s bound started after 120 s + 90 s of waiting (line 238).**
One absolute deadline is taken at session start; every wait is bounded by `remaining()`.
C17c proves a 4 s bound finishes in seconds with `sessionDeadlineMs - sessionStartMs == 4000`.
`error` handlers on both the child and the recorder record `spawnErrors` and abort rather
than leaking. Recorder stop+reap and exact-module unload happen on every path.

## Header and ordering

The header said the recorder starts **before** the browser. It does not, and it should not:
own-stream verification is deliberately kept **before** recording, because recording first
means recording an unverified sink. The header now states the actual order —
lock fd validated → sink created → numeric index resolved → browser child → **ownership
verified** → recorder started → probe waited → probe stopped and reaped → sink unloaded —
and C17c asserts `recorder-started` follows `ownership-verified` in the phase log.

## Measurement binding

The guessed `MIN_RECORDER_S = 73.5` and its `coveredCompletionPlusHold` boolean are gone.
`assessCoverage()` reads the probe's **actual** `window.ndjson`, takes the `wallMs` of the
sample whose `edgeVerdict.edge` is true, and requires the recorder's own wallclock interval
to span **edge − 3000 ms through edge + 11500 ms**. Anything less is
`INCOMPLETE-EVIDENCE-RETAINED` with the exact reason; the partial wav and all evidence are
kept and the cue is never replayed or extended. C17d includes the case that a 73.5 s
recording which does not contain the edge is not coverage.

Isolation is unchanged: one unique run-owned sink, `PULSE_SINK` in the child's env only,
the server default never set and re-read afterwards, recording only `<sink>.monitor`, and
ownership re-checked every 15 s during recording with an abort on any foreign stream.

## Checks

`node verifier/probes/finale-window/closure-checks.mjs` → **31/31 pass**
(log: `logs/finale-wrapper-transport/closure-checks.json`).

**Open discrepancy, not cleared:** the older string-search suite
(`finale-window-probe.mjs --self-test`) reports 3 failures —
`installer-reads-avFullHasComplete`, `installer-reads-avFullHasHandback`,
`edge-on-done-plus-history`. That is the same suite whose structural searches missed every
earlier blocker. It covers source strings this lane did not touch, but the file is untracked
so I have **no baseline** and will not claim the failures pre-date me. The executing checks
over exactly that behaviour (C3–C9, which run the actual installer in a vm and the actual
edge predicate) all pass. Root should treat this as unresolved.

## Prepared one-run invocation (root runs it; I did not)

```
cd /home/thomasphillip/Projects/vox/.codex/production-runs/2026-09-05-after-the-hearth && \
exec 9>"/home/thomasphillip/Projects/Paraform/harness/output/.heavy.lock" && flock -x 9 && \
node verifier/probes/finale-window/finale-window-runtime.mjs \
  --out /home/thomasphillip/Projects/vox/.codex/production-runs/2026-09-05-after-the-hearth/verifier/captures/finale-window/window-1 \
  --sink paravoxia_finale_window_20260906 \
  --max-session-s 360 \
  --heavy-lock /home/thomasphillip/Projects/Paraform/harness/output/.heavy.lock \
  --heavy-lock-fd 9 --child-lock-fd 9
```

The wrapper builds the child argv itself and refuses unless the two `--out` values resolve
to the same directory:

```
<node> verifier/probes/finale-window/finale-window-probe.mjs \
  --out finale-window/window-1 --unmuted --pulse-sink paravoxia_finale_window_20260906 \
  --heavy-lock /home/thomasphillip/Projects/Paraform/harness/output/.heavy.lock --heavy-lock-fd 9
```

Preconditions: `verifier-control.json` `activeRole == finale-window-runtime` (it is
currently `common-exact-input-runtime`, so the probe's role gate refuses today);
`verification-ready.json` ready; the pinned immutable 34413 preview running;
`verifier/captures/finale-window/window-1` absent or empty; the heavy lock held by the
invoking shell on fd 9. The lock path is taken from
`verifier/artifacts/verifier-findings.prior-source-58f275f6.json` — **root must confirm it**;
the wrapper refuses if fd 9 does not point at exactly that path.

Read first on completion: `runtime-record.json` → `.coverage.complete`/`.coverage.reason`,
`.cleanupComplete`, `.incompleteCleanup`, `.spawnErrors`, `.teardownErrors`,
`.probeTeardown.browserTeardownProven`.

## Not claimed

No audible, causal, repair or acceptance claim. The fd transport was proven with a real
flock and real node children; the **sink, browser and recorder paths were driven with
fixtures and fake children only** — no real sink, browser or recorder was created here.
Prior lanes' syntax checks and mocks did not prove real fd inheritance, real sink-index
matching or real cleanup, and this report does not inherit those claims.

**Incident disclosed:** I briefly overwrote `finale-wrapper-transport-invocation.json`,
which is the runner's receipt, not mine. I deleted my version rather than fabricate the
original `startedAt`/`commissionSha256`; the runner rewrites that receipt in full when this
session ends, so it will be restored — or simply absent if the runner is killed first.

Runtime status: **PREPARED NOT RUN**.
