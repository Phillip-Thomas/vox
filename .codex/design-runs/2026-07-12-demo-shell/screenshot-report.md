# Screenshot Report

## Capture Matrix

| State | Viewport | Evidence | Result |
| --- | --- | --- | --- |
| Landing controls | 1440x900 desktop | `main/captures/demo-shell/landing-controls-desktop.png` | pass; exact tagline and all desktop groups visible |
| Landing controls | 390x844 narrow/touch presentation | `main/captures/demo-shell/landing-controls-mobile.png` | pass; wordmark, tagline, and touch groups fit without horizontal clipping |
| Active Story pause | 1440x900 desktop | `main/captures/demo-shell/story-pause-desktop.png` | pass; current controls shown, Resume focused, Star Map absent |
| Sandbox pause | 1440x900 desktop | `main/captures/demo-shell/sandbox-pause-desktop.png` | pass; title, controls, Star Map, and footer retain hierarchy; secondary settings scroll |
| Completed save | 1440x900 desktop | `main/captures/demo-shell/completed-save-landing.png` | pass; Return to Site and explicit Replay Story warning |
| Completion transition | 1440x900 desktop | `main/captures/demo-shell/story-complete-desktop.png` | pass; non-narrative completion dialog with continue/menu/replay recovery |

## Interaction Evidence

- The active A1 Story was left paused for nine wall-clock seconds. The browser probe observed no beat or effect advance and no Story Star Map.
- Deterministic director coverage pauses beyond the full A1 ramp, proves no narrative advance, resumes, and reaches the expected beat normally.
- Replay coverage proves a fresh Story run, cleared Story milestones/carried inventory/site state, and preserved non-Story progress.
- Return-to-Site coverage begins from a completed save on world `7,7`, observes the `Preparing Site…` hold, and confirms the persisted destination is the Story coordinate `-1,-1` before play enters.
- Fabricator and completion-dialog probes assert initial focus, inert backgrounds, Escape recovery, and dialog containment; deterministic model tests cover the corrected policy-specific control labels.
- The completion dialog is captured through a development-only visual-state query. The real completed transition remains covered by the director and Story-state tests; software-rendered headless time advances too slowly for a dependable 45-second movie capture.
- No page errors were recorded in the accepted shell captures.

## Capture Notes

- Chromium used the checkout's existing Vite server at `http://127.0.0.1:5201/`; this run started or stopped no persistent server.
- The WebGL canvas was hidden only for shell screenshots to avoid software-renderer readback stalls. DOM layout, focus, copy, visibility, and interaction state are the surfaces under review.
- Mobile evidence is a narrow touch presentation in desktop automation, not the final real-device support gate.

## Approval

- Desktop shell: pass
- Narrow/touch presentation: pass for layout; real-device gameplay decision remains Batch 5 scope
- Story pause/travel safety: pass
- Completed-save/replay clarity: pass
- Human taste: refined pass for this Batch 1 surface
