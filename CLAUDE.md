# Paravoxia — orchestration & token discipline

Fable weekly limits are the binding constraint; most spend is long-context
cache reads, not output. Every session in this repo follows these rules.

## Model tiering (frontmatter already set — don't override upward casually)

- **fable (inherit)**: `chapter-director`, `score-director`,
  `story-alignment-judge` — creative build and taste-critical judgment only.
- **opus**: `story-naive-reader`, `story-canon-auditor`, `story-verifier` —
  reading, auditing, mechanical verification.
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
