# Finale Window Capture — Continuation Report (window-4)

**Outcome: FINALE-WINDOW-CAPTURED.** Not a chapter acceptance. No audible claim, no
game-audio or plot-fidelity claim.

Transport continuation of the same unfinished finale task, same Chapter 13 run.
Original deadline 2026-09-06T20:27:05.927860Z honoured; no replacement budget, no
re-preparation. The 33+31 focused tests and 7 real FD child checks from the
FD-runtime iteration were reused, not re-run.

## Role grant (read before GPU acquire)

Actual UTC read at 2026-09-06T20:20:19.177831981Z, BEFORE acquiring the shared lock.
`producer-common-physical-finale-gpu-handoff.json` (20:19:30.296786Z) grants
activeRole `finale-window-runtime`; COMMON finished 20:17:51.387753Z with capture
cleanup 20:17:11.566Z and `kernelLockEntries: []`. Acquisition therefore happened on
verified-clean resources. Authority taken from this handoff, not inferred from the
old commission. No reassignment occurred during the attempt; ownership wait 0 s.

## Attempt

| Field | Value |
|---|---|
| Lock acquired | 20:20:28.488Z |
| Wrapper start / end | 20:20:28.553Z / 20:21:47.412Z |
| Whole session | 78.859 s (cap 300 s) |
| Probe elapsed / exit | 71.636 s / 0, not timed out |
| Within original deadline | yes (~5.3 min spare) |
| Private fix needed | no |

New names only: out `verifier/captures/finale-window/window-4`, sink
`paravoxia_finale_window4_20260906`. No earlier capture path renamed or reused.

## Guards

- Preview: existing root immutable `http://127.0.0.1:34413/`, index `6c8c378b…`,
  bundle `efc87feb…`, manifest `6ef957c3…`, 99 game files rehashed, 0 mismatches.
- Headed, **not headless**. Adapter: `ANGLE (NVIDIA Corporation, NVIDIA GB10/PCIe,
  OpenGL 4.5.0)` — actual hardware, no swiftshader.
- Heavy lock fd 9: in-process readlink target match, fd inode 8397196 == path inode,
  1 kernel `/proc/locks` entry, and an actual exclusive contention probe where a
  second `flock -n` exited 1 (refused). All four known-fix paths exercised green.
- Sampler invocation fix confirmed: `journeyProbe.getSnapshot` resolved as
  `function`, `__storyBeat` as `string`; 0 sample errors, 0 page errors.

## Atomic edge — satisfied

Edge sample index 179, wall 1788726092396, reason
`complete+handback+committed-terra18-worker18`:

- committed `true`, terraUnits **18**, workerUnits **18**, routeUnitsRequired 18
- both actual AV anchors: `avHasCgComplete` true AND `avHasCgHandback` true
  (avHistoryCount 12, activationSequence 12, pendingAnchors empty)
- beat `done`, story active `false`, chapter `complete`

All of it read inside ONE synchronous call in ONE rAF callback — not stitched.
Window sealed `window-complete`, 847 atomic samples, cap not hit.

## Audio — isolated own-browser WAV

Own sink `paravoxia_finale_window4_20260906` (index 16256, module 536870913),
recorder on its `.monitor`. Not a microphone, not the default monitor, no default
sink change, no foreign stream, no forced AudioContext, no forced milestone.
Ownership verified and re-verified: the single stream (pid 2036950) lies inside the
probe browser process tree. Route at edge read `game: direct (running)`.

WAV: 12,320,812 bytes, 2 ch, 44.1 kHz, s16, 69.846 s. Coverage complete —
recorder interval spans 3000 ms pre-edge through 11500 ms post-edge in the SAME
capture (edge at 56757 ms into the file; 56757 ms pre, 14980 ms post).

Raw int16 RMS (no audible claim derived):

| Offset from edge | RMS |
|---|---|
| −3000…−2000 | 0.0 |
| −2000…−1000 | 0.0 |
| −1000…0 | 0.0 |
| 0…+1000 | 936.57 |
| +1000…+2000 | 2103.07 |
| +2000…+3000 | 2667.06 |
| +3000…+4000 | 3001.67 |
| +4000…+5000 | 3189.57 |
| +5000…+6000 | 3200.45 |
| +6000…+7000 | 3315.76 |
| +7000…+8000 | 3332.21 |
| +8000…+9000 | 3269.76 |
| +9000…+10000 | 3473.99 |
| +10000…+11000 | 3677.98 |
| +11000…+12000 | 3606.09 |

Required-window RMS 2712.93; whole-file 1357.23. Raw observation only: the three
pre-edge seconds decode to exactly 0.0 on the owned sink and every post-edge second
decodes non-zero and rising.

## Frames

No blank frames, no objective visual defects.

| File | mean luma | min | max | blank |
|---|---|---|---|---|
| 0000-pre-window-baseline.png | 11.2 | 1 | 255 | no |
| 001-post-seal-0.png | 79.2 | 0 | 255 | no |
| 002-post-seal-1.png | 79.2 | 0 | 255 | no |
| 003-post-seal-2.png | 79.1 | 0 | 255 | no |

## Signals not observable (no claim made from them)

- final-texture cancellation reason / calling site — discarded as `_reason` at
  commonGroundScore.ts:259.
- AudioContext.state / musicVolume / mute — `__voxAudioDiag` returns a route
  description string, not context state.
- paused / hudBlockingOverlayOpen / downed / worldGenReady / initialRenderReleased —
  React state, not on any diagnostic surface.

`commonGround.scoreDiagnostic` / `getCommonGroundScoreDiagnostic` resolved
`undefined`; the signed-scene AV member and CG diagnostic were handled by the
sampler as designed and the edge was proved from AV history plus the common-ground
snapshot instead. No correctness or fidelity claim is drawn from the missing state.

## Cleanup

Browser teardown proven; receipt state `stopped`, cleanupCompleted true,
cleanupError null. Root-owned preview untouched, no processes killed, not forced.
Sink module unloaded and verified gone (post-finally grep: 0 matches). Default sink
`alsa_output.platform-NVDA2014_00.hdmi-stereo` unchanged before and after.

## Artifacts

- `verifier/captures/finale-window/window-4/` — runtime-record.json, summary.json,
  window.ndjson, owned-sink.wav, cleanup-receipt.json, browser-pid.json, 4 PNGs
- `logs/finale-window-capture-continuation/` — attempt1-preacquire-utc.txt,
  attempt1-wrapper.log, window-4-artifact-sha256.txt
- `finale-window-capture-continuation-report.json`

No game/build/contract/new-preview/producer-receipt/control/prior-artifact changes.
No probe fixes were required.
