# Lessons Learned

- Trees are the primary style standard for this world. Future layers should be judged by whether they feel as intentional, full, and stylized as the tree system.
- Triangle budgets must be calibrated around the approved dense tree/grass target, not around generic low-poly expectations.
- `gl.info.render` can be misleading for this harness; estimated scene geometry and layer counts provide better structural evidence.
- Atlas screenshots should use `atlas=1` to hide HUD overlays.
- Sky, fog, post grade, and spawned surface effects need the same planet art-direction source as trees/grass; otherwise the world starts to feel like separate shaders layered together.
- Generic spawned phenomena should share one shader program where possible. Per-effect identity can come from uniforms, material eligibility, density, and scale instead of unique shader branches.
- Smoke p95 spikes should be recorded even when machine gates pass; they are useful inputs for the longer perf atlas rather than immediate blockers.
- Atlas metric sampling must reset after scripted camera movement and settle before capture; otherwise p95 can include camera transition noise instead of the view being judged.
- Dense trees and grass define the approved visual baseline, so profile budgets need structural ceilings that account for that fixed voxel/vegetation base while still rejecting broken frames, shader-program growth, and slow p95.
