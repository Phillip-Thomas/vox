# Paravoxia — orchestration & token discipline

Fable weekly limits are the binding constraint; most spend is long-context
cache reads, not output. Every session in this repo follows these rules.

## Model tiering (frontmatter already set — don't override upward casually)

- **fable (inherit)**: `chapter-director`, `score-director`,
  `cinematography-director`, `story-alignment-judge`,
  `scene-cohesion-judge` — creative build and taste-critical judgment only.
- **opus**: `story-naive-reader`, `story-canon-auditor`, `story-verifier`,
  `scene-naive-viewer`, `cinematography-continuity-auditor`,
  `score-continuity-auditor` — blind reading, auditing, and mechanical
  verification.
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
- After finishing a chapter or review, remind the owner to `/clear` before the
  next task; suggest `/compact` before starting a long build phase when
  context is already large.

## Creative triad

For any new scene, awakening, substantial cutscene recut, or audiovisual
polish pass, invoke the `creative-triad` skill. The Chapter, Score, and
Cinematography directors are peers. They communicate through the run's scene
contract and structured director notes; they do not race edits in shared
timeline files or approve their own implementation.

Durable contracts live in:

- `PARAVOXIA_CREATIVE_COUNCIL.md`
- `main/CINEMATOGRAPHY.md`
- `docs/architecture/workflow-orchestration/examples/paravoxia-creative-triad.workflow.json`
- `.codex/production-runs/_template/`

The current authority in `PARAVOXIA_DEMO_FOUNDATION_PLAN.md` remains binding:
the team may prepare workflow, review, and cinematography documentation now,
but it must not add post-arrival story or change protected audio/runtime paths
until the recorded release gates permit that work.
