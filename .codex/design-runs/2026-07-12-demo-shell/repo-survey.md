# Repo Survey

## Stack And Surface

- React 19, Three.js/R3F, Rapier, Vite, TypeScript, Vitest.
- Inline component styles plus `src/ui/theme.ts` and `src/index.css`.
- Single app surface with state-driven landing, Story, sandbox, pause, and HUD.

## Existing Components And State

- `LandingMenu`: six-row control disclosure and Story entry.
- `PauseMenu`: Star Map, graphics, audio, resume, menu; no controls or modal focus.
- `App`: owns pause state, Story state, world travel callbacks, and mode context.
- `StoryDirectorDriver` / `storyDirector`: narrative timing and effects.
- `StoryCaptions` / `AuditBand`: wall-clock text reveal and expiry.
- `EfficientScene`: Rapier boundary suitable for a true pause prop.
- `TouchControls.model`: existing tested touch-action vocabulary.

## Confirmed Gaps

- Story director/autopilot continue behind pause.
- Narrative `elapsedSeconds` jumps across a pause because it mirrors raw R3F time.
- Caption/audit TTL continues via `performance.now()`.
- Star Map travel remains visible and callable during active Story.
- Controls reference omits sprint, survival, build, map/HUD, and ship actions.
- Browser zoom is disabled; focus-visible and modal ownership are absent.
- Touch controls remain live beneath pause.

## Asset Strategy

- No new raster/model/audio asset is needed.
- Reuse Paravoxia typography, glass panel, cyan telemetry, and existing controls.

## Gate

- Components/tokens/state understood: `pass`
- Brand/asset decision explicit: `pass`
- Dirty-file collision documented: `pass`
