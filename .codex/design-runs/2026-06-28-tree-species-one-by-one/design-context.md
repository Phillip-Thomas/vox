Surface: procedural tree species refinement in `tree-test.html` and in-world trees.

Run mode: single-surface.
Exploration depth: 3.
Execution budget: deep.
Canonical preview URL: `http://127.0.0.1:5173/tree-test.html`.
Browser path: Browser plugin not available; use Playwright.

Hard guardrails:
- Keep deterministic planet/species generation.
- Fix trees one silhouette at a time: round, conical, umbrella, weeping, wispy, frond.
- Leaves must attach to credible outer branch/tip positions, not the clear trunk or central stem.
- Preserve bounded geometry and the current instanced render path.
- Do not revert unrelated dirty files.

Creative brief:
- Style from the previous pass is directionally correct, but many trees are still too thin.
- Each species should read full and intentional without using random leaves sprayed around the trunk.
- Branches should visibly support the foliage clusters.

Open field:
- Reshape branch/candidate selection per silhouette.
- Introduce species-specific attachment orientation and fallback density where the skeleton is thin.
- Adjust tests and captures to validate each silhouette individually.
