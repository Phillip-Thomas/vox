# Production Lock

Status: template incomplete — no mutation authorized

## Run identity

| Field | Value |
| --- | --- |
| Run ID | `{{RUN_ID}}` |
| Mode | `{{delta|scene|chapter|flagship}}` |
| Scope | `{{SCENE_OR_DEFECT}}` |
| Date | `{{YYYY-MM-DD}}` |
| Source revision | `{{GIT_SHA}}` |
| Canonical preview URL | `{{URL_OR_NONE}}` |
| Preview server owner | `{{OWNER_OR_NONE}}` |
| Orchestrator | `{{NAME_OR_AGENT_ID}}` |

## Authority

- Governing plan: `{{EXACT_PATH_AND_SECTION}}`
- Latest checkpoint: `{{EXACT_PATH_AND_SECTION}}`
- Owner instruction: `{{QUOTE_OR_REFERENCE}}`
- Authority verified at: `{{ISO_8601}}`
- Runtime mutation permitted: **{{YES_OR_NO}}**
- Publish permitted: **no** unless separately recorded by the owner

Summarize the current authority and explain why this run is allowed. If the
active Paravoxia demo-foundation gates remain open, planning and validation may
continue but post-arrival story and protected runtime/audio mutation remain out
of scope.

## Locked scope

- Included beat(s): `{{BEAT_IDS}}`
- Allowed files/areas: `{{PATHS_OR_DRAFT_ONLY}}`
- Permitted changes: `{{BOUNDED_MUTATIONS}}`
- Non-goals: `{{EXPLICIT_NON_GOALS}}`
- Shipped versus draft status: `{{STATUS}}`

## Protected paths and strengths

- Protected paths: `{{PATHS}}`
- Protected narrative/camera/score strengths: `{{STRENGTHS}}`
- Required owner decisions: `{{DECISIONS_OR_NONE}}`

## Execution and evidence budget

| Dimension | Locked value |
| --- | --- |
| Repair loops | `{{COUNT}}` |
| Time/token budget | `{{BUDGET}}` |
| Target devices | `{{DESKTOP_MOBILE_OTHER}}` |
| Quality tiers | `{{TIERS}}` |
| Reduced motion | `{{REQUIRED_VARIANT}}` |
| FPS/frame-time target | `{{TARGET}}` |
| GPU/draw/shader/memory limits | `{{TARGETS}}` |
| Capture density | `{{ANCHORS_AND_BEFORE_AT_AFTER_RULE}}` |
| Audio evidence | `{{AUTHORIZED_REQUIRED_OR_PROTECTED}}` |

## Stop conditions

- Authority conflict or protected-path requirement.
- Critical/high defect cannot be repaired inside scope.
- Configured repair budget is exhausted.
- Weighted score improves less than 0.05 twice.
- A headed taste, canon, scope, exception, or publish decision is required.
- `{{RUN_SPECIFIC_STOP_CONDITION}}`

## Lock disposition

- Status: `template_incomplete`
- Locked by: `{{ORCHESTRATOR}}`
- Locked at: `{{ISO_8601}}`
- Open authority questions: `{{QUESTIONS_OR_NONE}}`
