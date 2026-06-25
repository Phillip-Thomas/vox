# Lessons Learned

- At cube edges, height continuity alone is not enough. If multiple outward water faces from the same cell render as full top sheets, transparent quads intersect and form an X.
- Edge/corner water should have one canonical top sheet per cell, with a blended outward normal for the rounded visual read.
- Keep the rule in the pure placement utility so static water, live-dug water, and replicated dynamic water use the same transform behavior.

