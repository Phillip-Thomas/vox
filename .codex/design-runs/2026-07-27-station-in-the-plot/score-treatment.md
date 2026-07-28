# Score treatment — the anchorage in the plot

**Run:** `2026-07-27-station-in-the-plot` · **Lane:** score · **Rev:** `497da1b`. Direction
candidate; audio unmodified; blind-authored.

**Thesis.** For nine chapters every pitch derived from a world — `buildPlanetProfile(seed)`
gives tonic, mode, genome, rhythm cell, tempo, meter. **The anchorage has no seed.** First
location that is not a world, so the first the score cannot derive — and today the first
silent one: `?anchorage=1` swaps the React root, so `AudioDirector` never mounts
(`main.tsx:22`, `App.tsx:1504`). That is the chapter.

## 1. Causal need — the lamp that blinks without a sound

**Reject base expansion as the engine** — it restates `ch9-settle`, and a chore gate is a
signpost. Keep it as **duration**.

**Claim the radio — as a pitch, never a voice.** A voice implies a person, a relationship, a
thread this chapter must not spend. Nor need we invent the object: `WreckRelay.tsx` has
`LIVE_BEATS = {'ch3-signal','ch4-vigil','ch4-arrival','done'}` — dark across
ch4-audit→ch9-hearth, **lit again at `done`**, pulsing `0.5+0.5*sin(t*2.2)`, commented *"the
carrier stays up; the audit is in progress."* A carrier already burns through free play,
unheard.

**The arithmetic is a gift.** `2.2 rad/s` = a `2.856 s` period; one 4/4 bar at 84 bpm =
`2.857 s`, inside the shipped `TEMPO_MIN 66`–`TEMPO_MAX 88` band. The lamp already beats one
bar per breath, and nothing visual need change.

**Mechanism.** The carrier acquires a pitch and enters the harmony brain as a **held pedal**
under free play. The chord walk (§6.5) now scores candidates against a foreign tone as well
as the tension curve; because its job is *never a wrong note*, it bends **both** worlds'
harmonic language to make the intruder belong. The player feels: **my home keeps changing
shape to hold something that isn't from here.**

Causal because it is also the destination — the anchorage's key is the one where that pitch
is **tonic**, in the player's ears for hours before a place is named. Already shipped:
`planApproachModulation(current, dest, window)` takes `dest: KeySpec = {tonicPc, mode}` —
**not a seed** (`approachModulation.ts:22,97`).

**First perception is not the carrier — it is the first chord that bends around it.** The
pedal fades in under the floor through a named §8.6 slew; then at a phrase boundary the pad
choir opens *around* it. A music event, not a signal.

## 2. What the station means

**The concourse is the first heterophony.** Every world here is monothematic.
`AGENTS_PER_CONCOURSE = 46` against `FLOOR 14 / COUNTER 9` — the loud room by construction,
and the first where the player hears **tunes that don't share their DNA**: fragments seeded
off each vendor's persona, rendered onto the station chord. All of it *legal*: everyone fits,
the bureaucracy works.

**Counter and floor are the return of the grid.** `organic → 0`, machine-perfect (§8.2).
Already written: `ch4-arrival` shipped *"the SQUARE WAVE returns underneath, the ch1 timbre
as a foreign body in the living world's mix"*, and `ch4-audit` scores the Authority in
square. **Chip already means institution here** — so a bureaucratic hall in quantized square
reads both ways for free: naive, cold office music; deduced, the terminal.

**The blank is a chord that stops moving.** Ruling #4 forbids true silence, so it is not
absence — it is the one thing this engine has never done: **stop developing.** Harmonic
rhythm to slowest, then held. No motif, no cue.

## 3. The shape — the room arriving

**Pressurisation is the cue, and it exposes a defect.** Bed reverb wet is
`REVERB_WET_MAX × g.reverb × atmosphere` (`bedEngine.ts:~1238`) — *planetary air density,
never walls* — so a station renders **bone dry** today. The fix is already computed: drive
`atmosphere` from `DockReadout.pressureKpa / STATION_PRESSURE_KPA (101.3)` and the 2.0 s
`pressurising` phase **is** the reverb arriving. The room fills with air and sound becomes
possible in one gesture.

**The dock timeline is already two bars.** `DOCK_TOTAL_SECONDS = 5.7`; two bars at 84 bpm =
`5.714 s`. Every `DockEffect` exit (1.1 / 3.1 / 4.1 / 5.7 s) sits within **64 ms** of a
sixteenth, and `disembark` lands on the downbeat of bar 3 — grid-perfect for an inaudible
retime.

| Anchor | Score |
|---|---|
| `carrier-acquired` → `carrier-bends-home` | Pedal in below the floor, **no cue**; then **first perception** — the first accommodating voicing. |
| `departure-committed` | `launch`→`deepSpace`; all thins and the pedal is the loudest thing out there — no longer foreign, just alone. |
| `berth-detected` (5200) | Modulation window opens. **The chapter's one mediant** — lit band, dark mass. |
| `clamps-engaged` | `scheduleHit('boom','bar')`; visuals chase the audioTime. Not a braam. |
| `pressure-equalised` | Reverb arrives on the pressure rail. |
| `hatch-open` | **Wind to zero** — gust wash, tremolo, pan drift, stopped. First interior. |
| `concourse-entry` | Heterophony; crowd warmth. |

**Carries:** the tuned sub keeps the player's world-motif underneath — the submergence device
(§8.4), new cause. "One fire behind you," made structural.

**Breaks:** the **lead does not play in the concourse. Not once.** Withholding the rare
entrance inside a *dense* texture is far stronger than in a sparse one.

**Falls silent, and is replaced:** the world-clock tick, nine chapters out-of-grid because
"that rule is the device" (§8.1). No descent, warp or depth here — but an institution's
clock. **Owner ruling requested:** here, once, the tick is *quantized*. World-time and
music-time agree, as the relay's 84 bpm breath foreshadowed by accident.

## 4. Reveal budget

- **No warp grammar** — forced BUILD, riser, half-time flip and exit `boom` belong to A5.
- **The docking bloom must measure smaller than A4's.** An arrival, not an awakening: no new
  hit type, no braam, and **no mediant at `concourse-entry`** — the awe chord says *vast*;
  this is a market.
- **The crowd never gets a menace cue.** A sting on people who look like W-7744 authors
  pursuit. Score them as *warmth the player has no part in*.
- **The blank gets no motif.** A theme promises a payoff, and the payoff is unauthored.
- **Chip texture is positional, never attached** — `counter`/`floor` only. The moment it
  follows the player, the score has stated the pillar.

## 5. Biggest risk

**The pedal makes both worlds sound broken rather than unresolved, and the player quits
before ever leaving.** Free play is unbounded; a foreign tone held for hours against a tonic
the brain can't voice comfortably is a wrong note that never ends.

Control: choose the pitch **as a function of both tonics** — a legal 9th or 6th colour to
each, a chord tone of neither, so the discomfort is *ambiguity*, not dissonance, and a
voicing always exists. Prove it with a 60-minute pedal soak: zero legality violations, zero
held-chord deadlock, zero tabu violation. The harness caught this class once (Lydian freeze →
`HELD_RELAX_BARS`).

## Asks

- **Chapter:** `storyLeads: true` returns `{kind:'none'}` — **a story mood leading the
  approach disables the shipped modulation.** Bed-score it, or author the modulation in the
  mood. Also: what grants `carrier-acquired`, and does it survive both worlds?
- **Cinematography:** `AnchorageSandbox` hides its dock cut on a black frame. **The picture
  may cut there; the score must not.**
- **Engineering:** a station scene is one compile-enforced `BED_SCENE_POLICY` row. And no
  enclosure signal exists in audio, though `shelterSystem.ts` already flood-fills
  `interiorCells`/`insulation`, unread — one `BedSignals.enclosure` field, not a subsystem.

**Evidence:** the pedal soak; free-play A/B with and without the pedal; reverb-arrival and
lead-muted concourse excerpts.
