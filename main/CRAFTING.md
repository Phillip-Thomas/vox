# Paravoxia — Crafting & Progression

**The single source of truth for the crafting/progression system.** Read this to
understand what exists, how it connects, and where it's going. Last updated
2026-06-23.

Design docs (historical/forward-looking): `~/.claude/plans/tiered-forging-ascent.md`
(original economy design) and `~/.claude/plans/primitive-emergent-eras.md` (the era
reframe). This file supersedes them for *current state*.

---

## 1. The big picture — three eras

Progression is organized into tech **eras** (narrative acts as much as tiers). You
crash-land with almost nothing and rebuild.

```
   PRIMITIVE  ──(repair the Maw + build the first devices)──▶  EMERGENT  ──▶  PARAVOX MACHINA
   crash-landed, stone-age          the space tech comes back online        extradimensional
   hand-craft + foraging            devices: Smelter / Assembler / Survey    rift tooling, exotic matter
   ◀── YOU ARE HERE (built) ──▶     ◀── recipes exist, gating WIP ──▶        ◀── designed-for only ──▶
```

`EraId = 'primitive' | 'emergent' | 'paravox_machina'` (`game/data/eras.ts`).
Current era + milestones live in `game/systems/progressionSystem.ts`
(`getCurrentEra`, `advanceEraTo` forward-only, `isEraAtLeast`, `markMilestone`).

---

## 2. Architecture — the layered model

Four concepts, deliberately separate (do **not** collapse them):

| Layer | Means | File |
|---|---|---|
| **Block** | what a voxel IS (hardness, toolTier, drops, bonusDrops, tags) | `game/data/blocks.ts` |
| **Material** | how a voxel RENDERS (append-only id baked into the shader) | `types/materials.ts` |
| **Resource** | what you HARVEST (tier, category, contextual rarity, toolTier, scanLevel) | `game/data/resources.ts` |
| **Item** | what you HOLD / CRAFT — superset of Resource | `game/data/items.ts` |

`ItemId = ResourceId | CraftedItemId`. Resources are projected into the item
registry as `kind:'resource'`; crafted/harvested-but-non-vein ids (wood, flint via
the union, tools, lights, …) are `CraftedItemId`. `RecipeId = Exclude<CraftedItemId,
'faulty_maw' | 'wood'>` (those are granted/harvested, not crafted).

### Systems (all module-singleton stores, `useSyncExternalStore`-style; JSON state, persistence-ready)
- `inventorySystem` — `addItem/removeItem/getItemCount/hasItems`, subscribe. (`addResource` alias kept for the harvest path.)
- `harvestingSystem` — pure: `dropsForBlock`, `canHarvestVoxel`, `harvestVoxel` (rolls yields + `bonusDrops`), `mineDurationMs`/`computeMineDuration`, `harvestClassForBlock`.
- `loadoutSystem` — DERIVES live capability from owned items: `getEquippedToolTier`, `selectTool(class, tier)` (right-tool-for-job), `toolSpeedFor`, `getHazardProtection`, `getScanLevel`, `getWarpRange`, `ownsChargeTool`, `ensureStarterLoadout`.
- `mawSystem` — `mawCharge` (0..100), `refuelFromInventory`, `consumeMawCharge`, `repairMaw()` (faulty→iron + advance era).
- `craftingSystem` — pure `canCraft`/`recipeReady` + side-effecting `craft(recipe, ctx)`. `ctx = { stations, unlocked? }`.
- `treeHarvest` / `stonePickup` / `campfires` — harvested/placed-object stores keyed by voxel coord / position, world-relative (reset on world swap).
- `miningProgress` — crosshair ring readout. `targeting` — looked-at readout (`voxel|tree|stone`). `scannerSystem` — `scanPlanet` by scan level.

### The 5 progression "gates" (all already DATA fields; progression = make them mutable)
`toolTier` (mine harder blocks) · suit hazard protection · `scanLevel` (reveal resources) · `warpRange` (reach planets) · `currentEra`/unlocks (which recipes/devices exist). All but era are derived in `loadoutSystem`.

---

## 3. The progression graph (how it all connects)

```
GATHER (world)                          CRAFT (primitive — personal Fabricator, key C)
─────────────────────────────────      ─────────────────────────────────────────────
grass  ──hand/Faulty Maw(t0)──▶ biofiber ─┐
trees  ──hand/Hatchet faster──▶ wood ─────┤
loose stones ──walk over / E──▶ stone ────┤
                                          ├─▶ biofuel        (biofiber×3)        → fuels Faulty Maw
                                          ├─▶ stone_hatchet  (wood2,biofiber2,stone1) → fast WOOD
                                          ├─▶ stone_pickaxe  (wood2,biofiber1,stone2) → mine STONE/ORE (tier1)
                                          │
stone voxel ──Stone Pickaxe(t1)──▶ stone + ~35% flint ─┐
                                                       ├─▶ torch    (flint1,biofuel1,wood1)  carried light
                                                       └─▶ campfire (flint2,biofuel1,wood3)  placed light
copper/iron ore ──Pickaxe(t1)──▶ copper_ore, iron_trace

        ┌──────────────── ERA BRIDGE (DESIGNED, partly built) ────────────────┐
        │ Maw Repair Kit + Repaired Maw  → repairMaw(): faulty_maw → iron_maw   │
        │ + build Smelter/Assembler/Survey Console devices → advance to EMERGENT│
        └──────────────────────────────────────────────────────────────────────┘

CRAFT (emergent — at DEVICES; recipes exist, device-gating WIP)
───────────────────────────────────────────────────────────────
SMELTER:    copper_ore+iron_trace→refined_alloy · silica→silica_pane · biofiber+resin→biocomposite
            frost_crystal+silica_pane→cryo_cell · basalt_glass+alloy→thermal_ceramic
            charged_crystal+alloy→charge_cell · void_glass+charge_cell→void_core
ASSEMBLER:  silica_pane+alloy→logic_wafer · alloy×2+biocomposite→strut_frame
            MAW LINE (consumes prior): strut_frame+logic_wafer→iron_maw → +cryo_cell+wafer→frost_maw
                     → +charge_cell+gold_trace→arc_maw → +void_core→void_maw
            CARAPACE suits: thermal / filter / shielded   ·   MODULES: lift_cell, range_coil
SURVEY CONSOLE: survey_lens_2 → _3 → _4  (each raises scanLevel)
```

### Tool tier ↔ block gate ladder
| Tool (toolTier) | Unlocks mining |
|---|---|
| bare hands / **Faulty Maw** (0) | soft: dirt, sand, grass, wood/trees |
| **Stone Pickaxe** / **Iron Maw** (1) | stone (+flint), copper, iron |
| **Frost Maw** (2) | basalt, ice, crystal_crust |
| **Arc Maw** (3) | gold |
| **Void Maw** (4) | void_glass |

`selectTool` picks the best-speed owned tool that meets the required tier *for that
material class* (`wood`/`stone`/`soft`) — so the Hatchet does wood (no charge), the
Pickaxe does stone, the charge-using Faulty Maw fills in, and a repaired/higher Maw
supersedes them.

---

## 4. Key mechanics

- **Hold-to-mine** (`EfficientPlayer.updateMining`): hold the harvest key (E); a
  crosshair ring fills over `mineDurationMs = hardness·2000 / (tierSpeed·overkill·speedMul)`.
  `speedMul` folds in the selected tool's per-material rate + the bare-hand penalty
  (0.35) when the Faulty Maw is unfuelled.
- **Maw charge**: the Faulty Maw runs on `mawCharge`; empty → auto-loads a Biofuel,
  else slow bare-hand rate. The repaired **Iron Maw is charge-free** (the reward).
  Charge meter HUD shows while you still own a charge tool.
- **Tree harvest**: trees aren't objects — they exist where a grass-voxel hash beats
  density, drawn as instanced meshes (`TreeField`). Harvesting marks the coord in
  `treeHarvest` (TreeField skips it on rebuild) and yields `wood`. Picked via a
  raycast on the trunk/leaf mesh → `treeFieldHandle.slotVoxel`.
- **Loose stones**: scattered pebbles (`LooseStoneField`, fixed density — NOT
  graphics-gated). Collected by **walking near (radius 3.2)** OR aim+hold-E. Yields
  `stone`. State in `stonePickup`.
- **Lights** (`components/Lights.tsx`): `torch` = warm point light that FOLLOWS the
  player while owned; `campfire` = placed at your feet on craft (mesh + brighter
  light), stored in `campfires`. Illumination only for now.
- **Hospitable start**: a fresh game crash-lands on a verdant/oceanic planet
  (`findHospitableStart` in `planetArchetypes.ts`) so the Primitive necessities
  (wood/biofiber/stone) are present. Travel afterwards is unconstrained.

---

## 5. Current state

| Area | State |
|---|---|
| Item/Block/Resource/Material model | **BUILT** |
| Inventory + HUD panel (grouped by kind) | **BUILT** |
| Hold-to-mine + tool speed + Maw charge | **BUILT** |
| Tree harvest → wood | **BUILT** |
| Loose stones → stone (+flint byproduct) | **BUILT** |
| Tool specialization (Hatchet/Pickaxe, selectTool) | **BUILT** |
| Primitive recipes (biofuel, stone tools, torch, campfire) | **BUILT** |
| Torch + campfire lighting | **BUILT** (intensities un-tuned) |
| Crafting engine (`canCraft`/`craft`) + Fabricator UI (key C / ⚒) | **BUILT** |
| Era store + `repairMaw()` | **BUILT** (repair not yet reachable in-game) |
| **Shelter building S1** — foundation/wall/ceiling (wood), build mode (B), snap ghost, place(E)/deconstruct(X), instanced render + colliders | **BUILT** (S2 doors/materials, S3 enclosure, S4 integrity, S5 persistence pending) |
| Emergent recipes (refined/components/Maw line/suits/modules) | **DEFINED**; craftable today via the all-access menu |
| Devices as placeable objects + per-device crafting UI | **NOT BUILT** |
| Era gating (personal menu = primitive only; Emergent behind devices) | **NOT BUILT** (menu is still the Phase-2 all-access fabricator) |
| Maw Repair Kit / Fabricator Core recipes + ship-wreck salvage | **NOT BUILT** |
| Suit/hazard survival, scanner-gated reveal, warp-range gate | **DESIGNED** (loadout getters exist; nothing consumes them yet) |
| Persistence (localStorage) | **NOT BUILT** (state is JSON, persistence-ready) |
| Paravox Machina tier | **DESIGNED** (hooks only) |

> **Key current inconsistency:** the Fabricator (key C) still shows ALL recipes
> (`getAccessibleStations()` returns every station — a Phase-2 "portable fabricator"
> stand-in). So Emergent recipes are craftable now if you have the materials, and
> `repairMaw()`/era advancement isn't wired to anything. The DIRECTION (below) closes
> this: primitive-only menu + Emergent crafted at built devices, gated by the Maw repair.

---

## 6. Direction — next steps (in order)

**We are deliberately staying in the Primitive era for a good while** — deepening
survival on the crash planet before re-enabling space tech. So the Emergent bridge is
NOT next; shelter is.

1. **Shelter building (IN PROGRESS)** — Ark-style prefab pieces snapped to the voxel
   grid as face-panels, sealed-enclosure detection via flood-fill, integrity, and a
   persistent home base. Plan: `~/.claude/plans/shelter-building.md`. **S1 BUILT**
   (foundation/wall/ceiling in wood, build mode B, snap ghost, place E / deconstruct
   X, instanced render + colliders). Next: **S2** doorway+door + thatch/stone
   materials, **S3** enclosure flood-fill → `isSheltered()`, **S4** integrity,
   **S5** home-base persistence.
2. **Light-Hazard survival** — an exposure/comfort meter that `archetype.hazards`
   drain while EXPOSED and that being SHELTERED / near a campfire / in the right
   Carapace restores (consumes `isSheltered()` + suit/campfire). This is what gives
   shelter — and the already-built campfires/suits — gameplay teeth.
3. **Persistence** — localStorage snapshot of structures + campfires + inventory +
   loadout, keyed by `GENERATION_SCHEMA_VERSION` + worldId (first real consumer: the
   home base).

LATER (deferred until we leave Primitive): the **Emergent bridge** (Maw Repair Kit +
ship-wreck salvage → `repairMaw()` flips the era), **placeable devices** (Smelter/
Assembler/Survey Console + per-device crafting), **era gating** (primitive-only
Fabricator), warp/scanner gates, **game modes**, and **Paravox Machina** + plot.

Naming convention (Paravoxia-native, do NOT borrow from other games): Maw line,
Carapace suits, Survey Lens / Lift Cell / Range Coil modules, Smelter / Assembler /
Survey Console stations.

---

## 7. Testing & verification

- `cd main && npm run verify` — typecheck + vitest + build. System tests live next to
  their module (`*.test.ts`); `harvest.test.ts`/`crafting.test.ts` are the templates.
- **Visual harnesses** (dev server on 5173): `/rock-test.html` (loose-stone prop;
  left=fixed / right=old-bug winding), `/tree-test.html` (trees). Screenshot tools:
  `tools/shot-url.mjs` (any URL), `tools/capture.mjs` (named in-game vantages),
  `tools/capture-pose.mjs` (exact pos+quat or `--target`). Headed = real GPU.
- **Gotcha:** lighting/feel (torch/campfire brightness) needs a live night playtest —
  agent-mode captures have no player.

---

## 8. File map

```
game/data/      items.ts  resources.ts  blocks.ts  recipes.ts  stations.ts  eras.ts
                planetArchetypes.ts (findHospitableStart)  biomes.ts
game/systems/   inventorySystem  harvestingSystem  loadoutSystem  mawSystem
                craftingSystem  progressionSystem  treeHarvest  stonePickup
                campfires  miningProgress  targeting  scannerSystem
components/     EfficientPlayer (mining + build loop, looked-at)  EfficientScene (mounts fields)
                TreeField  LooseStoneField  Lights (PlayerTorch, Campfires)
                StructureField (+BuildGhost, structureFieldHandle)
                hud/InventoryPanel  hud/MiningProgress  hud/MawChargeMeter  hud/LookedAtIndicator  hud/BuildIndicator
                ui/CraftingPanel
game/data/      ... buildPieces.ts (build pieces + cost + stats)
game/systems/   ... structureSystem (placed panels)  buildState (mode+selection)  buildGhost (snap readout)
utils/          looseStone.ts (shared rock geo+material)  buildPlacement.ts (snap math)
state/          playerFrame.ts (player up + world position globals)
```

### Hard-won notes / gotchas
- `MATERIAL_ORDER` in `types/materials.ts` is **APPEND-ONLY** (ids baked into the shader).
- New materials need **procedural texturing**, never a flat color (material-quality bar).
- Instanced props need a **right-handed** orientation basis (`bitangent = tangent×up`);
  the reverse mirrors the mesh and you see inside-out faces (the loose-stone bug).
- `VOXEL_SCALE = 2` — size props accordingly; surface is one half-extent (1) out from voxel center.
- POTATO graphics profile renders no trees (treeDensity 0) → wood unobtainable there (open gap).
- Harvested/placed-object stores are keyed by world-relative coord → reset on `terrainSeed` change.
```
