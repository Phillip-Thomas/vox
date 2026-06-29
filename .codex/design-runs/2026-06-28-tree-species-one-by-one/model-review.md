Pre-implementation review:

Likely fixes:
- Clamp effective foliage threshold to zero for visual placement, or remove it from tree profile handoff.
- Exclude order 0 trunk/central leader from conical candidates except possibly the highest tip, and prefer lateral nodes.
- Use child count, order, dist, and height to choose outer supports per species.
- Add tests that conical does not select lower central-stem nodes.
- Add close-up capture script for all six species.

Risks:
- Removing leader foliage can reintroduce bare tops.
- Tip-only candidates can reduce density for short skeletons.
- Overcorrecting weeping can lose its dense curtain look.

Mitigation:
- Use top-tip fallback and sparse-cluster boost.
- Review screenshots one by one before final verification.
