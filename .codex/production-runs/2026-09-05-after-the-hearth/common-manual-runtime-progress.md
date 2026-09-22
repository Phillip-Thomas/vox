# common-manual-focused runtime — progress

- **16:24Z** Read CLAUDE.md, producer-common-manual-closure-review.json,
  common-manual-probe-closure-report.json and the three owned probe files. Checked
  `verifier-control.json` (activeRole `common-manual-focused`, source `dc63…36c`) and
  `verification-ready.json`. Snapshotted the original qualified probe bytes to
  `logs/common-manual-runtime/pre-correction-probe-snapshot/` — hashes match the closure report's
  `afterSha256` exactly.
- **16:25Z** Applied the ONE commissioned pre-capture correction (strict ORIGINAL incoming-plane
  crossing + ordered credited frontier + early-turn-before-z16 predicate, and a `walkThroughPlane`
  helper whose pulses are capped by the distance to the plane). Owned probe files only; no game,
  geometry, radius, contract, manifest, defect or evidence change; no state writing.
- **16:26Z** `node selftest.mjs` → **OK 95/95** (83 pre-existing + 12 new pure tests of the
  directional crossing predicates and fail-before-F).
- **16:28Z** `reference-1` under the inherited exclusive lock, bound HTTP bytes. Identity, manual
  lane, world/body/settle and input-policy gates passed. **STOPPED at `pointer-lock-and-focus`**
  (node exit 2). No legs, no gameplay.
- **16:30Z** Diagnosed rather than reran: the failure detail was bare. Applied ONE focused
  instrumentation repair — record *why* the lock was refused, and allow ordinary repeat clicks.
  The gate was **not** relaxed.
- **16:31Z** `reference-2` (only the invalidated reference work). Same stop. Three real canvas
  clicks each hit the **bare canvas** (`isCanvas true`, `pointerEvents auto`),
  `document.pointerLockElement` null, `hasFocus` true, `visibilityState` visible — the browser/OS
  refused the lock, so the shipped controller never activated.
- **16:33Z** Stopped as commissioned: one bounded correction, one focused repair, no further loop
  and no third run of a known failure. **Deviation was not run** — it fails at the same
  prerequisite. Confirmed source `dc63…36c` unchanged before and after, 0 game files modified,
  root preview and all foreign processes untouched, both owned sessions cleaned up in `finally`.
- **16:36Z** Wrote `common-manual-runtime-report.json` / `.md`. Blocker reported for root: manual
  COMMON capture cannot start until the browser/OS pointer-lock refusal is resolved (the same
  recipe passed on this display at 15:17–15:24 today). Closes no defect.
