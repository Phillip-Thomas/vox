# Run summary — 2026-09-04 audio 10x

## Disposition

**OPEN — parent contract amended to `draft-v4` in the Stage 2 repair loop,
awaiting three fresh director signatures.** The production lock is frozen, the
shipped reference map is written, all three treatments are in, the six directed
peer notes are compiled into `director-notes.jsonl` with their
recipient-authored reconciliations, the dissent register is written, Stages 1
and 2 are implemented in the working tree, and both stage review networks and
cohesion judgements have run (Stage 1 `route_repair`, weighted 4.60; Stage 2
`route_repair`, weighted 4.58 against a 4.75 threshold with a 4.40 floor).

**Frozen contract bytes:** `scene-contract.json` sha256
`672de45a0c8257d334d052cbedf4247fd09b0f1dba385cc5fb9d06e04459d41d`, snapshotted
byte-identically at `snapshots/scene-contract.draft-v4.json`. The three director
signoffs must bind exactly this hash; all three are currently bound to the
superseded `draft-v3` bytes `776d676b…` and must be re-collected.

Lineage: `draft-v1` `2bb7d478…` (synthesis) → `draft-v2` `384120dc…` (signature
objections, tri-signed) → `draft-v3` `776d676b…` (the judge-routed Stage 1
repair amendment: `score-repair-direction.json#contractAmendmentProposal` applied
verbatim for D1, D9, D10, D12 and D13, plus the D5 story-floor check carried as
a Stage 2 term; tri-signed) → `draft-v4` `672de45a…` (the judge-routed Stage 2
amendment: `cohesion-judge-stage-2.md` §7 items 1–7, the score auditor's D1/D2/
D6/D7 requested text, `human-decision.json` HD-08 and HD-09, and Cinematography's
amended C6 from `c6-amendment.md`). Contract-phase gate: 14 failures, all
`signoffs.*`.

Authority: owner direction of 2026-09-04, "implement the full plan" and "I
trust your judgement on all the questions", over
`PARAVOXIA_AUDIO_10X_PLAN.md`. That direction expands the production lane to
protected audio paths for the scope of that plan and converts the plan's four
open questions into owner decisions. Shipped copy remains protected. Story
content is out of scope. Publish is not granted.

## Scope

Six locked stage beats, one child scene contract each:

1. `audio-stage-1-bed-timbre-mastering` — Stage 1. Bed graph construction and
   the per-bar rim, level constants, the music-bus glue stage before the safety
   compressor, and the story reverb impulse. Does not add percussion sources,
   change harmony or arrangement, touch SFX, or alter the safety compressor.
2. `audio-stage-2-game-mix-buses` — Stage 2. Bus topology, a limiter on the sum,
   a duck matrix, mix snapshots, SFX awareness in the music director, and
   snapshot intent from the audio director component. Does not change SFX
   recipes, add spatialization, or alter music-internal topology.
3. `audio-stage-3-composed-sync` — Stage 3. The eleven story cue call sites move
   to scheduled, grid-aligned hits; the mood harmony path transposes to the live
   tonic; moods become constraints to the harmony brain with the schema
   unchanged. Does not change any mood entry, dialogue timing, or camera event.
4. `audio-stage-4-spatial-sfx` — Stage 4. Seeded per-trigger variation,
   position and room presets on the twenty shipped recipes; position parameters
   at the call sites; three new semantic feedback cues. Does not change music,
   buses, the limiter, or the loop-guard thresholds.
5. `audio-stage-5-long-form` — Stage 5. A phrase planner above the arrangement,
   whole-bar memory, and a real source for the sidechain. Does not change ladder
   thresholds, story moods, or the tick voice.
6. `audio-stage-6-voice-bus` — Stage 6. An additive voice bus and a granular
   phoneme plan, contracted where it joins story surfaces. Does not author
   words, reveal ontology, or change story timing.

**Stage 0 is not in this run.** It is additive, uncontracted, and being
implemented separately. Its outputs are inputs here.

## Stage 0 baselines

**COMPLETE and measured**, copied here from `PARAVOXIA_AUDIO_10X_PLAN.md`
section 7 as the plan and the run lock require. These are the before column
every stage gate is measured against, and they are written into
`scene-contract.json` `evidence.acceptanceCriteria`.

| Render | Integrated | True peak | Loudness range |
| --- | --- | --- | --- |
| Bed alone | −23.14 LUFS | −9.70 dBTP | 6.88 LU |
| Combined music plus SFX | −23.13 LUFS | −9.70 dBTP | 6.84 LU |
| SFX alone | −44.69 LUFS | −21.38 dBTP | 14.67 LU |

SFX-only correlation is 1.000, which is the measured statement of the
dead-centre mono defect Stage 4 repairs.

**Replay determinism is a float floor, not byte equality.** Bit-identical PCM
replay is not achievable in this renderer: the float floor is about 2e-5. The
gate therefore asserts a replay delta at or under 1e-4 plus a windowed
fingerprint hash, and PCM SHA equality is explicitly not a gate. This is honest
rather than weaker: byte equality was never true, because the shipped noise
source was `Math.random`, and Stage 0 replaced it with a seeded source as a
determinism repair.

Targets the baselines are measured against, from the owner decisions and the
plan's section 7:

- Integrated loudness −18 LUFS on the summed game bus; bed near −20 to −21;
  BLOOM peaks near −14 short term.
- True peak at or below −1 dBTP on every combined render.
- `score:fps` median at or above 60 on the SwiftShader gate; today's shipped
  figure is 60.39 median.
- Smoothness violations: zero, and the thresholds may only tighten.
- Steady-state AudioParam writes below 60 per second, from roughly 1140 today.
- Stage 5 soak targets: barNovelty at or above 0.85 from 0.31 to 0.50;
  tabuBypasses at or below 4 from 16 to 100; distinctChords at or above 30 from
  14 to 21.

## What changed

No runtime source has been changed by this run. What exists is the record:

- `production-lock.json` and `production-lock.md`, frozen, plus three
  amendments (two bounded path expansions requested by director notes, and one
  concurrent-session hazard notice).
- `story-intent.md`, `score-treatment.md`, `cinematography-treatment.md`.
- Six first-wave director notes and six recipient-authored reconciliations, all
  closed `accepted-with-change`, compiled into `director-notes.jsonl`.
- `dissent-register.md`: one preserved joint dissent against the plan's
  `'phrase'` quanta, two recorded positions, seven accept-with-change taste
  deltas, and one withdrawn conditional dissent.
- `scene-contract.json` at `draft-v1`, frozen: ten `anc.` sync anchors with the
  per-hit cap table, ten shots describing the existing shipped shot at each
  anchor, seventeen score cues, eleven guidance objectives bound to the shipped
  objective inventory, four quality tiers, eight reset states and the per-stage
  evidence gates.
- `shipped-visual-baseline.json` and `shipped-ux-baseline.json` rebound from
  the template anchors to the ten authored `anc.` anchors and to
  `sceneId: audio-10x-overhaul`. No hash, capture path or measurement was
  altered by that rebinding.

`implementation.diff` will record the first material change; until then the
correct diff for this run is empty.

## Evidence

- Canonical preview URL: `http://127.0.0.1:5212` — a pre-existing `main/` vite
  dev server, pid 95250, started with `PROBE_NO_HMR=1`, therefore serving stale
  modules after an edit until it is restarted. A `vite preview` of the built
  bundle runs on `http://127.0.0.1:5231`, pid 88210. Ports 5173, 5174, 5199 and
  the 3xxxx probe range belong to the sibling Paraform project. **Do not start a
  duplicate server**; restart 5212 if it goes stale or dies, and re-record
  ownership here.
- Audio evidence is combined music-plus-SFX renders only. A score-only render
  cannot settle a mix question in this engine, because several engines stack on
  the music bus.
- Every stage carries: A and B excerpt renders over the six owner excerpts in
  `main/src/audio/soak/excerpts.ts`; integrated loudness and true peak; the
  smoothness battery; `score:fps`; and the stage's own gate from the plan.
- Stage 4 additionally carries a spectral-fingerprint regression per SFX event,
  which is what replaces the retired byte-identical policy, plus a fresh
  read-only `player-experience-auditor` report for the feedback-cue change.
- All evidence is hashed into `evidence-registry.json` and probe-matched at the
  final gate.

## Quality

No score yet. The run profile's thresholds apply unchanged: weighted score at or
above 4.75 of 5, every category at or above 4.30, no critical or high defects,
and no unaccepted medium alignment, agency, player-experience, cinematography,
score, accessibility or implementation-fidelity defect.

The headed taste gate for this run is an **owner audition of A and B excerpts
per stage**. Headless proof cannot approve timbre, loudness, width or feel. A
stage whose numbers are green and whose audition has not happened is not done.

## Resume point

1. Collect three fresh director signatures against the frozen `draft-v4` bytes
   `672de45a0c8257d334d052cbedf4247fd09b0f1dba385cc5fb9d06e04459d41d`. Each
   `*-contract-signoff.json` must carry that hash, `contractVersion` `draft-v4`
   and a disposition of `approve` or `approve-with-notes`; `director-signoffs.json`
   is then recompiled losslessly from the three. These fourteen `signoffs.*`
   failures are the only contract-phase gate failures. Cinematography's C6 is
   re-signed to the amended text in `c6-amendment.md`, which now binds SFX
   forward-scheduling at five bundle members and a per-sample-rate latency table;
   dissent `D-2` is preserved unedited and stands until the 48 kHz render.
2. Rebind `human-decision.json` to `draft-v4` / `672de45a…`, move HD-08(1) into
   `acceptedExceptions` as the delegated taste exception the judge required, and
   record HD-09. This is defect `S2-J6` and was deliberately not performed in the
   `draft-v4` amendment, whose file list was enumerated by the orchestrator.
3. Close `repair-contract-disposition.json` as `revised-and-resigned` once those
   signatures bind `draft-v4`. Its current route, `revised-pending-signature`, is
   an in-flight marker and is not in the gate's governed route enum. Its `stage2`
   section carries the S2-* dispositions.
4. Land the judge's bounded Integration code list against the signed `draft-v4`:
   the per-rate latency table plus a 48 kHz `audio:check` render (closes `S2-D4`
   and dissent `D-2`), 1 ms duck traces and an `oxygenCritical` trace (`S2-J3`,
   `S2-J5`), the published `composedSpread` field (`S2-D2`), the ramped
   oxygen-dive stress script (`S2-J2`), and a lean-tier cost probe through the
   new tail (`S2-J7`). Then re-verify, re-judge, and hold the owner audition.
5. Stage 3 continues meanwhile only under `cohesion-judge-stage-2.md` §5: no
   `bundleAt` latency or SFX-forward code, no edit to `main/src/audio/audioCore.ts`
   or `main/src/audio/mix/**`, and Stage 3's `before/` pinned to Stage 2's
   `after/`. Cinematography-continuity and player-experience audits are mandatory
   from Stage 3, and the player-experience audit must cover acknowledgement
   latency and the held-level law on mining and pickup.
6. Carry the Stage 1 items that are still open — D3 ms/frame at full and lean 4×,
   D5 floor renders, D11 story-mood A/B, D14 ledger record, D15
   `mining-metronome-probe.mjs`, and the D13 streamed-loop / drone-bank decision
   at the audition, which resolves the `scope.nonGoals[15]` retirement term.
   `mining-metronome-probe.mjs` cannot PASS on either side until the
   sandbox-no-op instrument can engage mining; that Stage 0 tooling defect
   (`S2-J4`) closes before Stage 4.
7. Rebind the review, evidence and scorecard artifacts to `draft-v4` before
   closeout. `defects.json`, `verification-report.json`,
   `raw-audiovisual-evidence.json`, `evidence-registry.json`,
   `final-scorecard.json`, `check-results.json`, `human-decision.json` and
   `score-repair-direction.json` still bind `draft-v2` / `384120dc…`, which is
   historically correct for what they measured but which the implementation- and
   final-phase gates require rebound.
8. Repair the production-lock and shipped-reference-map items that are not this
   contract's to fix, with the lock owner, before the final gate.
