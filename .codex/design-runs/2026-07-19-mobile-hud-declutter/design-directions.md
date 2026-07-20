# Design Directions

## Direction 1 — Quiet Field Rail (selected)

- Thesis: keep only a compact top rail and thumb controls persistent; move explanation and utilities into one-level temporary panels.
- Structure: compact `SUIT` summary, `JOURNAL` trigger, collapsed pack, and one `SYSTEMS` trigger. The journal is a bottom sheet. Full vitals and system actions expand only on request.
- Interaction: directional marker and critical status never disappear; blocking journal pauses input; one panel at a time.
- Brand: restrained suit telemetry, asymmetric field-journal sheet, existing cyan/glass/mono language.
- Asset strategy: CSS-native glyphs and existing tokens only.
- Strength: largest viewport recovery with low story-discovery risk.
- Risk: compact controls need explicit labels and careful safe-area placement.

## Direction 2 — Unified Command Drawer (rejected)

- Thesis: a single 48px command button opens tabs for Objective, Suit, Pack, Build, Craft, and Settings.
- Structure: almost no persistent utility HUD beyond warnings and one menu trigger.
- Interaction: two taps for most secondary actions; directional marker remains live.
- Brand: ship-console drawer with tabbed subsystems.
- Asset strategy: existing tokens, no new assets.
- Strength: maximally clean world view.
- Risk: hides the objective and inventory too deeply, creates a dashboard inside the game, and weakens time-to-guidance.

## Direction 3 — Context-Auto HUD (rejected)

- Thesis: elements appear only when their underlying value or action changes.
- Structure: no permanent journal or vitals trigger; temporary toast plus marker.
- Interaction: proximity/context drives controls and warnings.
- Strength: cinematic and extremely sparse.
- Risk: invisible affordances repeat the exact “is this bugged?” failure the project has been correcting.

## Comparison

| Direction | Viewport | Discoverability | Story safety | Selected |
| --- | ---: | ---: | ---: | --- |
| Quiet Field Rail | High | High | High | Yes |
| Unified Drawer | Very high | Medium | Medium | No |
| Context-Auto | Maximum | Low | Low | No |

## Gate

- 3 thesis-distinct directions: `pass`
- Substantive restructure included: `pass`
- Asset strategy explicit: `pass`
- Product truth and production language mapped: `pass`
