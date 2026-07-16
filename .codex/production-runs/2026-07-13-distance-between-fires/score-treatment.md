# Score Treatment — The Distance Between Fires

Author: Independent Score Director  
Status: ready for cross-notes  
Prepared independently from the Cinematography Director's first treatment: **yes**. The cinematography treatment was not read before this score treatment was completed.

## Grounding and thesis

- **Story-intent revision:** `intent-v1`, source revision `3d68948c18c7c362abb4ec66b74ff1c685bf2d1f+working-tree-20260714T003216Z`.
- **Scope:** the shipped `anc.audit.arrival-handback` through `anc.hearth.freeplay-handback`, covering all thirteen locked beats: `ch4-audit`, `ch4-comply`, `ch4-defy`, `a4-exhale`, `ch5-maw`, `ch6-dive`, `ch7-reconstruct`, `ch7-board`, `ch8-launch`, `ch8-crossing`, `ch8-landfall`, `ch9-settle`, and `ch9-hearth`.
- **Baseline note:** no `visual-baseline.md` exists in this run or elsewhere under `.codex`; the available machine baseline is `shipped-visual-baseline.json`. It proves the 1280×720 HIGH-tier arrival handback, 50° player-camera authority, the origin-alive palette family, and no audio stream. Therefore the incoming sound is grounded in shipped code, score tests, current WAV evidence, and the score architecture document—not inferred from the silent video.
- **Publication:** forbidden. This treatment is an implementation contract candidate, not release approval.

### Shipped cue, motif, and runtime references

- `main/src/story/storyScore.ts`: the shipped `ch4-arrival` mood is the exact incoming musical state—A-rooted open fifth/major-color voicings, 60 bpm, square-wave ostinato beneath warm full-era voices. `MOODS`, `setScoreBeat`, `setScoreIntensity`, and the story façade remain the score-content authority.
- `main/src/audio/scoreEngine.ts` (**protected**): the one story instrument and its existing public surface: `setScoreMood`, `setScoreIntensity`, `scoreHit`, `scheduleHit`, story/bed authority crossfade, planet-genome filtering, era-aware voices, and pitched hits. It is not to be edited.
- `main/src/audio/bedEngine.ts` (**protected**): the existing sandbox/world-bed renderer, shared transport, persistent voice graph, and story-authority yield. It is not to be edited.
- `main/src/audio/generative/bedConductor.ts`, `motif.ts`, `harmonyBrain.ts`, `approachModulation.ts`, and `worldSignals.ts`: permitted pure-planning seams for destination-profile routing, counterline planning, and story-authored requests that render through the already shipped bed graph.
- `main/src/audio/musicDirector.ts` and `main/src/components/audio/AudioDirector.tsx`: scene ownership, texture-stem mix, underwater filtering, canonical planet configuration, destination signals, and the continuous world snapshot.
- `main/src/story/storyDirector.ts:tickArrival`: the shipped arrival ends with the score at a 0.35–0.80 intensity envelope, W-7744 physically present, first-person handback, and then temporary completion. The continuation must replace that temporary terminal without restaging it.
- `main/src/story/emergentStoryEvents.ts`: typed, idempotent facts are the only musical punctuation source. Audit/refusal/A4/hearth event types named in `story-intent.md` must join this boundary; no cue may scrape copy, UI state, inventory polling, or camera state.
- `main/src/game/systems/shipRestoration.ts`: monotonic ship stages and the atomic `flight_ready`/Tidegarden-route commit. Stage score reconstruction derives from this state; it gets no parallel score save field.
- `main/src/story/sceneAvCueRail.ts`: shared anchor time is the AV synchronization authority. A visual may chase the exact `scheduleHit` audio time; score does not chase an unsynchronized visual callback.
- `PARAVOXIA_SCORE.md`: the binding score grammar—one AudioContext, one instrument, seeded motif memory, slow modal harmony, named slews, no loops as composition, a never-silent floor, world-signal causality, and no uncomposed discontinuities.

### Current deterministic musical identities

These values are evidence from the current resolved profiles and pure conductor. Consumers must receive them from canonical world/profile authority; they must not copy them into a second unversioned table.

| World | Canonical identity | Current resolved musical identity | Motif DNA |
| --- | --- | --- | --- |
| Origin | `-1,-1`, seed `3215739679`, profile `procedural@1`, current hash `pf1-3ae4c043` | B Dorian, 77 bpm, 4/4 | contour `-1,+3,-4,+3`; `CELL_CINQUILLO`; third → root |
| Tidegarden candidate | `-1,-1:p1`, seed `1600321158`, profile `story:tidegarden@1`, current hash `pf1-eeef3b78` | C Mixolydian, 81 bpm, 4/4 | contour `+3,-1,+3,+1,+1`; `CELL_GALLOP`; fifth → root |

The final Tidegarden name and owner taste approval remain open. If the profile changes, the profile hash and this evidence table must be regenerated together. Packet 3 must pass the canonical sibling seed/archetype/profile into the approach signal; the current generic coordinate-derived destination seed is not sufficient for a same-system `p1` body.

### Incoming and outgoing continuity

- **Incoming:** inherit the exact `ch4-arrival` score state at `anc.audit.arrival-handback`. Do not restart the bar, replay a bloom, or replace the square-wave fifth. The returned regulated voice sits *inside and beneath* the living origin arrangement.
- **Story ownership:** Story Score leads from `ch4-audit` through one post-exit release bar in `ch8-launch`. It progressively revoices the same musical material rather than presenting nine unrelated tracks.
- **World ownership:** after the legal atmosphere-exit event, Story Score calls `setScoreBeat(null)` and yields over the shipped 4.5-second complementary crossfade. The origin bed owns the deep interval. The destination bed owns approach, landfall, settlement, and normal free play.
- **Authored overlays after yield:** crossing and hearth requests are pure event plans folded into the existing bed conductor's note arrays. They never reclaim protected Story Score ownership, never interrupt destination modulation, and allocate no parallel audio graph.
- **Outgoing:** `anc.hearth.freeplay-handback` clears every story cue owner and leaves the normal canonical Tidegarden bed leading. Both motif genomes remain available as remembered route material, but no completion cadence, A5 teaser cue, or lingering story intensity owner survives.

### Emotional-musical thesis

The score begins as a living world forced to carry an obsolete square-wave order, lets obedience remove the world's musical dimensions, then revoices that same interval through breath, metal, body, ship, distance, and shelter until two distinct planetary motifs can share a room without either becoming the answer.

### Why this belongs to Paravoxia

This is not a generic “sad-to-triumphant” arc. Reality-stage instrumentation, a returned chip voice, planet-seeded motif DNA, world-signal harmony, an oxygen clock that contradicts musical time, and a repaired instrument whose purpose remains unresolved are all shipped Paravoxia grammar. The decisive gestures are subtraction, revoicing, transfer of authority, and remembered relation—not new samples, franchise-style themes, victory stingers, or a cinematic orchestra laid over play.

## Harmonic, motif, and sonic language

### Harmonic authority and A5 reserve

1. **Story harmonic center:** `ch4-arrival` supplies the A-relative story center and its open fifth. Audit through launch stays related to that inherited center. It does not jump prematurely to the origin bed's B-Dorian sandbox key.
2. **Modal vocabulary:** open fifths, Dorian sixths, suspended seconds/fourths, add9s, plagal neighbors, and slow minimal-motion changes. No functional dominant seventh, V–I victory cadence, full Ionian home, heroic tonic pedal with major triad, or interstellar-warp rise.
3. **A4 apex:** A4 may use the widest stack in this scope, but its governing sonority is the quartal/Dorian set `[0,5,9,14]`, not a resolved major tonic. Its bloom opens perception rather than declaring conquest.
4. **Ship resolution:** route/calibration coheres the available layers over `[0,5,9,14]` and `[0,7,9,14]`; the last tone remains suspended. Ignition adds kinetic agreement, not harmonic finality.
5. **World-bed transfer:** deep space returns to the origin's canonical B-Dorian bed. The approach walks toward the resolved Tidegarden candidate's C-Mixolydian key only after legal targeting and only within the existing modulation budget/guard.
6. **Hearth relation:** both genomes are rendered on the destination harmony through separate contour/rhythm identities. The possible third relation uses only shared-safe tones and contrary motion; it is not a third named theme and makes no claim about communion or authorship.

### Motif ledger

| Motif | Identity | Development law | Narrative use |
| --- | --- | --- | --- |
| `Q — issued purpose` | dry square-wave root/fifth `[0,+7]`, even or half-time | lose notes before gaining them; later revoice the same pitch relation in triangle, metal, sub, and engine timbres | W-7744, compliance, inherited machinery; always beneath the living/world material once A4 begins |
| `O — origin remembered` | origin genome contour `-1,+3,-4,+3`, `CELL_CINQUILLO`, third → root | fragment, augment, register-displace, then transpose through legal approach pivots; contour/rhythm memory survives key change | A4 life field, water sub-melody, repaired ship route, deep-space home, hearth counterline |
| `W — body/old trace` | two very quiet square pulses `+1 → 0`, dry, 80–140 ms each | never expanded into a melody, never paired with explanatory dialogue, used at most twice in this scope | hidden Maw catch and one late oxygen-pressure moment; equally readable as alarm, training, or Worker 9 trace |
| `K — keel/sonar` | `Q` stretched into descending `[+7,+2,0]` calls with long gaps | high voices fall away underwater; sub carries the response; pickup does not complete the phrase | Maw pond resonance, submerged structure, body-vs-world clocks |
| `T — sibling place` | Tidegarden genome contour `+3,-1,+3,+1,+1`, `CELL_GALLOP`, fifth → root | first appears as a sparse, destination-key fragment during legal approach; becomes a full but restrained bed after world ownership changes | difference before label, abundance without loot fanfare, settlement and hearth |
| `R — relation` | interlock of `O`'s cinquillo fragment and `T`'s gallop around shared-safe tones | only after safe rest; one interior sustained tone bridges the two rhythms, then all three recede | a possible relation neither world motif contains alone; never a solved third consciousness theme |

### Instrument and timbre palette

- **No new sample assets.** `main/public/audio` remains byte-identical. Existing streamed stems stay demoted texture; none becomes a story cue.
- **Authority:** shipped square/chip voice, narrow and dry, never louder than intelligible dialogue or the living bed.
- **Living origin:** shipped wide pad choir, organ-like sustain, tuned sub, origin-genome lead/ostinato, shimmer, wash, and restrained percussion.
- **Repaired Maw:** triangle transient, existing pitched-hit metal color, filtered noise, and a suspended second/sixth. “Struck metal” means synthesis from the current voice palette and SFX bus, not an imported impact library.
- **Underwater:** shared-bus lowpass plus existing sub-motif crossfade; stereo and high-frequency information withdraw in that order. The body pulse remains a centered, non-musical accessibility cue.
- **Ship:** the existing story pad/sub/ostinato/riser families accumulate by stage. Structural impacts are SFX-led; the score supplies tuned low pulses rather than repeated `boom` calls.
- **Tidegarden:** destination-bed plucks/percussion, tuned-water-like transients, wash/shimmer, and world SFX for hollow stems, water, wings, canopy, and pollen. Score does not counterfeit ecology with a single “alien” synth patch.
- **Interior:** exterior density narrows; a dry warm organ/sine component becomes audible. Shelter is heard as changed relationship to the same world, not a cozy replacement soundtrack.

### Rhythm, phrase, and punctuation law

- Story cues use 4/4. Beat entry or a committed subscene-state change defines a new local phrase boundary; the existing instrument retunes with named slews and carries forward all layers marked persistent.
- Harmonic changes are no faster than one per two bars except the authored A4 front, the legal Maw repair revoice, and breath-critical non-harmonic pulses.
- `scheduleHit` is used only for the A4 perception front and the Maw repair beam/bloom. Each request occurs after its causal event, targets the next bar, returns the exact audio time, and gives that time to the shared AV rail. No cue uses an immediate hit merely because a UI element appeared.
- No two score hits overlap, and no hit repeats within two bars. Ship-stage commits, inventory acquisition, accomplishments, placement counts, and observations receive no generic hit.
- The oxygen pulse is intentionally outside the musical grid: approximately 1.60 s at 60% O2, 0.95 s at 30%, 0.62 s at 15%, and 0.42 s at 8%, continuously interpolated and caption/numeric redundant. It may never masquerade as tempo.
- Crossing keeps the real origin-bed tempo (currently 77 bpm), then approaches the real destination-bed tempo (currently 81 bpm) only on bar lines. Energy changes subdivision, never bpm.
- Building notes are rate-limited to one event per 1.5 seconds, selected deterministically from the current destination chord, and never encode a hidden progress count.

### Authored silence and near-silence

- **After `no.`:** 1.75 seconds of held near-silence. Score transient, lead, ostinato, and riser are absent; only the never-silent sub/pad floor and truthful world sound remain. There is no victory hit and no early life swell.
- **After Maw repair:** 2.0 seconds without lead, target cue, or tutorial punctuation. The repaired metal interval may decay naturally while control returns.
- **Keel pickup:** no sting and no release. The phrase remains open until `dive_surfaced`; shore ambience returns before harmony, and harmony before width.
- **Pressure seal:** the sole true-silence exception—40 ms music fade, exactly 100 ms at zero around `ev.board.cockpit-sealed`, then a 120 ms emergence into the tuned cockpit root. Exterior SFX owns its separate seal treatment. This envelope belongs to a bounded scene-music adapter outside the protected engines.
- **First footfall:** 1.5 seconds of destination world sound before the bed rises from its quiet floor.
- **Hearth end:** no silence and no credits tail. Two phrases thin back to the ordinary destination bed, which continues breathing into free play.

## Initial authored mood values

These are first-audition implementation values, not permission to fork the protected `ScoreMood` schema. Bracketed arrays are semitones above the inherited story root. All story phases use the current planet-genome melody filter.

| Family/state | Tempo | Chord/progression | Pattern and motif | Wave | `pad/sub/ost/riser` | Baseline |
| --- | ---: | --- | --- | --- | --- | ---: |
| audit | 60 | `[0,7,12,16] → [0,7,13,16]` | inherited sparse `Q`; `O` lead density 0.18 | square | `.14/.11/.045/.15` | .42 |
| comply: fire → organics → floor | 56 | `[0,7,13] → [0,7]` | `[0,–,–,–,7,–,–,–]`; melody removed after fire | square | `.09/.09/.030/.05` → `.06/.08/.018/.02` → `.04/.07/.012/0` | .30 → .20 |
| defy | 52 | `[0,7,13]` | one `Q` fifth every two bars; no lead | square | `.045/.07/.018/.03` | .22 |
| A4 front | 66 | `[0,5,9,14] → [0,7,9,14] → [5,9,12,16]` | origin-genome lead density .58; cinquillo-derived ostinato | sawtooth | `.18/.14/.055/.34` | .50 |
| Maw: broken → repaired | 66 | `[0,7] → [0,7,14] → [0,5,14]` | three broken starts, then sparse `K`; lead density .16 | square → triangle | `.075/.09/.045/.10` → `.10/.10/.055/.14` | .34 → .40 |
| dive: surface → submerged | 60 | `[0,2,7] → [0,5,9]` | descending `K`; origin motif migrates to sub | triangle | `.10/.14/.030/.08` → `.055/.15/.010/.03` | .42 → .48 |
| reconstruct: diagnosis | 64 | `[0,7,14]` | nearly empty | triangle | `.04/.06/.015/.04` | .26 |
| reconstruct: bench/frame/hull/lift/route | 64 | `[0,7,14] → [0,5,9,14] → [0,7,9,14]` | persistent `Q`; then low impacts, breath pad, fifth pulse, full `O` phrase | triangle | `.05/.07/.028/.04` → `.06/.10/.045/.05` → `.12/.10/.045/.07` → `.13/.14/.055/.09` → `.15/.14/.060/.18` | .30 → .56 |
| board | 64 | `[0,7,9,14]` | route phrase thins under hatch; tuned root after seal | triangle | `.12/.13/.040/.08` | .40 |
| launch | 72 | `[0,5,9,14] → [2,7,9,14] → [5,9,12,16]` | repaired layers lock into half-time engine rhythm; `O` fragment remains | sawtooth | `.15/.15/.075/.28` | .50 |
| crossing/landfall/settlement/hearth | canonical bed transport | canonical origin → legal approach → canonical destination harmony | pure conductor plans `O`, `T`, and bounded `R`; no Story `ScoreMood` lead | existing bed palette | existing bed levels and quality gates | world-driven |

## Cue ledger

Every stable story anchor is named below. An arrow is causal order, not a fixed wall-clock duration. “No cue” means no score punctuation; normal world/bed continuity still applies.

| Cue ID | Start/end anchors | Phrase/bar intent | Story function | Image/control dependency | Mix priority | Reset/exit |
| --- | --- | --- | --- | --- | --- | --- |
| `sc.audit.incomplete-model` | `anc.audit.arrival-handback` → `anc.audit.fire-check` → `anc.audit.life-as-noise` → `anc.audit.tree-distance` → `anc.audit.directive` | inherit current arrival bar; remove one arranged layer after each committed mismatch; directive ends on unresolved `[0,7,13]` | make W-7744's limited renderer sit inside a world the player still hears | open first person; no score change until each mismatch event; forced directive rescue gets no accepting tail | dialogue/SFX > world > square fifth > pad | beat exit selects compliance state from committed events; reload never replays removals |
| `sc.comply.self-diminish` | `anc.comply.fire-order` → `anc.comply.fire-commit` → `anc.comply.organics-order` → `anc.comply.organics-commit` → `anc.comply.regression-floor` | 56 bpm; fire commit removes warmth/lead on the next local phrase; organics commit removes width/ostinato; floor holds root/fifth | obedience is experienced as a loss of musical resolution and dimensionality | transactions must commit exactly once; empty-organics absence path uses the same subtraction; no passive cinematic substitute | interaction/SFX > copy > score floor | derive exact variant from transactions; pause freezes pending subtraction; rescue advance has no punctuation |
| `sc.defy.lowercase` | `anc.defy.tree-order` → `anc.defy.tool-refusal` → `anc.defy.refuse-available` → `anc.defy.no-committed` | 52 bpm sparse `Q`; after committed `no.`, 1.75 s near-silence; no hit | make will audible as an absence in issued rhythm, not a heroic reward | tree must remain protected; accessible command equals manual command; timeout never advances music | exact line/world > low score floor | A4 may arm only after `ev.defy.refusal-committed`; replay lands before or after the committed boundary without re-speaking music |
| `sc.a4.breath-front` | `anc.a4.held-stillness` → `anc.a4.life-front` → `anc.a4.pond-wakes` → `anc.a4.herd-crest` → `anc.a4.w7744-flight` → `anc.a4.pack-torn` → `anc.a4.handback` | schedule next-bar Dorian/quartal bloom after refusal; expand `O` across two phrases; fracture `Q` during flight; drop a beat at tear; ebb by handback | largest arrival in scope: life becomes accessible, while W-7744's contradiction remains physical rather than providential | visual front follows returned audio time; reduced motion uses the same sound time with static disclosure; pack SFX causes the tear | world-life/SFX and dialogue remain legible; score apex capped below A5 vocabulary | pause suspends context/rail; reload reconstructs last committed front/fault/pack boundary with no replayed bloom |
| `sc.maw.direction` | `anc.maw.pack-attended` → `anc.maw.kit-acquired` → `anc.maw.repair-begun` → `anc.maw.repair-committed` → `anc.maw.direction-handback` → `anc.maw.pond-resonance` | pack/kit get no hit; three broken `Q` starts; commit schedules next-bar revoice to triangle/metal `[0,7,14]`; 2 s purpose gap; `K` begins at pond | capability wakes but purpose remains chosen and unresolved | repair must commit before beam/bloom; camera may follow audio timestamp; first direction may be fire, lower, or harmless use with no success sting | repair SFX/hand trace > score revoice > bed | interrupted hold consumes/sounds nothing; post-commit reload starts steady repaired state; no duplicate beam bloom |
| `sc.dive.two-clocks` | `anc.dive.waterline` → `anc.dive.oxygen-authored` → `anc.dive.keel-revealed` → `anc.dive.keel-freed` → `anc.dive.surface` → `anc.dive.shore-bank` | 60 bpm world harmony stretches to four-bar changes; non-grid O2 pulse contracts; pickup leaves phrase unresolved; surface restores ambience → harmony +0.6 s → width +1.6 s | capability meets a body; the wreck's memory is recovered only through return with breath | meaningful submersion gates pulse; `keel_memory_acquired` is not completion; `dive_surfaced` causes release; visual particles/god rays irrelevant | breath/O2/water SFX > interaction > lowpassed score | recovery to shore preserves items but gets no accomplishment release; reload bank state has open-air mix and no pickup sting |
| `sc.reconstruct.one-instrument` | `anc.reconstruct.diagnosis` → `anc.reconstruct.bench-online` → `anc.reconstruct.frame-restored` → `anc.reconstruct.hull-sealed` → `anc.reconstruct.lift-online` → `anc.reconstruct.first-hover` → `anc.reconstruct.route-online` → `anc.reconstruct.calibration` | 64 bpm; each committed monotonic stage starts a local phrase and retains prior layers; calibration reveal spans two bars but ends suspended | the ship assembles its orchestra with its body; repair reinterprets rather than erases | real stage events only; first hover gets useful lift, not a toast; calibration image follows committed flight readiness | construction impacts/engine > score layers; no layer masks prompts | reload selects composite variant from `repairStage`; no stage hit/cinematic replay; invalid pad blocks route/calibration cue |
| `sc.board.one-owner` | `anc.board.hatch-enter` → `anc.board.camera-transfer` → `anc.board.pressure-seal` → `anc.board.cockpit-handback` | route phrase narrows through hatch; 40 ms down/100 ms zero/120 ms up at committed seal; cockpit hum finds current root | make camera and acoustic ownership transfer physically, with the only true silence in scope | silence only on valid pressure-seal event; interrupted transfer resets outside and never spends it | hatch/pressure SFX > silence > tuned engine/score | cockpit reload begins after seal with steady root; on-foot reset restores world mix and clears envelope owner |
| `sc.launch.ground-relents` | `anc.launch.ignition` → `anc.launch.liftoff` → `anc.launch.atmosphere-exit` | 72 bpm half-time build; repaired layers synchronize under real thrust; legal exit starts one-bar unresolved release, then 4.5 s yield | power becomes travel without spending A5; origin recedes but remains musically remembered | cockpit/manual controller owns timing; no exterior cut; crash/recovery cannot trigger exit release | vehicle warnings/engine > score > world | only `ev.launch.origin-atmosphere-exited` permits yield; reload at safe boundary reconstructs steady prelaunch/approach state, no exit sting |
| `sc.crossing.distance` | optional `anc.crossing.origin-lookback` → `anc.crossing.sibling-targeted` → `anc.crossing.local-handoff` → `anc.crossing.approach` | origin bed REST/BED at 77 bpm; optional lookback hears the already-present distant `O`; legal target arms destination motif/modulation; handoff is a phrase-safe technical transfer; approach reaches 81 bpm/key on bars | distance enlarges relation; another world is a musical place before it is a UI label | no forced look; no score response gates observation; no warp signal/assets; world transfer hides without breaking celestial or musical continuity | cockpit/engine > quiet bed; destination fragment below warnings | pause freezes transport-owned authored overlay; short approach uses existing landing-pivot fallback; reload uses declared boundary, not accidental local reset |
| `sc.landfall.world-first` | `anc.landfall.touchdown` → `anc.landfall.egress` → `anc.landfall.first-footfall` → `anc.landfall.handback` | destination key/motif already established; touchdown gets no trophy sting; hatch opens mix; first footfall holds 1.5 s world-first; bed returns from floor | arrival is contact with an existing ecology, not reward or conquest | only validated touchdown/egress/footfall; no forced transform; destination conductor uses canonical profile | landing/egress/world ecology > bed | failed landing keeps approach state; reload after arrival starts destination bed without replaying pivot or footfall hush |
| `sc.settle.abundance-choice` | `anc.settle.scanner-overload` → `anc.settle.relationship-attended` → `anc.settle.site-chosen` → `anc.settle.first-foundation` → `anc.settle.core-online` → `anc.settle.shelter-certified` | dense destination bed thins under scanner copy; attended relationship permits one 2–4 s `T` fragment; validated site gets no hit; foundation adds one chord tone; core adds warm tone; certification narrows exterior layers | abundance becomes responsibility and free authorship, never a morality/progress score | direct Attend and gaze are equivalent; optional observation event does not cue progression; building never moves camera | scanner/relationship/world > placement SFX > bounded musical notes | placement rejection spends no note; reload derives core/shelter mix from committed state; no cue counts walls or percentage |
| `sc.hearth.between-fires` | `anc.hearth.ecology-night` → `anc.hearth.safe-rest` → optional `anc.hearth.window` → `anc.hearth.freeplay-handback` | night bed shifts naturally; committed safe rest begins two-phrase `O`/`T` counterpoint plus one `R` interior tone; optional window changes no cue eligibility; second phrase ebbs without cadence | home becomes a returnable relationship between distinct worlds; the third line remains only a question | certified shelter and safe rest required; any valid geometry works; muted/reduced variants preserve state truth outside music | interior/rest/world > low relational counterpoint | interrupted rest gets no duet; handback clears overlay, score intensity, envelope, and story ownership; normal destination bed continues |

### Authoritative event trigger matrix

The adapter subscribes to these facts exactly. A listed “no punctuation” is a deliberate score decision, not an unhandled event.

| Beat | Authoritative events/signals | Score consequence |
| --- | --- | --- |
| `ch4-audit` | `ev.audit.fire-mismatch`, `ev.audit.life-mismatch`, `ev.audit.tree-mismatch`, then `ev.audit.sterilization-authorized` | each mismatch removes one layer; only the ordered directive permits the unresolved audit tail |
| `ch4-comply` | `ev.comply.fire-doused`, `ev.comply.organics-resolved`, `ev.comply.regression-settled` | select fire, organics, and floor variants in order; repeated/idempotent events cause no second transition |
| `ch4-defy` | `ev.defy.tree-target-protected`, `ev.defy.refusal-committed` | target protection gets no branch cue; committed refusal causes the near-silence and arms A4 |
| `a4-exhale` | `ev.a4.alive-authority-committed`, `ev.a4.w7744-fault-recorded`, `ev.a4.field-pack-dropped` | front bloom, fractured `Q`, and the pack-tear omission respectively; reconstruction selects the latest committed boundary without replay |
| `ch5-maw` | `ev.maw.kit-acquired`, `maw_repaired`, `ev.maw.first-direction-resolved`, `ev.maw.keel-resonance-detected` | kit gets no punctuation; repair revoices; first direction gets no success sting; resonance begins `K` |
| `ch6-dive` | `submersion_changed`, `oxygen_threshold`, `keel_memory_acquired`, `dive_surfaced`, `ev.dive.keel-banked` | medium mix, body pulse, deliberately unresolved pickup, surfaced release, and dry-bank settlement; only `dive_surfaced` can support the skill-proof release |
| `ch7-reconstruct` | monotonic `ship_repair_stage`, `ev.reconstruct.first-legal-hover`, `ev.reconstruct.flight-ready` | composite stage arrangement, subdivision opening without sting, then route phrase/calibration eligibility |
| `ch7-board` | `ship_boarded`, `ev.board.camera-owner-vehicle`, `ev.board.cockpit-sealed` | narrow the mix only after valid boarding/owner transfer; spend true-silence window only on the seal |
| `ch8-launch` | `ship_launched`, `ev.launch.origin-atmosphere-exited` | ignition/liftoff state, then one-bar release and story-to-bed yield; no skill toast |
| `ch8-crossing` | optional `ev.crossing.origin-attended`, `system_body_targeted`, `ev.crossing.world-owner-transferred`, `ev.crossing.approach-established` | optional attention adds no gate; target arms canonical destination plan; transfer preserves phrase continuity; approach confirms bed ownership/modulation state |
| `ch8-landfall` | `planet_arrived`, `ev.landfall.egress-cleared`, `ev.landfall.on-foot-authority-restored` | no touchdown trophy; open exterior mix; permit world-first footfall/steady destination handback |
| `ch9-settle` | optional `ecology_relationship_observed`, `ev.settle.site-validated`, `ev.settle.foundation-placed`, `station_activated`, `shelter_certified` | optional record never gates; site gets no approval chord; foundation gets one tone; core adds warmth; certification changes acoustic relationship |
| `ch9-hearth` | `ev.hearth.night-lived`, `ev.hearth.safe-rest-completed`, optional `ev.hearth.origin-framed`, `ev.hearth.two-world-story-handoff` | lived night holds; completed safe rest begins duet; optional frame adds nothing exclusive; handoff clears overlay and returns bed authority |

## Anchor-resolved implementation notes

### 1. `ch4-audit` — the model that hears less

At `anc.audit.arrival-handback`, retain the exact sounding arrival mood and its current intensity; do not call an entrance hit. `anc.audit.fire-check` has no music until `ev.audit.fire-mismatch` commits, then the organ-like warmth and lead probability slew down over half a bar. At `anc.audit.life-as-noise`, the origin motif is no longer stated in the story lead, but world-life sound remains present—W-7744's classification cannot erase what the player hears. At `anc.audit.tree-distance`, the square fifth becomes more exposed by subtraction, never by gain above the living field. `anc.audit.directive` settles on `[0,7,13]`, leaving the foreign semitone unresolved.

The accepting cue exists only if all three mismatch events precede `ev.audit.sterilization-authorized`. A route rescue that forces the directive does not advance the cue ledger and must be reported as non-accepting.

### 2. `ch4-comply` — arrangement as complicity

The score does not tell the player compliance is wrong before the acts. `anc.comply.fire-order` simply holds the audit state. After `ev.comply.fire-doused`, the warm pad and melody are removed with a named slew; no extinguish boom is added. `anc.comply.organics-order` exposes more of `Q`. After `ev.comply.organics-resolved`, stereo width, upper extension, and most ostinato activity withdraw. `anc.comply.regression-floor` is one low root/fifth and a nearly inaudible pad voice, not true silence.

An explicit absence resolution for already-empty organics produces the same final musical state because the authoritative transaction—not an inventory animation—is the cause. Reload chooses fire/organics/floor arrangement from committed facts and never performs the subtraction twice.

### 3. `ch4-defy` — no.

`anc.defy.tree-order` inherits the floor. `anc.defy.tool-refusal` and `anc.defy.refuse-available` add no promise of a destructive branch. The score waits. At `ev.defy.refusal-committed`, the bare `no.` is allowed to finish before score transients fall away. There is no `braam`, `bloom`, `boom`, cymbal, melody answer, or harmonic resolution. The 1.75-second near-silence is the cue.

After that hold, the adapter may arm A4. A timeout, inaccessible target bypass, or milestone injection never arms it. This is the clearest place where less music is more causal than a conventional payoff.

### 4. `a4-exhale` — Breath, not apotheosis

At `anc.a4.held-stillness`, after refusal is committed, request `scheduleHit('bloom','bar')`. The returned audio time is entered into the shared scene rail. At that exact time, runtime order is: commit alive authority, expose the first life-front sample, then render the pitched bloom on `[0,5,9,14]`; the visual follows audio, and the bloom contains only the current legal chord tones.

`anc.a4.pond-wakes` introduces an augmented origin-genome phrase in tuned sub. `anc.a4.herd-crest` opens width and the full living arrangement without another hit. At `anc.a4.w7744-flight`, `Q` fragments into displaced square pulses under physical flight sound; this describes his fault without entering his mind. `anc.a4.pack-torn` is led by the branch/strap SFX and a half-beat musical omission, not a reward accent. `anc.a4.handback` returns to a medium-low living state while all A4-only intensity and scheduled punctuation clear.

Reduced-sensory mode omits the hit transient and realizes the same timed front as a 1.6-second pad/sub expansion capped at intensity .62. Reduced motion changes no audio anchor.

### 5. `ch5-maw` — an instrument still asks

Pack attention and kit acquisition are deliberately unscored facts. The spatial electrical knock, torn strap, displaced life, and accessible directional caption do the guidance. At `anc.maw.repair-begun`, the broken square voice attempts three starts, each shorter and no louder than the repair SFX. The hidden-catch gesture receives the first `W` trace once, below speech.

After `maw_repaired` commits atomically, request one next-bar `bloom` on the unresolved repaired sonority `[0,7,14]`; its audio time owns the short beam/material re-registration visual. The hit is trimmed to a chord opening, not a triumph. Square timbre slews into triangle/metal partials. At `anc.maw.direction-handback`, hold the two-second purpose gap and restore control before any suggested target. `ev.maw.first-direction-resolved` gets no success sting whether the player fires safely or lowers the Maw. `anc.maw.pond-resonance` begins `K`, causally opening the dive.

### 6. `ch6-dive` — two clocks

`anc.dive.waterline` uses the shipped continuous submergence signal. High-frequency score material withdraws and harmonic changes stretch; no bespoke “underwater track” starts. `anc.dive.oxygen-authored` begins the centered, non-grid body pulse only after meaningful submersion. Critical-state legibility is numeric, geometric, captioned, breathed, and pulsed; music is never the sole oxygen evidence.

At `anc.dive.keel-revealed`, the sonar response descends `[+7,+2,0]` with enough space to localize the physical core. `anc.dive.keel-freed` and `keel_memory_acquired` receive no sting; the harmony stays open while the body still owes the return. `dive_surfaced` at `anc.dive.surface` restores shore ambience immediately, harmony after 0.6 seconds, and stereo width after 1.6 seconds. `anc.dive.shore-bank` may settle on a quiet suspended chord only after dry banking and safe oxygen. A recovery reconstruction may advance humane story state but never receives the surfaced accomplishment release.

### 7. `ch7-reconstruct` — the ship builds one orchestra

`anc.reconstruct.diagnosis` begins almost empty. Every `ship_repair_stage` commit selects a composite variant containing all prior layers:

| Anchor/stage | Layer added and retained | Forbidden shortcut |
| --- | --- | --- |
| `anc.reconstruct.bench-online` / `bench_online` | recovered low `Q` chip pulse | no cue from merely owning Keel Memory; the bench commit is required |
| `anc.reconstruct.frame-restored` / `frame_restored` | tuned low structural ostinato/impact rhythm | no repeated `boom`; construction SFX owns physical weight |
| `anc.reconstruct.hull-sealed` / `hull_sealed` | breathing pad and glass-color extension | no pristine major reveal; scars remain in harmony and image |
| `anc.reconstruct.lift-online` / `lift_online` | sustained low fifth and engine pulse | no early route motif or sibling key |
| `anc.reconstruct.first-hover` | kinetic subdivision opens while harmony holds | no accomplishment sting; legal thrust is its own evidence |
| `anc.reconstruct.route-online` / `flight_ready` | full origin motif becomes a navigable phrase; route and sibling capability commit together | no cue on UI availability before the atomic event |
| `anc.reconstruct.calibration` | two-bar coherent arrangement under the 7–9 s reveal, ending suspended | no A5 major, no replay on reload, no promotion if pad/egress validation fails |

Each local state change begins after its authoritative commit, so replay and persistence can reconstruct the exact orchestra from `repairStage` alone. No additional score persistence field is permitted.

### 8. `ch7-board` — pressure and ownership

`anc.board.hatch-enter` narrows the route phrase; `anc.board.camera-transfer` removes wide exterior layers. Only `ev.board.cockpit-sealed` at `anc.board.pressure-seal` spends the exact 100 ms true-silence exception. A failed or interrupted transfer resets outside the hatch and never plays the silence. At `anc.board.cockpit-handback`, the existing ship drone is retuned to the current score root and the low route pulse becomes an engine rhythm.

The scene envelope is a bounded owner in an allowed adapter, not a change to music volume settings and not a protected-engine mutation. A cockpit reload begins after the seal in a steady mix and does not simulate the transfer again.

### 9. `ch8-launch` — no warp capital

At `anc.launch.ignition`, repaired layers agree rhythmically for the first time. `anc.launch.liftoff` raises subdivision and riser energy under actual vehicle thrust; tempo remains 72 bpm and the cockpit owns the experience. There are no exterior launch hits or synthesized-input accents.

Only `ev.launch.origin-atmosphere-exited` at `anc.launch.atmosphere-exit` begins the one-bar unresolved release. It does not trigger an accomplishment sting. After that bar, Story Score yields through the existing 4.5-second authority crossfade. The deep-space origin bed must be audible before `anc.crossing.approach`, leaving modulation ownership free. Emergency recovery never produces exit music or skill proof.

### 10. `ch8-crossing` — the interval is physical

The origin bed leads at its canonical identity. Optional `anc.crossing.origin-lookback` does not summon a theme; it lets the player attend to the already-present origin motif in a high/distant register. Thus a player who never looks back does not miss a required cue and an observation cannot gate progression.

After `system_body_targeted` at `anc.crossing.sibling-targeted`, the pure conductor receives the canonical Tidegarden world/profile identity and may introduce one sparse `T` fragment while `O` remains the counterline. No destination cue exists before route readiness and legal target selection. `anc.crossing.local-handoff` is aligned to a phrase-safe concealed transfer; it may swap the active canonical conductor, but `homeSeed`/destination state in the pure plan preserves the counterline without adding nodes or changing protected renderers. No `getWarp()` travel state, warp stem, tunnel riser, radial smear accent, or A5 boom is permitted.

At `anc.crossing.approach`, the existing modulation guard decides. A normal 60–90 second crossing offers ample bars to walk from origin to destination; a shortened legal approach uses the existing landing-pivot fallback and spends the same mediant ration. Destination motif recognition must precede palette/UI naming.

### 11. `ch8-landfall` — world before thought

`anc.landfall.touchdown` is not a trophy cue. The destination key should already be established or legally pivoting. `anc.landfall.egress` reopens exterior layers through the physical hatch. `anc.landfall.first-footfall` begins with 1.5 seconds of world sound—water, canopy, hollow stems, route life—before the bed rises from its floor. `anc.landfall.handback` leaves a quiet, unmistakable `T` phrase under free first-person control.

A failed validator, forced touchdown, wet spawn, or rescue transform does not spend any arrival cue. Reload after legal landfall starts the destination bed in steady state and does not replay pivot, first-footfall hush, or thoughts.

### 12. `ch9-settle` — notes are not points

At `anc.settle.scanner-overload`, keep the abundant destination world but thin score lead density so scanner relationships and captions are intelligible. `anc.settle.relationship-attended` may request one 2–4 second destination-motif fragment after the required accessible Attend act. `ecology_relationship_observed` and observation-record variants may color later free-play probability but never trigger progression music.

`anc.settle.site-chosen` receives no approval chord. `anc.settle.first-foundation` gets one deterministic current-chord tone embedded in the physical placement impact. Subsequent legal placements are rate-limited and non-counting. `anc.settle.core-online` adds the first warm interior sustain after `station_activated`. `anc.settle.shelter-certified` narrows exterior density and brings the dry interior reflection forward; certification, not a wall counter or preferred layout, causes the change. Rejected placement, refund, and resource recovery spend no note.

### 13. `ch9-hearth` — a duet without an answer

`anc.hearth.ecology-night` is primarily the destination bed's natural night transformation. Only `ev.hearth.night-lived` records the lived cycle. At committed `anc.hearth.safe-rest`, after shelter certification, a two-phrase overlay begins: `T` remains the local mid-register identity; an augmented `O` cinquillo fragment appears as a quieter high counterline; their shared-safe tones permit one warm, dry `R` sustain. The counterpoint is intimate, not symphonic.

Optional `anc.hearth.window` and `ev.hearth.origin-framed` do not start, complete, or intensify the cue. A valid room without a view receives the same relational music; the image may truthfully differ. At `anc.hearth.freeplay-handback`, the overlay peels away over the second phrase without V–I, full major, credits cadence, or A5 sound. Every owner resets and the destination bed continues.

## Variants, mix, and performance

### Desktop and headphones

- Preserve the shipped stereo pad width, gust-coherent wash movement, reverb, low sub, and spatial world/SFX localization.
- Dialogue, breath, interaction, vehicle warnings, and physical causality always outrank score. W-7744/Authority lines duck story music by 5 dB with 180 ms attack and 700 ms release through an allowed scene-mix adapter. Critical O2 below 15% ducks melodic/upper score by 6 dB while leaving the centered pulse legible.
- Do not pan narrative score punctuation to camera framing. The score remains world-scale; only diegetic pack, Maw, water, hull, vehicle, and ecology SFX localize.
- No score cue relies on headphones for meaning. Stereo width is affect, not evidence.

### Mobile and small speaker

- Use the same harmony, anchor order, motif rhythm, and cue times. Mono fold-down must retain `Q`, `O`, `K`, `T`, and the pressure-seal absence.
- Primary semantic material lives in the 250 Hz–2.5 kHz range: square/triangle motif, upper sub harmonic, pluck/metal transient, and breath pulse. Sub below roughly 90 Hz may disappear without losing the cue.
- Cap wide pad/shimmer by 2 dB in the small-speaker audition and keep center motif/interaction unchanged. This is an output-profile mix in an allowed adapter, not a new composition and not a protected-engine fork.
- Touch/autoplay lock is safe: story state advances silently; on unlock, audio enters the current steady cue state. It never replays missed refusal, bloom, pickup, seal, landing, or hearth events.

### Reduced sensory intensity

- Expose a score-impact scalar through the scene cue adapter, independent of graphics quality and music volume. Default is `1.0`; reduced is `0.55`, with story intensity capped at `.62`.
- Omit A4/Maw hit transients; realize their exact anchor timing with 1.6-second pad/sub openings. Omit braam/boom entirely in this scope. Preserve harmony, motif, silence windows, and causality.
- Reduce high shimmer/percussion/riser targets by 4 dB, extend attacks by 50%, and preserve the centered O2 pulse at an accessibility-safe level.
- Reduced motion does not automatically mute music, but both settings may be enabled together. Muted audio remains fully accepting because visual, caption, numeric, and physical evidence carry every required fact.

### Lowest quality and performance

- The musical and semantic sequence is identical on POTATO. Graphics quality may not remove an anchor, event, organism cue, destination identity, or world relationship.
- Low-power audio may suppress wide shimmer, long reverb send, and decorative percussion while retaining one pad voice, tuned root/upper harmonic, the active motif, body pulse, and physical SFX. Phrase timing and chord identity remain unchanged.
- The pure conductor may merge `O` and `T` events into the existing lead/ostinato arrays. It may not add a second scheduler, AudioContext, convolver, delay, persistent oscillator bank, or per-frame AudioNode churn.
- World sound/captions remain the fallback for pack direction, water medium, oxygen urgency, landfall, relationships, shelter, and night. The score is emotionally necessary but never mechanically exclusive.

### Voice, UI, and gameplay masking controls

Priority is: (1) body danger, authoritative dialogue, and physical transaction; (2) local world/vehicle causality; (3) score motif; (4) texture stems. Duck envelopes are start-anchored and interruptible under the Symphonic Law.

- W-7744/Authority speech: −5 dB score, 180 ms in / 700 ms out.
- Terra lowercase thought/caption with no voice stream: no duck solely for text; the cue arrangement already leaves space.
- Oxygen below 15%: −6 dB upper score, body pulse and breath unaffected.
- Placement/scanner UI: no global music duck; prompt tones and relationship captions occupy the center while score lead density is thinned by cue state.
- Vehicle warning/collision: −6 dB score for the warning envelope; a crash cancels accepting launch/landing punctuation.
- Pause/focus loss: freeze narrative clock and pending cue requests. The shared audio context or bounded story-music envelope prevents a scheduled onset from sounding while paused; resume re-quantizes unspent requests rather than skipping causal music.

### CPU, voice, and node budget

- **Persistent graph delta:** zero AudioContexts, zero schedulers, zero persistent oscillators, zero convolvers, and zero delays beyond the shipped score/bed graphs. This is the binding node budget.
- **Story voice cap:** the shipped four score-pad memberships, one sub stack, one ostinato stream, one sparse melody phrase, one riser, and one hit tail. No overlapping hit tails; no stage-specific synth bank.
- **Bed relation cap:** the shipped three pad voices and eight sub-motif voice pool remain the hard pool. `O`/`T`/`R` planning permits at most two pitched melodic onsets in one sixteenth slot and must never exceed the existing eight-voice sub pool.
- **Transient lifetime:** every generated note/SFX node stops after its authored tail; node count at minute 30, after tail settlement, must equal minute-1 steady-state count.
- **Planner cost:** added pure cue planning p95 under 0.25 ms per planned bar in Chromium; no narrative composition work added to the rAF path beyond copying a small cue-state snapshot.
- **Frame gate:** score-enabled/baseline median FPS ratio at least 0.98, 60 fps target, no sustained frame over 33.4 ms, and no regression outside current tier budgets.
- **Audio gate:** no NaN, no clipping, no illegal silent window, no phrase-tabu violation, no extra mediant beyond the era ration, no illegal voice-leading transition, and all continuous-control deltas within existing smoothness thresholds.

## Reset, fallback, and reconstruction matrix

| Boundary | Required score behavior |
| --- | --- |
| Pause or focus loss | freeze story clock and unspent punctuation; duck/suspend without letting audio time silently consume a causal hit; resume from the same anchor and re-quantize |
| Beat exit | clear prior cue request, set the next declared mood/bed owner once, reset intensity ownership, and release scene envelope; no temporary layer leaks |
| Reload/deep link | derive steady cue state from authoritative events, `repairStage`, world, medium, route, shelter, and rest facts; never replay one-shot hit, silence, pickup, accomplishment, or cinematic |
| Accessibility equivalent | same authoritative event produces the same steady musical state; reduced impact substitutes envelopes for hits and never changes acceptance |
| Muted audio | all story and gameplay acceptance remains available through captions, numeric/shape cues, physical state, and camera-independent evidence |
| Rescue/timeout | may restore a safe boundary but produces no accepting punctuation or skill/accomplishment release; log it explicitly |
| Audio unlock/context recovery | enter current steady state with named slew; do not replay elapsed cue history; canonical planet/profile reconfigures before bed lead |
| World handoff | preserve score bar/phrase semantics through the concealed boundary, pass canonical destination identity, keep an origin counterline, and forbid warp state |
| Story completion/free play | clear every authored overlay and envelope, call `setScoreBeat(null)` if still owned, leave destination bed and player settings authoritative |

## Implementation seam and protected-path disposition

Implementation is possible without touching any protected audio path:

1. Extend `StoryBeat`, story events, and the unprotected `storyScore.ts` content table for the locked beats.
2. Add an unprotected `emergentScoreDirector`/cue-state adapter that subscribes to typed events, selects deterministic steady `ScoreMood` variants, owns reduced-impact and scene-mix envelopes, and never stores parallel save state.
3. Add a pure narrative-overlay planner beside `bedConductor.ts` for `O`/`T`/`R` counterpoint. It merges bounded notes into existing bed plans; `bedEngine.ts` remains untouched.
4. Extend the unprotected world-signal snapshot with canonical `homeSeed`, destination profile identity, and bounded narrative-overlay state. Route the resolved `-1,-1:p1` profile through `AudioDirector`; do not derive the sibling from the system coordinate.
5. Put A4 and Maw scheduled audio times in the shared hashed scene contract so cinematography, low-tier visual fallbacks, and score sample the same timestamp.
6. Keep `main/public/audio`, `main/src/audio/scoreEngine.ts`, `main/src/audio/bedEngine.ts`, `main/src/story/voyageDeck.ts`, `firebase.json`, and `.firebaserc` unchanged. If implementation proves one of those mutations necessary, stop and re-contract rather than silently crossing the lock.

## Evidence and acceptance plan

### Current evidence that may be reused

- Existing deterministic score grammar, P5/polish tests, and WAVs in `main/renders/`.
- Current score tools and commands: `npm --prefix main run score:soak:pure`, `npm --prefix main run score:soak`, `npm --prefix main run score:audition`, `npm --prefix main run score:fps`, and `npm --prefix main run verify`.
- `?scoredebug=1` for live world-signal, harmony, scene, and bed-plan inspection.
- The shipped full-run video for visual handback continuity only; it has no audio stream and cannot approve incoming mix continuity.

### New evidence required before score signoff

1. **One continuous synthesized audiovisual run** from `anc.audit.arrival-handback` through `anc.hearth.freeplay-handback`, with an actual audio stream and an anchor/event sidecar.
2. **Thirteen cue extracts**, each beginning before its first anchor and ending after reset/transfer, plus focused extracts for: compliance subtraction; `no.` hold into A4; Maw revoice; underwater pickup/surface; all ship-stage reload states; pressure seal; story-to-bed yield; destination motif-before-palette; first footfall; shelter certification; and hearth handback.
3. **Before/at/after anchor captures** proving audio-time/visual-time agreement for A4 and Maw, within one rendered video frame and one 128-sample audio block.
4. **Reload matrix renders** before/during/after every unique transaction and medium/authority handoff. One-shot waveform hashes must not recur after committed reload.
5. **Manual and movie runs** with zero illegal rescue, plus a separate rescue-injection run proving accepting punctuation and accomplishments are withheld.
6. **Muted, reduced-sensory, reduced-motion, reduced-flash, mono fold-down, phone speaker, and POTATO** runs. Every story truth must remain legible; mono correlation must produce no motif cancellation.
7. **Origin → sibling → origin → sibling** audio continuity run, proving canonical profile identity, no p2 leakage, no warp grammar, stable return motifs, and no orphaned story owner.
8. **Thirty-two-minute pure and browser soaks** including the new overlay states; node-count snapshots at minutes 1 and 30; smoothness, legality, novelty, headroom, and never-silent assertions.
9. **Real-device headed taste:** desktop headphones, laptop speakers, one iOS/Android small speaker, controller/touch, and real GPU. Automated audio proves structure, not final balance or feeling.
10. **Artifact registration:** hashes and results land in this run's `audio-report.md`, `raw-audiovisual-evidence.json`, `evidence-registry.json`, and score contract signoff. No silent baseline may be used as audio approval.

## Alternate thesis for flagship work

### Direction B — “Acoustic Archaeology”

Direction B removes the continuous bar-led Story Score almost entirely. Every meaningful object and medium becomes a struck memory: fire has one decaying spectral fingerprint; organics another; the tree withholds resonance; the Maw excites the wreck; water stretches its impulse; each ship subsystem adds a physically located resonator; crossing is mostly engine, hull, and two remote spectral fields; shelter architecture filters those fields into the final relation. Meter would not become explicit until ignition. Planet identities would be recognized primarily by spectral decay, density, and spatial response rather than recurring melodic contour. The hearth would literally sound different in each valid player-built geometry.

This is structurally distinct from Direction A: event-excited, spatial, decay-led, and architecture-dependent instead of phrase-led, motif-development-driven, and transport-coherent. It is artistically strong and could make embodiment unusually tactile. It is not the selected direction for this locked run because it would require a second resonator/spatial-composition runtime, substantially more persistent/transient nodes, new acoustic-zone authorship, and likely protected-engine or asset changes. It also weakens the shipped motif-memory strength and makes mobile/mono/free-layout equivalence harder. Direction A earns flagship scale by developing the shipped instrument rather than replacing it.

## Cross-note questions

### For the Chapter Director

- Confirm the scene contract orders `ev.a4.alive-authority-committed` before the scheduled A4 bloom onset at the shared `anc.a4.life-front` timestamp; the schedule request itself is allowed only after committed refusal.
- Confirm whether the hidden-catch and late-oxygen `W` traces are the desired two appearances, or whether one should be removed for greater ambiguity. No added appearance is proposed.
- Confirm which W-7744/Terra candidate lines survive so final duck windows can be timed from actual voiced/SFX occupancy. This does not change cue causality.
- Confirm the final Tidegarden name/profile hash before owner audition artifacts are frozen. Current deterministic fields are usable for implementation but not publication.

### For the Cinematography Director

- A4 life-front and Maw beam/material bloom must consume the exact `scheduleHit` audio time from the shared cue rail. Please identify the low-tier/no-post visual fallback target for each without moving the anchor.
- Calibration should fit its 7–9 second reveal inside the first two bars of `anc.reconstruct.calibration`; it must return before the unresolved phrase settles.
- Pressure-seal image ownership must place the committed seal event at the center of the 100 ms zero window; interrupted hatch occlusion must not spend it.
- Destination palette/UI naming must follow the first recognizable `T` fragment. World-owner transfer may hide behind the limb, but it must not force a musical warp or destroy the origin counterline.
- The hearth window is optional and receives no exclusive musical trigger. Any valid shelter composition must support the same safe-rest duet and free-play handback.

## Score Director disposition

`ready_for_cross_notes` — all thirteen locked beats and every stable story anchor have a causal cue, phrase intent, ownership rule, mix priority, accessibility/performance equivalent, and explicit reset/reload/rescue behavior. The treatment preserves the shipped one-instrument identity, canonical planet motifs, never-silent floor, and A5 reserve; it proposes no protected-path mutation and no publication. The absent `visual-baseline.md` is a documentation discrepancy rather than a creative blocker because the available `shipped-visual-baseline.json` and shipped code establish the required handback boundary; actual incoming audio continuity remains an evidence gate because the baseline video is silent.
