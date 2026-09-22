# Common Ground — council-v2 documentation audit (iteration 3, independent mechanical pass)

Read-only · no source/docs/authority/signature/validator edits · no browser,
build or GPU · no score judging. Machine evidence: `check-results-v2.json` and
the five `*-v2.log` raw logs. All prior reports and logs preserved.

## Verdict: **APPROVE — bounded documentation-only, with future obligations**

Unlike the earlier passes, this one recomputed every hash rather than checking
that recorded hashes agree with each other.

## 1. Identity and mandated commands

`sha256(story-authority-candidate.md) = 133d1dbe…2cbf`, byte-equal to the
commissioned value and to the candidate hash in all three director signoffs, the
owner decision and `authority-patch-receipt.json` (iteration 3). `decisionsSha256
= 267ec0e8…1a4b`, `directorSignoffsSha256 = 8bffb4be…32db`, `geometryBasisSha256
= b7999bb5…e55b`, `arenaNotesSha256 = 4659a436…5eee` — each recomputed from disk
and matching every artifact citing it; the six arena note routes trace to their
three hashed final responses. Three unique directors (chapter/cinematography
`approve-with-notes`, score `approve`); register 12 decisions,
`ownerOnlyChoicesInferred: 0`; owner decision still honest —
`personallyReviewedByUser`, `runtimeMutationAuthorizedByThisDecision`,
`publicationAuthorized`, `acceptedMissingEvidence` all `false`.

All three mandated commands exited 0: `node validate-candidate.mjs --owner` →
**102 checks, 0 failures** (exactly the expected count); `npm --prefix main run
story:authority` → **1096 checks** (1094 at iteration 2); `story:authority:smoke`
→ 1096 live checks plus beat, precedence, production-identity, evidence-chain,
release-gate, question, role, review, graph and cycle drift rejection.

No failure to preserve. One unavoidable side effect: the mandated validator
rewrites `candidate-validation.json` (deterministic apart from `checkedAt`);
`candidate-validation.pre-owner.json` is untouched. No validator was edited —
the gate still hashes `e7caa357…f434`, identical to the pre-run snapshot.

## 2. Cumulative diff boundary — exact

For all five paths the receipt's `beforeSha256` equals the `authority-before/`
snapshot and its `afterSha256` equals the file on disk today. Stronger: applying
`implementation-diff.patch` (`4c661abb…821c`) to a temp copy of
`authority-before/` reproduces all five current hashes exactly (`git apply
--check` clean, then applied) — the true cumulative iteration-1→3 boundary, not
a partial. Zero paths outside `documentationAllowedPaths`, zero `main/src` hunks.

## 3. Runtime unchanged — verified, not asserted

All 958 entries of
`.codex/production-runs/2026-09-05-after-the-hearth/initial-source-hashes.json`
(revision `b631a52…`) recomputed: **0 drift, 0 missing**, so no mtime report is
owed. That set is entirely `main/src/**`; none of the five patched documents
appear in it, making this an independent runtime proof rather than a tautology.
Corroborating: no `ch13` identifier in `main/src`, and no new line (`i needed the
end he held.`, `PASSAGE OBSERVED. MODEL INCOMPLETE.`) exists in source — every
source-visible word is future-labelled.

## 4. v2 canon language against the measured basis

- **Backed instrument, range 12** — Bible:64 "visibly opaque-backed … constant
  12-unit socket-to-socket range … no invisible directional cone" matches the
  basis's `chosenRange`/`chosenApparatus`. Pass.
- **36 vs 16 route classes** — short 16 units / 14-unit shadow; long 36 units,
  61 samples, "20 units and 125 percent longer", recomputed against
  `selected-geometry-qualification.json`: 36−16 = 20, 20/16 = 1.25, ratio 2.25.
  Pass, arithmetic exact.
- **Common passage** — 18 units, every dense point in range of and unobstructed
  from the held reference, `contiguousSpanUnits: 8` outside the fixed reference
  (`unitsOutsideFixedReference: 8.25`). Pass; wording caveat below.
- **Terra's actual comparison precedes the explicit far reference** — `i needed
  the end he held.` is earned on *actual completion*, and only then does she
  offer and occupy the far reference; Exec:99 states the same order. Pass.
- **Quiet drawing** — "one quiet standing instruction, without a prompt or chime
  for each point or turn." Pass.
- **Every cap unchanged** — candidate ¶62's "at most two route slots …, 128
  grounded samples and 120 world units per trace" is byte-identical across the
  v1 draft, v2 draft and signed candidate. Pass.
- **Stage order** — exact connected head and non-overlapping actor staging are
  stated as *pending scene-contract* obligations while only narrative direction
  is approved (`adoptionScope`: "not new canon choices"). Pass.
- **F01** — Exec:310 now reads "through `ch10-transit` and `done`", matching
  `storyState.ts:349-350`; iteration-2 R1 and critic finding 2 are repaired.
- **CPU studies not over-credited** — the qualification's own `status` is
  "PREPRODUCTION MEASUREMENT … not shipped behaviour"; Bible "not a playable or
  rendered scene"; Exec "no playable, rendered or hardware result is implied";
  `hardwareOrLiveAcceptance: false`. No live/body/hardware/listening credit. Pass.
- **Timelessness** — 0 added lines carry contemporary-flashpoint vocabulary.
- **Ceilings** — runtime `ch10-transit`, release `ch4-arrival`, unmoved.

`activeProduction` still names `2026-07-13-distance-between-fires`:
**intentional and declared** (Bible:1506-1509), recorded here as a strict future
obligation, not a new runtime identity claim.

## 5. Findings — none blocking; smallest concrete items only

- **F-A (cosmetic, one word).** Exec:92-93 "full held-reference coverage **and** a
  real eight-unit contiguous portion outside the fixed reference's useful
  coverage" reads as contradiction unless the held/fixed distinction is already
  in mind; both halves are measured true. Smallest fix when next touched: "full
  **worker-held** reference coverage."
- **F-B (cosmetic).** Only the cinematography signoff carries explicit
  `runtimeMutationAuthorized` / `publicationAuthorized` /
  `hardwareOrLiveAcceptance: false`; the refusals still bind via the owner
  decision and geometry basis. Add the fields at the next signature round.
- **F-C (cosmetic).** `authority-before/` holds the gate script,
  `authority-after/` does not — snapshot asymmetry only; the gate is provably
  unchanged. `check-results.json` still records iteration 2's 77/1094;
  superseded here, deliberately not corrected.

## Verdict and future obligations

Bounded documentation authority is **APPROVED**. Every mandated command passes
at the expected count, the cumulative diff reconstructs byte-exactly, runtime is
provably untouched, and each v2 canon number is backed by the measurement it
cites. Outstanding and explicitly unclaimed: the signed scene contract binding
the connected head, endpoint-contact predicate and non-overlapping near-end
blocking; the final scene geometry hash and three scene signatures; the
`activeProduction` update at signed implementation only; headed hardware,
supported-tier, live-interaction, terrain-edit and listening acceptance;
`ch4-arrival` release ceiling with publication unauthorized.
