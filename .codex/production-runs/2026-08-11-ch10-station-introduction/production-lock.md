# Production Lock

Status: locked — bounded runtime mutation authorized

## Run identity

| Field | Value |
| --- | --- |
| Run ID | `2026-08-11-ch10-station-introduction` |
| Mode | `chapter` |
| Scope | ch10 space-station introduction: beats `ch10-cold`, `ch10-ask`, `ch10-transit`, plus the `ST-0` sky-point first perception inside free play |
| Date | `2026-08-11` |
| Source revision | `929e3d0a650fedccd2d04e68db792e09634d416e` |
| Canonical preview URL | `http://localhost:5176` |
| Preview server owner | pre-existing vite dev server inherited from the 2026-08-10 run's baseline capture; serves the live working tree. Ports 5173/5174 belong to the sibling Paraform project — do not use them. Do not start a duplicate server. |
| Orchestrator | Claude (Fable 5) main session, 2026-08-11 |

## Authority

- Governing plan: `PARAVOXIA_DEMO_FOUNDATION_PLAN.md` — **OWNER GATE LIFT 2026-07-28**: "the owner has lifted the post-arrival story gate. Story work beyond `ch9-hearth` is authorized to be designed, built, and registered, including the space-station chapter direction produced by the 2026-07-27 story council."
- Direction candidate entering the triad: `.codex/design-runs/2026-07-27-station-in-the-plot/` (chapter/score/cinematography treatments + INPUT-PACKET + SCOPE-NOTE). These are **unsigned direction candidates**, not canon; this run must author its own `story-intent.md` and freeze its own `scene-contract.json`.
- Owner instruction (2026-08-11, direct message): "Lets push forward paravoxia, incorporate the space station introductions, and overall expand the story and mechanics as we go… please avoid excessive rendering so this accomplishes faster than the ch7-8 rework did."
- Owner sequencing constraints that remain binding: "Do not rush to the station" (satisfied by the closed 2026-08-10 enjoyability repair; this run still ends *outside* the station), and "'Anchorage' is retired as a name — the location is the **space station**."
- Continuity baseline: signed A4→ch9 physical story contract, `.codex/production-runs/2026-07-13-distance-between-fires/scene-contract.json`.
- Feature-plan constraints now active: `PARAVOXIA_STATION_FEATURE_PLAN.md` §7 deferred the register lock (model NPCs = REGULATION voice only) and the blindness prompt boundary "until there is canon to protect." This run creates that canon, so **both bind from this run forward** (no NPCs appear in this run's beats regardless).
- Authority verified at: `2026-08-11T17:06:29-04:00`
- Runtime mutation permitted: **yes**, bounded to the allowed paths below
- Publish permitted: **no**. The demo release surface stays at `ch4-arrival`. ch10 ships to the runtime behind the registry/journey gates only; publishing is a separate owner decision.

## Locked scope

- Included beats: `ch10-cold`, `ch10-ask`, `ch10-transit` (new), plus `ST-0` (a pre-chapter perception inside `done` free play: a moving point of light at the second hearth — no marker, no cue, no name).
- Entry seam: `done` free play after `ch9-hearth`, reality stage `alive`. Exit seam: player holding an issued bearing in space with the station visible as a shape, **not docked, not inside**. The run's cut line is a shot of the station.
- Allowed files/areas:
  - `.codex/production-runs/2026-08-11-ch10-station-introduction/` (all run artifacts)
  - `main/src/story/storyState.ts` + `storyState.test.ts` (beat union, order, milestones, resume ladder, jump aliases)
  - `main/story-authority.json` (runtimeBeatOrder, runtimeStoryCeiling)
  - `main/chapter-registry.json`, `main/chapter-journey-contract.json` (new ch10 chapter object; journey movie lane)
  - `main/tools/chapter-registry-gate.mjs` (stateRef allowlist patterns — producer and pattern land together, per the `b9335b9` precedent)
  - `main/src/story/emergentStoryDirector.ts` + test (entry/tick arms)
  - `main/src/story/storyObjectiveGuidance.ts` (classification per beat)
  - `main/src/story/signedSceneAvRuntime.ts`, `main/src/story/generatedSceneAvRuntime.json` (new signed AV rail for ch10 anchors)
  - `main/src/story/emergentScoreDirector.ts` and story-side score façade (new ch10 cues/moods only; shipped ch1–ch9 cues must regression-prove untouched)
  - `main/src/story/autopilot.ts`, `main/src/story/emergentMovieRuntime.ts` (ch10 autopilot coverage)
  - `main/src/story/storyBoundaryTelemetry.ts` + test (new station stateRef producers if the contract needs them)
  - `main/src/story/storyText.ts` + `storyText.test.ts` (new copy pins)
  - `main/src/components/systemCompanionBodiesModel.ts` (+test) and `main/src/components/SystemCompanionBodies.tsx` (ST-0 sky point via `companionCelestialPlacement`)
  - `main/src/game/spaceStation/spaceStationDevFlag.ts` and minimal call sites (dev flag → milestone-driven story predicate; sandbox `?spacestation=` behavior stays byte-identical)
  - `main/src/state/systemFlight.ts` (bounded: story predicate around the existing `commitSpaceStationTarget`; no new flight mechanics)
- Permitted changes: exactly the chapter-registration chain above plus the two small mechanics items (ST-0 placement, story predicate). Reuse ch8 flight grammar unchanged for `ch10-transit`.
- Non-goals (explicit): `ch10-apron` / `ch10-counter` / `ch10-concourse`; any docking/undocking work or the reload-vs-scene-swap architecture decision (routed to owner as a packet); station interior story, market/economy canon, or any named station character; W-7744 pursuit imagery or audit ember at the station; anything interstellar (**no warp — A5 owns the first jump**; no line may treat another system as reachable; ST-3-style reveals must not compose on `GalaxyImpostors`); Score's continuous-pedal thesis and its 60-minute soak (own packet, deferred); audio-at-the-station (dies at the page swap; deferred with docking).
- Shipped versus draft status: ch10 lands registered-but-unpublished; demo surface unchanged.

## Protected paths and strengths

- Protected paths: `main/public/audio/`, `main/src/audio/`, `main/src/components/audio/` (audio engine — regression proof or reproducible blocking defect only); `firebase.json`, `.firebaserc`; all shipped ch1–ch9 copy (any change requires an explicit owner decision per foundation plan); the frozen seed namespace `paravox:anchorage:v1` and the `:aN` index-suffix worldId grammar (renaming re-rolls every station seed — **never touch**).
- Protected narrative/camera/score strengths: the hidden-pillar deducibility and both-readings law on every line; the ch9-hearth emotional close (ch10 must open from inside free play without retroactively cheapening it); ch8 flight grammar and its shipped feel; the `state:space-station/*` boundary telemetry semantics from `b9335b9` (a station never becomes the resident world); the crowd-as-species rule (no named individual).
- Required owner decisions (routed, not blocking this run): the docking architecture (page reload vs in-place scene swap) before run two; the first-perception stacking question **if** the triad cannot reconcile ST-0 / transit-seam / score-pedal into one signed contract (triad settles it first; owner only on material taste tie); ST-3 FOV taste (deferred with apron).

## Execution and evidence budget

| Dimension | Locked value |
| --- | --- |
| Repair loops | max 3; stall rule: two consecutive weighted-score gains < 0.05 → classify before patching |
| Time/token budget | deep (chapter profile); mechanical probes on opus-tier agents only |
| Target devices | desktop + mobile viewport emulation |
| Quality tiers | state traces at all four registry variants (desktop HIGH, MEDIUM+reduced-motion, LOW, mobile POTATO); frame strips at LOW only |
| Reduced motion | required variant, state trace + LOW strip |
| FPS/frame-time target | no regression vs `fps-baseline` of the 2026-08-10 run at LOW; ST-0 adds ≤1 draw call in free play |
| GPU/draw/shader/memory limits | ST-0 reuses `SystemCompanionBodies` batching; no new shaders in free play |
| Capture density | **owner-directed lean budget**: LOW-tier strips before/at/after each named anchor; HIGH stills at ≤3 hero anchors only (ST-0 sighting, transit seam-of-light reveal, closing station shot); **no webm/full-movie renders** — movie-lane traversal proven by autopilot state trace at LOW with zero timeout rescues |
| Audio evidence | new ch10 cues via deterministic OfflineAudioContext renders + combined-bus excerpts only; no realtime soak this run; protected engine paths untouched |

## Stop conditions

- Any needed change outside the allowed paths → stop, record, route (no scope creep into protected audio or docking).
- The contract cannot be signed without deciding docking architecture → stop; that decision is the owner's packet.
- A director objection at critical/high that cannot close without owner canon → route to owner, do not average.
- Preview server on 5176 dies → restart one server in background, re-record ownership here; never run two.
- Evidence budget breach (any agent starting HIGH-tier strip loops or movie renders) → halt the probe, reroute to state traces.

## Lock disposition

**LOCKED.** Bounded runtime mutation is authorized for the allowed paths above,
under the recorded authority chain, for beats `ch10-cold`, `ch10-ask`,
`ch10-transit` plus the ST-0 free-play prelude. Publish is not granted by this
lock (`publishAllowed: false`); the demo release surface stays at `ch4-arrival`.
Frozen at 2026-08-11T17:06:29-04:00 by the orchestrator. Any change to this
lock's scope requires a new lock revision recorded here with a fresh hash.

**Lock revision R1 (2026-08-11, orchestrator).** `main/tools/creative-triad-gate.mjs`
added to allowedPaths for exactly one semantics-restoring repair: the gate's
mini-validator `jsonTypeMatches` compared `typeof value` against an *array* of
types, so every `equals`/`includes`/`notEquals`/`excludes` journey-contract
assertion failed regardless of value. Proven pre-existing by reproduction on
the passing 2026-08-10 run; `main/chapter-journey-contract.json` itself is
untouched and `chapter:journey:check` passes with zero issues. The one-line fix
makes array-of-types match any member. No other change to that file is
authorized by this revision.

**Lock revision R2 (2026-08-11, orchestrator, post-implementation-iteration-2).**
Six paths added to allowedPaths, all forced by the signed contract's own terms:
`main/src/components/SpaceStationApproachDriver.tsx` (the docking predicate CN-N1
names this shipped surface — it cannot be gated without changing it),
`main/src/story/storyScore.ts` (the prose lock already named "the story-side
score façade"; the machine list had omitted it), `main/src/story/StoryDebugPanel.tsx`
(ch10 jump-alias dev flow surface), the two test twins
`signedSceneAvRuntime.test.ts` / `storyObjectiveGuidance.test.ts` (type-forced
by allowed-file changes), and `main/tools/story-authority-gate.mjs` (the gate
hardcodes `ch9-hearth` as the runtime story ceiling; a run authorized to extend
the story past ch9 must be able to teach the ceiling check its new value).
R2 also authorizes one further creative-triad-gate.mjs repair beyond R1: the
implementation-diff template-token scan now tests added lines for the word-form
tokens only, instead of applying the angle-bracket rule to
TypeScript diff bytes, which flagged every generic type as a template token;
proven against the 2026-08-10 exemplar (copy-only diff, no angle tokens — the
rule had simply never met a TypeScript diff). Machine mirror updated below.

**Lock revision R3 (2026-08-11, orchestrator, post-implementation-round-2).**
Seven paths added for the contract-required wiring the engineer enumerated
without mutating: the story-authority schema
(`docs/architecture/workflow-orchestration/schemas/paravoxia-story-authority.schema.json`,
whose const pins freeze the pre-ch10 beat order and evidence chain — a run
authorized to extend the story must be able to re-pin them);
`main/src/story/StoryDirectorDriver.tsx` (the ch10-cold entry frame host — one
call in the existing story-inactive branch; note this file leaves the UX
baseline's byte-stable source list when changed);
`main/src/game/systems/interactionSystem.ts` and `main/src/story/storyInteractions.ts`
(four interaction ids + four policy rows for the fault-read / craft-attempt /
relay-request / claim verbs); `main/src/game/data/recipes.ts` (authorized ONLY
if the contract's craft-refusal term cannot be honestly met by the interaction
policy row — the engineer must record in the ledger which path was taken);
and `main/src/story/tidegardenLandfallBootstrap.ts` (new file: deep-link
habitat reconstruction so ch10 beats are reachable by direct `?story=` entry,
using already-exported placement/certify calls, plus its two `storyState.ts`
call sites already inside the lock). Protected paths remain untouched; the
engineer's enumeration confirms no candidate lies in the audio engine or
firebase surfaces.

## Machine-lock mirror

Material values of `production-lock.json`, mirrored for the deterministic gate:

- schema `paravoxia.productionLock.v1`; runId `2026-08-11-ch10-station-introduction`
- mode `chapter`; status `locked`; runProfileRef `paravoxia-creative-chapter@v1`
- releaseCandidate `false`; mutationBoundary `bounded-runtime`; publishAllowed `false`
- sourceRevision `929e3d0a650fedccd2d04e68db792e09634d416e`; frozenAt `2026-08-11T17:06:29-04:00`
- canonicalPreviewUrl `http://localhost:5176`
- lockedBeats: `ch10-cold`, `ch10-ask`, `ch10-transit`
- currentRestrictions: storyCeiling `ch4-arrival`; postArrivalStoryMutationAllowed `true`;
  copyChangeDecisionRefs (none); protectedAudioPaths `main/public/audio/`,
  `main/src/audio/`, `main/src/components/audio/`; openGateRefs
  `ch10-docking-architecture-owner-packet`, `score-continuous-pedal-packet`,
  `st3-fov-owner-taste`, `headed-taste-final`, `ch7-ch8-run-owner-residuals`
- authority paths: `PARAVOXIA_DEMO_FOUNDATION_PLAN.md`; `PARAVOXIA_CREATIVE_COUNCIL.md`;
  `PARAVOXIA_STATION_FEATURE_PLAN.md`;
  `.codex/design-runs/2026-07-27-station-in-the-plot/chapter-treatment.md`;
  `.codex/design-runs/2026-07-27-station-in-the-plot/score-treatment.md`;
  `.codex/design-runs/2026-07-27-station-in-the-plot/cinematography-treatment.md`;
  `.codex/design-runs/2026-07-27-station-in-the-plot/INPUT-PACKET.md`;
  `.codex/design-runs/2026-07-27-station-in-the-plot/SCOPE-NOTE.md`;
  `.codex/production-runs/2026-07-13-distance-between-fires/scene-contract.json`;
  `main/src/story/ux/README.md`
- allowedPaths: `.codex/production-runs/2026-08-11-ch10-station-introduction/`;
  `main/src/story/storyState.ts`; `main/src/story/storyState.test.ts`;
  `main/story-authority.json`; `main/chapter-registry.json`;
  `main/chapter-journey-contract.json`; `main/tools/chapter-registry-gate.mjs`;
  `main/tools/creative-triad-gate.mjs`;
  `main/src/story/emergentStoryDirector.ts`; `main/src/story/emergentStoryDirector.test.ts`;
  `main/src/story/storyObjectiveGuidance.ts`; `main/src/story/signedSceneAvRuntime.ts`;
  `main/src/story/generatedSceneAvRuntime.json`; `main/src/story/emergentScoreDirector.ts`;
  `main/src/story/autopilot.ts`; `main/src/story/emergentMovieRuntime.ts`;
  `main/src/story/storyBoundaryTelemetry.ts`; `main/src/story/storyBoundaryTelemetry.test.ts`;
  `main/src/story/storyText.ts`; `main/src/story/storyText.test.ts`;
  `main/src/components/systemCompanionBodiesModel.ts`;
  `main/src/components/systemCompanionBodiesModel.test.ts`;
  `main/src/components/SystemCompanionBodies.tsx`;
  `main/src/game/spaceStation/spaceStationDevFlag.ts`; `main/src/state/systemFlight.ts`;
  `main/src/components/SpaceStationApproachDriver.tsx`; `main/src/story/StoryDebugPanel.tsx`;
  `main/src/story/storyScore.ts`; `main/src/story/signedSceneAvRuntime.test.ts`;
  `main/src/story/storyObjectiveGuidance.test.ts`; `main/tools/story-authority-gate.mjs`;
  `docs/architecture/workflow-orchestration/schemas/paravoxia-story-authority.schema.json`;
  `main/src/story/StoryDirectorDriver.tsx`; `main/src/game/systems/interactionSystem.ts`;
  `main/src/story/storyInteractions.ts`; `main/src/game/data/recipes.ts`;
  `main/src/story/tidegardenLandfallBootstrap.ts`;
  `main/tools/generate-scene-av-runtime.mjs`; `main/src/story/world/StoryWorldProps.tsx`;
  `main/src/story/tidegardenRoute.ts`; `main/src/components/ShipController.tsx`;
  `main/src/game/spaceStation/spaceStationExterior.ts` (R9);
  `main/src/game/spaceStation/spaceStationExterior.test.ts` (R9);
  `main/src/components/spaceStation/SpaceStationExterior.tsx` (R9);
  `main/src/components/SystemSpaceStations.tsx` (R9)

**Lock revision R4 (2026-08-11, orchestrator, Stage 6 interim).**
`main/tools/generate-scene-av-runtime.mjs` added: the generator pins the
2026-07-13 contract as its only expected source (sha + anchor count 66), so
regenerating strips the ch10 signed rail out of `generatedSceneAvRuntime.json`
and `npm run verify` reports the checked-in runtime as stale. The tool must
learn the ch10 draft-v3 contract as a second signed source with re-pinned
expectations, such that regeneration is byte-stable with the checked-in
runtime. Bounded to that change.

**Lock revision R5 (2026-08-11, orchestrator, Stage 6 repair loop).**
`main/src/story/world/StoryWorldProps.tsx` added: its chapter predicate
`/^ch[5-9]$/` (two occurrences) never anticipated a two-digit chapter, so the
WreckRelay prop — the ask beat's central object — does not render in ch10 even
though guidance and interactions resolve. Bounded to making the chapter
predicate ch10-aware (prefer a beat-order comparison over widening the regex);
no other prop-mount behavior may change, and shipped ch5–ch9 mounting must be
regression-proven identical.

**Lock revision R6 (2026-08-11, orchestrator, owner-reported defect root cause).**
`main/src/story/tidegardenRoute.ts` added: `resolveStoryBootWorldId` computes
`tidegardenOwned` from an enumeration that stops at ch9, so ch10 boots on the
origin world — causally proven to produce both owner-reported defects (the
full-size companion-planet shell centred on the camera, and the ground itself
becoming a lockable system body painting the FLIGHT CORRIDOR chip) plus the
worse collateral that ch10-cold/ch10-ask run on the wrong planet's terrain.
Bounded to making the ownership predicate chapter-order aware
(`storyChapterAtLeast` already exists); ch1–ch9 boot-world decisions must be
regression-proven identical. The docking advisory embargo itself was verified
intact and needs no change.

**Lock revision R7 (2026-08-12, orchestrator, movie-lane transit attitude).**
`main/src/components/ShipController.tsx` added: the ch10-transit movie lane
must point the ship at a station, but `AutopilotControls` has no attitude
field and the attitude integration lives at ShipController.tsx:788-806 — the
station bearing is inexpressible without one new directive field consumed
there. Bounded to adding that field and consuming it in the movie-flight
branch; manual-control feel and every ch1–ch9 movie path must be
regression-proven unchanged (the field is absent for all shipped beats).
Faking a ch8 beat name to borrow its branches was correctly rejected.

**Lock revision R8 (2026-08-12, orchestrator, recording an owner action).**
The owner directed a hosting deploy and it was executed:
`firebase deploy --only hosting` to **paravox-game** (11 files, release
complete), serving https://paravox-game.web.app. This spends the publish
decision the lock reserved (`publishAllowed: false`, "publishing is a separate
owner decision"); the machine lock's field is left `false` because the schema
constrains it to that value, so this prose entry is the authoritative record
that publishing occurred and by whose direction.

Recorded honestly about what shipped:
- the deploy went out from a working tree that was **uncommitted at deploy
  time**; it has since been committed as `9a20dde` on
  `agent/paravoxia-story-audio-world-update` (not pushed), so the released
  bundle now has a recoverable revision;
- `firebase.json`'s `predeploy` runs `npm run build` only — **not** `verify` —
  so the deploy went out while `scene:av:check` and `chapter:registry:check`
  were red on a version pin (the contract had advanced to draft-v7 with only
  Chapter's signature). Typecheck, 2,261 tests and the build were green; the
  red checks were governance bookkeeping, not runtime correctness;
- the player-facing release ceiling remains `ch4-arrival` and ch10 is reachable
  only through `?story=` dev entry, so the published surface is unchanged in
  normal play — but all ch10 runtime code is live;
- the deploy was correctly scoped to `--only hosting`, leaving the `auth`
  block in `firebase.json` untouched.

**Lock revision R9 (2026-08-12, orchestrator, berth-ring suppression).** Three
station-exterior paths added — `main/src/game/spaceStation/spaceStationExterior.ts`
(berthStructure), `main/src/components/spaceStation/SpaceStationExterior.tsx`,
`main/src/components/SystemSpaceStations.tsx` — bounded to suppressing
dock-offer geometry in story worlds under the `story:station-docking-authorized`
predicate, per Cinematography's D-A5 ruling. The cyan berth ring currently
renders in the run's own cut-line hero still against the contract's "no dock
offer geometry" term. The `?spacestation=` sandbox reaches the mesh through a
different mount, so mount-level suppression is byte-safe for it by
construction — prove that rather than assume it. No other station-exterior
behaviour may change.

**Tier substitution (2026-08-12).** The Fable weekly limit was reached
mid-amendment; the Score and Cinematography Director agents (fable-tier by
frontmatter) terminated on API error while collecting draft-v7 signatures.
Signature collection was re-run on opus-tier agents. Signing is a verification
act (diff inspection, wording confirmation, hash binding), not creative
authorship, so the substitution does not move creative authority — but it is
recorded here rather than left implicit, and any *new* creative authorship in a
future loop must wait for fable capacity.
- protectedPaths: `main/public/audio/`; `main/src/audio/`; `main/src/components/audio/`;
  `firebase.json`; `.firebaserc`

**Lock revision R9 (2026-08-12, orchestrator, D-A5 berth-ring suppression).**
Granted on the engineer's enumeration. Four paths added to allowedPaths:
`main/src/game/spaceStation/spaceStationExterior.ts` (the builder is the only
place that still knows which boxes are the berth offer — downstream it is two
flat arrays in which a guide arm is indistinguishable from a radiator fin),
`main/src/components/spaceStation/SpaceStationExterior.tsx` (the two instancing
loops that must skip the tagged instances, behind a default-off prop),
`main/src/components/SystemSpaceStations.tsx` (the shipped game's mount, the
only place the `story:station-docking-authorized` predicate may be read for
this purpose), and the type-forced test twin
`main/src/game/spaceStation/spaceStationExterior.test.ts` — the sandbox is a
shipped surface, so its byte-identity is to be PROVEN by test rather than
argued from the mount graph. Bounded to exactly that: no other station-exterior
behaviour may change, the dock itself (jamb frame, lit mouth, inner glow) is
architecture and is not suppressed, and the `?spacestation=` sandbox must draw
instance-for-instance what it draws today. The machine mirror's allowedPaths
list is extended by the same four entries.
