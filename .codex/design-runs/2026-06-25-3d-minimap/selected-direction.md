# Selected Direction

Direction A: Orbital Shard Instrument.

## Why

This gives Paravoxia a signature HUD object instead of a generic radar. It can stay compact because the minimap is not trying to redraw the world; it shows the shard, heading, teammates, parked ship, campfires, and base density as deliberate markers.

## V1 Scope

- Add a non-interactive 3D HUD panel.
- Show local player position and heading.
- Show remote co-op players from `playerPoseSystem`.
- Show parked ship from `shipProximity`.
- Show campfires and a capped sample of placed structures.
- Use desktop and touch placement rules that avoid existing controls.

## Deferred

- Terrain contour detail.
- Click-to-ping, zoom, and marker filters.
- Full planet/star-map integration.
