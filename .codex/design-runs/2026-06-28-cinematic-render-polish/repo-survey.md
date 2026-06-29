Relevant files:
- `main/src/App.tsx`: Canvas renderer settings, tone mapping exposure, DPR, profile query params.
- `main/src/components/effects/PostFX.tsx`: EffectComposer chain, AO, bloom, outline, color grade, tone mapping.
- `main/src/components/effects/ColorGradeEffect.ts`: postprocess tint/saturation/contrast/warmth logic.
- `main/src/components/effects/OutlineEffect.ts`: stylized depth outline strength/threshold.
- `main/src/config/graphicsSettings.ts`: profile flags for postprocess/grade/outline/AO.
- `main/tools/capture.mjs`: headed capture and metrics harness, Windows-oriented executable path.
- `main/src/components/BenchmarkProbe.tsx`: bench overlay for frame timing and render stats.

Current findings:
- Canvas currently uses `antialias: false`; this preserves performance but contributes to harsh jaggies on some screens.
- HIGH/ULTRA route through EffectComposer and restore ACES as a final pass, while MEDIUM/LOW use renderer ACES directly.
- ColorGradeEffect has no explicit highlight shoulder or low-level filmic lift; contrast can feel crunchy depending on palette.
- OutlineEffect defaults are intentionally stylized but may darken high-contrast depth edges too aggressively.
- N8AO and outline are HIGH/ULTRA only; MEDIUM disables postprocess entirely.
- Existing dev server is healthy at `http://127.0.0.1:5173/`.

Brand/asset inventory:
- No new bitmap assets needed.
- Existing identity comes from procedural voxel materials, biome palettes, sky/water/grass/tree shaders, and HUD chrome.
