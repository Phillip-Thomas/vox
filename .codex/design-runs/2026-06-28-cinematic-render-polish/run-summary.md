Status: complete.

Canonical preview URL:
- http://127.0.0.1:5173/

Changes:
- Lowered direct renderer ACES exposure from 1.0 to 0.94.
- Updated ColorGradeEffect to preserve HDR through the final ACES pass instead of clamping to 0..1.
- Added subtle shadow lift and pre-ACES highlight shoulder to the color grade.
- Reduced biome tint, saturation push, and contrast in PostFX.
- Enabled composer multisampling for HIGH/ULTRA postprocessing.
- Softened N8AO, bloom, and depth outline strength.

Iteration:
- Iteration 1 selected Soft Cinematic Resolve.
- Result: smoother, more cinematic render while retaining the current color identity.
- Score: 4.58 / 5.

Checks:
- Desktop and mobile Playwright screenshots captured.
- Deterministic agent-vantage screenshots captured.
- `npm run verify` passed.

Remaining accepted tradeoffs:
- MEDIUM/LOW keep the direct renderer path for older laptop performance.
- Startup/bundle perf was not changed in this pass.
- Physical older-laptop testing was not available in this environment.
