# Design Directions

## Direction A: Orbital Shard Instrument

A miniature suspended cube shard with a scan ring, bright local arrow, teammate pips, ship diamond, structure glints, and campfire embers. The camera orbits gently while the local player heading stays visible.

Strengths:
- Most unique and most specific to Paravoxia's cube-world premise.
- Reads as a diegetic cockpit/suit instrument rather than a generic minimap.
- Works with abstract markers, so it avoids heavy terrain duplication.

Risks:
- Can become noisy if every build piece is shown.
- Needs careful HUD placement to avoid inventory and touch controls.

## Direction B: Scanner Pulse Slice

A flatter circular radar slice with a rotating sweep, player cone, and projected blips. It behaves like a traditional game minimap but uses 3D glow geometry inside the canvas.

Strengths:
- Highly readable and familiar.
- Lower rendering complexity.

Risks:
- Less distinctive; it could belong to almost any sci-fi game.
- It does not communicate the cube-world orientation as well.

## Direction C: Compass Constellation

A minimal compass band with floating glyphs for teammates, campfires, ship, and base clusters. It prioritizes movement speed and peripheral awareness over map literalness.

Strengths:
- Least visual clutter.
- Very safe for combat or fast flight.

Risks:
- Not enough of a "cool unique 3D minimap."
- Harder to understand exact teammate/object offsets.
