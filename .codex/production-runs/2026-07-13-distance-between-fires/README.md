# Paravoxia Creative-Triad Run

Status: `in_review` — physical rail implemented; three-run mechanical and implementation gates passed; remaining acceptance and release gates pending

Updated: `2026-07-15T04:31:30Z`

This directory is now the active durable production record for the signed
`distance-between-fires` contract. The public ceiling remains `ch4-arrival` and
publishing is not authorized. Final-review templates remain intentionally
incomplete until whole-flow, variant, headed-taste, and human gates exist.

## Current evidence snapshot

- The Chapter 4–9 physical rail and actor-scoped online structure ACK path are implemented in the worktree. Client ACK continuity is not independent server validation of embodied Story proof.
- `npm --prefix main run verify` passed: 1,035 story-authority checks, 202 test files / 1,437 tests, typechecks, and production build. `npm --prefix server run verify` passed: 8 test files / 73 tests, typecheck, and production build.
- The official three-run evidence is bound to source fingerprint `a5b7dfbfad792f461a5567939fa1f4d0b2ecee205c4393c007d9edcbc9f16262`. The production lock's immutable `sourceRevision` remains `3d68948c18c7c362abb4ec66b74ff1c685bf2d1f+working-tree-20260714T003216Z`.
- The Creative-Triad implementation gate passed 2,387 checks in non-writing check-only mode. The final gate has not been run and no final-gate or release pass is claimed here.
- Eight bounded POTATO segment proofs overlap from Chapter 5 through `done`. The latest focused settlement and `ch8-crossing`-to-`done` proofs completed in 157.70 and 396.77 seconds with zero nudges, runtime errors, reloads, or context losses.
- Three uninterrupted POTATO `ch4-audit` → `done` cold runs passed against that exact fingerprint in 704.18, 883.65, and 683.92 seconds. Every run reached `done`, observed 64/64 required signed runtime anchors, completed safe rest and the two-world handoff, and recorded zero nudges, dry-route water-contact violations, runtime errors, reloads, or context losses.
- The old direct `ch8-landfall` / `ch9-settle` probe is identity/error-only evidence. It is not chronology, completion, real-GPU, or human-taste proof.
- Full uninterrupted rescue-free `ch4-audit` → `done` cold runs passed: **3 of 3**. The `three-rescue-free-cold-runs` mechanical gate is satisfied; this does not authorize release.

## Eight remaining release gates

1. `server-issued-embodied-story-receipts`.
2. `quality-profile-matrix`.
3. `reduced-motion-equivalence`.
4. `supported-headed-input`.
5. `headed-real-gpu-taste`.
6. `origin-sibling-persistence-roundtrip`.
7. `tidegarden-support-water-authority-disposition`.
8. `human-release-decision`.

The implementation-gate pass does not replace or close any release gate. This
artifact-only rebaseline does not mutate the production lock, whose frozen
open-gate list still names the now evidence-satisfied three-run gate.

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
