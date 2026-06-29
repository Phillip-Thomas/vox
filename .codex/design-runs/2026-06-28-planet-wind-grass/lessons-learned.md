# Lessons Learned

- A reusable planet wind profile is the right seam: pure deterministic data first, runtime systems later only when consumers need sampling over time.
- For grass density, doubling strand instances still keeps the renderer on the same instanced-mesh path, but screenshot validation gets slower and should keep explicit proof of instance counts.
- Static screenshots need paired motion proof for shader animation work; screenshot-diff crops are a practical fallback when direct WebGL reads are unreliable.

