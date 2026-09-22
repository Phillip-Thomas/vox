# Finale-window discriminator — PREPARED, NOT RUN

CPU-only preparation, 2026-09-06T18:18–18:24Z, while the GPU manual lane holds capture authority.
**No audible, causal, repair or acceptance verdict is made here.** No browser, GPU, build, verify
suite, production run, source edit or game mutation occurred.

## New files (owned by this lane only)

| path | sha256 | bytes |
|---|---|---|
| `verifier/probes/finale-window/finale-window-probe.mjs` | `1c06d7997db706e960457bf078e1271b412f31fd3dedcd01c9c47e36e5349adf` | 23929 |
| `verifier/probes/finale-window/windowSampler.mjs` | `cd0daff6e1009181581d18baebba6f90514f8883b296be2b1db47467e82ae2f6` | 15871 |
| `verifier/probes/finale-window/audio-isolation-plan.json` | `80598be940380c4c9f7c2530602597215ea110931ad0843ada2cc803d21424ba` | 5912 |
| `logs/finale-window-prep/selftest.log` | `407401435a2c53545b7afe7a8edfca0a0eca584c8ea4eba52381071e1f65e178` | |
| `logs/finale-window-prep/audio-syntax-check.log` | `0e451d72856cc1998ef0fcd794dfc0dfb337eec5412579bf3217d4ac7092a477` | |

Plus `selftest.rc`, `selftest-start.txt`, `selftest-end.txt`. Nothing else was written; the
`arrival-common-verifier` probes were read only and are byte-unchanged.

## Commands actually run

- `node finale-window-probe.mjs --self-test` — **exit 0**, 33 checks, 0 failures,
  18:22:23.732287283Z → 18:22:23.797096444Z (65 ms). CPU only.
- `bash -n` on the prepared audio sequence + `pactl --help` / `parecord --help` / `pactl info`
  read — **exit 0**, 18:23:09Z. **No module loaded, no sink created, no recorder started, no
  default changed.**

## Prepared command line (root runs it)

```
flock -x $LOCK -c 'exec 9<$LOCK; node .codex/production-runs/2026-09-05-after-the-hearth/\
  verifier/probes/finale-window/finale-window-probe.mjs \
  --out finale-window/window-1 --heavy-lock $LOCK --heavy-lock-fd 9 \
  --probe-lock-contention --seconds 360'
```
Live-output variant: prefix `PULSE_SINK=paravoxia_finale_window` and add `--unmuted`.
URL: `http://127.0.0.1:34413/?story=ch13-survey&journeyprobe=1&debug=1&movie=1`, movie lane,
ordinary shipped autopilot, no key input, no store/pose/anchor/progress/audio writes.
**Prerequisite:** root sets `verifier-control.json` `activeRole = finale-window-runtime`
(it currently reads `arrival-common-earned`, so the probe refuses to start today — by design).

## The measurement

One **synchronous in-page sampling function** per record, run from a rAF callback (bounded
`setTimeout` driver available as a justified fallback). This is the direct fix for E1 of
`finale-lifecycle-audit.json`: the old record stitched three awaited `page.evaluate` reads, so its
story fields were older than its score fields.

- Window: 3 s retained before the completion edge → 11.5 s after it (~14.5 s retained; the
  requirement is ≥11 s after and ~12 s total). Real `performance.now()` + rAF timestamps +
  `performance.timeOrigin` + `Date.now()` per record.
- Edge definition: `beat === 'done' || active === false` **and** complete **and** handback both
  present in AV activation history. A beat-only flip is refused as an edge.
- Sampling continues for the full 11.5 s even though beat is already `done` and the token reads null.
- **CDP discipline:** between arming and sealing the probe takes **zero** screenshots; only a small
  `status()` poll at 2 Hz crosses CDP. The ring buffer is serialized **after** sealing, so no CDP
  round trip can lose the completion edge. One pre-window baseline frame, then exactly three
  post-seal frames, each with its own atomic before/after sample and real shot duration, explicitly
  labelled as *not* the edge and *not* simultaneous with either read.

### Signals exposed and captured
CG snapshot `score.finalTextureSeconds/beat/mood` (present-vs-null distinguished),
`diagnostic.beat`, anchors/pendingAnchors; story `active/chapter/beat/runId`, objective, milestones,
avFull complete+handback, Common Ground units, restoration/world identity; `__voxBundleDiag`
`heldChain` + trace tail; `__voxAudioDiag` route string; `visibilityState`/`hidden`/`hasFocus()`;
`__autopilot` pos+routeAction, `__auditWorker` pos, `__storyBeat`.

### Signals that do NOT exist — preserved as UNAVAILABLE
1. **Cancellation reason / caller** — `commonGroundScore.ts:259` takes `_reason` and discards it.
   No capture, including this one, can name the caller; only timing adjacency, which is
   circumstantial.
2. **AudioContext.state / mute / musicVolume at the clearing frame** — no shipped hook;
   `__voxAudioDiag` returns a route *description string*, not context state. Alternative A1 is
   therefore not excludable by state read.
3. **`paused` / `hudBlockingOverlayOpen` / `downed` / `worldGenReady` / `initialRenderReleased`** —
   React state with no diagnostic surface, so A2's reason label stays indistinguishable.

No debug hook was added and no source was changed to obtain any of these.

## Audio capture — feasible, PREPARED, not executed

- Server is **PipeWire** via pipewire-pulse (`/run/user/1000/pulse/native`); one sink
  `alsa_output.platform-NVDA2014_00.hdmi-stereo`, **no existing null sink**. `pactl`, `parecord`,
  `pw-record`, `ffmpeg` all present.
- Isolation: a probe-owned `module-null-sink` `paravoxia_finale_window`; **only** the probe's own
  Chromium child gets `PULSE_SINK=paravoxia_finale_window`; record that sink's **own monitor**.
  System default sink untouched, no other stream moved, no microphone, and the mixed default
  monitor is never recorded. Before recording, the sink-inputs on the owned sink must be exactly the
  probe child's process tree — a foreign stream aborts rather than yielding a mixed capture.
  Teardown unloads the module in a `finally` and re-checks that it is gone and the default unchanged.
- **`--mute-audio` finding:** `main/tools/lib/previewServer.mjs` `CHROMIUM_ARGS` includes
  `--mute-audio` and `openParavoxia()` offers no override. Every existing capture in this run was
  therefore muted at the browser output stage even with a "running" page AudioContext. The
  `--unmuted` variant reuses the same shipped headed hardware route (`chromePath()`,
  `headless:false`, `CHROMIUM_ARGS` + `--enable-gpu --use-angle=gl`, `assertHardwareGl`) with only
  `--mute-audio` filtered out. No source edit; never headless; never SwiftShader.
- **No shipped in-page tap exists** — `__voxAudioDiag` returns a string only; a real tap would need
  a new hook or a patched global, both refused. Refused substitutions: offline score render,
  default-monitor recording, silent global/AudioContext patching.

## Guards wired into the run

ready flag; **99/99 game paths rehashed (0 mismatches, verified now)**; manifest
`6ef957c3…5d6` MATCH; scene-v3 `5ef85a32…54` MATCH; root preview ownership `running` at
`127.0.0.1:34413`; HTTP index `6c8c378b…` + `<title>Paravoxia</title>` + bundle `efc87feb…`;
no own preview (`preview: { url, stop(){} }`); new empty output dir; `activeRole`
`finale-window-runtime`; inherited exclusive FD-9 flock verified via `/proc/self/fd` and
`/proc/locks` plus a `flock -n` contention probe that must be refused; headed GB10
`assertHardwareGl` (SwiftShader env aborts); post-`finally` cleanup receipt and failure record;
probe dependency bytes archived to `probe-snapshot/` before the measurement.

The only tolerated hash difference is the non-binding, unused
`paravoxia-creative-delta.run-profile.json` already recorded in
`producer-nonbinding-auxiliary-observation.json`. **All 99 game paths are exact and unchanged.**

## Self-test meaning (not a mirror of any test count)

Structural: installer is one arrow body with no async/await and actually reads each required
signal; contains no game write. Termination: still sampling at edge+11 s, seals at edge+11.5 s;
edge requires complete+handback; no-edge and truncated windows are named failures; ring keeps the
pre-edge tail, never trims post-edge, reports a cap hit. Guards: role gate refuses a foreign lane,
lock refuses without an inherited fd, non-empty out dir refused, rehash/manifest/contract pins.

## Root decision needed

Grant `activeRole finale-window-runtime` with the lane's heavy-lock path/fd, and choose the
state-only run, the `--unmuted` live-output run with the owned null sink, or both in that order.
