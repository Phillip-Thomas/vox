# story-intent.md — Paravoxia audio-system overhaul (run 2026-09-04-audio-10x)

Author: Chapter Director. Status: first deliverable; not a patch. Governs the
narrative and player-agency contract Score and Cinematography honor while
implementing `PARAVOXIA_AUDIO_10X_PLAN.md` Stages 1–6. Owner decisions in that
plan's §6 ("Decisions taken") are binding here and are not re-litigated.

Authority note. `production-lock.md` in the run folder is still the template.
This intent assumes the lock will record runtime mutation permitted for
`main/src/audio/`, `main/src/components/audio/`, the eleven story call sites,
and `story/ux/feedbackCues.ts`, per the owner's 2026-09-04 delegation. If the
lock closes narrower, every ruling below that touches a locked path becomes a
proposal, not a contract term. Line numbers below are the live working tree;
the commission's numbers are +33 stale in `storyDirector.ts` (813→846 etc.).

## 0. Governing thesis

Rendering fidelity is the narrative, and sound is rendering. Every stage must
be readable as the same ladder the eye already climbs: bare → colour →
material → alive → paradox, gated by the same `eraGates` the bed uses, never by
beat id. The hidden pillar (the narrator is the route intelligence) is planted,
never told; nothing in this overhaul may resolve which reading is true. The
consciousness result stays additive. No copy changes.

## 1. Affected beats and what constrains the sound

Stage 1 (bed timbre/mastering) touches every embodied free-play beat
(`ch3-thirst`…`ch9-hearth`, `done`, ch10 free play) and every beat where the
mood hands back to the bed. It must be inaudible at `bare` and `colour`: the
prologue and ch1 (`crawl`…`ch1-lift`) are PSG; `ch2-*` is NES-trio. Drive,
unison width, octave doubling and room are *earned* at material (A3) and
alive (A4). The EARLY-LADDER CALM LAWS in `storyScore.ts:16-24` (sub ≤ 0.10,
three rests per bar, ≤ 112 BPM before A2) are canon, not taste.

Stage 2 (game mix) touches everything; its narrative constraint is that
authored quiets are subtractions and may not be filled: `ch4-defy` (baseline
0.1, `storyScore.ts:82`), `ch10 refused`/`seam-ebb` (`:177,:241`), the "no."
moment (`emergentStoryDirector.ts:927-931`, `setScoreIntensity(0)`), and the
musing lulls (`storyDirector.ts:1773-1775`). Ruling #4 of `PARAVOXIA_SCORE.md`
(no true silence, always a quiet bed) stands; the limiter, duck matrix and
planner never raise a floor the composer lowered.

Stage 3 (composed sync / one tonic / MOODS-as-constraints) touches the eleven
hits and every MOODS entry. What the era ladder means at each rung, which the
voicing brain must preserve: `bare` — one voice, one interval, "density is a
privilege the ladder has not yet issued" (`:36-38`); `colour` — a second voice
and the first progression; `material` — warmth earned, minor lifting to its
relative major (`:59`); `alive` — the full chord opening one member at a time,
"an ecosystem arriving, not a victory fanfare" (`:83-85`). Dramatic anchors the
brain may re-voice but not re-mean: the unresolved semitone (`ch1-anomaly`,
`crash`, `descent`, `ch4-audit`), the ch4 SQUARE-WAVE return as a foreign body
(`:73-75`), the whole-step dropped floor of ch10 (`:154-156`, explicitly *not*
a semitone because "this chapter has no antagonist"), and the carrier (§2).

Stage 4 (spatial/varied SFX, feedback coverage) touches all embodied play and
the prologue terminals. Stage 5 (long form, sidechain) touches only bed-led
free play. Stage 6 (voice) touches every REGULATION text surface: crawl,
manifest, voyage ledger, deflection HUD, terminal prologue/corruption, the ch1–
ch2 feed, ch3-signal carrier lines, ch4 audit band, ch10 relay, station text.

Pillar-load-bearing beats that constrain all six stages: `crawl`/`manifest`
("route intelligence attends every transit", "ATTACHED (ADVISORY)",
`storyScript.ts:65,93`), `voyage` (parenthetical intrusions), `crash`
("ADVISORY CAPACITY EXCEE", `:363`), `ch1-lift` ("i—"), the post-lift feed
("PERSPECTIVE ISSUED. THE FIRST PERSON WAS NOT.", `:439`), `ch4-defy`, and
ch10 `relay-answer` ("a VOICE ARRIVING inside the question", `storyScore.ts:206-209`).

## 2. Stage 3 rulings — the eleven hits and the tonic

General law. State is never delayed for sound: milestones, `advanceToBeat`,
commits and receipts fire when the director decides. What may move is the
*presentation bundle* (hit, SFX, flash/glitch, caption, stage cut), which
chases the returned `audioTime` as one unit. For authored timelines the
preferred implementation is to schedule at beat entry so the timeline's named
constants bend to the grid ("the cutscene is composed to the bar"), within the
stretch bounds below. When the transport offers no time, fall back to
immediate exactly as today. "Beat" below means the mood's own tempo.

| Live site (commission #) | Beat / anchor | Ruling |
|---|---|---|
| `storyDirector.ts:846` (813) | `ch1-track` entry: the unbolt. `'bloom'` | Quantize `'beat'` (72 BPM), max +450 ms. The camera unbolt start chases audioTime. Player-caused (fixed cells complete), so no longer than one beat. |
| `:1233` (1200) | `a1-ramp` lands on `color`, → `ch2-color`. `'bloom'` | `'beat'` (96 BPM), max +400 ms, pre-scheduled at a1 entry so `A1_RAMP_SECONDS` stretches to the grid. Chroma landing (`desat=0`, stage cut) chases audioTime. The image owns this awakening; the bloom may not lead it. |
| `:1292` (1259) | `a2-awakening`, liberation start: "the wall of the feed gives way." `'braam'` | `'beat'` (132 BPM), max +450 ms; pre-schedule at a2 entry. FOV liberation onset chases. The HUD death (k>0.55) is already past; the braam must not fall before it. |
| `:1314` (1281) | a2 handoff → `ch3-gather`. `'bloom'` | `'beat'`, max +450 ms. Handoff bundle (look mode free, dpr, treatment 0) chases as one unit. |
| `:1362` + `:1363` (1329/1330) | `descent` impact. `'boom'`+`'braam'` | One onset, same audioTime; never split. Pre-schedule at descent entry; `DESCENT_IMPACT_AT` may move later by ≤ +400 ms, never earlier (the fall must read for 4.5 s). Flash, glitch, `shipCrash` chase. |
| `:1434` (1401) | `ch1-lift` mid-lift DPR snap: "perspective is being issued." `'braam'` | `'beat'` (84 BPM), max ±400 ms of the snap time, pre-scheduled at lift entry. The glitch exists to mask the framebuffer snap, so glitch + `storyGlitch` + `setStoryTargetDpr(null)` + braam stay simultaneous with each other, chasing audioTime together. |
| `:1741` (1708) | `a3-dawn` first blade: the bloom wave starts. `'bloom'` | The chapter's peak. `'bar'` (88 BPM, ≤ 2.75 s) permitted only because the hold before it is authored as a hold: `bloomWaveDelaySeconds` may stretch to the bar, never shrink (the grain captions must land first). Wave front (`setLifeReveal`) chases audioTime. |
| `:1760` (1727) | a3 lands on `material`, → `ch3-thirst`. `'bloom'` | `'bar'`, ≤ 2.75 s; the gate is a floor, not an instant. Stage cut and `clearLifeReveal()` stay simultaneous (else a pop) and chase together. |
| `signedSceneAvRuntime.ts:445` | `ch5-maw` `anc.maw.repair-committed`. `'bloom'` | `'beat'` (70 BPM), max +450 ms. The receipt/commit is immediate; only the Maw's audible/visible "answer" may take a breath. Un-stung first direction (`:435-440`) is canon: no hit may be added there. |
| `emergentStoryDirector.ts:941` | `a4-exhale` life front. `'bloom'` | `'beat'` (66 BPM), max +900 ms. `commitA4Alive` immediate; `storyAwaken`, caption and `lifeProgress` origin chase as one bundle. Must remain a bloom, never a braam: this is arrival, not victory. |

Never quantize: oxygen pulses (protected body clock), `terminalAlarm` klaxons
and violation floods (REGULATION is machine time, not musical time), any
player input acknowledgement (§3).

Tonic. Default `tonicPolicy: 'live'` is accepted with one narrative
qualification: what the ear must keep is *interval identity within a chain*,
so the live tonic is read once at chain entry and held until the chain exits
to bed-led free play. Pitch-locked chains: `crawl`…`a1-ramp` (the seeded
planet key, planted before the planet is seen); `ch2-color`…`a2-awakening`;
`ch3-dusk`/`ch3-await-rest`/`a3-dawn`; `ch4-vigil`…`a4-exhale` (the "detuned
await-rest" and the returning square cell must not re-transpose between
beats); `ch7-reconstruct`/`ch7-board`; ch10 entire. `ch8-crossing`'s comment
(`storyScore.ts:99-101`, origin key held until the sibling is targeted, then
the bed walks to Tidegarden) is protected intent that Stage 3 implements, not
overrides. Absolute pitch across a game-hour of free play is not protected.

ch10 is `'absolute'` in the plan's sense with this precise meaning: the tonic
is read once at `ch10-cold` entry; from `relay-answer` the carrier
(`CH10_CARRIER_DEGREE`, `:279`) is a fixed frequency that survives every
variant, beat boundary and mid-transit reload until `station-resolved` doubles
it. The station has no key (`:141-145`); the brain may not "resolve" it, and
`getChapter10ScoreMood`'s octave-double filter (`:289-313`) is canon.

MOODS-as-constraints: every entry's pitch-class set must be present (plan
asserts this); additionally, chords written as *subtraction* (`ch4-comply`
`[[0,6],[0,1]]`, `refused`, `seam-ebb`) may not be re-voiced fuller than
written, and `a4-exhale`'s one-member-at-a-time opening must remain ordered.

## 3. Stage 4 — feedback lifecycle and per-verb contract

Lifecycle events (bind to `GuidedStoryObjective.id`, `objectiveDirector.ts:10-21`):

- `objective-enter` — exists (`feedbackCues.ts:19`). Once per ID per session.
  It is an acknowledgement of a *task issued*, so its sound stays in the
  REGULATION family even after the feed dies: the route intelligence still
  attends. Score may re-voice it per era; Chapter keeps its meaning.
- `objective-progress` — once per counted unit change, monotone, only from
  durable progression state. Never on reconstruction.
- `objective-complete` — a promise. Fires only when the ID clears *because its
  defining progression state was satisfied*; never on beat-transition clear,
  replace, deep-link seeding, `?story=` jumps, or resume. A beat that
  advances without satisfying the objective plays no completion.
- `objective-fail` — only where an authored failure with a rescue exists
  (`ch6-dive` oxygen critical, `blocked` is *not* a fail). Never for a timeout
  rescue in movie mode.
- `marker-acquired` — on health `missing-marker → ready`. UI, centred: the
  marker is guidance, not a thing in the world; spatializing it would claim the
  world itself is speaking, which the pillar keeps open.

Visual parity is intrinsic for all five (work-order line change, count, strike/
clear, marker appearance); Cinematography confirms each is same-frame.

Per-verb coverage and meaning (world/player buses may spatialize; UI/voice stay
centred and dry):

- `mine` — extraction, the institution's verb. Spatialized at the block; era-
  laddered (bare: one click; material+: material-keyed body). Round-robin
  siblings allowed.
- pickup/forage (`ForageField`, `LooseStoneField`, `supplyPods`,
  `debrisSalvage`) — the first non-quota verb (ch3): warmer than `mine`,
  spatialized at the item.
- `blocked` — the world or the frame refusing. Distinct from `mine`; not a
  failure cue; positioned at the blocked face.
- footsteps — the body. None before `ch1-lift` (the worker is observed, not
  inhabited); from embodiment on, identical on every surface until `material`
  (texture is earned at A3, in the feet as in the eye). Body sounds (steps,
  jump, land, jetpack, oxygen) are the listener and are never spatialized.
- ship — `diegetic-ship` bus; interior room while boarded. The `descent`
  `shipCrash` is centred: the raster era has no stereo field.
- hatches/doors, station hum — station room; non-tonal, or tonal only on the
  carrier pitch class (Score decides), because the station has no key.
- terminals (`terminalKey/Advance/Alarm/Corrupt`), `storyGlitch/Awaken/Sleep`
  — UI/narrator: centred, dry, *no per-trigger variation*. Variation belongs to
  the world; REGULATION keeps uniform velocity and zero drop (`storyScore.ts:148-151`).
  `storyAwaken` may evolve deterministically by era, never by seed.
- oxygen — protected as shipped.

Spatial width is itself a fidelity gain and follows `eraGates`: `bare` mono
centre; `colour` pan only; `material` pan + distance filter; `alive` room.

## 4. Stage 6 — the narrator's voice

Which surfaces speak: REGULATION-register text on terminals, the feed, the
audit band, the ch10 relay and the station's text panels. One institutional
formant table seeded from the run seed, used from `crawl` to `station-resolved`
without exception — the relay answer must be *the same voice* the player has
heard since the deployment notice; that continuity is the pillar spend, and
the answer must begin before the ask's last syllable, as the score already
does. Station vendors speak through the same chain with distinct seeded
tables; the ladder is perceptual, so every speaker climbs it together.

What the voice must never do: speak any lowercase caption (the awakening
voice is the player's interior — voicing it in the terminal's timbre would
tell); speak the parenthetical intrusions, the musings, or "i—"; sound like a
person (no gender, accent, affect, breath, or question-prosody; fidelity
rises, warmth does not); speak text not on screen; speak during "no."/`ch4-
defy`, `seam-ebb`, the awakening ramps, or under oxygen in `ch6-dive`.

Ladder: source stays PSG/square-derived at every rung (the ch4 and ch10
square-wave dramaturgy depends on it); bandwidth and grain climb with the
world's reality stage, not the beat: `bare` one blip per character, `colour`
two-pulse formant pairs, `material` granular, `alive` smooth grains through
the radio comb. Pitch classes snap to the published chord an octave above the
pad (plan §5) — accepted, with the ch10 constraint that the relay voice may
land on the carrier pitch class.

Captions/parity, required: every voiced line is its own caption (already on
screen); `terminalAlarm` → violation-band/klaxon flash; oxygen pulse → HUD
breath indicator; `storyGlitch/Awaken/Sleep` → existing glitch/fade (verify
same-frame); `shipCrash` → flash; hatch → iris; all five lifecycle cues → HUD
state. Accessibility promise: no information exists only in audio. A
"sound captions" setting renders bracketed cue captions in a registered HUD
surface (`hudSurfaces.ts`, swept). Their vocabulary is UI, minimal, and
copy-adjacent: it needs an owner decision and the both-readings test
("[alarm]" yes; anything naming a speaker, no).

## 5. Before/after, non-goals, protections, questions

Before → after, one line per stage. 1: a correct chord on a bedroom synth →
the same chord with weight, felt as the planet's. 2: music with effects
beside it → one soundtrack where a stone landing is heard against the bed.
3: awakenings that land near the music → awakenings the music lands. 4: a
world that sounds the same everywhere → a world that sounds *where* and *of
what* it is, and only as finely as the eye can see it. 5: a bed that
repeats within the hour → an hour that was composed. 6: a silent institution
→ an institution that speaks in the fidelity you have earned, and never says
who it is.

Non-goals: no copy changes; no beat reordering; no new story content or
surfaces; no demo release-surface change; no new save fields; no objective ID,
marker label or work-order change; no autopilot flow change; no TTS; no
resolution of the pillar or the third-consciousness questions.

Protected strengths carried into the contract (both audits' protect lists
plus): harmony-brain legality; SYMPHONY LAW slews; era instrumentation ladder;
world-clock tick; ch10 carrier design and octave-double filter; oxygen non-
quantization; `sfxRateLimiter` thresholds; audioCore topology, iOS route,
unlock; frozen story score contracts and MOODS authorship; the calm laws; the
"score never leaves, it recedes" hand-back; every authored subtraction named
in §1; the un-stung first direction at the Maw; recipe-identical SFX per the
owner's decision.

Questions for Score: can `eraGates` drive SFX width/room as in §3 without a
second gate system? Under `tonicPolicy 'live'`, how is a chain's held tonic
recorded so a mid-chain reload re-derives it (zero save fields)? Does the
descent double hit survive as one scheduled onset? May the a2 violation flood
be *voiced* as garble decaying into the noise floor — the HUD death made
audible — or is that a new surface? Does the relay-answer overlap survive the
typewriter-cadence rule?

Questions for Cinematography: which bundles chase `audioTime` (all eleven, or
only the awakenings)? Is a ≤ 2.75 s bar-stretch of the a3 wave delay
acceptable to the captions' landing? Confirm same-frame parity for every cue in
§4, and design the ch6 breath indicator and the sound-caption surface within
the overlap invariant. Do the room presets (plain/cave/interior/underwater/
station) agree with the reality stage — i.e. does `bare` truly show no room,
and does the station read as keyless in image as in sound?

## 6. Grounding and the dramatic contract (index)

Grounding. This intent is grounded in shipped runtime, not in wish: the era
ladder and `eraGates` (§0), the EARLY-LADDER CALM LAWS at
`storyScore.ts:16-24` (§1), the eleven live cue sites with their file and line
anchors (§2), the shipped feedback seam at `feedbackCues.ts` (§3), the shipped
REGULATION text surfaces (§4), and the shipped protections listed in §5. Every
ruling above cites the line it binds; nothing here asks for a system that does
not exist except where §3 and §4 name the additions explicitly.

Dramatic contract. What the player must feel, stage by stage, is written in §5
as one before-and-after line each; what may never change is written in §5 as
the non-goals and the protected strengths. The binding terms of that contract:
state is never delayed for sound; the presentation bundle chases `audioTime` as
one unit; no stage raises a floor the composer lowered; the hidden pillar is
neither resolved nor told; no shipped copy string moves.
