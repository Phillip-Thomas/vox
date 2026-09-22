# Common result contract

Return one JSON object, without a preamble:

```json
{
  "schema": "paravoxia.chapterLoopRole.v1",
  "summary": "Concrete outcome and material limitations.",
  "verdict": "PASS",
  "evidence": [{"path": "repository-relative/file", "sha256": "actual SHA-256 of its bytes"}],
  "findings": [],
  "keep": ["A concrete successful choice to preserve."]
}
```

Use PASS, REVISE or BLOCKED honestly. Findings have `severity` (blocking, major,
minor), `description`, and nonempty `evidence` references. Compute hashes from
real files. Never manufacture measurements or cite nonexistent artifacts.
Keep output compact. The transport supplies session identity; do not invent it.
Do not read prior role transcripts, old run directories, or repository-wide
instruction files. This commission and the supplied packet define your task.
Do not add roles, repeat the council, ask for routine permissions, or publish.
Change only explicitly owned game paths; write evidence only in outputDirectory.
For source-only analysis, empty evidence is permitted. Experience judges must
actually inspect their media or attempt play and cite the evidence they used.

Judges also return `candidateSha256` from their supplied packet and `scores`
with the role's named categories, each 1–5. PASS requires every category >=4,
actual proof, and no blocking or major finding. REVISE is a valid terminal
outcome. Report unavailable perception or tools as BLOCKED, never inferred PASS.
