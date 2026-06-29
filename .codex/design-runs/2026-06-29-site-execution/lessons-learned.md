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
- Fauna should not use unlit material paths once the world has lit trees/grass/water. Moving animals onto `MeshStandardMaterial` immediately makes them feel present in the same atmosphere.
- Species variation should come from uniforms, vertex attributes, and geometry parts before creating new shader programs. `fauna-field-v4` keeps all current fauna kinds on one shared material program while adding movement-driven gait state.
- Palette cohesion still needs contrast rules. A coat color can be mathematically in-family and still fail if it lands on the grass/canopy hue; fauna needs a vegetation-separation guard.
- Verification cameras need subject-aware framing. A material/effect camera that works for voxel phenomena is too broad for small animals, so fauna vantages need species-specific offsets.
- Procedural animals need persistent simulation identity, not just deterministic placement. Rebuilding visible instances from seed data makes animals feel like temporary shader effects; live agents must be reconciled across stream/bucket rebuilds.
- Ground gait reads better when driven by accumulated locomotion stride, while breathing, tails, wings, and wind can remain ambient time-driven overlays.
- Flora should share the lit material lane with trees and fauna. Even small flowers/cacti read as more integrated once they receive scene lighting, rim/backlight, and day/night uniforms.
- Voxel cohesion is best improved through restrained shared atmosphere and rim terms, not by adding more material-specific programs. `voxel-pbr-v6` kept the single-family program while aligning block faces with the softer tree/fauna/flora grade.
