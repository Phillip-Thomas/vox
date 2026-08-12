# Score Treatment — ch10 station introduction (cold / ask / transit)

Author: Score Director
Status: ready_for_reconciliation
Prepared independently from the Cinematography Director's first treatment: **yes**
(this run's cinematography treatment has not been read; the only cinematography
material consulted is the unsigned 2026-07-27 council candidate, cited as prior).

## Grounding and thesis

- Story-intent revision: `ch10-station-introduction` contract revision **1**
  (`story-intent.md`, this run).
- Production lock: `production-lock.md` (2026-08-11T17:06:29-04:00) — binding.
  Protected: `main/src/audio/`, `main/src/components/audio/`, `main/public/audio/`.
  My realization lane: `main/src/story/emergentScoreDirector.ts`, `main/src/story/storyScore.ts`
  (new ch10 `MOODS` entries only), `main/src/story/signedSceneAvRuntime.ts` +
  `generatedSceneAvRuntime.json` (new signed cues/anchors). Shipped ch1–ch9 cues
  regression-proven untouched. Evidence: deterministic OfflineAudioContext renders +
  combined-bus excerpts only; **no realtime soak**; the continuous-pedal thesis and
  its 60-minute soak are deferred to their own packet and nothing here depends on them.
- Shipped cue/motif references (verified in working tree this session):
  - `main/src/story/storyScore.ts#MOODS` — `ch9-hearth` `{ chord:[0,4,7,10,14], progression:[[0,4,7,10],[7,10,14],[0,7,12]], tempo:56, wave:'triangle', pad:0.17, sub:0.08, baseline:0.28 }`;
    `ch8-crossing` `{ chord:[0,3,7,9,14], tempo:68, wave:'sawtooth', density:0.32 }`;
    `ch4-arrival` comment: "the SQUARE WAVE returns underneath … a foreign body in the living world's mix";
    `ch4-comply` comment: "Compliance subtracts rather than intensifies."
  - `main/src/story/emergentScoreDirector.ts#OWNED_BEATS` = `['ch7-reconstruct','ch7-board']`,
    with pure reload-safe variant resolvers (`resolveChapter7ReconstructionScoreVariant`)
    driving `setStoryScoreMoodOverride` — the exact pattern ch10 extends.
  - `main/src/story/signedSceneAvRuntime.ts#scoreIntensityFor` (line 349) — the score
    authority every ch10 anchor-intensity claim below routes through, per the ch7/ch8
    routed-packet discipline.
  - `main/src/story/generatedSceneAvRuntime.json#sc.hearth.between-fires` — anchored
    `at anc.hearth.ecology-night`, mixIntent "Interior, rest, and living-world sound
    lead over low counterpoint", resetRef `reset-score`.
- Incoming continuity (shipped evidence, `shipped-visual-baseline.json#scoreStates` +
  `#doneFreePlayStateTrace`): ch9-hearth closes with `sc.hearth.between-fires` at
  intensity **0.28**; at the `done` seam the signed AV rail is released
  (`lastResetReason: "completion"`), cueRefs empty, intensity parked at 0.28, and free
  play runs on the generative bed. ch10 must rise out of that state without a step and
  hand back into it without a residue.
- Outgoing continuity: run two (`ch10-apron` onward) and the deferred pedal packet
  inherit a clean doorway — a carrier pitch with an established meaning that died at
  the ch10 threshold, and a station musical identity that is still **unspent**.
- Emotional-musical thesis (one sentence): **the home's chord loses its floor, the
  player carries the missing step across space to ask for it, and the answer arrives
  on the wrong beat — early — so the chapter's one shiver is metric, not dynamic.**
- Why this belongs to Paravoxia: every device below is a reuse of a shipped meaning —
  the square wave that has meant *institution* since ch1/ch4, the subtraction that has
  meant *compliance* since ch4-comply, the hearth voicing that has meant *home* since
  ch9 — recombined, never re-invented. No new engine capability is required.

## Harmonic and sonic language

- **Harmonic authority/center:** unchanged — one harmony truth via the shipped
  `setScoreMood`/`setMusicChord` chain. All ch10 moods are authored relative to the
  beats' published tonics exactly as ch8/ch9 moods are. **No station key exists this
  run.** The station is deliberately the first destination the score refuses to give
  a tonal home; its only pitch presence is the carrier tone (below), a color tone of
  *both* home keys and a chord tone of *neither*.
- **Motif and transformation:**
  - *Between-fires voicing* `[0,4,7,10,14]` (home) → ch10-cold degrades it in place
    (floor drops a whole step, upper voices held) → its `[0,7,12]` closing cell is
    quoted once at `anc.ch10.station-resolved` under the carrier octave ("both fires
    behind you" as a voicing, not a theme).
  - *REGULATION square fifth* `[0,7]` (ch1 timbre; ch4-arrival/audit precedent) → the
    fault record, the fabricator refusal, and the relay ask/answer figures are all
    built from this cell. Institution already has a sound; I spend it, I do not coin one.
  - *The carrier* — one held pitch class, born at `anc.ch10.relay-answer` as the
    answer figure's unreleased final tone, alive only inside ch10 beats (S4 below).
- **Instrument/timbre palette:** strictly the shipped mood palette — triangle for the
  hearth world, sawtooth for flight (ch8 DNA), square for REGULATION text-moments.
  No new voices, no new hit kinds, no AudioWorklet, no engine edits.
- **Rhythm/pulse:** the foreignness law of this chapter is **timing, not timbre**:
  REGULATION figures land dead on the grid (zero humanize — machine time), while the
  world's music keeps its shipped seeded humanize. The station is audible as
  *perfect punctuality* long before it is named. This is the REGULATION register in
  music terms, and it needs no new scale, no warp grammar, no loudness.
- **Era/diegetic fidelity:** reality stage `alive` throughout — full fidelity rung, no
  era change, no awakening grammar (no BUILD, no riser flip, no braam, no mediant;
  A5 owns warp and the galaxy).
- **Authored silence:** three declared windows —
  1. **ST-0 is scored with nothing, forever, this run** (declared, not defaulted; see
     per-beat section).
  2. The fabricator refusal *subtracts* (the melody voice does not return for the rest
     of ch10-cold): `PATTERN NOT HELD` is realized as the pattern literally not held.
  3. `anc.ch10.seam-of-light`: rhythm section ebbs to nothing — a line with no body is
     music with no pulse; only pad + sub + carrier remain.

## Cue ledger

All relations are to the intent's named anchors; no raw timestamps. `resetRef` is the
shipped `reset-score` in every row. Intensities are the values `scoreIntensityFor`
must report at each anchor (run maximum **0.44**, below every awakening; a4-exhale
remains the larger event by construction).

| Cue ID | Anchor (relation) | Phrase/bar intent | Story function | Intensity | Mix priority |
| --- | --- | --- | --- | --- | --- |
| `sc.ch10.cold-step` | `anc.ch10.cold-noticed` (at) | at the first phrase boundary after entry, the lowest voice (sub root) moves down a whole step while upper voices hold — an inverted suspension: the ground moves under held light | K1 made audible (S1) | 0.24 | interior/ecology SFX lead; score under |
| `sc.ch10.fault-ledger` | `anc.ch10.fault-read` (at) | one quantized square-fifth figure `[0,7]` enters *under* the triangle texture for the caption's duration; dead on grid, zero humanize | the readout is an institution speaking | 0.30 | caption/SFX lead |
| `sc.ch10.refusal-subtraction` | `anc.ch10.fabrication-refused` (at) | the square fifth answers once and stops; the melody voice mutes for the remainder of ch10-cold | refusal as subtraction (ch4-comply law) | 0.22 | silence is the content |
| `sc.ch10.crossing-back` | `anc.ch10.relay-ask` (until), from beat entry | ch8-crossing DNA at 68 bpm, mirrored memory direction, density lowered, the dropped-step pitch riding in the sub the whole way | the errand made of the ch8 grammar (S3) | 0.34 at relay-ask | flight SFX lead as shipped ch8 |
| `sc.ch10.relay-answer` | `anc.ch10.relay-answer` (at, nested inside the ask's phrase) | **the pillar spend**: the answer figure enters on beat 3 of the ask figure's own bar — inside the question, same level, same timbre, no accent; its final tone fails to release and becomes the carrier | "too fast" as a metric fact (S2) | 0.36 | no sting, no hit; placement only |
| `sc.ch10.bearing-claimed` | `anc.ch10.bearing-claimed` (at) | at the next phrase boundary after the claim, the pad re-voices *around* the carrier — the foreign tone becomes a held color the chord accommodates | commitment sounds as the music making room, not as impact | 0.38 | caption/work-order clear lead |
| `sc.ch10.transit-hold` | `anc.ch10.transit-ignite` (at) | ch8 flight DNA (sawtooth, 68) with the carrier held; as distance closes, texture *thins* — no destination modulation exists | flying toward a place with no key | 0.42 | engine SFX lead as ch8 |
| `sc.ch10.seam-ebb` | `anc.ch10.seam-of-light` (at) | percussion/ostinato ebb to zero over a named slew; pad + sub + carrier only | the line with no body | 0.36 | image leads; score is floor |
| `sc.ch10.station-resolved` | `anc.ch10.station-resolved` (at) | at the phrase boundary: a second voice doubles the carrier at the octave, and the pad quotes the hearth's `[0,7,12]` cell once beneath it; **no mediant, no braam, no lead entrance** | K11's geometry: both fires in the voicing, a third light above | 0.44 (run max) | closing caption leads |
| `sc.ch10.threshold-release` | `anc.ch10.threshold-handback` (at) | carrier and mood release through named slews (SYMPHONY LAW §8.6); score recedes to the celestial idle bed via the shipped `setScoreBeat(null)` path | ch9's release discipline mirrored | parks at a named constant | bed resumes; no click |

## Per-beat intent

### ST-0 (prelude, inside `done` free play) — declared silence

**ST-0 receives no score presence of any kind this run, ever.** Not a pitch, not a
tick, not an intensity nudge. This is an authored decision, not a default: the dot
must belong to the world's sky, and the score's first acknowledgement of the station
must be *informational* (`anc.ch10.relay-answer`), matching the intent's three-stage
ladder — sight is free and unguaranteed, so sound may not tax it. `done` free play
stays exactly as shipped: generative bed, cueless, objective-less
(`shipped-visual-baseline.json#doneFreePlayStateTrace`). A player standing under an
ST-0 crossing hears their own home's night. That asymmetry — the sky changed and the
music did not notice — is the correct first wrongness, and it costs zero budget.

### ch10-cold — the hum drops a step

Base mood: `ch9-hearth`'s DNA (triangle, 56 bpm, pad-forward, sparse) — the home does
not hurry because it is failing. Three sub-states via the `emergentScoreDirector`
mood-override pattern (pure resolver from durable milestones, exactly the ch7 shape):

1. **cold-settled** (entry): hearth mood with melody density cut (~0.26 → 0.12) and
   the **whole-step floor drop** (`sc.ch10.cold-step`). A whole step, not a semitone:
   semitone is the shipped dread interval (ch4-vigil's flatted degree); this chapter
   has no antagonist, and the cold is subtraction, not menace. The chord reads as the
   same home over the wrong floor.
   *Encoding note:* candidate A — negative chord offset (`[-2,4,7,10,14]`) if
   `ScoreMood` degree math permits; candidate B — equivalent transposed voicing with
   the octave field. The acceptance criterion is the *measured* sub fundamental ratio
   (2^(−2/12) ≈ 0.891) in the A/B render, not the encoding; implementation picks
   whichever passes legality tests without touching `scoreEngine`.
2. **fault-read**: the square fifth under the triangle for the caption's breath.
3. **refused**: subtraction; melody never returns this beat. The beat exits quiet.

Entry continuity: cold-settled's baseline sits at/below the parked 0.28 so the story's
re-activation is *noticed, not announced* in the mix as well as in the fiction — the
bed→mood handover moves through the shipped mood-boundary slews only.

### ch10-ask — the crossing back, the ask, the early answer, the claim

**Crossing (S3 — restraint, no new theme).** `sc.ch10.crossing-back` is ch8-crossing's
grammar with exactly three authored differences, all inside the mood:
1. **Memory mirrored** — ch8-crossing held origin-world memory until the sibling was
   targeted; crossing-back holds Tidegarden's Mixolydian memory and lets the origin
   Dorian reassert on approach. Same shipped mechanism, opposite direction, authored
   in the progression order — no engine change.
2. **Colder** — melody density 0.32 → ~0.20, riser reduced; this is an errand with
   weight, not a discovery.
3. **The purpose rides in the floor** — the sub keeps ch10-cold's dropped-step pitch
   across the whole crossing: the reason for the trip travels with her.

**The ask/answer (S2 — the run's one pillar spend, and its bespoke mechanism).**
Nine chapters of this score have taught one conversational grammar: statement →
phrase gap → response (ch5-maw's call/answer is the shipped exemplar). At
`anc.ch10.relay-ask` the relay speaks in its own register: a two-bar quantized
square-fifth question figure. The answer (`sc.ch10.relay-answer`) enters **on beat 3
of the question's own first bar** — inside the phrase, before the question figure has
finished sounding. Same level, same timbre family, zero dynamic accent, no hit, no
sting: the *only* wrong thing is when. The wrongness is therefore a metric fact,
provable by onset measurement, and it lands for naive ears as "that was fast" and for
deduced ears as "it did not need to look." The answer figure's final tone does not
release — it hangs, and becomes the carrier.

**The claim.** `anc.ch10.bearing-claimed` is a rite the story waits on forever, so the
score may not build toward it (a build would count down; menace-by-procedure, not by
clock). When the player claims, the change happens at the *next phrase boundary*: the
pad re-voices around the carrier — the council treatment's "first accommodating
voicing," relocated from free play to the claim, where it is now an act the player
performed. No hit. Commitment sounds as room being made.

### ch10-transit — thinning toward a shape

`sc.ch10.transit-hold` reuses ch8 flight DNA (sawtooth, 68) under shipped ch8 vehicle
SFX priority. Two laws:
- **No destination modulation** (S5): the shipped `planApproachModulation` walk is for
  worlds with keys; the station has none this run. `storyLeads` stays true and the
  moods lead the bed; I author no station-key motion at T2/T3. As the station grows,
  the texture *thins* — Zimmer restraint: fewer voices as the thing gets bigger.
- **The seam is an ebb, not an event.** At `anc.ch10.seam-of-light` the rhythm section
  fades through a named slew to pad + sub + carrier. The signature image is a line;
  the score's version of a line is sustained tone with no pulse. No riser (the riser
  rail stays flat across the whole beat — audibly not-warp, provable in the render).

At `anc.ch10.station-resolved`: the octave double of the carrier (the pitch she has
carried since the answer is confirmed as sounding *from somewhere else*) over one
quotation of the hearth's `[0,7,12]` cell. No mediant (adopted from my own council
rule: awe says vast; this is a source). No lead entrance — the lead voice is withheld
from the entire chapter's destination; its first station entrance belongs to a later
run. If Cinematography takes the optional ≤3s thrust-cold hold, my phrase boundary
should share its anchor (peer note Q-CIN-2). Intensity peaks at 0.44 — smaller than
A4 by construction, verified against an a4-exhale reference render.

At `anc.ch10.threshold-handback`: `reset-score` releases everything through named
slews; the carrier **dies here** — it does not survive into free play (that is the
deferred packet's territory, untouched). Free play resumes on the bed exactly as the
ch9 seam did: released rail, intensity parked at a named constant, no residue. A
player who turns for home flies home in bed music with the station on the horizon and
no score memory of it — correct: the score knows the address, not the place.

## Era / REGULATION foreignness summary

The station's foreignness before it is named = three reuses, no inventions:
1. **Timbre:** the square wave (institution since ch1; ch4-arrival precedent).
2. **Pitch:** the carrier — legal ninth/sixth color to both home keys, chord tone of
   neither; ambiguity, never dissonance (my council risk control, now beat-bounded).
3. **Time:** REGULATION figures quantized dead-on-grid against the world's seeded
   humanize — machine punctuality as the sound of elsewhere. The relay answering
   early is this law at maximum: the institution is not just on time, it is *ahead of
   time*.
No warp scale, no loudness, no new instrument. Scale restraint holds: nothing in ch10
may out-measure an awakening.

## Motif continuity ledger

| Material | Disposition |
| --- | --- |
| `sc.hearth.between-fires` voicing `[0,4,7,10,14]` + closing cell `[0,7,12]` | **Carries**: degraded in place at ch10-cold; quoted once at station-resolved. The shipped cue itself is untouched. |
| WRECK RELAY / REGULATION square fifth `[0,7]` (ch1, ch4-arrival/audit) | **Carries**: builds the fault-ledger, refusal, and ask/answer figures. |
| ch8 flight moods (launch/crossing DNA) | **Carries**: crossing-back and transit-hold derive from them; grammar unchanged, direction and density re-authored. |
| ch8's destination-key modulation | **Withheld** — the station has no key this run. |
| Station theme / station tonal identity | **Withheld** — unspent inventory for run two. |
| Lead voice at the destination | **Withheld** — no lead entrance anywhere in ch10-transit. |
| Menace color, mediant, braam, warp BUILD/riser/half-time flip, W-7744 cell | **Forbidden** (intent + lock; A5 owns warp). |
| ST-0 acknowledgment in any register | **Forbidden forever this run.** |

## Mix and performance plan (inside the protected engine)

- **Zero edits under `main/src/audio/`**, `main/src/components/audio/`,
  `main/public/audio/`. Realization surface, complete list:
  1. `main/src/story/storyScore.ts` — three new `MOODS` entries (`ch10-cold`,
     `ch10-ask`, `ch10-transit`) + ch10 variant mood tables, additive only; the
     frozen `ScoreMood` schema is untouched.
  2. `main/src/story/emergentScoreDirector.ts` (+test) — extend `OWNED_BEATS`
     with the ch10 beats and add pure, reload-safe resolvers from durable milestones
     (fault-read / refused / post-answer / claimed / seam-passed), exactly the
     `resolveChapter7ReconstructionScoreVariant` shape. ch7 behavior regression-locked
     by the existing tests plus new ones.
  3. `main/src/story/signedSceneAvRuntime.ts` + `generatedSceneAvRuntime.json` — the
     eleven signed cues above with anchor relations and the intensity ladder;
     `scoreIntensityFor` (line 349) is the single authority for every intensity claim.
- **State discipline:** no new save fields. Carrier presence = f(beat, milestone);
  variant = pure resolver; a mid-transit reload re-establishes the carrier through its
  named slew (SYMPHONY LAW — no audible step, no click; `linearRamp`/`setTargetAtTime`
  only, which the mood boundary already guarantees).
- **Main-thread budget:** no new nodes, no per-frame churn — everything is
  `setScoreMood`/override traffic on the shipped persistent voices.
- **Combined-bus honesty:** K1's "hum" is proven on the combined bus (score sub +
  any diegetic core SFX together), never score-solo, per the audio-evidence law.
- Every new number (drop interval, ebb slew seconds, carrier level, intensity ladder,
  answer-entry beat offset) is a named constant grouped for owner retuning.

## Evidence plan (lean budget — every deliverable named)

All deterministic (seeded, OfflineAudioContext through the shipped offline-chain
mirror), run by `story-verifier`; no realtime soak, no 60-minute anything.

| # | Deliverable | Proves |
| --- | --- | --- |
| 1 | `evidence/score/ab_cold-entry_A-hearth-close.wav` + `ab_cold-entry_B-ch10-cold.wav` + `ab_cold-entry_measure.json` | S1: sub-band fundamental ratio ≈ 0.891 (−2 semitones), upper voices held; A = shipped ch9-hearth mood (also the regression reference) |
| 2 | `evidence/score/relay-answer_metric.wav` + `relay-answer_onsets.json` | S2: answer onset = question onset + 2 beats, question still sounding; comparison onset table from a ch5-maw render showing the shipped ≥1-bar call/response gap |
| 3 | `evidence/score/carrier-legality.json` | pure-core log: carrier pitch class is a color tone of both home keys and a chord tone of neither across every chord the ch10-ask/transit moods can publish; zero legality violations over beat-bounded renders (~5 min per beat, offline) |
| 4 | `evidence/score/transit_seam-ebb_combined.wav` | combined-bus excerpt across `anc.ch10.seam-of-light`: rhythm voices ebb through the named slew; riser rail flat for the whole beat (audibly not-warp) |
| 5 | `evidence/score/station-resolved_combined.wav` + `resolved_vs_a4_rms.json` | octave-double at the phrase boundary; peak intensity 0.44 via `scoreIntensityFor`; RMS strictly below the a4-exhale reference render |
| 6 | `evidence/score/regression_ch1-ch9_moods.json` | `getStoryScoreMood` snapshot for every shipped beat byte-identical pre/post; `MOODS` diff additive-only; ch9-hearth offline render hash unchanged (deliverable 1's A-side doubles as this) |
| 7 | `evidence/score/handback_release.wav` | carrier + mood release at `anc.ch10.threshold-handback`: max inter-sample step under the click threshold; bed resumes; intensity parks at the named constant |

Unit tests: ch10 resolver determinism + ch7 non-regression in
`emergentScoreDirector.test.ts`; mood-table legality (chord/pattern/scale sanity) in
the storyScore test seam. Owner audition after verifier pass, per workflow.

## Answers S1–S5

- **S1 — yes, keep K1.** The hum-drop is realized literally: the sub root falls a
  whole step at the first phrase boundary after `anc.ch10.cold-noticed`, upper voices
  held. Interval choice: whole step (semitone = the shipped dread interval; this is
  subtraction, not menace). Proof is deliverable 1's measured A/B ratio on the
  combined bus. If the measured delta is not audible at the LOW-tier mix, I will
  report it honestly and K1 gets re-cut — the copy will not claim what the mix
  doesn't do.
- **S2 — yes, metric and provable.** The answer enters on beat 3 of the ask figure's
  own bar — inside the question's phrase, same level, same timbre, no accent, no hit
  type. The shipped score has spent nine chapters teaching call → gap → response;
  omitting the gap is the entire event. Deliverable 2 measures it against the ch5-maw
  reference. The score also matches the caption law: `sc.ch10.relay-answer` is
  anchored `at anc.ch10.relay-answer`, which the intent nests inside the ask's own
  breath — the relationship is the meaning, and no timeline gap exists for me to fill.
- **S3 — restraint, three differences, no new theme.** Crossing-back = ch8-crossing
  grammar with (1) memory direction mirrored, (2) density/riser lowered, (3) the
  dropped-step pitch held in the sub the whole way — the need travels with her. That
  third item is the only addition, and it is a continuity device, not a theme.
- **S4 — I take the down-payment, bounded, and here is why it strengthens rather
  than cheapens.** The carrier pitch is born at `anc.ch10.relay-answer` as the answer's
  unreleased final tone, persists through the claim and all of ch10-transit, and dies
  at `anc.ch10.threshold-handback` with `reset-score`. No free-play pedal, no soak
  obligation, no engine change — it is a held chord-color inside the moods. Pitch is
  chosen as a legal ninth/sixth color of both home keys and a chord tone of neither
  (my council risk control, now cheap because the exposure is beat-bounded: the
  legality proof is deliverable 3, minutes not hours). Dramaturgically the bounded
  version is *better* than the original thesis for this run: the carrier starts at
  the exact moment the network speaks, so its meaning is authored — naive: a radio
  carrier after a transmission; deduced: her own line, once used, never stops being
  hers. If the owner later approves the packet, the pedal extends an *established*
  color backward into free play instead of arriving orphaned. If the packet is never
  approved, ch10 is complete without it.
- **S5 — confirmed, both halves.** No `carrier-acquired` free-play state is used or
  wanted; the carrier is score-relevant only inside ch10 beats (S4). And I author
  **no approach modulation** at T2/T3: `storyLeads` stays true, the moods lead the
  bed, and the station keeps no key this run — its tonal identity is unspent
  inventory I am deliberately banking for the apron/counter runs. This is stated here
  as the contract commitment the intent asked for.

## Peer constraints and questions (draft for `score-peer-notes.jsonl`)

**To Chapter:**
- **Q-CH-1 (top):** K1 says "dropped a **step**." My realization is a whole tone in
  the floor voice. Confirm the copy's "step" tolerates whole-tone precision (it reads
  naturally to me), and confirm the K7→K8 caption paint can tolerate the answer
  figure sounding at ask + 2 beats — the audible answer must not arrive visibly
  *before* K8's paint begins, or the sound scoops the text. If caption timing is
  driven off the same anchor, we are already aligned; I only need that confirmed in
  the contract.
- Q-CH-2: does the habitat core have (or gain) a diegetic hum SFX this run? If yes,
  the "step" must not be double-attributed — I'd want the SFX static and the pitch
  move to live in the score, proven on the combined bus. Routed to Integration if the
  SFX lane owns it.
- Constraint honored, restated: one enter-cue per objective activation, completion
  acknowledged by the shipped grammar; no score acknowledgment of ST-0 in any form;
  `station:bearing-claim`'s indefinite wait receives no build, ever.

**To Cinematography:**
- **Q-CIN-1 (top):** `anc.ch10.seam-of-light` triggers my only texture event in
  transit (the ebb). If the seam threshold constant is framing/subtense-tied (their
  C3), I need the anchor to fire **once, monotonically, with hysteresis** — a
  re-crossing flicker would pump the ebb slew audibly. Can they guarantee that in the
  contract?
- Q-CIN-2: if they take the optional ≤3s thrust-cold hold at
  `anc.ch10.station-resolved`, anchor the hold's start where my phrase boundary lands
  so the engine-quiet and the octave-double are one shared silence-then-sound, not
  two staggered events. If they decline the hold, my cue stands alone unchanged.
- Constraint honored, restated: no galaxy in frame means no warp grammar in score —
  symmetrical restraint; and ST-0's bearing/ground-track agreement is theirs, with the
  score contributing nothing to ST-0 by design.

## Non-goals

Station theme or station key; any free-play carrier/pedal and the 60-minute soak
(deferred packet, untouched); audio-at-the-station (dies at the page swap, deferred
with docking); warp grammar (BUILD, riser, half-time flip, exit boom — A5's); new hit
types; braam or mediant anywhere in ch10; any edit under the protected audio paths;
AudioWorklet; changes to shipped ch1–ch9 moods, cues, or `sc.hearth.between-fires`;
any ST-0 acknowledgment; any Worker 9 or W-7744 musical material; realtime soak
evidence of any duration.
