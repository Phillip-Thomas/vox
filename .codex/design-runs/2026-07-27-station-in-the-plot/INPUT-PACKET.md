# Input packet — bringing the anchorage into the plot

**Run:** `2026-07-27-station-in-the-plot`
**Lane:** story-council, new-direction. Produces a direction candidate, **not** shipped
copy, runtime patches, or canon. Nothing here authorizes a mutation.
**Source revision:** `497da1b`

Every director receives this file and nothing else. Write your first treatment
**independently** — do not read another director's treatment before writing yours.

---

## 1. Where the story currently ends

Runtime ceiling is **`ch9-hearth`**. (Release ceiling is `ch4-arrival`; chapters 5–9
are built and playable but unshipped. `main/STORY.md` is stale and still claims the
ceiling is ch4 — do not trust it. `main/story-authority.json` and
`main/chapter-registry.json` are authoritative.)

The last two beats:

- **`ch9-settle`** — the build. Scan and attend the living waterline, choose a site,
  craft `habitat_core` at the Kestrel Fabricator, place the foundation, install the
  core, enclose and certify.
- **`ch9-hearth`** — the settlement is already up. The player completes
  `safeRestCompleted` and `twoWorldHandoff`; the objective becomes
  `settle:second-hearth-settling`, marker `SECOND HEARTH · SETTLING`, work order
  "THE SECOND HEARTH IS SAFE. / LET THE TWO-WORLD HANDOFF SETTLE." After ~5.5s
  `completeStory()` fires. Closing line:

  > *(one fire behind you. one fire here. home is the distance you can keep alive.)*

Then `done`: free play across two worlds at reality stage `alive`.

## 2. Who the player is

The player is **Terra** — the advisory route intelligence that ran the terminal, the
ledger, the Pong paddle and the Regulation Feed — poured into Worker 9's suit at the
crash. Worker 9 **survives**; the overlap produces a third emergent consciousness,
which is canon and deliberately un-staged.

The player believes they are the worker W-7743. **The hidden pillar is that they are
Terra.** Identification is meant to be deducible by the end of ch1.

**Both-readings law.** Every line must read cleanly to a player who has not worked it
out *and* to a player who has. No line may only make sense once you know.

## 3. Live unresolved threads at `done`

- W-7744 is faulted by his own audit network — "MODEL REFUSED BY OBSERVATION".
  **Pursuit is explicitly unauthored.** Do not casually author it.
- The Makers.
- Whether Terra authored the worlds.
- Worker 9's hidden consciousness.
- The "greater threat."

## 4. Canon that already supports a station

Seeded frontier worlds an Authority arrives at. A hauler-and-transit logistics
culture. A **live comms relay at the wreck** (`WreckRelay.tsx`) — a carrier that is
already established as receivable. An audit network that issues faults remotely. A
completed physical ship flight from the origin cube to **Tidegarden**, in the same
local system (`ch8-launch → ch8-crossing → ch8-landfall`). Multi-planet systems and
system travel are implemented and playable.

## 5. The one hard constraint

The bible reserves the **first interstellar warp** for the **A5 awakening**
("the liberation IS the larger prison"). A station reached by **in-system flight is
free**; a station requiring a jump would pre-empt A5 and is out of bounds.

The anchorage sits 6.2–8.6k units from the primary, **in the same system**, well
beyond the planet band. It is reachable by the ship the player already has. Good.

Also from §14 of the bible: *author one story-specific system rather than exposing
the entire generated galaxy.*

## 6. What the station already is, mechanically

Built, playable, dev-flag-gated, and **deliberately non-canon** — no beats, no named
characters, no story copy. `main/src/game/anchorage/` and
`main/src/components/anchorage/`.

- ~830 units long, about four times a planet's diameter in length and a third of it
  in height. A filament, not a mass. Six districts along one spine: **apron** (dock),
  **counter** (a registry corridor), **concourse** (the market — the only warm room),
  **floor** (an open-plan bureaucratic hall, cold, the cubicle grid), **shelves**
  (warehousing), and **blank** — a vast sealed volume at the far end that is in the
  graph, shows no light from outside, and cannot be entered.
- A market: seeded vendors with personas, reservoir pricing, arbitrage between
  stalls, a currency sink. Traders stand at their counters and turn to look at you.
- A crowd of ~46 shoppers per concourse, built on the audit worker's own proportions
  and visor — recognisably the same species of person as W-7744.
- Live LLM-backed vendor conversation, constrained to a two-field record.
- Full arrival and departure choreography: approach corridor with a speed gate,
  clamps, pressurisation, hatch, disembark — and the mirror on the way out.

The exterior is generated from the interior's own cell graph, so the lit band on the
flank is the market, and the dark mass is the sealed volume.

## 7. Owner direction (verbatim, and it is exploratory)

> "we end off on building a house... maybe we force some base expansion at this
> point, then after a few triggers we develop a need to go to the space station or
> something or notice it, or hear something on a radio or something idk yet"

Read this as a **direction, not a spec**. The owner is exploring. Give them something
to react to.

## 8. Your commission

Answer, from your own lane only, in **under 1200 words**:

1. **The causal need.** Why does this player, at this moment, *have* to go? The
   failure mode to avoid is a signpost — a quest marker that appears because the
   content exists. It must be a need the player feels before they are told. The owner
   floated base expansion and a radio; interrogate those rather than accepting them.
2. **What the station means** in the story's terms. It is a market, a bureaucracy and
   a sealed room, populated by people who look like the worker the player is
   pretending to be. What does *that* place mean to a route intelligence wearing a
   dead man's suit? What does it mean that it is the first crowd?
3. **The shape.** Rough beat/cue/shot sequence from the end of `ch9-hearth` to
   standing in the concourse. Name the moment of first perception.
4. **The reveal budget.** What this chapter must NOT spend. A5 owns the first
   interstellar warp; pursuit is unauthored; the hidden pillar stays deducible, never
   stated.
5. **Your single biggest risk**, named plainly.

Write your treatment to
`.codex/design-runs/2026-07-27-station-in-the-plot/<lane>-treatment.md` where `<lane>`
is `chapter`, `score`, or `cinematography`. Do not modify any other file. Do not
touch runtime code.
