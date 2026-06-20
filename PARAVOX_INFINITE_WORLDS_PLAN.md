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
- Reset player spawn
- Place the ship at a deterministic landing site

## 3. Spaceship Loop

Add a spaceship near spawn on every world.

Initial behavior:

- Player walks to the ship
- Player presses an interaction key near the ship
- Ship opens a cockpit/navigation panel
- Player can input destination grid coordinates

The ship is the main universe traversal mechanic.

## 4. Travel Flow

Basic warp loop:

1. Player enters ship.
2. Navigation panel opens.
3. Player enters target coordinate `(x, y)`.
4. Game derives the target seed.
5. Short warp/loading transition plays.
6. `currentWorld` changes.
7. Planet regenerates from the new seed.
8. Player spawns beside or inside the ship at the new landing site.

## 5. Coordinate Navigation UI

First version should include:

- Current coordinate display
- Target `x` input
- Target `y` input
- Warp button
- Random jump button
- Return to previous world button, if available

Later versions can add:

- Galaxy map
- Bookmarks
- Discovered worlds list
- Named planets
- Route plotting
- Fuel costs

## 6. Procedural Variety

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

## 7. Persistence Strategy

Do not store full generated worlds. Store only identity and player changes.

Generated data:

- Coordinate
- Seed
- Derived traits

Persisted data:

- Player account
- Current world coordinate
- Visited worlds
- Named/bookmarked worlds
- Ship location
- Voxel edits as deltas
- Discoveries and resources later

## 8. Firebase And Neon

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

## 9. Milestones

### Milestone 1: Local Infinite Worlds

- Add coordinate-to-seed function
- Add current world state
- Replace preset buttons with coordinate navigation
- Regenerate world on coordinate change
- Reset player spawn on world change

No database required.

### Milestone 2: Spaceship Prototype

- Add simple spaceship mesh near spawn
- Add proximity detection
- Add interaction key
- Add cockpit/navigation panel
- Warp to typed coordinates

### Milestone 3: Persistence

- Add Neon schema
- Save visited worlds
- Save current coordinate
- Save world names/bookmarks
- Save voxel edit deltas

### Milestone 4: Universe Feel

- Add procedural world names
- Add rare traits
- Add galaxy map
- Add warp animation
- Add discovery history
- Add ship fuel/resource requirements

## 10. First Implementation Cut

The first practical implementation should be:

1. Create `worldCoordinates.ts`.
2. Add `coordinateToSeed(x, y)`.
3. Add `currentWorld` state in `App.tsx`.
4. Pass `currentWorld.seed` into `EfficientScene`.
5. Replace terrain preset UI with coordinate controls.
6. Add a simple ship placeholder.
7. Add "Warp" button to change coordinates.

This gives Paravox the core infinite-world loop before database and deployment work.
