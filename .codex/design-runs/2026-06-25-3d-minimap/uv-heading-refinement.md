# UV Heading Refinement

## Problem

The first minimap arrow used the raw world-space forward vector. That made the arrow harder to read across cube faces because the direction was not expressed in the player's current face-local frame.

## Refinement

- Resolve the active cube face from the player's current up vector.
- Define a stable `U/V` basis for each cube face.
- Project surface yaw into that face-local `U/V` basis.
- Recompose heading with pitch so looking down always points inward toward the cube center.
- Show the active face and render a subtle face plate with `U` and `V` guide axes inside the minimap.
- Keep the minimap cube orientation static while the player remains on one face; only the arrow rotates with camera yaw/pitch.
- Slerp the minimap cube to the new face orientation when the active cube face changes.

## Face UV Convention

- Top: `U = +X`, `V = -Z`
- Bottom: `U = +X`, `V = +Z`
- Right: `U = -Z`, `V = +Y`
- Left: `U = +Z`, `V = +Y`
- Front: `U = +X`, `V = +Y`
- Back: `U = -X`, `V = +Y`

This keeps side faces upright relative to world `+Y` and keeps top/bottom readable when crossing cube edges.
