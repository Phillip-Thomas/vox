# Screenshot Report

Status: template incomplete

## Run metadata

| Field | Value |
| --- | --- |
| Run ID | `{{RUN_ID}}` |
| Contract version | `{{CONTRACT_VERSION}}` |
| Generated at | `{{ISO_8601}}` |
| Canonical URL | `{{URL}}` |
| Capture root | `evidence/frames/` |
| Source revision | `{{GIT_SHA}}` |

## Capture ledger

Every declared cut and short effect needs dense before/at/after coverage. Record
observed frame reads, not intended reads.

| Capture ID | Shot | Anchor/timing | Variant | Viewport | Quality | Reduced motion | Path | Focal subject visible? | Observed frame read |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `capture-{{NN}}` | `{{SHOT_ID}}` | `{{ANCHOR_ID}}` / `{{before|at|after}}` | `{{VARIANT_ID}}` | `{{WIDTH_X_HEIGHT}}` | `{{TIER}}` | `{{YES_NO}}` | `{{CAPTURE_PATH}}` | `{{YES_NO}}` | `{{OBSERVATION_NOT_INTENT}}` |

## Coverage matrix

| Requirement | Status | Evidence or gap |
| --- | --- | --- |
| Every cut before/at/after | `not_run` | `{{REF_OR_GAP}}` |
| Short effects captured densely | `not_run` | `{{REF_OR_GAP}}` |
| Previous and next beat continuity | `not_run` | `{{REF_OR_GAP}}` |
| Desktop focal parity | `not_run` | `{{REF_OR_GAP}}` |
| Mobile focal parity | `not_run` | `{{REF_OR_GAP}}` |
| Reduced-motion focal parity | `not_run` | `{{REF_OR_GAP}}` |
| High/medium/low/potato focal parity | `not_run` | `{{REF_OR_GAP}}` |
| Replay/deep-link/reset continuity | `not_run` | `{{REF_OR_GAP}}` |

## Headed real-GPU evidence

- Required: `{{YES_OR_NO}}`
- Completed: **no**
- Device/browser/GPU: `{{DEVICE_BROWSER_GPU}}`
- Pointer-lock, exposure, color, motion, and beauty observations:
  `{{HUMAN_OBSERVATIONS}}`
- Evidence refs: `{{REFS}}`

## Blocking gaps

- `{{REPLACE_WITH_REAL_GAP_OR_NONE}}`

Overall status: `template_incomplete`
