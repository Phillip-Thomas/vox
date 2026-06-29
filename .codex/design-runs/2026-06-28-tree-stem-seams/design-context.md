# Design Context Contract

Surface: procedural tree stem/base rendering in `tree-test.html` and in-world `TreeField`.
Run mode: single-surface.
Exploration depth: 1.
Execution budget: standard.
Approval threshold: 4.75 / 5.
Category floor: 4.3 / 5.
Canonical preview URL: `http://127.0.0.1:5173/tree-test.html?only=frond`.
Browser path: Browser plugin unavailable; used repo-local Playwright via `playwright-core`.

## Hard Guardrails

- Preserve deterministic tree generation.
- Keep the existing instanced tree architecture.
- Do not add texture assets or new draw calls.
- Fix the visible disconnected stem chunks across all tree variants, not a single seed.

## Creative Brief

- Stems and bases should read as continuous wood forms.
- Bark texture variation is welcome; disconnected horizontal seams are not.
- Preserve the current stylized low-poly tree language.

## Open Field

- Tube ring topology and normal/frame handling.
- Focused harness screenshots for trunk-heavy trees.
- Regression tests that catch a return to per-segment ring duplication.
