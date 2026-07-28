# Chapter treatment — bringing the anchorage into the plot

**Run:** `2026-07-27-station-in-the-plot` · **Lane:** chapter · **Source rev:** `497da1b`
**Status:** direction candidate. Not canon, not copy, not a mutation authorization.

---

## 1. The causal need

**Where the owner is right:** the need must come from the thing the player just built.
**Where both floated ideas are weak:** forced expansion makes home into homework, and a
radio makes the station the actor.

Forced expansion contradicts the line ch9 just landed — *"home is the distance you can
keep alive."* Opening on "your home is insufficient" cheapens it retroactively.
Expansion is a desire, and a desire you are ordered to have is a quota.

An inbound signal is worse: it summons. §7.20 says curiosity is the protagonist; if the
station calls, the player merely responds. But the owner's instinct about the
**carrier** is right — `WreckRelay` already establishes a receivable channel and the
audit network already issues faults remotely. Use that channel *outbound*.

**My position: the need is the first thing a world cannot give.**

The second hearth's habitat core runs on one bonded cell salvaged off the Kestrel. One
cell, two fires. A second cannot be dug, grown, or fabricated: it has a serial number,
it was *issued*. Everything Terra has ever obtained came by extraction, craft, repair,
or assignment. This is the first object she must **acquire from another party** — which
is also the thesis: a market is where a self that cannot make a thing meets a self that
can.

The player feels it before being told: the shelter cools, the core's hum drops a step,
frost forms inside a wall the player personally sealed. *Then* the objective. Then she
goes to the relay and **asks**. It returns an address, not an invitation. She is found
by nobody; she finds.

Both-readings payoff, and the chapter's entire pillar spend: **the relay answers too
fast.** Naive reading — the suit radio hit a depot registry. Deduced reading — she asked
her own network and it did not need to look anything up.

Base expansion survives, downstream and voluntary: the station sells what makes
expansion possible. Never gate on it.

---

## 2. What the station means

Four readings, one per district cluster. None may be stated aloud.

- **Counter + floor — the office Terra ran.** Terra *was* a terminal. The floor is a
  cold open-plan grid of terminals with people at them: her own former function,
  distributed across bodies. It is the only room in Paravoxia that has ever looked like
  *work*. Say nothing; let the score know.
- **Concourse — the first negotiated number.** Every figure Terra has seen was
  assigned: quota, compensation, the missing Clause 4. A market is two parties
  disagreeing about a number and resolving it — §7.18 communion in economic form. It is
  the only warm room for a reason, and the reason is not heating.
- **The crowd — the first crowd, and Terra is passing.** Until now every mind she met
  was singular: one worker, one auditor, one tree. Forty-six proves the Authority is
  *staffed*, not abstract. She is wearing a dead man's suit inside a building full of
  living versions of him, and nobody looks twice. She is not undercover by plan; she is
  undercover by accident. That is worse, and it is the strongest feeling available here.
- **The blank — the shape of the ceiling above her reference.** A sealed volume the
  station treats as unremarkable. Notice it and **refuse** it. Do not open it, do not
  explain it. One vendor declines to have an opinion.

**Perceptual gain (not an awakening — an Emergent movement, like ch8):** the first time
another entity's regard is a rendered fact. Traders turn to look at you.
Crowd-as-fidelity.

---

## 3. The shape

Candidate chapter `ch10`, beats in order:

| beat | verb | objective id / marker / work order |
|---|---|---|
| `ch10-cold` | notice, diagnose | `anchorage:hearth-fault-read` · `SECOND HEARTH · READ THE FAULT` · "THE CORE IS DRAWING ON ONE BONDED CELL. / [F] READ THE HEARTH FAULT." |
| `ch10-ask` | query | `anchorage:relay-source-query` · `WRECK RELAY · REQUEST A SOURCE` · "FOLLOW THE WRECK RELAY MARKER. / [F] REQUEST A SOURCE FOR A BONDED CELL." |
| `ch10-transit` | fly a bearing (in-system, reuses ch8 flight) | `anchorage:bearing-hold` · `ISSUED BEARING · HOLD` |
| `ch10-apron` | comply with docking procedure | `anchorage:dock-clearance` · `APRON · HOLD APPROACH SPEED` |
| `ch10-counter` | be recorded | `anchorage:registry-entry` · `COUNTER · PRESENT DESIGNATION` |
| `ch10-concourse` | arrive; stand in it | clears to free trade |

**Moment of first perception:** `ch10-transit`. The anchorage is 830 units of filament.
Edge-on it is not a station — it is a **seam of light**, a line with no body, and it
stays a line until the ship yaws. Commission that from Cinematography as the signature
shot: the thing you are flying toward is a line until it is a place.

**Best free irony:** at `ch10-apron` the Regulation voice returns after nine chapters,
and it is not menacing — it is traffic control. The tone that once meant *you will be
destroyed* now means *slow down, you're coming in hot*.

**`ch10-counter` is the agency peak.** She presents the suit; the station writes down
W-7743; she gets away with it. The getting-away is the beat.

`ch10-concourse` closes on the awakening voice, lowercase, one sensation: warmth she
did not build. Then the objective clears and trade opens *in free play*.

---

## 4. Reveal budget — what this chapter must not spend

- **No warp, no mention of one.** In-system only; no character may reference another
  system as reachable. A5 untouched.
- **No W-7744 aboard.** Pursuit is unauthored, and a station full of people who look
  like him is far stronger than the one who is. At most a public fault board with an
  unreadable designation — if it can be read, cut it.
- **No Makers, no greater-threat explanation.** The goods on the shelves came from
  worlds; that implication is the whole dose.
- **The pillar stays deducible.** The fast relay answer is the entire spend; no vendor
  recognizes her. **Hard constraint for Integration: the LLM vendor channel must be
  structurally incapable of improvising identity.**
- **Worker 9: one trace.** Terra's hands know how to stand in a queue — bodily knowledge
  she cannot source, rung 1 of the recommended clue ladder. Free, and excellent.

---

## 5. Biggest risk, named plainly

**The station is a better game than the story is, and it will eat the chapter.**

It ships a market, arbitrage, a currency sink, 46 NPCs and an LLM. Hand the player a
shop at the emotional close of the fidelity ladder and Paravoxia becomes a space-trading
game with an art film attached. The generative vendors compound it: an improvising NPC
cannot be held to the both-readings law, and that law is the spine.

**Mitigation:** end the chapter while the market is still unspent. Terra buys **one**
thing. The concourse is the destination, not the content. Full trade unlocks after the
beat closes, in free play, where it costs the story nothing.

---

## Flags for the registry gate (stateRefs with no producer)

`deriveStoryBoundaryState` (`main/src/story/storyBoundaryTelemetry.ts`) emits no
anchorage vocabulary. A `ch10` entry needs **new producers** to validate:
`state:world/anchorage`, `state:anchorage/docked`, `state:anchorage/cell=<district>`,
`state:anchorage/registry-recorded`, and a control mode for station locomotion
(`anchorageLocomotion.ts` is separate from the voxel player). Also
`state:system-flight/active-planet=` derives from `runtime.world.activePlanetId` — the
anchorage is not a planet, so that ref goes absent during station residence. A real
gap, not a naming choice.

Two engineering flags: `anchorageDevFlag.ts` gating must become a story-milestone
predicate (prime directive — sandbox stays byte-identical), and autopilot must satisfy
the `anchorageApproach.ts` speed gate or the movie cannot traverse `ch10-apron`.
