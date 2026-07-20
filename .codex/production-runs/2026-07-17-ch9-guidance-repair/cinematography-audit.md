# Chapter 9 Cinematography and Render Audit

Reviewer: independent Chapter 9 creative audit lane

## Initial findings

- The installed Core and relationship marker introduced dynamic point lights at
  hero transitions, repeating the shader-cardinality risk previously exposed in
  Chapter 5.
- The recommended site lacked a stable in-world visual anchor.
- The scanner field was low and could complete while off camera.
- The shelter interior read nearly black at the second hearth.

## Adversarial repair review

The follow-up review confirmed that the dynamic-light path was gone and that
per-frame Core animation reused resident vectors. It then found two concrete
correctness issues: the primary site ring faced into the terrain, and the solid
Core surfaces were transparent-sorted without writing depth. Both were repaired.

The final treatment uses an outward-facing additive site marker, a gaze-gated
resident scanner field, opaque/depth-writing Core body and crown, unlit additive
halos, and a centered/eased interior tint. The scanner remains allocated through
its observation transition but is removed from rendering once complete. No
point, spot, directional, hemisphere, or area light is introduced.

## Verdict

`pass_for_render_correctness` — the known light-cardinality, facing, depth, and
transition-residency defects are closed and policy-tested.

`headed_taste_pending` — the glyph language and Core are intentionally still
primitive relative to the signed flagship ambition. Headless SwiftShader proof
cannot approve color, exposure, camera feel, or award-level visual specificity.
