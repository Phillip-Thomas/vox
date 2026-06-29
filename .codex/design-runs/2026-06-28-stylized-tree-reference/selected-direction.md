Selected direction: Tufted Anime Canopy plus Florasynth-inspired species controls.

Why this direction:
- Fluffy Tree explicitly describes separating the canopy into tufts and applying material per tuft. Our leaf cluster loop maps naturally to that.
- Florasynth's public docs expose useful categories that our generator can consume without a full growth simulation rewrite.
- The existing tree harness can prove the result quickly across every silhouette.

Scope:
- Add deterministic species controls to profiles and tree params.
- Vary L-system branch angle, whorls/child count, gnarl, gravitropism, apical dominance, branch stiffness, foliage placement, trunk flare/roughness, and fine branch thinning.
- Add `aTuftShade` to leaf-like geometry.
- Add volumetric tuft shading and camera/up-biased normals in the leaf shader.
- Update tests and visual capture tooling.

Out of scope:
- Florasynth editor UI.
- Shade simulation, branch death, fruit, uploaded foliage models, or third-party assets.
- Whole-world Elysium atmosphere pass.
