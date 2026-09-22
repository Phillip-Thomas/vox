# Production Lock — audio 10x overhaul

Status: locked — bounded runtime mutation authorized on protected audio paths

## Run identity

| Field | Value |
| --- | --- |
| Run ID | `2026-09-04-audio-10x` |
| Mode | `chapter` |
| Scope | The contracted stages of `PARAVOXIA_AUDIO_10X_PLAN.md`: Stage 1 through Stage 5 (shipped audio paths) plus Stage 6 (additive voice bus, contracted where it joins story surfaces). Stage 0 is additive, is not contracted, and is being implemented outside this lock. |
| Date | `2026-09-04` |
| Source revision | `b631a52065a1a69fecac0331e69515c306408641` |
| Run profile | `paravoxia-creative-chapter@v1` (`docs/architecture/workflow-orchestration/run-profiles/paravoxia-creative-chapter.run-profile.json`) |
| Release candidate | `false` |
| Mutation boundary | `bounded-runtime` |
| Budget | deep |
| Canonical preview URL | `http://127.0.0.1:5212` |
| Preview server owner | Pre-existing `main/` vite dev server, pid 95250, started with `PROBE_NO_HMR=1 BROWSER=none npx vite --host 127.0.0.1 --port 5212 --strictPort`. A `vite preview` of the built bundle also runs on `http://127.0.0.1:5231` (pid 88210). Ports 5173, 5174, 5199 and the 3xxxx-range probe ports belong to the sibling Paraform project — never use them. Do not start a duplicate server. Because the 5212 server was started with no file watcher, it serves stale modules after an edit: restart that one server rather than adding a second. |
| Orchestrator | Claude (Fable 5.1) main session, 2026-09-04 |

## Authority

- **Owner direction, 2026-09-04 (direct message).** "implement the full plan" and
  "I trust your judgement on all the questions". That direction does two things:
  it commissions the whole of `PARAVOXIA_AUDIO_10X_PLAN.md`, and it converts the
  four open questions in that plan's section 6 into owner decisions, recorded in
  `human-decision.json` and reproduced under "Owner decisions taken" below.
- **Plan authority: `PARAVOXIA_AUDIO_10X_PLAN.md`** (sha256
  `22f6860018e2007b7cbaf179f68a29ab232d3076ebc41a028e85d5eea1697efd`). Its
  section 3 stage list is the work breakdown; its section 5 composer decisions
  and section 6 "Decisions taken" bind the three directors; its section 7
  scorecard supplies every before-and-after acceptance number.
- **Process authority: `PARAVOXIA_CREATIVE_COUNCIL.md`** — contract freeze, the
  six directed peer notes, three signatures over one contract revision, and the
  cohesion review that this run must pass before any stage is called done.
- **Scope authority: `PARAVOXIA_DEMO_FOUNDATION_PLAN.md`** — the demo release
  surface is unchanged at `ch4-arrival` and publishing remains a separate owner
  decision. This lock grants no publish authority.
- **Score authority: `PARAVOXIA_SCORE.md`** — the harmonic law, motif inventory,
  era ladder and mood grammar this overhaul extends rather than replaces. Its
  section 8.6 smoothness thresholds may only tighten, never loosen.
- **Orchestration authority: `CLAUDE.md`** — model tiering, the three peer
  creative directors, and the protected shipped copy and audio baselines. The
  2026-09-04 owner direction expands the production lane to protected audio
  paths **for the scope of this plan only**; shipped copy stays protected and
  story content is out of scope.
- **Guidance authority: `main/src/story/ux/README.md`** — binding on the Stage 4
  change to `main/src/story/ux/feedbackCues.ts`, which today emits only
  `objective-enter` and gains `progress`, `complete` and `fail`.
- Authority verified at `2026-09-04T21:31:54-04:00`. Runtime mutation permitted:
  **yes**, bounded to the allowed paths below. Publish permitted: **no**.

## Locked scope

Six locked beats, one child scene contract per stage under the parent chapter
contract:

- `audio-stage-1-bed-timbre-mastering` — Stage 1, bed timbre and mastering pass.
  Bed graph construction and per-bar rim, level constants, the music-bus glue
  stage before the safety compressor, and the story reverb impulse. Does not add
  percussion sources, change harmony, arrangement or ladder thresholds, touch
  SFX, or alter the safety compressor's parameters.
- `audio-stage-2-game-mix-buses` — Stage 2, buses, limiter, ducking, snapshots.
  Bus topology, the SFX output join, new pure mix-snapshot and duck-matrix
  modules, SFX awareness in the music director, and snapshot intent written from
  the audio director component. Does not change SFX recipes, add spatialization,
  or alter music-internal topology.
- `audio-stage-3-composed-sync` — Stage 3, composed sync and one harmonic truth.
  The eleven story cue call sites, the signed AV runtime cue line, the emergent
  story director cue line, the mood harmony path, mood *interpretation* with the
  schema unchanged, and a new pure mood-constraint module. Does not change any
  mood entry, dialogue timing, or camera event.
- `audio-stage-4-spatial-sfx` — Stage 4, spatial, varied, roomed SFX. Recipes
  gain seeded per-trigger variation, position and room; call sites pass position
  parameters only; feedback cues gain three new semantic events. Does not change
  music, buses, the limiter, or the loop-guard thresholds.
- `audio-stage-5-long-form` — Stage 5, phrase planner, whole-bar memory and a
  sidechain source. Does not change ladder thresholds, story moods, or the tick
  voice.
- `audio-stage-6-voice-bus` — Stage 6, the narrator's voice as a fidelity of the
  terminal. Additive bus, contracted where it joins story surfaces. Does not
  author words, reveal ontology, or change story timing.

Allowed files and areas (machine list mirrored below):

- `.codex/production-runs/2026-09-04-audio-10x/` — all run artifacts.
- `main/src/audio/` — the engine: bed, score, music, SFX, generative grammar,
  soak and analysis, tuning constants, and the new mix, sfx and voice modules.
- `main/src/components/audio/` — the audio director component and its automation
  cadence.
- `main/src/story/storyScore.ts`, `main/src/story/storyMusicEnvelope.ts`,
  `main/src/story/storyMusicEnvelope.test.ts`,
  `main/src/story/emergentScoreDirector.ts` — the story-side score facade,
  envelope and emergent cue ladder.
- `main/src/story/storyDirector.ts`, `main/src/story/signedSceneAvRuntime.ts`,
  `main/src/story/emergentStoryDirector.ts` — **audio-cue lines only**. The
  eleven cue call sites may move from reactive firing to scheduled, grid-aligned
  hits. Beat logic, ordering, predicates and copy in those files are protected.
- `main/src/story/ux/feedbackCues.ts` — the semantic feedback seam.
- SFX call sites, **position and cue arguments only**:
  `main/src/components/EfficientPlayer.tsx`,
  `main/src/components/ShipController.tsx`,
  `main/src/components/ForageField.tsx`,
  `main/src/components/LooseStoneField.tsx`,
  `main/src/components/miningTrigger.model.ts`,
  `main/src/story/supplyPods.ts`,
  `main/src/story/debrisSalvage.ts`,
  `main/src/story/navWaypoints.ts`,
  `main/src/story/world/HifiWreck.tsx`,
  `main/src/story/world/EmergentAuditSites.tsx`, and the prologue screens
  `main/src/story/prologue/TerminalCorruption.tsx`,
  `main/src/story/prologue/RegulationCrawl.tsx`,
  `main/src/story/prologue/ManifestScreen.tsx`,
  `main/src/story/prologue/VoyageLedger.tsx`,
  `main/src/story/prologue/DebrisDeflection.tsx`,
  `main/src/story/prologue/TerminalPrologue.tsx`.
- `main/tools/` — audio tooling: offline renders, combined-bus probes, the
  spectral-fingerprint regression, the metronome probe, and the score FPS probe.
- `main/package.json` — the `audio:check` step and the scripts the stages add.
- `PARAVOXIA_SCORE.md` — score canon updated to match what ships.
- `PARAVOXIA_AUDIO_10X_PLAN.md` — the section 7 scorecard is filled in with
  measured Stage 0 baselines and per-stage results as they land.

Non-goals, explicit: story content of any kind; new chapters, beats or
milestones; any change to a shipped copy string; world generation, fauna,
post-processing or any visual system EXCEPT the bounded sound-parity
presentation surfaces listed in the amendment below; the demo release surface;
publishing.

**Amendment 2026-09-04T21:49:54-04:00** (orchestrator, under the owner's 2026-09-04
direction to implement the full plan, whose Stage 6 requires captions and
visual parity for sound cues; requested by cinematography-note-01): allowed
paths gain `main/src/ui/hudSurfaces.ts`, `main/src/story/AuditBand.tsx`,
`main/src/components/hud/OxygenMeter.tsx`, and a new
`main/src/components/hud/SoundCaption.tsx` + `soundCaptionTable.ts` (with
tests). Inside those files only sound-caption presentation, the klaxon
ember-pulse parity member, and the oxygen pulse tick above 25 % may change.
Caption vocabulary lives in the caption table (Chapter owns the words,
Cinematography the presentation); `storyText.ts` stays protected.

**Amendment 2026-09-04T21:50:30-04:00** (orchestrator; requested by score-note-01/02):
allowed paths gain `main/src/story/physicalBoarding.ts`,
`main/src/game/spaceStation/spaceStationDock.ts`, and
`main/src/story/ux/objectiveDirector.ts` (+test), bounded to publishing
interior/boarding/dock state for the room-preset signal and emitting an
objective clear-reason (honest completion vs transition clear). No objective
semantics, copy, or beat logic may change.

## Protected paths and strengths

- Protected paths (machine list): `main/public/audio/`,
  `main/src/story/storyText.ts`, `main/src/components/effects/PostFX.tsx`,
  `main/src/utils/proceduralWorldGenerator.ts`,
  `main/src/components/FaunaField.tsx`, `main/story-authority.json`,
  `main/chapter-registry.json`, `main/chapter-journey-contract.json`,
  `firebase.json`, `.firebaserc`.
- Protected within otherwise-allowed files: every shipped copy and dialogue
  string anywhere in the tree; the beat logic of
  `main/src/story/storyDirector.ts` other than audio-cue timing; the argument
  lists of the SFX call sites other than position and cue parameters; the mood
  schema of `main/src/story/storyScore.ts` and the frozen story audio contracts
  it exposes.
- Protected strengths that the overhaul must carry forward intact: the pure-core
  and thin-rim split with its constant discipline; the harmony brain's legality
  model; the soak's independent recomputation and its red tests; the
  start-anchored slew and the smoothness battery, whose thresholds may only
  tighten; the era ladder as narrative; the world-clock tick on its own
  timeline; the audio-core music topology and ramp semantics; the iOS route and
  interruption handling; the armed-until-confirmed unlock; the loop-guard
  thresholds tuned against the mining metronome probe; the oxygen body clock;
  and zero new save fields.
- The hidden-pillar reveal discipline binds Stage 6 absolutely: the voice is a
  fidelity of the terminal, not a character, unless and until the Chapter
  Director approves otherwise through a contract revision.

## Owner decisions taken (2026-09-04)

Recorded in full in `human-decision.json`; summarised here because they set
every level constant and gate in the stage contracts.

1. **Granular vocoder, no text-to-speech.** Deterministic under the run seed,
   era-native, snapped to the published chord's pitch classes. The bus stays
   ready for a later human-voice asset drop.
2. **Loudness: −18 LUFS integrated, −1 dBTP true peak, on the summed game bus.**
   Bed near −20 to −21, BLOOM peaks near −14 short term, leaving 3 to 4 dB for
   SFX transients. −16 LUFS is rejected.
3. **Byte-identical SFX policy is lifted, replaced by recipe-identical.** The
   twenty shipped recipes keep their synthesis shape; seeded per-trigger
   variation, position and room may be added. Protection moves to a
   spectral-fingerprint regression per event in the combined render.
4. **Mobile is a budget, not a gate.** A quality field in the mix snapshot with
   a `full` desktop tier and a `lean` mobile and low tier. Audio main-thread
   cost target 1.5 ms per frame desktop and 3 ms per frame lean. The
   SwiftShader gate stays the release gate.
5. **The production lane is expanded to protected audio paths for the scope of
   this plan.** Shipped copy remains protected; story content stays out of
   scope.

## Execution and evidence budget

| Dimension | Locked value |
| --- | --- |
| Repair loops | per the chapter run profile; stall rule: two consecutive weighted-score gains under 0.05 forces classification before another patch |
| Stage 0 baselines | pulled into `run-summary.md` and the plan's section 7 scorecard when the separate Stage 0 agent finishes; no stage contract may be signed against an unmeasured baseline |
| Audio evidence | combined music-plus-SFX renders only, never score-only, per the audio evidence law |
| Loudness | integrated within 1 LU of target at Stage 1, within 1.5 LU at Stage 2 |
| True peak | at or below −1 dBTP on every combined render |
| Smoothness | zero violations; thresholds may only tighten |
| Score FPS | median at or above 60 on the desktop SwiftShader gate; `lean` proven there with CPU throttled 4 times |
| Headed taste | owner audition of A/B excerpts per stage, on the six owner excerpts; headless proof cannot approve timbre, loudness or feel |
| Model tiering | fable for the three directors and the cohesion judge; opus for verifier, auditors, blind viewer, renders, soaks and probes |

## Stop conditions

- `npm --prefix main run verify` red at any point — stop, record, repair before
  continuing the stage.
- True peak above −1 dBTP on any combined render — stop; the limiter or the
  level constants are wrong, not the gate.
- Any smoothness violation in the battery — stop; the slew law is protected.
- `score:fps` median below 60 on the SwiftShader gate — stop; the stage is over
  budget and must shed voices before it proceeds.
- Any change to a protected copy string — stop immediately and route to the
  owner. This lock does not authorize copy.
- Any needed change outside the allowed paths — stop, record a lock revision
  with its forcing cause, and only then proceed.
- The preview server on port 5212 dies — restart exactly one server in the
  background and re-record ownership here. Never run two.

## Lock disposition

**LOCKED.** Bounded runtime mutation is authorized for the allowed paths above,
under the recorded authority chain, for the six locked beats
`audio-stage-1-bed-timbre-mastering`, `audio-stage-2-game-mix-buses`,
`audio-stage-3-composed-sync`, `audio-stage-4-spatial-sfx`,
`audio-stage-5-long-form` and `audio-stage-6-voice-bus`. Publish is not granted
by this lock; the demo release surface stays at `ch4-arrival`. Frozen at
`2026-09-04T21:31:54-04:00` by the orchestrator. Any change to this lock's scope
requires a new lock revision recorded here with a fresh hash.

## Machine-lock mirror

Material values of `production-lock.json`, mirrored for the deterministic gate:

- schema `paravoxia.productionLock.v1`; runId `2026-09-04-audio-10x`
- mode `chapter`; status `locked`; runProfileRef `paravoxia-creative-chapter@v1`
- releaseCandidate `false`; mutationBoundary `bounded-runtime`; publishAllowed `false`
- sourceRevision `b631a52065a1a69fecac0331e69515c306408641`
- frozenAt `2026-09-04T21:31:54-04:00`; canonicalPreviewUrl `http://127.0.0.1:5212`
- lockedBeats: `audio-stage-1-bed-timbre-mastering`, `audio-stage-2-game-mix-buses`,
  `audio-stage-3-composed-sync`, `audio-stage-4-spatial-sfx`,
  `audio-stage-5-long-form`, `audio-stage-6-voice-bus`
- currentRestrictions: storyCeiling `ch4-arrival`;
  postArrivalStoryMutationAllowed `false`; copyChangeDecisionRefs
  `owner-2026-09-04-audio-lane-expansion`; protectedAudioPaths
  `main/public/audio/`; openGateRefs `stage-0-evidence-floor-baselines`,
  `headed-owner-audition-per-stage`, `true-peak-minus-1-dbtp-combined-render`,
  `score-fps-median-60-swiftshader`
- authority paths: `PARAVOXIA_AUDIO_10X_PLAN.md`; `PARAVOXIA_CREATIVE_COUNCIL.md`;
  `PARAVOXIA_DEMO_FOUNDATION_PLAN.md`; `PARAVOXIA_SCORE.md`; `CLAUDE.md`;
  `main/src/story/ux/README.md`
- allowedPaths: `.codex/production-runs/2026-09-04-audio-10x/`;
  `main/src/audio/`; `main/src/components/audio/`;
  `main/src/story/storyScore.ts`; `main/src/story/storyMusicEnvelope.ts`;
  `main/src/story/storyMusicEnvelope.test.ts`;
  `main/src/story/emergentScoreDirector.ts`; `main/src/story/storyDirector.ts`;
  `main/src/story/signedSceneAvRuntime.ts`;
  `main/src/story/emergentStoryDirector.ts`; `main/src/story/ux/feedbackCues.ts`;
  `main/src/components/EfficientPlayer.tsx`;
  `main/src/components/ShipController.tsx`;
  `main/src/components/ForageField.tsx`;
  `main/src/components/LooseStoneField.tsx`;
  `main/src/components/miningTrigger.model.ts`; `main/src/story/supplyPods.ts`;
  `main/src/story/debrisSalvage.ts`; `main/src/story/navWaypoints.ts`;
  `main/src/story/world/HifiWreck.tsx`;
  `main/src/story/world/EmergentAuditSites.tsx`;
  `main/src/story/prologue/TerminalCorruption.tsx`;
  `main/src/story/prologue/RegulationCrawl.tsx`;
  `main/src/story/prologue/ManifestScreen.tsx`;
  `main/src/story/prologue/VoyageLedger.tsx`;
  `main/src/story/prologue/DebrisDeflection.tsx`;
  `main/src/story/prologue/TerminalPrologue.tsx`; `main/tools/`;
  `main/package.json`; `PARAVOXIA_SCORE.md`; `PARAVOXIA_AUDIO_10X_PLAN.md`
- protectedPaths: `main/public/audio/`; `main/src/story/storyText.ts`;
  `main/src/components/effects/PostFX.tsx`;
  `main/src/utils/proceduralWorldGenerator.ts`;
  `main/src/components/FaunaField.tsx`; `main/story-authority.json`;
  `main/chapter-registry.json`; `main/chapter-journey-contract.json`;
  `firebase.json`; `.firebaserc`


## Amendment log (machine lock has no amendment field; this section is authoritative)

- 2026-09-04T21:49:54-04:00 — orchestrator (production lead) under owner direction 2026-09-04 'implement the full plan': Bounded visual-parity expansion for Stage 6 captions/sound-parity: added main/src/ui/hudSurfaces.ts, main/src/story/AuditBand.tsx, main/src/components/hud/OxygenMeter.tsx, main/src/components/hud/SoundCaption.tsx, main/src/components/hud/SoundCaption.test.tsx, main/src/components/hud/soundCaptionTable.ts, main/src/components/hud/soundCaptionTable.test.ts. Scope inside these files: sound-caption surface, klaxon/oxygen visual parity indicators only. Copy strings remain protected; caption vocabulary is a table owned by Chapter, not storyText.ts. (requested by cinematography-note-01)
- 2026-09-04T21:50:30-04:00 — orchestrator (production lead) under owner direction 2026-09-04: Signal-publication expansion requested by score-note-01/02: main/src/story/physicalBoarding.ts, main/src/game/spaceStation/spaceStationDock.ts, main/src/story/ux/objectiveDirector.ts, main/src/story/ux/objectiveDirector.test.ts. Scope: publishing interior/boarding/dock state to the audio room-preset signal and emitting the objective clear-reason that distinguishes honest completion from transition clear. No objective semantics, copy, or beat logic may change. (requested by score-note-01, score-note-02)
- 2026-09-04T21:59:15-04:00 — orchestrator: CLAUDE.md authority hash refreshed f2f3d6a0→f2f3d6a0: a concurrent session added a 'This machine runs concurrent sessions' guidance section (no authority change). Concurrent-session hazard recorded: storyDirector.ts, objectiveDirector.ts, StoryDirectorDriver.tsx, ux/README.md are being edited by a parallel story-pipeline refactor (see PARAVOXIA_STORY_PIPELINE_REFACTOR_PLAN.md, main/src/story/beats/). Integration must re-read those files immediately before each edit, confine edits to the contracted cue/clear-reason lines, and check mtimes before attributing a gate failure to this run. (requested by —)
- 2026-09-04T22:14:54-04:00 — orchestrator: authority hashes refreshed after Stage 0 rewrote PARAVOXIA_AUDIO_10X_PLAN.md §7 and concurrent sessions changed CLAUDE.md and main/src/story/ux/README.md; Stage 0 open gate closed. Amendment-added allowed paths, mirrored: main/src/components/hud/SoundCaption.tsx, main/src/components/hud/SoundCaption.test.tsx, main/src/components/hud/soundCaptionTable.ts, main/src/components/hud/soundCaptionTable.test.ts, main/src/story/ux/objectiveDirector.ts, main/src/story/ux/objectiveDirector.test.ts, main/src/story/physicalBoarding.ts, main/src/game/spaceStation/spaceStationDock.ts, main/src/ui/hudSurfaces.ts, main/src/story/AuditBand.tsx, main/src/components/hud/OxygenMeter.tsx.
- 2026-09-05T05:16:15-04:00 — orchestrator: authority hashes re-pinned after Stage 1 filled PARAVOXIA_AUDIO_10X_PLAN.md §7 and a concurrent session changed main/src/story/ux/README.md again; UX baseline README hash refreshed to match (audio run did not edit the README).
- 2026-09-05T07:07:23-04:00 — orchestrator: authority hashes re-pinned after Stage 2 updated PARAVOXIA_AUDIO_10X_PLAN.md §7 and PARAVOXIA_SCORE.md §1; UX-baseline source hash for sfxEngine.ts refreshed (contracted Stage 2 change).
- 2026-09-05T07:44:40-04:00 — orchestrator: authority + UX-baseline source hashes re-pinned after draft-v4 and contracted Stage 2/3 edits.
- 2026-09-05T08:05:28-04:00 — orchestrator: allowed paths gain `main/src/audio/voice/` (Stage 6 voice-bus engine, new files only; joins the `voice` category bus via audioCore's public API), `main/src/components/hud/OxygenMeter.test.tsx`, `main/src/story/AuditBand.test.tsx` (parity-member tests). Stage 6 scaffold (captions table, SoundCaption surface, ember/tick parity members, voice grammar + bus) built unwired; wiring follows Stage 4. Two Chapter rulings pending: klaxon site is :1887 not :1881; second terminalAlarm at storyDirector.ts:1270 unruled.
- 2026-09-05T09:56:42-04:00 — orchestrator: authority hashes re-pinned after Stage 3 (plan §7, PARAVOXIA_SCORE.md §4; PARAVOXIA_CREATIVE_COUNCIL.md changed by a concurrent session — content not reviewed here, recorded); allowed paths gain the Stage 3 test files (storyScore.test.ts, storyScore.stage3.test.ts, signedSceneAvRuntime.test.ts, emergentStoryDirector.test.ts, storyDirector.test.ts); UX-baseline source hashes refreshed.
