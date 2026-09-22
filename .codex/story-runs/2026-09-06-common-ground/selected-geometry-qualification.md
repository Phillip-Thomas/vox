# Selected-candidate qualification — measurement only

2026-09-06. **PASS** on every requested property, with two reported caveats. One
candidate, no search, no fallback scan, no winner claim. Proposed geometry only:
finite range, backing, stand and bracket do not exist in the runtime. No source,
build, browser or GPU touched; no threshold added or relaxed.

Candidate: `geometry-instrument.json` range 12 `top3[0]` — fixed apparatus
grounded (-34, 51.05, 20), yaw 90, S(-26,51.05,12), E(-42,51.05,12),
C(-48,51.05,12), Terra (-44,51.05,12), intermediate witness shifted by
commission to W(-34,51.05,10).

## Literal solids (all included in mask, segments and rays; no exemption)

- backing (-34.80, 51.35, 19.04)–(-33.20, 53.35, 19.16), 1.60 × 2.00 × 0.12
- stand (-34.20, 51.05, 19.80)–(-33.80, 52.25, 20.20), 0.40 × 1.20 × 0.40
- bracket (-34.20, 51.85, 19.04)–(-33.80, 52.25, 19.90), 0.40 × 0.40 × 0.86

Bracket overlaps the board (0.40 × 0.40 × 0.12) and the post (0.40 × 0.40 ×
0.10), so backing → bracket → head support is one connected solid chain resting
on a single uniform-height dry column. Stand and bracket tops are 52.25 =
grounded + 1.20, below the lowest ray socket (fixed plate 52.35). No body
capsule, walked path or ray touches either solid; the only ray occlusions are 15
short-route rays on the backing.

## Measured

Short 16.00 units, 17 samples, unsupported span 14.00 caused solely by the
backing. Long 36.00 units, +20.00, ratio 2.25, every sample and every 0.25
dense point supported, min range margin 0.67. E→C 18.00 units: all 31 samples
and all 73 dense points in range and unobstructed from the held worker socket at
E (1.85), max 8.50, margin 3.50. Worker final traversal: all 73 dense points in
range and unobstructed from Terra's 1.35 socket, max 7.23, margin 4.77, lateral
offset 4.00, body clearance 2.00, no hold required. Reciprocal necessity span
8.00 units (0.444 of the passage), nonzero. Shifted W covers all 15 span
samples, max 7.30, margin 4.70, body clearance 2.00, release margin +0.25,
reachable. Neither endpoint covers the span (11/15, first failure out-of-range).
All caps respected. CPU 0.74 s.

## Caveats

1. **Head connection.** The commissioned cap sits 0.10 below the fixed plate, so
   no literal solid can touch the socket point. The post ends directly beneath
   the socket column with a 0.10 gap; the plate above the cap is not modelled.
   Reported, not fabricated.
2. **Long route changed.** Adding the stand blocks the apparatus's own base
   column, which the broad probe's long route crossed: 36.00 units instead of
   32.00. Short and common routes are unchanged. All bounds still met.

Fixed reference is the 1.30 plate (52.35). The broad JSON's `poses.R` 1.85 entry
is generic per-pose metadata read by no predicate.
