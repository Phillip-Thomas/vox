# Design Context

Run mode: single-surface
Surface: underwater rendering experience
Execution budget: deep
Exploration depth: 1, stabilization plus targeted mood polish
Canonical preview URL: `http://127.0.0.1:5173/`

Hard guardrails:

- Preserve the surface-water/rounded-edge work.
- Keep real gameplay underwater state driven by `playerSubmersion`.
- Keep the debug `?agent=1` harness faithful to the same water classifier.
- Do not disable godrays outright; preserve a sun peeking through water effect.
- Do not add new runtime dependencies.

Creative brief:

- Underwater should feel calmer, blue/green, volumetric, and readable.
- Sun shafts should come from the surface aperture, not from repeated terrain texture.
- Terrain should stay legible but should not dominate the whole frame with warm high-frequency detail.

Open field:

- Shader source masking, shaft intensity, medium wash, and validation harness fidelity.
