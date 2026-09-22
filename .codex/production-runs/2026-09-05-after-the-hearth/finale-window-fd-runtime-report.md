# Finale-window FD-check repair + attempted combined measurement

Commission start 2026-09-06T20:07:09Z · report 20:17Z · cap 20 actual minutes (clock-read, not estimated).
Not an acceptance. Nothing published.

## VERDICT

**Private FD-check repair: COMPLETE and proven.**
**Combined finale measurement: NOT OBTAINED** — root reassigned `activeRole` to
`common-physical-discriminator` at **20:13:56Z**, mid-window. The probe's role gate
correctly refused the second launch. This is an external authority change, not a probe fault.

## Repair 1 — verifyHeavyLock inspected the wrong process (the commissioned cause)

Old code: `execFileSync('readlink', ['-f', '/proc/self/fd/9'])`. `/proc/self` resolved
inside the **spawned readlink**, which never inherits fd 9.

Measured in a real held child (unique temp lock, production heavy lock untouched):

| reader | observed |
|---|---|
| in-process `fs.readlinkSync('/proc/self/fd/9')` | `/tmp/finale-window-fdcheck-…​.lock` (the lock) |
| old spawned `readlink -f /proc/self/fd/9` | `/proc/<readlink-pid>/fd/9` |

The old reader did not even error — it returned the readlink process's own `/proc` path,
which can never equal the lock path, so `owned` was **always false**.

Fix: in-process `readlinkSync`, plus `fstatSync(fd)` vs `statSync(path)` **dev+inode**
identity. Kernel exclusive `FLOCK … WRITE` check retained. Contention now accepts **only
flock exit 1**; spawn errors, signals and any other exit status are recorded
`conclusive:false` and **refused** — command errors can no longer be laundered into
contention proof.

### Exercised against the ACTUAL exported `verifyHeavyLock` in real Node children — 7/7

| case | result |
|---|---|
| A held exclusive inherited fd 9 (+contention) | PASS — `owned=true`, no problems, contention exit 1 |
| B missing fd (child-proven-closed descriptor) | PASS — refused, "not open in this process" |
| B2 fd occupied by unrelated pipe | PASS — refused, target + dev/inode mismatch |
| C fd open on the wrong file | PASS — refused |
| D fd 9 open but never flocked | PASS — refused, no kernel lock, second flock won |
| E1/E2 missing fd / missing lock path | PASS — refused |

Case A is the decisive one: it could not have passed under the old code.
This is the exported function under a genuinely inherited descriptor — not a `buildStdio`
re-test. Transport itself was reused from the existing `fd-transport-diagnostic.mjs`.

Three harness attempts are retained (`fd-check-result.attempt{1,2,3}-testfault.json`).
All three were faults in **my harness**, not in the probe — fd 8 held the capture pipe,
fd 21 was open on `/dev/null`, and `exec 21>&-` was reopened by Node. In every case the
probe **correctly refused**. Resolved by having the child select a descriptor it has
*proven* closed, rather than guessing a number.

## Repair 2 — sampler installer never ran (new fault, reachable only after Repair 1)

The lock fix let the run reach a real browser for the first time in this lane. There it hit
`TypeError: Cannot read properties of undefined (reading 'inventory')`.

Cause, proven on the shipped headed Chrome (`evaluate-semantics-check.mjs`):
playwright-core evaluates a **string** pageFunction as an **expression** and ignores the
second argument. `(cfg) => {…}` evaluated to a *function value*, serialised to `undefined`
— **the installer never executed** (`window.__marker` stayed `null`; the invoked-expression
form returned the object and set the marker).

Fix: evaluate `` `(${buildInstallerSource()})(${JSON.stringify(windowCfg)})` `` and hard-fail
unless `installed===true`. `buildInstallerSource` is unchanged, so its fixtures stay valid.
Root's 20:13:56Z control note independently authorizes exactly this correction.

Consequently `sink ownership refused: no-stream-on-owned-sink` was a **downstream effect of
the probe crashing before the game made sound**. It is **not** evidence about game audio.

## Affected rerun only

33/33 CPU self-test PASS · 31/31 focused checks PASS, after both fixes.
No full game verification, no build, no contract gate, no new server.

## Measurement attempts

| attempt | window | outcome |
|---|---|---|
| window-3 first | 20:11:51–20:13:22 | Reached `browser-pid-observed`: real headed browser pid 2018970, renderer **ANGLE (NVIDIA GB10/PCIe, OpenGL 4.5.0)**, unmuted, owned sink created and index-resolved. **First run in this lane ever to launch a browser** (windows 1–2 never did). Crashed at sampler install. Preserved as `window-3-failed-installer-binding`. |
| window-3 second | 20:14:59–20:15:46 | Refused by role gate before launch: `activeRole=common-physical-discriminator`. Not a repeat of any prior fault. |

## Deliberately MISSING — no substitute accepted

Terra18, Worker18, committed, both AV history anchors, the atomic edge record, the output
WAV and its duration/energy, the recording-interval→edge mapping, final-texture token
timing, and the canvas-gesture receipt are all **MISSING**. The cancellation reason and
AudioContext/mute/pause state remain MISSING for the unchanged shipped-hook reason.

**No finale, audibility, cancellation-cause, taste or defect conclusion is drawn.** No
state-only run was substituted, no cue re-triggered, no game predicate changed.

## Source and resources

Manifest `6ef957c3…fee5d6` and contract `5ef85a32…7eec54` **identical before and after**;
99/99 game paths rehashed clean (1 known tolerated auxiliary drift). Game source untouched.

Zero leaked null-sink modules; default sink unchanged
(`alsa_output.platform-NVDA2014_00.hdmi-stereo`); no default monitor/mic or foreign stream
touched; no foreign process killed; no owned browser left running; temp locks removed;
production heavy lock untouched. No producer control, invocation, prior report or iteration
was edited.

## Blocked on

`activeRole` must return to `finale-window-runtime`. The probe is now repaired and ready;
the prepared CLI is in `logs/finale-window-fd-runtime/prepared-cli-window3.txt`.
