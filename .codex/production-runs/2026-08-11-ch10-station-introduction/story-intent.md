# Story Intent — ch10 station introduction (run one: cold / ask / transit)

Author: Chapter Director
Status: ready_for_independent_treatments
Contract target: `ch10-station-introduction` revision `1`
Production lock: `production-lock.md` / `production-lock.json` (2026-08-11T17:06:29-04:00) — binding.

## Thesis

Chapter 9 ended on *"home is the distance you can keep alive."* Chapter 10 is the
discovery that one thing inside that distance was never home's to give. The second
hearth's core runs on a bonded cell — an **issued** component: not dug, not grown,
not salvaged, not fabricable. The first need a world cannot answer sends the player
back to the wreck, to the one channel that never closed, to **ask** — and the answer
comes back before the asking finishes. A bearing is issued; the going is the
player's. The run ends at the threshold: the station resolved from a point of light
into a place, never entered. The station is never the actor. The player asks, claims,
flies, and stops.

The chapter's entire hidden-pillar spend is one fact: **the relay answers too fast.**
Naive reading — registries are indexed and radios are fast. Deduced reading — she
queried her own network and it did not need to look anything up.

## Grounding

- Affected shipped beats and seams:
  - `ch9-hearth` close and the `done` free-play seam — untouched in copy and feel;
    baseline frames `evidence/baseline/01_124s…`, `02_127s…`, `03_130s_done_freeplay-seam.png`,
    `04_138s_done_freeplay-settled.png`; UX inventory in `shipped-ux-baseline.json#doneFreePlayInventory`.
  - New beats `ch10-cold`, `ch10-ask`, `ch10-transit`, plus prelude `ST-0` inside
    `done` free play (lock `prelude`).
- Runtime references:
  - `main/src/story/world/WreckRelay.tsx` — `LIVE_BEATS` includes `'done'`: the
    carrier is already lit through free play; `wreckRelayHandle.position` exists for
    the marker bridge. The relay is planted at the crash site on the **first world**.
    `main/src/story/world/` is NOT in allowedPaths, so no new comm prop can exist on
    Tidegarden — the ask therefore happens at the shipped relay, and ch10-ask
    contains a return crossing in ch8 grammar. This is a constraint I accept and
    endorse: the ask belongs at the site of embodiment.
  - `main/src/state/systemFlight.ts#commitSpaceStationTarget` — shipped station
    targeting, same epoch discipline as planet targets, deliberately never touching
    `activePlanetId`.
  - `b9335b9` — `state:space-station/targeted` and the `state:space-station/target=`
    claim (suffixed with the station worldId),
    producers + registry-gate patterns already shipped, with the pinned invariant
    that the planet claim is undisturbed. ch10's registry entry claims these
    existing refs; no station-residence vocabulary is needed this run (we never dock).
  - `main/src/components/systemCompanionBodiesModel.ts#companionCelestialPlacement` —
    ST-0 machinery (cinematography treatment Appendix A: station at 6,976 in the
    story system; on-foot far plane 6,000; surrogate placement is the shipped
    solution).
  - `main/src/game/spaceStation/spaceStationDevFlag.ts` — sandbox gate; story-mode
    exposure becomes a milestone predicate (lock's permitted mechanics item #2).
  - `main/src/story/storyObjectiveGuidance.ts` — ch8 ladder grammar
    (`ch8:launch:reboard` etc.) is the template ch10 flight objectives reuse verbatim
    in shape and register.
  - `main/src/story/emergentStoryDirector.ts` — WRECK RELAY third-register caption
    precedent ("PRESSURE BOUNDARY HELD · PASSIVE BEACON RESTORED", header
    `WRECK RELAY`): telegraphic caps, `·` separators, no first person.
- Canon references: signed A4→ch9 contract
  (`.codex/production-runs/2026-07-13-distance-between-fires/scene-contract.json`);
  2026-07-27 council treatments (unsigned candidates — the six-beat shape's first
  three beats survive, amended below); planted seed "ATTACHED (ADVISORY)" (the
  manifest) is deliberately echoed once.
- Evidence references: `shipped-visual-baseline.json` (MF-1/MF-2/MF-3, night-sky
  reference frames `sky_161s`/`sky_163s`), `shipped-ux-baseline.json`
  (lifecycle measurements, duplicate-cue finding).

## How this departs from the council's chapter treatment

1. The treatment left the relay's location abstract; the shipped runtime puts it on
   the first world. ch10-ask therefore includes an interplanetary return leg. This
   converts "one fire behind you" from an image into a route, and it is the reason
   the ask feels like a pilgrimage rather than a menu.
2. Objective ids move from `anchorage:*` to `station:*` (the name is retired).
3. The fabricator refusal is added between fault-read and the ask, so the player
   exhausts self-sufficiency on camera before asking another party for anything —
   the chapter's thesis earned through the shipped craft verb.
4. Beats four through six remain deferred exactly per the lock.

## Entry mechanism and the ch9 seam (protecting the close)

`ch9-hearth` still ends with `completeStory()`; nothing about the close changes.
ch10 is a **re-activation from `done`**: the story resumes when all of —

- durable `storyComplete` + `twoWorldHandoff` set (shipped);
- accumulated `done` free-play time ≥ `CH10_FREEPLAY_GRACE_SECONDS` (named constant,
  owner-tunable — this is the "do not rush" dial);
- local nightfall band entered on Tidegarden;
- player within `CH10_HEARTH_NOTICE_RADIUS` of the second hearth.

The fault is **noticed, not announced**: no event fires anywhere the player is not.
If the player never comes home at night, the story waits indefinitely. Durable
`storyComplete` stays true throughout ch10 (it records ch1–9); story-active state is
separate. Integration must verify no sandbox affordance (e.g. ORBITAL SCAN mount)
regresses incoherently when the story re-activates — expected behavior is the same
as any active beat.

Resume ladder: `storyComplete` + no ch10 milestones → `done` with the trigger armed;
`story:ch10-*` milestones → the corresponding beat. Every ch10 beat is a
`?story=` jump target under its own beat id, whose seeding includes the **built habitat world state**
(reusing the movie shelter builder with the egress below), which also prevents ch10
inheriting MF-2's class of stall at its own jump targets. (`ch9-hearth`'s own MF-2
stall is out of scope; routed note below.)

## MF-1: where ST-0 is perceivable, stated per lane

- **Manual lane:** ST-0 mounts at `completeStory()` (the `done` seam). Perceivable
  any clear night, outdoors, on Tidegarden, from the seam onward and throughout
  ch10-cold/ch10-ask nights. Manual players built their own shelter with their own
  egress; the shipped night sky above the second hearth is proven
  (`sky_161s`, `sky_163s`).
- **Movie lane:** the certified movie shelter is a doorless sealed box (MF-1), and I
  do not fight that at the `done` seam — the movie's `done` dwell is roofed and
  stages nothing. The movie lane's first ST-0 perception window is at **ch10-cold
  entry**: `emergentMovieRuntime.ts` (allowedPaths) opens one authored egress face
  after safe-rest completes / at ch10-cold entry, gated on the movie runtime so a
  human-built shelter is never touched; the autopilot's night walk from the hearth
  to the Kestrel Fabricator (C2 below) passes under open sky with ST-0 above it.
  That traverse is the ST-0 evidence window (LOW strip + the `capture.st0.sighting`
  HIGH hero still).
- **Guarantee constraint (to Cinematography):** ST-0's transit must recur such that
  any ≥3-minute outdoor night window contains at least one full crossing
  (`ST0_TRANSIT_PERIOD` named constant; ~45s horizon-to-horizon per Appendix A), so
  neither lane can miss it by timing.

ST-0 keeps the lock's law absolutely: **no marker, no cue, no caption, no name** —
in this run it is never acknowledged in any register. The player's connection of
dot → bearing → place is made by geometry alone (the claimed bearing points where
the dot crosses; Cinematography owns bearing/ground-track agreement).

## Dramatic contract, per beat

### ST-0 (prelude, inside `done` — not a beat)

- Player action: none required. Look up, or don't.
- Emotional before/after: quiet ownership → a tiny asymmetry in the sky. Wonder
  with a grain of unease. It asks nothing; that is why it works.
- Information conveyed: something up there keeps time. (A route intelligence sees a
  schedule; a new player sees a satellite. Both are correct.)
- Reality ceiling: `alive`, unchanged. ≤1 draw call, no new shader (lock budget).
- Tutorial purpose: none. It is the only content in the game that is pure noticing.

### ch10-cold — notice, diagnose (Tidegarden, night)

- Player action: return to the hearth at night; read the core's fault record
  (`[F]`); carry the fault to the Kestrel Fabricator and attempt to fabricate a replacement
  (`[F]`, the story interaction prompt); receive the refusal.
- Emotional before: settled; the home is finished and working.
  After: the first need home cannot answer — a cold spot inside the ownership, not
  fear. The ch9 close is *extended*, never contradicted: the distance is still kept
  alive; one part of keeping it alive was never hers.
- Information: the core draws on one bonded cell; the cell is an issued component;
  fabrication is not authorized; everything else she has ever had was dug, grown,
  salvaged, or repaired.
- Intended ambiguity: who issues issued components, and why a pattern "is not held."
- Tutorial verb: **diagnose** — reading a machine's own account of itself (new verb;
  first-class reuse of the interact surface).
- Agency: full player control throughout; no camera authority; no letterbox.
- Reality ceiling: `alive`, no change.

### ch10-ask — return, query, claim (crossing back; the wreck relay)

- Player action: reboard the Kestrel, fly the crossing back to the first world
  (ch8 grammar unchanged, opposite direction), land at the wreck site, request a
  source at the relay (`[F]`), then — the agency peak — **claim** the attached
  bearing (`[F]`). The story waits at the claim forever; claiming is a commitment
  the player performs, never an event that happens to them.
- Emotional before: need without an address.
  After: an address without an invitation — plus the chapter's one shiver: the
  answer arrived before the asking finished.
- Information: a source for issued components exists, on record, in this system; a
  bearing is attached, advisory. Nothing about the station's interior, wares,
  population, or disposition is stated. The reply is a record, not a voice.
- Intended ambiguity: the reply's speed (the pillar spend); whether "on record"
  means the network already knew what she would ask.
- Tutorial verb: **ask** — the game's first outbound request to another party.
- Agency: full control; flight rescue semantics identical to shipped ch8 (reused,
  not redesigned).
- Reality ceiling: `alive`, no change.

### ch10-transit — fly the claimed bearing (space; ends on the shot)

- Player action: ignite, fly the bearing to a non-planet target (first use of
  `commitSpaceStationTarget` in story, wrapped in the story predicate), hold course
  while the point becomes a seam of light becomes a place; complete at standoff.
- Emotional before: commitment. After: scale and smallness — then **threshold
  restraint**: the run ends with the station as a shape and the player outside it.
  Hand-back to free play happens in space, station visible, bearing held; the
  player may proceed no further (no dock affordance exists this run) or turn for
  home. Home continues; the ch9 close survives with a third light added to its
  geometry.
- Information: the station is real, large, edge-on a line, inhabited by
  implication only (kept lights).
- Intended ambiguity: whose light it is. "a light someone else keeps alive" — naive:
  other people live there; deduced: the network keeps its own lights, and "someone
  else" may be a self-description she cannot yet parse.
- Tutorial verb: **fly a bearing to a non-planet target** (new flight target class,
  mechanically shipped).
- Agency: flight control throughout; one optional agency dip at
  `anc.ch10.station-resolved` — ≤3s diegetic thrust-cold hold (engines cold at
  resolve), look fully live, reduced-motion neutral, Cinematography decides whether
  to take it; mandatory hand-back to free flight after the closing caption.
- Reality ceiling: `alive`, no change. No galaxy composition (A5 owns that image);
  no warp vocabulary in any register.

## Character and causal spine

| Character/presence | Desire | Opposition | Tactic | Belief before | Belief after | Player-visible evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Terra-in-the-suit (player) | keep the two-fire home alive | an issued component degrading; self-sufficiency exhausted | diagnose → attempt fabrication → ask the channel → claim and fly | "home is the distance you can keep alive" is complete | one strand of home was always on someone else's ledger; asking is a thing that can be done | fault record; fabricator refusal; the claim action; the resolved station |
| The route network (hidden narrator, via relay) | (unstated; never the actor) | — | answers only when asked; instantly | — | — | reply speed; "BEARING ATTACHED (ADVISORY)" echo; nothing else |
| Worker 9 (dormant co-presence) | — | — | — | — | — | deliberately withheld this run (his trace is budgeted to the counter beat, run two) |
| The station | none — it is a place, not an actor | — | — | — | — | a point that keeps time; a seam of light; a shape with kept lights |

Causal chain, setup → payoff: ch9's core install (setup) → fault (payoff/setup) →
fabricator craft verb from ch9 (setup) → refusal (payoff/setup) → relay's ch3/ch4
history + lit-at-`done` carrier (setup) → the ask (payoff/setup) → ch8 flight
(setup) → transit (payoff/setup) → ST-0's dot (setup) → the resolved shape
(payoff/setup for run two's apron).

## Reveal and payoff ledger

| ID | Truth or question | Level before | Level after | Setup refs | Payoff refs | Leak/understatement risk |
| --- | --- | --- | --- | --- | --- | --- |
| R1 | the narrator is the network (hidden pillar) | author-only, seeded | inferred-nudge (one) | crawl, manifest "ATTACHED (ADVISORY)", carrier lit at done | `anc.ch10.relay-answer` + one lowercase line | leak if the caption is knowing; the line states only speed, never meaning |
| R2 | inhabited space exists beyond the two worlds | open | visible (as place, not people) | ST-0 | `anc.ch10.station-resolved` | overstatement if any copy characterizes the interior — forbidden this run |
| R3 | issued-economy: a self that cannot make a thing must meet one that can | new | visible (as theme) | fault record, refusal | the claim | preachiness; keep it in REGULATION nouns, never editorialized |
| R4 | who issues; whether she asked herself | author-only | author-only (protected) | — | budgeted A7/A8 | none — nothing this run may touch it |
| — | non-spends (hard) | — | — | — | — | no warp, no W-7744, no Makers, no crowd, no interior, no station proper name, no Worker 9 trace |

## Beat and agency ledger

| Beat | Shared anchor | Event | Cause/payoff refs | Agency type and mandatory path | Fallback/rescue semantics | Required hand-back | Acceptance signal |
| --- | --- | --- | --- | --- | --- | --- | --- |
| done (prelude) | — (ST-0 anchorless by law; evidence point `capture.st0.sighting`) | a moving point of light | setup for R2 | none; pure free play | n/a | n/a | ST-0 crosses within any 3-min night window |
| ch10-cold | anc.ch10.cold-noticed | story re-activates at the hearth at night | ch9 core install | mandatory, player-paced; no forced look | none needed (no failure states) | continuous control | beat entered only with player present |
| ch10-cold | anc.ch10.fault-read | fault record shown | → R3 | mandatory interact | objective persists until done | control retained | REGULATION record captioned; milestone set |
| ch10-cold | anc.ch10.fabrication-refused | fabricator refusal | craft verb (ch9) → R3 | mandatory craft-attempt | persists | control retained | refusal captioned; beat advances |
| ch10-ask | anc.ch10.relay-ask | source request committed | relay history (ch3/ch4) | mandatory interact after return flight (ch8 rescue semantics reused for the crossing) | flight rescues as shipped in ch8; relay objective persists | control retained | request line paints |
| ch10-ask | anc.ch10.relay-answer | the instant reply | → R1 (the spend) | none — it happens *to* the asking | n/a | control never taken | reply paints inside the request's own caption breath |
| ch10-ask | anc.ch10.bearing-claimed | player claims the bearing | → R2, run-two setup | **rite**: story waits indefinitely; claiming is the commitment | none; waits forever | control retained | `commitSpaceStationTarget` fires; `state:space-station/targeted` appears; planet claim undisturbed (b9335b9 pin) |
| ch10-transit | anc.ch10.transit-ignite | launch, ch8 grammar | ch8 | mandatory travel | ch8 semantics | control retained | flight phase leaves surface |
| ch10-transit | anc.ch10.seam-of-light | edge-on reveal: a line with no body | ST-0 → R2 | in-flight; no authority change | n/a | control retained | station subtense crosses the seam threshold (named constant) |
| ch10-transit | anc.ch10.station-resolved | yaw; the line becomes a place; standoff | R2 payoff; run cut line | optional ≤3s diegetic thrust-cold hold, look live (Cinematography's call) | n/a | mandatory: full flight control after closing caption | standoff distance reached; closing caption; hero still |
| ch10-transit | anc.ch10.threshold-handback | free play resumes in space | ch9 close preserved | free | n/a | complete | objective cleared; no marker; durable milestones persist |

## Guided segments — complete lifecycle

Ladder pattern: within a beat, objectives replace on progress (shipped pattern); **no
objective id spans a beat boundary** — each beat enters with a fresh id, so the ch9
clear-then-reactivate double-enter shape is impossible in ch10 by construction. One
`objective-enter` cue per activation; completion acknowledged by caption + work-order
clear + score move (shipped grammar); no progress-cue type is invented. All markers
resolve from existing handles (habitat core, fabricator, hatch, flight targets,
`wreckRelayHandle`); no marker-requiring objective is published before its handle
exists (the ch9-settle `scan-waterline` 4s gap must not recur — cross-world
objectives are marker-gated per rung below). Quit-to-menu mid-beat resumes at the
beat per the ladder; beat change clears all guidance; ST-0 is world state, not
cutscene state, and never clears.

### ch10-cold

| # | Objective id | Kind | Marker label (exact) | Standing work order | Entry/progress/completion | Clear/replace |
| --- | --- | --- | --- | --- | --- | --- |
| C1 | `station:fault-read` | interact | `HABITAT CORE · READ THE FAULT` | "STAND AT THE SECOND HEARTH CORE." / "[F] READ THE HEARTH FAULT." | one enter cue; marker distance is progress; completion = fault record caption pair | replaced by C2 |
| C2 | `station:fabrication-attempt` | craft | `KESTREL FABRICATOR · ATTEMPT REPLACEMENT` | "TAKE THE FAULT RECORD TO THE KESTREL FABRICATOR." / "[F] ATTEMPT TO FABRICATE A REPLACEMENT CELL." | one enter cue; completion = refusal caption pair; beat advances | cleared at beat exit; ch10-ask enters fresh |

Fallback: none needed; both objectives persist until performed; the player may
wander freely (the fault does not worsen on a timer — menace-by-procedure, not
menace-by-clock).

### ch10-ask

| # | Objective id | Kind | Marker label (exact) | Standing work order | Notes |
| --- | --- | --- | --- | --- | --- |
| A1 | `station:return:reboard` | travel | `KESTREL HATCH · REBOARD` | "RETURN TO THE KESTREL." / "FOLLOW THE HATCH MARKER AND [F] BOARD." | grammar identical to `ch8:launch:reboard` — deliberate reuse |
| A2 | `station:return:crossing` | travel | `ORIGIN WORLD · COURSE` | "FIND THE ORIGIN WORLD." / "CENTER IT AND CROSS." | mirrors `ch8:crossing:acquire-sibling`; approach-envelope hold sub-state drops `requiresMarker` exactly as ch8's comment prescribes |
| A3 | `station:return:landfall` | travel | `WRECK SITE · LAND` | "FOLLOW THE WRECK SITE MARKER DOWN." / "LAND NEAR THE RELAY." | mirrors ch8-landfall grammar |
| A4 | `station:relay-query` | interact | `WRECK RELAY · REQUEST A SOURCE` | "FOLLOW THE WRECK RELAY MARKER." / "[F] REQUEST A SOURCE FOR A BONDED CELL." | marker via `wreckRelayHandle` (on-world only) |
| A5 | `station:bearing-claim` | interact | `WRECK RELAY · CLAIM THE BEARING` | "A BEARING IS ATTACHED (ADVISORY)." / "[F] CLAIM THE BEARING." | the rite; waits indefinitely; completion commits the station target |

Fallback: crossing reuses ch8's shipped rescue semantics untouched. If the player
lands elsewhere on the first world, A3→A4 marker guidance persists; nothing punishes
detour.

### ch10-transit

| # | Objective id | Kind | Marker label (exact) | Standing work order | Notes |
| --- | --- | --- | --- | --- | --- |
| T0 | `station:transit:reboard` | travel | `KESTREL HATCH · REBOARD` | "RETURN TO THE KESTREL." / "FOLLOW THE HATCH MARKER AND [F] BOARD." | UX-1 rung: the claim is performed on foot at the relay, so the beat opens with a locator to the ship (live Kestrel pose), never an input the player cannot press; ch8 reboard grammar reused verbatim |
| T1 | `station:transit:ignite` | interact | `KESTREL FLIGHT CONTROLS · IGNITE` | "BRING THE KESTREL ONLINE." / "HOLD [SPACE] TO IGNITE AND LIFT." | `requiresMarker` false, as ch8; publishes only once aboard — on foot it never publishes |
| T2 | `station:transit:hold` | travel | `ISSUED BEARING · HOLD` | "FLY THE CLAIMED BEARING." / "FOLLOW IT UNTIL THE SOURCE RESOLVES." | marker = committed station target; producers exist (b9335b9) |
| T3 | `station:transit:resolve` | wait | `ISSUING STATION · RESOLVING` | "THE SOURCE IS RESOLVING." / "HOLD." | `requiresMarker` false; completes at standoff; closing caption; objective clears to nothing (hand-back) |

Fallback: if course drifts, T2 persists (travel objectives don't fail); autopilot
holds the bearing with committed goals + nudge deferral; `BEAT_TIMEOUT` per beat as
backstop, with honest completion required well inside it across ≥3 cold runs.

## Candidate copy (all of it), with the both-readings audit

Registers: **REG** = REGULATION (issued/machine text, caps, euphemism,
menace-by-procedure); **RELAY** = WRECK RELAY third register (telegraphic caps, `·`
separators, header `WRECK RELAY`, no first person); **low** = awakening voice
(lowercase, impersonal-aphoristic — matching the shipped ch5–9 emergent movement
voice, which avoids "i").

| # | Line | Register | Naive reading | Deduced reading | Timelessness check |
| --- | --- | --- | --- | --- | --- |
| K1 | `(the hum has dropped a step. cold is coming through a wall you sealed yourself.)` | low | the heater is failing | the vessel she maintains is degrading and she feels it as sensation | clean |
| K2 | `HAB CORE · POWER: ONE BONDED CELL · CONDITION: DEGRADING` | REG (core readout, at anc.ch10.fault-read) | equipment status | the body's power was metered from the start | clean |
| K3 | `BONDED CELL IS AN ISSUED COMPONENT. FABRICATION IS NOT AUTHORIZED.` | REG | proprietary-part bureaucracy | everything she has was issued through the network; the hearth runs on its leash | "issued/authorized" is Kafka, not current-affairs; clean |
| K4 | `(a world gives stone, water, wood. it does not give this. this was issued.)` | low (after K3) | the part can't be made here | the first object outside the extraction/craft loop of her whole embodied life | clean |
| K5 | `PATTERN NOT HELD · CLASS: ISSUED COMPONENT · SOURCE NOT HELD LOCALLY` | REG (fabricator readout, header `KESTREL FABRICATOR`, at anc.ch10.fabrication-refused) | the printer lacks the blueprint | the local self does not contain this knowledge; it lives in the network | clean; header gives her own tooling attribution symmetry with K2/K7 |
| K6 | `(the channel at the wreck never closed. asking is still a thing that can be done.)` | low (bridge into ch10-ask) | the old radio still works | her own connection persisted through everything; asking = querying herself | agency stays with the player — the fabricator never instructs | 
| K7 | `SOURCE REQUEST LOGGED · COMPONENT: BONDED CELL (ISSUED)` | RELAY (at anc.ch10.relay-ask) | request transmitted | the network formally receives a request from itself | clean |
| K8 | `SOURCE ON RECORD · ISSUING STATION · THIS SYSTEM · BEARING ATTACHED (ADVISORY)` | RELAY (at anc.ch10.relay-answer, painting inside the request's own caption breath) | a depot registry hit | it did not need to look; "ATTACHED (ADVISORY)" is the manifest's exact phrase returning | deliberate seed echo; no proper name coined |
| K9 | `(the answer came back before the asking finished.)` | low | radios are fast, registries are indexed | she asked her own network | THE pillar spend — states only speed, never meaning; nothing else this run may gesture at R1 |
| K10 | `(issued, not offered. the going is still yours.)` | low (at anc.ch10.bearing-claimed) | a bearing is data, not an invitation | the network issues; the emergent self chooses — the station is never the actor | clean |
| K11 | `(both fires behind you now. ahead, a light someone else keeps alive.)` | low (closing, at anc.ch10.station-resolved) | an inhabited station | the network keeps its own lights; "someone else" is a claim she cannot verify | extends the ch9 close's geometry without remixing its words; flagged for owner taste |

Copy rules binding this run: ST-0 gets zero copy in any register. No line
characterizes the station's interior, wares, crowd, or disposition. No proper name —
"ISSUING STATION" is a functional REGULATION noun, and telemetry uses the frozen
`:a`-index worldId grammar untouched. K1's claims are honest at LOW (hum = score-side, see
Score ask S1; "cold" is non-visual — no frost is claimed because no world-prop
surface exists in allowedPaths to render one). ch1–ch9 copy is untouched.

## Named dramatic anchors

`anc.ch10.cold-noticed` → `anc.ch10.fault-read` → `anc.ch10.fabrication-refused` →
`anc.ch10.relay-ask` → `anc.ch10.relay-answer` (answer nested inside ask's phrase —
the relationship IS the meaning) → `anc.ch10.bearing-claimed` →
`anc.ch10.transit-ignite` → `anc.ch10.seam-of-light` → `anc.ch10.station-resolved` →
`anc.ch10.threshold-handback`. No raw timestamps anywhere; ST-0 is deliberately
anchorless (it may never acquire a cue), with evidence point `capture.st0.sighting`
outside the anchor grammar. Hero HIGH stills (lock's three): `capture.st0.sighting`,
`anc.ch10.seam-of-light`, `anc.ch10.station-resolved`.

Deliberate silence/stillness: `done` free play stays cueless and objective-less as
shipped; ST-0 silent; the gap between K7 and K8 is the chapter's most important
duration and it is approximately zero — Score, not the timeline, owns making that
audible.

## Position on the first-perception question (for peers to answer, not obey)

The council left open whether first perception is the ST-0 sky point, the transit
seam, or the score pedal. My proposal: **perception arrives three times, in three
senses, at escalating commitment — sight, then information, then scale.**

1. **ST-0** (free play): the station as a *fact of the sky*. Free, unnamed, asks
   nothing. First perception for any player who looks up; never guaranteed for
   manual players who don't, and that is by design.
2. **`anc.ch10.relay-answer`** (ch10-ask): the station as an *address*. The first
   guaranteed perception on the mandatory path, and it is informational — a record,
   not a place.
3. **`anc.ch10.seam-of-light`** (ch10-transit): the station as a *place*. The
   signature image: a line with no body until the yaw.

The score pedal is deferred with its packet (lock), and I do not route around that.
But the stack leaves the pedal a doorway: Score may, in their treatment, give the
carrier a pitch **starting at `anc.ch10.relay-answer` and living only inside ch10's
beats** (no free-play pedal, no 60-minute soak obligation), so that the deferred
packet — if the owner later approves it — extends an established color backward into
free play rather than arriving orphaned. Whether that down-payment strengthens or
cheapens their thesis is their call to make in writing; if the triad cannot
reconcile the stack, the lock routes the tie to the owner.

## Constraints and questions — Score

Preserve: `done` free play cueless as shipped; ST-0 silent forever this run; the
ch9-hearth close cue (`sc.hearth.between-fires`, intensity 0.28 at the seam)
untouched; no station theme this run (its identity is unspent inventory); no menace
color anywhere — there is no antagonist in this chapter; no awe-mediant at
`anc.ch10.station-resolved` (their own treatment's rule, adopted: awe says vast,
this is a source); no warp grammar (BUILD/riser/half-time belong to A5). New MOODS
entries for all three beats; shipped ch1–ch9 cues regression-proved untouched
(lock). Protected audio paths untouched; evidence via OfflineAudioContext renders
+ combined-bus excerpts only.

Questions:

- **S1 (sync ask):** K1 claims "the hum has dropped a step." Can the ch10-cold entry
  cue realize that literally — the settled hearth bed dropping a step (their
  interval choice) at `anc.ch10.cold-noticed` — so the caption's claim is audible?
  If not, I will re-cut K1; the copy must not claim what the mix doesn't do.
- **S2:** `anc.ch10.relay-answer` — can "too fast" be made audible as rhythm: the
  reply landing inside the ask's own phrase (on its beat, not after it)? No sting,
  no hit type; the wrongness should be metric, not dynamic.
- **S3:** the return crossing reuses ch8 grammar — what does the crossing-back cue
  do that `ch8-crossing` didn't? Same grammar, opposite direction, colder purpose;
  I'd rather hear restraint than a new theme.
- **S4:** the pedal down-payment question above — take it, refuse it, or counter.
- **S5:** their council ask to me, answered: `carrier-acquired` does not exist this
  run as a free-play state; the carrier becomes score-relevant only inside ch10's
  beats (see S4). And re their `storyLeads` warning: ch10-transit needs no approach
  modulation this run (we never dock); if they want a modulation toward a
  station-key at T2/T3, they author it inside the mood and say so in the contract.

## Constraints and questions — Cinematography

Preserve: player-owned camera everywhere except the optional ≤3s resolve hold; no
letterbox at the relay reply (their own ST-2 rule, adopted: information, not
cinema); ch8 flight grammar and feel unchanged in both crossings; no galaxy in any
transit frame (`GalaxyImpostors` bloom at `atmosphereSpaceBlend ≥ 0.78` is A5's
image — do not frame it); no pursuit imagery, nothing that follows; `alive` is the
grade ceiling, no new family; ST-0 ≤1 draw call via `companionCelestialPlacement`
per their Appendix A (real `systemPosition` bearing agreement is theirs to
guarantee — the ground track and the flown bearing must be the same fact).

Questions:

- **C1:** ST-0 recurrence — accept the "≥1 full crossing per any 3-minute outdoor
  night window" constraint, or propose the period/phase math that better serves
  both lanes (`ST0_TRANSIT_PERIOD` is theirs to set, named).
- **C2:** the movie-lane shelter egress (MF-1 fix) — should the opening read on
  camera or happen off-frame before the autopilot's first outdoor step? My
  preference: off-frame; the movie should not photograph its own scaffolding.
- **C3:** `anc.ch10.seam-of-light` — the signature shot. At what subtense does the
  line read at LOW (no post, MF-3), and do they want the seam threshold constant
  tied to their framing rather than to raw distance?
- **C4:** `anc.ch10.station-resolved` — take or decline the ≤3s diegetic
  thrust-cold hold (their Appendix B pattern); the run cut line is this frame, so
  the standoff distance and portrait weighting are theirs to author. Letterbox: I
  ask for none, but will hear an argument.
- **C5:** marker framing for `ISSUED BEARING · HOLD` at a non-planet target through
  the existing marker bridge — any structural need I should know about before the
  contract freezes?
- **C6 (option, not ask):** the sandbox `◆ SHELTERED` thermal chip during ch10-cold
  — is a HUD-level cold read (chip state change) desirable, or does it violate the
  sandbox HUD's neutrality? Their lane; copy does not depend on it.

## Non-goals and protected strengths

Non-goals (lock's, plus narrative): `ch10-apron`/`ch10-counter`/`ch10-concourse`;
docking or its architecture (owner packet); station interior, market canon, NPCs,
vendor voice, crowd (a species, and absent this run); W-7744 in any form; warp or
any interstellar reference; the score pedal packet and soak; audio-at-the-station;
a station proper name; any Worker 9 trace (budgeted to the counter, run two); any
acknowledgment of ST-0 in copy; any second guidance system.

Protected strengths: the ch9-hearth close — ch10 extends its geometry ("both fires
behind you") and never devalues it; the hearth fault is noticed at night, in person,
never announced. ch8 flight feel, reused twice, changed zero. The WRECK RELAY third
register's integrity (telegraphic, no first person — the reply must feel like a
record). The `done` free-play silence. The hidden pillar's budget: exactly one
nudge (K9), and K8's seed echo; nothing else. `state:space-station/*` semantics: the
station never becomes the resident world (b9335b9 pin stays green). Sandbox
byte-identity: `?spacestation=` behavior unchanged; the dev flag becomes a
story-milestone predicate; pre-claim, the station neither renders as an approachable
body in story mode (beyond ST-0) nor accepts a target commit.

## Lifecycle defect disposition (commissioned decision)

- **ch9 `settle:wait-night` double-enter** (clear-then-reactivate in
  `enterEmergentStoryBeat`): ch10 avoids the shape by construction (no id spans a
  beat boundary). Additionally, **fix the shipped defect in this run** — the cause
  file `emergentStoryDirector.ts` is in allowedPaths, the fix is lifecycle wiring
  (dedupe the re-activation of an identical objective across a beat boundary), it
  touches no copy, and the verifier can prove it mechanically: baseline cue count
  8 → 7, `oneCuePerActivation` true, no other trace delta. Routed to Integration
  with that exact acceptance signal.
- **ch9 `settle:scan-waterline` ~4s missing-marker**: cause sits in marker-bridge
  resolution timing, likely `StoryDirectorDriver.tsx` — **not in allowedPaths** —
  so it is routed, not fixed. ch10 inherits the design rule instead: no
  marker-requiring objective publishes before its handle resolves.
- **MF-2 (`?story=ch9-hearth&movie=1` stall)**: out of this run's beat set; routed
  as a known-defect note. ch10's own jump targets seed the habitat world state so
  the class does not recur at ch10.

## Routed decisions (owner's, named — not decided here)

1. **Station registry designation.** Does the station ever carry a proper
   designation in REGULATION copy (needed at the counter in run two)? This run
   coins nothing: "ISSUING STATION" as a functional noun, frozen worldId grammar in
   telemetry only.
2. **K11 owner taste flag.** The closing line deliberately echoes the ch9 close's
   geometry ("both fires behind you"). I judge it an extension, not a remix; the
   owner should read K11 against the shipped ch9 line before the copy pass locks.
3. **Docking architecture** — already routed by the lock (owner packet before run
   two); restated here as not blocking, since nothing in this run docks.
4. **First-perception stacking** — only if the triad cannot reconcile the proposed
   stack (lock: triad settles first; owner only on a material taste tie).

## Chapter Director disposition

`ready_for_independent_treatments` — every beat above is implementable inside the
lock's allowedPaths with no invented canon: the relay, the fabricator, the flight
grammar, the station target commit, the telemetry producers, and the ST-0 placement
machinery all exist in the shipped runtime, and the four decisions that are not
mine to make are routed by name. Peers should answer S1–S5 and C1–C6 in their
treatments against contract revision 1.
