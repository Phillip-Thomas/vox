# Design Directions

## Direction A: Suit Telemetry Stack

- Thesis: Treat survival decay as suit telemetry anchored top-left, with inventory nested below it as secondary information.
- Layout strategy: Vitals occupy a compact glass panel at top-left; inventory receives an explicit top offset; bottom-left remains exclusively movement.
- Typography strategy: Monospace micro labels with numeric values for quick confidence.
- Asset strategy: Use existing theme tokens only; no new assets.
- Interaction strategy: Vitals remain pointer-transparent; inventory toggle remains the only pointer-active top-left control.
- State strategy: rAF updates mutate fill widths and values; no per-frame React churn.
- Why it fits: It solves the joystick overlap and makes health stats look like part of the same sci-fi HUD.

## Direction B: Edge Split Minimal

- Thesis: Keep the view nearly empty by putting only tiny colored bars on the far top edge and leaving inventory untouched.
- Layout strategy: Thin horizontal strip at the top-left edge, no panel.
- Typography strategy: Abbreviated labels only, no values.
- Asset strategy: Use only color.
- Interaction strategy: Minimal footprint, but lower readability.
- Why rejected: It solves overlap but does not meet the user's request to improve and stylize the health stats UI; it would still feel like raw bars.

## Direction C: Bottom Command Console

- Thesis: Convert all HUD controls into one bottom command console with joystick/action spacing.
- Layout strategy: A bottom band spanning left/right controls, vitals centered above.
- Typography strategy: Larger, console-like.
- Asset strategy: Shared glass band.
- Interaction strategy: Integrated, but consumes too much vertical gameplay space.
- Why rejected: The user likes the joystick placement and specifically asked for decay bars top-left; a bottom console fights that.

## Selected

- Direction A, with a mobile L-shaped action cluster: `USE` above `JUMP`, `MINE` left of `JUMP`, and `JUMP` in the bottom-right corner.

## Iteration 2 Extension

- Selected extension: Single Suit Systems HUD.
- Thesis: Keep survival, oxygen, and Maw charge in one top-left suit readout, and demote inventory to a compact button that expands only on demand.
- Rejected extension: Keep Oxygen/Maw as center-bottom transient meters. It keeps useful context separate from survival status and continues the scattered-HUD problem.
- Rejected extension: Put inventory inside the vitals panel. It would make the critical survival stack expand unpredictably and risk crowding the minimap on mobile.

## Iteration 3 Extension

- Selected extension: Jetpack joins the Suit Systems HUD.
- Thesis: Jetpack fuel is another suit/system resource, so it belongs beside oxygen and survival stats instead of as a separate center-bottom meter.
- Rejected extension: Keep the old transient `JETPACK` bar and duplicate the value in the HUD. That would reintroduce scattered information.
- Rejected extension: Show jetpack only when fuel is below full. That is less cluttered, but the user specifically asked to move jetpack into the HUD, and a stable `JET` row keeps the system predictable.
