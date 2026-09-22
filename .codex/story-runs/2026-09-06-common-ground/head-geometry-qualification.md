# Head-cap qualification — measurement only

2026-09-06. **PASS**, no caveats. Same single candidate, no search. Proposed
geometry only: finite range, backing, stand, bracket and cap do not exist in the
runtime. No source, build, browser, GPU or signed file touched; no threshold
added or relaxed. CPU 0.71 s.

## Cap

World AABB lo (-34.20, 52.25, 19.80) – hi (-33.80, 52.35, 20.20), 0.40 × 0.10 ×
0.40: the stand footprint raised from the stand/bracket cap (grounded + 1.20) to
the fixed reference plane (grounded + 1.30). Its bottom face is coincident with the
stand top over the full footprint; bracket ∩ backing (0.40×0.40×0.12) and
bracket ∩ stand (0.40×0.40×0.10) are volumetric. Backing → bracket → stand → cap
is one literal connected chain from the dry ground column to the fixed plane. The fixed socket (-34, 52.35, 20) lies **on** the exposed cap
top face: vertical gap 0.00. Nothing is modelled above that plane (etched flat
mark). The earlier 0.10 head-gap caveat is retired, not restated.

## Contact rule

General, symmetric at both ray endpoints, applied to every box (backing, stand,
bracket, cap, trunk) with no exemption: endpoint-only contact is harmless iff the
adjacent open segment stays outside; interior crossing blocks. Exact parametric
arithmetic, no spatial epsilon. Documented: a segment lying in a face plane
blocks. Walk mask, walked-segment and body tests stay inclusive. Six tests pass: top contact exiting clear, reversed
endpoints clear, endpoint-on-face pointing inside blocked, head crossing blocked,
face tangency blocked, 0.12 backing crossing blocked (inside length 0.120000).

## Measured

Every property of the selected-candidate run is byte-identical: short 16.00
(span 14.00, backing only), long 36.00 (+20.00, ratio 2.25, all points
supported), common 18.00, Terra and shifted-W witnesses valid, no body/path
intersection. 162 rays touch the cap top at their endpoint; 0 cross any solid
except the 15 short-route backing occlusions.
