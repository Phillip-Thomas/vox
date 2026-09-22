# finale-candidate-runtime — candidate finale state+audio window

**Outcome: CANDIDATE-FINALE-WINDOW-OBTAINED — NO VERDICT.** One actual headed
GB10 finale window was captured, sealed on the real edge, with dense atomic rAF
telemetry and a retained output WAV. This is an observation, not acceptance.

## 1. Private copy-depth repair (pre-GPU)

The prior role's diagnosis of a *missing baseline dependency* is false. The
baseline `verifier/probes/finale-window/` uses `../lib/ownedSession.mjs`
correctly at its own depth; the private copy sits one level deeper under
`manual-credit-finale/`, so the specifier had to become `../../lib/`.

Fixed (3 sites, all in my private folder, none elsewhere):

- `finale-window-fr/finale-window-probe.mjs:423`
- `finale-window-fr/closure-checks.mjs:106`
- `finale-window-fr/closure-checks.mjs:254`

`main/tools` imports were already correct at 7 levels and were left untouched.

**All** relative specifiers in the private files were resolved with
`import.meta.resolve` before any browser launch, every named binding
(`createOwnedSessionGuard`, `failureRecord`, `openParavoxia`, `waitReady`,
`SWIFTSHADER`, `chromePath`, `CHROMIUM_ARGS`, `assertHardwareGl`) was proven to
exist, and `node --check` passed on all four files.

## 2. Whole-PIN audit (pre-GPU)

Compared the entire `EXPECTED` object against `verifier-control.json`,
`preview-ownership.json`, the source manifest and the scene contract.

| field | result |
|---|---|
| manifestSha256 `8962a7b2…` | match |
| contractSha256 `5ef85a32…` (scene-v3) | match |
| previewUrl `http://127.0.0.1:37395/` | match, live, HTTP 200 |
| indexSha256 `a9b88038…` | match |
| bundlePath / bundleSha256 `68c8be84…` | match |
| `sourceFileCount: 99` | **STALE → 100** (manifest has 100 game paths) |
| `activeRole` | **STALE → `finale-candidate-runtime`** |

Both stale fields were corrected *before* the GPU session. Browser launches
spent discovering stale pins: **0**.

## 3. Session

Launcher `verifier/probes/manual-credit-finale/finale-candidate-runtime/run-finale-candidate.sh`
gates on `activeRole == finale-candidate-runtime && action == resume`, opens
`exec 9>` the shared heavy lock, `flock -w 30 -x 9`, then invokes the
**unmodified** `finale-window-runtime.mjs` wrapper with
`--out <abs> --heavy-lock-fd 9 --heavy-lock …/.heavy.lock --max-session-s 135`.

- inherited fd 9 validated in-process: fdTarget, dev/ino `66306:8397196` on both
  sides, `/proc/locks` shows `FLOCK ADVISORY WRITE 2230808`
- headed, `headless:false`; renderer **ANGLE (NVIDIA GB10/PCIe, OpenGL 4.5.0)**;
  hardware adapter asserted; no SwiftShader
- root immutable preview reused (daemon pid 2144696); no new preview
- browser pid 2230833 published by the probe immediately; no global kills
- wall 22:05:42.886Z → 22:07:01.268Z (78.4 s), launcher exit 0

## 4. The window

| measurement | value |
|---|---|
| sealed / reason | true / `window-complete` |
| edge reason | `complete+handback+committed-terra18-worker18` |
| edge at | 63380.8 ms (index 179) |
| pre-edge coverage | 2.99 s (configured 3000 ms; ring not truncated — the 10 ms shortfall is sample cadence, not missing coverage) |
| post-edge coverage | 11.50 s (required 11.5 s) |
| records / rAF frames | 848 records over 4241 observed frames |
| cap hit / sample errors / page errors | false / 0 / 0 |
| atomicity | every field of every record read in ONE synchronous call in ONE rAF callback |

Edge conjuncts at seal: terraUnits **18**, workerUnits **18**, routeUnits
required 18, `committed: true`, `comparisonProved: true`,
`finalReferenceOffered: true`, `anc.cg.complete` **and** `anc.cg.handback` both
in history, `pendingAnchors: []`, activation sequence 13, stage `arrived`.

Story/control at seal: `active:false`, chapter `complete`, beat `done`,
`objectiveId:null`, `avActive:false`, `avSuspended:false`, runId 1.

**Eligible-finale token / deadline / release: UNMEASURED.** No live field with
those names is exposed on any shipped diagnostic surface in this build. What was
recorded instead is `score.finalTextureSeconds` (present-flag true, value null)
plus the anchor/stage conjuncts. This is missing telemetry, not a game failure.

## 5. Audio

Wrapper-owned numeric-index null sink (module 536870913, index 16435); the
system default sink was never changed. Recorder on
`paravoxia_finale_window.monitor` (not a microphone), exit 0.
`owned-sink.wav`: 12,320,812 B, 2ch/44.1 kHz, 69.85 s, peak 10355, whole-file
RMS 1313.2; 5 s RMS probes t0 50.6, t10 45.5, t20 21.2, t30 0.0, t40 86.1,
t50 0.0, t60 3186.9.

Gesture was an ordinary UI click. No forced `AudioContext.resume`, no source or
state setters; the invoked sampler IIFE is preserved.

**PCM/event alignment uncertainty:** the WAV clock begins at recorder start
(wall 1788732349877) while the window clock is page-relative rAF time; the two
were not hardware-synchronised, so per-sample alignment to `edgeAtMs` is only
accurate to the recorder-start offset. **No hearing or taste verdict is drawn
from this numeric envelope.** The source fix removes normal inactive-driver
cancellation but establishes no audible minimum; the existing max-5 s
monotonic / 4.5 s release and all real cancel rules are unchanged.

Signals that remain unobservable (carried forward, unchanged): the final-texture
cancellation reason/calling site, `AudioContext.state`/mute/volume at the
clearing frame, and the App.tsx foreground conjuncts.

## 6. Cancellation variant

Not attempted. It was explicitly optional and only permitted after the normal
window; the remaining clock inside the authorized 10 minutes was insufficient to
run a second GPU session honestly. No deadline extension was invented.

## 7. Teardown and integrity

Cleanup completed, session stopped, no cleanup error, root preview untouched, no
processes killed; browser pid gone, recorder exit 0, **0** null-sink modules
remaining, default sink restored, heavy lock released.

Source rehash: 100 game files, **0** mismatches. Source unchanged; zero game
patches. `manifest 8962a7b2… · contract 5ef85a32… · index a9b88038… · bundle
68c8be84…`

Probe hashes: probe `97da9f8f…`, sampler `c984535d…`, wrapper `a312accb…`,
closure-checks `1dcc5c25…`

Not performed: full verify rerun, three cold movies / recovery / Continue,
chapter acceptance, publishing, and any producer/control/invocation/archive or
source edit. No prior captures were removed. Publication not authorized.
