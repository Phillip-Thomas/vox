# Run Summary

## Outcome

- Run: `demo-shell`
- Date: `2026-07-12`
- Exploration depth: `1`, focused execution
- Result: `Batch 1 refined pass`
- Story boundary: unchanged through W-7744 arrival
- Audio boundary: engine and assets untouched
- Desktop control boundary: bindings and feel unchanged

## Delivered

- True pause across Story time, Story TTL/reveal timing, physics, player actions/vitals, ship input, and touch input.
- Story-safe pause surface with no Star Map plus a defensive active-Story travel guard.
- Shared mode-aware desktop/touch control reference on landing and pause.
- Keyboard dialog semantics, focus trap/restoration, visible focus, browser zoom, reduced-motion behavior, and narrow-layout repair.
- Completed-site continuation, explicit confirmed Story replay, clean Story-site reset, and a completion recovery dialog.
- A keyed Story run remount that clears Story-authored state without mutating an unrelated current world.

## Verification

- `npm --prefix main run verify`: pass; 143 test files / 1,077 tests, TypeScript, production build.
- Post-review focused suites: 5 files / 48 tests pass.
- Post-review TypeScript: pass.
- Production JS: 4,711.37 kB minified / 1,583.42 kB gzip; under the 1.60 MB demo guard, with the existing large-chunk warning.
- `git diff --check`: pass.
- Shell matrix: six accepted states in `main/captures/demo-shell/`.

## Preview Ownership

- Reused `http://127.0.0.1:5201/`.
- Started persistent servers: none.
- Stopped persistent servers: none.

## Defect Trend

| Stage | Critical | High | Medium | Low |
| --- | ---: | ---: | ---: | ---: |
| Batch baseline | 0 | 4 | 4 | 1 |
| After implementation | 1 | 0 | 2 | 1 |
| After final adversarial patch | 0 | 0 | 0 | 2 deferred release gates |

The temporary critical count records the replay cleanup defect caught during review; it did not ship from this run.

## Next Action

Begin Batch 2: make the existing primitive gather/craft/shelter/warmth/recovery loop complete, honest, and persistent. Hide unreachable or later-era affordances rather than broadening the story.
