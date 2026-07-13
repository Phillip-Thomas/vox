# Site Audit

## Summary

- Site/game goal: deliver a distinctive browser-native voxel universe where visual fidelity, consciousness, survival, ecology, travel, and co-op form one authored experience.
- Current baseline score: `3.78 / 5`.
- Recommended execution mode: `refactor-existing`.
- Recommended first surface: the award-slice front door and ending, paired with truthful controls/settings foundations.
- Core diagnosis: award-caliber ingredients are currently presented as multiple impressive systems rather than one fully resolved player journey.

## Highest-Severity Site-Level Defects

| Defect | Severity | Evidence | Response |
| --- | --- | --- | --- |
| No singular finished vertical slice | critical/product | Story explicitly ends at a temporary chapter-4 arrival | Frame arrival as an intentional finale before adding more breadth |
| Quality settings do not reconfigure the live scene | high/technical | HIGH -> POTATO retained tested draw/triangle/layer counts; consumers snapshot at mount | Subscribe/rebuild profile consumers and add a differential browser test |
| Initial world generation blocks main thread | high/performance | Cold audit: 844.6 ms generation and >1 s Long Tasks | Use existing world-prep worker for initial/resume/jump worlds |
| Sandbox loop lacks consequence/payoff | high/product | Non-lethal vitals, no general warmth, shelter meaning incomplete, repair unreachable | Close shelter -> exposure -> fire -> failure/recovery -> repair loop |
| Eager audio is disproportionate | high/performance | Any landing pointer unlock loads all tracks; about 183 MiB decoded PCM | Unlock on intentional action, stream/demand-load, unload inactive buffers |
| First load is one 4.67 MB JS chunk | high/performance | Vite build: about 1.57 MB gzip; no production lazy imports/chunk plan | Split story/co-op/debug/post/audio and preload only menu/world core |
| Accessibility/control recovery below showcase bar | high/accessibility | Zoom disabled, outlines removed, `transition: all`, no reduced-motion menu pass, pause lacks controls | Canonical actions, focus/modal contract, zoom/focus/reduced motion fixes |
| Art pipeline is system-rich but hero-poor | medium-high/visual | No authored runtime visual asset layer; shadows off; caustics/SSR tier claims incomplete | Add authored hero layer and spend recovered budget on contact/shadow/material response |
| Machine visual score is mistaken for taste approval | medium-high/process | Internal `4.86` is a machine pass; human taste remains explicitly pending; shader explosion accepted | Separate health/perf gates from jury-grade visual critique |
| Browser journeys are outside release gate | high/quality | `verify` is node tests/typecheck/build; atlas and story probes are manual | Gate story, sandbox, co-op, mobile, accessibility, Long Task, bundle, and profile-delta flows |

## Surface-Level Defects

| Surface | Defect | Severity | Response |
| --- | --- | --- | --- |
| Landing | `Play Now` is dominant while Story is the unique differentiator; subtitle is generic | high | Make Begin/Continue Story primary; call sandbox what it is; state the fidelity premise |
| Controls/pause | Landing documents six actions while runtime has many more; pause has no Controls | high | One action registry and mode-aware controls in landing/pause/HUD/touch |
| Mobile | Missing sprint and settings; dense top HUD consumes substantial viewport | medium-high | Add sprint, HUD scale/opacity/compact options, touch-safe settings |
| Story | Arrival is a development boundary, not a designed closing beat | critical | Finale, recap/credits/tease, explicit earned sandbox handoff |
| Crafting | All stations accessible and future recipes exposed | high | Primitive-only field recipes, wreck repair objective, then one physical station unlock |
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

- Foundation: action registry, modal/focus contract, reactive quality, device adaptation, initial worker prep, bundle/audio loading, spatial culling, browser release gate, hero asset/audio strategy.
- Surface-local: landing hierarchy/copy, arrival finale, primitive recipe gating, pause controls/room management, underwater caustics/palette, mobile sprint.

## Gate

- Real code and rendered evidence: `pass`
- Site-level and surface-level defects separated: `pass`
- Foundation and local work separated: `pass`
- Refactor-existing recommendation justified: `pass`
