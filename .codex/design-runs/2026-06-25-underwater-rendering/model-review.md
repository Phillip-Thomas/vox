# Model Review

Reviewer: Codex self-review

Risk check:

- Shader-only change is localized but visual. Rendered screenshots are required.
- Debug harness change touches only `?agent=1` mode and resets submersion on unmount.
- No Claude second opinion used because the defect cause and fix direction were clear after rendered comparison.

Expected failure modes:

- Godrays could become too faint.
- Shaft bands could read as radial spokes.
- Harness could accidentally leave local submersion stuck on after leaving agent mode.

Mitigation:

- Two screenshot iterations.
- Reset `setPlayerSubmerged(0, 0)` during agent camera cleanup.
- Focused submersion/swim tests plus typecheck/build.
