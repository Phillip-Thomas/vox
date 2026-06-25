# Selected Direction

Selected: Direction A, exact-edge-only face-aligned edge trim.

Reason: the regression came from treating a broad angular band near the cube edge as if it were the edge itself. The corrected approach uses dominant cube-axis ties: normal water cells near an edge stay aligned to their main cube face, and only actual edge/corner cells receive special edge treatment. This addresses both reports: no crossed X at the old cube-edge vantage and no cattycorner/diagonal water band at the new `water looks way worse now` vantage.

Rejected: one-sheet dedupe/rounded-normal rendering, because screenshot evidence showed it worsened the water from other viewpoints. Dedicated curved edge meshes remain the right route for a truly rounded edge, but the current patch avoids faking roundness by turning broad water planes.

Human taste assumption: for the current voxel renderer, stable face-aligned water with exact-edge-only treatment is preferable to an attempted smooth bevel that creates broad diagonal planes.
