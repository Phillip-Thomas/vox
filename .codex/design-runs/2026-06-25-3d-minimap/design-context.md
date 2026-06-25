# 3D Minimap Design Context

## Run Mode

- Mode: single-surface
- Surface: in-game HUD minimap
- Exploration depth: 3
- Execution budget: standard
- Date: 2026-06-25

## Hard Guardrails

- Keep the game playable: the minimap must not capture pointer input, block pointer lock, or overlap critical prompts.
- Use existing game-state stores rather than creating a new synchronization path.
- Multiplayer pips must come from the authoritative pose store that already drives replicated avatars.
- Persistent-object pips must come from the same structure and campfire stores used by gameplay and saves.
- The minimap should be lightweight: capped marker counts, no large scene clone, no terrain remesh.
- Desktop and touch layouts must avoid the existing inventory, cockpit readout, and mobile controls.

## Creative Brief

Create a compact, diegetic orbital scanner that feels specific to a tiny cube-world survival game. It should be useful at a glance: player heading, co-op teammates, parked ship, nearby builds, campfires, and rough position on the shard.

## Open Field

- The instrument can be more expressive than a flat radar, as long as it remains readable.
- V1 can omit interaction, zoom controls, and terrain detail.
- Labels should be production UI, not tutorial copy.
