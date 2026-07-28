# Cinematography treatment — the anchorage in the plot

Run `2026-07-27-station-in-the-plot`. Direction candidate. No runtime mutation.

## 1. The causal need

A radio that speaks first, and base expansion that runs out of a material, fail
identically: the need arrives from outside the frame.

My answer: **put the station in the sky and never mention it.**

Reality stage is narrative capacity. At `bare`/`color` the sky has no faint layer, because
the player cannot resolve one. At **`alive` it gains one** — and in it, a point of light
crossing on a period no star has. No marker, no cue, no letterbox, no forced look.

It is *supposed* to be a dot. That is what a station looks like from a planet, and what
anyone who has watched the ISS pass already felt: **there are people up there and I am down
here.** The need is built by the player, over nights, from an object that asks nothing. It
also carries the pillar — the only object in that sky that keeps time. A route intelligence
looks up and sees a *schedule*; a new player sees a satellite.

The relay comes second, and does not speak. `WreckRelay` has been a **send** for nine
chapters; the event is that it becomes a **receive** — ember `#ff5a3c` holding steady, the
hex learned from W-7744's visor.

## 2. What the station means, visually

**The first place in Paravoxia composed by someone else.** Everything so far is a procedural
world, a surveillance feed, or something the player built. The concourse has stall
placement, lamp placement, aisle width — other people's intentions. Terra composed frames
*for* people for nine chapters. This is Terra inside someone else's.

**The crowd makes the player the only body they cannot see.** ~46 shoppers on W-7744's
proportions and visor; the camera sits inside the one figure with no silhouette. So: one
reflective plane in the concourse, a dark shopfront panel, not a mechanic. Stand there and a
worker looks back — the pillar delivered by staging, stated nowhere.

**Eyelines.** For nine chapters only cameras and W-7744 have looked at this player, and both
were accusations. Traders turning is the first eyeline that means *commerce*.

## 3. The shape

- **`ST-0 · the light that keeps time`** — **first perception.** Night at the second hearth;
  player-owned camera, zero intervention.
- **`ST-1 · the answer`** — the relay ember holds. Already a landmark; no forced look.
- **`ST-2 · the manifest`** — a diegetic screen turns the dot into a bearing. Information,
  not cinema: **letterbox does not return here.**
- **`ST-3 · the climb`** — ch8 grammar, unchanged. One new image: two fires below resolving
  to a single point. Home becomes the kind of light the station was.
- **`ST-4 · the standoff`** — `arrivalStandoff(body, 1500)`. First read the lit spine, second
  the dark mass at the end. The blank is introduced, never explained.
- **`ST-5/6 · corridor and mouth`** — existing choreography, unchanged.
- **`ST-7 · the counter`** — fill `0x8098ae @ 0.92`: the most evenly lit and least kind room
  on the station. **Processed before welcomed.**
- **`ST-8 · the room that likes you`** — concourse, `0xa08661 @ 1.85`. First read is not a
  stall or a sign. It is a face turning.

## 4. Reveal budget

- **No warp vocabulary in any frame.** `ST-3` must be indistinguishable in *kind* from
  `ch8-crossing`. A crossing that looks new is a new capability; A5 owns that.
- **`ST-3` must not compose on the galaxy.** `GalaxyImpostors` reveal starts at
  `atmosphereSpaceBlend ≥ 0.78` (~alt 139), so remote systems bloom in as the player leaves
  atmosphere. Do not frame it. **The galaxy appearing is A5's image.**
- **No pursuit imagery.** No light that follows, no rear-view, no audit ember on the station.
- **The blank is never revealed.** No door, no light, no cue.
- **No new reality stage or grade family.** `alive` is the ceiling.
- **The mirror is not lingered on**, and **the crowd stays a species** — naming one spends a
  character Chapter may need.

## 5. Ruling — the sealed volume's shot

**Never light it. Its shot is the one where it takes something away.**

Diagnosis: `ApproachEnvironment` mounts `ambientLight intensity={0.62} color="#38455c"`
precisely so unlit hull is "a dark shape rather than a hole in the starfield." Right for
five districts, wrong for one. On hull tone 6 (`0x2b2f36`), with `WINDOW_TONE.blank = null`,
`navLights` skipping blank, and the 110-unit dock flood ~830 units away, it is a **flat
unmodulated grey rectangle** — no terminator, no gradient, no edge. Not dark enough to be an
absence, not lit enough to be a form.

1. **The vanishing point.** Keep the layout test's guarantee that the blank is never on a
   sightline — but make the *sealed portal* visible: a door-shaped nothing where the sodium
   shelf rows converge. The darkest value in frame at the point composition sends the eye.
2. **The star-eater.** Take the blank out of the fill response so its only light is the
   raking key from `keyLightDirection` — a real terminator, ~200 units of falloff into black.
   The starfield is 3,000 points riding with the camera, so a ~200-unit cube drifting across
   it **eats stars**.
3. **Departure, not arrival.** Arrival belongs to the mouth. On undock the spine recedes, the
   market's warm flank holds the near side, and the last silhouette is the part you were
   never let into.

## 6. `ST-0` is buildable, and is not a new camera

Verified: the station already exists in the story system at radius **6,976**, and is
invisible from the ground only because the on-foot far plane is **6,000** and surface fog
saturates by ~800 units. Do **not** raise the far plane — extend
`companionCelestialPlacement()`, which already compresses distant bodies to a ≤138-unit
surrogate at exactly invariant angular size, with `fog: false` and horizon extinction. In
the story system that machinery is mounted and idle. No new camera, no new light
cardinality, no new shader program. Full numbers in Appendix A.

## 7. Biggest risk, plainly

**The station is more beautiful than the house.**

Chapter 9 has the player build a settlement out of a cold procedural world by hand. The
anchorage is authored, warm, colour-scripted, crowded — and costs one flight. If the
concourse is the emotional peak, everything the player built reads retroactively as a
tutorial for somewhere nicer, and *"home is the distance you can keep alive"* turns ironic.

The fix is mine: **the concourse must be warm and one shade past comfortable.** `1.85`
against the counter's `0.92` currently reads as generosity; it should read as **exposure** —
the most lit room this player has stood in, in a dead man's suit, among his species, being
looked at. Then undocking onto a dark world with two fires is a *relief*. That one grade
decision separates a better home from a place you visit.

---

**Open dissent:** none; peers unread by design.
**Routed, not mine:** `anchorageDevFlag.ts:55` claims the starting system has no anchorage
(the seed says otherwise), and `SystemAnchorages`' "off by default in story" JSDoc is not
implemented. `ST-0` depends on which is true.

---

## Appendix A — `ST-0` verification numbers

Story system seed `1138247199`; anchorage population roll 0.783 → 1 anchorage, radius
**6,976**, already mounted via `SystemAnchorages`. Blockers: on-foot far plane
`planetSize * 120` = **6,000**; `SURFACE_FOG_DENSITY = 0.005` saturates by ~800 units.
`companionCelestialPlacement()` is idle in story (`forceSingleBody: true`).

Two numbers that matter. The station subtends **~0.03°**, 40× smaller than the sun disc —
a true point, which is why `MIN_BEACON_PIXELS = 2.4` exists. And it must **not** drift at
the companion rate (0.008 rad/s, deliberately matched to the stars): target a
horizon-to-horizon transit of **~45s**, roughly 7× star drift, so "that is not a star" is
unmistakable. Derive direction from the real `systemPosition`, or the ground bearing
disagrees with the flight — the failure the station's own code already names.

## Appendix B — judgement on the existing arrival

Right, and rare: the standoff's 0.78/−0.46/0.32 weighting is a genuine three-quarter
portrait setup, and the guide arms as a **foreshortening cue** are the best call in the file
— a black sky gives a pilot no atmospheric depth, and inward-chasing lamps supply
rate-of-closure. Three defects:

- **The establishing shot has no hold.** Thrust is live on frame one, so the most expensive
  image in the sequence survives under a second. Ask **~2.5s thrust lockout, look fully
  live** — the player can pan the whole filament, they just cannot start closing before
  seeing what they are closing on. Diegetic (engines cold out of transit), pause-safe,
  reduced-motion-neutral.
- **The four arms make a symmetrical hole, not a door.** At 45°/135°/225°/315° the mouth has
  **no up**, and the only roll reference is a red/green pair sitting on the diagonals — the
  worst place to read roll. Mark the vertical.
- **FOV 75 buys continuity and costs characterization.** The camera is explicitly the ship,
  not a body — "there is no cockpit" — and 75 is the *embodied* lens. I would fly **62–66,
  easing to 75 as the mouth swallows the frame**, so the widening *is* the arrival. Counter
  acknowledged: 75 throughout leaves undock → walk → dock with no lens seam. **Owner taste
  question, not a demand.**
