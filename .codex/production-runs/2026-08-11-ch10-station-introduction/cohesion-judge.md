# Cohesion judgement — ch10 station introduction

Judge: scene-cohesion-judge (Claude Opus 5, 1M context), read-only.
Run: `2026-08-11-ch10-station-introduction`. Mode: chapter (threshold 4.75 weighted, 4.30 category floor).
Judged at: 2026-08-12.

Contract revision: `draft-v9`
Contract sha256: `0336a4f28bfaa874fffc300f02999e329dbed86d3cdcd53cf7ce3261c48639b1`

## 1. Decision

**DISPOSITION: repair.**

**One-sentence verdict:** Chapter 10 is one authored event and not three
departments working side by side — the refusal, the interruption, the seam and
the hand-back genuinely reinforce each other — but the chapter's largest
perception arrives smaller than it was authored to be in both the image and the
music, its first perception is out-shone by an ordinary star, and the freshest
frames of the run have never been seen by any independent eye.

Weighted score **4.40**; category floor **4.00** (two categories). The bar is
4.75 with no category below 4.30, and one unaccepted medium sits inside
audiovisual alignment, which the rubric's own blocking policy names. The run
fails the gate on merit, not on bookkeeping.

Why repair and not blocked. A strict reading of the blocking rule is arguable
here: the moderation pass was never commissioned and `chapter-journey-evidence.json`
is an unfilled template. I rule repair instead, for a reason I want on the
record. No independent *reviewer* is missing — story, score, cinematography,
player-experience and the blind viewer all filed, all with first-wave
attestations, and the blind viewer's isolation is documented and credible. I did
not have to simulate anybody to reach a verdict, and every claim below is traced
to an artifact I read. Blocking would leave the run with no route; repair leaves
it with five. The two missing artifacts are carried below as defects that the
next loop cannot exit without.

Why not ready-for-human-taste. Four owner decisions are genuinely waiting, and I
say below which of them I refuse to pre-empt. But a run is only ready for an
owner's taste when the machine-ready half is true, and it is not: three of ten
acceptance criteria fail, the verifier's own overall status is `fail`, and the
canonical defect register predates the pass that produced those failures.

## 2. Evidence completeness

Present, substantive, and independent: `story-audit.md` (plus a second-instance
delta re-check), `score-audit.md` (plus a second-instance delta re-check that
re-derived rather than confirmed), `cinematography-audit.md`, `ux-audit.md`,
`naive-audience-report.md`. Each carries a first-wave attestation; the blind
viewer received `raw-audiovisual-evidence.json`, frames and audio and nothing
else, and its report reads like it. `objective-lifecycle-evidence.json` is a
real guided-play lifecycle proof, not an assertion. `verification-report.json`
is the freshest artifact in the run and is unusually honest about its own
failures.

Four completeness problems, all material to what I can certify:

**(a) The independent record is older than the frames it describes.** The three
HIGH hero stills on disk were captured at 16:04–16:09 on 2026-08-12. The blind
read was recorded at 14:53, the cinematography audit against draft-v6, the
player-experience audit against draft-v6. Two of the three stills changed
*materially* after every reviewer filed: the ST-0 still was re-staged from the
Kestrel to the hearth (the exact defect the auditor raised as D-A4), and the
seam still was re-shot from range 955 — where it was a second resolve frame — to
a latch at 5,154, where it is finally a line. So the blind viewer's two hero-still
verdicts, including "Deer at the Wrong Sun", are verdicts on images that no
longer exist, and nobody outside the verifier has looked at the ones that do.

**(b) The evidence registry does not describe the evidence.** I re-hashed the
registered stills. All four disagree with the bytes on disk:
`still-seam-of-light.png` registered `f6932219…`, actual `f9c1a187…`;
`still-station-resolved.png` registered `f43857bd…`, actual `5d2a04b5…`;
`still-st0-sighting.png` registered `3605d820…`, actual `3e94f739…`;
`still-seam-of-light-low.png` registered `9531f0f7…` at 558,693 bytes, actual
`7ab0abbf…` at 240,730 bytes. `strip-st0-nightdwell` — the eight-frame strip that
carries the proof that ST-0 actually crosses the sky — and the four scene-twin
measurement frames are not registered at all.

**(c) The canonical defect register is stale.** `defects.json` was compiled at
00:00Z; the final capture pass ran at 20:13Z and produced four new findings
(two high, two medium) that the register does not contain. It also carries three
severities outside its own schema (`blocking`, `major`), one defect with no
contract anchor (F8), and one owner value the gate rejects (D-A2). Four of the
player-experience auditor's six findings (UX-3 through UX-6) were never carried
into it at all.

**(d) Two required artifacts are templates.** `critic-report.md` was never
commissioned, yet it is cited as the sole source of three canonical defects —
D-12, NV-1 and OD-1 — and contains none of them; OD-1 is the only
owner-reported experience defect in the run. `chapter-journey-evidence.json` is
unfilled in a chapter-mode run, so the six contracted journey lanes
(continuous-manual, movie, reload-continue, direct-entry-diagnostic,
recovery-detour, variants) have no certified record, even though the substance
of most of them exists elsewhere.

One structural note that bears on what "ready" can mean here. I ran the run's own
final gate read-only: it demands a continuous scene video and a passing headed
gate. The production lock forbids movie renders by owner instruction, and the
capture box is headless SwiftShader. The run therefore cannot pass its own final
gate under its own lock, by construction, no matter how good the chapter is. That
is a governance conflict for the triad and the owner, not something a repair loop
can close. (A smaller instance of the same disease: the gate flags
`run-summary.md` for a forbidden token because the summary contains the word
while narrating the tool bug that produced it.)

Publishing is not mine to approve or condemn, and I do not. I record only its
bearing: the live site serves `9a20dde`, which predates the reboard rung, the
gaze solver, the ST-0 occlusion fix, the berth-ring suppression and the boost
suppression. Every finding in this document is about a build the public cannot
reach, and the build the public can reach was never judged by anyone.

## 3. Anchor cohesion matrix

Ten signed anchors plus the unanchored prelude. "Reinforce" means the domains
carry one event; "annotate" means one domain restates another.

| Anchor | Story | Score | Image | Control | Verdict | Evidence |
|---|---|---|---|---|---|---|
| ST-0 (unanchored) | a moving light at the second hearth, unnamed | silence, structurally enforced (no rail anchor exists) | 2.4px quad, 90s ellipse on the true bearing | none; free play, no marker | **reinforce, but the first rung is weak**: crossing proven 7/8 night-dwell frames, yet ST-0 peaks 148.4 against a 4px star at 231.8 | verification AC-st0-evidence; AC-hero-still-st0-sighting |
| `anc.ch10.cold-noticed` | the cell is failing, noticed in person at night | sub root drops a whole step under held voices | fire-night palette, K1 caption | walk; no seizure | reinforce | check-results; strip-cold-a |
| `anc.ch10.fault-read` | the readout speaks as an institution | one quantized square-fifth figure under the caption | HUD readout, `HAB CORE` header | [F] at the core, marker `… · 46m` | reinforce | ux-audit C1; lifecycle rows |
| `anc.ch10.fabrication-refused` | self-sufficiency is exhausted | the fifth answers once and stops; melody mutes | headerless refusal line, now `KESTREL FABRICATOR` | [F] ATTEMPT, honest about its own outcome | **the strongest cross-domain moment in the chapter**: refusal as subtraction in three lanes at once | story-audit §1; score-audit dimension table |
| `anc.ch10.relay-ask` | she claims the wreck relay outbound | a two-bar sounding square-fifth question, 7.06s | cockpit window, flowering tree centred | [F] REQUEST at 4.2m | reinforce | score-audit delta; relay_ask-through-answer_combined.wav |
| `anc.ch10.relay-answer` | the answer returns before the asking finishes | enters at beat 3, 25.0% in, 0ms gap, unaccented (−25.99 → −27.06 dB) | K8 replaces K7; no visual event | none — the spend is audible only | **the pillar spend, and it now lands as observation**; debited only by the 6 dB thinning (NV-1) | story-audit F1 closure; score-audit delta |
| `anc.ch10.bearing-claimed` | an indefinite rite, no timer | pad re-voices around the carrier; no build, ever | advisory bearing chip | [F] CLAIM; no auto-claim, no nudge | reinforce — the refusal to build is authored and audible | ux-audit A5; contract score block |
| `anc.ch10.transit-ignite` | the issued bearing is flown | ch8 flight DNA, riser flat, audibly not-warp | FOV 70 flat, shell at unit scale | HOLD to ignite, reboard rung ahead of it | reinforce (repaired; see §5) | AC-composition-lens-identity, 178 samples |
| `anc.ch10.seam-of-light` | the thing becomes a line | percussion and ostinato ebb to zero; a line with no body has no pulse | latch at 5,154, spine 5.18% of frame, sky black | flight retained | **reinforce on the frame, fail on the terms**: the middle distance now exists; thickness 2.782° against a 2.4° ceiling in the wrong units | AC-hero-still-seam-of-light |
| `anc.ch10.station-resolved` | the thing becomes a place | octave double, hearth cell quoted once, peak 0.44 | 19.65% of frame width at range 1,421 | 2.5s cold hold, now wired in manual | **the chapter's weakest junction**: authored 22.0–28.7% and unreachable; brightest aperture pixel is cockpit furniture at 247.9, not the station at 223.5 | AC-hero-still-station-resolved; D-V9-1, D-V9-4 |
| `anc.ch10.threshold-handback` | no annotation in frame | carrier and mood release through named slews; carrier dies here | K11 painted, work order cleared, no berth ring | control returned; no stale objective | reinforce — the cleanest hand-back in the run | AC-berth-ring-suppression; lifecycle invariants |

No anchor is empty spectacle. No domain merely annotates another. The one
duplication I looked for and did not find is a score sting under a caption; the
score's acknowledgements are all subtractive, which is a real authorial position
consistently held.

## 4. Player-action lifecycle matrix

| Rung | Objective | Marker | Feedback | Input | Progress / completion | Clear / reset | Variants | Evidence |
|---|---|---|---|---|---|---|---|---|
| C1 | `station:fault-read` | `HABITAT CORE · READ THE FAULT`, parity true, resolved | one cue per activation | [F] at the core | receipt `faultRead` | replaced | desktop-low manual traced | lifecycle variantMatrix |
| C2 | `station:fabrication-attempt` | ready at 6m | one cue | [F] ATTEMPT | receipt `fabricationRefused` | replaced | traced | lifecycle |
| A1 | `station:return:reboard` | `KESTREL HATCH · REBOARD`, resolved | one cue | [F] BOARD | boarded | replaced | traced | transitions row 6 |
| A2 | `station:return:crossing` | `ORIGIN WORLD · COURSE`, parity true | spatial | fly | range | replaced | **all four profiles** | variantMatrix |
| A3 | `station:return:landfall` | `WRECK SITE · LAND` | spatial | descend | landfall | replaced | D-12 residual, off-box | defects D-12 |
| A4 | `station:relay-query` | ready at 4.2m | answer at +1.76s | [F] REQUEST | receipt `relayAnswered` | replaced | traced | score evidence |
| A5 | `station:bearing-claim` | indefinite rite | no timer, no auto-claim | [F] CLAIM | receipt `bearingClaimed` | replaced; D-15 1.81s null | traced | defects D-15 |
| T1 | `station:transit:reboard` | `KESTREL HATCH · REBOARD`, resolved, requiresMarker true | one cue on disembark, one on reboard | [F] BOARD | boarded | replaces to ignite | **desktop-low manual only** | transitions rows 4–5; fallback ledger shows it as the beat-entry objective at 404.1s |
| T2 | `station:transit:ignite` | markerless while aboard, work order actionable | none | HOLD to ignite | receipt `transitIgnited` | replaced | movie four-profile; manual desktop-low | variantMatrix |
| T3 | `station:transit:resolve` | markerless by design | range is the progress | fly | hand-back | clears to nothing | four profiles | AC-fallback-ledger |

**The guidance contract is now honest end to end, and that is a real repair.** The
player-experience auditor found the movie lane masking a broken manual lane —
the autopilot had been given a bespoke walk-and-board step that substituted for
a missing rung — and the rung is now authored, wired, marker-resolved from the
ship's live pose, cued once per activation, and it is the objective the beat
publishes on entry in the end-to-end run rather than a repair bolted to the
autopilot. Zero mandatory objectives were ever observed at `missing-marker`
across 42,886 mutation-resolution records; no work order lacks an actionable
input; no stale objective survives the hand-back.

Three honest debits remain. The repaired rung is proven in the manual lane at
one profile only. The lifecycle trace's own step labelled `on-foot-after-claim`
reports `aboard: true`, so the precise scenario the auditor described — claim on
foot, then stand still — is demonstrated by a synthetic disembark rather than by
the natural flow. And the auditor's stated recheck ("manual, non-movie, headed")
has not happened, because nothing in this run has been seen headed except by the
owner, informally, before the repairs.

## 5. Combined experience

Reconstructing the intended player event without adopting anyone's
self-description: a player who has settled a second world notices, or does not
notice, a light that moves; later a wall she sealed herself begins to fail; her
own instrument refuses her; she flies back to the world she came from and asks a
dead relay a formal question, and something answers before she has finished
asking; she claims a bearing nobody made her claim, flies it, watches a dot
become a line become a place, and is handed back the frame with nothing written
on it.

That event exists. It is legible without context: the blind viewer, given only
frames and audio, reconstructed the spine correctly and called it "a clean,
moving spine", and named K11 as landing. That is the single strongest signal in
this record, because it is the only one produced by someone who wanted nothing.

Where it stops being one event is at the destination, and the failure is
symmetrical across two lanes, which is why I am treating it as a cohesion
finding rather than as a score complaint:

- **The music arrives ~6 dB under the ask's own mean.** Three independent
  reviewers converged from three directions: the blind viewer ("too small for
  the biggest image — nothing you'd remember"), the canon auditor (the answer's
  continuation reads as thinning), the score auditor (measured).
- **The image also arrives smaller than authored.** The cut line is contracted at
  22.0–28.7% of frame width across a [1,000–1,300] range window; it measures
  **19.65% at range 1,421**, and the window is **no longer reachable at all** —
  the ship asymptotes at 1,377–1,399 with speed decaying to 0.01 u/s. The cause
  is this run's own correct repair: suppressing the autopilot's held boost cut
  terminal speed from 320 to 117.5 u/s and the coast from about 533 units to
  about 120, while the contract's window and its "closure ≈80 u/s" derivation
  both predate that change.

Nobody joined those two facts. The score lane has been defending a musical
position against a perception that is, in part, not musical: the chapter's
biggest image is roughly a tenth to a third smaller on screen than the frame the
Cinematography Director authored, and the brightest pixel inside the cockpit
aperture in that frame is a piece of cockpit furniture at 247.9, not the station
at 223.5. Half of "the reveal is too small" is a measurable regression against
the contract's own numbers, owned by Cinematography and Integration. Only the
other half is taste.

The same pattern one rung earlier: ST-0 is authored as the first perception in
an escalating ladder of sight, information and scale, and the contract states as
a reachability fact that "ST-0 is authored above the starfield peak; only the
disc ever beat it". Measured on the delivered frame, ST-0 peaks at 148.4 against
2,402 classified point sources, the brightest of which is an ordinary star at
231.8 — a gap of 83 luminance levels, not a margin. The crossing is real and
newly proven; the brightness claim is false. So the ladder's first rung is
legible through drift and not through light, and the contract asserts otherwise.

On the second question the run poses — is the derivation discipline sound? It is
sound in principle and demonstrably incomplete in execution. Four terms in this
run were unsatisfiable by construction, each read as bad craft for one or more
rounds, and all four are now superseded with cause recorded inline. That is
genuinely excellent practice and the most transferable thing this run produced.
But two of the three fresh failures are the same disease in its next form.
The thickness ceiling is written into draft-v9 as "thickness ≤2.4°, ratio ≥2.8
unchanged" in the same sentence that mandates the tangent-correct convention —
the word *unchanged* is the bug; the same mask reads 2.782° in the units the
contract now requires. And the cut-line window is a fifth unsatisfiable term,
created *after* the discipline was declared cured, because a run constant moved
and its dependents were never re-derived. The reachability sentences themselves
were asserted rather than measured; the ST-0 one is false. The rule the run
wrote is right. The rule needs one more clause: when a run constant changes,
re-derive every term derived from it, and measure each reachability sentence
before signing it.

## 6. Agreements and dissent

Preserved, not averaged.

**Convergences worth recording.** Reveal under-scale: blind viewer, canon
auditor and score auditor, independently, plus my own measurement of the image.
ST-0 not perceptible as staged: blind viewer ("nothing crosses… it reads as a
frozen game") and the cinematography auditor's D-A3, and the crossing half is
now fixed and re-proven while the brightness half is newly failed. Guidance
honesty: the player-experience auditor alone, and it was right.

**The six declined alternatives in `dissent-register.md`** — the corridor refusal
line, the letterbox at resolve, hold-release alignment, the SHELTERED chip, the
diegetic hum, and the first-perception stack — are preserved as recorded. I
disturb none of them. I note only that entry 1 (corridor refusal line versus
instrument silence) has since been contradicted by the only human who has played
the build, which is exactly the revival condition the register itself names.

**Taste ties I decline to settle, and why.**

1. **The reveal's musical restraint (NV-1).** Not mine. Both positions are
   coherent: three reviewers heard a destination that does not arrive; the Score
   Director's position is that withholding the station's key, theme, mediant and
   lead is the authored point and is banked inventory for the docking run, and
   that raising it flattens the arc the 0.44 ceiling and the strictly-below-a4
   term exist to protect. No measurement can settle it — every measurement that
   could be run has passed. The fix is a commissioned reveal packet that reopens
   two signed terms and requires a re-signature, which makes it a scope decision
   as well as a taste one. And I have heard offline renders, not the thing in
   flow on real hardware. **Owner's ear, in a headed session, against
   `station-resolved_combined.wav` and `relay_ask-through-answer_combined.wav`.**
   What I *do* settle: the image half of the same perception is not taste and is
   routed in §7 as J-1.
2. **Corridor silence legibility (OD-1).** Not mine. The only human who has
   played this read a contract-correct closed door as an unfinished game. I
   cannot overrule a play report from stills and traces, and I will not confirm
   it from them either. The remedy is a canon decision about whether the station
   may speak this run, which the triad already declined once on the record.
   **Owner, then Chapter Director if commissioned.** The Score Director's
   objection to answering it with music is correct and should be honoured.
3. **The voice lane (second person versus first person).** Not mine and not the
   triad's — it is continuity with a lane the owner personally moved one run ago.
4. **The cut line's golden-section term.** The station centroid sits at 51.09%
   against a term calling for about 38.2%, and the blind viewer called that exact
   frame the best image in the run, "the only frame with real depth", and titled
   it. I decline to declare the frame wrong on the strength of a band. This is a
   director's call, not the owner's: **Cinematography decides term or frame,
   with the blind read as evidence.**

**One suspension I do lift, partially.** The Cinematography Director held every
composition verdict formally suspended until fresh strips existed, and refused
to let a reclassified diagnosis count as re-measurement. That was correct
behaviour and it is now satisfied on the lens question: `renderCamera` and
`flightFeedback` agree at 70.0° across 178 samples with the shell at unit scale.
The suspension does not lift on the hero stills, for a different reason than the
one that raised it: those frames now exist, but no independent eye has seen them.

## 7. Defects

Ranked, routed, evidence-bound. Judge-issued IDs are `J-*`; the rest are the
run's own.

| # | Sev | Defect | Owner / route | Evidence |
|---|---|---|---|---|
| J-1 | high | The cut line lands smaller than authored and its contracted range window is unreachable: shutter 1,421 against [1,000–1,300]; occupancy 19.65% against 22.0–28.7%; the ship asymptotes at 1,377–1,399. Caused by this run's own correct boost suppression. Half of NV-1 lives here. | **Cinematography** (restore reach or re-author the window with a fresh derivation) + **Integration Engineer** (the coast constant) | verification `AC-hero-still-station-resolved`; `newFindings` D-V9-1 |
| J-2 | high | ST-0 is not the brightest point source: 148.4 against a 4px star at 231.8 across 2,402 classified sources; the contract's reachability sentence asserts the opposite. The chapter's first perception is legible through drift, not light. | **Cinematography Director** | `AC-hero-still-st0-sighting`; D-V9-3; contract ST-0 shot term |
| J-3 | high | Evidence chain does not describe the evidence: four registered hero-still hashes stale, night-dwell strip and four measurement twins unregistered, defect register predates the final pass and omits D-V9-1 through D-V9-4, three severities outside schema, F8 anchorless, D-A2 owner invalid. | **Integration Engineer** (re-hash, re-register) + orchestrator (recompile) | my re-hash of `evidence-registry.json`; gate `--check-only` output |
| J-4 | high | No independent reviewer has seen the current hero stills; two of three changed materially after every review filed. Every craft verdict on the ST-0 and seam frames in this record is a verdict on superseded bytes. | **orchestrator** (re-commission the blind read on the three current stills only; re-run the cinematography delta) | file mtimes 16:04–16:09 versus report timestamps |
| J-5 | high | `critic-report.md` is an uncommissioned template cited as the sole source of D-12, NV-1 and OD-1 and containing none of them; `chapter-journey-evidence.json` is unfilled in a chapter-mode run, leaving six contracted journey lanes uncertified. | **orchestrator** (commission or re-source; fill the journey evidence) | gate `defects.lossless-source` failures; both files |
| J-6 | medium | Measurement-convention debt: `thickness ≤2.4°` is a pre-convention linear number carried forward marked "unchanged" while the convention around it changed (same mask reads 2.782° tangent-correct); the +5.5% spine deviation is an L-definition mismatch (centre-line 865.0 versus corner-inclusive silhouette near 915). Terms, not staging. | **Cinematography Director** | `AC-hero-still-seam-of-light` deviation; D-V9-2 |
| J-7 | medium | Three camera-rigid cockpit warm clusters sit inside the aperture in both transit hero stills; in the cut line the brightest aperture pixel (247.9) is one of them, not the station (223.5). Focal competition in the frame the chapter builds to. | **Cinematography Director** (mask, move, or re-author the warmth law) | `cameraRigidWarmClusters`; D-V9-4 |
| J-8 | medium | Variant parity for the repaired transit rungs exists at desktop-low manual only; UX-3 through UX-6 were never carried into the canonical register; the lifecycle row labelled `on-foot-after-claim` reports `aboard: true`. | **Integration Engineer** (re-run four profiles, manual lane) | `objective-lifecycle-evidence.json`; `ux-audit.md` |
| J-9 | medium | The run cannot pass its own final gate under its own lock: the gate requires a continuous scene video and a headed pass; the lock forbids movie renders and the box is headless. | **full triad or Human Approver** (reconcile gate and lock) | gate `raw-evidence.video`, `verification.headed` |
| D-A2 | critical → reclassify | "The seam still is not the seam" is **closed on the frame**: the re-shoot latches at 5,154 inside [5,100–5,200] and the middle distance now exists. What remains of it is J-6, which is a terms defect. | **Cinematography Director** to re-status | `AC-hero-still-seam-of-light` |
| OD-1 | high | Corridor silence reads as unfinished to the only human who has played it. | **owner**, then Chapter | human-decision.json |
| NV-1 | medium | Reveal under-scale — musical half. | **owner** (see §6.1) | score-audit delta; naive-audience-report |
| D-15 | medium | Station target telemetry null for 1.81s between claim and beat flip. | **Integration Engineer** | verification residuals |
| D-12 | high, accepted | Landfall intermittency, closed on frequency 8/8, never observed off this box. | accepted exception, owner-confirmed | defects.json |

I did not invent severity. J-1 and J-2 take the verifier's own high; J-3 through
J-5 are high because they attack the provenance of everything else in the record.

## 8. Scorecard

Reasoning per category; the machine mirror is `final-scorecard.json`.

**Narrative and player causality — 4.6.** Canon-clean and pillar-safe on an
independent audit plus a second-instance delta. Both-readings law holds on all
eleven lines and every marker label. Exactly one hidden-pillar nudge, and it is
now an audible fact rather than an assertion: the answer enters at beat 3, 25.0%
into a 7.06s sounding figure, 0ms gap, unaccented, click-free. The need to leave
emerges from play — a wall she sealed herself, then her own instrument refusing
her — rather than from a quest giver. Debits: D-15's 1.81s null; one teleport
nudge inside ch10-cold in the end-to-end run, which is a rescue however it is
classified; the voice-lane question live at the chapter's stated agency peak; ten
canon debts created for the docking run, recorded honestly.

**Audiovisual emotional alignment — 4.1.** The ask-through-answer junction is the
best cross-domain work in the run, and the refusal is the best three-lane
subtraction. But the destination under-arrives in both lanes at once (§5), an
unaccepted medium (NV-1) sits inside this exact category, and the rubric's own
blocking policy names it. This is the category the chapter must win and does not
yet.

**Cinematic composition and lens — 4.0.** Lens identity proven where it was
doubted (70.0° on both cameras, 178 samples, shell at unit scale); the seam is
finally the seam; ST-0's crossing is proven on 7 of 8 night-dwell frames after a
real root-cause fix to the gaze solver; the berth ring is fenced at the mount
with the sandbox proven byte-identical by exact-count test; no cut and no
letterbox anywhere. Against that: two of three hero stills fail their own
criteria, the first perception is out-shone by a star, cockpit furniture
out-brightens the subject in the cut line, and no independent eye has seen any
of it.

**Score coherence and synchronization — 4.7.** The strongest lane. Every blocking
and major defect closed with re-derived measurement by a fresh instance: pure
milestone resolver over an 18-cell matrix with reload equivalence, the ask figure
realized, the resolve strictly below the a4 control on all three measures, the
carrier's novelty proven as encoded, the ebb proven a real envelope event. Cue
grid 10/10, intensity ladder exact, additive-only mood table, 0.44 ceiling held,
ST-0 silence enforced structurally rather than by discipline. Debits: NV-1's
taste risk unresolved by the lane's own choice, the D4a wording residue, two
evidence files predating the re-pitch.

**Palette, light and render cohesion — 4.4.** One atmosphere across the seams;
fire-night into station amber; the galaxy firewall clean at zero impostors and
zero companion bodies in both hero frames; sky bodies all neutral or cool
magenta with zero warm discs. Debits: the "sole warm source" law fails on
cockpit furniture, and ST-0's luminance shortfall is as much a palette problem as
a composition one.

**Transition and state integrity — 4.7.** Reload-safe from durable milestones;
three deep links reconstruct the correct rung; sandbox and free play mount no
HUD; effect resets across eight triggers on four profiles; no stale objective
after hand-back; 481s end to end with zero timeout rescues and zero reachable
timeout branches; the station never becomes the resident world. Debits: D-15,
the one nudge, D-12's off-box residual.

**Creative ambition and Paravoxia specificity — 4.7.** An unmarked, cueless,
scoreless 90-second orbit at the station's true bearing that most players will
never see; an answer that arrives inside its own question and is provable by
onset; refusal-to-fabricate as the engine of departure; a cut line that is an
authored non-arrival; instrument silence proven at 949 units; one added draw call
and no new programs. A blind viewer read the spine correctly with no context.
Debits: the biggest image does not yet land at the scale this ambition implies,
and the closed door read as unfinished to a human.

**Interaction, accessibility and variants — 4.25.** Marker parity is structural
and verified; the dishonest rung is gone; one cue per activation; 42,886 records
with zero missing-marker observations; four variant profiles reach transit with a
common applied FOV. But on mobile-potato the entire work order is a `JOURNAL`
button at all six anchors, so a whole platform receives the chapter's unannounced
arrival as a small button — accepted as a shipped-baseline exception, which
disposes of the blame but not of the experience. Add the desktop-low-only proof
of the repaired rung, the four dropped UX findings, and no headed recheck. Below
the 4.30 floor, deliberately.

**Performance and implementation fidelity — 4.5.** 2,270 tests, verify 9/9,
typecheck clean, 1663 contract and 1787 implementation checks, one added draw
call, sandbox byte-identity proven, six pre-existing defects fixed because ch10
was the first thing to walk into them, four rotted verification tools repaired,
and every scope expansion recorded as a lock revision with the term that forced
it. Debits: the contract and the shipped physics now disagree about a reachable
range; publishing happened from an uncommitted tree with governance red.

**Evidence review and learning — 4.0.** The learning half is close to exemplary:
ten transferable lessons, an auditor's own critical finding disproved with its
lane still refusing to lift the suspension without re-measurement, honest
supersessions with cause inline, an unusually self-incriminating verification
report. The evidence half is the weakest thing in the run: stale registry hashes
on all four hero stills, an uncommissioned moderation pass cited as a source, an
unfilled journey artifact, a stale defect register, and three different figures
for the end-to-end duration across `run-summary.md` (427s), `human-decision.json`
(449s) and `verification-report.json` (481.1s).

| Category | Weight | Score |
|---|---|---|
| narrative_and_player_causality | 14 | 4.60 |
| audiovisual_emotional_alignment | 16 | 4.10 |
| cinematic_composition_and_lens | 14 | 4.00 |
| score_coherence_and_sync | 12 | 4.70 |
| palette_light_and_render_cohesion | 10 | 4.40 |
| transition_and_state_integrity | 10 | 4.70 |
| creative_ambition_and_specificity | 10 | 4.70 |
| interaction_accessibility_and_variants | 6 | 4.25 |
| performance_and_implementation_fidelity | 5 | 4.50 |
| evidence_review_and_learning | 3 | 4.00 |

**Weighted 4.40. Floor 4.00.** Required: 4.75 and 4.30. Confidence: high on
narrative, score, transition and implementation, where the evidence is fresh,
independent and re-derived; **moderate on composition and palette**, because the
only independent eyes that looked at those frames looked at different frames.

## 9. Protected strengths

Repair must not damage any of these.

- The hidden-pillar spend as it now stands: the answer inside the sounding
  question, at level, unaccented, gapless. Do not move it below the reveal guard.
- Instrument silence in the corridor, proven at 949 units, and the absence of any
  station voice this run — unless the owner personally spends it.
- ST-0's anchorlessness: no marker, no cue, no name, no score entry. If it is
  brightened, it must stay unannounced.
- The refusal-as-subtraction chain at the fabricator, in all three lanes.
- The hand-back to a frame with no annotation on it, and the carrier dying there.
- No cut, no letterbox, no forced look anywhere in the chapter.
- The reboard rung and the deferral design behind it (an unfindable rung reads
  idle, never `missing-marker`).
- The cut-line composition the blind viewer titled "The Long Light" — fix its
  scale, not its staging.
- The berth-ring fence, and the `?spacestation=` sandbox's proven byte-identity.
- The four superseded terms with their causes recorded inline. Do not delete the
  record of a dead term.

## 10. Minimal next loop

Smallest set that could plausibly clear the gate. One repair loop, not three.

1. **Cinematography + Integration — the cut line (J-1).** Decide reach or window:
   either restore enough closure that the authored range is reachable, or
   re-derive the window from the shipped damping and re-shoot. The authored
   occupancy must be met or re-authored with its derivation attached. *This is
   the single thing I would fix first,* because it is the only defect that
   simultaneously repairs a measured regression, a failing criterion, and half of
   the run's loudest cross-domain complaint.
2. **Cinematography — ST-0 (J-2) and the seam terms (J-6, J-7).** Raise the quad
   above the starfield peak or retire the reachability sentence and rest ST-0's
   legibility on drift explicitly; re-derive the thickness ceiling and L under the
   tangent-correct convention; get the cockpit furniture out of the aperture law.
3. **Integration + orchestrator — the record (J-3, J-8).** Recompile
   `defects.json` against the v9 pass, re-hash and complete
   `evidence-registry.json`, re-run the four-profile manual variant matrix over
   the repaired rungs.
4. **Orchestrator — the eyes (J-4, J-5).** Commission the moderation pass or
   re-source the three orphaned defects, fill `chapter-journey-evidence.json`,
   and re-run the blind read against the three current stills and nothing else.
5. **Owner — the four decisions only he can make:** reveal scale, corridor
   silence, the voice lane, and the predeploy/redeploy pair. Then a headed
   screening of the shot ladder on a real GPU, which I cannot provide and which
   no amount of headless evidence substitutes for.

I have not patched, expanded scope, accepted an exception, or published, and
none of the above authorises any of those.

Contract revision: `draft-v9`
