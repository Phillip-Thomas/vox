# Targeted CURRENT-scene baseline — mechanical verifier report

Run: `.codex/story-runs/2026-09-06-common-ground` · captured 2026-09-06T05:33:55Z → 05:36:40Z
Scope: software-only (SwiftShader) grounding for two declared targets, on the pre-edit code path.
No hardware/GPU use, no timing, colour, performance, audio, pace, feel or taste approval.

## VERDICT

**Captured — one target grounded, one target MISSING FIXTURE.**

- `origin-a4-worker-w7744`: frames captured at the actual A4 audit work area (pond/shore/hero-tree
  route, player perspective, FOV 75). **W-7744 itself never rendered:** the runtime entity registry
  reports `actor:w7744 mounted=true, visible=false, phase="hidden", position [0,0,0]` at all 7
  samples. No worker silhouette exists to baseline on this code path under this fixture.
- `tidegarden-home-core`: the ACTUAL repaired/installed home core could not be staged. The
  post-station bonded-cell install (`story:ch12-bonded-cell-installed` /
  `story:ch12-hearth-restored`, `stationReturnStory.ts`) has **no beat, no seeder and no debug
  API**. The nearest existing fixture (`?story=ch10-cold`) seeds the settlement *receipts* only;
  `resetDebugStoryRun()` clears Tidegarden world/habitat state, and
  `TidegardenSettlementWorld.tsx` derives `corePosition` from that cleared habitat store, so no
  built core mesh exists. Frames show the marker `habitat core · read the fault · 4m` with no
  core structure at that bearing.

## Fixture disclosure (no natural-journey claim)

Both targets are debug deep-link rehearsals via `?story=<beat>` → `seedForBeat()` in
`main/src/story/storyState.ts`, not played journeys. No new runtime hook, no source edit,
no render change. Read-only debug APIs used: `window.__storyBeat`, `window.__storyTree`,
`window.__paravoxiaAppState`, `window.__paravoxiaBoundaryState`,
`window.__paravoxiaJourneyProbe.getSnapshot()` (`?journeyprobe=1`). `window.__game`
(AgentCamera) was deliberately NOT used — all frames are the player camera.

## Provenance and identity

| Item | Value |
|---|---|
| git revision | `b631a52065a1a69fecac0331e69515c306408641` (+ working tree, unchanged during run) |
| Source aggregate (this script's manifest, 1058 files) | `c55831f083095911da6e2cdd4ec6834b84fcb243737299e521b4695bd4bb2e7b` before build = after build = after captures |
| Build manifest sha256 | `4c9d71ceb6b142ad5e855e72eafc4e1325db44c77f489d8fc04aafc3a28b208e` |
| Relation to the prior immutable snapshot | **byte-identical build aggregate** to the one recorded for `/tmp/paravoxia-preview-pV3HaE/dist` in `software-baseline-verifier-report.md`. That directory no longer exists on disk, so `startParavoxiaPreview({build:true})` produced a fresh owned snapshot; its manifest hash matching proves the same pre-edit code path was served. |
| Preview | `http://127.0.0.1:41021/`, owned by `main/tools/lib/previewServer.mjs`, stopped on exit (0 orphan `vite preview` processes verified) |
| Identity | `document.title === "Paravoxia"` asserted before every capture, both targets |
| Renderer | `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)`, vendor `Google Inc. (Google)` |
| Browser | one instance, `chromium-1217`, `--use-angle=swiftshader --enable-unsafe-swiftshader` |
| Viewport / DPR / profile | 960×540 / 1 / `profile=LOW` |
| Page errors | 0 across both targets |

## Recorded runtime state

Both targets, every sample, from `window.__paravoxiaBoundaryState` (`verified: true`):
`camera.fov = 75`, `camera.perspective = true`, `camera.lookMode = "free"`,
`feedBlend 1`, `sideBlend 1`, `externalCameraMix 0`.

| Target | beat | world | reality.stage | control | signedAuthority |
|---|---|---|---|---|---|
| origin-a4-worker-w7744 | `ch4-audit` | system `-1,-1`, planet `-1,-1` (Origin) | `material` | `fps` / `surface` | `player-camera` |
| tidegarden-home-core | `ch10-cold` | system `-1,-1`, planet `-1,-1:p1` recorded as `-1,-1` in boundary `world` | `alive` | `fps` / `surface` | `player-camera` |

Palette / grade / tier value: **unknown** — no existing runtime metadata exposes them; not invented.

### Target A objective trace (`?story=ch4-audit&movie=1`)

| t (s) | objective id | marker label | health | worker entity |
|---|---|---|---|---|
| 6 | `ch4:audit:attend-fire` | `CAMPFIRE · ATTEND` | ready | hidden, invisible, [0,0,0] |
| 14 | `ch4:audit:attend-life` | `POND SHORE · ATTEND` | ready | hidden, invisible, [0,0,0] |
| 22 | `ch4:audit:attend-life` | `POND SHORE · ATTEND` | ready | hidden, invisible, [0,0,0] |
| 30 | `ch4:audit:attend-life` | `POND SHORE · ATTEND` | ready | hidden, invisible, [0,0,0] |
| 40 | `ch4:audit:attend-tree` | `HERO TREE · ATTEND` | ready | hidden, invisible, [0,0,0] |
| 52 | `ch4:audit:attend-tree` | `HERO TREE · ATTEND` | ready | hidden, invisible, [0,0,0] |
| 66 | `ch4:audit:attend-tree` | `HERO TREE · ATTEND` | ready | hidden, invisible, [0,0,0] |

Hero tree handle `window.__storyTree = [-24, 50.95, 22]` (stable). `prop:field-pack` mounted=false,
phase `absent`, [-16, 51.18, 18].

### Target B objective trace (`?story=ch10-cold`, stationary player, no autopilot)

All 4 samples: objective `station:fault-read`, marker `HABITAT CORE · READ THE FAULT`, health
`ready`, marker distance `4m`, journey entity registry **empty** (0 entities).
Seeded receipts present: `story:ch9:hearth`, `story:complete`,
`story:tidegarden:{relationship-attended, habitat-core-online, shelter-certified,
safe-rest-completed, two-world-handoff, scanner-overload}`,
`story:tidegarden:site-chosen:v1:8,25,-4|8,24,-4|0,1,0`, `story:route:tidegarden:online`.
Absent, as expected: `story:ch12-bonded-cell-installed`, `story:ch12-hearth-restored`.

## Objective defects (mechanical only)

1. `origin-a4-worker-w7744_t006s.png` … `_t066s.png` (all 7, beat `ch4-audit`): standing work-order
   copy reads "FOLLOW W-7744 TO THE CAMPFIRE / POND / TREE" for the whole beat while the referenced
   actor is `phase: "hidden", visible: false` in the entity registry and is not rendered in any
   frame. Copy references a subject that does not exist on screen. (Unambiguous cause from the
   trace: `AuditWorker` mounts but stays in its hidden phase for the entire deep-link rehearsal.)
2. `origin-a4-worker-w7744_t006s.png` (beat `ch4-audit`): objective `CAMPFIRE · ATTEND`, marker
   `campfire · attend · 1m`, no campfire is resolvable anywhere in frame.
3. `tidegarden-home-core_t006s/018s/032s/046s.png` (beat `ch10-cold`): marker
   `habitat core · read the fault · 4m` and copy "STAND AT THE SECOND HEARTH CORE" with no core
   structure visible at that bearing; the only prompt shown is `F Enter Ship`. Cause from source:
   habitat store cleared by `resetDebugStoryRun`, so `corePosition` is null.
4. No blank/black frames, no letterbox or scanline artifact, no wrong-era content, no missing HUD
   element otherwise, 0 page errors. 11/11 PNGs 960×540 rgb24 (`ffprobe`), all hashed.

## Day/night

Not settable by any existing URL/debug API (`setStoryForcedDayPhase` has no exposed hook).
Observed only as the world clock ran: Target B `t006s` is daylight, `t018s/032s/046s` are night
with a moon — a usable day+night pair for that vantage. Target A was night-sky for all 7 samples;
no daylight A frame exists in this run.

## Remaining limitations

- Software SwiftShader only; not the delivered look. Hardware/headed evidence still pending
  (shared hardware lock held by an unrelated Paraform job; not touched).
- No W-7744 silhouette baseline exists. No existing fixture forces `actor:w7744` visible.
- No installed/repaired hearth-core baseline exists. **Missing fixture**, reported rather than
  faked: staging it needs either a ch12 beat seed, a habitat-store test fixture, or a snapshot
  slot — all of which would be new runtime surface, which this commission forbids.
- Player look/aim cannot be directed at the player camera by any existing debug API, so framing is
  whatever the spawn/autopilot pose yields.
- Not measured, not claimed: fps, cadence, smoothness, colour, palette, tier, audio, mobile,
  reduced motion, continuity variants, milestone completion.

## Artifacts

- Script: `/home/thomasphillip/Projects/vox/.codex/story-runs/2026-09-06-common-ground/focused-target-baseline.mjs`
- Evidence root: `/home/thomasphillip/Projects/vox/.codex/story-runs/2026-09-06-common-ground/evidence/targeted-baseline/`
  (`targeted-baseline.json`, `build-manifest.json`, `source-before.json`, `source-after-build.json`,
  `origin-a4-worker-w7744/` ×7 PNG, `tidegarden-home-core/` ×4 PNG)
- Report: `targeted-baseline-report.md` / `targeted-baseline-report.json`

```text
a6702d2dd2d966342632dd208d733faafecc7faa56f7211b47a2d3fb05a140bb  origin-a4-worker-w7744/origin-a4-worker-w7744_t006s.png
335ea30165082186c1f26b1cf3bed4e6700c91c3085c557c6e029d14638f56e7  origin-a4-worker-w7744/origin-a4-worker-w7744_t014s.png
6b9ecf375486f3ee91512e55ce80a99d9c7e03379d89a09c9b98ac782df94475  origin-a4-worker-w7744/origin-a4-worker-w7744_t022s.png
6981aed13ab34ae71766575c6a17ec3e976dcb8d0874fdb6575c4174e84f7cf9  origin-a4-worker-w7744/origin-a4-worker-w7744_t030s.png
10bd6b6fc98a00f80c586ada77b1c2e6d9aafe2c182899ecd392f0d3cc1cf114  origin-a4-worker-w7744/origin-a4-worker-w7744_t040s.png
5184791c68b89809f88be633edb925f6737d8911275b8000d12c8518424306bb  origin-a4-worker-w7744/origin-a4-worker-w7744_t052s.png
43cbe5009562f6976e97b9abed6125b741f72fc8c6e0ed33cfc3755c5dec9862  origin-a4-worker-w7744/origin-a4-worker-w7744_t066s.png
b8536c91419d68195865d9bf1b3cf48421ee7052d6dc921f85755ad1358d7b0b  tidegarden-home-core/tidegarden-home-core_t006s.png
3798a5f6089fe0091ef394624155e678fd208d11b2cba01f84908f24181dfdc8  tidegarden-home-core/tidegarden-home-core_t018s.png
9049fbbd999f5b57d2a381ae6bf26bc20b68e1ca998f22aa07bf419a86b77587  tidegarden-home-core/tidegarden-home-core_t032s.png
6b75db88597ab1be04988b5b802249c6c00376e8bf3bbd984aeddf136b877486  tidegarden-home-core/tidegarden-home-core_t046s.png
```
