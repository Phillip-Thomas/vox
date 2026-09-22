# finale-window PID closure — PREPARED, NOT RUN

**Lane:** finale-window-pid-closure · **Run:** 2026-09-05-after-the-hearth
**Role:** mechanical probe engineer, CPU-only. SHORT holds the GPU.
**Written by:** this engineer (prthomas0321@gmail.com). The producer and root
*reported* both defects and pre-approved a routine fix; they did not write code.

No browser, GPU, preview, sink, recorder, build, full verify or game run
happened here. Only `node --check`, the focused CPU self-test, and hashing.

---

## Failure 1 — `browser.process()?.pid` was a real throw, not a null-safe read

**Confirmed against the installed driver, not documentation.**
`main/node_modules/playwright-core` @ **1.61.0**, `types/types.d.ts`:

| Fact | Evidence |
|---|---|
| `Browser` has **no** `process()` | `export interface Browser` spans 9949–10693; member scan → `process(): false` |
| `process(): ChildProcess` exists only elsewhere | line **17092** → `ElectronApplication`; line **18431** → `BrowserServer` |
| `newBrowserCDPSession()` **is** on `Browser` | line **10128** |

`chromium.launch()` resolves to that `Browser`. So `browser.process` is
`undefined` and `browser.process()` is a **TypeError**. Optional chaining
*after* the call does not save it. Worse, the expression sat as an **argument to
`cleanup.adopt(...)`** — so it threw *before* the guard owned anything and the
freshly launched headed browser **leaked**.

### What changed

- **Removed** the `browser.process()` call. Not wrapped, not "made safe".
- **New `ownedBrowserPid(browser)`** — a supported route:
  `browser.newBrowserCDPSession()` → `send('SystemInfo.getProcessInfo')` → the
  entry with `type === 'browser'` → its integer `id`. The CDP session is bound
  to the browser *this probe launched*, so the pid can only be that browser's.
  **No pgrep, no ps, no global scan, no foreign or guessed pid.**
  A non-integer / missing entry is a hard error. The session is detached in a
  `finally`, on success and on rejection.
- **Ordering:** `launch → ADOPT → everything fallible`. The pid lookup,
  `newContext`, `newPage`, `goto` and `assertHardwareGl` are *all* after
  adoption, so any of them throwing closes the probe's own browser through the
  same guard, records the real phase, and rethrows the original error.
- **Pid-lookup failure** stops the owned browser, writes `failure.json`
  (phase `owned-browser-pid-lookup`) and a cleanup receipt, and writes **no**
  `browser-pid.json`. The wrapper then refuses to record — *no output capture*,
  and no ownership claim over an unbound process.
- **`stop()` no longer swallows close failure:** `await browser.close()` instead
  of `.close().catch(() => {})`. A failed close now surfaces as the guard's
  `stopError` with `stopped === false`, never as a clean stop.
- **Entrypoint guard:** `main()` runs only when `process.argv[1]` is this
  module, so the self-test can import the *real* startup helper without
  launching anything. The wrapper spawns the probe by absolute path, so `main()`
  still runs under it.

The audio wrapper uses the **actual published pid** for its owned-stream check:
it reads `browser-pid.json`, rejects a null pid, and walks the real `/proc`
parent chain of each sink input on the owned sink.

## Failure 2 — the edge now requires **both** routes at 18

`edgeReason` previously accepted `committed && workerUnits >= 18`. The producer
requires **terra 18 AND worker 18 AND committed AND the exact AV anchors, in one
atomic record**.

- The in-page collector now reads `diagnostic.common.terraUnits` with the *same*
  presence/type guard as `workerUnits`, publishing `terraUnits` (number or
  `null`) and `terraUnitsPresent`. **Absence stays absence** — never `0`, never
  a negative observation.
- The predicate returns `cg-common-fields-absent` unless committed, worker and
  terra are all present and numeric; then it requires `terra18 && worker18 &&
  committed === true`.
- The pre-existing `1e-6` float guard is applied **identically to both sides and
  was not widened**. `17.9` and `6` both fail.
- New reasons: `complete+handback+committed-terra18-worker18` (edge),
  `common-terra-not-18`, `common-worker-not-18`, `common-not-committed`.
- `state.signedSceneAv` (JourneyRuntimeProbeBridge.tsx:244) is **unchanged** —
  the earlier `state.av` was a `readState` wrapper alias; the primary provider
  wins. No other game/predicate change.

## Tests exercise the ACTUAL call site

`C11/C12` **import `finale-window-probe.mjs` and invoke the exported
`startUnmutedOwnedSession()` that `main()` itself calls.** There is no copied
happy-path wrapper. The `Browser` double is **playwright-shaped — it has no
`process` member** — so reintroducing `browser.process()` fails the suite
instead of passing against a Puppeteer-shaped mock.

| Check | What it proves |
|---|---|
| C7 | accepts 18/18 committed + exact anchors; **rejects** worker 18 + terra 6, terra 17.9, missing `terraUnits`, string `"18"`, worker 17.4, both-18-uncommitted |
| C11 | real helper + no-`process()` Browser → pid from the `type === 'browser'` entry; CDP detached |
| C11b | the old call is a genuine TypeError on that shape; source grep fails if `browser.process(` returns |
| C12 ×4 | CDP-attach failure, no browser-type entry, `newContext` failure, `goto` failure → browser closed exactly once, real phase recorded, **no pid published** for both pid cases |
| C12e | `assertHardwareGl` failure closes the adopted browser |
| C12f | a **failing** `browser.close()` → `stopped === false` + `stopError`, never a clean stop |
| C12g | `ownedBrowserPid` rejects a non-integer id and still detaches |

## Commands actually run

| Command | Exit | Result |
|---|---|---|
| `node --check` × 4 owned/verified files | 0 | all parse |
| `node verifier/probes/finale-window/closure-checks.mjs` | **0** | **25/25 focused checks passed** |
| rehash `implementation-source-manifest.json` | 0 | **99 game files rehashed, 0 mismatches** |
| scan `playwright-core` `types.d.ts` for the `Browser` member set | 0 | `process(): false`, `newBrowserCDPSession: true` |

Logs: `logs/finale-window-pid-closure/closure-checks-1.log`,
`logs/finale-window-pid-closure/game-source-rehash.log`.
Previously passing CPU checks were **reused, not rewritten**; no heavy, GPU,
build or full-verify check was re-run.

## Combined wrapper re-verified

Import path (absolute sibling `finale-window-probe.mjs`), `PLAYWRIGHT_CORE_URL`
resolving to `main/node_modules/playwright-core/index.mjs` by file URL, the
inherited-fd `flock` form (`exec 9>heavy.lock; flock -w 60 -x 9`, `--heavy-lock-fd 9`),
and the shared `--out` directory for `browser-pid.json` / `failure.json` /
`cleanup-receipt.json` / `window.ndjson` / `summary.json` / `owned-sink.wav` /
`runtime-record.json` are all still correct. All four files pass `node --check`.
`finale-window-runtime.mjs` and `audio-isolation-plan.json` are **unchanged**.

Audio isolation unchanged: records **only** `${sinkName}.monitor` of the
probe-owned null sink; never the default monitor, never a microphone, never a
foreign stream; never changes the system default sink; a foreign stream on the
owned sink is refused immediately rather than waited out.

## Still missing — not claimed

- **Cancellation reason / caller** — discarded at `commonGroundScore.ts:259`;
  no shipped read-only hook. Timing adjacency is circumstantial, never causal.
- **AudioContext.state / mute / musicVolume** at the clearing frame — no hook.
- **App.tsx `paused` / `hudBlockingOverlayOpen` / downed conjuncts** — no hook.
- **Audibility** — nothing here is an audibility, taste, causal, repair or
  acceptance claim. A recorded window is an observation.

### Remaining unimplemented guards (reported, not hidden)

1. The pid is trusted because Chromium reported it over a CDP session bound to
   the launched browser. There is **no independent cross-check** against a child
   handle — `Browser` exposes none, and a `BrowserServer` route would change the
   shipped launch shape.
2. `SystemInfo.getProcessInfo` is Chromium-only and **has not been exercised
   against a real browser** in this CPU-only lane. Its shape is asserted by mock;
   the first real run is root's.
3. `verifier/probes/lib/ownedSession.mjs` is outside this lane's ownership —
   read, not modified.
4. The unmuted audio path has never been run; no wav exists.

## Preservation

- 99/99 game source hashes **unchanged**, 0 mismatches.
- `finale-window-closure-report.{json,md}` preserved byte-for-byte.
- `iterations/finale-window-initial-preparation` and
  `iterations/finale-window-first-closure` untouched.

**Next:** after SHORT releases the GPU, root runs **one** unmuted combined-state
measurement with isolated own-output capture. This lane makes no claim about
that run's outcome.
