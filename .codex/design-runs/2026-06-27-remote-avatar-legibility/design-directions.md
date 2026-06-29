# Design Directions

## Direction A: EVA Beacon Stack

Thesis: remote teammates read as compact EVA suits with a diegetic beacon stack: footing ring for position/facing, body silhouette for posture, small action beacon above the label for state.

Why it fits:
- Keeps the 3D avatar lightweight and code-native.
- Makes action state readable by shape and vertical position, not color alone.
- Feels like Paravoxia telemetry without adding a HUD panel.

Implementation shape:
- Add presentation helper fields for action label, beacon color, beacon shape, and facing marker.
- Add a ground-facing ring/arrow.
- Add an action beacon chip above the label using small geometry and text.
- Preserve existing accessories.

## Direction B: Tool-First Silhouette

Thesis: each remote player is defined primarily by large action props: drill/mining arc, build hologram, jetpack plume, swim fins, and neutral backpack.

Why it fits:
- Very readable in motion.
- Strongly communicates "what they are doing" without nameplate dependency.

Risk:
- More geometry around the capsule can become busy with 4-8 players.
- It may look like a bundle of props rather than a consistent suit system.

## Direction C: HUD-Linked Team Markers

Thesis: keep avatar geometry minimal and add stronger screen-space/team marker language connected to the multiplayer status badge.

Why it fits:
- Easy to scan on small screens.
- Could support future ping/marker systems.

Risk:
- More likely to clutter first-person HUD.
- Less diegetic and less useful for screenshot proof of in-world action state.

## Selection

Selected: Direction A, EVA Beacon Stack.

Rejected:
- Direction B is more expressive but risks visual noise.
- Direction C is practical but too HUD-heavy for this scoped launch-quality pass.
