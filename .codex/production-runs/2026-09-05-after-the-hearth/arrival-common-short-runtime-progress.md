# arrival-common-short-runtime — progress

- 18:36 Read CLAUDE.md, scene-v3 readiness, source manifest, verifier-control,
  inbox, `producer-arrival-common-short-prep-review.json`,
  `producer-nonbinding-auxiliary-observation.json`, prep report and probe header.
- 18:36 Preflight verified independently: activeRole `arrival-common-short-runtime`;
  live URL `http://127.0.0.1:34413/`; title `Paravoxia`; index `6c8c378b…`; bundle
  `/assets/index-BiDWGouH.js` `efc87feb…`; contract scene-v3 `5ef85a32…`; **99/99
  source hashes exact**; 9 probe files match prep hashes; `evidence.mjs` `1997cf2a…`
  unchanged. Only auxiliary mismatch is the recorded unused delta-profile
  (`a0b0ecdd`→`605fb2ef`) — preserved, no fullverify rerun.
- 18:37 Probe contract pin already exact scene-v3: **no repin needed**.
- 18:37 Entry-harness evidence inspected **before GPU**: the stale-canvas-rectangle
  pre-read pattern is **absent** (ctl refreshed after settling) and the
  full-residual `commandedUnits` stall detector is **absent** (absolute 0.05 u step
  per executed pulse). **Neither patched.**
- 18:37 Heavy lock free; acquired EXCLUSIVE flock, inherited on fd 9.
- 18:37 `short-1` — exit 2, stopped at `fixture-boot-seeds-no-short-completion`
  before any input. Cause: boot read at +1953 ms, cg diagnostic not yet published.
  Attempt **preserved**.
- 18:38 One bounded owned-instrumentation correction (budget now spent):
  `03931214…` → `82a49ba5…`. Bounded pre-gate wait for the diagnostic, predicate
  byte-unchanged, nothing loosened. `node --check` + both CPU suites exit 0.
- 18:39 `short-2` — exit 0, 52 504 ms, headed ANGLE/NVIDIA GB10. Full ordinary-input
  SHORT survey performed: W offer → S start → 8-leg straight z=12 draw
  (15.6486 u, 16 runtime samples) → span offered → W's real test held with
  `reference-occluded-survey-housing` (footing **valid**) → witness `[F]` new offer →
  phase `tested`, `acceptedClass: held-reference`, `anc.cg.route-tested`.
  18/20 gates passed.
- 18:39 Two gates failed, both **probe-side measurement mismatches**: occupancy
  vertical compares body centre (52.78897) to authored ground pose (51.05) → 1.739 u
  vs 0.6 u allowance, while the runtime itself held `witnessOccupied` true
  throughout; and the completion verdict compares runtime `acceptedSamples` 16 to
  probe waypoint-leg count 8. **Not repaired** — acceptance criterion of the claim
  under test, correction budget spent. Referred to the producer.
- 18:40 Additional cold runs **withheld**: the commission conditions them on the
  first SHORT really completing, and the failure is deterministic in retained bytes.
- 18:40 Post-run: 99/99 source exact, contract unchanged, no abandoned browser or
  probe, heavy lock released, root preview untouched and serving 200.
- 18:40 Wrote `arrival-common-short-runtime-report.json` / `.md`. Verdict
  **SHORT-NOT-PROVEN** by this lane's signed predicate. No SHORT acceptance, no
  earned arrival, no COMMON, no chapter, no score/audibility/taste/defect-closure
  claim.
