# Paravoxia Creative-Triad Run

Status: template incomplete

Copy this directory to `.codex/production-runs/YYYY-MM-DD-<scope>/`. Replace
every `{{PLACEHOLDER}}`, then keep the artifacts current throughout the run.
This directory is the durable production record; chat is not an authority.

## Start here

1. Fill `production-lock.md` and its machine-readable mirror
   `production-lock.json` before commissioning creative work.
2. Map shipped truth in `shipped-reference-map.md` and capture/hash the
   affected pre-change cut in `shipped-visual-baseline.json`.
3. Have the Chapter Director author `story-intent.md`.
4. Commission `score-treatment.md` and `cinematography-treatment.md`
   independently from that story intent.
5. Preserve each director's first-wave notes and recipient reconciliations;
   compile all six routes into `director-notes.jsonl` without rewriting them.
6. Resolve material dissent, freeze `scene-contract.json`, and collect all
   three signatures in `director-signoffs.json` for the same revision and
   exact `sha256sum scene-contract.json` value.
7. Implement through one integrator, capture proof, then run independent
   reviews before the Cohesion Judge.
8. For flagship, release-candidate, exception, or explicitly headed work,
   record human taste separately from the publish decision. Otherwise remove
   the unused `human-decision.json` template.
9. After independent review, compile exactly one `defects.json`, hash it into
   `repair-contract-disposition.json`, and append the same contract/defect
   hashes to `iteration-ledger.jsonl`. If repair changes creative intent,
   revise and re-sign the contract before any further patch.
   Every iteration entry also points to its immutable contract and defect
   snapshots; archive superseded copies under the run directory before update.

## Status vocabulary

Use `template_incomplete`, `draft`, `blocked`, `in_review`, `passed`, or
`closed` for run state. A creative pass means ready for the next explicit gate;
it never means automatically published.

## Artifact ownership

| Artifact | Owner |
| --- | --- |
| `production-lock.md` | Orchestrator |
| `production-lock.json` | Orchestrator; deterministic authority gate |
| `shipped-visual-baseline.json` | Mechanical Verifier before treatments |
| `story-intent.md` | Chapter Director |
| `score-treatment.md` | Score Director |
| `cinematography-treatment.md` | Cinematography Director |
| `*-peer-notes.jsonl`, `*-reconciliation.jsonl` | The named director only |
| `director-notes.jsonl`, `dissent-register.md` | Orchestrator, lossless compilation only |
| `scene-contract.json` | Orchestrator synthesis from dispositioned director work |
| `*-contract-signoff.json` | The named director only |
| `director-signoffs.json` | Orchestrator, lossless assembly only |
| `defects.json` | Review Moderator, canonical compilation from independent reports |
| `repair-contract-disposition.json` | Orchestrator routing only; directors own repair direction and every changed contract is re-signed |
| `*-repair-direction.json` | The named director only; remove unused templates and reference every used file from the repair disposition |
| proof reports | Mechanical Verifier |
| `evidence-registry.json` | Mechanical Verifier; hashes every typed evidence reference to a run-local file |
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
npm --prefix main run creative:gate -- --run .codex/production-runs/{{RUN_ID}} --phase implementation
npm --prefix main run creative:gate -- --run .codex/production-runs/{{RUN_ID}} --phase final
```

Also run every check authorized by `production-lock.md`. Flagship work requires
headed real-GPU human taste, a weighted score of at least 4.80/5, and no
category below 4.50. Normal scene work requires 4.75/5 and a 4.30 floor.
The final gate uses `ffprobe` to authenticate declared video, image, and audio
streams; the smoke fixture also uses `ffmpeg` to generate real test media.

## Safety

- Label planned material as draft; never represent it as shipped.
- Stop mutation when authority conflicts or protected paths are implicated.
- Do not average away unresolved canon, scope, or taste dissent.
- Do not infer beauty, pointer-lock feel, exposure, or motion quality from
  headless proof.
- Store large captures beneath an `evidence/` subdirectory and cite paths from
  the JSON and Markdown reports.
