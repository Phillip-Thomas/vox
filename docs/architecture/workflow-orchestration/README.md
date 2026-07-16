# Paravoxia creative-triad workflow

This directory is the portable, tool-neutral orchestration package for the
Chapter, Score, and Cinematography Directors. The human-readable operating
contract is [`PARAVOXIA_CREATIVE_COUNCIL.md`](../../../PARAVOXIA_CREATIVE_COUNCIL.md),
and the shipped visual continuity authority is
[`main/CINEMATOGRAPHY.md`](../../../main/CINEMATOGRAPHY.md).

## Package map

- `examples/paravoxia-story-council.workflow.json` — docs-only existing-story
  reconciliation and new-direction preproduction: isolated blind/canon audits,
  independent three-director treatments, peer notes, signed canon candidate,
  bounded docs patch, authority checks, and cohesion judgement.
- `examples/paravoxia-creative-triad.workflow.json` — role separation,
  artifacts, adapters, gates, steps, repair loop, and stop conditions.
- `examples/paravoxia-chapter-acceptance.workflow.json` — read-only review of
  one implemented chapter, with previous/next boundary proof, six independent
  reviews, a cohesion judge, and repair commissioning without self-patching.
- `context-packs/paravoxia-creative-triad.context.json` — bounded retrieval
  contract for canon, runtime truth, the story UX objective/guidance layer,
  visuals, evidence, and lessons. Scene production also composes the portable
  `frontend-design@v1` context pack.
- `context-packs/frontend-design.context.json` — vendored portable catalog
  entry so Paravoxia validation does not depend on a sibling checkout.
- `.terra/context-source-bindings/` — project-relative bindings from the two
  portable context packs to Paravoxia's current authority, runtime, UX,
  workflow, rubric, template, and run-evidence sources.
- `run-profiles/` — delta, scene, chapter, and flagship budgets, reviewer
  depth, autonomous repair limits, conditional human gates, plus the
  story-reconciliation profile.
- `rubrics/paravoxia-story-cohesion.rubric.json` and
  `defect-taxonomies/paravoxia-story.defect-taxonomy.json` — plot, character,
  agency, reveal, audiovisual direction, authority, and readiness judgement.
- `rubrics/paravoxia-creative-cohesion.rubric.json` — weighted 5-point
  audiovisual and player-guidance quality bar.
- `defect-taxonomies/paravoxia-creative.defect-taxonomy.json` — severity,
  ownership, evidence, and repair routing.
- `schemas/` — machine-readable shared scene and director-note contracts.

The specification deliberately names capabilities rather than vendors or
model IDs. An execution environment binds model, patch, tool, artifact, and
review adapters at runtime. The Chapter, Score, and Cinematography Directors
remain the only three creative directors. Player experience is an independent
read-only audit lane, not a fourth authority. Directors cannot publish,
reviewers cannot patch, and a human publish decision remains separate from
creative approval.

## Context bindings

The context packs remain path-portable. Project paths live in the checked-in,
repo-relative binding sets:

```text
.terra/context-source-bindings/paravoxia-creative-triad.local.json
.terra/context-source-bindings/frontend-design.local.json
```

Resolve their paths from the repository root. The creative binding gives every
authorized run a bounded source for `main/src/story/ux`; the frontend binding
uses the co-located UX contract as its canonical design document and binds the
UX source, creative rubrics, production templates, workflow package, and
durable run evidence. Do not put an operator home path in either portable
context pack.

## Validate the portable workflow

From the repository root:

```bash
node ../TerraForm/scripts/dev/workflow-run.mjs validate \
  --spec "$PWD/docs/architecture/workflow-orchestration/examples/paravoxia-creative-triad.workflow.json"

node ../TerraForm/scripts/dev/workflow-orchestrator-quality.mjs \
  --spec docs/architecture/workflow-orchestration/examples/paravoxia-creative-triad.workflow.json

node ../TerraForm/scripts/dev/workflow-run.mjs validate \
  --spec "$PWD/docs/architecture/workflow-orchestration/examples/paravoxia-story-council.workflow.json"

node ../TerraForm/scripts/dev/workflow-orchestrator-quality.mjs \
  --spec docs/architecture/workflow-orchestration/examples/paravoxia-story-council.workflow.json

npm --prefix main run story:authority
npm --prefix main run story:authority:smoke
npm --prefix main run creative:workflow:check
npm --prefix main run creative:workflow:smoke

jq empty .terra/context-source-bindings/paravoxia-creative-triad.local.json
jq empty .terra/context-source-bindings/frontend-design.local.json
```

Use the story-council workflow before scene production when the commission is
to correct the existing plot, reconcile the Story Bible/Execution Plan, or set
new whole-story direction. It may patch bounded authority and orchestration
documents only under the current lock. An approved story candidate is not a
runtime authorization; a specific scene returns to the creative-triad workflow
only after the production gates open it.

## Certify an implemented chapter

Run the mechanical probe directly while iterating:

```bash
npm --prefix main run chapter:accept -- \
  --chapter ch5 --candidate-revision "$(git rev-parse HEAD)"
```

Start the read-only council review only from an exact clean candidate and real
repo-local authority artifacts:

Configure explicit read-only structured runners first. Each value is a JSON
argv array; the invoked program receives the prompt/result placeholders and
must return `terra.roleResult.v1`. The guarded chapter-only bridge adds a
machine-readable `outputRequirements` object to every invocation, including
the exact output slugs, role output contract, execution identity, fresh review
session, and per-artifact provenance fields it will validate before Terra can
persist anything.

```bash
export PARAVOXIA_STORY_CREATIVE_RUNNER_ARGV_JSON='["<read-only-runner>","$PROMPT_PATH","$RESULT_PATH"]'
export PARAVOXIA_STORY_REVIEW_RUNNER_ARGV_JSON='["<independent-read-only-runner>","$PROMPT_PATH","$RESULT_PATH"]'
```

There is intentionally no implicit model fallback: unset or malformed runner
configuration becomes a persisted, recoverable
`missing_role_runner_configuration` blocker.

```bash
npm --prefix main run chapter:accept:workflow -- \
  --chapter ch5 --candidate-revision "$(git rev-parse HEAD)" \
  --production-authority PARAVOXIA_DEMO_FOUNDATION_PLAN.md \
  --council-authority path/to/signed-council.json \
  --scene-authority path/to/signed-scene.json \
  --previous-context path/to/previous-boundary.json \
  --next-context path/to/next-boundary.json \
  --run-mechanical
```

A new run advances compatible model/review roles until it completes or reaches
a real blocker. Resume an existing run with:

```bash
npm --prefix main run chapter:accept:workflow -- \
  --run .terra/workflow-runs/paravoxia-chapter-acceptance/<run-id>/run.json \
  --continue
```

The current binding set has safe command bindings, but it does not yet have an
evidence-backed deterministic step executor that can produce the exact
inventory, conformance, AV-capture, integrity, and quality artifact sets.
Those steps therefore stop honestly with `missing_deterministic_adapter`;
commands are never treated as if they produced undeclared evidence. Likewise,
`human_decision` stops with `human_operator_required` and can never be emitted
by a model or automated reviewer. This means the operator is executable and
resumable, but it is not yet an unattended end-to-end council.

The browser runner writes
`evidence/mechanical-chapter-acceptance/chapter-mechanical-evidence.json` and the
operator attaches that exact file to the Terra artifact
`chapter-mechanical-evidence`, including red `repair-required` or `blocked`
reports. The report can reach only `machine-ready-for-council-review`; it can
never issue final creative acceptance.

The mechanical command cannot certify a smoke/debug run, an external server,
missing required cold-run or variant coverage, a rescue, skipped registered or
objective beat, failed performance budget, incomplete boundary state, missing
signed AV authority, unsafe spawn, or stale candidate. Final `accepted`
additionally requires independent Story, Score, Cinematography, UX,
blind-viewer, and code reviews; deterministic review-session integrity; zero
open critical, high, or unaccepted material-medium defects; a passing cohesion
score; and authenticated headed, audible human approval. Human approval is
validated after artifact-quality audit and cannot bypass a failed gate. A
failing review emits a bounded repair commission for a separate Creative Triad
run.

Exercise both the honest first-step block and the later-gate bypass regressions
with:

```bash
npm --prefix main run chapter:accept:workflow:smoke
```

## Start and validate a production run

Copy `.codex/production-runs/_template/` to a dated run directory. Complete
the production lock before commissioning treatments, then preserve all notes,
signoffs, evidence, reviews, dissent, and human decisions in that directory.

```bash
cp -R .codex/production-runs/_template \
  .codex/production-runs/YYYY-MM-DD-scene-name

npm --prefix main run creative:gate -- \
  --run .codex/production-runs/YYYY-MM-DD-scene-name --phase contract

# After implementation and static checks:
npm --prefix main run creative:gate -- \
  --run .codex/production-runs/YYYY-MM-DD-scene-name --phase implementation

# After proof, independent review, and scoring:
npm --prefix main run creative:gate -- \
  --run .codex/production-runs/YYYY-MM-DD-scene-name --phase final
```

The gate writes `creative-run-quality-report.json`. A complete workflow run also
requires a current `shipped-ux-baseline`, hashed
`objective-lifecycle-evidence`, and an independently authored `ux-audit` before
the review moderator or Cohesion Judge can close the scene. Templates are
intentionally incomplete and must fail until real evidence replaces every
placeholder. Use `npm --prefix main run creative:smoke` to exercise a complete
valid fixture and confirm that unresolved anchors, self-closed notes, hidden
blocking defects, and contract-changing repairs without valid re-sign lineage
are rejected.

Chapter mode is a parent fan-out: run these three executable gates inside every
child scene run, then collect their quality reports and the cross-scene
continuity matrix in the parent. Delta mode narrows exploration and patch scope,
not the final independent review network.

Creative approval is not release authority. Flagship work also requires
headed real-GPU taste approval, and publishing always remains a separate owner
decision.
