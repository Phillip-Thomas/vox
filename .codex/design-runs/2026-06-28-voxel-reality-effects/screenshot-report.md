Preview URL:
http://127.0.0.1:4173/

Routes captured:
- `http://127.0.0.1:4173/?agent=1&world=0,45&profile=HIGH&voxelStage=paradox&dayphase=0.42`
- `http://127.0.0.1:4173/?agent=1&world=0,45&profile=HIGH&voxelStage=bare&dayphase=0.42`

Artifacts:
- `runtime-paradox.png`
- `runtime-bare.png`

Findings:
- Scene rendered in both stages.
- HUD and world remained visible.
- Console showed no shader/program compile errors.
- `bare` disables voxel block material effects and applies unresolved block chroma; non-voxel systems such as grass blades, trees, water, sky, and HUD remain outside this pass.
- Console warnings were limited to Playwright/CDP inspection ReadPixels performance warnings and an existing deprecated initialization warning.

Known limitation:
- Playwright's regular screenshot API hung in this local snap Chromium environment. CDP `Page.captureScreenshot` succeeded and produced the evidence files.
