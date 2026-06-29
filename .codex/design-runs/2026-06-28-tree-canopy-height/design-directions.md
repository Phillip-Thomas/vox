# Design Directions

## Direction A: Profile-Level Canopy Scale

Raise the deterministic profile height floor, widen the bounded range, and scale crown/trunk mass from that same profile. Keep the generator and in-world instances aligned.

Why selected: fixes the source of truth and keeps tree-test, TreeField, impostors, wind, and harvesting consistent.

## Direction B: Instance-Only Scale Boost

Leave species profiles unchanged and multiply in-world tree instances larger at render time.

Why rejected: it would make the harness and profile data lie, and could desync expectations for geometry budgets and future tree tuning.

## Direction C: Species-Specific Giant Variants

Add rare large tree classes with separate height bands.

Why rejected: the request was for a better minimum and wider normal range, not rare giant set pieces.
