# Player Experience Audit

Reviewer: `{{FRESH_PLAYER_EXPERIENCE_AUDITOR}}`
Run ID: `{{RUN_ID}}`
Contract revision: `{{CONTRACT_REVISION}}`

## Independence

- First report completed before reading peer conclusions: `{{YES_OR_NO}}`
- Director or implementation role on this run: `no`
- Other reviewer conclusions read before first report: `no`

## Contract and baseline

- Signed guidance contract: `scene-contract.json#guidance`
- Shipped source and objective map: `shipped-ux-baseline.json`
- Raw lifecycle proof: `objective-lifecycle-evidence.json`
- Contract-bound focused journey proof: `chapter-journey-evidence.json`

## Journey regressions

- Exact journey-contract SHA and source-revision binding: `{{FINDING}}`
- Focused scenarios complete, or an explicit no-focused-scenario disposition: `{{FINDING}}`
- Prompt ownership, editable input, entity lifecycle, and reload/recovery seams: `{{FINDING}}`
- Diagnostic direct-entry evidence is not represented as continuity proof: `{{FINDING}}`

## Objective lifecycle

- Player verb and actionable final instruction: `{{FINDING}}`
- Objective enter/change/clear lifecycle: `{{FINDING}}`

## Marker exactness

- Mandatory objective health and exact marker-label parity: `{{FINDING}}`
- Target reachability and shared marker ownership: `{{FINDING}}`

## Feedback and progression

- One semantic entry cue per objective ID: `{{FINDING}}`
- Presentation feedback remains unable to advance progression: `{{FINDING}}`

## Variants and accessibility

- Desktop/mobile/reduced-motion/lowest-quality parity: `{{FINDING}}`
- Screen-reader meaning, safe areas, and input clarity: `{{FINDING}}`

## Reset and stale state

- Deep-link/replay/pause/quit/completion reset behavior: `{{FINDING}}`
- Sandbox and beat-exit objective clearing: `{{FINDING}}`

## Findings

- Camera, HUD, prompt, marker, and score focal competition: `{{FINDING}}`
- First player uncertainty or failure journey: `{{FINDING}}`

## Defects

| ID | Severity | Objective / anchor | Observation | Evidence | Owner | Required verification |
| --- | --- | --- | --- | --- | --- | --- |
| `{{DEFECT_ID}}` | `{{SEVERITY}}` | `{{OBJECTIVE_OR_ANCHOR}}` | `{{OBSERVED_MISMATCH}}` | `{{REFS}}` | `{{chapter|score|cinematography|integration}}` | `{{ROUTE}}` |

## Verdict

Verdict: `{{pass|repair|block|insufficient_evidence}}` — `{{RATIONALE}}`
