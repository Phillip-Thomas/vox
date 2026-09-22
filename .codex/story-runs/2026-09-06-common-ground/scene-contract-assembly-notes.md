# Scene-contract assembly notes — Common Ground packet

Preparation only, 2026-09-06. Read from the live schema `docs/architecture/workflow-orchestration/schemas/paravoxia-scene-contract.schema.json` and validator `main/tools/creative-triad-gate.mjs`. **No validator, schema or profile change is proposed; no signature, disposition, scorecard or approval is fabricated here.**

## 1. Identity to bind truthfully

- Production run: `.codex/production-runs/2026-09-05-after-the-hearth/` (this is the ch13 packet's home; the council run stays `.codex/story-runs/2026-09-06-common-ground/`).
- `schema: "paravoxia.sceneContract.v1"`; `sceneId` must be the run's scene slug (`stableId` pattern `^[a-z0-9]+([._-][a-z0-9]+)*$`); `contractVersion` matches `^[A-Za-z0-9][A-Za-z0-9._-]*$` (ch10 precedent: `draft-v9`); `status` one of `draft | candidate | frozen | superseded`.
- Current lock is `mutationBoundary: "planning-only"` with `allowedPaths: [".codex/production-runs/2026-09-05-after-the-hearth/"]` and `sourceRevision: "b631a52065a1a69fecac0331e69515c306408641+working-tree"`. Runtime work requires the lock to move to `bounded-runtime` **and** the contract's `production.mutationBoundary` to match exactly (`lock.mutation`), with every contract `allowedPath` fitting a lock `allowedPath` (`lock.allowed-paths`).
- `production.productionLockRef` must be literally `"production-lock.json"` (`lock.contract-ref`).
- `initial-source-hashes.json` already carries `{capturedAt, sourceRevision, hashes}` for the pre-change tree; the file list in §4 must be hashed there before implementation, and re-hashed after, so a concurrent-edit collision is attributable rather than blamed on this run.

## 2. Required top-level members (all must be present)

`schema, sceneId, contractVersion, status, production, scope, story, syncAnchors, cinematography, palette, shots, score, variants, performance, reset, evidence`. `guidance` is optional in the schema but **mandatory in practice** for a guided chapter — the gate's UX path binds it to `shipped-ux-baseline.json`, `objective-lifecycle-evidence.json` and `ux-audit.md`.

Per-section required keys (exact):

- `production`: `mode, authorityRefs, productionLockRef, mutationBoundary, allowedPaths, protectedPaths, ownerDecisionRefs, canonicalPreviewUrl` (+opt `frozenAt`).
- `scope`: `title, beats, shippedReferenceRefs, priorEvidenceRefs, targetDevices, targetQualityTiers, nonGoals`.
- `story`: `intentRef, purpose, emotionalBefore, emotionalAfter, intendedAmbiguity, nonNegotiableCanon, realityStageCeiling, characterDynamics, revealLedger, events, agencyWindows`.
- `guidance`: `baselineArtifact, lifecycleEvidenceArtifact, auditArtifact, objectives`; objective: `id, agencyWindowRef, kind, enterAnchorRef, clearAnchorRef, markerLabel, requiresMarker, workOrder, feedback, variantRefs, variantIntent, resetRef, resetTriggers, resetIntent, acceptanceCriterion` (+opt `targetMode`, `targetContract` = `ownerRef, selectionRef, readinessCriterion, completionCriterion, maxVisibleTargets, evidenceFields`).
- `syncAnchors` (min 1): `id, beat, order, event, source, story{eventRef,relation,offsetMs}, score{cueRef,relation,offsetMs,musicalIntent}, cinematography{shotRef,relation,offsetMs,visualIntent}, acceptanceCriterion`.
- `cinematography`: `treatmentRef, thesis, currentCutRefs, adjacentSceneRefs, cameraLineage, paletteRef, shotOrder`.
- `shots` (min 1): `id, beat, startAnchorRef, endAnchorRef, focalHierarchy, cameraAuthority, framing, lens, motion, transition, paletteRef, effects, agency, variantRefs, resetRef, evidenceRefs`.
- `score`: `treatmentRef, mood, eraFidelity, cues, mixIntent, performancePlan, evidenceRefs`; cue: `id, cueRef, type, anchorRef, relation, offsetMs, phraseIntent, barIntent, mixIntent, silenceIntent, resetRef, evidenceRefs`.
- `variants`: `desktop, mobile, reducedMotion, qualityTiers` (gate variant set: `desktop, mobile, reducedMotion, lowestQuality`).
- `performance`: `targetFps, minimumFps, maximumFrameTimeMs, maximumDrawCalls, maximumShaderPrograms, maximumGpuMemoryMb, deviceProfiles, criticalAnchors, measurementPlan`.
- `reset`: `triggers, states, sandboxNoOp, probeRefs`; state: `id, domain, stateRef, resetValue, triggers, acceptanceCriterion`.
- `evidence`: `acceptanceCriteria, captures, mechanicalChecks, continuity, headedTaste, directorSignoffsRef` (+opt `acceptanceBands`); capture: `id, kind, anchorRefs, variantRefs, pathOrPlanRef, status, acceptanceCriterion`; check: `id, commandOrProbeRef, status, resultRef, acceptanceCriterion`.

## 3. Known pitfalls (these are what the gate actually fails on)

1. **Reference IDs must resolve.** Every `*Ref` is checked against the declared id sets — anchor ids, shot ids, cue ids, agency-window ids, variant ids, reset-state ids, evidence ids. A typo'd `resetRef` or an `anchorRef` naming a cue is a hard fail, not a warning.
2. **Anchor ordering.** `syncAnchors[].order` is the single ordering authority; the gate builds an id→order map and asserts `clearOrder >= enterOrder` for every guidance objective (`ux.contract-anchor-order`). Anchor count is also mirrored in the AV runtime census (`signedSceneAvRuntime.ts` / `generate-scene-av-runtime.mjs`), so the contract's anchor count, its registry `sceneContracts` sha and the runtime census must all agree.
3. **Signature format is byte-exact.** Each of `{chapter,score,cinematography}-contract-signoff.json` carries `contractSha256` = sha256 of the **frozen contract bytes**; `director-signoffs.json` must reproduce each individual signoff **losslessly** as exactly `{disposition, revision, contractSha256, signedBy, signedAt}` (`signoffs.lossless-assembly`) — reformatting or an extra key fails. The same hash must also appear in `check-results.json`, `verification-report.json`, `objective-lifecycle-evidence.json`, `raw-audiovisual-evidence.json`, `final-scorecard.json`, `human-decision.json`, `defects.json`. Freeze once, hash once.
4. **Notes/reconciliation format.** Peer notes are JSONL (`{chapter,score,cinematography}-peer-notes.jsonl`), one valid JSON object per line, covering every directed pair among the three directors; reconciliations are the matching `*-reconciliation.jsonl`. `director-notes.jsonl` is likewise line-delimited. A trailing partial line fails `jsonl.parse`.
5. **Placeholders and unresolved prose.** `TODO/TBD/PLACEHOLDER/FILL-ME/REPLACE-ME` and any `<angle-bracket>` token anywhere in the markdown artifacts fails. Numeric range prose (`12–24 units`, `55–75°`) must be paired with an explicit `evidence.acceptanceBands` entry.
6. **Markdown section rules.** e.g. `screenshot-report.md` must mention `anchor, desktop, mobile, reduced, quality`. Several other run markdowns have their own required-section lists.
7. **Source bindings.** `authorityRefs` are `path#anchor` strings naming real files and real headings (ch10 precedent binds `production-lock.json#sha256:…`, `production-lock.md` sections, `PARAVOXIA_CREATIVE_COUNCIL.md`, `main/src/story/ux/README.md`, and the prior signed contract). Ch13 should bind: `story-authority-candidate.md` (sha `790b2894…87ae`), `canon-decision-register.json` (sha `017bafda…90fd`), the three arena reconciliations, `integration-survey.md`, `implementation-interface-plan.md`, `PARAVOXIA_DEMO_FOUNDATION_PLAN.md#Owner Gate Lift 2026-07-28`, and the ch10 scene contract as continuity predecessor.
8. **Media evidence is ffprobed.** Any declared capture with `status: captured` has its declared probe compared byte-for-byte against the actual probe of the hashed media. Leave captures as `planned` while the lock is planning-only.
9. **Reachability at signature.** The gate rejects contract terms that cannot be satisfied by the declared runtime (the ch10 run shipped four unsatisfiable draft-v9 terms). Do not write an acceptance criterion whose producer does not exist in §4's file list.
10. **Decision brief.** `decision-brief.json` items are typed `creative | boundary | release` and must be asked before signature; the current file has `runId` only with an empty/placeholder item set.

## 4. Proposed `allowedPaths` (mutation scope) for the ch13 packet

Exactly the file list in `implementation-interface-plan.md` §1–§8, i.e. the run folder itself; `main/{chapter-registry.json, chapter-journey-contract.json, story-authority.json}`; `main/tools/{chapter-registry-gate.mjs, generate-scene-av-runtime.mjs}`; the chapter-registry schema; `main/src/story/beats/{index.ts, ch13/**, objectivePrimitives.ts, worldHandles.ts, markerTargets.ts, definitions.ts, metadata.generated.ts}`; the five new `commonGround*.ts` modules and `world/CommonGroundWorld.tsx`; `main/src/story/{storyState.ts, StoryDirectorDriver.tsx, emergentStoryDirector.ts, auditWorkerPresence.ts, storyInteractions.ts, storyBoundaryTelemetry.ts, storyScore.ts, signedSceneAvRuntime.ts, generatedSceneAvRuntime.json, stationReturnStory.ts, StationScreeningDriver.tsx, autopilot/*, world/StoryWorldProps.tsx, world/TidegardenSettlementWorld.tsx}`; `main/src/game/systems/{interactionSystem.ts, persistence.ts}`; `main/src/game/spaceStation/{spaceStationStory.ts, spaceStationUndock.ts}`; `main/src/App.tsx`; and each file's colocated test.

`protectedPaths` retain: `main/public/audio/`, `main/src/audio/`, `main/src/components/audio/`, all shipped ch1–ch12 copy and receipt strings, the frozen `paravox:anchorage:v1` seed namespace and `:a-index` worldId grammar, `firebase.json`, `.firebaserc`, world generation and prepared-anchor generation.

## 5. Test anchors: existing vs required new

Cite as continuity anchors (already assert behavior, not shape): `beats/{allContracts, beatRegistry, railDiscipline (29-file census), screeningParity}`, `story/{auditWorkerPresence, storyInteractions, storyBoundaryTelemetry, stationReturnStory}`, `spaceStation/{spaceStationStory, spaceStationUndock}`, `systems/persistence`, `utils/{agentSurfaceNavigation*, groundedSurfaceMotion}`, plus `npm run story:ux:check`.

New holes `evidence.mechanicalChecks` must name (none exist today): trace capacity/corner/tested-prefix/tail-revision; actor+world-keyed hydration rejection and legacy-absent migration; single-pose-writer exclusivity against `a4-exhale`; solid-aware route refusal with three distinct reasons and hold-at-last-safe; dormant reactivation returning `alive`; external ch10→ch13 boundary proof on both sides; station-movie continuation with no `story=` reseed and no timeout rescue; ≤5 s coda cancellation matrix with no hydrate/replay; objective enter/ready/progress/complete/clear parity across all four variants.

## 6. What must not be written into the packet yet

Geometry (selected range, sockets, arena coordinates, caps), any `status: captured` evidence, any director disposition or `signedAt`, any owner decision ref that does not already exist, and any registry/authority runtime ceiling change. The pass-2 arena is explicitly not production-ready; freezing coordinates before the bounded director refinement would make the contract's acceptance criteria unreachable at signature.
