# Run Summary

## Implemented

- Added `OrbitalMinimap`, a compact R3F HUD canvas with a wire shard, local heading marker, player/object pips, and count telemetry.
- Added `orbitalMinimapModel` helpers for projection, marker selection, dedupe, stale state, and marker caps.
- Extended `shipProximity` to publish parked ship position for HUD consumers.
- Wired the minimap into the live gameplay HUD in `App.tsx`.
- Added focused Vitest coverage for minimap projection/filter/capping behavior.
- Refined heading to use active-face UV axes and pitch, so looking down points inward toward the minimap cube on every face.
- Added an active face label and subtle UV guide frame inside the minimap cube.
- Changed map rig motion so the cube stays static while the player remains on one face and slerps to the next face orientation on face changes.
- Replaced the square-on wireframe read with a caticorner active-face plate, solid current edges, and dashed rear/connector scaffold lines.
- Reduced minimap geometry size to prevent clipping inside the HUD panel.
- Changed world-to-minimap projection so the gameplay cube surface maps to the visible minimap face edge.
- Changed the face display to clean camera-relative 30 degree yaw / 15 degree pitch offsets.
- Removed the decorative circular scanner shell so the minimap reads as a cube shard instead of a radar bubble.

## Verification

- `npm run typecheck`: pass
- `npm run test`: pass, 69 files / 470 tests
- `npm run build`: pass
- Browser screenshots: desktop and mobile pass
- Canvas-pixel checks: desktop and mobile pass
- Firebase deploy: pass
- Live asset hash: `assets/index-7iS5QdPq.js` on `https://paravox-game.web.app/` and `https://paravoxia.com/`

## Preview

- Local preview URL: http://127.0.0.1:5173/
- Live URL: https://paravoxia.com/

## Screenshots

- `.codex/design-runs/2026-06-25-3d-minimap/screenshots/desktop-1440x900.png`
- `.codex/design-runs/2026-06-25-3d-minimap/screenshots/mobile-390x844.png`
