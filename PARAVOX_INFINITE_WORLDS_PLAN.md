# Paravox Infinite Worlds Plan

## Goal

Paravox should feel like a No Man's Sky-style voxel universe: the player lands on a world, explores it, enters a spaceship, chooses grid coordinates, warps, and arrives at a different deterministic world.

The core rule: every `(x, y)` galaxy coordinate maps to a stable seed. The same coordinate always regenerates the same world.

## 1. World Identity

Add a `WorldCoordinate` model:

```ts
interface WorldCoordinate {
  x: number;
  y: number;
}
```

Derive a deterministic seed from coordinates:

```ts
seed = hash("paravox:v1", x, y)
```

The seed drives:

- Terrain shape
- Ocean coverage
- Grass and tree density
- Ore distribution
- Sky and atmosphere traits
- Rare world modifiers

## 2. World Manager

Replace the current preset-driven `terrainSeed` flow with a world manager.

Current world state should own:

```ts
interface CurrentWorld {
  coordinate: WorldCoordinate;
  seed: number;
  name?: string;
  discoveredAt?: string;
}
```

`EfficientScene` receives `currentWorld.seed`.

Changing worlds should:

- Regenerate terrain
- Regenerate water, grass, trees, ores, and sky traits
- Enter an orbital/approach state around the destination world
- Keep the player in ship control during descent
- Allow manual landing wherever the player chooses
- Use a deterministic safe site only as a fallback for first spawn, recovery, or direct-load resume without a saved ship position

## 3. Spaceship Loop

Add a spaceship near spawn on every world.

Initial behavior:

- Player walks to the ship
- Player presses an interaction key near the ship
- Player enters flight mode
- Ship can fly through a continuous-feeling galaxy space
- Nearby worlds appear as cheap distant impostors
- Player can still use a cockpit/navigation panel to pick or bookmark target coordinates

The ship is the main universe traversal mechanic.

## 4. Travel Flow

The important illusion: worlds should feel connected, but only one real voxel world should be loaded at a time.

Use two representations:

1. Playable world
   - Full voxel terrain
   - Physics
   - Grass, trees, water, ores
   - Player edits
   - Only one active in memory

2. Distant universe shell
   - Cheap generated planet impostors
   - Low-poly spheres, billboards, or glowing markers
   - No voxel terrain
   - No physics
   - Generated from the same coordinate seed

Flight loop:

1. Player enters ship.
2. Current playable planet remains active while the ship launches.
3. As the ship leaves atmosphere, the playable voxel world fades/unloads.
4. The previous world becomes a cheap impostor behind the player.
5. The ship flies through galaxy space.
6. Nearby coordinate worlds render as seeded impostors.
7. The target world grows as the ship approaches.
8. Near arrival, play an atmosphere/warp transition into an orbital/upper-atmosphere flight state.
9. Load the destination coordinate as the one active playable voxel world.
10. Keep the player flying the ship over the loaded planet.
11. Player manually descends and lands wherever they choose, similar to No Man's Sky.

This creates the feeling of physically flying between worlds without holding multiple voxel worlds in memory.

## 5. Free Landing Model

Landing should be player-driven, not a fixed teleport to a predetermined site.

Flow:

1. Destination impostor grows during approach.
2. At an arrival threshold, the game swaps from impostor space to the real voxel planet.
3. The ship starts in a high-altitude approach position above the destination world.
4. Player keeps flight control.
5. Terrain, water, grass, trees, and colliders stream/activate around the ship.
6. Player can skim, circle, pick a valley, island, mountain, shoreline, or forest.
7. When the ship slows and touches a valid surface, it enters landed mode.
8. Player exits the ship at that exact landed position.

Only fallback cases use deterministic safe placement:

- New save / first world
- Loading a world without a saved ship position
- Recovery if the ship clips into terrain or lands in invalid geometry
- Debug teleport

The saved ship state should include:

```ts
interface ShipState {
  world: WorldCoordinate;
  position: [number, number, number];
  rotation: [number, number, number, number];
  landed: boolean;
}
```

## 6. Galaxy Space And LOD

Each grid coordinate maps to both a seed and a galaxy-space position:

```ts
seed = hash("paravox:v1", x, y);
galaxyPosition = [x * WORLD_SPACING, y * WORLD_SPACING];
```

LOD tiers:

- LOD 0: active playable planet, full voxel world.
- LOD 1: nearby destination planet, low-poly impostor sphere with seeded colors/ocean bands.
- LOD 2: far world marker, small glowing dot or billboard.
- LOD 3: background starfield only.

Rules:

- Keep only one LOD 0 world alive.
- Never run physics for distant worlds.
- Never generate voxel terrain for distant worlds.
- Generate impostor appearance from the same coordinate seed so the distant planet previews the real world.
- Swap impostor to full voxel world only during arrival.

## 7. Coordinate Navigation UI

First version should include:

- Current coordinate display
- Target `x` input
- Target `y` input
- Autopilot / set course button
- Random jump button
- Return to previous world button, if available
- Nearby visible worlds list

Later versions can add:

- Galaxy map
- Bookmarks
- Discovered worlds list
- Named planets
- Route plotting
- Fuel costs

## 8. Procedural Variety

The coordinate seed should feed multiple generation layers, not just terrain.

World traits can be derived from the seed:

```ts
interface WorldTraits {
  terrainProfile: "mountains" | "hills" | "valleys" | "islands" | "balanced";
  oceanLevel: number;
  grassDensity: number;
  treeDensity: number;
  oreRichness: number;
  skyHue: number;
  rareTrait?: string;
}
```

Examples of rare traits:

- High-metal world
- Ocean world
- Sparse moon
- Dense forest world
- Lava-core exposed world
- Night-heavy world
- Gold-rich world

## 9. Persistence Strategy

Do not store full generated worlds. Store only identity and player changes.

Generated data:

- Coordinate
- Seed
- Derived traits

Persisted data:

- Player account
- Current world coordinate
- Current ship position/rotation/landed state
- Visited worlds
- Named/bookmarked worlds
- Ship location
- Voxel edits as deltas
- Discoveries and resources later

## 10. Firebase And Neon

Firebase Hosting:

- Hosts the built Vite app
- Good fit for the current static React client

Neon:

- Stores persistent world/player data
- Postgres schema should start small

Initial tables:

```sql
users (
  id uuid primary key,
  created_at timestamptz not null default now()
);

visited_worlds (
  id uuid primary key,
  user_id uuid not null references users(id),
  coord_x int not null,
  coord_y int not null,
  seed int not null,
  name text,
  first_visited_at timestamptz not null default now(),
  unique (user_id, coord_x, coord_y)
);

ship_state (
  user_id uuid primary key references users(id),
  coord_x int not null,
  coord_y int not null,
  pos_x double precision not null,
  pos_y double precision not null,
  pos_z double precision not null,
  rot_x double precision not null,
  rot_y double precision not null,
  rot_z double precision not null,
  rot_w double precision not null,
  landed boolean not null default true,
  updated_at timestamptz not null default now()
);

world_voxel_edits (
  id uuid primary key,
  user_id uuid not null references users(id),
  coord_x int not null,
  coord_y int not null,
  voxel_x int not null,
  voxel_y int not null,
  voxel_z int not null,
  action text not null,
  material text,
  created_at timestamptz not null default now()
);
```

## 11. Milestones

### Milestone 1: Local Infinite Worlds

- Add coordinate-to-seed function
- Add current world state
- Replace preset buttons with coordinate navigation
- Regenerate world on coordinate change
- Enter high-altitude approach on world change

No database required.

### Milestone 2: Spaceship Prototype

- Add simple spaceship mesh near spawn
- Add proximity detection
- Add interaction key
- Add cockpit/navigation panel
- Set course to typed coordinates
- Transition to destination approach
- Add basic manual landing state

### Milestone 3: Persistence

- Add Neon schema
- Save visited worlds
- Save current coordinate
- Save ship position and landed state
- Save world names/bookmarks
- Save voxel edit deltas

### Milestone 4: Universe Feel

- Add procedural world names
- Add rare traits
- Add galaxy map
- Add warp animation
- Add discovery history
- Add ship fuel/resource requirements

## 12. First Implementation Cut

The first practical implementation should be:

1. Create `worldCoordinates.ts`.
2. Add `coordinateToSeed(x, y)`.
3. Add `currentWorld` state in `App.tsx`.
4. Pass `currentWorld.seed` into `EfficientScene`.
5. Replace terrain preset UI with coordinate controls.
6. Add a simple ship placeholder.
7. Add "Set Course" button to choose destination coordinates.
8. On arrival, spawn the ship in a high-altitude approach state.
9. Add a simple landed/not-landed mode so the player can touch down manually.

This gives Paravox the core infinite-world loop before database and deployment work.

Current local status:

- [x] Coordinate-to-seed world identity
- [x] Current world state in `App.tsx`
- [x] Coordinate navigation controls replacing terrain preset buttons
- [x] Active voxel world reloads from `currentWorld.seed`
- [x] Seeded distant planet impostors around the active world
- [x] Distant planet LOD uses the same seeded terrain profile parameters as the real destination world
- [x] Simple parked ship placeholder near the deterministic arrival site
- [x] Set Course / Random / Previous coordinate flow
- [x] High-altitude approach spawn on coordinate change
- [x] Landing state flips from approach to surface when the player is grounded
- [~] Planet LOD is trait-consistent rather than exact voxel-surface accurate; dedicated ship flight/targeting controls are Milestone 2.
