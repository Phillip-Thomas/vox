# Design Directions

## Direction A: Bounded Fullness System

Increase per-planet canopy density above baseline, tune per-silhouette leaf budgets, add richer cluster/card distribution, and keep one generator/material path. Use the shared wind profile for tree motion.

Why it fits: improves all variants together, preserves performance controls, and aligns trees with the grass/wind system.

## Direction B: Hero Species Redesign

Create bespoke branch and leaf generation logic for each silhouette: conifers as separate whorls, palms as custom leaflet meshes, willows as curtain strands, and broadleaf trees as shell canopies.

Why rejected for this pass: it may produce stronger individual trees later, but it risks a large code split and more regression surface before the shared tree path is healthy.

## Direction C: Material-Only Masking

Leave geometry mostly unchanged, thicken alpha silhouettes, brighten interiors, and use shader tricks to hide sparse branches.

Why rejected: it would not fix the actual sparse geometry or bare-card distribution and would likely look better only from some angles.
