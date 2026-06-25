# Design Directions

## Direction A: Radio Link Panel

Thesis: Add `Co-op` as a peer panel beside Controls/Graphics/Audio. The panel behaves like a ship comms link: compact status line, create button, join input, invite code readout.

- Layout: existing lower-left content column; one additional glass panel.
- Interaction: create/join inside the panel, copy invite code when connected.
- Asset strategy: live canvas remains primary asset.
- Strength: lowest disruption, brand-consistent, good for alpha feature gating.
- Risk: less visually prominent than a full co-op flow.

## Direction B: Split Launch Choice

Thesis: Replace the single Play action with two launch lanes: Offline and Co-op Alpha. Co-op expands into create/join cards.

- Layout: larger launch control group with two equal primary actions.
- Interaction: mode selection first, then create/join.
- Asset strategy: live canvas remains primary asset, with stronger status rail.
- Strength: clearer once co-op is launch-ready.
- Risk: overstates co-op completeness and competes with the proven offline path.

## Selected

Direction A. It exposes real Phase 1 plumbing without making co-op look complete before authoritative gameplay sync is integrated.
