# Cinematography Treatment — ch10 station introduction (cold / ask / transit + ST-0)

Author: Cinematography Director
Status: ready_for_cross_notes
Contract target: `ch10-station-introduction` revision `1`
Prepared independently from the Score Director's first treatment: `YES` (unread by design)
Production lock: `production-lock.md` (2026-08-11T17:06:29-04:00) — binding.
Story intent: `story-intent.md` revision 1 — C1–C6 answered in §10.

---

## 1. Current-cut audit (evidence map)

All citations are files in `evidence/baseline/` unless pathed; hashes in
`shipped-visual-baseline.json`.

| Fact | Evidence | Reading |
| --- | --- | --- |
| ch9-hearth closes on `player-camera`, FOV 75, free look, no letterbox; the ~5.5s settle and the closing caption "(one fire behind you. one fire here. home is the distance you can keep alive.)" paint over a warm shelter interior | `01_124s_ch9-hearth_hearth-closing.png`, `02_127s_ch9-hearth_hearth-closing-late.png`; `shipped-visual-baseline.json#cameraStates` | The close is interior, intimate, wood-brown, player-owned. ch10 must not retro-grade this frame; it must *extend its geometry*. |
| `done` seam: signed AV released (`lastResetReason: completion`), authority null, sandbox FOV 75; ORBITAL SCAN + `◆ SHELTERED` chip mount; closing caption persists ~6.5s then expires | `03_130s_done_freeplay-seam.png`, `04_138s_done_freeplay-settled.png`, `#doneFreePlayStateTrace` | The free-play frame ST-0 enters is already busy on the left/top HUD edges; the sky is the only unclaimed real estate. Correct place for a prelude that asks nothing. |
| Movie lane finishes ch9 sealed in a doorless box; zenith look shows ceiling | `00_015s_ch9-hearth_hearth-enter.png`, `06_185s_done_sky-zenith.png`, MF-1 | Movie-lane ST-0 perception is impossible at the seam as shipped. Fixed per intent at ch10-cold entry; my C2 staging rule in §10. |
| The shipped night sky over the second hearth: large soft cool-white moon disc (~13% frame height with halo), magenta/violet nebula banding upper frame, dense 1–2 px cool-white star field, terrain horizon silhouette | `sky_161s_ch9-hearth_outdoor-sky-mid.png`, `sky_163s_ch9-hearth_outdoor-sky-zenith.png` | This is ST-0's competition. Every point in that sky is **cool**; every large form is soft. A small **warm**, **fast**, **constant** point is separable on three independent axes at LOW with zero post. |
| LOW renders **no post grade**: `postProcess:false`, `colorGrade:false`; declared hearth postFx do not render | MF-3, `#paletteStates`, `main/src/config/graphicsSettings.ts#QUALITY_PROFILES.LOW` | Every claim in this treatment is built on geometry, emissive/material luminance, motion, and HUD. Grade-dependent claims appear only in the 3 HIGH stills. |
| ch8 flight grammar (reused unchanged): cockpit canopy occludes lower ~35% and side pillars; hexagonal aperture is the effective frame; cyan target ring + `sibling world · 6169m` marker chrome; white star streaks under thrust; caption bottom-center; objective card lower-left | adopted ref `.codex/production-runs/2026-08-10-ch7-ch8-voice-repair/evidence/verification/ch8-captures-desktop/off_18p0s_ch8-crossing.png` (+ sidecars, hash-verified) | The transit's stage is the canopy aperture. The seam of light must live inside it, above the console silhouettes, and not fight the cyan marker chrome. Also: **flight camera is vehicle-state FOV 70**, not 75 (`generatedSceneAvRuntime.json#reset.reset-camera`). |
| The station already renders in shipped story flight | `main/src/components/SystemSpaceStations.tsx` (the "defaults off in story" JSDoc was a fiction and was corrected; component mounts under `systemBodiesEnabled`) | A manual ch8 player who looked toward −X may already have seen a ~56 px sliver at 6,976+ units. ch10 does not create the shape from nothing; it creates *attention* to it. My staging never claims "first existence," only first noticing, first address, first scale. |
| Shipped approach machinery is live and armed | `SpaceStationApproachDriver.tsx`: within `SCAN_RANGE` 5,200 the HUD contact publishes advisories ("hold for approach"); inside corridor + speed gate, **KeyF commits the target and page-swaps into the station interior** (`App.tsx#enterSpaceStation`) | **Structural finding (routed, §11-Q-INT1):** without a story-mode predicate, a ch10 player can dock, violating the run's exit seam and the owner's docking packet. The lock's mechanics item #2 must cover the dock offer and advisory publication, not only `commitSpaceStationTarget`. |

Strongest existing image: `sky_163s` (moon + magenta nebula at zenith — the sky is
already the best-dressed set in the chapter). Weakest: `03_130s` (the seam frame is
HUD-mounting bureaucracy; nothing to fix this run, but nothing to lean on either).

**Correction to my own prior (2026-07-27 Appendix A):** I claimed the station
"subtends ~0.03°, a true point." Wrong. Measured against the shipped runtime
(numbers in §6): the hull is 865×206×206 units and subtends **4.5° × 1.3°** from
Tidegarden's ground — comparable in angular length to the moon's disc. The point
of light is not the hull; it is the hull's **lights**. That correction is now the
thesis.

## 2. Visual thesis, and the rejected alternative

**Thesis: the player has been looking at the seam of light all along.** From the
ground, the station's dark hull is invisible against a dark sky and mostly below
the horizon; what crosses the night is the amber of its kept lights, compressed by
distance into a dot. The transit does not introduce a new image — it adds
*parallax to an old one*: dot (ST-0, a fact of the sky) → the same amber
stretched into a line as the atmosphere stops hiding it (seam) → the line yawed
into a place (resolve). One color, one object, three distances, three levels of
commitment — sight, information, scale — exactly the Chapter's stack, realized as
a single continuous luminance object. No letterbox anywhere; the run's only
camera intervention is 2.5 seconds of cold engines.

Why it belongs to Paravoxia: the game's deepest grammar is that *fidelity is
causality* — you see what your stage of being can resolve. ST-0 obeys it at the
perceptual level rather than the render level: `alive` does not change; what
changes is how far the player has gone toward the thing. And it carries the
hidden pillar silently: only the route network's object keeps time in this sky.

**Rejected — Treatment B, "the instrument reveal."** Structurally distinct: no
ST-0; the station's first perception is informational — at `anc.ch10.relay-answer`
the relay paints a bearing, and during transit the shipped contact HUD
(`spaceStationContact()`) is the protagonist: the station resolves on instruments
first (range readout counting down inside the canopy), with the window kept dark
until the seam crossing is a single late reveal at ~2,000 units (23° subtense),
staged as one decisive luminance event. Rhythm: nothing, nothing, nothing,
everything. Rejected for three reasons: (1) it spends the sky — the `done`
free-play prelude is the only place in the game where noticing is free, and B
throws that away; (2) it converts perception into UI, which is the *counter's*
register (run two), not the threshold's; (3) it makes the reveal an authored
moment in a run whose law is that the station never acts and the camera never
takes. B's one strength — the seam as a discrete event — survives in A anyway,
because the atmosphere gate makes the seam appear all-at-once (§7).

## 3. Color script

Palette authority: `planetArtDirection.ts` / `planetVisualProfile.ts` families +
emissive sources. LOW has no post grade (MF-3): every row below is realized in
materials, emissives, sky, and HUD; the grade column applies at HIGH/ULTRA only
and changes meaning at no tier.

| Beat/anchor | Palette family | Semantic roles | Light/material state | Grade/effect (HIGH+) | Meaning |
| --- | --- | --- | --- | --- | --- |
| `done` prelude (ST-0) | fire/night (shipped) | cool night world; warm hearth fire = "yours"; **new scarce accent: station amber = "kept light that is not yours"** (hue from the station's warm-sodium window family, `spaceStationExterior.ts#WINDOW_TONE` — sampled at implementation, cited by role not hex) | shipped night sky (moon, magenta nebula, cool stars) untouched; one warm point, constant luminance, night-only | none — no new effect may mark ST-0 | a third temperature enters the world's two-temperature system (cool world / warm fire) without one line of copy |
| `anc.ch10.cold-noticed` → `fault-read` | fire/night, unchanged | hearth fire warm; core readout REGULATION text chrome | night interior/exterior as shipped; **no frost, no cold blue-shift** — the copy's "cold" is honest because nothing visual claims it (no world-prop surface in allowedPaths; K1 audit upheld) | none | the cold is a fact in a record, not a weather effect; menace-by-procedure stays procedural |
| `anc.ch10.fabrication-refused` | fire/night | fabricator craft-surface chrome as shipped; refusal is caption-only | unchanged | none | the refusal must look like every successful craft — the difference is only the words |
| ch10-ask return crossing | ch8 cockpit family (adopted, unchanged) | canopy blacks, cyan marker chrome, magenta nebula, star streaks | shipped ch8, opposite direction | shipped ch8 stack | deliberate visual restraint: the crossing back must be *indistinguishable in kind* from ch8 — colder purpose, same light |
| `anc.ch10.relay-ask` / `relay-answer` / `bearing-claimed` | audit return | relay ember `#ff5a3c` steady (the receive), RELAY register caption chrome | wreck site dawn/day/night as found; no letterbox (information, not cinema — my ST-2 rule, kept) | none | ember = the channel; **ember (red-orange, regulation) and station amber (warm sodium) are deliberately adjacent-but-separate warms** — the answer's color is not the station's color, because the relay is hers and the station is not |
| `anc.ch10.transit-ignite` → `seam-of-light` | ch8 cockpit family + station amber | the seam = the amber accent's second appearance, now a line; cool star field; **no galaxy composition** (A5's image) | sky-black at `atmosphereSpaceBlend ≥ 0.9`; hull sun-modulated by day-phase (uncontrolled — staging never depends on the sun; the emissive rows are day-phase invariant) | shipped bloom at HIGH pushes far emissives past white (`SpaceStationExterior.tsx` range behavior) | the dot and the line are the same object; hue continuity is the proof, stated nowhere |
| `anc.ch10.station-resolved` → `threshold-handback` | ch8 cockpit family + station amber | hull mass mid-grey (dark shape, not a hole); amber window rows the brightest values; nav/berth lights present but not composed as an invitation | standoff outside corridor range; no dock flood heroics | none new | "a light someone else keeps alive": the lights carry the phrase; the hull stays a fact, not a promise |

Continuity: the family on both ends is shipped (fire/night into the seam;
ch8 cockpit family out of it). The single new statement in the whole run is the
station-amber accent, used exactly three times at three scales — which is the
scarcity rule doing narrative work.

## 4. Shot ledger

Camera authority values are the signed-rail vocabulary
(`generatedSceneAvRuntime.json`). All ch10 shots are `continuous`,
`declaredCut: false`; the only discontinuity in the run is the shipped
page-context change at none — there is no cut in ch10 at all, which is itself the
statement: nothing in this chapter happens to the player.

ST-0 is deliberately **not a shot and not on the signed AV rail** — it is world
state with an evidence point (`capture.st0.sighting`), keeping the law that it may
never acquire an anchor or a cue.

| Shot ID | Anchors (start→end) | Focal subject (1st read / 2nd read) | Blocking / screen direction | Authority | Lens/FOV | Motion | Transition | Safe area / reset |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `cin.cold.01-hum-drop` | `anc.ch10.cold-noticed` → `fault-read` | hearth core / the night outside the walls | player returns to hearth at night; no staging — the story waits for presence | `player-camera` | 75/75, 0ms | player | continuous | caption lower-center + objective card lower-left as shipped; no change; reset `reset-camera` |
| `cin.cold.02-fault-read` | `fault-read` → `fabrication-refused` | core readout (K2/K3) / the fire behind it | interact at core; marker `HABITAT CORE · READ THE FAULT` is the sole guidance | `player-camera` | 75/75 | player | continuous | REGULATION readout must not overlap objective card — shipped caption lane used |
| `cin.cold.03-refusal` | `fabrication-refused` → beat exit | fabricator surface (K5) / player's own hands idle | craft-attempt at Kestrel Fabricator; the refusal frame must be visually identical to a success frame except the words | `player-camera` | 75/75 | player | continuous | beat exit clears C2 objective; guidance reconstructs fresh at ch10-ask |
| `cin.ask.01-reboard` | ch10-ask entry → `A1` done | Kestrel hatch / the hearth receding | grammar = `ch8:launch:reboard` verbatim | `player-camera`→vehicle | 75→70 state-derived (shipped vehicle grammar, no authored move) | player | continuous | shipped ch8 resets |
| `cin.ask.02-crossing-back` | `A2` | first world disc / star field | ch8 crossing, opposite direction; approach-envelope hold drops `requiresMarker` per ch8 comment | vehicle | 70 | player | continuous | ch8 rescue semantics untouched |
| `cin.ask.03-landfall` | `A3` | wreck site / the crashed pod landmark | ch8 landfall grammar down to the relay | vehicle→`player-camera` | 70→75 state-derived | player | continuous | shipped |
| `cin.ask.04-request` | `anc.ch10.relay-ask` → `relay-answer` | relay ember steady / K7 painting | player at relay; **no letterbox, no push-in, no camera acknowledgment of the answer** — K8 paints inside K7's breath and the frame must visibly not care | `player-camera` | 75/75 | player | continuous | the shiver is Score's and the copy's; any camera emphasis here would leak R1 |
| `cin.ask.05-claim` | `relay-answer` → `bearing-claimed` | the [F] claim prompt / the sky in the direction the dot crosses | the rite: story waits forever; if the player looks up before claiming, ST-0's ground track crosses the exact bearing they are about to fly (§6 guarantee) | `player-camera` | 75/75 | player | continuous | `commitSpaceStationTarget` fires; planet claim undisturbed (b9335b9 pin) |
| `cin.transit.01-ignite` | `anc.ch10.transit-ignite` | flight controls / the wreck dropping away | ch8 launch grammar | vehicle | 70 | player | continuous | shipped |
| `cin.transit.02-hold` | `transit-ignite` → `seam-of-light` | `ISSUED BEARING · HOLD` marker at a non-planet target / star field where the atmosphere is thinning | canopy aperture is the frame; marker chrome sits at target; **no galaxy in composed evidence frames** (verified at capture; player look is free) | vehicle | 70 | player | continuous | marker via station-target handle (C5, §10) |
| `cin.transit.03-seam` | `anc.ch10.seam-of-light` | the amber line / nothing — the line must have no body | fires when `atmosphereSpaceBlend ≥ SEAM_OF_LIGHT_MIN_BLEND (0.9)` with the committed target within 20° of view center; at that moment the line is ~56×16 px at LOW 720p and the sky has just finished going black — the seam does not grow in, it is *already there when the veil clears* | vehicle | 70 | player | continuous | HIGH still 2; galaxy impostors complete their bloom-in at blend 0.78 — our anchor at 0.9 guarantees the two reveals never share an instant (§7) |
| `cin.transit.04-resolve` | `anc.ch10.station-resolved` (+0 → +2.5s) | the station as a place: spine three-quarter, amber rows brightest / the dark mass beyond the lit spine | standoff `arrivalStandoff(body, STATION_STANDOFF_DISTANCE = 1,500)` — outside `CORRIDOR_RANGE` 1,400 so no corridor chrome, no dock offer geometry; spine ~32° ≈ 31% of frame width at FOV 70 | vehicle; **movement: thrust-cold 2.5s (diegetic — engines cold at resolve); look fully live** | 70/70 — no lens move; the widening-lens idea from my July Appendix B is **withdrawn**: it belonged to docking, which is not this run | player look; zero camera motion | continuous | K11 paints lower-center; T3 work order clears at completion; RM variant identical by construction (nothing moves); pause-safe (lockout is anchored wall-time ≤2.5s, releases without snap — thrust re-arms, camera untouched) |
| `cin.transit.05-threshold-handback` | `anc.ch10.threshold-handback` | whatever the player chooses / the station persists un-annotated | full free flight in space, station visible, no marker, no objective; player may close (blocked from docking per Q-INT1), hold, or turn for home | none (free flight) | 70 state-derived (on-foot return = 75 via shipped resets) | player | continuous | signed rail releases with `lastResetReason: completion`-equivalent beat exit; all guidance cleared; durable milestones persist |

Focal hierarchy law for the run: primary = the current objective's subject;
secondary = the amber object (dot/line/place); **forbidden** = the galaxy, the
approach corridor lights as an invitation, any pursuit-reading light, and the
moon sharing a tight frame with ST-0 in authored evidence framing (the moon may
of course cohabit the player's free frame).

## 5. Lens / FOV / camera-authority plan and resets

- On foot: FOV 75, `player-camera`, free look — both seams, all of ch10-cold,
  relay beats. Identical to shipped (`#cameraStates`, `#doneFreePlayStateTrace`).
- In vehicle: state-derived FOV 70 per the shipped `reset-camera` grammar; both
  crossings and the transit. No authored lens motion anywhere in the run.
- Authority is **taken zero times**. The single agency modifier is the 2.5s
  thrust-cold hold (movement-only, look live, interaction live except thrust),
  declared in the rail as `agency.movement: "thrust-cold-hold-2500ms"` with
  `handBackAnchorRef: anc.ch10.threshold-handback`.
- Resets: every ch10 beat exit/deep-link/replay/pause/quit path resolves through
  the existing `reset-camera` / `reset-grade` / `reset-lighting` states. ST-0 is
  a stateless render predicate over durable milestones (`storyComplete` +
  `twoWorldHandoff`) — it survives quit/resume and never needs clearing, and it
  renders in `done` after ch10 completes as well (the sky keeps its fact).
- Jump targets `?story=ch10-*` seed the habitat world state (intent), so camera
  state at entry equals camera state in a continuous run — no ch10 analogue of
  MF-2's stall class.

## 6. ST-0 realization — the placement math (C1)

Measured runtime facts (vite-node against `929e3d0`, script preserved in this
run's scratch; re-derivable from `spaceStationBody.ts` + `starSystem.ts`):

- Station `-1,-1:a0`: `systemPosition [-6772, -1177, -1191]`, orbital radius
  6,975.9 (the "6,976" of record is **distance from primary**, not hull size).
  Hull: graph half-extents `[432.5, 103, 103]` → 865 × 206 × 206; exterior
  `boundRadius` 586.4.
- First world p0 `[0,0,0]` (wreck/relay; transit launch). Tidegarden p1
  `[2180, -110, -1635]`. p0→p1 = 2,727. **p0→station = 6,976. p1→station = 9,026.**
- True bearing p1→station `[-0.992, -0.118, 0.049]` → mean elevation **−6.8°**
  (below planet-horizontal). True bearing p0→station `[-0.971, -0.169, -0.171]`
  → mean elevation **−9.7°**.
- Hull subtense from p1 ground: projected length 4.5° (43 px @720p FOV 75),
  thickness 1.3° — and on-foot far plane 6,000 < 9,026, so the hull never
  renders on foot. Both facts point the same way: **what the ground sees is the
  lights, and the lights are the point.**

Mechanism — one new companion entry in `systemCompanionBodiesModel.ts` /
`SystemCompanionBodies.tsx`, rendered as a single billboard quad
(`MeshBasicMaterial`, existing material class, **no new shader**, ≤1 draw call),
placed by `companionCelestialPlacement` along the **true** active-planet→station
direction (so the surrogate at ≤138 units and the physical fact agree by
construction — "the ground track and the flown bearing are the same fact" is
guaranteed by reusing the invariant-angular-size machinery, not by tuning).
Mounts on **both** story worlds (the claim rite happens on p0; the dot must keep
its word there too).

Motion (named constants, mine to set per C1):

- `ST0_TRANSIT_PERIOD_SECONDS = 90`. Uniform ellipse rate 2π/90 ≈ **0.070 rad/s**
  = 7.0× `SKY_STARFIELD_DRIFT_RAD_PER_SEC` (0.01) and ~8.7× the companion drift
  (0.008). Unmistakably not a star, not the moon, not the sibling world.
- Ellipse amplitudes: longitude 1.0 rad (±57°), latitude 0.6 rad (±34°),
  centered on the true bearing. From p1's −6.8° mean the track peaks at ~+27°
  elevation; above a ~7° terrain horizon for ≈40% of each loop → **~36–40s
  visible crossing per 90s period**.
- **Recurrence proof (Chapter's guarantee, accepted and beaten):** worst case, a
  3-minute (180s) window opens the instant a crossing has started; the next
  complete crossing ends by `period + crossing ≤ 90 + 40 = 130s < 180s`. Any
  ≥3-minute outdoor night window contains ≥1 full crossing with ≥50s margin;
  typical windows contain two.
- Honesty note: the large presentational ellipse is the same class of fiction as
  the shipped companion sky-ellipse — and here it *expresses* a truth (a low
  station orbit genuinely laps a sky) rather than bending one. Like the
  companions, motion weight fades to exact canonical truth as
  `atmosphereSpaceBlend` rises (`companionPresentationMotionWeight`), so by the
  time anything can be targeted, the dot sits on the real bearing.

Appearance — why it cannot be misread either direction:

- vs. **stars**: 7× their drift; warm sodium-family amber vs uniformly cool
  points; crosses as an arc against the wheeling field.
- vs. **the moon / sibling world** (`sky_161s`,`sky_163s`): those are soft discs
  13%+ of frame height; ST-0 is clamped to `ST0_MIN_PIXELS = 2.4`
  (the shipped `MIN_BEACON_PIXELS` precedent) and never exceeds ~3 px at any
  tier/DPR/viewport — luminance above the brightest star, well below the moon.
- vs. **a marker**: guidance chrome is cyan/white and pulses on feedback; ST-0
  is warm, **constant-luminance** (no pulse, no blink — a blink is a cue and
  cues are forbidden), unlabeled, no distance readout, no look-at response,
  night-only (visibility scaled by darkness, like the stars it lives among —
  also the physically honest choice).

Reality/tier behavior: `alive` unchanged; identical at all four tiers (a 2.4 px
emissive quad needs nothing from the post stack); at HIGH, shipped bloom may halo
it slightly — acceptable, verified sub-moon in the hero still.

## 7. Seam-of-light and station-resolve staging (real angles)

Transit run: p0 surface → standoff, total 6,976. Spine-vs-sightline from p0 =
55.1°, so the projected spine ≈ 710 units the whole way in (aspect ~3.4:1
constant — the yaw at standoff, not the approach, is what changes the aspect).

| Distance | Projected spine subtense | @720p FOV 70-ish px | Reading |
| --- | --- | --- | --- |
| 6,976 (ignite/space) | 5.8° | ~56 px | a line with no body |
| 5,200 (`SCAN_RANGE`) | 7.8° | ~75 px | instruments concur |
| 3,488 | 11.6° | ~112 px | the line has ends |
| 1,744 | 23.0° | ~221 px | the ends have structure |
| 1,500 (standoff) | 32.2° full spine after yaw | ~31% frame width | a place |

**Seam (C3):** the perceptual event is not growth — at reveal the line already
subtends 5.8°. The event is the *veil clearing*: night-side launch or day, the
emissive window rows are day-phase invariant, and the sky's transition to black
at high blend uncovers them all at once. Treatment B's "discrete event" for
free. Anchor trigger (named constants, framing-tied per the Chapter's instinct,
not raw distance): `anc.ch10.seam-of-light` fires when
`atmosphereSpaceBlend ≥ SEAM_OF_LIGHT_MIN_BLEND (0.9)` **and** the committed
station target is within `SEAM_VIEW_CONE_DEG (20°)` of view center. The 0.9
choice is also the galaxy firewall: `GalaxyImpostors` completes its bloom-in at
blend 0.78, so A5's image and this run's image can never appear in the same
instant; frame-sharing is additionally checked at capture (the galaxy must not
sit in the canopy aperture in the two transit HIGH stills; if the sky layout
puts it there, the still is taken at a probe-selected yaw within the player's
free-look envelope, never via an authored camera move).

**Resolve + the closing shot (C4 taken; the run's cut line, HIGH still 3):**

- Position: `arrivalStandoff(body, 1500)` — the shipped 0.78 lateral / −0.46
  approach / 0.32 up three-quarter portrait basis, at 1,500 from center
  (≈914 off the hull, **outside `CORRIDOR_RANGE` 1,400**: no corridor
  publication, no berth invitation, threshold restraint enforced by shipped
  geometry rather than by discipline).
- Camera: vehicle FOV 70 (horizontal ≈102°), player-held; the 2.5s thrust-cold
  hold guarantees the frame exists without stealing the look.
- Composition: spine runs from upper-left toward center-right, occupying ~31%
  of frame width on the left golden-section band; dock/berth end toward frame
  center but the berth arms *not* centered (no door offered); amber window rows
  are the brightest values in frame; hull mass a mid-grey dark shape (the
  shipped `#38455c` ambient guarantees "dark shape, not hole"); star field
  around; **no galaxy, no planet, no home fires in frame — both fires are
  explicitly behind the camera, which is K11's geometry made literal**.
- Chrome state at the captured cut-line frame: K11 fully painted lower-center;
  T3 work order **cleared** — the first frame in the run where the station
  exists with no guidance annotation. The image the run ends on is the sky no
  longer needing to be explained.
- Letterbox: none (agreeing with the Chapter's ask, and with my own ST-2 rule).
  Mobile: same framing holds — at 844×390 the horizontal FOV widens, spine drops
  to ~26% width; still primary because it is the only warm mass in frame.

## 8. Agency and hand-back

Player-owned throughout; the intent's windows are binding and met:

- ch10-cold / ask: continuous control, no forced look, no authority change.
- Transit: flight control throughout; the single dip is the declared 2.5s
  thrust-cold hold (movement-partial, look/interaction live, diegetic, RM-neutral
  because no camera parameter changes, pause-safe, releases by re-arming thrust
  with zero camera event).
- Hand-back: mandatory after K11's caption — T3 clears to nothing; free flight;
  no marker; docking blocked pending Q-INT1.
- ST-0 never takes anything: no forced look exists anywhere in this run, and I
  refuse one for the movie lane too (§10 C2) — if the autopilot's walk cannot
  frame the dot, the fix is path/idle-gaze shaping in the autopilot (Chapter's
  lane), never a camera grab in free play.

## 9. Variants, performance, sandbox no-op

- **Tiers:** state traces at desktop HIGH, MEDIUM+reduced-motion, LOW, mobile
  POTATO (lock). LOW/POTATO: ST-0 identical (quad + clamp); seam/resolve carried
  by emissive-vs-black contrast, which no tier can remove. HIGH: bloom halos as
  shipped, hero stills only.
- **Reduced motion:** ST-0 keeps its celestial motion (world state, same class
  as the shipped star-field drift, which RM does not freeze); no camera motion
  exists to reduce; the thrust-cold hold is motionless by construction. RM LOW
  strip covers seam→resolve→handback to prove it.
- **Mobile:** input glyphs via `inputGlyphs.ts` as shipped; canopy aperture at
  844×390 confirmed by the adopted ch8 mobile sidecars; ST-0 clamp is
  DPR-corrected so 2.4 px means device pixels.
- **Performance:** ST-0 = exactly +1 draw call in free play (one quad, shared
  scratch vectors, zero per-frame allocation, uniform-only updates); no new
  shader programs anywhere; transit adds nothing (the exterior already renders;
  two instanced draws, shipped). Gate: FPS non-regression vs the 2026-08-10
  `fps-baseline` at LOW, sampled in night free play with ST-0 above horizon.
- **Sandbox no-op:** ST-0's render predicate = story world ∧ durable
  `storyComplete` ∧ `twoWorldHandoff`. Pure sandbox, `?spacestation=`, and all
  pre-`done` story beats render byte-identically. New rail entries are inert
  outside ch10 beats.

## 10. Answers C1–C6

- **C1 — accepted and specified.** `ST0_TRANSIT_PERIOD_SECONDS = 90`, rate
  0.070 rad/s (7× star drift), ~36–40s visible crossing, worst-case complete
  crossing inside any 180s window by t=130s (§6). Brightness: above brightest
  star, below moon, clamp 2.4 px. Not-a-star: speed + warmth + arc. Not-a-marker:
  constant luminance, no pulse, warm-vs-cyan, unlabeled, night-only.
- **C2 — off-frame, agreed, with a verifiable rule.** The movie shelter egress
  face opens at ch10-cold entry while the face is outside the movie camera's
  frustum (probe-assertable), with ≥1s between removal and the autopilot's first
  step so no strip frame straddles it. The movie must not photograph its own
  scaffolding — and it must not photograph the *absence* of scaffolding either:
  the first outdoor movie frame is composed by the walk, not by the doorway.
  Rider: the ST-0 "guaranteed perception" claim needs the walk's heading to put
  the crossing in frustum; the verifier trace must log an st0-in-frustum flag
  during the night walk, and if geography defeats it, the repair is autopilot
  path/idle-gaze shaping (Chapter/Integration), not a camera grab.
- **C3 — framing-tied, yes.** `SEAM_OF_LIGHT_MIN_BLEND = 0.9` +
  `SEAM_VIEW_CONE_DEG = 20`, not raw distance: the line is born ~56 px long at
  LOW the moment the sky finishes going black (§7), and 0.9 > 0.78 keeps A5's
  galaxy bloom-in strictly earlier than our reveal.
- **C4 — taken.** 2.5s thrust-cold hold (inside the offered ≤3s), look live,
  RM-neutral, pause-safe. Standoff `arrivalStandoff(body, 1500)`, chosen to sit
  outside `CORRIDOR_RANGE`; portrait weighting = the shipped 0.78/−0.46/0.32
  basis. Letterbox declined. Closing-shot spec in §7.
- **C5 — one structural need, plus one hazard.** Need: a station-target marker
  handle — the shipped bridge resolves world handles and planet targets; T2
  needs the committed `spaceStationTarget` (position from `systemFlight`
  snapshot) exposed as a handle of the same chrome ("ISSUED BEARING · 6976m"
  class), no new marker language; `requiresMarker` drops inside the resolve
  envelope exactly as ch8's acquire-sibling comment prescribes. Hazard
  (**Q-INT1, routed**): within `SCAN_RANGE` 5,200 the shipped contact HUD
  publishes "hold for approach" advisories, and inside the corridor gates
  **KeyF docks via page swap** (`SpaceStationApproachDriver.tsx` +
  `App.tsx#enterSpaceStation`). Story mode pre-docking-era must suppress the
  dock offer and the advisory copy (call-site predicate; allowedPaths covers
  "spaceStationDevFlag.ts and minimal call sites"), or the run's exit seam and
  the owner's docking packet are both violable by one keypress.
- **C6 — declined.** The `◆ SHELTERED` chip stays neutral. It reports shelter
  state, and the shelter *is* intact — the fault is the core; a chip that
  emoted on story cue would be a second guidance system and a small lie. The
  cold belongs to K1, the score, and the fault record.

## 11. Constraints and questions for peers (to be delivered as peer notes)

**To Chapter:**

- CH-Q1 (Q-INT1 restated as canon): what is the authored truth when a player
  noses to the hull inside 1,400? I propose: instruments go quiet (no advisory,
  no dock offer, no refusal copy) — the station simply does not answer this run;
  silence is both the cheapest wiring and the correct menace-by-procedure. If
  you want a REGULATION refusal line instead, that is new copy and yours.
- CH-Q2: the "hold for approach" advisory register, if ever shown in story, is
  implied-dock copy; I recommend it never appears before the docking era.
- CH-Q3 (C2 rider): accept the st0-in-frustum verifier obligation on the night
  walk, with autopilot path/idle-gaze shaping as the repair lane if geography
  defeats the guarantee. I will not take the camera to fix it.

**To Score (unseen treatment; these are constraints from the image, not answers
to their asks):**

- SC-Q1: the seam is a *veil-clearing*, not a crescendo — the line is already
  whole when the sky finishes going black (§7). If the seam gets any color, it
  should acknowledge, not build; nothing visual swells for it to ride.
- SC-Q2: the 2.5s thrust-cold hold at resolve is engine-silence made diegetic —
  the image goes physically quiet. Whatever the cue does there, the frame will
  read best against near-silence; the intent's no-awe-mediant rule has my
  agreement from the picture side.
- SC-Q3: ST-0 is silent forever this run (law). If a later packet ever gives the
  carrier a pitch, note that the dot's period is 90s — audible periodicity that
  coincided with it would constitute a cue by stealth; keep any future color
  free of 90s-locked rhythm.

**To Integration:** Q-INT1 (dock/advisory suppression predicate, §10 C5);
station-target marker handle; egress frustum assertion + 1s buffer; ST-0
predicate (story ∧ storyComplete ∧ twoWorldHandoff, both worlds); the
`SEAM_OF_LIGHT_MIN_BLEND` / `SEAM_VIEW_CONE_DEG` / `STATION_STANDOFF_DISTANCE` /
`ST0_*` named constants land in the contract, not inline.

## 12. Capture specification (inside the lock's lean budget)

All strips LOW 1280×720 DPR1, ≤8 frames each, movie lane via `?story=ch10-*`
jump targets (habitat-seeded per intent); traces at 2 Hz change-detected. No
webm. Deliverable names are final.

| Deliverable | Frames | Contents |
| --- | --- | --- |
| `evidence/capture/strip-cold-a/` (8) | shelter pre-activation; `cold-noticed` −/0/+; K1 painted; `fault-read` −/0/+ | entry seam + first two anchors |
| `evidence/capture/strip-cold-b/` (8) | egress face pre/post (C2 rule proof); `fabrication-refused` −/0/+; beat-exit guidance clear; ch10-ask fresh entry; spare | refusal + lifecycle boundary |
| `evidence/capture/strip-st0-crossing/` (8) | one full crossing during the night walk: pre-rise, rise, 3× arc (one at true-bearing crossing), set, post-set, +1 at next-rise timestamp | period + recurrence proof (trace logs 3 periods + in-frustum flag) |
| `evidence/capture/strip-ask-a/` (8) | `A1` reboard −/0/+; `A2` acquire −/0/+; `A3` landfall −/0 | return crossing in ch8 grammar |
| `evidence/capture/strip-ask-b/` (8) | `relay-ask` −/0; `relay-answer` 0/+ (consecutive frames proving K8 inside K7's breath); `bearing-claimed` −/0/+; marker state post-claim | the rite; R1's visual non-acknowledgment |
| `evidence/capture/strip-transit-a/` (8) | `transit-ignite` −/0/+; T2 hold marker frame; `seam-of-light` −/0/+; galaxy-absence check frame | the veil-clearing at LOW |
| `evidence/capture/strip-transit-b/` (8) | `station-resolved` −/0; hold mid; hold release; K11 painted; work-order cleared (cut-line state); `threshold-handback` 0/+ | resolve, hold, hand-back |
| `evidence/capture/strip-rm-transit/` (8) | reduced-motion LOW: seam −/0/+, resolve 0/hold/release, handback + | RM parity proof |
| `evidence/capture/still-st0-sighting.png` | HIGH still 1 (`capture.st0.sighting`) | from the hearth, night: ST-0 near true-bearing crossing upper-third, nebula gap behind it, hearth-glow horizon strip at bottom edge — dot and home in one frame; moon excluded from the composed frame |
| `evidence/capture/still-seam-of-light.png` | HIGH still 2 (`anc.ch10.seam-of-light` +0) | canopy aperture, seam centered, sky just-black, no galaxy in aperture |
| `evidence/capture/still-station-resolved.png` | HIGH still 3 — **the run's cut line** | §7 spec exactly: standoff 1,500, FOV 70, spine ~31% width on left golden-section band, amber rows brightest, K11 painted, work order cleared, no galaxy/planet/home in frame |
| state traces | 0 frames | all four tier variants + RM: signed-AV snapshot at every ch10 anchor (authority, FOV, agency, postFx, reset reason), ST-0 predicate/draw-count probe, FPS sample vs 2026-08-10 baseline, autopilot movie-lane cold runs ×3 with zero timeout rescues |

Total: 64 LOW frames, 3 HIGH stills, 0 movie renders — inside the lock.

Headed real-GPU taste questions (owner, later): (1) is ST-0's clamped point
*findable* on a real display in a real room within one crossing, without being
nagging on the tenth? (2) does the resolve hold read as engines-cold or as a
stolen input? Both are feel questions no strip can answer.

## 13. Non-goals, dissent, disposition

Non-goals (mine, atop the lock's): no letterbox anywhere in ch10; no authored
camera move of any kind; no new grade family; no ST-3 FOV work (deferred with
the apron — my July 62–66→75 proposal stays withdrawn until docking exists); no
composition on `GalaxyImpostors`; no pursuit imagery; no frost/cold visual FX;
no HUD dramatization (C6); no acknowledgment of ST-0 in any channel I own.

Open dissent: none yet — Score's treatment unseen by design; the reconciliation
file will carry any conflict with the first-perception stack. Standing objection
I will convert to a formal note if unaddressed: **Q-INT1 is contract-blocking**
— I will not sign a scene contract whose exit seam ("not docked, not inside")
is falsifiable by a shipped keybinding.

Owner taste questions carried: the two headed questions in §12; K11 flag is the
Chapter's (noted, not mine).

Disposition: `ready_for_cross_notes` — every number above is measured against
`929e3d0`, every staging fits the allowedPaths, and the three decisions that are
not mine (dock-silence canon, autopilot path shaping, pedal down-payment) are
routed by name.
