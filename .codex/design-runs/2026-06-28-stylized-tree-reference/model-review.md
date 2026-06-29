Pre-implementation model review:

Useful reference ideas:
- Fluffy Tree: split the tree canopy into clusters/tufts; shade each tuft as a soft volume; bias leaf-card normals so alpha planes do not look edge-on and dark.
- Elysium/FluffyGrass: use ACES, soft shadowing, fog/atmosphere, wind/noise fields, and many small alpha cards for stylized natural density.
- Florasynth: expose tree identity through growth controls instead of only colors and density.

Risks:
- Shader changes may fail to compile if new attributes are missing on blossom or impostor geometry.
- Species controls can push tree height or branch count outside the existing budget.
- Too much normal bias can flatten lighting and make every canopy look like one blob.
- Thin-branch pruning can accidentally remove support geometry while leaves still float.

Mitigations:
- Add attributes to all leaf-like geometries.
- Keep profile ranges narrow and bounded.
- Reuse existing tests for height budget and add tests for new controls.
- Capture all silhouettes and a variety grid before final scoring.
