# Lessons Learned

- For grass in this renderer, narrowing blade geometry alone makes the field read like sparse needles. Hairlike coverage requires density and height tuning together.
- The current visual sweet spot is many short micro-clustered strands, not broad fan tufts.
- Stored debug vantages can drift when generation/render gating changes; keep a generic live grass probe in screenshot scripts so validation can still frame the actual grass mesh.

