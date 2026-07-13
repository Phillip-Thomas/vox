# Screenshot Report

## Run

- Repo: `/home/thomasphillip/Projects/vox`
- Surface: whole game/site review
- Branch/commit: `agent/paravoxia-story-audio-world-update` / `60e12fe` during final capture
- Canonical preview URL: `http://127.0.0.1:5201/`
- Existing Vite servers found: 4 for the same checkout
- Server reused: strict-port `5201`
- Extra server started/stopped: none
- Capture mode: headless Chromium/SwiftShader for new audit frames; use for composition/structure and verify color/AA decisions in headed real-GPU capture

## Screenshot Matrix

| View/state | Viewport | Path | Result | Notes |
| --- | --- | --- | --- | --- |
| Landing desktop | 1440x900 | `/tmp/paravoxia-audit/landing-desktop.png` | mixed | Strong macro identity; Story hierarchy too weak |
| Landing mobile | 390x844 | `/tmp/paravoxia-audit/landing-mobile.png` | mixed | Functional, but copy/buttons crowd the lower viewport |
| Story 1-bit | 1440x900 | `/tmp/paravoxia-audit/story-ch1.png` | pass concept | Distinctive and intentional; needs full-motion pacing review |
| Story color/feed | 1440x900 | `/tmp/paravoxia-audit/story-ch2.png` | mixed | Intent is clear; isolated frame is flat/low-information by design |
| Story embodied | 1440x900 | `/tmp/paravoxia-audit/story-ch3.png` | mixed | Strong narrative idea; sky-heavy composition and sparse focal hierarchy |
| Mobile underwater sandbox | 390x844 | `/tmp/paravoxia-audit/sandbox-mobile.png` | mixed-pass | Real mobile controls and readable medium shift; HUD is dense and sprint absent |
| Cube overview | 1280x720 | `main/captures/audit-2026-07-12_overhead.png` | pass macro | Best visual signature; world reads immediately |
| Under-canopy | 1280x720 | `main/captures/audit-2026-07-12_underCanopy.png` | fail | Camera intersects/presses into geometry; no hero subject |
| Coast | 1280x720 | `main/captures/audit-2026-07-12_coast.png` | fail | Translucent water walls, overbright/flat depth, weak shoreline read |
| Horizon | 1280x720 | `main/captures/audit-2026-07-12_horizon.png` | fail | Sparse focal hierarchy and overbright water/sky separation |
| Tree silhouette board | 1600x900 | `main/captures/tree-overhaul-final-silhouettes.png` | mixed-pass | Species silhouettes are distinct; close-up geometry remains procedural/toy-like |

## Interaction Evidence

- Landing was loaded at desktop and mobile without console errors.
- Story deep links reached `ch1-fixed`, `ch2-color`, and `ch3-gather`.
- One story-arrival capture was poisoned by transient HMR mismatch while the branch changed; a clean production build passed, so the frame was excluded from visual judgment.
- Agent camera captured HIGH profile at five vantages. Reported draws were 40; estimated triangles were about 1.27M-1.48M; headless FPS varied 48-60, with one invalid unknown-view sample.
- Independent live profile probe found HIGH -> POTATO did not alter tested scene geometry/layer counts.

## Quality Questions

| View | Appealing | Purposeful | Meaningful | Space | Brand | Goal | Copy | Action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Landing desktop | yes | mixed | mixed | yes | yes | no | mixed | make Story primary and premise specific |
| Landing mobile | yes | mixed | mixed | mixed | yes | no | mixed | simplify hierarchy and reserve safe HUD space |
| Story 1-bit | yes | yes | yes | yes | yes | mixed | yes | screen complete flow in motion |
| Story embodied | mixed | yes | yes | no | yes | mixed | yes | reframe hero subjects and transitions |
| Cube overview | yes | yes | yes | yes | yes | yes | n/a | preserve as north-star macro identity |
| Ground/coast/horizon | mixed/no | mixed | mixed | no | mixed | mixed | n/a | hero atlas, grounding, water/material/landmark pass |
| Mobile underwater | yes | yes | yes | mixed | yes | mixed | mixed | HUD settings, sprint, underwater polish matrix |

## Missing Evidence

- Headed real-GPU full story movie screening.
- Tablet/laptop breakpoints.
- Loading/error/empty/reconnect/conflict/accessibility states.
- Real-device thermal and memory behavior.
- Audio listening critique and spatial mix capture.
- Gamepad/cross-browser journey evidence.

## Gate

- Desktop/mobile captured: `pass`
- Representative story/sandbox states captured: `pass`
- Required failure/stress states captured: `fail`, recorded as follow-up
- Every major screenshot passed or has a concrete defect: `pass`
