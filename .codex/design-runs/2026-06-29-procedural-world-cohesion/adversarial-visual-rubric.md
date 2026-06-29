# Adversarial Visual Rubric

Use this rubric after each atlas batch. The reviewer should be strict. A planet that is merely "not broken" fails the ambition bar.

## Per-Screenshot Questions

| Question | Fail example |
| --- | --- |
| Does the planet have a clear color thesis? | Random grass, water, sky, and tree colors feel unrelated. |
| Is the palette humanly pleasing? | Oversaturated, muddy, low-contrast, or full-frame neon. |
| Is there a dominant/secondary/accent relationship? | Every element competes equally. |
| Does the world preserve diversity? | Many seeds look like the same green planet. |
| Are values readable? | Terrain, water, trees, and fauna blend into the same luma band. |
| Does the shape language feel intentional? | Grass, trees, flora, fauna, blocks, rocks, and effects look like separate games. |
| Does the ecology make sense? | Sheep in ocean, cactus in wet forest, dense flowers on ice sheet. |
| Is scale believable? | Trees are player-height, animals are toy-sized, flora dwarfs trees. |
| Does wind feel cohesive? | Dust, grass, trees, flora, and fauna move in conflicting rhythms. |
| Does the reality stage progression read? | Stages look like random shader toggles. |
| Does the screenshot have a focal quality? | No memorable silhouette, color accent, or atmosphere. |
| Does the image feel cinematic without being harsh? | Aliasing, outlines, tone mapping, or bloom draw attention to the renderer. |
| Is performance acceptable for the quality profile? | The scene is beautiful but exceeds frame budget. |

## Score Categories

| Category | Weight |
| --- | ---: |
| Planet identity and product truth | 10% |
| Palette harmony and color theory | 14% |
| Palette diversity across seeds | 8% |
| Value hierarchy and readability | 9% |
| Shape/stylization consistency | 11% |
| Ecology and biome truth | 10% |
| Scale hierarchy | 8% |
| Motion/wind cohesion | 7% |
| Reality-stage progression | 7% |
| Performance/scalability | 10% |
| Maintainability/system clarity | 6% |

## Severity Rules

- Critical:
  - blank render,
  - fatal console error,
  - unusable performance on HIGH,
  - systemic palette collapse across many seeds,
  - widespread invalid spawning.
- High:
  - one archetype consistently ugly or incoherent,
  - major scale mismatch,
  - sky/water/ground clash,
  - shader cost exceeds budget on several seeds.
- Medium:
  - one screenshot lacks focal interest,
  - one material's spawned effect feels out of style,
  - isolated ecology mismatch,
  - localized contrast issue.
- Low:
  - minor hue over/under-saturation,
  - occasional density imbalance,
  - non-blocking screenshot framing issue.

## Patch Discipline

- Fix foundation defects before local polish.
- If three systems clash, do not tune all three randomly. Adjust the shared contract.
- If one subsystem is excellent but the planet fails, preserve the subsystem and adjust role mapping.
- If performance fails, reduce cost through quality gates, culling, instancing, or shader branch control before removing visual identity.
- Every patch loop must include screenshots and metrics from the same seed/vantage matrix.
