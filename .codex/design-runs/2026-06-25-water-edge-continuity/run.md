# Water Edge Continuity

Run mode: single-surface
Exploration depth: 1
Execution budget: fast
Canonical preview URL: http://127.0.0.1:5173/?agent=1&world=-1%2C-70&dayphase=0.1235&profile=HIGH

## Context

Surface: Paravoxia water voxel rendering at cube-face seams.
Page goal: preserve the existing water look while removing the raised/lowered seam at cube edges.
Primary action: inspect the water-edge debug vantage.
User motivation: water should look continuous and production-quality across cube faces.
Success proxy: cube-edge outward water faces are transformed as water surfaces, not side-wall rims; rendered water mesh appears at the stored water-edge vantage.
Language constraints: no production copy changes.

Hard guardrails:
- Do not clobber ongoing backend/co-op work.
- Keep dynamic water flood and replicated water registration intact.
- Avoid per-frame React churn or new per-frame allocations in the unchanged frame path.

## Iteration 1

Change:
- Moved water face placement into a pure utility.
- Classified cube-edge and cube-corner outward faces by radial outwardness, so seam faces render as water surfaces instead of raised side walls.
- Kept true shoreline faces as walls and inward void faces as floors.

Score:
- Goal effectiveness: 4.8 / 5
- Visual continuity: 4.75 / 5
- Implementation fidelity: 4.8 / 5
- Performance risk: 4.7 / 5
- Weighted score: 4.76 / 5

Checks:
- `npm run test -- waterFacePlacement waterVoxels`: passed.
- `npm run typecheck`: passed.
- `npm run build`: passed with the existing large bundle warning.
- Playwright/Chromium render check: desktop and mobile screenshots captured from the stored `-1_-70-water-edge-misalign` vantage.

Evidence:
- Desktop screenshot: `/tmp/water-edge-desktop.png`
- Mobile screenshot: `/tmp/water-edge-mobile.png`

Stop reason:
- The targeted seam classification defect is covered by unit tests and the stored rendered vantage loads with visible water.
