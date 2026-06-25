# Critic Report

Severity: high before this patch. The previous fixes solved one angle but introduced a larger visual regression: broad water bands near the cube edge became cattycorner and failed to line up. That was an implementation problem caused by using an angular surface rule that treated cells near the edge as edge cells.

Evidence: the latest reported view was captured to `.codex/design-runs/2026-06-25-water-edge-rounded/evidence/water-edgeband-desktop.png` and the mobile equivalent. The band within roughly 10 units of the cube edge is no longer forced into edge/corner treatment. The cross-check screenshots at `.codex/design-runs/2026-06-25-water-edge-rounded/evidence/water-edgeonly-crosscheck-desktop.png` and mobile equivalent still cover the earlier cube-edge area.

Cause: `classifyWaterFace` used a broad `dot >= 0.5` style rule. On a cube face near an edge, that incorrectly classified the neighboring side as an outward surface, so a whole band of water got special edge handling.

Fix: classify surfaces by dominant cube-axis ties. A normal cell near the edge has one dominant outward surface; an actual cube-edge/corner cell can have multiple. Edge trim now only triggers when a sibling face is also an actual surface face.

Remaining limitation: this does not add a continuous curved water shell. The correct next step for real roundness is a dedicated edge-cap geometry for exact edge cells; rotating planes has been rejected.
