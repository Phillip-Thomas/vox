---
name: creative-triad
description: Orchestrate Paravoxia's Chapter, Score, and Cinematography Directors as a governed production team. Use for new scenes/chapters, awakenings, material recuts, audiovisual polish, cutscene redesign, or any work where story, score, camera, palette, rendering effects, and player agency must remain cohesive. Produces durable scene contracts, cross-director notes, independent reviews, evidence, scorecards, and bounded repair loops.
---

# Creative Triad — production workflow

Run this skill as the ORCHESTRATOR. The user talks to one production lead; the
three directors work through durable contracts and notes. Do not turn the user
into a message bus.

The source of truth is `PARAVOXIA_CREATIVE_COUNCIL.md`. Visual continuity is in
`main/CINEMATOGRAPHY.md`. The executable player-guidance context contract is
`main/src/story/ux/README.md`; read it before designing or reviewing guided
play. The portable workflow spec, run profile, rubric, and defect taxonomy are
under `docs/architecture/workflow-orchestration/`.

## Route the commission before creating a scene run

Use this scene-production workflow for a bounded cut, scene, chapter packet,
awakening, recut, or audiovisual implementation. If the request is instead to
correct the existing plot, reconcile canon, choose new story direction, update
the Story Bible/Execution Plan, or design the whole-story character and
audiovisual arc, route first to the `story-review` skill's full story-council
mode and:

```text
docs/architecture/workflow-orchestration/examples/paravoxia-story-council.workflow.json
```

That lane produces a signed documentation/canon candidate, not a scene contract
or runtime patch. Only after its authority gates and the separate production
lock allow a specific packet should work return here. Do not smuggle a plot
decision through a scene treatment.

## First action: authority gate

Read `PARAVOXIA_DEMO_FOUNDATION_PLAN.md` and the latest repo checkpoint before
commissioning any mutation. Create the run's `production-lock.md` and matching
`production-lock.json` first; the gate hashes authority files and checks
changed paths against its allowed/protected boundaries.

The current lock permits building/reviewing this production system and planning
future scenes, but forbids post-arrival story and protected audio/runtime
changes until the recorded headed primitive, fauna budget, full verify, and
Batch 3 gates allow them. A draft is not shipped work. If user authority does
not clearly expand the lane, keep runtime changes out of scope.

## Run setup

Choose one mode and budget:

- `delta`: one bounded defect or cue; fast/standard.
- `scene`: one beat or connected sequence; standard/deep.
- `chapter`: parent run plus child scene contracts; deep.
- `flagship`: awakening/climax/first encounter/reality change; flagship.

Bind the matching portable profile from
`docs/architecture/workflow-orchestration/run-profiles/`. Delta, scene, and
chapter runs may reach machine-ready creative approval autonomously. Human
taste remains mandatory for flagship work, release candidates, accepted
exceptions, owner-only canon/scope decisions, or an unresolved material taste
tie; publishing is always separate.

Create:

```text
.codex/production-runs/YYYY-MM-DD-<scope>/
```

Copy `.codex/production-runs/_template/`. Record canonical preview URL, existing
server ownership, devices/tiers, current baseline captures, performance budget,
scope, protected paths, owner decisions, and stop conditions.

Do not start a duplicate server when a healthy canonical preview already
exists. Keep one URL for probes, screenshots, and owner review.

## Model policy

- Chapter, Score, and Cinematography Directors are creative roles and inherit
  the session's high-reasoning creative model.
- `scene-cohesion-judge` is taste-critical and uses the session model.
- `story-naive-reader`, `story-canon-auditor`, `story-verifier`,
  `scene-naive-viewer`, `cinematography-continuity-auditor`,
  `score-continuity-auditor`, and `player-experience-auditor` run on opus unless
  the owner explicitly requests a final pre-ship upgrade.
- Fresh independent reviewers are required. Never reuse a director as its own
  reviewer.
- Chapter, Score, and Cinematography remain exactly three peer creative
  directors. Reviewers, judges, verifiers, and integrators are checks on the
  triad, not additional creative directors.
- Mechanical searches, logs, captures, and long probes use cheaper agents and
  concise artifact summaries.

## Stage 1: grounded story intent

Before a treatment, commission the mechanical verifier to capture the affected
current shipped cut and adjacent entry/exit state. Hash the raw files and
record source revision, anchors, camera authority/FOV, palette/reality state,
viewport, and quality tier in `shipped-visual-baseline.json`. This is director
grounding, not a taste verdict. If the current cut cannot be seen, stop visual
redesign rather than designing from the bible alone.

When guided play is affected, also inventory the shipped objective, exact
marker-label bridge, standing work order/HUD, semantic feedback seams, and
enter/change/clear/reset behavior in `shipped-ux-baseline.json`. Hash the UX
README and affected source/tests. A caption or treatment is not evidence that
the player can find and perform the next action.

Commission the `chapter-director` to write `story-intent.md`, not code. It must
include:

- affected beats and current shipped references;
- player action and agency windows;
- emotional before/after;
- story information, intended ambiguity, and both-reading constraints;
- reality-stage ceiling and tutorial/gameplay purpose;
- for every guided segment: actionable verb/input, objective ID lifecycle,
  exact marker label, standing work order, entry/progress/completion feedback,
  clear/replace/reset semantics, and player-control fallback;
- named dramatic anchors, not duplicated raw timestamps;
- constraints and questions for Score and Cinematography;
- explicit non-goals and protected strengths.

Gate: the intent must be implementable without inventing missing canon or
violating production authority.

## Stage 2: independent treatments

Launch `score-director` and `cinematography-director` in parallel from the same
story intent. Do not give either the other's first treatment.

Score returns `score-treatment.md` with harmonic/motif/arrangement/silence/cue
intent, era fidelity, sync-anchor relations, mix/performance plan, and evidence.

Cinematography returns `cinematography-treatment.md` with current-cut audit,
color script, shot ledger, blocking, focal hierarchy, lens/FOV/camera/effect
plan, agency/hand-back, variants, performance plan, and capture spec.

At flagship depth, require at least two thesis-distinct audiovisual directions.
They must differ structurally, not just in grade, instrumentation, or wording.

Gate: both treatments cite current shipped evidence, address adjacent-scene
continuity, and stay inside the production lock.

## Stage 3: cross-director notes

Give all three directors both peer treatments. Each writes its two outgoing
first-wave notes to `<director>-peer-notes.jsonl`. Then each recipient writes
responses and dispositions to `<director>-reconciliation.jsonl`. The
orchestrator may compile those six sources into `director-notes.jsonl`, but
the deterministic gate rejects rewritten statements, substituted responses,
missing routes, or a director closing its own note. Each director also records
a signoff disposition:

- `approve`
- `approve-with-notes`
- `object`

Required communication graph:

```text
Chapter -> Score
Chapter -> Cinematography
Score -> Chapter
Score -> Cinematography
Cinematography -> Chapter
Cinematography -> Score
```

Every note has ID, from, to, beat, shared anchor, kind, severity, evidence,
requested action, status, and disposition. Objections cannot be closed by their
author. Preserve competing taste theses in `dissent-register.md`.

Gate: no critical/high objection is open; every recipient has acknowledged its
notes; unresolved canon/scope/taste decisions are routed rather than averaged.

## Stage 4: freeze scene contract

The orchestrator synthesizes `scene-contract.json` from accepted treatments and
notes. Directors verify their own lane and sign exactly one contract revision in
`director-signoffs.json`.

The contract contains:

- authority and scope;
- story events and player-control windows;
- named synchronization anchors;
- score cues relative to anchors;
- stable shots and cinematic state relative to anchors;
- palette/effect/reality limits;
- actionable objective/marker/work-order/feedback lifecycles for guided play,
  including exact label parity and which lane owns each presentation seam;
- desktop/mobile/reduced-motion/quality variants;
- performance and reset/no-op constraints;
- acceptance evidence.

Run the production validator before code:

```bash
npm --prefix main run creative:gate -- --run .codex/production-runs/<run> --phase contract
```

Gate: the contract is structurally valid, all references resolve, every
director signs, and no blocking note/dissent remains.

## Stage 5: implementation

Use one integration engineer for shared runtime files. Domain directors may
prepare bounded patch candidates, but they do not race changes to
`storyDirector.ts`, `StoryDirectorDriver.tsx`, `PostFX.tsx`, shared score state,
or the scene contract.

Mutation order is contract-specific, normally:

1. beat/player-state scaffolding;
2. visual blocking/camera/render scaffolding;
3. score realization;
4. shared anchor integration;
5. accessibility/quality-tier fallbacks;
6. reset/no-op and debug evidence hooks.

Patch roles cannot publish. New render state is inert in sandbox. New audio or
story work requires the production lock to permit it.

After every material patch loop, update the run ledger with route, budget,
iteration, changes, score/gate status, defects, evidence, canonical URL, and
next action. Each entry points to immutable run-local snapshots of that
iteration's contract and defect register; never rewrite history in place.

Before capture/review, record the exact implementation diff and static command
evidence in `check-results.json`, then run:

```bash
npm --prefix main run creative:gate -- --run .codex/production-runs/<run> --phase implementation
```

## Stage 6: mechanical proof

Commission `story-verifier` with the scene contract and exact probe spec. It
reports measurements, not taste.

Required when relevant:

- `npm --prefix main run verify`;
- production-run validator;
- affected beat flow across at least three cold runs;
- full movie flow with zero timeout rescues for chapter/final changes;
- exact anchor trace for story/camera/effect/score/control;
- dense before/at/after frames for cuts and short effects;
- previous/next beat continuity frames;
- desktop/mobile, reduced-motion, and low-tier focal parity;
- FPS/frame time, shader/draw/memory budgets;
- score pure/OfflineAudioContext soak, excerpts, and score FPS when audio is
  authorized and changed;
- `npm --prefix main run story:ux:check` plus objective enter/change/clear
  traces, exact marker parity, one-shot feedback, actionable standing copy,
  progress/completion response, and no stale or targetless mandatory state;
- replay, deep link, pause/focus, quit, completion, and sandbox reset/no-op.

Hash every typed evidence reference into `evidence-registry.json`. The final
gate runs `ffprobe` against video, frame-strip, and audio files and compares the
actual stream metadata with the declared probe. A plausible extension and
matching SHA-256 are not evidence if the bytes do not decode.

Headless proof cannot approve pointer-lock feel, exposure/color, motion feel,
or beauty. Record those as headed gates.

## Stage 7: independent review network

Run reviewers fresh and independently. First-wave reports must not see each
other.

1. Narrative: use `story-review` for material story/copy/sequence changes, or
   the canon auditor in delta mode.
2. Score: `score-continuity-auditor` when score or audiovisual cueing changes.
3. Visual canon: `cinematography-continuity-auditor` for every scene/flagship
   cut or render treatment.
4. Blind experience: `scene-naive-viewer` receives only current audiovisual
   files and intent-free playback metadata from `raw-audiovisual-evidence.json`,
   never verifier prose, bibles, contract, treatments, notes, or other reviews.
5. Guided player experience: `player-experience-auditor` receives the UX
   context contract, signed scene contract, runtime evidence, and variants. It
   independently judges whether the player can identify, reach, perform, and
   understand each required action without a lifecycle or feedback lie.
6. Mechanical: `story-verifier` report stays separate from taste.

Then commission `scene-cohesion-judge` with all treatments, evidence, reports,
notes, and dissent. It may approve, route repair, block, or declare
ready-for-human-taste. It cannot patch, expand scope, accept an exception for
the owner, or publish.

## Stage 8: repair loop

Convert all material findings to defects with severity, category, evidence,
owner, anchor, requested repair, and verification route. Route:

- canon/agency/copy/beat flow -> Chapter Director;
- objective verb/lifecycle/work-order meaning -> Chapter Director;
- harmony/motif/arrangement/mix/cue realization -> Score Director;
- audible objective acknowledgement/masking -> Score Director;
- blocking/lens/palette/light/effect/frame continuity -> Cinematography Director;
- marker/HUD focal competition, occlusion, safe area, and camera hand-back ->
  Cinematography Director;
- objective wiring, exact-label bridge, one-shot emission, stale clear,
  reconstruction, shared timing/source collision/reset/performance ->
  Integration Engineer;
- taste tie/canon exception/scope expansion -> Human Approver.

Patch, re-run deterministic proof, recapture, and re-run affected independent
reviewers. Maximum loops come from the run profile. If weighted score improves
less than 0.05 twice, classify the stall before another patch.

Before any repair patch, compile `repair-contract-disposition.json`. Each
director-owned direction must name its defect IDs, current contract version and
SHA-256, bounded action, and `contractChangeRequired`. Only `false` may return
directly to integration. If any direction is `true`, reopen the treatments and
note exchange, increment `scene-contract.json` with `supersedesVersion`, and
collect three fresh director signatures over the new contract SHA-256. Evidence,
reviews, defect compilation, scoring, and the iteration ledger must all bind the
new revision; the old signatures never carry forward.

## Final gates

Normal scene approval requires:

- weighted score >= 4.75/5;
- every category >= 4.30;
- no critical/high defects;
- no unaccepted medium narrative/audiovisual alignment, player-agency,
  player-experience/navigation, cinematography, score, accessibility, or
  implementation-fidelity defect;
- complete evidence and substantive reviewer reports;
- director signoffs and closed blocking dissent;
- current production authority.

Flagship requires >= 4.80, every category >= 4.50, headed real-GPU review, and
an explicit owner taste decision. Final release also requires the separate
publish decision.

Run deterministic artifact quality again:

```bash
npm --prefix main run creative:gate -- --run .codex/production-runs/<run> --phase final
```

## Closeout

Record final disposition, checks, capture/audio paths, scores by iteration,
defect trend, accepted exceptions, human decisions, server ownership, remaining
gates, and `lessons-learned.md`. Lessons must be usable by a future production
team without this conversation.

Never call a run complete while headed taste, authority, or blocking evidence
is pending. “Ready for human taste” and “release approved” are different
states.
