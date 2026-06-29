Direction A: Strict Tip-Attached Species
- Thesis: foliage only belongs to outer/tip branch nodes; remove inward thresholding and central-stem foliage.
- Pros: directly fixes leaves on stem and improves branch/leaf alignment.
- Risks: thin skeletons can become sparse unless leaf clusters become fuller.

Direction B: Species-Specific Canopy Scaffold
- Thesis: add explicit per-silhouette fallback/attachment rules so each species receives enough outer branch anchors.
- Pros: handles weak skeletons one by one.
- Risks: more branching logic in the generator.

Direction C: Pure Global Density Increase
- Thesis: keep placement rules and raise all leaf counts again.
- Pros: fastest.
- Risks: masks the actual defect and makes detached leaves worse.

Selected direction:
- Combine A and B. Reject C because the user specifically called out branch alignment, not just density.
