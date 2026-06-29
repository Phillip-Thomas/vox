# Design Directions

## Direction A: Shared Node Rings

Generate one ring per skeleton node and connect parent-child rings through shared indices.

Why selected: directly fixes the topology causing seams while keeping one mesh, one material, and the current style.

## Direction B: Shader Masking

Hide seams with darker bark grain or extra procedural texture noise.

Why rejected: it would camouflage the symptom but leave disconnected geometry and hard normals.

## Direction C: Higher-Resolution Cylinders

Increase radial or vertical tessellation to make seams less visible.

Why rejected: it costs more geometry and still leaves duplicated segment rings.
