# ch7 / ch8 repair — Chapter Director treatment

**Scope:** `ch7-reconstruct` and `ch8-launch` only. Chapter 1 untouched. Changes
no code, registry, or contract. Release surface stays `ch4-arrival`.
`DEMO_FOUNDATION_PLAN:72` still requires an owner decision for copy inside the
existing story — a proposal, not a patch.

**Not spent here:** A5/Light, W-7744's return, the Authority's answer, Worker 9's
legibility, the typed name.

## 1. ch7-reconstruct — pressure, not compression

**Ruling: keep all five steps. Add pressure.** Compression is retrofitting and would
destroy existing authorship: `resolveChapter7ReconstructionScoreVariant()`
already resolves eight gameplay-derived moods (`diagnosis | bench | frame | hull
| lift | hover | route | calibration`), and ch7 is deliberately excluded from the
signed AV ramp to keep that mix player-driven. **The score has been doing
per-step work the copy wasn't.**

**Device: the ship you rebuild is the ship that reports you.** The wreck hosts
the relay used in `ch4-comply` to file the site to its floor. Every part
restores a dead system, and a system that comes back reports in. To leave, I must
make myself detectable to the thing I refused. No timer, no fail state, no chase
— escalation keys to repair stage, so it reads identically in slow play and under
`&movie=1`. The menace is being **indexed**, not caught.

### Second spine — the brackets come off

`Bible:1185` — "After the first `i—`, Terra's embodied interior voice must not
return to parenthetical grammar." Every emergent caption from ch5 to ch9 is
parenthetical. That is shipped drift, and the Bible holds **authored-but-unshipped
ch7 copy in the correct voice**, existing nowhere in `src`:

> `the wreck that brought me here will leave here. i will build the leaving.`
>
> `the ground's hold is a habit, not a law.`

So ch7 earns a gain: **the ship goes together and the voice stops
whispering.** The entry line stays parenthetical — the last private thought — and
from the diagnosis on, the voice is bare. The law forbids *returning* to
parentheses; a one-way exit turns a defect into the chapter's turn.

### Placement

Regulation routes `showAuditLine(text, header)`; awakening routes `showCaption`.
`(repair is not return.)` stays as the last parenthesis.

**Diagnosis receipt (`Trace Relationships`) — the brackets fall:**

- header `WRECK RELAY` — `HULL AT SITE 7C-θ · FILED: TOTAL LOSS · FILE CLOSED`
- `the wreck that brought me here will leave here. i will build the leaving.`

**`bench_online`:** `the keel takes the weight first. everything after this is allowed to be heavy.`

**`frame_restored`:** `it remembers a straight line and goes back to it without being told. i watch that closely.`

**`hull_sealed`:**

- header `WRECK RELAY` — `PRESSURE BOUNDARY HELD · PASSIVE BEACON RESTORED`
- `i closed it, and something inside started listening again. i did that too.`

**`lift_online`** *(the chapter's capability gain — suit hover):*

- header `WRECK RELAY` — `POWER BUS LIVE · TRANSPONDER ARMED`
- `the ground's hold is a habit, not a law.`

**`flight_ready` (`LOGIC WAFER`):** `the last part is the part that thinks. i am being watched now. i put it in anyway.`

**Calibration receipt:**

- header `AUDIT NETWORK` — `UNSCHEDULED HULL · SITE 7C-θ · INTEREST RAISED`
- `nothing has asked yet. something has started paying attention.`

**Exit — one shipped string must change.** `(the scar remains. now it can carry
you.)` would re-bracket after the transition. It becomes
`the scar remains. now it can carry me.`

Ten lines across ten actions. `i put it in anyway.` is the turn: I learn the cost
and continue. Escape, bought without moving one objective.

## 2. ch8-launch — break the silence

Work order `IGNITE. LIFT. LEAVE THE ATMOSPHERE.` stays. Every line lands on an
existing anchor carrying no copy today.

**Variant B, on entry:** `the pond answered every time i asked. i am leaving anyway — that is what the answers were for.`

The thirst callback the reader named as missing.

**`anc.launch.ignition`:** `hold it. this is the only order left, and i am the one giving it.`

**`anc.launch.liftoff`:** `the site gets small. the tree does not. i keep finding it.`

The refusal, paid off from the air.

**`anc.launch.atmosphere-exit`, then the consequence stack:**

- `i came down this line without being asked. i am going back up it on purpose.`
- header `AUDIT NETWORK` — `AUTOMATED CONTACT · SITE 7C-θ · HULL LOGGED: DESTROYED`
- header `AUDIT NETWORK` — `REGISTRY QUERY · STATE DESIGNATION.`
- header `AUDIT NETWORK` — `NO DESIGNATION RETURNED.`
- header `AUDIT NETWORK` — `CONTACT LOGGED.`
- `they asked for a designation. what i have is not one.`

**Variant D:** `nothing answers. the query does not close.`

No line frames the exit as a larger sky. A5 untouched.

## 3. Consequence — the smallest true thing

**Two words: `CONTACT LOGGED.`** The world's entire response to a revolution is a
row in a table. It does not answer, threaten, or pursue. It files. That is worse,
and it is the register the game has spoken since `QUESTIONS ....... 0`.

This is **not the Authority answering the refusal**, which is reserved. It is an
automated handshake noticing a *hull* — never the refusal, the tree, or my
conduct. The speaker is `AUDIT NETWORK`, established at `a4-exhale` as the
automated filer that faulted W-7744: no new institution, no rank-issued "I".
`nothing answers. the query does not close.` stages the absence of an answer as
the point.

ch7 earns it: I *chose* visibility, one part at a time. Being noticed is a
consequence of my own ten actions, not an ambush.

## 4. The name — ruled: not here

**The name may not be printed before A8.** `Bible:432–447` calls it "the
foundation of the provisional A8 name payoff," its Worker 9 use "not yet
authored"; `Bible:1526–1530` reserves the render for the ending. Printing it at
ch8 pre-empts `worker9-reveal-timing` (locked) and spends A8's only card. The
payoff must be the name's *first* return to screen.

The reader's defect is real and it is **not** the missing payoff — the name
evaporates, thirty beats with no evidence it was held. Fixable without surfacing
it:

`they asked for a designation. what i have is not one.`

The registry demands a designation; something is held that isn't one. Retention
proved without printing or attaching anything. Both readings hold: a
worker with no valid registration; a mind that kept something the index has no
field for. `UNREGISTERED DESIGNATION.` is *not* reused — it stays with A8.

**Routed for canon sign-off:** that line is the boundary between "the name
evaporated" and "the name was spent."

## 5. Producer flags

**No new `stateRef`, milestone, or persistence.** Captions are not stateRefs; the
registry gate is not implicated.

1. **ch7 per-step edges — already placeable.** `tickReconstruction()`
   (`main/src/story/emergentStoryDirector.ts:559-595`) reads `getShipRepairStage()`
   each frame with `once()` in scope; latch per stage. Latches are beat-scoped,
   correct here. Typed alternative: the `ship_repair_stage {from,to}` event.
2. **ch8 — three existing signed anchors, no copy today.** `anc.launch.ignition`,
   `anc.launch.liftoff` (gated by `hasLaunchPhysicallyDeparted()`),
   `anc.launch.atmosphere-exit` (fed by `subscribeAtmosphereExit`). Use these, not
   the dwelled objective ID and not altitude — **no altitude or climb-progress
   value is director-readable**.
3. **`getWorkerName()` not required.** Dropping the printed name removes the only
   `{name}` consumer, the missing `hasWorkerName()` predicate, and the
   uncentralized substitution.
4. **No live numbers.** Regulation strings are fixed authored text.
5. **`WRECK RELAY` is a new header token** — a third register, the ship reporting
   itself, distinct from W-7744 and AUDIT NETWORK. `showAuditLine` already takes a
   header, so no plumbing; it carries no "I", per `Bible:1194`.
6. **One shipped string changes** (ch7 exit). Needs the owner copy decision.

## 6. Escalated — out of scope

**The parenthetical drift is systemic.** All sixteen emergent captions from ch5
to ch9 use a grammar `Bible:1185` forbids post-`i—`. If ch9 keeps them the voice
flickers and this repair creates a new defect. **ch9 must follow; ch5/ch6 need review.**

## Handoff

**Score:** ch7 already resolves eight gameplay-derived variants; I am **not**
asking for a new ramp and I respect the signed-rail exclusion. I ask that
`hull`, `lift`, and `calibration` *sharpen* rather than swell, and that
`CONTACT LOGGED.` land in near-silence. ch8-launch is not in `OWNED_BEATS`, so
its three anchors run the generic ramp — your ruling.

**Cinematography:** at `anc.launch.liftoff` the tree must be findable from
altitude or `i keep finding it.` is a lie. Raised, not answered.

**Status:** nothing here is approved by this document. Enters the triad cycle
with `contractChangeRequired: true` — beat causality, voice grammar, and agency
framing all change at ch7.
