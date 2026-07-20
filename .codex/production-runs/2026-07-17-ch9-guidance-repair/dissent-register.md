# Dissent Register

Status: template incomplete

Preserve material disagreement until an authorized role resolves it. The author
of an objection cannot close it; canon, scope, exception, and taste disputes
route to the human approver when the Cohesion Judge cannot resolve them.

| ID | Anchor | Competing theses | Raised by | Severity | Evidence | Decision owner | Status | Disposition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `dissent-{{NN}}` | `{{ANCHOR_ID}}` | `{{THESIS_A}}` / `{{THESIS_B}}` | `{{DIRECTOR}}` | `{{critical|high|medium|low}}` | `{{EVIDENCE_REFS}}` | `{{JUDGE_OR_HUMAN}}` | `open` | `{{PENDING}}` |

## Resolution standard

For each resolved item, record the selected thesis, rejected alternative,
reason, evidence, contract revision, resolver, and timestamp. Do not report
`none` until all notes have been checked for implicit disagreement.

## No-dissent declaration

If genuinely empty: `{{ORCHESTRATOR}}` reviewed all director notes and found no
material unresolved dissent at `{{ISO_8601}}` for contract revision
`{{CONTRACT_REVISION}}`.
