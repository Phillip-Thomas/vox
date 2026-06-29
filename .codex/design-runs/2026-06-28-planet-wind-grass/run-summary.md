# Run Summary

Run mode: single-surface.
Surface: planet wind dynamics and grass density.
Execution budget: standard.
Canonical preview URL: http://127.0.0.1:5173/?agent=1&world=0,0&dayphase=0.4734
Server: existing Vite server on 127.0.0.1:5173; no new server started.

## Changes

- Added `main/src/utils/windProfile.ts`: deterministic `WindProfile` for shared planet atmosphere data.
- Added `main/src/utils/windProfile.test.ts`: determinism, range, and diversity coverage.
- Updated `main/src/utils/grassProfile.ts`: grass now carries `wind: WindProfile`; existing `windDir` and `windStrength` remain compatibility fields.
- Updated `main/src/utils/grassField.ts`: doubled strand density, added gust uniforms, spatial gust cells, local direction veer, and shader key `grass-pbr-v5`.
- Updated grass/profile tests to protect density and wind invariants.
- Added `capture-wind-grass.mjs` rendered validation script.

## Evidence

- Live grass instances on validation world: 16,688.
- Previous pass validation count: 8,344.
- Material key: `grass-pbr-v5`.
- Screenshots: `desktop-wide-wind-grass.png`, `desktop-close-wind-grass.png`, `mobile-close-wind-grass.png`.
- Wind uniforms populated from profile: direction, strength, gust strength, gust scale, gust speed, turbulence, veer, offset.

## Remaining Scope

- Trees and audio still have their own wind paths. The new `WindProfile` is ready for them, but this pass only migrates grass.
- Still screenshots do not fully communicate gust direction; live preview is the best judge of wind feel.

