# Lessons Learned

- `tree-test.html` is the right first validation surface for tree work because it shows all silhouettes without requiring seed hunting in the game world.
- For tree fullness, increasing card size makes close shots more cartoony. Better results came from raising bounded card budgets while reducing leaf scale and per-card half-size.
- Tree visual proof should collect material keys, leaf vertex counts, wind uniforms, and frame-to-frame motion hashes, not screenshots alone.
- Stored in-world vantages can become stale for vegetation work because streaming and culling may not place a near-tree mesh at that exact pose. Computed `window.__game.view('tree')` on a known tree world is more reliable for integration proof.
