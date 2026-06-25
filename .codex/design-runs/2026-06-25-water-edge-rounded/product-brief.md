# Product Brief

Surface: Paravoxia water voxel rendering at cube-face edges.

Goal: remove the X-shaped crossing created by the first seam-height fix while preserving aligned water height around cube edges.

User motivation: the ocean already looks strong, but cube-edge water should feel production-quality and not reveal intersecting transparent planes.

Primary action: inspect the pinned water edge vantage.

Success proxy: at `world=-91,-4`, `day=0.2458`, camera pose `[-51.996,53.793,36.882]`, water at the cube edge renders as a single rounded/beveled strip with no obvious perpendicular X overlap.

Language constraints: no visible text changes.

