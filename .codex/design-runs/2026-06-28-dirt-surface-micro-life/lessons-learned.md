# Lessons Learned

- For spawned voxel detail, physical relief has to survive normal gameplay camera distance. Tiny geometry can technically exist and still read as flat static marks.
- For micro-life, visible motion should be proven with an A/B frame comparison. A still screenshot is not enough when the user specifically asks for animation.
- Dirt should be judged in two layers: the voxel material supplies clods/pebbles/thread marks, while `SurfaceEffectField` supplies near-surface loose matter and motion.
- Very small raised effects can look harsher under PBR than under direct-shaded stylized color. Use PBR only when the scale is large enough for the lighting to read cleanly.
