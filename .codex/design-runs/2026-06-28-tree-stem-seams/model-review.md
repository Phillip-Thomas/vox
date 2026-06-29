# Model Review

## Notes

- Bark shader grain uses local height and around-trunk UV; it was not the main seam source.
- Geometry emitted duplicate parent/node rings for every segment.
- Shared node rings preserve deterministic output and reduce unnecessary trunk vertices.
- Branch bases still retain stylized low-poly junctions, but main stems no longer show disconnected horizontal bands.

## Decision

Patch `buildTrunkGeometry` topology and add a regression test on index usage.
