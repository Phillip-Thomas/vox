# Common Ground — arena feasibility (pond footprint + proposed finite reference range)

Status: read-only **preproduction measurement**, 2026-09-06. Bounded CPU only.
No source, worldgen, validator, canon, signature, build, browser, GPU or server
was touched. Pass-1 and pass-2 artifacts are unchanged (hashes below match their
recorded values). This signs nothing and reopens no council signature.

This measures **two independent creative proposals**, and selects **no winner**:

| Proposal | Nominated range | Document |
| --- | --- | --- |
| Chapter Director | **12** world units | `arena-chapter-refinement.md` |
| Cinematography | **24** world units, socket-to-socket | `arena-cinema-refinement.md` |

Finite reference range **does not exist in the runtime**. It is evaluated here
purely as a proposed predicate. Nothing below is shipped behaviour.

- Probe: `.codex/story-runs/2026-09-06-common-ground/geometry-arena-probe.mts`
- Machine output: `.codex/story-runs/2026-09-06-common-ground/geometry-arena.json`
- CPU: **3.16 s** (budget ≤ 5 min). Deterministic: two runs byte-identical apart
  from the timestamp and the timing fields.

Reproduce:

```bash
cd /home/thomasphillip/Projects/vox/main
TM=$PWD/node_modules/three
./node_modules/.bin/esbuild ../.codex/story-runs/2026-09-06-common-ground/geometry-arena-probe.mts \
  --bundle --platform=node --format=esm --outfile=/tmp/cg-arena.mjs \
  "--alias:three=$TM/build/three.module.js" \
  "--alias:three/examples/jsm/utils/BufferGeometryUtils.js=$TM/examples/jsm/utils/BufferGeometryUtils.js"
node /tmp/cg-arena.mjs > ../.codex/story-runs/2026-09-06-common-ground/geometry-arena.json
```

---

## VERDICT

**Not found, at either nominated range. Zero qualifying layouts.** This is a
bounded failure packet, not a pass. No proposed constraint was relaxed to reach
it, and none was relaxed to try to pass.

The water topology the proposals rely on **does exist and is not the obstacle**:
there are two genuine dry banks, and same-endpoint bank routes differing by up to
**+16 units / ×1.44** are available inside the 24-unit pond-anchor envelope, well
within both caps. What does not exist is a fixed head position that separates
them. Across **20 000 evaluated (endpoint-pair, instrument) combinations**:

- **Range 12** — in the 1 239 combinations where the whole longer bank route
  stayed in reference, the shorter bank route lost reference for at most
  **2.00 contiguous walked units** (6.00 required). In the 94 combinations where
  the shorter route did lose ≥ 6 units, the longer route was at best
  **94.03 %** covered — 4 samples short of the "continuous fixed-reference
  coverage on the longer route" both documents require.
- **Range 24** — in the 3 813 combinations with the longer route fully in
  reference, the shorter route's largest unsupported span was **0.00 units**. One
  single combination produced a qualifying short-route span; there the longer
  route was **87.76 %** covered.

The witness, reciprocal-comparison and ranking stages were **never reached**, so
this run reports nothing about witness poses, reciprocal spans or robustness
ranking. Those measurements do not exist yet.

---

## Part A — pond topology (measured first, as commissioned)

The commission required the finite dry node map to be built around the **actual
connected water footprint** before any search, with an abort if there are not two
banks. Topology was built by 4-connected flood fill from the existing pond
anchor, using the same wetness window `cellAt` uses.

| Measure | Value |
| --- | --- |
| Pond anchor (shipped `getPondPose`) | `(6.00, 50.50, -12.00)`, column `[3, -6]`, depth 3 |
| Shipped dry shore | `(4.00, 51.05, -10.00)` |
| **Connected water footprint** | **534 columns** |
| Footprint bounds (cells) | `u ∈ [-21, 25]`, `v ∈ [-25, 5]` |
| Footprint world extent | `x ∈ [-42, 50]`, `z ∈ [-50, 10]` |
| Max water depth | 12 cells |
| Dry walkable nodes 4-adjacent to it | 121 |
| Dry walkable nodes within 2 cells of it | 280 |
| Bank nodes within 24 units of the anchor | **87** |
| Walkable dry nodes in the search field | 1 068 |
| Support-height histogram | `{ "25": 1068 }` |
| Trunk-guarded nodes (pass-2 defect guard) | 1 |

**Two banks exist — search was not futile and was not aborted.** 2 552 endpoint
pairs have a genuine node-disjoint second dry route around the same connected
footprint. Largest measured second-bank detour: `(-12, 51.05, -8)` →
`(8, 51.05, -16)`, shortest **36.00**, disjoint alternative **52.00**
(**+16.00 units, ×1.44**) — that pair alone satisfies the ≥ 12-unit and ≥ 25 %
rules, with both routes far inside 120 units and 128 samples.

Two facts about this footprint that the proposals did not have:

1. It is **not a pond-sized indentation**. 534 connected columns spanning 92 × 60
   world units is a large water body; `getPondPose` returns one anchor on it. The
   "existing pond" both documents build on is the edge of this body.
2. **Support height is uniform at 25 for all 1 068 dry nodes** — pass-2's
   zero-relief finding holds here too. Confirmed independently: of **579 040**
   short-route sample lines measured against fixed heads across both ranges,
   **0** were lost to solid occlusion. Every reference loss measured in this run
   is caused by the proposed finite range and by nothing else.

---

## Part B — what was searched

Conventions are inherited verbatim from `geometry-pass2-probe.mts`: rendered-cube
gate (`max(|x|,|y|,|z|) ≤ 25`), Amanatides–Woo DDA over real voxel AABBs, sockets
measured from real body geometry, hero trunk `CuboidCollider` as the only prop
occluder. No logical out-of-cube terrain, no canopy, no fauna, no invented
obstacle, no terrain edit, no arbitrary exclusion radius, no relaxed cap, no
decimated corner.

| Quantity | Value |
| --- | --- |
| Actor socket (W-7744 visor, above grounded pose) | 1.85 |
| Fixed head socket (primary) | 1.85 |
| Player-held / standing reference socket | 1.35 (`PLAYER_EYE_HEIGHT`) |
| Worker-held reciprocal socket | 1.85 |
| Range measured | socket-to-socket |
| Body-radius clearance for witnesses | 0.50 (`PLAYER_CAPSULE_RADIUS`) |
| Endpoints / instrument / witness envelope | ≤ 24 units from the pond anchor |
| Caps | 128 samples **and** 120 walked units, both routes |

Search bounds actually reached, per nominated range:

| | Range 12 | Range 24 |
| --- | --- | --- |
| Endpoint pairs with two bank routes | 2 552 | 2 552 |
| Instrument candidates in pool (exhaustive within 24 u) | 279 | 279 |
| (pair, instrument) combinations considered | 712 008 | 712 008 |
| Surviving the endpoints-in-range screen | 50 515 | 330 111 |
| **Combinations evaluated (cap 10 000)** | **10 000** | **10 000** |
| Distinct endpoint pairs evaluated | 1 728 | 2 422 |
| Distinct instrument positions evaluated | 201 | 279 |
| Wall time | 0.79 s | 1.45 s |

Two soundness measures were added so the failure cannot be an artifact of an
arbitrary choice:

- **Both readings of "the longer bank route" were measured.** (A) the shortest
  same-endpoint route that stays fully in reference — the route a player would
  actually walk under the coverage constraint; and (B) the **authored second
  bank**, the node-disjoint alternative route itself, offered whenever it already
  meets the ≥ 12-unit / ≥ 25 % rules. Reading B is what produced the +16.00 /
  ×2.20 detour figures.
- **The shorter route is the least-supported shortest route.** On a 4-connected
  grid a pair has many equal-length geodesics; picking one by BFS order would let
  a tie-break decide the answer. The probe runs a DP over the shortest-path DAG
  and selects, among all routes of identical walked length, the one entering the
  fewest reference-covered cells. Walked-length anomalies: **0**.

---

## Part C — the measured failure

### Reading A: the route a player would walk

Across every evaluated combination in which a fully-supported same-endpoint route
exists, its walked length was **exactly equal** to the shortest route's:
`maxExtraUnitsWhenSpanOk = 0.00` for both ranges. Whenever the shorter bank route
loses the head, the coverage region either still contains an **equal-length**
geodesic (range 12: 211 combinations; range 24: 4) or **disconnects the endpoints
entirely** (range 12: 474; range 24: 117). There is no in-between case in 20 000
samples. Under this reading the mechanic has magnitude zero: the player can keep
reference without walking a single extra unit.

### Reading B: the authored second bank

Here the detour is real (+16.00 units, ×2.20 max ratio, both caps satisfied,
0 trunk intersections on any route segment). The failure moves to the coexistence
of the two halves of the proposal:

| | Range 12 | Range 24 | Required |
| --- | --- | --- | --- |
| Combos with the longer bank route **fully** in reference | 1 239 | 3 813 | — |
| ↳ best short-route unsupported span in those | **2.00 u** | **0.00 u** | ≥ 6.00 u |
| Combos with a qualifying ≥ 6 u short-route span | 94 | 1 | — |
| ↳ best longer-route coverage in those | **94.03 %** | **87.76 %** | 100 % |
| ↳ fewest longer-route samples out of reference | 4 | 6 | 0 |
| Max detour available | +16.00 u / ×2.20 | +16.00 u / ×2.20 | ≥ +12 u and ×1.25 |
| Max short-route unsupported span available | 22.00 u | 24.00 u | ≥ 6.00 u |
| Qualifying layouts | **0** | **0** | ≥ 1 |

Each requirement is individually satisfiable; **no instrument position satisfies
both at once**. The measured mechanism is direct: the longer bank route wraps
around the same water body the shorter route skirts, so a head that keeps the
whole wrap inside its range necessarily encloses the shorter route as well. Range
24 fails harder than range 12 — the larger disc swallows both banks (best span
0.00 u), while range 12 at least reaches 2.00 of the 6.00 required units.

Deepest stage reached, both ranges: `long-fully-supported`. Stages never reached:
**intermediate witness, reciprocal comparison span, ranking.**

### Shipped-planner cross-check (representative, positive and negative)

Run on the largest two-bank pair, since no layout qualified:

| Check | Result |
| --- | --- |
| Shortest route edges re-planned by `planAgentSurfaceRoute` | **18 / 18** accepted (`walk` / `dry-surface-path`) |
| Shortest route corner-to-corner legs | **4 / 4** identical straight runs |
| Second bank route edges | **26 / 26** accepted |
| Second bank corner legs | **6 / 6** identical |
| Replica-rejected columns (negative edges, mostly wet) | **55 / 55** — the shipped planner also refuses to land there |

No leg used water, jetpack, cross-face routing or automatic repair
(`allowJetpackCrossing: false`, `differentFaceFallback: 'unreachable'`).

---

## Bounded failure packet

What is **established** on the actual geometry:

1. The connected water footprint exists, is large (534 columns), and supplies
   **two real dry banks** with same-endpoint routes differing by **+16.00 units /
   ×1.44**, inside both caps and inside the 24-unit anchor envelope.
2. On this ground the finite range is the **only** thing that can withdraw a
   reference: 0 of 579 040 measured sample lines were lost to solid occlusion.
3. **Neither nominated range (12 or 24) yields a single layout** in which one
   fixed head keeps the whole longer bank route in reference while the shorter
   bank route loses it for ≥ 6 contiguous walked units. Best coexistence measured:
   2.00 of the required 6.00 units (range 12), or 4 uncovered samples of the
   longer route (range 12).
4. Consequently **no witness pose, socket coordinate, reciprocal span or
   robustness ranking is reported** — those measurements were never reached and
   are not being invented.

What this run **cannot** decide, and where the bound is:

- The search is **bounded, not exhaustive**: 10 000 of 712 008 candidate
  combinations per range, as commissioned. Coverage was 1 728 / 2 422 distinct
  endpoint pairs and 201 / 279 instrument positions. The CPU budget was not the
  binding constraint (3.16 s of 300 s); the combination cap was.
- Only two ranges were evaluated, because only two were nominated. This run does
  **not** report which range, if any, would work — that would be a new nomination.
- Reading B tests one authored longer bank per pair (the shortest node-disjoint
  alternative). Longer authored routes exist; they are harder to cover, not
  easier, so this is a favourable choice rather than a gap.
- Witness-cylinder tolerances, offer/occupancy hysteresis, hold/recovery and
  retry are **not simulated**. Only socket distance and the solid line were tested.
- **Nothing here is visually verified**: no render, GPU, readability, day/night,
  mobile, reduced-motion or lowest-tier evidence.

### Live-world-edit limitation (recorded as commissioned)

All terrain comes from pristine procedural generation —
`generator.shouldVoxelExist` / `isWaterVoxel` / lava — **not**
`createLiveAgentSurfaceTerrain`. Player voxel edits can flood, drain or bridge
any column measured here and invalidate any span, route or bank relation.
Live-edit confirmation still requires a running client and a contracted,
story-scoped debug hook; it remains unbuilt (pass-1 step 2, unchanged).

### Shipped defect, unchanged and still open

`planAgentSurfaceRoute` knows terrain voxels only; the hero trunk
`CuboidCollider` is invisible to it (pass-2 Part B). This run guards against it
(1 node banned in this field, inflated by the 0.50 body radius, with segment —
not centre — tests on every route edge). The defect itself is still in shipped
navigation and still affects any route authored near the hero tree.

---

## Hashes

New artifacts:

```
17436bc458e314c772438cecb6b4031d9d478aeca6bf07ae805ca12173d98fd3  .codex/story-runs/2026-09-06-common-ground/geometry-arena-probe.mts
```

(`geometry-arena.json` is regenerated by the reproduce command above; it is
deterministic apart from `generatedAt`, `cpuSeconds` and `perRange[].wallSeconds`.)

Pass-1 and pass-2 artifacts, verified unchanged by this pass:

```
4dda6f78f5e114c604266738e8d3e111de4cc54a09b59593d9bb2d3ed01548fe  .codex/story-runs/2026-09-06-common-ground/geometry-feasibility-probe.mts
f33efd2cf6d0928602199aea8398958c2d23d9b6866cc1ec3ef8bee6619e73a2  .codex/story-runs/2026-09-06-common-ground/geometry-feasibility.json
098cb6575be60f774f83c8413b69f7274b5e2829cfc4130115dc2953dc2a5de3  .codex/story-runs/2026-09-06-common-ground/geometry-pass2-probe.mts
4c32f3e59ae0bf602698ce58befd63f3bc7711ef06dbd59d46c3dbf1d9ff3498  .codex/story-runs/2026-09-06-common-ground/geometry-pass2.json
```

Source read for this measurement (unchanged by it; all match the pass-2 record):

```
7e5046d37aeb21b2ef36988b98504ad37a117f9c9b536fa4619db0dda78f8279  main/src/utils/agentSurfaceNavigation.ts
c0a71ab046b5d5324a7a0562b4a7b0db720cba4451ac51aabd9336f5a133c399  main/src/utils/cubeGravityConstants.ts
5009c44ac1c3e139cf3636288e9e796626030f31fef2632bb9104d465d998461  main/src/story/world/storyAnchorResolver.ts
aa9a1177f1bf9d19c3df566a5b4edb96eff7c2664d273fafed5bbd579c264c61  main/src/story/world/HeroAppleTree.tsx
88fc065747f9c82aa9896e59d686b85f54e0c007a2ae76b646b369c400a34f3e  main/src/story/world/AuditWorker.tsx
bb80319c0fbbf01736c6d2be969451eb7836a61b02bffc2744401ae9a2844ddb  main/src/utils/groundedSurfaceMotion.ts
7e900372322ec39acd9ab060c51b21eeae99f300c36ed01eba75c8811c369680  main/src/utils/resolvedWorldGenerator.ts
54aaf17805f1f9e3aa1ed4bd93ceb69621ca3689448c4a210215dfd528239c67  main/src/story/world/storyWorldIdentity.ts
8fef6de812a8040e3291c715e6656ef3b6f8642e35f84822bf739cf8ff5efbaa  main/src/utils/treeProfile.ts
```
