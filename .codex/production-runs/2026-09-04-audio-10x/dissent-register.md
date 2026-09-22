# Dissent Register — audio 10x overhaul (run 2026-09-04-audio-10x)

Compiled by the integration engineer from `chapter-peer-notes.jsonl`,
`score-peer-notes.jsonl`, `cinematography-peer-notes.jsonl` and the three
reconciliation files, against `scene-contract.json` draft-v1. Nothing here is
paraphrase of a position a director did not take; every entry cites the note or
reconciliation that carries it.

## Preserved dissent

**D-1 — Joint dissent against the plan's `'phrase'` quanta, held by all three
lanes.** `PARAVOXIA_AUDIO_10X_PLAN.md` Stage 3 defaults blooms to a `'phrase'`
quantum. Cinematography raised it first (`cinematography-treatment.md` section
6, "Dissent held"): a phrase is too coarse for the four stage cuts, and the
intent's `'beat'` is what that lane signs. Score joined it (`score-recon-02`,
SC-R13: "Shared dissent against the plan's 'phrase' quanta for blooms is
preserved: I sign 'beat' under cap for the four stage cuts; 'bar' survives only
for the two a3 rows as a hold on waveStart, never a shrink"). Chapter joined it
(`chapter-note-02` section 1: "your dissent against the plan's 'phrase' quanta
for the stage cuts is joined — 'beat' stands"), and re-affirmed it in
`chapter-contract-signoff.json`. Cinematography records it in
`cinematography-recon-01` CN-R1 as "dissent against the plan's 'phrase' now held
by all three lanes."

*Resolution.* The dissent is **preserved, not resolved.** The contract carries
`'beat'` (degrading to the 8th step under the per-hit cap) at every stage cut,
and `'bar'` only at the two a3 rows and only as a hold on `waveStart` that may
never shrink. The plan's own default is therefore overridden by the signed
contract. This is a standing disagreement with an authority document, and it is
the owner's to overturn: if the owner restores `'phrase'`, all three lanes are
on record that the four stage cuts will separate image from score.

## Positions recorded, not dissent

**P-1 — Score's shortened-road position.** `score-treatment.md` section 11 and
`score-contract-signoff.json`: "if the owner shortens the road, ship 1–2–3 and
stop — that is most of the audible distance, and Stage 5 is better designed
after hearing Stage 1." Chapter recorded it as "the owner's, not mine"
(`chapter-note-01` section 8); Score itself states it is "the owner's call, not
a condition." It is not dissent against any contract term and blocks nothing.

**P-2 — Owner-taste item: the sound-caption surface in movie mode.**
Cinematography recommends setting-only and absent from movie mode
(`cinematography-treatment.md` section 6); Chapter concurs from the chapter side
(`chapter-recon-02`, re CN-N2: "the movie is the story-debugging tool; a caption
there is evidence noise"). Both lanes agree, so it is not dissent — it is an
open owner decision the contract records as default-off.

## Accept-with-change deltas a director flagged as taste

All six notes closed `accepted-with-change`. These are the changes where the
recipient's own record marks the change as a matter of taste or authorship
rather than mechanism, and where the contract carries the changed form:

- **`marker-acquired` is square-derived REGULATION, not a triangle.** Score
  designed a soft triangle blip (`score-treatment.md` section 4) and asked whose
  voice the marker is (Q10.4). Chapter ruled against the triangle on taste and
  canon grounds: the triangle is the warmth given to the first non-quota verb,
  and a triangle marker would make guidance read as a thing in the world, which
  the pillar keeps open (`chapter-note-01` section 5). Score withdrew the
  triangle design in `score-recon-01` SC-R5 and reserved the timbre for forage
  and pickup. Contract: `sc.lifecycle.marker-acquired`.
- **`[GLITCH]` refused, `[STATIC]` adopted.** Cinematography proposed four cue
  words (`cinematography-note-01`, CN-N2). Chapter ruled `[GLITCH]` out under
  the both-readings test — it diagnoses a malfunction where the other reading
  hears the narrator's own stutter of embodiment — and substituted `[STATIC]`,
  which names the sound and not the cause (`chapter-recon-02`, re CN-N2).
  Cinematography withdrew `[GLITCH]` in `cinematography-recon-01` CN-R4. This is
  a copy-law taste ruling and it is the only word in the run Chapter refused.
- **Lean-tier rooms are `plain` + `underwater`, not `plain` + `interior`.**
  Score chose plain and interior (`score-treatment.md` section 4);
  Cinematography argued parity — the underwater medium is the strongest visual
  environment change in the game and its post pass survives every tier, so a dry
  lean ear under a submerged eye would be a tier-only meaning
  (`cinematography-note-02`, CN-N7). Chapter sided with Cinematography
  (`chapter-note-01` section 7: "parity wins"). Score conceded without offering
  the render it reserved the right to offer (`score-recon-01` SC-R7,
  `score-recon-02` SC-R10) and Cinematography records that its dissent
  "dissolves and none is preserved" (`cinematography-recon-02` CN-R13).
- **The pulse body arrives at `alive`, not at `material`.** Chapter constrained
  the sidechain source on metaphor-stack grounds: the pulse reads as a
  heartbeat, and the body arrives at `alive` (`chapter-note-01` section 7),
  inviting Score to argue the contrary in reconciliation. Score declined to
  argue: "I will not argue that a pitch-swept sine at material reads as machine
  — an 80 Hz to sub sweep is the kick every listener hears as a body, which is
  precisely why it belongs at `alive`" (`score-recon-01` SC-R7). Only the click
  and tail tick at `material`.
- **The first post-refusal section carries `bloomBudget` 0 and a plateau or
  fall arc.** Chapter's dramatic constraint — "the world does not celebrate a
  refusal" (`chapter-note-01` section 7) — accepted verbatim by Score in
  `score-recon-01` SC-R7 and carried in the contract's
  `sc.silence.authored-quiets` cue.
- **Onset is the envelope start at all ten anchors, with no full-level
  offsets.** Score offered to shift the schedule so full level lands on the
  target where the image should carry the perceptual weight
  (`score-note-02`, C2). Cinematography declined everywhere, including the lift
  snap braam, on a causality-of-image argument: an image landing at full level
  puts 350 ms of swell before the snap, which is sound anticipating image
  (`cinematography-recon-02` CN-R10). Contract: envelope start at all ten.
- **`bundleAt` gains a latency-compensation term.** Cinematography adopted
  Score's `perfTime` publication, then Score withdrew it for `armedAt`; the two
  crossed. Cinematography's output-latency argument decided it and the contract
  carries `latencyComp` clamped to `LATENCY_COMP_MAX_S` 0.25 s, sampled once at
  arming (`cinematography-recon-02` CN-R9, `score-recon-02` SC-R9). This is a
  mechanism change, not a taste change, but it is recorded here because it moved
  the `BEAT_TIMEOUT` margin per row from the row cap to the row cap plus 0.25 s.

## Withdrawn dissent

- **Cinematography's conditional dissent on the lock.** `cinematography-note-01`
  (CN-N1, critical) refused to sign a contract whose accessibility clause named
  a surface no lane could create, and offered a fallback in which intent section
  4's promise is marked PARTIAL. The production-lock amendments of
  2026-09-04T21:49:54-04:00 and 21:50:30-04:00 admitted the four HUD-parity
  files and the two signal-publication files, so Chapter withdrew the fallback
  (`chapter-recon-02`, re CN-N1: "intent section 4's promise is FULL for this
  run, not PARTIAL; the dissent fallback in chapter-note-02 section 3 is
  withdrawn") and Cinematography recorded the condition as lifted and the
  fallback as moot (`cinematography-recon-01` CN-R3). No dissent survives here.

## Open conditions carried into signature, not dissent

`cinematography-contract-signoff.json` listed CN-N3 (the reduced-motion and
pause/quit/deep-link bundle terms) and CN-N5 (the relay-answer text lead) as
unruled at the time it was written. Chapter ruled both in `chapter-recon-02`:
CN-N3 frozen verbatim, and CN-N5 ruled as a **zero** text lead off the shared
anchor, retiring `RELAY_ANSWER_LEAD_S` and `askLastKeyTime`. Both rulings are
contract terms in draft-v1, so neither is an open condition against these bytes.
The directors' signatures are collected against the frozen SHA recorded in
`run-summary.md`; any lane that reads its condition as unmet may withhold its
signature there, and this register will be reopened rather than amended.

**D-2 — Cinematography dissent against score-audit-stage-2 D4's sample-count derivation of the latency constants (held by Cinematography; D3 is accepted in full).** The audit recommends exporting `LATENCY_COMP_MUSIC_PATH_SAMPLES` 1112 / `_SFX_PATH_SAMPLES` 456 and deriving seconds from `ctx.sampleRate` at arming. Cinematography's ruling (`c6-amendment.md`, ruling 4) is that this is not more correct at 48 kHz than the 44.1 kHz seconds figure: the three DynamicsCompressor pre-delays are time-specified (6 ms each, converted to frames at the context rate in Chromium and Gecko) while only the oversampled shaper resamplers are sample-fixed, so a samples-derived 23.17 ms and the seconds-derived 25.215 ms are both outside the 0.5 ms tolerance of the estimated ~24.6 ms true value. The amended C6 instead binds a per-sample-rate table measured by `measureTailLatencyS` in an `OfflineAudioContext` at each rate and selected by `ctx.sampleRate` at arming. *Resolution:* preserved for the Score Director and the orchestrator; a 48 kHz mirror measurement decides it, and if that measurement lands within 0.5 ms of the samples-derived figure Cinematography withdraws this entry.
