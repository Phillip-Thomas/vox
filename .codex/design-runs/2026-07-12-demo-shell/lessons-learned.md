# Lessons Learned

- World time and narrative time are separate contracts. Pausing Story must freeze caption reveal/TTL and director elapsed time while any intentionally ambient world clock remains explicit.
- A modal's correct initial focus can still create a visual regression when the entire panel scrolls. Fixed header/body/footer ownership is safer for long pause surfaces.
- Target-world deletion must not reset process-wide live singleton state. Delete persisted target data, then let the destination remount perform its normal reset/restore lifecycle.
- A shared read-only control model reduces drift without committing to remapping architecture.
- Repeated software-WebGL contexts can saturate SwiftShader. Shell probes should use one browser case per process and reserve real-time movie proof for deterministic tests or headed hardware runs.
- Visual-state preview queries are useful only when stripped from production behavior; runtime completion logic remains the source of truth.
