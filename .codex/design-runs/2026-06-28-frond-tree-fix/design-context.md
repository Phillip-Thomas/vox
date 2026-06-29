Run mode: single-surface
Execution budget: standard
Exploration depth: 3
Canonical preview URL: http://127.0.0.1:5173/tree-test.html?only=frond
Browser path: Browser plugin unavailable; use Playwright.

Hard guardrails:
- Keep changes scoped to procedural frond/tree generation and tests.
- Preserve the existing tree material pipeline and instanced render path.
- Keep deterministic generation from seed/profile inputs.
- Do not regress non-frond species.

Creative brief:
- The frond species should read as an intentional stylized palm/frond tree, not a bush with exposed sticks.
- Palm crown should be made of arcing ribs with leaflets attached along those ribs.
- Bark should read as trunk, not brown spokes through the crown.

Acceptance criteria:
- `tree-test.html?only=frond` shows a clear palm/frond silhouette.
- Leaflets align along frond ribs.
- No large brown radial sticks dominate the crown.
- Focused tree tests and `npm run verify` pass.
