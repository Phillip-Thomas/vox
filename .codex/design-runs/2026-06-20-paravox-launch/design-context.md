# Design Context

Run mode: single-surface
Surface: Paravox browser game launch
Exploration depth: 0
Execution budget: fast
Approval threshold: deployment-ready launch stabilization

## Hard Guardrails

- Deploy the `collision-efficiency-test` code now fast-forwarded onto `master`.
- Preserve the existing React, Vite, Three.js, Rapier, and efficient-collision implementation.
- Use Firebase Hosting as the launch target for `paravox.com`.
- Do not add unsupported product claims.
- Keep visible browser metadata production-ready.

## Creative Brief

Paravox should launch as a direct playable voxel-world experience, not a marketing wrapper.

## Open Field

Deployment configuration, metadata, Hosting cache behavior, and custom-domain setup.
