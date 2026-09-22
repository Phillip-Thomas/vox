# Producer integration review — pure candidate is partial

The 15 passing unit cases prove the supplied reducers only. Integration must not adopt the snapshot shape unchanged:

- `witness.sampleIndex` cannot encode the explicitly offered off-route world position. Store a bounded pose plus offered/occupied hysteresis state; sample index may additionally identify the supported span. The selected witness is two units beside the route.
- Add the earned survey route class and actual Terra E-to-C passage progress/proof separately from `reciprocalHeld`; the latter is current presentation/actor state, not reciprocal proof. Store explicit final-reference pose/offer separately. Revalidation must never fabricate a completed passage.
- Validate mutually consistent hydration: committed requires actual accepted route and reciprocal/final facts; offered indices and safe-pose tuple flags must be well formed. Hydration must not emit completion or restore a live occupied reference without world checks.
- Revision that removes no samples should not increment tailRevision; README currently promises this but implementation increments unconditionally.
- `appendSample` receives only a point check. The runtime must check the actual traversed segment and accumulate actual walked distance, including movement between recorded samples, rather than legitimizing corner-cutting or skipping terrain/solid tests. Sampling is based on actual frame poses, not a planned path. Never silently resample recorded corners.
- Scope all WorldSave serialization and restore to actual Origin plus W-7744. Keep two slots; common passage can be bounded progress on its separately fixed live route, not a third arbitrary survey slot.
- Commit helper receives boolean proof, so the director owns the real arrival/range/LOS/occupancy/body-clearance predicate; do not call from elapsed time or hydration.

These are integration requirements already present in the story intent, not new creative decisions or claims of runtime failures. The candidate remains outside main/src.
