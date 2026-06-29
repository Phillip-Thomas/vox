Relevant source:
- `main/src/utils/voxelMaterial.ts`: shared instanced voxel material, material IDs, LUTs, triplanar color/normal/roughness/emissive shader injections.
- `main/src/components/EfficientPlanet.tsx`: owns the singleton voxel material and per-frame shader uniform updates.
- `main/src/config/graphicsSettings.ts`: device/performance quality gates.
- `main/src/utils/windProfile.ts`: deterministic per-planet wind profile already consumed by grass/trees.
- `main/src/types/materials.ts`: stable material order and render material definitions.
- `main/src/game/data/blocks.ts`: block-to-render-material projection.
- `PARAVOXIA_SYNOPSIS.txt`: story progression from unresolved voxel reality toward richer rendered dimensions.

Existing constraints:
- Material IDs are packed into `aInstanceData.x`; `MATERIAL_ORDER` must not be reordered.
- The shared shader must stay quality-gated for older devices.
- Grass and trees already consume deterministic wind. Block shader effects should use the same profile rather than invent a separate planet weather source.
- Plot gating should not be coupled to `GraphicsQuality`; quality is device capability, while reality stage is narrative state.

Implementation decision:
Extend the existing shared voxel material with narrative effect uniforms and per-material branches. Avoid adding block-level particle systems or new per-block draw calls.
