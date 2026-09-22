# Shipped Reference Map

Status: shipped rows recorded (mechanical verifier, read-only, 2026-09-04)

Record only observed shipped behavior as shipped. Put planned or proposed
material in a separate row with status `draft`.

| ID | Status | Beat/scene | Runtime authority | Story/canon authority | Frame/audio evidence | What must continue |
| --- | --- | --- | --- | --- | --- | --- |
| `ref-01` | `shipped` | station interior, district colour script | `main/src/components/spaceStation/SpaceStationLighting.tsx:82 DISTRICT_FILL` | `production-lock.md` protected strengths | `shipped-visual-baseline.json` frames 01–09 | the sequence cold → clinical → warm → coldest → sodium stays a sequence, never one uniform brightness |
| `ref-02` | `shipped` | station interior, one-program surface | `main/src/components/spaceStation/SpaceStationInterior.tsx` (instanced surface + lamp draws) | `production-lock.md` protected strengths | `evidence/baseline-perf.json` `hudPass[].diagnostics.programs = 13` at all five districts | programs stays 13; `meshes` stays 3; light cardinality (`POOL_SIZE 7`) never changes around a player verb |
| `ref-03` | `shipped` | station interior, story objective chrome | `main/src/components/spaceStation/SpaceStationSandbox.tsx:1182–1296` | `main/src/game/spaceStation/spaceStationStory.ts:227` | `shipped-ux-baseline.json` `markerAndWorkOrderMap` | the three objective ids, marker labels and work-order lines are shipped copy and are protected by the lock |

## District → light / dressing / geometry map

Default sandbox address `{system:{x:-19,y:-17}, index:0}` → worldId `-19,-17:a0`,
seed `575085297`, boundRadius `854m`. Cell dimensions and lamp counts below were
computed from the shipped modules (`buildSpaceStationDescriptor` +
`buildSpaceStationDressing`) for that seed, not estimated.

Global lighting constants (`SpaceStationLighting.tsx`): `POOL_SIZE 7`,
`WARM_SLOTS 3`, `REASSIGN_INTERVAL_SECONDS 0.25`, `ILLUMINANCE_AT_REACH 0.6`,
`FILL_FADE_SECONDS 0.8`, `LAMP_WARM 0xffa447`, `LAMP_COOL 0xbfe4ff`.
Interior fog: `FogExp2 #0a0f16 density 0.0016`; canvas background `#05070a`;
`ACESFilmicToneMapping` at exposure `0.94`.

| District (cell kind) | `DISTRICT_FILL` entry (ambient, ambientIntensity, sky, ground, hemiIntensity) | Cell min → max (m) | Cell size X×Y×Z (m) | Dressing lamps placed for it (`spaceStationDressing.ts`) | Lamp count / radius histogram | Props (total instanced boxes) | Baseline frame ids |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `apron` | `fill(0x54687e, 0.62, 0x6d8296, 0x241b14, 0.62)` | `[0,0,-17]` → `[99,15,17]` | 99 × 15 × 34 | wall fittings tone 1 r13 every ~11m both sides; column edge strips tone 1 r9 (2 rows flanking the aisle); `ceilingStrips(cell, seed, 9)` tone 1 r `max(7, height*1.25)` | 36 lamps — `{9: 12, 13: 18, 18.75: 6}` | 167 | `01-dock`, `02-dock-mid` |
| `counter` | `fill(0x8098ae, 0.92, 0x93aac0, 0x2a2620, 0.72)` | `[99,0,-6]` → `[201,6,6]` | 102 × 6 × 12 | one warm desk lamp tone 0 r6.5 per registry station (14 stations); `ceilingStrips(cell, seed, stations=14)` tone 1 r7.5 | 27 lamps — `{6.5: 14, 7.5: 13}` | 69 | `03-registry` |
| `concourse` | `fill(0xa08661, 1.85, 0xbb9a6d, 0x3d2c20, 1.55)` | `[201,0,-51]` → `[345,11,51]` | 144 × 11 × 102 | stall lamps tone 0 r6 hung under each canopy; freestanding-kiosk lamps tone 0 r9; banner uplights tone 1 r `max(9, height*1.2)` = 13.2. **No `ceilingStrips`.** | 35 lamps — `{6: 25, 9: 2, 13.2: 8}` | 493 | `04-concourse-entry`, `05-concourse-mid`, `06-concourse-look`, `06b-concourse-up` |
| `floor` | `fill(0x44546e, 0.6, 0x586984, 0x1c1c24, 0.6)` | `[345,0,-75]` → `[536,41,75]` | 191 × 41 × 150 | one work lamp tone 1 r34 clamped at y+17 on each column (3 × 2 = 6 columns); one desk lamp tone 0 r7.5 per occupied cubicle (80). **No `ceilingStrips`.** | 86 lamps — `{34: 6, 7.5: 80}` | 252 | `07-bureau`, `08-bureau-deep` |
| `shelves` | `fill(0x7a6844, 0.68, 0x8a7550, 0x2a2016, 0.66)` | `[536,0,-34]` → `[646,16,34]` | 110 × 16 × 68 | `ceilingStrips(cell, seed, 7)` tone 1 r `max(7, 16*1.25)` = 20 only. The racking carries **no** lamps. | 6 lamps — `{20: 6}` | 420 | `09-warehouse` |
| `blank` (sealed, never entered) | `fill(0x202634, 0.18, 0x2a3142, 0x101216, 0.2)` | `[646,0,-91.5]` → `[829,183,91.5]` | 183 × 183 × 183 | none (`enterable: false`, not dressed) | 0 | 0 | none |

Measured consequences of the table above, stated as facts:

- Only 7 point lights (`POOL_SIZE`) are live at once, reassigned every 0.25s.
  `floor` places 86 lamp fittings and `concourse` 35, so the pool is
  oversubscribed in both, most heavily in `floor`.
- `floor` and `concourse` are the only enterable districts with no
  `ceilingStrips`; `shelves` has ceiling strips and nothing else.
- `floor` has the largest volume (191 × 41 × 150 m) and the lowest
  `ambientIntensity` (0.6, tied with nothing else except `apron` at 0.62), and
  its only above-desk fittings are 6 lamps of reach 34 in a 191m-long hall.
- `concourse` `ambientIntensity` 1.85 is 2.7–3.1× every other enterable
  district.

## Adjacent-scene continuity

- Incoming state (interior entry): camera FOV 75, near 0.08, far 4000, free
  first-person walk; `DockOverlay` hands the camera back on `phase === 'complete'`
  (suppressed entirely by `?dock=0`). Palette/grade: PostFX mounted, ACES at
  exposure 0.94. Score: none — no audio exists at the station. Reality state:
  district fill lerps toward the occupied cell's entry at `FILL_FADE_SECONDS 0.8`,
  starting from the `apron` entry on mount.
- Outgoing state (departure): `AirlockPrompt`/`StoryInteractionPrompt` at the
  lock, then `leaveStation`; the depart direction reuses the same three
  `DockOverlay` gauges with inverted end-state words.
- Reset/replay/deep-link observed: `?spacestation=1&hud=0&t=17.5&dock=0` reloads
  deterministically — worldId `-19,-17:a0`, seed 575085297, `instances`,
  `visibleCellCount` and `programs` identical across two cold probe runs
  (`evidence/baseline-perf.json`, `evidence/baseline-perf.run1.json`). Sandbox
  story state is ephemeral: story mode requires `?from=game` plus the three
  Chapter-10 receipts, so a bare `?spacestation=` deep link never shows the
  story HUD, marker, or prompt.
- Known defects versus intentional limitations: not classified by this role. The
  darkness measurements are in `shipped-visual-baseline.json`; the owner
  complaint is the run's premise, not a verifier finding.

## Unverified assumptions

- Numbers above are for the **default** address only. Every dimension except
  `APRON_HALF_WIDTH 17`, `COUNTER_HALF_WIDTH 6`, `COUNTER_HEIGHT 6`,
  `SHELVES_HALF_WIDTH 34` and `SHELVES_HEIGHT 16` is seed-derived, so lamp
  counts move with the address. Verification route: re-run
  `buildSpaceStationDescriptor` + `buildSpaceStationDressing` per address.
- FPS under headless ANGLE/SwiftShader at 1600×900 measured 0.6–3.3 across two
  runs with no stable ordering between districts. It is **not** a usable
  regression signal at this resolution on this renderer. Verification route for
  the FPS/frame-time budget in the lock: a headed real-GPU session, or a
  reduced-resolution SwiftShader pass. The stable, comparable numbers are
  `instances`, `visibleCellCount`, `meshes` and `programs`.
