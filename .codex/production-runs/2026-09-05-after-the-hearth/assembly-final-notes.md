# Scene-contract final-candidate assembly notes

Mechanical producer assembly, 2026-09-06. `scene-contract.final-candidate.json`
(SHA-256 `60be671dc0bff6ece79660e1163de19126515c32b547faf8f19714e737271571`) is a
DRAFT. It claims no approval, no signature, no runtime authority and no measured
result. It was built from the stale `scene-contract.assembly.json` template by
`assemble-final-candidate.mjs` (run-local helper, writes only the candidate).

Nothing outside this run's `scene-contract.final-candidate.json`,
`assembly-final-notes.md` and `assemble-final-candidate.mjs` was written. The
production lock, decision brief, treatments, lane files, reconciliations,
signatures, source, schema and gate tooling are untouched.

Final authority used: `story-intent.md`, `scene-score-lane.json`,
`scene-cinema-lane.json` and the three recipient reconciliations, with the
council-v2 approved documents and the qualification packet bound by hash.

## Counts

| Section | Count |
| --- | --- |
| Formal beats | 4 (`ch13-home`, `ch13-return`, `ch13-survey`, `ch13-common`) |
| Sync anchors | 27 |
| Story events | 27 (1:1 with anchors) |
| Agency windows | 5 |
| Guidance objectives | 17 new ch13 pairs |
| Prior-continuity objective pairs | 2, retained as baseline/continuity evidence only, not contract guidance |
| Shots | 9 (accepted cinema ledger) |
| Score cues | 6 (accepted mood bindings) |
| Acceptance criteria | 28 |
| Captures / mechanical checks | 9 / 15 |

## What was integrated

**Scope.** Only the four formal beats exist. `ev/anc.cg.station-departed` and
`ev/anc.cg.tidegarden-returned`, the `aw.cg.station-return` agency window and
the two old objective pairs (`station:return:tidegarden`,
`hearth:return:install-cell`) were removed from the contract. They remain
shipped UX baseline and prior station-continuation-contract continuity, cited in
`scope.shippedReferenceRefs` and required in full as adjacent-continuity proof
(actual station UI departure, undock, flight, Tidegarden landing, one-cell
install) by `cap.cg.continuity-strip` and the acceptance criteria. No
`second-hearth-restored` StoryBeat exists anywhere in the document.
`anc.cg.cell-installed` now belongs to `ch13-home`: a fresh real install receipt
reactivates ch13-home and may fire one live CG-B0 acknowledgement at the
boundary when a home score host is available; a hydrated entry is steady and
silent; the transaction is never delayed or replayed.

**Rename.** The exact map was applied atomically in one pass over every
anchor/event reference in the document (`route-offered → demonstration-opened`
and `span-offered → route-offered` together, so no collision), plus
`witness-required → specific-hold`, `tail-redrawn → route-revised`,
`witness-resumed → test-resumed`, `his-test-arrival → complete`,
`open-ground → handback`. `anc.cg.return-chosen` and `anc.cg.repeated-measure`
are retained as baseline anchors. `aw.cg.open-ground` was renamed
`aw.cg.handback` for id consistency only. Three anchors were added:
`anc.cg.survey-started` (actual grounded F at S),
`anc.cg.reciprocal-reference` (W actually reaches and maintains H before Terra
starts) and `anc.cg.independent-test` (begins only after the actual H→E leg and
a valid far Terra reference, at the start of the full E→C traversal). A
verification pass fails the build if any retired identifier survives.

**Guidance.** All 17 pairs carry the exact intent copy. `ch13:return:launch` is
`interact` / `targetMode: none` / `requiresMarker: false` /
`targetContract.maxVisibleTargets: 0` with the exact `Hold [Space] to ignite and
lift.` line; it is explicitly not reclassified as a wait. The initial F beside
the inspecting worker only opens the survey; `ch13:survey:start` publishes the
exact pair `Survey start · begin a route` / `Walk to the survey start. [F] Begin
recording your route.` targeting S only, and the actual grounded F at S starts
the quiet trace. The worker's physical W→S approach is contracted as uncredited.
`ch13:common:release` is `wait` because the required act genuinely is remaining
in place; that is stated in its acceptance criterion.

**Cinematography.** The six placeholder shots were replaced by the accepted
nine-shot ledger (`shot.cg.home`, `choose`, `return`, `draw`, `hold`, `witness`,
`other-end`, `his-test`, `complete`), adapted mechanically to the schema shot
shape. Free 75-degree on-foot FOV, fixed lights (zero new lights, zero
cardinality transitions), unchanged grade, no post effects, no forced camera.
Every anchor relates to at least one shot and at least one score cue; no-op
anchors carry explicit `unchanged` / `retained` relations rather than an
invented cue or move.

**Geometry.** Bound from the final qualified packet: range 12, R (-34, 51.05,
20) yaw 90, cap-to-socket zero gap with the general symmetric endpoint-contact
rule and six passing contact tests, 36 vs 16 unit surveys, 18-unit common
passage, H (-40, 51.05, 12) distinct from E (-42, 51.05, 12), the two uncredited
2-unit E→H and H→E legs, T (-44, 51.05, 12), W (-34, 51.05, 10). Hashes bound in
`production.authorityRefs` and `chk.cg.geometry-qualification`: staged
`7cc0d63d…b7ff` (PASS), head `e64ce08e…4b4d1` (PASS). The stale "no geometry is
qualified", the 32-unit long route and the release-cylinder-overlap wording were
removed.

**Score.** Exactly six cues bound to the accepted mood variants
(`restored-home`, `unreconciled`, `demonstrating`, `refused-hold`, `revised`,
`independent-action-settled`). No separate mood per UX event. Quiet refusal
enters once; repeated reference loss and temporary suspension retain the current
texture. The final texture is live-only, at most 5 s, then the existing 4.5 s
release; handback is immediate and independent of the tail; no replay, defer,
hydrate or audio predicate.

**Performance.** Accepted DELTA budgets: +8 draw calls, +6 materials, +6 setup
shader programs, +2 MiB (2097152 bytes), 512 pooled glyph instances across two
128-point buffers, zero new programs and zero first-use resources in the ±2 s
critical windows around every critical verb anchor and the handback, fixed light
cardinality, hardware FPS non-regression. 60 / 30 / 33.4 are recorded as
advisory. `measurementPlan` states the DELTA semantics explicitly and records
that no measured frame or resource pass is claimed.

**Production.** `status: draft`, `canonicalPreviewUrl: null`, `frozenAt: null`.
`allowedPaths` / `protectedPaths` were carried through unchanged for root to
replace from the updated brief and lock. The stale non-negotiable "the formal
runtime ceiling … unchanged by this contract" was replaced with the correct
authorized distinction: the public demo release surface remains `ch4-arrival`
and no publication is authorized, while the formal runtime chapter ceiling is
separately authorized to advance to `ch13-common` once these four beats are
registered under the signed contract and the registry gate. Declared future
evidence is retained; no approved-live claim was added.

## Validation performed

Read-only, no shared gate artifact was written or mutated.

1. Reference integrity inside the helper: every anchor/event/window/objective/
   shot/cue/reset/palette/variant/critical-anchor/capture reference resolves;
   every anchor has at least one shot and one score relation; retired
   identifiers are absent. **0 errors.**
2. Full structural validation against the checked-in
   `paravoxia-scene-contract.schema.json` with `$ref` resolution, closed-object
   `additionalProperties: false`, enums, consts and patterns, plus mirrors of
   the gate's `BAND_PROSE` and `PLACEHOLDER_PATTERN` scans. **0 errors, no
   invalid extra property, no band-shaped criterion, no placeholder.**
3. The gate's own `tools/lib/guidanceTargets.mjs` imported read-only and run
   over all 17 objectives, plus a mirror of `actionableWorkOrder`. **1 failure,
   below.** All 17 final work-order lines satisfy the current lexicon
   (`deliver`, `fly` and `[space]` are already present in the working tree).

No build, `verify`, browser, probe or gate command was run.

## Remaining real producer / director decisions

1. **`ux.contract-target-ceiling` blocks the contracted launch objective.**
   `tools/lib/guidanceTargets.mjs` currently permits `targetMode: none` only for
   `kind: travel | wait`. The signed intent requires `ch13:return:launch` to be
   a control-only `interact` with zero targets. This is the same narrow-gate
   class root is already fixing; it must be widened to admit a control-only
   `interact` with `maxVisibleTargets: 0`. The contract was **not** falsified to
   `wait` to evade it. This is the only mirrored gate failure.
2. **`production.mutationBoundary`** is set to `planning-only` to match the
   current lock. Advancing it to `bounded-runtime` is a lock/brief decision that
   root owns; the contract cannot grant itself the boundary.
3. **`allowedPaths` / `protectedPaths`** are carried through from the stale
   template and must be replaced wholesale from the updated brief and lock.
4. **`evidence.headedTaste.required: true`** and `realGpuRequired: true` are
   carried forward from the intent's hardware and listening obligations;
   confirm as a director decision.
5. **Shot-to-beat span.** `shot.cg.return` is declared on `ch13-return` but, per
   the accepted ledger, spans into `anc.cg.repeated-measure` and
   `anc.cg.demonstration-opened` because the ledger groups `ch13:survey:offer`
   into it. Confirm the grouping or split it into a tenth shot.
6. **Anchor naming not covered by the rename map.** `anc.cg.home-steady` carries
   the Score lane's `anc.cg.restored-entry` semantics, and the lane's
   `anc.cg.final-texture-release` is expressed as release prose on
   `sc.cg.independent-settled` and `anc.cg.handback` rather than as a new
   anchor, so no anchor was invented. Confirm, or commission the extra ids.
7. **Signatures.** `status` stays `draft` pending the three exact director
   signatures; `director-signoffs.json` is unchanged and no signature was
   fabricated.
