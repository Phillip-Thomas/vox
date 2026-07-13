# Lessons Learned

- Connected topology matters more than adding triangles to disconnected primitives.
- Curved sweep frames changed the ring orientation, but their original sidewall index order remained in place. That reversal made `FrontSide` culling expose the wrong shell; winding and both cap directions must be validated together whenever a sweep frame changes.
- Caps at overlapping body, neck, head, muzzle, and tail joints create internal disks that become dark wedges under backlight. Joined anatomical masses must leave their shared ends open.
- Converting indexed geometry to non-indexed before normal generation recreated the faceted look; shared vertices and explicit cap centers fixed it.
- Stochastic alpha coverage made thin membranes sparkle against terrain and looked like broken occlusion. Deterministic opaque coverage with membrane color, roughness, and rim response is the stable single-draw solution.
- Semantic rig attributes exceeded the guaranteed WebGL limit until four scalar channels were packed into one `vec4`.
- Motion must rotate normals with positions and must not advance stride independently from travel distance.
- Whole-animal hop translation must include appendages, or the body visibly separates from its limbs.
- A renderer-neutral morphology table avoids repeating phenotype data per agent while keeping future backends self-contained.
- Isolated fixed-camera species captures catch topology and gait defects that broad world screenshots hide behind vegetation and terrain.
- Geometry tests now reject invalid indices, degenerate triangles, non-finite positions or normals, and negative aggregate solid volume before a winding regression can reach visual review.
