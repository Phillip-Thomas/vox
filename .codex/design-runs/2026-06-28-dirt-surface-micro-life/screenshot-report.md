# Screenshot Report

Canonical preview URL: `http://127.0.0.1:5174/voxel-test.html?effects=dirt&profile=HIGH&seed=12345`
Browser path: Browser plugin unavailable; used Playwright with `/snap/bin/chromium`.

## Captures

- Desktop: `dirt-life-harness-desktop.png` at 1280 x 800.
- Desktop motion comparison: `dirt-life-harness-desktop-t1.png` at 1280 x 800.
- Mobile: `dirt-life-harness-mobile.png` at 390 x 844.

## Render Checks

- Page identity: `voxel-test.html?effects=dirt&profile=HIGH&seed=12345`.
- Harness summary: material `dirt`, mode `effects`, profile `HIGH`, seed `12345`.
- Blank-page check: passed.
- Framework overlay: none.
- Motion proof: desktop frame A/B comparison changed 34,315 of 1,024,000 pixels (3.35%) with max RGB delta 329.

## Screenshot Review

The first shipped visual read was too close to static scratch marks. The corrective screenshot now shows a distinct spawned loose-soil layer: raised warm clods sit above the dirt voxel, and the crawler layer is small enough to be discoverable on close inspection rather than reading as obvious worms across the whole block.
