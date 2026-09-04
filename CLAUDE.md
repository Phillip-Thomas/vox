# Paravoxia — orchestration & token discipline

Fable weekly limits are the binding constraint; most spend is long-context
cache reads, not output. Every session in this repo follows these rules.

## Model tiering (frontmatter already set — don't override upward casually)

- **fable (inherit)**: `chapter-director`, `score-director`,
  `cinematography-director`, `story-alignment-judge`,
  `scene-cohesion-judge` — creative build and taste-critical judgment only.
- **opus**: `story-naive-reader`, `story-canon-auditor`, `story-verifier`,
  `scene-naive-viewer`, `cinematography-continuity-auditor`,
  `score-continuity-auditor`, `player-experience-auditor` — blind reading,
  auditing, and mechanical verification.
- Any ad-hoc Explore/general-purpose agent for searching, doc-reading, log
  triage, or probe-running: pass `model: "opus"` (or `"haiku"` for trivial
  greps). A mechanical subagent must never inherit fable.

## Main-session context hygiene

- Stay an orchestrator. Don't pull the design corpus (~65k tokens:
  `PARAVOXIA_PROGRESSION.md`, `PARAVOXIA_CH4_PLAN.md`, `main/STORY.md`) into
  the main context unless doing the creative work directly here — delegate
  reading to a subagent and keep only its conclusions.
- Verification (movie probes, screenshot strips, `npm run verify`) goes to
  `story-verifier`, not inline Bash loops. Run dev servers and long probes in
  the background; read back tails, never full logs.
- Guided-play changes require both the verifier's objective/marker/feedback
  lifecycle proof and a fresh read-only `player-experience-auditor` report.
  Neither role patches or substitutes for a creative director.
- After finishing a chapter or review, remind the owner to `/clear` before the
  next task; suggest `/compact` before starting a long build phase when
  context is already large.

## Creative triad

For any new scene, awakening, substantial cutscene recut, or audiovisual
polish pass, invoke the `creative-triad` skill. The Chapter, Score, and
Cinematography directors are peers. They communicate through the run's scene
contract and structured director notes; they do not race edits in shared
timeline files or approve their own implementation.

Chapter, Score, and Cinematography are exactly the three peer creative
directors. Auditors, verifiers, judges, and integration engineers provide
checks, evidence, and repair routing; they never become a fourth creative lane.

Durable contracts live in:

- `PARAVOXIA_CREATIVE_COUNCIL.md`
- `main/CINEMATOGRAPHY.md`
- `main/src/story/ux/README.md` (the executable player-guidance context
  contract for objective, marker, HUD, and feedback lifecycles)
- `docs/architecture/workflow-orchestration/examples/paravoxia-creative-triad.workflow.json`
- `.codex/production-runs/_template/`

## Story scope

Post-arrival story work is **authorized**. The owner lifted the post-arrival
gate on 2026-07-28 (recorded at the top of `PARAVOXIA_DEMO_FOUNDATION_PLAN.md`):
story beyond `ch9-hearth` may be designed, built, and registered, including the
space-station chapter. Do not refuse or defer this work on the basis of an
older freeze — earlier revisions of this file carried one, and it expired.

What still applies:

- **Creative-Triad and registry gates are the remaining barrier** between a new
  chapter and the runtime. Route the work through them; do not route around.
- **Sequencing is owner-directed: do not rush to the station.** Making the
  existing story enjoyable comes first, and the need to leave must emerge from
  play rather than from a new content hook.
- **The demo's release surface is unchanged** — it still stops at
  `ch4-arrival`, and publishing remains a separate decision. Building past it
  is allowed; shipping it in the demo is not implied.
- **Shipped copy and audio remain protected baselines.** Changing a protected
  audio/runtime path is still a contracted change, not an incidental one.
- **"Anchorage" is retired as a name.** The location is the **space station**.
