# Site Audit

> Owner direction override, 2026-07-12: the existing arrival is an accepted Story
> Demo boundary, not a request to extend or rewrite the story. Audio is protected.
> Desktop control feel/bindings are protected. The active execution source is
> `PARAVOXIA_DEMO_FOUNDATION_PLAN.md`.

## Summary

- Site/game goal: deliver a distinctive browser-native voxel universe where visual fidelity, consciousness, survival, ecology, travel, and co-op form one authored experience.
- Current baseline score: `3.78 / 5`.
- Recommended execution mode: `refactor-existing`.
- Recommended first surface: interruption, control discovery, completed-save semantics, and truthful public-demo boundaries.
- Core diagnosis: award-caliber ingredients are currently presented as multiple impressive systems rather than one fully resolved player journey.

## Highest-Severity Site-Level Defects

| Defect | Severity | Evidence | Response |
| --- | --- | --- | --- |
| Demo boundary is not productized | high/product | Story ends at the current arrival and hands into sandbox, but completed-save/replay semantics are unclear | Keep the exact story boundary; add non-canonical demo completion/replay/continue-at-site product behavior |
| Quality settings do not reconfigure the live scene | high/technical | HIGH -> POTATO retained tested draw/triangle/layer counts; consumers snapshot at mount | Subscribe/rebuild profile consumers and add a differential browser test |
| Initial world generation blocks main thread | high/performance | Cold audit: 844.6 ms generation and >1 s Long Tasks | Use existing world-prep worker for initial/resume/jump worlds |
| Sandbox loop lacks consequence/payoff | high/product | Non-lethal vitals, no general warmth, shelter meaning incomplete, repair unreachable | Close shelter -> exposure -> fire -> failure/recovery -> repair loop |
| Audio footprint is a known observation, not active scope | accepted/protected | The new engine currently works well in owner testing | Regression-test only; no audio code or asset changes in the demo lift |
| First load is one 4.67 MB JS chunk | high/performance | Vite build: about 1.57 MB gzip; no production lazy imports/chunk plan | Split story/co-op/debug/post/audio and preload only menu/world core |
| Accessibility/control recovery below showcase bar | high/accessibility | Zoom disabled, outlines removed, `transition: all`, no reduced-motion menu pass, pause lacks controls | Canonical actions, focus/modal contract, zoom/focus/reduced motion fixes |
| Art pipeline is system-rich but hero-poor | medium-high/visual | No authored runtime visual asset layer; shadows off; caustics/SSR tier claims incomplete | Add authored hero layer and spend recovered budget on contact/shadow/material response |
| Machine visual score is mistaken for taste approval | medium-high/process | Internal `4.86` is a machine pass; human taste remains explicitly pending; shader explosion accepted | Separate health/perf gates from jury-grade visual critique |
| Browser journeys are outside release gate | high/quality | `verify` is node tests/typecheck/build; atlas and story probes are manual | Gate story, sandbox, co-op, mobile, accessibility, Long Task, bundle, and profile-delta flows |

## Surface-Level Defects

| Surface | Defect | Severity | Response |
| --- | --- | --- | --- |
| Landing | Subtitle is generic | fixed | Exact owner-selected replacement: `Make no mistakes` |
| Controls/pause | Landing documents six actions while runtime has many more; pause has no Controls | high | Add read-only mode-aware help and recovery while preserving bindings and feel |
| Mobile | Missing sprint and settings; dense top HUD consumes substantial viewport | medium-high | Add sprint, HUD scale/opacity/compact options, touch-safe settings |
| Story | Current endpoint needs clear demo completion/resume/replay semantics | high | No new narrative; keep `completeStory()` boundary and add only non-canonical product UI |
| Crafting | All stations accessible and future recipes exposed | high | Primitive-only field recipes; hide Maw repair, devices, and later-era rewards |
| Sandbox | Beautiful systems do not make fauna/ecology discoverable or durable | medium-high | Xenology/scanner journal and behavioral discoveries, not generic combat |
| Co-op | Infrastructure exceeds player-facing co-op design | medium | Pings, shared survey, one joint objective, room controls in pause |
| Water/high fidelity | Caustics and per-planet underwater palettes remain unwired; continuous underwater ambience absent | medium | Implement existing hooks; tune/capture entry-underwater-exit matrix |

## Visual Read

- Strong: macro cube-planet silhouette, live-world menu, CRT/feed story grammar, cyan telemetry, procedural variety, and a coherent uncanny palette.
- Weak: close-range surfaces and creatures often read as code-generated approximations; current capture vantages can be clipped, sky-heavy, flat, or overbright; local grounding is limited because shadows are globally off.
- The game needs fewer new shader families and more authored composition, material response, animation, sound, and interaction around a small number of hero moments.

## Audit Category Scores

| Category | Score | Notes |
| --- | ---: | --- |
| Product truth | 4.4 | Unique thesis, but current completion claims are fragmented |
| Goal effectiveness | 3.2 | Front door hides strongest mode; vertical slice lacks deliberate ending |
| Visual hierarchy | 4.0 | Landing strong; live HUD can become dense/cryptic |
| Information architecture | 3.2 | Controls/settings/progression ownership fragmented |
| Interaction quality | 3.4 | Many systems; consequence and recovery gaps |
| Aesthetic originality | 4.5 | Genuinely distinct fidelity ladder and cube cosmos |
| Creative ambition/brand fit | 4.8 | Exceptional ambition and strong identity |
| Production language | 4.1 | Story copy excellent; landing/system copy less specific |
| System consistency | 3.4 | Visual vocabulary coherent; product/state contracts less coherent |
| Responsiveness | 3.7 | Mobile is real and playable, but incomplete |
| Accessibility | 2.4 | Zoom/focus/motion/modal issues are material |
| Technical correctness | 3.6 | Test depth excellent; runtime/release gate gaps remain |
| Handoff fidelity | 3.8 | Extensive docs, but several accepted/stale exceptions |

## Foundation Vs Surface Work

- Foundation: read-only action metadata/help, modal/focus contract, reactive quality, device adaptation, initial worker prep, spatial culling, browser release gate, primitive systems closure.
- Surface-local: exact landing tagline, completed-save/replay semantics, primitive recipe gating, story-safe pause controls, mobile sprint.
- Protected/out of scope: new story content, audio changes, broad input remapping, later-era progression, MMO, and WebGPU migration.

## Gate

- Real code and rendered evidence: `pass`
- Site-level and surface-level defects separated: `pass`
- Foundation and local work separated: `pass`
- Refactor-existing recommendation justified: `pass`
