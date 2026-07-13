# Paravoxia Creative-Triad Run

Status: template incomplete

Copy this directory to `.codex/production-runs/YYYY-MM-DD-<scope>/`. Replace
every `{{PLACEHOLDER}}`, then keep the artifacts current throughout the run.
This directory is the durable production record; chat is not an authority.

## Start here

1. Fill `production-lock.md` and its machine-readable mirror
   `production-lock.json` before commissioning creative work.
2. Map shipped truth in `shipped-reference-map.md`.
3. Have the Chapter Director author `story-intent.md`.
4. Commission `score-treatment.md` and `cinematography-treatment.md`
   independently from that story intent.
5. Record all six director-to-director note paths in `director-notes.jsonl`.
6. Resolve material dissent, freeze `scene-contract.json`, and collect all
   three signatures in `director-signoffs.json` for the same revision.
7. Implement through one integrator, capture proof, then run independent
   reviews before the Cohesion Judge.
8. For flagship, release-candidate, exception, or explicitly headed work,
   record human taste separately from the publish decision. Otherwise remove
   the unused `human-decision.json` template.

## Status vocabulary

Use `template_incomplete`, `draft`, `blocked`, `in_review`, `passed`, or
`closed` for run state. A creative pass means ready for the next explicit gate;
it never means automatically published.

## Artifact ownership

| Artifact | Owner |
| --- | --- |
| `production-lock.md` | Orchestrator |
| `production-lock.json` | Orchestrator; deterministic authority gate |
| `story-intent.md` | Chapter Director |
| `score-treatment.md` | Score Director |
| `cinematography-treatment.md` | Cinematography Director |
| `director-notes.jsonl`, `dissent-register.md` | Orchestrator, with director-authored entries |
| `scene-contract.json`, `director-signoffs.json` | Orchestrator and all three directors |
| proof reports | Mechanical Verifier |
| `raw-audiovisual-evidence.json` and `evidence/` media | Mechanical Verifier; blind-review input |
| domain audits and blind report | Fresh independent reviewers |
| `critic-report.md`, `cohesion-judge.md` | Independent moderators/judge |
| `human-decision.json` | Human Approver |
| scorecard, quality report, summary, lessons | Judge, validator, recorder |

Blind viewers receive only the capture and audio evidence, never treatments,
bibles, notes, contracts, or other reviewers' conclusions. Reviewers do not
patch source, and directors do not approve their own work.

## Required checks

Run the artifact gate before implementation and again at closeout:

```bash
npm --prefix main run creative:gate -- --run .codex/production-runs/{{RUN_ID}} --phase contract
npm --prefix main run creative:gate -- --run .codex/production-runs/{{RUN_ID}} --phase final
```

Also run every check authorized by `production-lock.md`. Flagship work requires
headed real-GPU human taste, a weighted score of at least 4.80/5, and no
category below 4.50. Normal scene work requires 4.75/5 and a 4.30 floor.

## Safety

- Label planned material as draft; never represent it as shipped.
- Stop mutation when authority conflicts or protected paths are implicated.
- Do not average away unresolved canon, scope, or taste dissent.
- Do not infer beauty, pointer-lock feel, exposure, or motion quality from
  headless proof.
- Store large captures beneath an `evidence/` subdirectory and cite paths from
  the JSON and Markdown reports.
