# Production Lock

Status: locked — bounded runtime mutation authorized

## Run identity

| Field | Value |
| --- | --- |
| Run ID | `2026-09-04-station-interior-light` |
| Mode | `scene` (standard budget) |
| Run profile | `paravoxia-creative-scene@v1` |
| Release candidate | `false` |
| Mutation boundary | `bounded-runtime` |
| Scope | Space-station interior graphics, lighting, and player-experience polish pass. Owner complaint: every district except the concourse reads too dark. |
| Date | `2026-09-04` |
| Source revision | `b631a52065a1a69fecac0331e69515c306408641+working-tree` — commit b631a52065a1a69fecac0331e69515c306408641 plus uncommitted working tree (station files: only `SpaceStationSandbox.tsx` carries a +14-line screening-driver hook from the concurrent audio-10x run; lighting/interior/material/dressing files are clean at HEAD) |
| Canonical preview URL | `http://127.0.0.1:4321` |
| Preview server owner | this run; `npx vite preview --port 4321 --strictPort` serving `main/dist` built at 21:45 from the working tree. Identity check: the served page reports the title tag Paravoxia; verified before every measurement. Port 5199 belongs to another project — never probe it. Rebuild + restart after each implementation iteration; never run two. |
| Orchestrator | Claude (Fable 5.1) main session, 2026-09-04 |

## Authority

- Governing plan: `PARAVOXIA_DEMO_FOUNDATION_PLAN.md` — OWNER GATE LIFT 2026-07-28 authorizes station work through the Creative Triad. `CLAUDE.md` "Story scope" reaffirms it (2026-09-04 revision).
- Owner instruction (2026-09-04, direct message): "Improve the space station graphics, lighting, and the full user experience... it is currently too dark everywhere but the main area".
- Shipped baseline being polished: run `2026-08-11-ch10-station-introduction` (closed, committed 9a20dde, deployed 2026-08-12) and the interior sandbox from `PARAVOXIA_STATION_FEATURE_PLAN.md` Phase A–E.
- Authority verified at: `2026-09-04T21:50:39-04:00`
- Runtime mutation permitted: **yes**, bounded to the allowed paths below.
- Publish permitted: **no**. Demo surface stays at `ch4-arrival`.

## Locked scope

- Included: the interior branch of the station sandbox (`?spacestation=` and the story-mode continuation): district fill and fitting lighting, surface material/albedo, dressing lamp placement and reach, fog, the interior HUD/prompt/crosshair chrome, vendor and story panel presentation, touch controls presentation, and navigation legibility between districts (apron → counter → concourse → floor → shelves).
- Allowed files/areas:
  - `.codex/production-runs/2026-09-04-station-interior-light/`
  - `main/src/components/spaceStation/` (all files; `SpaceStationSandbox.tsx` only in its interior branch, HUD/prompt components, and Canvas render settings — the approach/dock sequence and the screening driver hook stay byte-identical)
  - `main/src/game/spaceStation/spaceStationDressing.ts`, `main/src/game/spaceStation/spaceStationShell.ts`, `main/src/game/spaceStation/spaceStationArchitecture.ts` and their tests `main/src/game/spaceStation/spaceStationDressing.test.ts`, `main/src/game/spaceStation/spaceStationShell.test.ts`, `main/src/game/spaceStation/spaceStationArchitecture.test.ts` (lamp placement, reach, tones, box styles)
  - `main/src/game/spaceStation/spaceStationDevFlag.ts` (new capture/dev query flags only)
  - `main/tools/spaceStation-shots.mjs` (capture harness; flag casing already repaired by the orchestrator before baseline)
  - `main/src/ui/hudSurfaces.ts` (added by lock revision R1 below; appending station surface ids only)
  - `main/tools/creative-triad-gate.mjs` (added by lock revision R2 below; one-verb work-order vocabulary repair only)
- Permitted changes: lighting model (fill table, pool size, reach/illuminance, additional light types), surface tones and material detail, fog, exposure inside the station Canvas only, emissive fittings, HUD/prompt layout/typography/contrast, prompt discoverability, district wayfinding aids (signage, floor guidance) that are visual not textual-canon.
- Non-goals (explicit): audio of any kind at the station (protected + deferred); changes to `PostFX.tsx` or the shared post chain; new story beats, objectives, or copy changes to shipped station story lines in `spaceStationStory.ts` / `storyText.ts`; approach/docking/undocking sequences; the economy/market; the crowd behaviour model (visual legibility of figures under new light is in scope); the exterior; any name change (the location is the space station).
- Shipped versus draft status: lands in the runtime behind the existing station gates; demo surface unchanged.

## Protected paths and strengths

- Protected paths: `main/src/audio/`, `main/src/components/audio/`, `main/public/audio/`; `main/src/components/PostFX.tsx`; `main/src/story/storyDirector.ts`, `main/src/story/StoryDirectorDriver.tsx`; `main/src/story/storyText.ts`; `main/src/game/spaceStation/spaceStationStory.ts` copy; the seed namespace `paravox:anchorage:v1` and worldId grammar; `firebase.json`, `.firebaserc`.
- Protected strengths: the two-instanced-draw interior (light cardinality never changes around a player verb; surfaces stay one material/one program); the district colour script as a *sequence* (cold → clinical → warm → coldest → sodium) — it may be re-exposed but not flattened into one uniform brightness; the concourse as the only room that likes you; the crowd-as-species rule; the both-readings law on any new visible text.

## Execution and evidence budget

| Dimension | Locked value |
| --- | --- |
| Repair loops | max 3; stall rule: two consecutive weighted-score gains < 0.05 → classify before patching |
| Time/token budget | standard (scene profile); mechanical probes on opus-tier agents only |
| Target devices | desktop 1600×900 + mobile viewport emulation |
| Quality tiers | station Canvas has one tier; capture at dpr 1 SwiftShader; headed real-GPU exposure/colour remains an owner gate |
| Reduced motion | no camera motion is added by this run; state-only check |
| FPS/frame-time target | no regression vs baseline probe at 1600×900; programs count unchanged (station material stays one program); ≤ +2 draw calls |
| Capture density | the ten fixed vantages in `spaceStation-shots.mjs` before/after, per-frame mean luminance and percentage of pixels under 16/255, plus mobile HUD stills |
| Audio evidence | none; no audio exists or is added at the station |

## Stop conditions

- Any needed change outside the allowed paths → stop, record, route.
- A director objection at critical/high that cannot close without owner taste → route to owner, do not average.
- Preview on 4321 dies → rebuild, restart one server, re-record here; never run two.
- Verify gate fails on files this run never touched → check timestamps against the concurrent sessions before treating it as ours.

## Lock disposition

**LOCKED.** Frozen at 2026-09-04T21:50:39-04:00 by the orchestrator. Any change to scope requires a new lock revision recorded here.

**Lock revision R1 (2026-09-04, orchestrator, post-treatment).** `main/src/ui/hudSurfaces.ts`
added to allowedPaths, bounded to appending station surface ids (`station-*`) to
`HUD_SURFACE_IDS` and their layer assignments, so the station's prompt, crosshair,
story HUD and marker become visible to `tools/hud-overlap-sweep.mjs`. Reason: the
Cinematography treatment verified the registry carries zero station ids, and the
lock's own HUD-legibility scope cannot be proven without registration. No existing
id, layer, or exemption may change under this revision. Machine mirror updated.

**Lock revision R2 (2026-09-04, orchestrator, pre-signature gate).** `main/tools/creative-triad-gate.mjs`
added to allowedPaths for exactly one vocabulary repair: the `interact` work-order
verb list gains `present`. The shipped, protected G2 work order ends "PRESENT THE
HABITAT FAULT RECORD." — an interact verb in plain English that the list never
met, because the ch11 interior objectives were registered after the vocabulary
was written. Precedent: ch10 lock revisions R1/R2 on the same file. No other change
to that file is authorized by this revision. Machine mirror updated.
