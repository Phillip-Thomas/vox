# Adversarial Depth Iteration

## User Feedback

The static face orientation is functionally better, but visually too flat. The map should sit caticorner enough to read as 3D while still being predominantly viewed from the current face. Non-visible cube lines need clearer treatment, possibly dashed or solid.

## Direction A: Current Face Plate + Dashed Hidden Scaffold

- Tilt the active face away from the camera enough to reveal depth.
- Render the active face as a translucent solid plate.
- Render active face edges as solid bright lines.
- Render rear and connector edges as dashed, lower-opacity scaffold lines.
- Keep markers and arrow above the active face.

Adversarial critique:
- Risk: too many dashes can look noisy in a tiny HUD.
- Mitigation: use short, low-opacity dash bars and keep active face edges solid.

## Direction B: Solid Mini Cube

- Render a transparent solid cube with all faces lightly filled.
- Use edge opacity and depth testing to imply hidden lines.
- Keep only the active face tinted.

Adversarial critique:
- Risk: face fill can obscure markers and make the instrument feel heavier.
- Risk: transparent face sorting can read muddy in a tiny R3F canvas.

## Selected

Direction A. It directly answers the readability issue while preserving the lightweight scanner aesthetic and keeping gameplay markers visible.

## Acceptance Target

- Current face is still the visual anchor.
- The cube reads as 3D at a glance.
- Hidden/rear structure is visually subordinate.
- The arrow remains the dominant directional indicator.
