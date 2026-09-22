# Common Ground — bounded instrument-repair feasibility (one comparison, final)

Read-only **preproduction measurement**, 2026-09-06, CPU only. No source, worldgen,
validator, canon, signature, build, browser or GPU touched. Inputs hashed
before/after: **all 13 byte-identical** (`sha256sum -c` OK; `find main/src -newermt`
empty). Signs nothing and proposes no geometry of its own — it measures the **exact
two creative-nominated layouts**. Probe `geometry-instrument-probe.mts` (repro in its
header) → `geometry-instrument.json`. **CPU 1.84 s** (budget 300 s); two runs
byte-identical apart from timing. **1200 candidates per range** (300 dry centres
nearest the hero tree × 4 quarter turns).

## VERDICT

**Found at both nominated ranges** — 570 qualifying layouts at range 12, 58 at range
24, of 1200 each. No threshold relaxed; none tightened to force failure. One
attribution rule was *added*: the qualifying blind span must be caused by the
**backing alone** (`REFERENCE OCCLUDED · SURVEY HOUSING` must stay distinct). It
removed 55 (r12) and 77 (r24) layouts whose span was partly the hero trunk.

Apparatus, identical rendered/collision/occlusion box, no invisible cone: socket
**1.30** above the grounded pose; backing **0.12 × 2.00 × 1.60** centred
**(−0.90, 1.30, 0)** → world `y ∈ [ground+0.30, ground+2.30]`. Socket sits **0.80**
outside the backing's near face, so rays start outside the apparatus's own surface;
**the backing is never ray-exempt** (only the two support columns are). Bracket/stand
carry footing and collision but are deliberately **not** ray occluders — fewer
occluders cannot manufacture blindness. Bodies radius **0.5**; worker height 2.01 /
socket **1.85**, player 3.60 / socket **1.35** (current source).

## Top 3 passing layouts per range (measured world units)

| # | Rng | R ground / yaw | Short S→E | Blind span | Long | Δ / × | Long mgn | W mgn / clear | E→C | outside R | common | Terra lat / clear |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
|1|12|(−34, 51.05, 20) 90°|16.0 (17s)|**14.0**|32.0 (57s)|+16.0 / ×2.00|0.67|4.91 / **1.00**|18.0|8.25|8.00|4.00 / 2.00|
|2|12|(−36, 51.05, 14) 270°|16.0 (17s)|14.0|32.0 (57s)|+16.0 / ×2.00|0.67|4.91 / **1.00**|10.0|10.00|8.00|4.00 / 2.00|
|3|12|(−32, 51.05, 34) 180°|16.0 (17s)|14.0|32.0 (57s)|+16.0 / ×2.00|0.67|4.91 / **1.00**|10.0|10.00|8.00|2.83 / 2.00|
|1|24|(−12, 51.05, 24) 90°|32.0 (33s)|**30.0**|92.0 (123s)|+60.0 / ×2.875|1.19|8.86 / 2.00|12.0|11.00|10.00|2.00 / 2.00|
|2|24|(−10, 51.05, 22) 90°|32.0 (33s)|30.0|92.0 (117s)|+60.0 / ×2.875|1.37|8.86 / 2.00|12.0|11.00|10.00|2.00 / 2.00|
|3|24|(−8, 51.05, 22) 90°|32.0 (33s)|30.0|92.0 (123s)|+60.0 / ×2.875|1.37|8.86 / 2.00|12.0|11.00|10.00|2.00 / 2.00|

Every blind span is `backing`-only; all poses, socket boxes and route vertices are in
the JSON. Ground is uniform `y = 51.05` under every accepted layout; footprint columns
are height-uniform. Centres lie 10.2–16.0 from the hero tree; the world was not
warped. Caps hold (≤128 samples, ≤120 units; 1.0/0.25 sampling). S and E are **11.33**
(r12, margin 0.67) and **22.63** (r24, margin 1.37) from the socket, in range and
clear — **E is fixed-valid for the long route**. Neither endpoint witnesses the whole
span (far end 14.0 / 30.0 > range). W covers it and is reachable. Long routes are
source-graph routes constrained by fixed-reference range+LOS; no alt grid path
crosses backing or trunk.

## Worst-case margins / hold conditions

- **Range-12 W sits exactly at the body-body limit: 1.00 = 2 × 0.5, margin 0.00.**
  Its **release cylinder (1.75) overlaps the survey corridor**; the layout is not
  rejected for that, but the honest condition is that the traversal must **hold if a
  body is actually inside it**. Range-24 W is 2.00 clear, no overlap.
- Terra's witness: 2.00–4.00 lateral of C (≥2, unscaled), 2.00 clear of the arrival
  route, occupancy margin **+0.75**, release **+0.25**, Δy 0.00. Never stands at C.
- Tightest overall margin: long-route range **0.67** (r12).
- Common comparison measured, not thresholded: **8.00** units (r12, of an 8.25
  out-of-reference portion) and **10.00** (r24, of 11.00), inside W-7744's held
  reference at E. The 6-unit rule was applied only to the short survey span.
- Range-12 #1's E→C walks 18.0 against a 6.0 straight offset (terrain detour); #2/#3
  walk 10.0. Least direct of the six, not a failure.

## Planner cross-validation

Shipped `planAgentSurfaceRoute` agrees on both positives (S→E, E→C:
`walk / dry-surface-path`) and the terrain negative (wet goal →
`wet-goal-resolved-to-dry-approach`; probe: column unwalkable). It **disagrees on the
prop negative**, walking into the backing's centre column, knowing neither the
backing collider nor the hero trunk. The probe supplements both as explicit boxes on
the node mask and the walked segments.
