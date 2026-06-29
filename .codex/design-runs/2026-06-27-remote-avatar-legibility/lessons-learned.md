# Lessons Learned

- For 3D gameplay presentation work, a normal first-person screenshot can fail to prove the design even when the implementation is correct; use the existing agent camera for deterministic visual evidence.
- Query-gated render harnesses should provide a fixed anchor when the local player is intentionally not mounted, such as under `?agent=1`.
- Remote avatar state should be readable through redundant cues: silhouette, accessory, action beacon, and label, not body color alone.
