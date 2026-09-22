# Story Intent — station interior light (polish pass)

Author: Chapter Director
Status: ready_for_independent_treatments
Contract target: `station-interior-light` revision `1`
Production lock: `production-lock.md` (2026-09-04T21:50:39-04:00) — binding. No copy, no beats, no audio, no post chain, no approach/dock.

## Thesis — the dramatic contract

The owner rejected darkness as the station's way of saying "unkind". He is right, and the
fix is not brightness. The colour script (cold → clinical → warm → coldest → sodium) stays;
what changes is *how each room withholds kindness*. Darkness withholds by hiding. The station
should withhold by **showing**: the dock shows you how far the counter is, the registry shows
you every seam under shadowless light, the hall shows you how far it goes. The concourse
remains the only room that likes you — not because it is the only room you can see, but
because it is the only room that comes down to your height. **A room you can read is still
allowed to be cold. A room you cannot read is just a bug.**

Nothing in the visit's meaning moves.

## Grounding

- Affected shipped surface: the interior branch of `SpaceStationSandbox.tsx` in both modes —
  standalone `?spacestation=` (non-canon sandbox) and the story continuation (`from=game`,
  gate `stationStoryEligible`). Milestones `story:ch11-*` per `spaceStationStory.ts`.
- Runtime references: `SpaceStationLighting.tsx` (`DISTRICT_FILL`, `POOL_SIZE 7`,
  `WARM_SLOTS 3`, `ILLUMINANCE_AT_REACH 0.6`, `FILL_FADE_SECONDS 0.8`);
  `spaceStationDressing.ts` (`dressFloor` column lamps reach 34 at +17m, desk lamps 7.5,
  concourse stall lamps 6, registry desk lamps 6.5); `SpaceStationSandbox.tsx`
  `StationStoryHud`, `StationStoryMarker`, `StoryInteractionPrompt`, `InteractionPrompt`,
  `AirlockPrompt`, `Crosshair`, `AIRLOCK_REACH 9`; `StationStoryPanel.tsx`.
- Canon: `station-continuation-contract.md` (movement, protected unknowns — no station proper
  name, no sealed-volume explanation, no vendor recognition of Terra); ch10 `story-intent.md`
  (the station is never the actor; "ISSUING STATION" is the only functional noun coined).
- Evidence: `evidence/baseline-sheet.png`, `shipped-visual-baseline.json` (bureau 1.1 / 6.6
  mean luma, 100% / 92% under 16; dock 17–20; warehouse 20; concourse 29–30; registry 41).

## Player action and agency

The interior is free first-person play throughout: walk (WASD / D-pad), look (pointer-lock /
touch), sprint, jump. No camera is ever taken. Interactions, all `[F]`/`USE`:
approach and talk to any vendor (facing-gated, `vendorInReach`); trade (held until
`story:station-trade-unlocked`); the two story desks (distance-gated on `reach`); the airlock
(apron, `AIRLOCK_REACH 9`; in story mode only through the `depart` objective).
Agency is continuous; the only modal states are the panels the player opens. This pass may not
add or narrow any of that.

Reality-stage ceiling: the station renders at the shipped full stage — grade, Sobel, N8AO,
ACES 0.94 — with no paradox-family effects and no new effect family. A lamp is a lamp; light
may not "notice" the player (no reactive, tracking, or breathing fittings). Cardinality of
lights never changes around a verb.

## What each district should feel like now

| District | Shipped meaning (kept) | New expression | What must be legible |
| --- | --- | --- | --- |
| **apron** (`airlock-threshold`, `apron-cross`) | cold, industrial, big | a working bay at shift change: cool hard light, long even floor, the far portal to the counter the brightest object on the wall | the floor grid to the far wall; the counter portal as the obvious way in; the Kestrel's lock as the obvious way out when you turn around |
| **counter** (`registry-desk`) | clinical, most evenly lit, least kind | over-lit and shadowless; unkindness is *flatness* — no pools, no warmth except the desk lamp that belongs to the clerk, not to you | the queue side of the middle desk; the crowd figure behind the counter; the exit toward the concourse |
| **concourse** (`concourse-open`) | warm, bright, busy, the only room that likes you | unchanged in warmth; may gain a *visible* ceiling/canopy so warmth has a lid; remains the fill peak | the aisle, stall fronts, sign boards, the certified-components stall; people as a species |
| **floor / hall** (`hall-plain`) | coldest, dimmest; the lamps are the only inhabitants | **the plain must be seen.** A blue-grey floor running to columns and a far wall, each desk an island of warm light; the ceiling alone may vanish upward. Coldness becomes *extent* — you can see exactly how much empty room there is | floor to at least the next column; desk islands as a grid; the way back |
| **shelves** (`racking-aisle`) | dim sodium, close ceiling, cardboard | amber, close, cluttered — dim relative to the concourse, never below the legibility floor | aisle direction, rack faces, the doorway you came through |

The script's *order* is protected: hue moves cold → neutral → warm → coldest-hue → amber,
and fill level peaks at the concourse. The hall keeps the lowest fill of any entered room —
but "lowest" is a ratio against the concourse, not a black. I ask Cinematography to name a
**legibility floor** (a numeric mean-luma / pct-under-16 target per district) and hold every
entered district above it while the ordering stays monotonic.

`concourse-open` is the one threshold with story copy attached (`(warmth you did not make.)`
fires off `story:ch11-concourse-entered`, which fires on cell entry). The light change at that
doorway must be the most *felt* cross-fade in the station; it is what makes the line true.

## Story information and new visible text

No new story information. Wayfinding should be non-textual first: lit thresholds (the doorway
out of any room is the brightest thing on its wall), the registry strips reading as a runway,
floor guidance in the shell's own trim tones. If text signage is used it is limited to a
closed lexicon already in shipped copy — `COUNTER`, `CONCOURSE`, `AIRLOCK`, arrows — in
REGULATION caps. **The hall and the warehouse stay unnamed** on any sign; naming them would
coin canon, and an enormous room with no name is its own statement. No station proper name,
no "ISSUING STATION" outside the counter eyebrow where it already lives. Both-readings check on
the lexicon: `COUNTER` (a desk / the count), `CONCOURSE` (a hall / a coming-together),
`AIRLOCK` (neutral). No contemporary connotations. No hidden-pillar spend here — zero budget.

## Guided segments (story mode) — shipped, preserve; may re-present

| # | Objective id | Verb / input | Marker label (exact) | Standing work order | Entry → progress → completion | Clear / replace / reset | Fallback |
| --- | --- | --- | --- | --- | --- | --- | --- |
| G1 | `station:counter:registry-entry` | walk to the queue side of the middle desk; `[F]`/`USE` "Present the suit record" | `COUNTER · PRESENT DESIGNATION` | `FOLLOW THE REGISTRY CORRIDOR.` / `[F] PRESENT THE SUIT RECORD.` | entry: HUD appears with low line `(your body takes its place before the marker does.)`; progress: live `·Nm` distance + in-world ring; completion: registry panel transcript, `story:ch11-registry-recorded` | replaced by G2 on receipt; derived from milestones so reload reconstructs | none needed — free walk; panel closable without loss |
| G2 | `station:concourse:certified-source` | find B-7073 "Bell"; `[F]`/`USE` "Present the habitat fault" | `CERTIFIED COMPONENTS · B-7073 “BELL”` | `FIND THE CERTIFIED COMPONENT TRADER.` / `PRESENT THE HABITAT FAULT RECORD.` | entry on receipt; `(warmth you did not make.)` on concourse entry; completion: cargo receipt, `bonded_cell` ×1, trade unlocked | replaced by G3 | other vendors open a bounded topic panel; cannot advance |
| G3 | `station:departure:stow-cell` | return to apron; `[F]`/`USE` "Stow the bonded cell and depart" | `KESTREL AIRLOCK · STOW THE CELL` | `RETURN TO THE KESTREL.` / `[F] STOW THE BONDED CELL AND DEPART.` | entry with `(one fire waiting. carry back what the world could not give.)`; completion: `bonded-cell-stowed` then departure route | clears to nothing; `stationDeparted` on undock | airlock refuses silently before G3 (no prompt is shown) |

What this pass may do to those: layout, typography, contrast, size, safe-area, and a
presentation-only entry acknowledgement (a HUD flash on objective id change — one per id, never
a milestone). It may re-scale the marker so it is visible at hall distances. It may not change
one word, id, reach, or gate.

## Named anchors

`airlock-threshold` (first frame on the apron, back to the ship) → `apron-cross` (the walk to
the counter portal) → `registry-desk` (G1) → `concourse-open` (the fill cross-fade; the low
line) → `issuer-stall` (G2) → `hall-plain` (optional; the extent reveal) → `racking-aisle`
(optional) → `airlock-return` (G3, the same lock seen from inside). No timestamps.

## Player-experience defects observed (frames + code)

1. **Hall is a black void** (`07-bureau` 100% under 16). A player stepping out of the
   concourse sees nothing — no floor, no columns, no way back. Column lamps at reach 34 with a
   7-light pool cannot serve a 180m grid.
2. **Doorways do not announce themselves** except the apron→counter slot. In `05`/`06` the
   concourse ends in dark; the far portals are indistinguishable from wall.
3. **Marker scale.** The 0.62m ring at target+2.2m is a few pixels past ~40m at FOV 75 and
   invisible when behind the player; the only fallback is the `·Nm` number, which says how far
   but not which way.
4. **Two prompt rules.** Story desks trigger on distance; vendors require facing. At Bell's
   stall both can be true and the story prompt wins — correct, but a player who walks past Bell
   facing away still gets the story prompt while a vendor prompt would need a turn. Unify the
   *presentation* (same box, same position) so the difference is not felt.
5. **Crosshair** is 3px at 55% alpha — fine on black, gone on a lit registry wall. Lighting
   the station will erase it.
6. **Low-line contrast.** The three low lines are the visit's emotional payload and render at
   `DIM_INK` (50% alpha) on 82% black — likely under 4.5:1.
7. **Prompt vs. touch controls.** Story/vendor prompts sit at `top: 58%`; on a short mobile
   viewport the fps D-pad/action cluster can overlap them. The station page is a separate entry
   — confirm whether its surfaces are registered in `hudSurfaces.ts` and swept.
8. **Story-mode airlock is silent before G3.** Walking to the ship gives no prompt and no
   refusal. Adding copy is out of lock; record it for a later run. Visually, the lock should not
   read as an open invitation while the objective points elsewhere.
9. **No controls hint in story mode.** The only `click to capture mouse · WASD…` line lives in
   the diagnostic `hud=1` panel.

## Constraints and questions for Score

There is no audio at the station and the lock forbids adding any. Score is asked to: (a)
decline a cue and sign the same contract revision explicitly as "no cue, by contract"; (b)
verify that the silence is intact — no engine leaks through the screening-driver hook or the
page seam, combined-bus render if needed; (c) note for the record whether the silence is a
protected baseline or an unspent inventory, so a future run inherits the decision rather than
the accident. No audible acknowledgement is requested for objective entry.

## Constraints and questions for Cinematography

1. Name the legibility floor per district and the monotonic ordering that survives it. The
   hall's image ("desk lamps on a dark plain") must survive as *islands on a visible plain*.
2. Pool size / reach / emissive-floor strategy — your call, within one material program and
   ≤ +2 draw calls. Fittings must not visibly swap during the walk.
3. Fog and background per district: can fog carry the colour script so distance reads as
   hue, not as black?
4. `concourse-open` cross-fade: may `FILL_FADE_SECONDS` be per-threshold, and does the
   concourse need a lid?
5. HUD: contrast targets for `INK`/`DIM_INK`/`WARM_INK` over the new brighter frames; crosshair
   weight; prompt position on mobile; marker size and an off-screen affordance that stays
   within the existing marker idiom (no second marker language).
6. Crowd legibility under new light — the species rule, not portraits.
7. Headed real-GPU exposure remains an owner gate; state what SwiftShader captures can and
   cannot prove.

## Non-goals and protected strengths

Non-goals: any copy, id, reach, gate, or milestone; audio; `PostFX.tsx`; approach/dock/undock;
economy; crowd behaviour; exterior; a station name. Protected: two-instanced-draw interior;
one material program; the colour script as a sequence; the concourse as the only room that
likes you; both-readings on every new glyph of text; the standalone sandbox staying
ephemeral and non-canon.
