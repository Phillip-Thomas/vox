# Lessons Learned

- Fauna should stay modular. The quadruped and dragonfly references want different geometry and motion paths, so the shared system should provide placement, uniforms, and quality gates while allowing archetype-specific construction.
- Sparse live density needs a denser test harness. The `?effects=fauna` route now labels its density boost so screenshots are useful without changing game defaults.
- Per-vertex part ids are a good early abstraction for visual fauna: body bob, head motion, leg gait, tail/ear movement, and wing flapping can all share one lightweight material path.
- Dragonflies are a good proof that fauna is not just "animals standing on blocks"; aerial offset and wing parts make the ecology layer feel broader.
- Fauna locomotion should stay CPU-side while counts are sparse. Updating instance matrices gives honest world movement and keeps the shader focused on gait, wings, and secondary motion.
- Movement must be route-constrained by eligible surface voxels. Free world-space integration would immediately create ocean/void failures on a voxel planet.
- Do not derive shader animation phase from moving instance world position. Once matrices translate every frame, `instanceMatrix[3].xyz` is a smooth input for wind fields but a bad random seed. Use stable instanced attributes for phase.
- Surface locomotion needs a different path shape than flat lerp. For voxel level changes, fauna should keep its ground route deterministic but add outward clearance and smooth retained orientation so block steps read as climbing/hopping rather than clipping.
- Fauna scale hierarchy matters as much as species count. Keep insects and small critters small, but large quadrupeds need enough voxel footprint and height to read as animals the player shares the world with, not decorations.
