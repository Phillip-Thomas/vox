# Design Directions

## Direction A: Micro-Cluster Hair Field

Replace the current large tuft language with smaller, more numerous micro-clusters. Increase blades per density unit, shrink blade width, reduce per-blade width variance, distribute roots across the voxel face with less obvious tuft fan behavior, and soften bend/motion. This makes each voxel read as a surface of fine bristles while preserving the instanced renderer.

## Direction B: Low Carpet Nap

Make grass shorter and denser, closer to moss or turf. This would reduce height and cartoon leaf silhouettes but risks losing the alien meadow quality and making the blocks look fuzzy only from close range.

## Direction C: Mixed Strand And Wisp Layer

Keep the existing large blades as sparse hero strands and add a second instanced layer of short hairs. This could look rich, but adds another mesh/material path and expands performance/test surface for a focused pass.

