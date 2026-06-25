# Adversarial Angle And Scale Iteration

## User Feedback

- The radar cube feels bigger than the actual cube relative to the player arrow.
- Near a face transition, the arrow still looks too far from the edge.
- The caticorner angle is improved but still not pretty enough.
- The cube map is too large for its HUD container and clips visually.

## Direction A: Measured Face Plate

- Scale world coordinates so the gameplay cube surface maps directly to the visible minimap face edge.
- Shrink the minimap geometry inside the panel.
- Keep the active face dominant.
- Use fixed camera-relative angles: 30 degree yaw and 15 degree pitch from square-on.
- Keep hidden/rear scaffolding dashed and subordinate.

Adversarial critique:
- Risk: reducing size could weaken the read of the minimap.
- Mitigation: keep active face edges bright and preserve the scanner ring.

## Direction B: Larger Container

- Keep geometry scale mostly unchanged.
- Make the HUD panel/canvas larger to avoid clipping.
- Use the same caticorner treatment.

Adversarial critique:
- Risk: larger HUD is worse for gameplay space and mobile.
- Risk: does not fix the edge-position mismatch.

## Selected

Direction A. It fixes the functional scale problem and preserves HUD ergonomics.

## Acceptance Target

- Surface positions sit near the visible face edge when the player is near a face boundary.
- The cube fits inside the minimap panel without clipping.
- The angle reads as an intentional, common 3D instrument angle rather than arbitrary rotation.
