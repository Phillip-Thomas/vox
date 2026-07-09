# Fauna realism + sizing pass

Date: 2026-07-09
Scope: `main/src/utils/faunaField.ts`, `main/src/utils/faunaField.test.ts`,
`main/src/components/debug/AgentCamera.tsx` (view framing only).

## Problem

The player (3.6 wu standing) towered over every animal — grazers topped out ~2.1 wu
(pony-sized at best). Animals also hovered ~0.15–0.2 wu above the ground
(FAUNA_SURFACE_OFFSET 1.08 + feet authored above local y=0), legs translated as
rigid blocks (feet skated), and hoppers trotted instead of hopping.

## Changes

**Size hierarchy anchored to the player** (`faunaScaleForKind`, documented targets):
grazer ~3.0–3.5 wu head-top (horse/elk, roughly eye-level with the player, never
towering over them — unit-tested against PLAYER_STANDING_HEIGHT bounds), woolly
~1.7–2.1, runner ~1.15–1.45, hopper ~0.7–0.95, dragonfly unchanged. The previously
unused `art.shape.faunaScaleBias` now feeds a per-planet ±15% body-size multiplier
(`profile.scaleMul`), threaded through both matrix-compose paths.

**Grounding**: legs re-authored so feet touch local y=0; FAUNA_SURFACE_OFFSET
1.08 → 1.0. Flush at any body scale.

**Grazer geometry**: horse silhouette — torso carried high on long slim legs
(~45% of height), long angled neck with a 5-blob mane ridge, head with distinct
muzzle, ears, dropped tail fall. Woolly/runner legs lengthened slightly; hopper
haunches enlarged.

**Gait (vertex shader, fauna-field-v5)**: legs pivot from the hip
(swing amplitude ramps toward the foot via `legSwing = smoothstep(0.62, 0.04, y)`)
with foot lift on the swing phase — feet stride instead of the whole leg skating;
stride-coupled fore-aft body rock and head nod (horses nod as they walk); hoppers
get a real bounce gait (body arcs with the stride, front legs tuck, hind extend)
gated by the new vertex-side `uFaunaKind`. Belly-shade mask retuned for the taller
torso. Stride rates slowed for big animals (grazer 1.06 → 0.56 cycles), ambient
speeds nudged up with body size.

## Verification

`npm run verify` green (85 files / 570 tests, new size-hierarchy test asserts
grazer height within [0.78, 1.05] × player height across seeds plus strict
grazer > woolly > runner > hopper > dragonfly ordering and planetMul linearity).
Headless captures on the verdant fixture world (`?agent=1` + `__game.view('grazer')`)
confirm horse-scale grazers standing flush on the surface; AgentCamera fauna view
distances re-tuned for the larger bodies.

## Pass 2 (same day): silhouettes + herd behavior

**Runner** rebuilt as a fox: deep chest tapering to a slim waist, pale chest tuft,
pointed muzzle with a dark nose tip, tall alert ears, and a three-blob bushy tail
carried low with a pale tip. **Woolly** rebuilt as a sheep/yak: 15 overlapping
fleece clumps including a low skirt that hides the leg tops, wool cap over a dark
bare face, drooped ears, small two-segment curled horns, stub tail.

**Herd behavior** (`chooseHerdDirectionIndex`, unit-tested): grazers and woollies
bias ~75% of route choices toward their nearest same-kind neighbor when beyond a
9 wu comfort distance (capped at 36 wu), and away when closer than 3.2 wu; inside
the band they wander unchanged, so groups form loose and organic. Hooked into
`setFaunaRoute` from the per-frame agent update only — spawn-time routing is
unchanged and deterministic.

Verified: 571 tests green; live captures show sheep-reading woollies, an
unmistakable fox runner, and grazers grouped into loose pairs after ~25s of
simulation without stacking.

## Pass 3 (same day): water avoidance, flee, grazing

**Water (bug fix — fox walking in water).** Ground fauna treated submerged coastal
terrain as walkable because nothing consulted the water classifier. `FaunaProfile`
now carries the live generator (`FaunaWaterClassifier`, wired from EfficientScene
via a new `planetSize` prop → `getWorldGen(...).generator`); `isFaunaSurfaceDry`
rejects any voxel whose above-face cell is flooded, enforced at spawn
(`shouldPlaceFaunaVoxel`), travel (`findFaunaTravelCandidate`), and agent
revalidation. Dragonflies are exempt — they hover over water on purpose. The
voxel-test harness passes no planetSize and is unaffected.

**Flee.** A player sprinting at an animal (approach speed > 3.2 wu/s inside 8 wu)
or looming at point-blank (< 2.6 wu) startles it into a 2.6s bolt directly away at
2.6× speed with faster turn response; walking up slowly does not. Player velocity
is finite-differenced in FaunaField (teleport spikes discarded). Dragonflies exempt.

**Grazing.** On arriving at a voxel, herd animals may stop to graze (22% base,
+35% when a herd-mate within 9 wu is already grazing — pauses ripple through the
herd), for 2.6–6s with a 6s cooldown. While grazing the agent holds position and a
smoothed pose value (new `aFaunaPose` instanced attribute, fauna-field-v6) folds
the head/neck — including part-4 riders like ears/mane/horns via a forward-of-x
mask — down around the neck root with a nibble bob. Fleeing cancels grazing.

Verified: 574 tests green including three new behavior tests (dry-travel
invariant over 300 steps, startle-vs-calm player, graze hold + pose rise/decay);
live captures show a head-down grazer beside a walking herd-mate and a coast with
every animal above the waterline.

## Open threads

- Gait is still translation-based shear, not true joint rotation; fine at current
  poly scale but worth revisiting if animals ever get close-up cinematics.
- Flee currently ends on a timer; a "keep distance while player remains close"
  hysteresis would read even better.
- Runner is common on arid fixtures; reviewed on the verdant world — worth one
  arid screenshot pass when convenient.
