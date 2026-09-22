# Independent story-verifier progress — 2026-09-05-after-the-hearth

Role: independent story-verifier. **No game-source edits.** All outputs live in
`verifier/` under this run. Actionable bugs are reported here and in
`verifier-findings.json`; root routes repairs to the single integrator.

## Phase P0 — preparation (survey + harness) — COMPLETE

Started while integration-v2 was still mutating source. **No measurement,
build, test, browser or capture was run in this phase**, and no source finding
is attributed yet.

Verified, read-only:

- Signed scene-v2 identity: live `scene-contract.json` sha256 =
  `4dbf722b308b92b170313285854e3c9c2abac853b3407bf3e0f4efccfddff88e`
  — matches the commissioned signed hash.
- Contract shape: 4 beats (`ch13-home`, `ch13-return`, `ch13-survey`,
  `ch13-common`), 28 sync anchors (8 of them signed *contingent*), 17 guidance
  objectives, 15 mechanical checks, 9 evidence captures, 5 agency windows,
  9 shots, 6 score cues, 4 quality tiers + desktop/mobile/reduced-motion.
- Read: `CLAUDE.md`, `production-lock.md/json`, `verification-commission.txt`,
  `integration-progress.md` (v2 Phase 0 receipt), `main/src/story/ux/README.md`
  surface, `main/package.json` scripts, `tools/lib/previewServer.mjs`,
  `tools/lib/evidence.mjs`, `tools/chapter-evidence.mjs`,
  `tools/chapter-journey-probe.mjs`, `src/story/JourneyRuntimeProbeBridge.tsx`,
  `src/story/ux/feedbackCues.ts`, `src/audio/sfxEngine.ts`.

Harness written (run-local, `verifier/probes/`):

| file | purpose |
| --- | --- |
| `lib/cgContract.mjs` | Reads expectations from the **signed contract bytes only** (refuses a non-signed sha). Extracts the exact state-conditional work orders quoted inside `variantIntent`. |
| `cg-preview-daemon.mjs` | The ONE owned preview. Builds once, serves that immutable dist via `tools/lib/previewServer.mjs` (free port, never 5174), verifies `<title>Paravoxia</title>` **and** pins the index sha256, writes `verifier/artifacts/preview-ownership.json`, owns child lifetime (SIGTERM / stop-file). |
| `cg-lifecycle-probe.mjs` | One long browser session per invocation against that one URL. Frame-stamped ledger of beat / objective id / marker label / work order / health / requiresMarker, signed-AV anchor activation, prompts, receipts, milestones, autopilot; before/at/after frames on every anchor change and every objective enter / silent text change; hashes every frame. Variant-aware (`--variant desktop|mobile|reduced-motion`, `--tier`). |
| `cg-reset-matrix-probe.mjs` | Applies the eight contracted reset triggers (`beat-exit`, `deep-link`, `replay`, `pause`, `quit`, `focus-loss`, `completion`, `sandbox`) and records objective/marker/health/AV/entry-cue state before and after each. `sandbox` is a plain load with no `?story=` at all. Unreached states are recorded `not-reached`, never as a pass. |
| `cg-preservation-diff.mjs` | Read-only drift classifier against `initial-source-hashes.json` (958), `integration-before-manifest.json` (74 + 40 absent) and `iterations/implemented-scene-v1-before-v2/source-manifest.json`, bucketed by the signed contract's 118 allowedPaths / 194 protectedPaths, recording each changed file's **mtime** so a concurrent unrelated refactor is not blamed on this run. |

Evidence-schema reconnaissance (so nothing is authored by template later):

- `paravoxia.objectiveLifecycleEvidence.v1` requires, per objective: exact
  contract kind/anchors/markerLabel/workOrder, `entryCount` ≥ 1,
  `markerObservations` ≥ entryCount all exactly equal to the signed label,
  `missingMarkerFrames === 0`, ordered `entered→ready→completed→cleared`,
  `feedbackEmissionsPerEntry` all `1`, presentation-only separation, four
  variant proofs bound to `variant-desktop` / `variant-mobile` /
  `variant-reduced-motion` / `quality-potato`, and all eight reset triggers
  exactly once.
- `ch13:return:launch` (`requiresMarker: false`, `targetMode: none`,
  `maxVisibleTargets: 0`) instead needs `tools/lib/guidanceTargets.mjs`
  evidence: per-entry raw observations carrying
  `controlId / controlAvailable / controlInputActive / boardedState /
  controlOwnership / presentedFrameId / sourceRevision / contractSha256`, zero
  directional markers, and a `control-input` completion with accepted fresh
  input and a real `controlStateBefore !== controlStateAfter` — an authored
  timed bundle cannot satisfy it. The harness records exactly these fields.

Harness self-checks done without touching the game: `node --check` on all three
modules, and `lib/cgContract.mjs` correctly recovers the two signed v2
state-conditional work orders verbatim —

- `ch13:survey:test` preparing state: *"W-7744 is preparing to test the offered
  route." / "Keep his approach clear. Follow his progress, or return to the last
  tested point to revise."*
- `ch13:common:reciprocal` preparation state: *"W-7744 is taking up the
  reference position." / "Give him room to reach it. When the guide appears,
  follow it from the survey end."*

Observability decisions (so no boolean is filled without a measurement):

- Objective/marker/work-order/health: production HUD data attributes plus
  `window.__paravoxiaJourneyProbe.getSnapshot()` (query-gated, passive).
- Anchors: `signedSceneAv` (`anchorId`, `anchorEvent`, `activationSequence`,
  `activationHistoryAnchorIds`).
- Entry acknowledgement counting: the runtime's own SFX queue trace
  (`window.__voxSfxTrace()` `triggerCounts.objectiveEnter`). This is a **queue
  observation, not a hearing claim**, and will be labelled as such everywhere.

## Gate status — WAITING (not yet measuring)

Both preconditions are required before any measurement:

| precondition | state |
| --- | --- |
| `integration-v2-invocation.json` → `finishedAt` | **absent** (integration still running; `run-integration-v2.py` pid 435684 alive, stream still growing at 08:55 UTC, started 08:30 UTC) |
| root's `verification-ready.json` | **absent** |

Polled at ≤45 s intervals. **No build, test, gate, browser or capture has been
run.** Harness is complete and idle.

Hardware: `/home/thomasphillip/Projects/Paraform/harness/output/.heavy.lock`
existed and `fuser` showed **no holder** at survey time. That is an observation,
not an acquisition — ownership will be re-tested with a non-blocking `flock` at
the moment a real-GPU probe starts, and never waited on blocking for >60 s.

## Preview ownership

None started yet. No preview server is running for this run at this time.
