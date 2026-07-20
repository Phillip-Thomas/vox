# Claude Fable Handoff — Paravoxia

Date: **2026-07-20**

Repository: `/home/thomasphillip/Projects/vox`

Audience: a fresh Claude Fable orchestration session taking over the current Paravoxia checkpoint.

This is the current orientation document. It distinguishes live implementation,
mechanical evidence, creative approval, and release authority. Those are separate
states in this repository.

## 1. Read this first

The repository is on branch `agent/paravoxia-story-audio-world-update` at
`9cee8d0c650c95f49cfa1636672afeaa6d2e45fb`, matching its upstream branch. The
meaningful current checkpoint is **not committed**:

- 144 tracked files are modified.
- 35 pre-existing paths are untracked; this handoff is one additional untracked
  file, so a fresh `git status` should report 36.
- The tracked diff is approximately 6,270 insertions and 993 deletions.
- The worktree contains several intentionally overlapping story, UX, gameplay,
  multiplayer, workflow, evidence, and documentation batches.

Do **not** reset, clean, stash, rebase, checkout over, or broadly rewrite this
worktree. Do not assume `HEAD` represents current behavior. Preserve untracked
files: some are imported by tracked code and some are the only current workflow
or browser evidence.

Before doing anything, run only read-only orientation:

```bash
cd /home/thomasphillip/Projects/vox
git status --short --branch
git diff --stat
git diff --check
```

At handoff time, `git diff --check` is clean.

### Current one-paragraph state

The worktree implements the post-arrival “Distance Between Fires” story candidate
through `ch9-hearth`, a substantially stronger objective/directional-guidance
system, a decluttered mobile HUD, two-unit-tall canonical walls with one-unit half
walls, larger tree yields, live obstacle navigation for fauna, and a subtle
presentation-only ephemeris for sibling planets. Current client and server checks
are green, but the story candidate is not creatively accepted or release-approved.
Both production locks say `releaseCandidate: false` and `publishAllowed: false`.
The latest building/economy work also changes the shared multiplayer protocol from
v1 to v2, so any future release of this worktree must pair the state server and
client.

## 2. Fable operating contract and token discipline

Read `CLAUDE.md` first for model and context discipline. Its old blanket wording
against post-arrival mutation has been superseded only by the explicit owner
overrides recorded in the current demo plan and production locks. Its model,
orchestration, review, and publish-separation rules remain binding.

Fable is scarce and should be used only for creative construction or taste-critical
judgment:

- Fable/inherit: Chapter Director, Score Director, Cinematography Director,
  Story Alignment Judge, and Scene Cohesion Judge.
- Opus: blind readers/viewers, canon and continuity auditors, player-experience
  auditor, `story-verifier`, `implementation-correctness-auditor`, and other
  independent reviews.
- Opus: repository search, log triage, document inventory, probes, builds, and
  other mechanical work. Reserve Haiku for trivial greps.
- A mechanical or general-purpose subagent must never inherit Fable.

Keep the main session as orchestrator. Do not load the entire story/design corpus
into one context. Delegate bounded reads and keep conclusions plus exact path and
section references. Run long probes and builds outside the Fable creative context;
read concise summaries and evidence artifacts, not complete logs.

For guided-play changes, require both:

1. objective/marker/work-order/feedback lifecycle evidence from a verifier; and
2. a fresh, independent, read-only player-experience audit.

Neither role patches. Directors do not approve their own work. Patch roles do not
publish. Headless or software-rendered evidence does not approve beauty, motion
feel, audible mix, or real-GPU performance.

After a chapter or review is finished, remind the owner to use `/clear` before the
next task. Suggest `/compact` before a long build phase if context is already large.

## 3. Source-of-truth and reading order

Do not treat every old plan as equally current. Use this order and load only the
lane-relevant subset.

| Concern | Current authority | How to use it |
| --- | --- | --- |
| Agent/model operation | `CLAUDE.md` | Current for Fable tiering, context hygiene, role separation, and verification ownership. Its pre-override mutation sentence is historical. |
| Playable implementation truth | Current `main/src/`, `server/src/`, and observed runtime behavior | Code and runtime are truth for what the candidate actually does. They do not override canon, creative acceptance, or publication authority. |
| Mutation and public release | `PARAVOXIA_DEMO_FOUNDATION_PLAN.md` plus each run's `production-lock.json` | Current authority. Owner overrides permit bounded post-arrival implementation; they do not grant creative approval or publication. |
| Machine-readable story boundary | `main/story-authority.json` | Useful 2026-07-15 snapshot: worktree candidate reaches `ch9-hearth` and public story ceiling remains `ch4-arrival`. Its gate list still includes the now-complete three-cold-run gate, so do not treat every status field as current. |
| Raw story source | `PARAVOXIA_SYNOPSIS.txt` | Lineage/raw source. Resolve canon through the Bible and execution plan rather than treating every raw idea as settled. |
| Canon and source hierarchy | `main/PARAVOXIA_STORY_BIBLE.md` | Primary current canon authority. Preserve explicit TBDs and proposal-only material. |
| Current story sequence and gates | `main/PARAVOXIA_STORY_EXECUTION_PLAN.md` | Current implementation/resume sequencing. |
| Shipped/public story | `main/STORY.md` | Useful runtime pointer, but some prose is historical; cross-check the authority map and registry. |
| Chapter definitions | `main/chapter-registry.json` | Current chapter IDs, evidence lanes, and boundary metadata. |
| Guided journey contract | `main/chapter-journey-contract.json` | Current but untracked. Governs objective/action/marker/lifecycle and escaped-defect scenarios. Do not lose it. |
| Objective and HUD contract | `main/src/story/ux/README.md` | Executable UX contract for objective, exact marker, standing work order, feedback, and enter/change/clear/reset behavior. |
| Ch4–Ch9 candidate | `main/PARAVOXIA_EMERGENT_STORY_BATCH_PLAN.md` and `.codex/production-runs/2026-07-13-distance-between-fires/scene-contract.json` | The signed implementation treatment. Scene-contract SHA-256 is `3367b94f9f0fcef14b6158f61e5cd3e3262afa3ae86b4b9574803e3ac48bb47e`. |
| Creative process | `PARAVOXIA_CREATIVE_COUNCIL.md`, `.claude/skills/creative-triad/SKILL.md` | Current role topology and evidence process; old no-post-arrival wording is superseded only where explicit locks allow work. |
| Cinematography and score | `main/CINEMATOGRAPHY.md`, `PARAVOXIA_SCORE.md` | Discipline-specific authority. Audio paths remain protected unless a separately authorized lane opens them. |
| Multiplayer continuity | `main/MULTIPLAYER_IMPLEMENTATION_CHECKLIST.md` | Use for co-op/server compatibility and remaining launch work, not as the current story checkpoint. |
| Multi-planet architecture | `PARAVOXIA_MULTI_PLANET_SYSTEM_PLAN.md` | Current system-travel architecture. Its Section 18 performance/persistence resume list remains open. |
| Economy architecture history | `main/docs/planet-system-handoff.md` | June 22 historical migration context only; its worktree inventory is stale. |
| Idea parking lot | `TODO.md` | Non-authoritative backlog. Do not infer permission or current state from it. |

`PARAVOXIA_CH4_PLAN.md`, `PARAVOXIA_REVISION_PLAN.md`,
`PARAVOXIA_PROGRESSION.md`, older claims in `main/CRAFTING.md` and
`main/MULTIPLAYER.md`, and parts of `main/STORY.md` are lineage or historical
context. Consult them only when a current authority explicitly points back to them.

## 4. Terra workflow system we have been using

The Terra pattern is evidence-first and tool/model agnostic. A run composes the
five pillars—Knowledge, Retrieval, Judgement, Resources, and Personality—through
bounded context packs, adapter bindings, role contracts, run profiles, rubrics,
defect taxonomies, gates, and durable artifacts. A run must remain resumable,
inspectable, and honest about missing adapters or human decisions.

The common system sequence is:

```text
frame → survey → plan → implement → verify → critique → bounded repair
      → deterministic score → lessons
```

Keep these invariants:

- Patch roles cannot publish.
- Review/acceptance roles do not patch the candidate they judge.
- Concrete commands and tools belong in adapter bindings, not portable workflow
  definitions.
- Score, category floor, blockers, defects, exceptions, evidence, and lessons are
  explicit artifacts.
- Creative approval and release/publish approval are separate owner decisions.
- Direct-entry/debug evidence is never silently promoted to continuity proof.

### 4.1 Formal system-orchestrator run actually executed

The formal Terra run is:

```text
.terra/workflow-runs/system-orchestrator/paravoxia-emergent-2026-07-13/
```

Important files:

- `run.json` — resumable workflow state.
- `artifacts/task-brief.md`
- `artifacts/repo-survey.md`
- `artifacts/system-context.md`
- `artifacts/implementation-plan.md`
- `artifacts/implementation.diff`
- `artifacts/check-results.json`
- `artifacts/runtime-report.json`
- `artifacts/critic-report.md`
- `artifacts/defects.json`
- `artifacts/final-scorecard.json`
- `artifacts/run-summary.md`
- `artifacts/lessons-learned.md`

Disposition: `completed` for the scoped implementation candidate, **not** release
or publish. It scored 4.612/5 against a 4.5 threshold; the lowest category was
4.4 against a 4.0 floor. The official POTATO cold runs `v6-01`, `v6-02`, and
`v6-03` each passed `ch4-audit` through `done`, saw 64/64 signed anchors, and had
zero rescues/nudges, dry-route water violations, runtime errors, reloads, or
context losses. All five declared adapter requirements remain unbound; completion
means the scoped artifact workflow finished, not that every release adapter exists.

The formal workflow source lives in the sibling Terra repository:

```text
../TerraForm/docs/architecture/workflow-orchestration/examples/system-orchestrator.workflow.json
../TerraForm/docs/architecture/workflow-orchestration/run-profiles/system-standard.run-profile.json
../TerraForm/docs/architecture/workflow-orchestration/rubrics/system-quality.rubric.json
../TerraForm/docs/architecture/workflow-orchestration/context-packs/terra-global.context.json
../TerraForm/docs/architecture/workflow-orchestration/context-packs/orchestrator-authoring.context.json
```

The old run is evidence for its frozen candidate, not for today's dirty worktree.
Current checks report three stale authority/schema failures. Within its authority
list, the demo plan and emergent batch plan hashes have drifted, while the Bible and
execution-plan hashes still match. Rebaseline exact authority hashes, schemas, and
candidate revision before claiming a new Terra gate pass.

### 4.2 Paravoxia Creative Triad

Use this for a new scene, substantial recut, awakening, audiovisual polish, or a
repair that changes creative intent. It is the exact three-director topology:

1. Chapter Director
2. Score Director
3. Cinematography Director

Player Experience is an independent audit, not a fourth creative lane. Integration
is a patch lane, not a director. The three directors work independently, exchange
durable peer notes, reconcile dissent, and sign one immutable scene contract before
implementation.

Repo-local workflow package:

```text
docs/architecture/workflow-orchestration/examples/paravoxia-creative-triad.workflow.json
docs/architecture/workflow-orchestration/context-packs/paravoxia-creative-triad.context.json
docs/architecture/workflow-orchestration/run-profiles/paravoxia-creative-{delta,scene,chapter,flagship}.run-profile.json
docs/architecture/workflow-orchestration/rubrics/paravoxia-creative-cohesion.rubric.json
docs/architecture/workflow-orchestration/defect-taxonomies/paravoxia-creative.defect-taxonomy.json
.terra/context-source-bindings/paravoxia-creative-triad.local.json
.codex/production-runs/_template/
```

Production sequence:

```text
authority lock → shipped visual/UX baseline → chapter intent
→ independent Score and Cinema treatments → cross-notes/reconciliation/dissent
→ signed scene contract → one integration patch lane → mechanical evidence
→ five independent first-wave reviews → moderator synthesis → cohesion judge
→ bounded repair → final score
→ conditional human taste → separate publish decision
```

Create and gate a new production directory with:

```bash
cp -R .codex/production-runs/_template \
  .codex/production-runs/YYYY-MM-DD-scene-name

npm --prefix main run creative:gate -- \
  --run .codex/production-runs/YYYY-MM-DD-scene-name --phase contract

npm --prefix main run creative:gate -- \
  --run .codex/production-runs/YYYY-MM-DD-scene-name --phase implementation

npm --prefix main run creative:gate -- \
  --run .codex/production-runs/YYYY-MM-DD-scene-name --phase final
```

Normal scene approval is weighted 4.75 with a 4.3 category floor. Flagship
approval is weighted 4.8 with a 4.5 floor and requires headed real-GPU human taste.
Passing those thresholds still does not authorize publication.

The July 13 and July 17 production directories use these governed conventions,
but they are repo-local production records rather than formal Terra `WorkflowRun`
records. File presence is not proof of completion: templates are intentionally red
until populated, and the Chapter 9 scorecard/human-decision/lesson state remains
incomplete.

### 4.3 Story Council

Use the Story Council **before** scene production when changing whole-story plot,
canon, character agency, reveal order, or reconciling conflicting story documents.
It is docs-only under the current lock and cannot authorize runtime changes.

```text
docs/architecture/workflow-orchestration/examples/paravoxia-story-council.workflow.json
docs/architecture/workflow-orchestration/run-profiles/paravoxia-story-reconciliation.run-profile.json
docs/architecture/workflow-orchestration/rubrics/paravoxia-story-cohesion.rubric.json
docs/architecture/workflow-orchestration/defect-taxonomies/paravoxia-story.defect-taxonomy.json
```

The workflow is available and validated, but there is no recent executed
`run.json` proving it was used for this checkpoint. Do not describe it as completed.

### 4.4 Read-only Chapter Acceptance

Use this only to judge an exact implemented chapter candidate after its authority,
previous boundary, next boundary, mechanical evidence, and audiovisual evidence are
frozen. It runs independent Story, Score, Cinematography, UX, blind-viewer, and
implementation-correctness reviews, then a cohesion judge. A failure emits a
bounded repair commission back to a separate Creative Triad run; acceptance never
patches its own candidate.

Iterative mechanical check:

```bash
npm --prefix main run chapter:accept -- \
  --chapter <chapter-id> --candidate-revision "$(git rev-parse HEAD)"
```

That command cannot certify this dirty worktree. The acceptance operator requires
an exact, clean, checked-out candidate revision; first freeze the intended candidate
without sweeping unrelated work into it.

The workflow operator requires explicit structured read-only runners:

```bash
export PARAVOXIA_STORY_CREATIVE_RUNNER_ARGV_JSON='["<read-only-runner>","$PROMPT_PATH","$RESULT_PATH"]'
export PARAVOXIA_STORY_REVIEW_RUNNER_ARGV_JSON='["<independent-read-only-runner>","$PROMPT_PATH","$RESULT_PATH"]'
```

Then start or resume with `npm --prefix main run chapter:accept:workflow -- ...`.
See `docs/architecture/workflow-orchestration/README.md` for the complete arguments.

Current limitation: only synthetic lifecycle smoke state exists under
`.terra/workflow-runs/paravoxia-chapter-acceptance/`. It is honestly blocked.
There is no real accepted chapter run. The binding lacks an evidence-backed
deterministic executor for all inventory, conformance, AV, integrity, and quality
artifact sets; honest blockers include `missing_role_runner_configuration`,
`missing_deterministic_adapter`, and `human_operator_required`.

Do not resume `lifecycle-smoke` as if it were a real chapter review.

### 4.5 Frontend/mobile design run

The recent mobile HUD work followed the design-orchestrator artifact convention:

```text
.codex/design-runs/2026-07-19-mobile-hud-declutter/
```

It contains product framing, repo survey, three design directions, selected
direction, implementation plan, screenshot report, adversarial critique, scorecard,
run summary, and lessons. It scored 4.791/5 with no blocking/high defects in its
final matrix. It has no Terra `run.json`, artifact-quality report, or final human
decision, so call it convention-backed design evidence—not formal Terra approval.

### 4.6 Workflow chooser

| Requested work | Workflow/profile |
| --- | --- |
| Gameplay/system functionality | `system-orchestrator@v1` pattern |
| Small objective/marker repair with unchanged meaning | Creative Triad `delta` profile; Chapter owns meaning, Cinema owns visible routing/occlusion, Integration wires it, UX audits it. Do not reopen Score unless audio intent changes. |
| Scene or audiovisual change | Creative Triad scene/chapter/flagship profile by scope |
| Plot/canon/reveal restructuring | Story Council first, then a separately authorized Creative Triad run |
| Final judgment of an implemented chapter | Read-only Chapter Acceptance, only after its missing adapters/evidence are genuinely supplied |
| Mobile or general interface redesign | Design-orchestrator evidence sequence, composed with the Paravoxia UX/creative context |

## 5. Recent implementation checkpoint

### 5.1 Post-arrival story candidate: “Distance Between Fires”

The worktree carries physical/runtime story from the W-7744 audit arrival through:

- Chapter 5 Maw repair
- Chapter 6 underwater recovery
- Chapter 7 reconstruction and boarding
- Chapter 8 launch, same-system crossing, and Tidegarden landfall
- Chapter 9 settlement, shelter, safe rest, and the second hearth

It supports offline movie mode and uses authoritative multiplayer gameplay paths
for co-op. That does **not** close story authority: client story receipts do not
replace server-issued or independently validated embodied story proof. The
implementation run's three official cold traces passed, but eight release gates
remain:

1. server-issued embodied story receipts;
2. HIGH/MEDIUM/LOW/POTATO profile matrix;
3. reduced-motion equivalence;
4. supported headed input;
5. headed real-GPU audiovisual/taste review;
6. Origin → sibling → Origin → sibling persistence round trip;
7. Tidegarden support/water authority disposition; and
8. explicit human release decision.

The public demo still ends at `ch4-arrival`. The broader candidate may be developed
under recorded owner overrides but may not be inferred as published canon.

Canon guardrails: preserve the intended emotional endpoint of wonder; keep W-7744's
external arc and Worker 9's hidden internal moral arc distinct; retain the Terra
overlap without collapsing it into a definitive answer; and keep Makers,
simulation/cosmology, and the final-frame meaning explicitly unresolved where the
Bible says TBD.

Protected baseline unless a new authorized lane says otherwise:

```text
main/public/audio/
main/src/audio/
main/src/components/audio/
main/src/story/emergentScoreDirector.ts
```

### 5.2 Directional indicators and governed journey guidance

The marker system now supports two different spaces:

- `surface`: cube-face-aware guidance, deterministic cross-face routing, stable
  antipodal latching, horizon behavior, and no arbitrary seam fallback;
- `spatial`: true 3D flight/orbital objectives with camera-relative range and
  projection.

`FreeMarker.tsx` provides the projected diamond/edge-chevron presentation, avoids
objective/HUD/top-chrome occlusion, and hides unstable first-frame layout. Objective
meaning comes from the story director; surface route truth is shared with
`planCrossFaceSurfaceLeg()` in `main/src/story/autopilotSteering.ts`. Do not invent
a second HUD-only route planner.

Primary files:

```text
main/src/story/directionalMarker.ts
main/src/story/FreeMarker.tsx
main/src/story/autopilotSteering.ts
main/src/story/StoryDirectorDriver.tsx
main/src/story/storyDirector.ts
main/src/story/storyObjectiveGuidance.ts
main/src/story/tidegardenRoute.ts
main/src/story/ux/StoryGuidanceHud.tsx
main/src/story/ux/storyHudLayout.ts
main/src/story/directionalMarker.test.ts
main/src/story/storyDirector.test.ts
main/src/story/tidegardenRoute.test.ts
main/chapter-journey-contract.json
main/tools/chapter-journey-contract-gate.mjs
main/tools/chapter-journey-probe.mjs
main/tools/objective-hud-probe.mjs
```

Objective-HUD evidence is duplicated under root
`.codex/design-runs/2026-07-16-objective-hud-consistency/` and
`main/.codex/design-runs/2026-07-16-objective-hud-consistency/`. The newer
`main/.codex/.../final` captures are the better raw visual reference, but neither
location overrides journey, creative, or release authority.

The recovered July 19 session concerned the Chapter 1 anomaly cross-face marker:

- likely prior session thread: `019f5bcf-44e1-79d2-b3d2-4ef29264078f`;
- forensic transcript, only if exact prior dialogue is genuinely needed:
  `/home/thomasphillip/.codex/sessions/2026/07/13/rollout-2026-07-13T10-08-58-019f5bcf-44e1-79d2-b3d2-4ef29264078f.jsonl`;
- the closed session ended with
  `main/captures/objective-hud/cross-face-direction-20260719/objective-hud-report.json`
  and a live wait that remained on the calibration objective instead of reaching
  `ch1:anomaly:classify-mass`.

Post-recovery continuation produced newer evidence:

- evidence:
  `main/captures/objective-hud/cross-face-direction-20260719-resume/live-directional-proof.json`;
- the NVIDIA proof passed top-to-right-face ownership, finite placement, horizon
  routing, no arbitrary fallback, and no seam flip;
- it is explicitly a `direct-entry-diagnostic` with
  `continuityCertified: false` and used movie autopilot plus a movie-only physics
  nudge.

Do not redo the routing implementation. The honest remaining indicator gate is to
add a cross-face escaped-defect scenario to the journey contract and run continuous,
headed, supported/trusted-input traversal from the predecessor chapter without the
movie-only nudge. Wait for the exact beat/objective phase before asserting marker
presence.

A secondary related prior session is
`019f6614-24d8-7903-b08a-335f1b65f6cb`, covering Chapter 8 spatial indicators,
Tidegarden routing, and the older deployment.

### 5.3 Chapter 9 guidance repair

Run directory:

```text
.codex/production-runs/2026-07-17-ch9-guidance-repair/
```

Implemented repairs include Tidegarden-owned stable targets, required-over-optional
interaction arbitration, reachable automatic-play approaches, correct crafting
handoff, and visual stability. Its objective-HUD matrix passed 4/4 and a direct-entry
automatic movie reached `done`.

That run remains `in_review`. Open defects are:

- high: `ch9-score-authority-handoff`;
- medium: `ch9-continuity-certification`;
- medium: `ch9-headed-real-gpu-taste`;
- low: `global-marker-transition-frame-parity`.

Its score categories and weighted score are null. Continuous Chapter 8 → Chapter 9
and reload continuation are not certified. `chapter-journey-evidence.json` is still
a zero-scenario/template-incomplete artifact despite other real evidence in the
directory. `human-decision.json` and lessons state are also incomplete. Do not infer
creative acceptance from the directory's size or from its historical Hosting deploy.

### 5.4 Mobile HUD declutter

The “Quiet Field Rail” direction is implemented:

- Journal, Suit, Pack, and Systems are compact, mutually exclusive disclosure
  owners;
- the objective marker and critical warnings remain immediate;
- modal/open states pause story, input, and physics safely;
- desktop behavior is preserved;
- final screenshot geometry asserted non-intersection across ten captures.

The design run passed at 4.791/5. Human playtest remains open. Four contextual action
buttons are still persistent; reducing them is a separate control-design cycle.
The design run's 1,726-test verification predates the newest cross-face indicator
patch, so use current verification for code truth rather than treating that run as
certification of later work.

### 5.5 Walls, half walls, and tree yield

The canonical building catalog now has:

- `tall_wall`: **Wall (1x2)**, one unit wide and two units tall, four wood,
  `heightUnits: 2`, 280 HP, insulation 0.5, seals shelter;
- legacy `wall`: **Half Wall (1x1)**, two wood;
- `doorway`: explicitly two units tall.

There is no separate fence catalog entry. The requested one-unit fence/half-wall
role is currently represented as **Half Wall (1x1)**.

Tall walls are atomic linked two-cell structures. The system reserves both cells
before spending, stores lower/upper linkage, stacks above the upper half from either
selected half, and removes/refunds/persists/replicates both halves together. The
server authoritatively rejects conflicts and preserves correct refunds.

Canonical/shared files:

```text
shared/economyCatalog.json
main/src/game/data/generatedEconomyCatalog.ts
main/src/game/data/buildPieces.ts
server/src/generated/economyCatalog.ts
main/src/game/systems/structureSystem.ts
main/src/components/EfficientPlayer.tsx
main/src/components/StructureField.tsx
main/src/utils/buildPlacement.ts
main/src/game/multiplayerReplication.ts
server/src/economyAuthority.ts
server/src/persistence.ts
server/src/stateServer.ts
main/src/game/data/economyCatalog.test.ts
main/src/game/systems/structure.test.ts
main/src/game/systems/structurePlacement.test.ts
main/src/game/multiplayerReplication.test.ts
server/test/economyCatalogParity.test.ts
server/test/stateServer.test.ts
```

Single-tree harvest now yields a deterministic **6–8 wood** offline and on the
authoritative server, up from 2–4:

```text
main/src/game/systems/treeHarvest.ts
server/src/economyAuthority.ts
```

This representation crosses the client/server contract. Both
`main/src/game/multiplayerClient.ts` and `server/src/protocol.ts` now declare
protocol version **2**.

### 5.6 Fauna collision and navigation realism

Fauna are instanced render agents rather than Rapier rigid bodies, so the repair is
a lightweight live navigation-occupancy layer instead of per-animal physics bodies.

New core files, currently untracked and required by tracked imports:

```text
main/src/utils/faunaNavigationObstacles.ts
main/src/utils/faunaNavigationObstacles.test.ts
main/src/components/FaunaField.tsx
main/src/utils/faunaField.ts
main/src/utils/faunaField.test.ts
main/src/components/EfficientScene.tsx
main/src/utils/scenePlayerPosition.ts
main/src/utils/scenePlayerPosition.test.ts
```

Behavior now includes:

- exact live procedural-tree occupancy plus harvested-tree state;
- structure panel/volume solidity on every cube face;
- species-sized clearance, with extra root clearance for large grazers/woollies;
- walls blocked from either side;
- doorways passable, closed doors blocked, open doors passable;
- foundations underfoot walkable, with solid volumes/ceilings blocked by body height;
- obstacle-aware spawn, route candidates, existing agents, and per-frame safety;
- live revisions from world/edit/structure/tree-harvest changes;
- mid-stride replanning from the visible interpolated pose without teleporting,
  recreating the animal, or resetting gait/orientation.

`EfficientScene.tsx` now separates collision and ecology player-position mailboxes
with bounded cadence: roughly 15 Hz for collision and 400 ms for flight ecology,
frozen in deep space.

Current geometry budget passes:

```text
grazer 794/800
woolly 776/800
runner 770/800
hopper 670/800
dragonfly 628/800
fish 512/800
```

The older July 12 plan note that fauna was `1,004 > 800` is superseded for the
current worktree. Headed primitive feel/playability remains a separate experiential
gate where not already covered by newer real-browser evidence.

### 5.7 Sibling-planet motion

The aesthetic/performance choice is **presentation-only deterministic visual
ephemeris**, not authoritative physical orbits. Sibling planets now have:

- shared 3–5 degree longitude drift plus roughly 0.72–2.1 degrees of latitude
  drift over deterministic 12–20 minute periods;
- independent 8–16 minute axial spin;
- 6–22 degree obliquity;
- independent cloud drift;
- fixed rings on the body's oblique axis;
- a bounded apparent-center ray used by surface directional guidance;
- convergence back to the canonical target center before deep-space targeting;
- canonical centers forced while deep-space travel/targeting is active.

Primary files:

```text
main/src/components/SystemCompanionBodies.tsx
main/src/components/systemCompanionBodiesModel.ts
main/src/components/systemCompanionBodiesModel.test.ts
main/src/state/systemCompanionBodyTargets.ts
```

This adds no new draw calls, geometry, React state, or per-frame allocations. It
preserves travel, save, multiplayer, pairwise separation, and reciprocal system
geometry. The visual phase is session-local and may restart on reload; canonical
gameplay positions never move.

Do not convert this into physical authoritative orbit simulation without redesigning
travel, saves, multiplayer, targeting, reference-frame handoff, and persistence.

## 6. Verification state at handoff

Fresh/current evidence:

- `npm --prefix main run verify` passed after the recent batches: 251 test files,
  1,792 tests, TypeScript, catalog, creative workflow, chapter registry, chapter
  journey, story authority, and production build.
- A focused current client regression passed 17 files / 226 tests.
- `npm --prefix main run fauna:budget` passed all six species budgets listed above.
- `npm --prefix server run verify` passed: 8 test files / 77 tests, catalog parity,
  TypeScript, and build.
- A session-local real Chromium/WebGL sibling-planet check showed two visible
  companions with no page or shader errors. It was observed live but was not bound
  to a durable report artifact.
- The July 19 NVIDIA cross-face marker proof passed its direct-entry diagnostic,
  with the continuity limitations recorded above.
- `git diff --check` is clean.

Useful reruns:

```bash
npm --prefix main run verify
npm --prefix main run fauna:budget
npm --prefix server run verify
npm --prefix main run story:objective-hud:probe
git diff --check
```

Focused marker continuation:

```bash
npm --prefix main test -- --run \
  src/story/directionalMarker.test.ts \
  src/story/autopilotSteering.test.ts \
  src/story/storyDirector.test.ts

npm --prefix main run typecheck
npm --prefix main run story:objective-hud:probe
```

`main/package.json` intentionally folds catalog, signed AV, creative workflow,
chapter registry, journey contract, typecheck, story authority, tests, and build
into `verify`. Do not replace it with only a few focused tests when closing a batch.

## 7. Open gates, contradictions, and release safety

### Production status

Both current locks are frozen red release gates:

```text
.codex/production-runs/2026-07-13-distance-between-fires/production-lock.json
.codex/production-runs/2026-07-17-ch9-guidance-repair/production-lock.json
```

Both say:

```text
status: locked
releaseCandidate: false
publishAllowed: false
```

The entire July 17 run directory, including its lock, is currently untracked; it is
frozen by workflow convention, not filesystem-immutable or durable in Git yet.

The July 17 run records a prior Hosting deployment under explicit owner override.
That historical deploy is not permission to deploy the current worktree.

Some frozen lock and plan fields still list the now-complete three-cold-run gate,
and old authority hashes no longer match modified source files. Rebaseline a new
exact-revision run rather than editing old frozen evidence to look current.

### Protocol-v2 release shape

The Chapter 9 run summary says the then-live server returned protocol v1 and was not
redeployed. That statement is now historical. The current client and server both use
protocol v2 because wall shape/linkage and authoritative tree yield cross the wire.

If the owner later authorizes a release of this checkpoint:

1. inventory and freeze the exact dirty-worktree candidate;
2. close or explicitly override the applicable production lock;
3. run full client and server verification;
4. deploy `paravoxia-state-server` from `server/` and Firebase Hosting from the repo
   root as one compatible release;
5. verify `/readyz`, the WebSocket v2 hello/room path, live hashed client assets,
   and multiplayer structure/tree behavior.

Use `server/DEPLOYMENT.md` and root `firebase.json` for the established commands.
Never use `/healthz` as the production readiness gate; use `/readyz`. Do not deploy
or commit merely because this handoff mentions the release path.

### Other open system work

`PARAVOXIA_MULTI_PLANET_SYSTEM_PLAN.md` Section 18 remains the multi-planet resume
authority: activation tasks below 50 ms, all-profile cold/warm route evidence,
atmosphere/audio blending, byte-weighted cache reservations, persistent physics and
controller ownership, A → B → A edits plus heap soak, and eventual multiplayer
system travel. The new visual ephemeris intentionally does not reopen that
architecture.

`main/MULTIPLAYER_IMPLEMENTATION_CHECKLIST.md` still carries launch work around
security-minimum closeout, 2–8 player smoke, and monitoring/logging.

## 8. Recommended continuation for Fable

Unless the owner gives a new priority, use this bounded sequence:

1. Preserve and inventory the dirty worktree. Do not normalize unrelated files.
2. Read `CLAUDE.md`, this handoff, the current production lock for the chosen lane,
   and only the targeted authority/source files.
3. Treat the next directional-marker pass as a Creative Triad **delta** repair unless
   objective meaning changes. Keep Score closed unless audio intent changes.
4. Add the Chapter 1 cross-face escaped-defect scenario to
   `main/chapter-journey-contract.json`.
5. Prove continuous headed trusted-input traversal from the predecessor state,
   without a movie-only nudge, and wait for the exact anomaly objective phase.
6. Keep `planCrossFaceSurfaceLeg()` as the shared route authority.
7. Obtain fresh objective-lifecycle evidence plus an independent read-only UX audit.
8. Run focused checks, full `main` verify, server verify if shared behavior changed,
   and `git diff --check`.
9. Bind evidence to an exact candidate revision in a new/rebaselined run. Do not
   overwrite old frozen production records.
10. Stop at the applicable creative/human/release gate. Do not infer publish
    authority.

If the owner instead asks for Chapter 9 closure, the first creative task is the
protected Score Director destination-bed/hearth handoff, followed by continuous
Chapter 8 → Chapter 9 and reload evidence, headed real-GPU taste, independent
cohesion judgment, and human approval. Do not reopen the completed guidance repair
without a defect-scoped reason.

If the owner asks only for gameplay iteration on walls, fauna, trees, or planets,
use the system-orchestrator pattern and keep story/audio authority out of scope.

## 9. Fast artifact map

```text
CLAUDE.md
  Fable model and context policy

PARAVOXIA_DEMO_FOUNDATION_PLAN.md
  current mutation/publication authority

main/story-authority.json
main/chapter-registry.json
main/chapter-journey-contract.json
  machine-readable story and journey boundaries

main/PARAVOXIA_STORY_BIBLE.md
main/PARAVOXIA_STORY_EXECUTION_PLAN.md
main/PARAVOXIA_EMERGENT_STORY_BATCH_PLAN.md
  canon, sequence, and Ch4–Ch9 candidate

main/src/story/ux/README.md
  objective/marker/HUD/feedback contract

docs/architecture/workflow-orchestration/
  portable Paravoxia Terra workflow package

.terra/context-source-bindings/
  project-local context bindings

.terra/workflow-runs/system-orchestrator/paravoxia-emergent-2026-07-13/
  formal completed implementation-scope Terra run

.terra/workflow-runs/paravoxia-chapter-acceptance/lifecycle-smoke/
  synthetic blocked smoke only; not an acceptance run

.codex/production-runs/2026-07-13-distance-between-fires/
  flagship creative production record; in review and publish-locked

.codex/production-runs/2026-07-17-ch9-guidance-repair/
  Chapter 9 repair record; real mechanical evidence plus open creative gates

.codex/design-runs/2026-07-19-mobile-hud-declutter/
  convention-backed mobile design run and screenshots

main/captures/objective-hud/cross-face-direction-20260719-resume/
  latest direct-entry NVIDIA cross-face marker proof

PARAVOXIA_MULTI_PLANET_SYSTEM_PLAN.md
  continuous system-travel architecture and open performance/persistence work

main/MULTIPLAYER_IMPLEMENTATION_CHECKLIST.md
server/DEPLOYMENT.md
  multiplayer continuity and paired-release operations
```

## 10. Definition of an honest handback

A future Fable handback should state, separately:

- exact candidate revision and dirty-worktree fingerprint/scope;
- files intentionally changed and unrelated changes preserved;
- authority and contract hashes used;
- objective/action/marker/feedback lifecycle evidence;
- functional, visual, audio, performance, accessibility, and continuity evidence;
- which evidence is direct-entry, continuous, reload, headless, software-rendered,
  headed real-GPU, or human;
- open defects by severity and owner;
- weighted score and category floor only if every required category is actually
  judged;
- creative decision;
- human taste decision;
- release/publish decision;
- durable lessons and the exact next resume point.

Never compress “implemented,” “tests pass,” “looks good,” “accepted,” and “may
publish” into one status. In this checkpoint they are deliberately different.
