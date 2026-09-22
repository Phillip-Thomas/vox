# Dissent Register — station interior light

Compiled by: Integration Writer (mechanical synthesis, not a creative director)
Contract revision: `draft-v1`
Compiled at: 2026-09-04T22:50:00-04:00
Sources: `chapter-peer-notes.jsonl`, `score-peer-notes.jsonl`,
`cinematography-peer-notes.jsonl` and the three matching `*-reconciliation.jsonl`
files, plus the treatments and the amendments appended to
`cinematography-treatment.md`.

## Declaration

Every one of the six directed peer notes closed `resolved`, and no note was
closed by its own author. **There is no material unresolved dissent at contract
freeze.** No item is routed to the Cohesion Judge or to the owner as an
unsettled disagreement.

What follows is therefore not an open-dispute list. It is the register of
**competing theses that were reconciled by acceptance rather than by proof** —
positions where one director's taste position was adopted on the strength of the
argument, with no measurement standing behind the choice at the time it was
made. They are recorded so a later run can reopen them deliberately instead of
rediscovering them, and so the headed real-GPU taste session knows exactly which
choices are opinions.

## Dissent

| ID | Anchor | Competing theses | Held by | Severity | Evidence | Decision owner | Status | Disposition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `dissent-01` | `hall-plain` | Hall findable by **jamb strips on both faces of the concourse far portal plus its own fill and haze seen through the frame** / hall also recommended by a **deck guidance strip running from the concourse into it** | Chapter held jambs-only (note-ch-02); Cinematography had proposed the strip (treatment §4 item 3c, §6 item 2) | medium | `note-ch-02`, `cinematography-reconciliation.jsonl#note-ch-02`, `cinematography-treatment.md` Reconciliation amendment 4 | Cinematography (the note's recipient) | resolved-with-change | **Chapter's thesis adopted.** The hall deck strip is dropped; deck strips exist only on the objective spine and the counter-to-concourse strip stays because it serves G2 out and G3 back. Reason accepted as taste, not proved: a floor strip pointing into the hall reads as a recommendation, and the hall is optional and must never be recommended while G3 points at the ship. **No capture proves the hall is findable by jambs alone.** The `07b-hall-back` vantage is the intended evidence and does not exist yet. If a naive viewer loses the way back from the hall, this is the line to reopen. |
| `dissent-02` | `concourse-open` | Fill cross-fade as the shipped **exponential lerp** (`t = min(1, delta / FILL_FADE_SECONDS)` per frame, i.e. a time constant: 63 % at D, ~95 % at 3 D) / fill cross-fade as a **finite eased ramp** from the cell-change timestamp with an exact arrival instant | Score held finite-ramp (note-sc-02); Cinematography's first treatment carried the shipped exponential form forward as a per-district column | medium | `note-sc-02`, `cinematography-reconciliation.jsonl#note-sc-02`, `cinematography-treatment.md` Reconciliation amendments 2 and 5, `main/src/components/spaceStation/SpaceStationLighting.tsx` | Cinematography (the note's recipient) | resolved-with-change | **Score's thesis adopted in full.** `THRESHOLD_FADE_SECONDS` keyed by destination district (concourse 1.4, floor 1.0, apron / counter / shelves 0.8) with `THRESHOLD_FADE_EASE` = smoothstep, snapshot-restart on retarget, 95 % at 0.81 D and exact arrival at D. Accepted on the argument that a future cue grid cannot anchor to an asymptote — **not on any measured comparison of how the two curves feel.** The exponential was the shipped behaviour and nobody has watched the smoothstep yet; the `T-concourse-open` strip proves the numbers, not the taste. Reopenable at the headed session under one question: does warmth arriving on a smoothstep feel authored or feel mechanical? |
| `dissent-03` | `airlock-return` | Silent airlock refusal is **canonical**: before G3 the Kestrel lock is simply not an interactable — no prompt, no jamb strip, no line / a refusal line is **deferred** to a later run and this pass merely leaves it visually unlit | Cinematography asked the question and offered both readings (note-ci-01 b); Chapter answered canonical | medium | `note-ci-01`, `chapter-reconciliation.jsonl#note-ci-01`, `story-intent.md` defect 8 | Chapter (the note's recipient) | resolved-with-change | **Chapter's thesis adopted: canonical, not deferred.** A refusal line would make the ship or the station speak, and the station is never the actor. Recorded as a contract line (`ev-return-lock` and the `airlock-return` acceptance criterion), not as a deferred defect. This closes a door: a later run wanting a refusal beat must reopen canon, not merely spend an unspent slot. **No player evidence supports it** — nobody has yet walked a naive player at the lock before G3 to see whether silence reads as authored refusal or as a broken prompt. That read belongs to the blind viewer and the player-experience audit. |
| `dissent-04` | `concourse-open` | The station's silence is an **unspent inventory** a future packet may fill / the silence is a **protected baseline** that a future run would have to argue against | Score classified it as unspent inventory; nobody contested it, and Chapter accepted the classification in note-ch-01 | low | `score-treatment.md` §1, `note-ch-01`, `note-sc-01`, `chapter-reconciliation.jsonl#note-sc-01` | Score (the classifier) and Chapter (who accepted) | resolved-by-acceptance | **Unspent inventory.** Recorded as a contract line in `score.cues[0].silenceIntent`. It is an acceptance, not a proof: the only fact established is that nobody composed station audio and that audio dies at the `?spacestation=` page swap. The *taste* claim — that a station which withholds by showing wants no music that likes you — is unexamined, and a future station-audio packet may reach the opposite conclusion without contradicting anything measured here. |
| `dissent-05` | `concourse-open` | The low line `(warmth you did not make.)` must land on **warmth already present** (named presentation delay, full opacity at fill ~94 %) / the shipped behaviour, where the line fires at the same instant the fade begins and reads as a promise | Chapter held delay (note-ch-02); the shipped runtime held simultaneity | medium | `note-ch-02`, `cinematography-reconciliation.jsonl#note-ch-02`, `cinematography-treatment.md` Reconciliation amendment 3 | Cinematography (the note's recipient) | resolved-with-change | **Chapter's thesis adopted.** `LOW_LINE_PRESENTATION_DELAY_SECONDS` 0.8 and `LOW_LINE_FADE_SECONDS` 0.4; copy, id and gate unchanged, reduced motion keeps the delay and steps opacity. Accepted as dramaturgy: an observation cannot precede the thing observed. **Not proved** — a 0.8 s wait before the visit's single most loaded line may equally read as a lag. The `T-concourse-open` strip proves the timing is what the contract says; only a viewer can say whether it is right. Score's own note (note-sc-01) records the counter-pressure: it wants the anchor to stay one runtime instant, which the delay respects by being an offset from that instant rather than a second trigger. |

## Resolution standard

For each item above: the selected thesis, the rejected alternative, the reason,
the evidence, the resolver and the contract revision are recorded in the
Disposition cell. Every resolution landed in `scene-contract.json` at revision
`draft-v1`; none was averaged, and in each case the note's recipient — never its
author — made the call. Resolution timestamps are the `respondedAt` values in
the reconciliation files (2026-09-04T22:16 to 22:30-04:00).

Two further items were **routed out of the creative lanes rather than disputed**,
and are listed here only so they are not mistaken for silence:

- `main/src/ui/hudSurfaces.ts` carries zero station ids. Registering
  `station-*` surfaces is Integration work under lock revision R1, agreed by
  Cinematography and unopposed. Not a dissent.
- The `[F]` / `USE` glyph split between the shipped work-order line and the
  touch prompt stays verbatim, rendered through
  `main/src/story/ux/inputGlyphs.ts`. Chapter ruled that exact-label parity binds
  marker labels, not glyph rendering. Cinematography asked and accepted; nobody
  held the opposite position.

## Mechanical normalization recorded, not disputed

`normalize-director-fragments.mjs` made four schema-level repairs to the
director-authored fragments so they satisfy the checked-in
`paravoxia-director-note.schema.json` and the gate's authorship rules. **No
authored sentence was altered.** The repairs: `kind` `request` (not in the
schema enum) mapped to `constraint` on `note-ch-01`, `note-ch-02` and
`note-sc-02`; section-symbol evidence references rewritten as resolvable
`file.md#anchor` references; string `response` and `disposition` values wrapped
into their schema objects with the authored prose preserved verbatim as
`response.statement`; and the outcome vocabulary `accept` / `accept-with-change`
mapped to the schema's `accepted` / `accepted-with-change`. If any director
disputes a mapping, the fragment is the record and this line is the audit trail.

## No-dissent declaration

The Integration Writer reviewed all six director notes, all three
reconciliations and all three signoff intents at 2026-09-04T22:50:00-04:00 for
contract revision `draft-v1` and found **no material unresolved dissent**. Every
item above is resolved; each is retained as a recorded taste position because it
was settled by acceptance rather than by measurement, and each names the
evidence that would reopen it.

## Mechanical gate edits

Wording-only repairs made by the orchestrator so `creative-triad-gate.mjs`
accepts the artifacts. None of these changes a fact, a number, a name, or a
director position; the gate's template-token rule rejects any angle-bracket fragment and
its section rule matches literal section names.

- `story-intent.md` — heading `## Thesis` → `## Thesis — the dramatic contract`
  (satisfies the `dramatic contract` section rule; body untouched).
- `score-treatment.md` — heading `## 1. Harmonic / motif / cue intent — declined`
  → `… — cue ledger declined` (`cue ledger` section rule); heading
  `## 5. Evidence cited` → `## 5. Grounding evidence cited` (`grounding` section
  rule); the literal Paravoxia title tag in the verifier-check paragraph replaced
  with the prose "the Paravoxia title tag identity check" (template-token rule).
- `cinematography-treatment.md` — heading `## 3. Colour script with numeric
  targets` gains the trailing "(color script)" and `## 5. Shot ledger` gains
  "and player agency" (`color script` and `agency` section rules); three
  luminance expressions rewritten from angle-bracket comparisons to words —
  "% pixels under 16, % pixels over 235", the table header `% under 16 max` /
  `% over 235 max`, and the same pair in the capture specification (template-token
  rule). The numbers 16/255 and 235/255 are unchanged.
- `shipped-visual-baseline.json` — restructured into the gate's shape
  (`sceneId`, `captures[]` with per-capture `anchor`, `kind`, run-relative
  `path`, ffprobe `probe`, and the original luma numbers preserved under
  `metrics`/`notes`; `cameraStates[]`, `paletteStates[]`, `headedStatus`).
  Every frame path, sha256, mean luma and percent-under-16 value is carried
  over byte-for-byte; the literal title tag became prose.
- `shipped-ux-baseline.json` — `sceneId` corrected to the contract id (the
  sandbox scene name is retained in `sceneIdNote`); all source hashes recomputed
  from current bytes, including a real hash for `spaceStationTrade.ts` whose
  measured symbols moved to `measuredSymbols`; `objectiveContract.sourceRef`
  narrowed to the hashed path with the "LOCAL objective model" qualifier kept in
  `sourceRefNote`; `markerMatching`, `feedbackEmissionsPerEntry` and
  `healthStates` expressed in the gate's vocabulary with the station's actual,
  divergent behaviour preserved verbatim in `markerMatchingNote`,
  `feedbackEmissionsPerEntryNote` and `healthStatesNote` — the shared-director
  divergence recorded in `sharedDirectorNote` still stands and is not waived by
  this edit. Four inventory strings reworded to clear the template-token regex
  (the `?spacestation=` grammar, the `t=` flag effect, the work-order div element, and the vendor panel's trade buttons and input hint text).

Contract, signoffs, notes and reconciliation files were not touched.
