Surface: procedural trees and stylized forest art direction.

Run mode: single-surface.
Exploration depth: 3.
Execution budget: standard.
Canonical preview URL: `http://127.0.0.1:5173/tree-test.html`.

Hard guardrails:
- Keep the existing procedural tree field and `tree-test.html` harness.
- Preserve deterministic seed behavior.
- Do not import or clone third-party code or assets.
- Keep geometry and shader costs bounded for the live game.
- Validate desktop and mobile screenshots.

Creative brief:
- Trees should read lush, thick, and stylized rather than sparse props.
- Canopies should have coherent leaf tufts, broader shaded volumes, and species-level variation.
- Planet variation should feel botanical: branch angle, whorls, apical dominance, droop, trunk character, foliage placement, and wind response.

Open field:
- Translate reference ideas into our generator parameters and shader treatment.
- Favor compact deterministic controls over a full growth simulation rewrite.

Reference sources:
- Elysium three.js thread: https://discourse.threejs.org/t/elysium-the-most-beautiful-stylized-world-on-the-web/55541
- Fluffy Tree three.js thread: https://discourse.threejs.org/t/fluffy-tree-anime-style/86626
- FluffyTree source: https://github.com/leoawen/fluffytree-threejs
- Florasynth editor/docs: https://www.florasynth.com/editor?id=PRESET_Green%20Ash
- Florasynth docs routes inspected from public chunks: `/docs/tropism`, `/docs/branching`, `/docs/apical_dominance`, `/docs/branch_bend_under_weight`, `/docs/foliage`, `/docs/trunk`, `/docs/geometry`, `/docs/advanced`.
