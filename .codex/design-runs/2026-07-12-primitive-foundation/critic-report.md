# Critic Report

## Defects Found And Resolved

1. Deadwood and guaranteed Flint initially existed only client-side; co-op authority now mirrors both and rejects duplicate collection.
2. Future recipes were hidden in UI but accepted by the server; authority now permits only the public primitive field kit.
3. The first golden loop minted arbitrary deadwood and skipped Torch; it now uses predicate-valid nodes and crafts all six recipes.
4. Downed recovery released pointer lock without reclaiming it; the recovery button now requests lock in the user gesture.
5. Sandbox deadwood leaked into active Story economy; Story now retains berries/roots while deadwood is gated off.
6. Sloped Roof claimed enclosure support that volume geometry cannot provide; it is now explicitly decorative and non-sealing.
7. A red build ghost had no recovery instruction; semantic reasons now distinguish target/support, occupancy, and materials.
8. Campfire copy promised dry clear ground beyond its validators; copy now states the actual submergence/lava restriction.
9. Reload proof omitted waterskin, pose, and voxel edits; the golden loop now asserts them.
10. Deadwood initially trusted client-supplied existence and forage kinds had separate claim lanes; the server now validates the shared hash/surface shell, food and deadwood hashes cannot overlap, forage has one claim lane, and migration 002 collapses legacy rows.

## Residual Gates

- Production browser journey and headed pointer-lock/feel check remain open: the
  extended headless run reaches Play readiness, then stalls at the trusted pointer-lock gesture.
- Full client verification is blocked only by the separate fauna triangle-budget regression; its quality budget was not weakened here.
- Campfire still has intentionally narrow demo validation (fluid state plus spacing), not a general terrain-clearance solver.
- Multiplayer resource authority still trusts rendered-node existence after canonical
  hash/shell/yield checks. Full anti-cheat closure needs shared terrain eligibility or
  server-authored collectible manifests.

## Scope Compliance

- New story/canon: none.
- Audio changes: none.
- Desktop remapping: none.
- Future systems exposed: none in the public Fabricator.
