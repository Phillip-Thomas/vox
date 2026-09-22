# Verifier harness preparation — progress

Run: `2026-09-05-after-the-hearth` · role: **bounded mechanical verifier harness
preparer** · started 2026-09-06.

**Boundary held throughout.** No game source edited. No game test, no `npm run
verify`, no build, no browser, no GPU acquisition, no preview launch, no network.
No claim about current source. Root-owned files (`verifier-inbox.md`,
`verifier-control.json`, `verification-ready.json`, `production-lock*`,
`scene-contract.json`, `integration-inbox.md`, reports, ledgers) were **read
only**. All previous captures and summaries under `verifier/captures/` are
untouched. No `git checkout`/`reset`/`restore`. Scratch work lives in
`tmp/harness-prep/` (task-specific).

---

## 1. Read (read-only)

- `CLAUDE.md`
- `verifier/probes/cg-journey-probe.mjs` and `verifier/probes/lib/cgContract.mjs`
- `main/tools/lib/evidence.mjs` (`readState`, `hideUi`/`showUi`, `frameStats`)
- `verification-lifecycle-interim-report.md` / `.json`
- `scene-contract.json` — `performance` (criticalAnchors, measurementPlan) and
  `guidance` sections, sha `4dbf722b…ff88e` unchanged
- `verifier-inbox.md` — in particular the 10:02 UTC capture-provenance note
  ("bind each frame to its own actual state/time … do not treat pairs as
  simultaneous") and the boot-blank-frame note
- `integration-inbox.md` — for the **published hook decision** only. As of this
  writing root has *requested* a "minimal query-gated readonly detached
  diagnostic surface"; **no hook name has been decided or published.** Nothing
  was written to that file.
- READ-ONLY source survey: `main/src/story/JourneyRuntimeProbeBridge.tsx`,
  `journeyRuntime.ts`, `autopilot/primitives.ts`, `world/AuditWorker.tsx`,
  `state/playerFrame.ts`, `utils/cubeGravityConstants.ts`,
  `components/EfficientPlayer.tsx`, `commonGroundDirector.ts`,
  `commonGroundScore.ts`

## 2. Done

- **Reused** `cg-journey-probe.mjs` in place (not replaced). Added three pure,
  offline-testable modules beside it and one offline test runner.
- **Per-frame provenance.** Every screenshot now brackets itself with its own
  cheap pre-shot and post-shot observation and records the resulting *window*,
  its own image hash, and its own raw-vs-percept role. Raw/percept partners are
  recorded with their real offset and are never called simultaneous.
- **Physical diagnostics.** Pose source, precision and coordinate frame are
  recorded explicitly. CommonGround diagnostics are feature-detected from an
  allow-list; absence is recorded as *unavailable*, never as a pass.
- **Opt-in stall FAIL predicate** for ch13 on-foot walk/interact phases, with
  documented exemptions and limits. Off by default.
- **23 offline behavioural self-tests**, plus a 5-mutant check proving they
  detect behaviour rather than strings.

## 3. Coordination request — the exact diagnostic hook (for root / the engineer)

The harness does **not** assume a name and does **not** edit the bridge. It
probes this allow-list, in order, and stops at the first that answers:

| # | candidate |
| - | --------- |
| 1 | `--cg-diag-hook <name>` supplied on the command line (operator override) |
| 2 | `window.__paravoxiaJourneyProbe.getCommonGroundDiagnostic()` |
| 3 | `window.__paravoxiaJourneyProbe.commonGroundDiagnostic()` |
| 4 | `window.__paravoxiaCommonGroundDiagnostic()` |
| 5 | `window.__voxCommonGroundDiagnostic()` |
| 6 | `window.__paravoxiaCommonGround.diagnostic()` |

and the score twin at the same shapes with `…ScoreDiagnostic` /
`scoreDiagnostic`.

**Preferred (no harness change needed if chosen): #2** — attach
`getCommonGroundDiagnostic` and `getCommonGroundScoreDiagnostic` as extra
methods on the existing query-gated `__paravoxiaJourneyProbe` bridge, behind the
same `?journeyprobe=1` gate, returning a **deep copy**, pure read, no setters, no
mutable references, no normal-play global. If any other name is chosen, tell the
next verifier and it passes `--cg-diag-hook`; **no harness edit is required
either way.**

Fields the stall predicate and the physical report will consume if present
(all optional, all read-only): `holdReason`, `installWatch`,
`survey.{phase,approached,samples,lengthUnits,walkedUnits,testedPrefix,tailRevision,acceptedSamples,acceptedClass}`,
`common.{stage,terraUnits,comparisonProved,finalReferenceOffered,finalReferenceOccupied}`,
`worker.*`.

**Second request (independent of the first): a full-precision player pose.**
`buildSnapshot()` today has **no player pose field at all** — it imports
`getPlayerWorldPosition` but uses it only inside `prepareScenario`'s gaze
receipt. The only pose a probe can read is `window.__autopilot.pos`, which is
rounded to `1e-2` and published by the **movie autopilot only**, so a manual
lane has no player pose whatsoever. If a `state.player.position` (unrounded
`body.translation()`) plus the live `getPlayerUp()` were added to the snapshot,
the harness picks them up automatically (candidate paths already probed) and the
centre-vs-feet reconciliation in VF-RAIL-2 stops depending on a `+Y` assumption.
Until then the harness records the gap honestly.

## 4. Explicitly NOT done (and why)

- No measurement of current source. The engineer is mid-edit; a browser run now
  would measure a build nobody signed.
- No `verifier-control.json`, `verification-ready.json` or inbox writes.
- The *browser wiring* of the new provenance/stall code is **unexercised** —
  offline tests cover the pure classifiers and the safety scan, not Playwright.
  The next verifier should run one short throwaway capture first and confirm
  `poseSource`, `capturePolicy` and `stallPredicate` appear in `summary.json`
  before trusting a long run.
- No chapter acceptance, visual-taste or audibility assertion anywhere.

## 5. Handoff

Deliverables: `harness-prep-report.json` / `harness-prep-report.md`.
Pre-session gate for the next verifier:

```
node verifier/probes/cg-journey-probe.mjs --self-test        # expect exit 0
```

The next independent verifier uses this only **after root's exact source gate**.
