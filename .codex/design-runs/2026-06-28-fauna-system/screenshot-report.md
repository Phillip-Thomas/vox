# Screenshot Report

Canonical preview URL:

`http://127.0.0.1:5173/voxel-test.html?effects=fauna&profile=ULTRA&seed=54321`

## Captures

- `fauna-harness-desktop.png` — desktop harness, mixed sand/dirt/grass patch, test-suite fauna density.
- `fauna-harness-desktop-t1.png` — same desktop view one second later for motion proof.
- `fauna-harness-mobile.png` — mobile/narrow viewport.
- `fauna-locomotion-desktop-t0.png` — desktop harness after locomotion pass.
- `fauna-locomotion-desktop-t1.png` — same desktop view 3.6 seconds later, proving instance translation.
- `fauna-locomotion-mobile.png` — mobile/narrow viewport after locomotion pass.
- `fauna-smooth-seed-0.png` through `fauna-smooth-seed-4.png` — stable-seed jitter regression sequence.
- `fauna-smooth-seed-mobile.png` — mobile/narrow viewport after stable-seed fix.
- `fauna-slerp-level-desktop-t0.png` and `fauna-slerp-level-desktop-t1.png` — desktop pass after route-heading slerp and voxel-level clearance arc.
- `fauna-slerp-level-mobile-t0.png` and `fauna-slerp-level-mobile-t1.png` — mobile/narrow pass after the same movement fix.
- `fauna-large-quadrupeds-desktop.png` — desktop pass after larger grazer/woolly sizing.
- `fauna-large-quadrupeds-mobile.png` — mobile/narrow pass after larger grazer/woolly sizing.

## Visual Findings

- Desktop shows multiple archetypes: grazers, woolly animals, smaller critters, and dragonflies.
- Dragonflies read as aerial fauna above the surface rather than planted ground props.
- Mobile frame shows visible fauna near the lower center plus an aerial insect near the upper band.
- Harness density is explicitly boosted and labeled for test-suite visibility; live game defaults remain sparse through `faunaDensity`.

## Motion Proof

Desktop frame diff:

- Changed pixels: 3,905.
- Changed ratio: 0.00282.
- Average delta: 0.36.
- Max delta: 500.

This confirms shader-driven fauna motion without a moving camera or scene-wide shift.

## Locomotion Proof

Desktop locomotion frame diff:

- Changed pixels: 24,965.
- Changed ratio: 0.01806.
- Average delta: 2.91.
- Max delta: 524.

Unit tests also assert that fauna instance matrix positions advance along eligible travel lanes after `updateFaunaAgents`.

## Jitter Regression

The first locomotion implementation used moving world position as the shader animation seed. That caused phase flicker after instance matrices started translating.

Stable-seed fix:

- Added per-instance `aFaunaSeed`.
- Shader gait, body, tail, and wing phase now read that stable seed.
- Moving instance matrix position remains available for smooth wind gust sampling.

Five-frame Playwright capture after the fix produced no relevant app console errors. Consecutive changed ratios were 0.01099, 0.00874, 0.00913, and 0.00901, consistent with steady movement rather than scene-wide flicker.

## Slerp And Level Clearance

Latest Playwright capture used the same canonical URL on desktop and mobile.

- Fauna remained on top of the rendered voxel surface in the harness.
- Route orientation changes are smoothed through retained instance quaternions instead of immediate matrix snaps.
- Voxel level transitions now apply a short outward arc along the face normal, so agents clear block height changes instead of interpolating through voxel volume.
- No app console errors were observed. Desktop reported WebGL `ReadPixels` stall warnings during screenshot capture only; mobile reported no warnings.

## Large Quadruped Size Pass

Latest desktop and mobile captures preserve the small read for dragonflies and small critters while making the grazer/horse and woolly/sheep silhouettes substantially more legible.

- Grazers now occupy more of a voxel footprint and read as large animals instead of tiny props.
- Woollies gained enough scale and height to separate from the small fauna tier.
- Runners, hoppers, and dragonflies were intentionally left at their previous scale range.
- No app console errors were observed. Desktop reported WebGL `ReadPixels` stall warnings during screenshot capture only; mobile reported no warnings.
