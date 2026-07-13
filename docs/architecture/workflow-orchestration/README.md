# Paravoxia creative-triad workflow

This directory is the portable, tool-neutral orchestration package for the
Chapter, Score, and Cinematography Directors. The human-readable operating
contract is [`PARAVOXIA_CREATIVE_COUNCIL.md`](../../../PARAVOXIA_CREATIVE_COUNCIL.md),
and the shipped visual continuity authority is
[`main/CINEMATOGRAPHY.md`](../../../main/CINEMATOGRAPHY.md).

## Package map

- `examples/paravoxia-creative-triad.workflow.json` — role separation,
  artifacts, adapters, gates, steps, repair loop, and stop conditions.
- `context-packs/paravoxia-creative-triad.context.json` — bounded retrieval
  contract for canon, runtime truth, visuals, evidence, and lessons.
- `run-profiles/` — delta, scene, chapter, and flagship budgets, reviewer
  depth, autonomous repair limits, and conditional human gates.
- `rubrics/paravoxia-creative-cohesion.rubric.json` — weighted 5-point
  audiovisual quality bar.
- `defect-taxonomies/paravoxia-creative.defect-taxonomy.json` — severity,
  ownership, evidence, and repair routing.
- `schemas/` — machine-readable shared scene and director-note contracts.

The specification deliberately names capabilities rather than vendors or
model IDs. An execution environment binds model, patch, tool, artifact, and
review adapters at runtime. Directors cannot publish, reviewers cannot patch,
and a human publish decision remains separate from creative approval.

## Validate the portable workflow

From the repository root:

```bash
node ../TerraForm/scripts/dev/workflow-run.mjs validate \
  --spec "$PWD/docs/architecture/workflow-orchestration/examples/paravoxia-creative-triad.workflow.json"

node ../TerraForm/scripts/dev/workflow-orchestrator-quality.mjs \
  --spec docs/architecture/workflow-orchestration/examples/paravoxia-creative-triad.workflow.json
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

# After implementation, proof, independent review, and scoring:
npm --prefix main run creative:gate -- \
  --run .codex/production-runs/YYYY-MM-DD-scene-name --phase final
```

The gate writes `creative-run-quality-report.json`. Templates are intentionally
incomplete and must fail until real evidence replaces every placeholder. Use
`npm --prefix main run creative:smoke` to exercise a complete valid fixture and
confirm that an unresolved anchor is rejected.

Creative approval is not release authority. Flagship work also requires
headed real-GPU taste approval, and publishing always remains a separate owner
decision.
