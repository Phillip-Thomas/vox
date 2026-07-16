# Lessons Learned

## Product And Taste

- A dark cockpit is part of the Kestrel identity, but darkness must describe enclosure rather than erase the hatch, horizon, or instrument hierarchy.
- Continuous physical causality is worth protecting. A cut/fade would hide the defect and weaken the moment; the correct response is to author the transition geometry and camera path.
- Cyan navigation and amber propulsion are semantic focal cues, not decoration. Responsive fitting must preserve their relationship as well as open space.
- Operational copy works when it is terse and input-truthful. Touch must say `USE`, not expose a keyboard-only escape instruction.

## Design-System Learnings

- Fit portrait cockpit layers independently. Cropping the pressure shell at a higher floor while allowing instruments slightly more compression preserves enclosure and forward readability better than shrinking the entire rig.
- HUD collision repair belongs in one measured layout policy. Controls, objective, captions, and markers need shared bands; isolated bottom offsets create the next overlap.
- Clamp only the rendered marker presentation. Preserve raw projection coordinates for telemetry, health, and downstream agent evidence.
- Procedural Three.js scenes still need explicit composition contracts: focal aperture, silhouette separation, value hierarchy, and line of sight are testable design-system concerns.

## Camera And Geometry Learnings

- An endpoint outside a canopy does not prove a safe shot. Test the complete camera trajectory, near-plane clearance, target sightline, and moving occluders over time.
- Model a hatch from its physical hinge. A thin X/Z dorsal leaf rotates around local X; the wrong axis turns it into a full-frame wall even when its endpoint seems plausible.
- Include conservative runtime blending in geometry tests. The authored target path can be safe while an interpolated live camera still clips a moving leaf.
- Frame priority is part of composition authority. The proven contract combines the full pose by `0.62`, a high/wide +Z crane, physical X hinge, a visual hatch sampler at `-1`, and the authoritative transaction/camera author at normal priority `0`; moving story/score effects to the visual lane would invalidate otherwise-correct ordering.
- Do not use transparency/depth-write changes to conceal an unproven camera path. Fix pose/line-of-sight first; treat render-order changes as a secondary, evidence-triggered option.

## Interaction And Authority Learnings

- A visual interaction annulus can silently become a gameplay authority bug. Reconstruction states must explicitly choose their locomotion owner: workbench, hover rehearsal, or grounded return.
- A physical receipt that spans airborne and supported states needs a latch across frames and a hard reset on story `runId`, including same-beat restarts.
- Automated movie mode should use the same embodied constraints as the player. It may navigate and hold controls; it must not teleport, grant receipts, or steer away from a live proof socket.
- Pair visual acceptance with mechanical evidence whenever a camera/HUD change shares state or movement code.

## Evidence Learnings

- No screenshot means no visual approval. Pure tests can prove a trajectory contract but cannot prove that the rendered hatch reads beautifully.
- A transient-state screenshot is valid only when it proves the actual scheduler relationship, not merely a matching deep-link label. For the accepted hatch frame, the exact live modules/source hashes matched; the visible hatch `-1` sample is elapsed `0.5`, progress `0.776963305898491`, and the transaction `0` tick that triggered freezing is elapsed `0.6`, progress `0.925925925925926`.
- Software-rendered POTATO captures are valuable for occlusion, HUD collision, and flow diagnosis, but cannot approve lighting taste, audio timing, comfort, or hardware performance.
- A debug `--skip-predecessor` split is useful only when it is structurally noncertifying. It must never be summarized as formal chapter acceptance.
- Reusing an external Vite server can create a runtime module-identity split for dynamic evidence imports. Signed anchor history and boundary state may prove mechanics while the aggregate registered-milestone collector remains incomplete.
- A target beat and its outgoing handback anchor may cross the debug bridge on adjacent samples. A bounded passive reread may certify already-committed anchor history, but it must never send input, rescue progress, or be confused with the separate formal preflight/predecessor/variant gates.
- Capture high-risk transitions immediately. Waiting for a full multi-minute chapter loop makes a simple camera correction disproportionately expensive.

## Proposed Durable Additions

These are proposals for the project design memory; this run does not modify global memory.

- Add a `camera transition contract` pattern: full path, near-plane envelope, line of sight, moving-occluder intersection, and representative screenshot.
- Add a `shared HUD bands` rule for every touch story overlay.
- Add a `visual helper may not own gameplay` review question when layout/composition work touches automated movement.
- Add a `portrait layered fitting` pattern for camera-child cockpits and other diegetic rigs.
- Require evidence labels to say `diagnostic`, `mechanical`, `headed visual`, `live audio`, `human taste`, or `formal certificate`; never flatten them into one pass/fail claim.

## Next Run

1. Capture representative landscape/tablet and review boarding rail/material hierarchy, utilitarian framing, cockpit values, amber visibility, and camera comfort on a real GPU.
2. Review the live pressure-seal/handback score and audio timing.
3. Exercise the abort path at low frame rate and decide whether its one-frame camera/leaf mismatch is perceptible enough to repair.
4. Ask the owner for final taste approval; only then consider the refined/final visual gate.
