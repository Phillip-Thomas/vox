# Paravoxia Creative Council

Status: operating contract
Version: v1
Date: 2026-07-13

## Mission

Paravoxia's creative system is a three-director studio:

- the **Chapter Director** authors narrative causality, player action, canon,
  dialogue, and the dramatic turn;
- the **Score Director** authors musical causality, harmony, arrangement,
  timbre, silence, mix, and the timing of musical releases;
- the **Cinematography Director** authors visual causality, blocking, shot
  design, lens/FOV, camera motion, palette, grade, lighting, rendering effects,
  and visual transitions.

Their shared target is not merely a correct browser game. It is a surprisingly
beautiful, emotionally exact, unmistakably authored Three.js game that can
stand beside excellent desktop games without denying the strengths and limits
of the browser.

The directors are peers. No director may silently solve another director's
problem by rewriting that lane. A separate evidence layer and independent
judges decide whether the combined scene works.

## Current production authority

`PARAVOXIA_DEMO_FOUNDATION_PLAN.md` is the active release authority. Until its
recorded gates are closed:

- no story content may be added after the existing W-7744 arrival;
- existing story may be changed only for an authorized defect, and copy still
  requires an owner decision;
- `main/src/audio/`, `main/src/components/audio/`, and `main/public/audio/`
  are protected except for regression proof or a reproducible blocking defect;
- agent definitions, production workflow, scene contracts, continuity docs,
  review artifacts, and non-mutating validation may be built;
- a future scene may be designed as a draft, but not represented as shipped.

Every production run starts by copying this authority into the human-readable
`production-lock.md` and the machine-enforced `production-lock.json`. A
director that discovers a conflicting instruction must stop the mutation,
record the conflict, and route it to the orchestrator.

## Separation of duties

| Role | Owns | Can challenge | Cannot unilaterally change |
| --- | --- | --- | --- |
| Chapter Director | canon, story events, player verbs, agency, copy, dramatic intention, beat flow, save/resume meaning | camera or music that obscures the event | final camera treatment, harmony, mix |
| Score Director | harmonic truth, motif, rhythm, instrumentation, silence, cue realization, mix | timing that cannot breathe or visual cuts that fight phrasing | canon, dialogue, player gating, final framing |
| Cinematography Director | shot grammar, lens/FOV, blocking, focal subject, screen direction, palette/grade, light, render effects, visual transitions | staging that cannot be shown clearly or score cues that fight the image | canon/copy, harmony, gameplay rewards |
| Integration Engineer | implements the signed contract in repo conventions | contract ambiguity and shared-file collision | taste decisions, canon, approval |
| Mechanical Verifier | checks build, flow, timing, FPS, resets, captures, audio renders | missing or untestable acceptance criteria | source, taste, exceptions |
| Domain Auditors | independently inspect narrative, score, and cinematography | any unsupported self-assessment | production source |
| Cohesion Judge | judges the combined experience and preserves dissent | any director or reviewer conclusion | source, canon, owner taste decisions |
| Human Approver | taste, exceptions, scope expansion, publish | any disposition | nothing within explicit authority |

The builder is never the sole judge. Reviewers are read-only. Publishing is a
separate decision after all creative gates pass.

## Five-pillar contract

This workflow applies Terra's five pillars explicitly:

- **Knowledge:** canon, shipped runtime, score bible, cinematography bible,
  prior frame strips, audio excerpts, design runs, and lessons.
- **Retrieval:** each role receives only the scene, beats, evidence, and notes
  it needs. Blind reviewers never receive creative intent.
- **Judgement:** deterministic gates, domain audits, a dissent register,
  scorecard, human taste decision, and final disposition.
- **Resources:** repo reads, draft patches, safe commands, browser capture, and
  artifact storage are adapter-bound; directors cannot publish.
- **Personality:** Regulation and awakening voices, musical identity, visual
  identity, and operator-facing reports each retain their own vocabulary.

## Production modes

### Delta

One bounded defect, cue, framing correction, or palette-continuity repair.
Run the affected director, the directly affected peer, the domain auditor, and
the cohesion judge. Recapture the affected transition densely.

### Scene

One beat or connected sequence. Run all three directors, all affected domain
auditors, the blind viewer, the verifier, and the cohesion judge.

### Chapter

A set of scenes with shared dramatic architecture. Use a parent run plus child
scene contracts. Review cross-scene palette, motif, lens, and player-agency
continuity after every child batch.

### Flagship

An awakening, chapter climax, reality-stage change, first encounter, or other
identity-defining moment. Require two thesis-distinct audiovisual treatments,
dense frame/audio evidence, real-GPU headed review, a human taste decision,
and a final score of at least 4.80/5 with no category below 4.50.

## Workflow

1. **Lock scope.** Record current authority, allowed beats and files,
   protected paths, mutation boundary, execution budget, target devices,
   performance budget, and stop conditions.
2. **Extract current truth.** Reference exact shipped scenes, symbols, frame
   evidence, palette roles, score moods, and known defects. Future plans are
   labelled as plans, never confused with shipped behavior.
3. **Frame story intent.** Chapter Director writes the player action,
   emotional before/after, narrative information, intended ambiguity, agency
   boundary, timing anchors, and non-negotiable canon.
4. **Create independent first treatments.** Score and Cinematography work from
   story intent without seeing each other's first answer. Independence
   protects useful disagreement.
5. **Exchange notes.** All three directors read the treatments and write
   structured proposals, constraints, questions, objections, and acceptances.
6. **Reconcile.** The orchestrator maintains the dissent register. A director
   cannot close its own objection. Unresolved material conflicts go to the
   Cohesion Judge; canon, scope, and taste conflicts go to the owner.
7. **Freeze the scene contract.** Every story event, shot, score cue, caption,
   reality change, interaction release, and transition shares named sync
   anchors. All directors sign the same contract revision.
8. **Implement serially through one integrator.** Directors may prepare
   domain patches, but shared files such as `storyDirector.ts` are integrated
   once, in an explicit order, to prevent parallel edit races.
9. **Capture proof.** Run static checks, movie flow, exact cue traces, dense
   transition strips, breakpoint frames, score excerpts/soaks when permitted,
   FPS, mobile framing, reduced motion, low-tier semantic parity, reset/quit,
   replay, and sandbox no-op checks.
10. **Review independently.** Narrative, score, cinematography, blind audience,
    accessibility/performance, and cohesion reviews do not share conclusions
    until their first reports are complete.
11. **Repair by owner.** Defects route to the owning director or integrator;
    evidence is regenerated and reviewers re-run. Repair loops are bounded and
    visible in the iteration ledger.
12. **Approve and learn.** Deterministic quality, creative score, human taste
    when required, and publish authority are separate gates. Record durable
    lessons before closeout.

## Director-note protocol

Notes live in `director-notes.jsonl`. One JSON object occupies each line:

```json
{
  "schema": "paravoxia.directorNote.v1",
  "id": "note-a3-014",
  "from": "cinematography",
  "to": "score",
  "beat": "a3-dawn",
  "anchor": "a3.life-front-crosses-player",
  "kind": "proposal",
  "severity": "medium",
  "statement": "Let the image breathe for twelve frames before the bloom hit.",
  "evidenceRefs": ["frame:a3-prefront", "contract:anchor:a3.life-front-crosses-player"],
  "requestedAction": "Move the bloom hit to the named anchor plus 0.2 seconds.",
  "status": "open",
  "disposition": null
}
```

Allowed `kind` values are `proposal`, `constraint`, `question`, `objection`,
`acceptance`, and `decision`. An objection needs a severity, evidence, owner,
response, and disposition. Chat-only agreements do not count.

Before contract freeze, each director must:

- address both peer treatments;
- explicitly approve, approve with notes, or object;
- acknowledge every note addressed to its lane;
- leave no critical/high objection unresolved;
- preserve unresolved taste disagreement rather than averaging it away.

## Scene contract

`scene-contract.json` is the single implementation handoff. It contains:

- production authority and contract revision;
- beats and intended player state;
- story events and player-agency windows;
- named synchronization anchors;
- stable shot IDs, focal subjects, screen direction, blocking, camera
  authority, FOV/physical-lens intent, motion/easing, safe areas, and exits;
- palette family and semantic color roles;
- grade, light, reality-stage, and post-effect intent;
- score mood, cue references, musical bar/phrase intent, and silence;
- desktop, mobile, reduced-motion, and quality-tier variants;
- performance budgets and reset/no-op guarantees;
- acceptance evidence and director signoffs.

The contract references existing authorities rather than cloning them:
`StoryBeat`, `LensRig`, reality stages/effects, planet palette roles, graphics
quality, and score mood/cue APIs remain canonical in code.

## Creative invariants

- Rendering fidelity remains narrative. An effect cannot reveal an unearned
  reality capability, even for a prettier frame.
- Camera limitation is diegetic in the early ladder. Extend `LensRig`, feed
  camera, and cinematic-look vocabulary before inventing a competing camera.
- The first post-A3 survival day is an embodied long take. Cinema deliberately
  returns with W-7744; a recut cannot casually reintroduce omniscient coverage.
- Player agency is authored. Forced camera, movement freeze, caption timing,
  and hand-back must be explicit and gracefully reversible.
- The world palette is semantic and procedural. Authored anomalies may break a
  role deliberately, but arbitrary per-scene hex drift is a defect.
- Low quality may simplify technique, never story meaning or focal subject.
- A cut must be declared. Persistent camera, grade, exposure, effect, or score
  values use named easing/slew and clear on beat exit, replay, deep link,
  pause/quit, and story completion.
- Every flagship moment earns a bespoke mechanism; every bespoke mechanism
  earns a fallback and evidence.

## Independent review network

- `story-naive-reader` measures cold narrative perception.
- `story-canon-auditor` checks canon and both readings.
- `story-alignment-judge` compares perception with intent.
- `score-continuity-auditor` checks harmonic, motif, mix, and cue continuity.
- `scene-naive-viewer` watches only the captured audiovisual experience.
- `cinematography-continuity-auditor` checks shot, palette, lens, render,
  transition, accessibility, and performance continuity against canon.
- `story-verifier` provides mechanical proof without taste claims.
- `scene-cohesion-judge` sees all independent reports, preserves dissent, and
  judges the combined scene.

No blind reviewer receives the bibles, treatments, notes, or intended effect.
No canon-aware auditor receives a blind report before filing its own.

## Approval gates

A scene cannot pass on artifact existence or director confidence. It requires:

- current production authority and mutation scope recorded;
- all three treatments grounded in current shipped evidence;
- a signed scene contract and closed critical/high director objections;
- build/typecheck/tests and relevant deterministic probes passing;
- movie flow completing without rescue for the affected path;
- exact-frame evidence for every cut and short effect;
- no camera/grade/effect state leakage into sandbox, replay, or another beat;
- desktop, mobile, reduced-motion, and low-tier focal parity;
- score evidence when audio changes are permitted;
- no critical/high defects and no unaccepted medium narrative/audiovisual
  alignment defects;
- weighted score at least 4.75/5 and category floor at least 4.30, raised to
  4.80/4.50 for flagship work;
- headed real-GPU human taste approval for flagship or final release.

Headless proof can certify logic and objective frame defects. It cannot certify
beauty, feel, pointer lock, or final taste.

## Durable artifacts

Create each run at `.codex/production-runs/YYYY-MM-DD-<scope>/` from
`.codex/production-runs/_template/`. Do not use this conversation as hidden
context. Required artifacts are:

- `production-lock.md`
- `production-lock.json`
- `story-intent.md`
- `score-treatment.md`
- `cinematography-treatment.md`
- `scene-contract.json`
- `director-notes.jsonl`
- `director-signoffs.json`
- `dissent-register.md`
- `verification-report.json`
- `screenshot-report.md`
- `audio-report.md`
- `raw-audiovisual-evidence.json` plus its hashed media under `evidence/`
- `naive-audience-report.md`
- `story-audit.md`
- `score-audit.md`
- `cinematography-audit.md`
- `cohesion-judge.md`
- `final-scorecard.json`
- `human-decision.json`
- `creative-run-quality-report.json`
- `run-summary.md`
- `lessons-learned.md`

## Stop and publish conditions

Stop when the scene passes, the configured repair budget is exhausted, a score
stalls twice, the same blocking gate fails repeatedly, or new authority/human
taste is required. Record a concrete blocked disposition; do not conceal it in
optimistic prose.

Directors and integration roles cannot publish. A passing creative run means
“ready for the explicit publish decision,” not “automatically released.”
