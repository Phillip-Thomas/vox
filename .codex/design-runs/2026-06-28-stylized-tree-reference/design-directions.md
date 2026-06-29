Direction A: Tufted Anime Canopy
- Thesis: borrow the Fluffy Tree idea directly: canopy clusters behave as coherent tufts with center-to-surface lighting and camera/up-biased normals.
- Pros: highest immediate visual gain, low CPU cost, matches the user's lush-reference target.
- Risks: if overdone, foliage can look like soft blobs and lose leaf detail.

Direction B: Florasynth Species Controls
- Thesis: enrich the generator with deterministic botanical controls: branch joint angle, whorls, gnarl, gravitropism, apical dominance, branch stiffness, foliage spacing/threshold/angle, trunk flare/roughness, fine-branch thinning.
- Pros: better planet-to-planet identity and long-term iteration hooks.
- Risks: too many controls can destabilize geometry without a full simulation model.

Direction C: Scene-Style Integration
- Thesis: chase the broader Elysium art stack: ACES, fog, god rays, water, flowers, grass, and atmosphere cohesion.
- Pros: strongest whole-world art direction.
- Risks: broad scope; tree request would get diluted and validation becomes harder.

Selected thesis:
- Combine A and a scoped subset of B. Implement tufted canopy shader treatment plus deterministic species controls that shape the existing L-system and foliage placement. Leave broader scene integration for a separate pass.
