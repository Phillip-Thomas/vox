# Cinematography Treatment — station interior light

Author: Cinematography Director
Status: ready_for_cross_notes
Prepared independently from the Score Director's first treatment: `YES`
Story-intent revision: `station-interior-light` rev 1. Lock: `production-lock.md` 2026-09-04T21:50:39-04:00.

## 1. Current-cut audit — why each frame is dark

Evidence: `shipped-visual-baseline.json`, `evidence/baseline-sheet.png`, `evidence/baseline-hud/*.png`, code hashes in the baseline.

| Cause | Where | Mechanism (from code) | Share of the problem |
| --- | --- | --- | --- |
| **Albedo** | all | `SURFACE_TONES`: floor `0x585f67` (~0.10 linear), walls `0x666d76` (~0.14), ceiling `0x1c1f23` (~0.012). The shader then multiplies by seam (×0.45 on lines), grime (−10%), plate/mottle/hash. Net ~0.09 for a floor. Fill × 0.09 is invisible after ACES at 0.94. | primary, every district |
| **Fill level** | apron/floor/shelves | `DISTRICT_FILL` ambient 0.6–0.68 with fill colours of ~0.09–0.2 linear. Ambient term ≈ 0.09 × 0.1 × 0.6 ≈ 0.005 linear ≈ 12/255 after tone-map: that is the "black" floor. Concourse gets 1.85 × 0.35 — the one room with a real fill term. | primary |
| **Ceiling tone** | counter, concourse, shelves | tone 1 is painted to vanish. `06b-concourse-up` 54.9 % under 16: the warm room has a black lid; the registry's "shadowless" ceiling is a void above the strips. | secondary, drives pct-under-16 |
| **Pool starvation** | floor (86 fittings, 7 slots), concourse (35) | 3 warm slots serve the nearest 3 of 80 desk lamps; 4 cool slots serve 6 column lamps 64 × 75 m apart at +17 m, so the floor under a standing player receives grazing light from ~40 m. The remaining 77 desks are 0.3 m emissive cubes on nothing. | primary for the hall's *image*, not its level |
| **Fog** | all | FogExp2 `#0a0f16` 0.0016: 2.5 % at 100 m. Not a cause of darkness, but its near-black colour means every long sightline fades to black instead of to a hue. Wasted asset. | neutral now; usable |
| **Exposure / ACES** | all | 0.94 matches `App.tsx`. Not a cause; the inputs are simply below the toe. | none — do not touch |
| **N8AO** | corners, under desks | contact darkening on already-dark values. | minor |

Strongest existing image: `03-registry` — strips as a runway, one warm clerk's lamp, a figure in the queue. Weakest: `07-bureau` (100 % under 16), then `06b` (black lid over the only warm room). Continuity break: `05`/`06` end in black where the hall portal should announce itself. Must not change: the sequence cold → clinical → warm → coldest → sodium; the concourse as peak; two instanced draws; 13 programs; `POOL_SIZE 7`; FOV 75 free first person.

## 2. Visual thesis

**The station stops hiding rooms and starts showing their size.** Light in this station is ambient extent, not spotlight kindness: fill and albedo carry every room; point lights are reserved for the few pools that belong to someone (a clerk, a trader, a desk). Coldness becomes *how much lit floor there is between you and anything*. The concourse remains the only room whose light comes down to head height.

Rejected alternatives (structurally distinct, not colour variants):

- **B — two-tier pool (7 → 12 lights, five hall-scale).** Adds per-fragment cost to the single program in every district, still cannot serve 80 desks, and lights the hall with *pools* — pools read as kindness, the opposite of the hall's meaning.
- **C — station-canvas exposure to ~1.25.** Lifts the trough by clipping the peak: strips and emissives blow, the counter goes white, the sequence flattens, and the sandbox diverges from the shipped grade lineage. Exposure stays 0.94.

## 3. Colour script with numeric targets (color script)

Metrics per baseline vantage (1600 × 900, dpr 1, SwiftShader, `hud=0&t=17.5&dock=0`): **median luma** (ordering metric — robust to emissive strips), mean luma, % pixels under 16, % pixels over 235, std-dev (flatness). The legibility floor is the last row.

| District (vantages) | Palette role | Median target | Mean | % under 16 max | % over 235 max | Fill (ambient hex / int · hemi sky / ground / int) | Fog colour / density | Fade in |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **floor / hall** (07, 08) | coldest-hue: blue-grey plain, warm islands | **22–34** | 24–38 | 35 | 2 | `0x4c5d78` 0.95 · `0x6f86a8` / `0x22242c` 1.10 | `0x161d29` 0.0040 | 1.0 s |
| **apron** (01, 02) | cold industrial | **30–42** | 30–44 | 25 | 3 | `0x5c7088` 1.15 · `0x7a91a6` / `0x2a2118` 0.90 | `0x111821` 0.0030 | 0.8 s |
| **shelves** (09) | sodium, close | **34–46** | 34–48 | 25 | 3 | `0x8a7650` 1.10 · `0x9a8560` / `0x2e241a` 0.80 | `0x1c1710` 0.0035 | 0.8 s |
| **counter** (03) | clinical, flat | **48–62** | 50–66 | 10 | 4 | `0x91a8bd` 1.55 · `0x9fb4c8` / `0x303438` 0.50 | `0x141a22` 0.0020 | 0.8 s |
| **concourse** (04, 05, 06) | warm peak | **56–72** | 56–76 | 12 | 5 | `0xa08661` 1.85 · `0xbb9a6d` / `0x3d2c20` 1.55 (**unchanged**) | `0x2a2218` 0.0018 | **1.4 s** |
| concourse up (06b) | lid | ≥ 30 | ≥ 30 | 40 | 5 | — | — | — |

Ordering contract (must hold after every iteration): `median(hall) + 6 ≤ median(apron) ≤ median(shelves) − 0 … ≤ median(counter) ≤ median(concourse) − 6`; concourse is the maximum; hall the minimum; **counter has the lowest std-dev and lowest % < 16 of any district** (unkindness as flatness, not level). **Legibility floor: no entered-district vantage below median 22 or above 35 % under 16.** Hue ordering (mean chroma direction) stays cold → neutral → warm → coldest → amber.

Adjacent continuity: the approach/dock sequence is byte-identical; on `enterStation` the fill starts from the apron entry as today. Departure reverses through the same table. Fog and fill are station-Canvas objects only — the planet grade, `PostFX.tsx`, and exposure are untouched.

## 4. Lighting architecture

All within one material, one program, two instanced draws, `POOL_SIZE 7`, `WARM_SLOTS 3`, +0 draw calls.

1. **Albedo retune** (`SpaceStationInterior.tsx` `SURFACE_TONES`): floor `0x7d848c`, ceiling `0x3a4048` (still the darkest tone — it recedes, it no longer vanishes), walls/columns `0x8a9199`, desks `0x737b84`, partitions `0x878e97`. Trim, crates, awnings unchanged so the traders keep all saturation. `grime` stays 0.5; seam strength 0.55 → 0.45 so the tile grid reads as a grid, not as black bars on a lit floor.
2. **Fill retune** per the table (`DISTRICT_FILL`). Concourse untouched; every other room rises, the hall least. Hemisphere carries the hall (sky blue-grey onto the lightened floor = the visible plain); ambient carries the counter (flat, shadowless).
3. **Emissive-only fittings** — new convention `radius: 0` on a `lamp` box = unlit trim that **never enters the pool** (`SpaceStationLighting` filters `radius > 0`). Uses: (a) threshold jamb strips on every portal frame (`spaceStationShell.ts buildFrame`), tone 1, so the way out is the brightest thing on any wall; (b) a vertical edge strip on each hall column (as the apron already does) so the column grid reads as a grid of lit objects to the far wall; (c) a low deck guidance strip, 0.25 × 0.04 m, tone 1, from the counter's exit portal into the concourse and from the concourse's far portal into the hall, following the walking spine. All join the existing lamp instanced draw (~+60 instances).
4. **Airlock exception**: the Kestrel lock frame gets **no** jamb strip. In the apron the counter portal is the brightest object; the lock is a dark frame until the G3 marker points at it (defect 8, visual half).
5. **Fog carries the script**: `SpaceStationLighting` lerps `scene.fog.color` and `density` with the fill (same `useFrame`, same fade). Distance now reads as the district's hue, and the far hall wall fades into blue-grey haze rather than black — this is where most of the hall's pct-under-16 goes. Concourse fog is warm and thin so the market stays crisp.
6. **Per-threshold fade**: `FILL_FADE_SECONDS` becomes a column of the fill table; entering the concourse takes 1.4 s so the warmth is *seen arriving* on the line `(warmth you did not make.)`; leaving to the hall takes 1.0 s (cold comes faster than warmth).
7. **Concourse lid**: yes, and it needs no geometry — the lightened ceiling tone plus the existing eight banner uplights (reach 13.2) give the warmth a ceiling. Fixed in 06b.
8. Column work lamps and desk lamps stay pool candidates; the nearest three desks remain true pools — *islands on a visible plain*, exactly as asked.

Not proposed: ceiling strips in the hall (would steal the 4 cool slots from the columns), any per-shot hex, any change to bloom/outline/N8AO/exposure, any text signage (no textures exist; a text mesh would be a second program).

## 5. Shot ledger and player agency (free first-person; no camera authority is taken anywhere)

| Shot | Anchor | Focal subject (first read → second) | Blocking / direction | Guidance state | Safe area |
| --- | --- | --- | --- | --- | --- |
| `SIL-01` (01-dock) | `airlock-threshold` | counter portal jamb strips → floor grid to the far wall | screen right = deeper | G1 marker on portal axis | HUD top-left; prompt below crosshair |
| `SIL-01b` **new** (01b-apron-back) | `airlock-return` | the dark lock frame → cargo stacks | 180° turn | G3 marker on the lock | same |
| `SIL-02` (02-dock-mid) | `apron-cross` | portal → column strips | forward | `·Nm` falling | same |
| `SIL-03` (03-registry) | `registry-desk` | strips as runway → clerk's lamp → queue figure | forward, desk on right | G1 prompt at reach 4.2 | prompt must not cover the desk lamp |
| `SIL-03b` **new** (03b-counter-exit) | counter u 0.92 | the concourse portal, warm, brightest object on the wall | forward | G2 marker through the door | — |
| `SIL-04` (04-concourse-entry) | `concourse-open` | the fill cross-fade itself → canopies → people | forward | low line appears | HUD top-left only |
| `SIL-05/06/06b` | concourse | aisle, stall fronts, Bell's stall; species of figures; the lid | — | G2 | — |
| `SIL-07` (07-bureau) | `hall-plain` | lit floor to the next column → desk islands as a grid → far wall in haze | forward | G3 edge ring if off-screen | — |
| `SIL-07b` **new** (07b-hall-back) | hall u 0.18, 180° | the concourse portal, warm, the way back | — | G3 | — |
| `SIL-08` (08-bureau-deep) | hall | one true desk pool → grid of emissive islands → columns | — | — | — |
| `SIL-09` (09-warehouse) | `racking-aisle` | aisle direction → rack faces → doorway strip | — | — | — |

## 6. Wayfinding (non-textual, in order of reliance)

1. Threshold jambs (every portal, both faces) — the exit is the brightest thing on its wall.
2. Deck guidance strips along the two story spines (counter → concourse, concourse → hall).
3. Lamp gradient: fill fades are directional in time (warm arrives slowly), and the concourse's own fill glows through its portals into the hall and counter because fog there is thin.
4. No text signage in this pass. The lexicon (`COUNTER`, `CONCOURSE`, `AIRLOCK`) is reserved; using it would need a text material and breaks one-program. Hall and warehouse stay unnamed by construction.

## 7. HUD, prompt, crosshair, marker

| Defect (intent #) | Lane | Direction |
| --- | --- | --- |
| 3 marker scale | Cinematography | ring scale = `clamp(d / 18, 1, 12)` (≥ ~14 px on desktop at any distance); pulse/spin unchanged. **Off-screen affordance within the idiom:** when the target is outside the frustum, the same warm ring (DOM, WARM_INK, 18 px) clamps to the viewport edge along the bearing; hidden when on-screen. No arrows, no second language. |
| 4 two prompt rules | Cinematography (presentation) | one shared `stationPrompt` style: same box, padding, font, position for story, vendor and airlock; story keeps `#77f0a1`, others INK. Position moves from `top 58 %` to `top: calc(50% + 40px)` — the prompt hangs under the aim point because both rules resolve to what you are near/facing. |
| 5 crosshair | Cinematography | 5 × 5 px, INK at 0.85, `box-shadow 0 0 0 1px rgba(0,0,0,0.55)`: holds on black floor and on a white strip. |
| 6 low-line contrast | Cinematography | `DIM_INK` 0.5 → 0.68; story HUD background 0.82 → 0.88; prompt backgrounds 0.72 → 0.86. Computed backdrop over a 70-luma frame ≈ 11/255 → DIM_INK ≥ 6.5:1, INK ≥ 12:1, WARM_INK ≥ 8:1. Verify with a contrast probe on the mobile still. |
| 7 prompt vs touch | Cinematography + **Integration** | prompt max-width `calc(100vw − 2 × 150px)` on touch; **`hudSurfaces.ts` carries no station id** (verified: zero matches) — registering `station-story-hud`, `station-prompt`, `station-crosshair` is outside the lock's paths → Integration, lock revision. |
| 1, 2 | Cinematography | sections 3–6. |
| 8 silent airlock | Cinematography (visual) / **Chapter** (copy) | no jamb strip on the lock; refusal copy deferred. |
| 9 controls hint | **Chapter** | surfacing existing diagnostic copy in story mode is new visible text; not mine to place. |
| entry acknowledgement | Cinematography | on objective id change: the HUD's warm left border widens 2 → 4 px and back over 600 ms, once per id; static under reduced motion. |
| G1/G3 work-order `[F]` vs touch `USE` | **Chapter/Integration** | copy parity, not presentation. |

Crowd (question 6): no tone change in round one. Lightened walls (~0.27 linear) put the 0.18 suits into silhouette against them — the species read improves; visor ember unchanged. Gate: at `06-concourse-look` figure-vs-backdrop ΔL ≥ 0.08 linear; if it fails, darken `SUIT_DARK`, never brighten suits.

## 8. Variants

- Mobile 390 × 844 / landscape 844 × 390: same lighting (one tier); prompt below aim; HUD width `min(420px, 100vw − 32px)`; edge ring inset by safe-area.
- Reduced motion: no camera motion is added by this run; entry pulse static; edge ring static; marker pulse pre-existing.
- Quality: single tier; nothing here is tier-gated.
- Reset: fill/fog live in `SpaceStationLighting` and unmount with the interior branch; DOM ring unmounts with the objective. Sandbox no-op: no shared runtime file changes.

## 9. Performance plan

Gates (stable numbers): `programs 13`, `meshes 3` (interior 2 + crowd), point lights 7, instances ≤ baseline + 80 per district, draw calls +0 (all new boxes are instances of the two existing draws; the edge ring is DOM). SwiftShader FPS is noise; if a frame-time number is wanted, run the headless real-GPU probe at 4K per repo tooling and compare against the baseline on the same path. Per-frame CPU: one extra colour lerp and two scalars.

## 10. Capture specification (`main/tools/spaceStation-shots.mjs`)

1. Add stops `01b-apron-back` (apron u 0.12, turn +π/2), `03b-counter-exit` (counter u 0.92), `07b-hall-back` (floor u 0.18, turn +π/2).
2. Add a walked strip `T-concourse-open`: place at counter u 0.96, hold `__spaceStationWalk` forward, frames at −0.5, 0, +0.3, +0.7, +1.4, +2.0 s from cell change; proves the 1.4 s fade and the jamb strip.
3. Per frame: mean, median, % under 16, % over 235, std-dev, and a lower-third floor-band median; ordering assertion from section 3 printed as pass/fail.
4. HUD stills: the six existing (`hud=1`) plus story-mode stills at registry-desk, concourse-entry, hall (G3 off-screen ring) on desktop and 390 × 844 — needs the seeded story save the ch10 run used (Integration to supply).
5. Contrast probe: sample DIM_INK/INK/WARM_INK pixels against their box backdrop in the stills.
6. Headed real-GPU (owner gate): SwiftShader is a conformant rasterizer, so fill, albedo, fog and the luma metrics are provable headless; what it cannot prove is frame time, bloom/N8AO half-float precision, and how the owner's display renders the toe. Taste questions for the headed session: is the hall's blue haze "extent" or "murk"; is the counter flat enough to feel unkind; does the concourse still feel like the only room that likes you.

## 11. Disposition

`ready_for_cross_notes` — targets are numeric and monotonic; architecture holds every protected strength; three items route out of my lane (hudSurfaces registration → Integration with lock revision; controls hint and airlock refusal copy → Chapter). `contractChangeRequired: true` for the fade-per-threshold and marker semantics, to be carried into the contract rather than assumed.

## Reconciliation amendments (draft-v1)

Responses to `note-ch-02` and `note-sc-02` (`cinematography-reconciliation.jsonl`). These supersede §3 "Fade in", §4 items 3c and 6, §6 item 2, and §10 item 2 where they differ.

1. **Anchor definition.** `concourse-open` is t=0 at the `occupiedCellId` change into the concourse, in both the standalone sandbox and story mode (the milestone commits inside that same effect). Fade and low line are consequences of that instant.
2. **Fade model (replaces the exponential lerp in `SpaceStationLighting.tsx`).** A finite eased ramp from the cell-change timestamp: `THRESHOLD_FADE_SECONDS` keyed by destination district — concourse 1.4, floor 1.0, apron 0.8, counter 0.8, shelves 0.8; `THRESHOLD_FADE_EASE` = smoothstep (3t²−2t³). At t=0 the live fill is snapshotted as the ramp's start so a mid-fade retarget restarts from the current value: monotone per segment, no overshoot, exact arrival at D. 60 % of the ramp lands at 0.57 D, 95 % at 0.81 D (concourse +1.13 s), 100 % at D. Fog colour and density ride the same ramp. All constants exported by name.
3. **Low-line presentation delay.** `(warmth you did not make.)` mounts at opacity 0 and rises via a named CSS delay: `LOW_LINE_PRESENTATION_DELAY_SECONDS` = 0.8 (the concourse ramp's 60 % instant) and `LOW_LINE_FADE_SECONDS` = 0.4 — full opacity at +1.2 s with fill ≈ 94 %. Copy, id, and gate unchanged. Reduced motion keeps the delay and steps opacity. The line is never re-animated once mounted (milestone persists).
4. **Hall deck strip dropped.** Deck guidance strips exist only on the objective spine: the counter ↔ concourse strip stays (G2 out, G3 back); nothing on the floor points into the hall. The hall stays findable by the jamb strips on both faces of the concourse far portal and by its own blue-grey fill and haze seen through the frame. §6 order of reliance becomes: jambs → spine strip → fill/fog hue through portals.
5. **Capture (`T-concourse-open`).** Frames at −0.5, 0, +0.4, +0.8, +1.2, +1.4, +2.0 s from cell change. `SpaceStationLighting` exposes a window diagnostic reporting district kind and ramp progress; the strip prints progress, concourse median luma, and the caption's computed opacity per frame. Assertions: opacity 0 through +0.8; opacity 1 at +1.2 with progress ≥ 0.9; progress ≥ 0.95 at +1.2 and = 1.0 at +1.4.
6. **Non-periodic confirmation.** No fitting, strip, fog term, or HUD element has a period; the fade is one-shot per threshold; the entry border is one-shot per objective id.

`contractChangeRequired: true` stands — items 1–4 are contract lines, not implementation detail.
