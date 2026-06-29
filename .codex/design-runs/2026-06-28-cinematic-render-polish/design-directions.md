Direction A: Soft Cinematic Resolve
- Thesis: keep the current vivid stylized world, but add a better final image resolve: softer highlight shoulder, slight lift, gentler contrast, toned-down outline, and moderate antialiasing only where profiles can afford it.
- Implementation: tune renderer exposure, make HIGH/ULTRA use MSAA through multisampling, soften ColorGradeEffect, lower outline strength/threshold, and keep profile gates.
- Why it fits: directly addresses harshness without changing the art direction.

Direction B: Painterly Film Pass
- Thesis: lean harder into a painterly postprocess, using the existing painterly effect or stronger stylized filtering to hide aliasing and shader mismatch.
- Implementation: default painterly/kuwahara-style treatment on higher profiles, reduce physical material contrast, push a more illustrative palette.
- Risk: could blur voxel readability, change the game identity too much, and cost older laptops.

Selected:
- Direction A. It preserves the current style and is a lower-risk shared foundation pass.
