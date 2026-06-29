# Implementation Plan

1. Replace per-segment duplicated ring emission with one shared ring per skeleton node.
2. Preserve deterministic roughness, bark UV around the trunk, and wind `aStiff`.
3. Connect each parent-child edge through shared ring indices.
4. Add a regression test proving interior stem rings are referenced by adjacent chunks.
5. Capture close-up and in-world screenshots.
6. Run focused tests and full verification.
