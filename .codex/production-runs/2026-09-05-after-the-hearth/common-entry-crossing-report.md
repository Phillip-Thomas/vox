# common-entry-crossing — corrected E entry and earned prefix

**VERDICT: CORRECTED-ENTRY-AND-EARNED-PREFIX-OBSERVED; credit plateaus at exactly 6.000000 — dependent passage claims halted.**
Not acceptance. No source mutation. Probe exit 0, 68s, inside the 20-minute cap.

## What the bounded discriminator answered
Run2 could not distinguish a refused skipped prefix from post-corner debt: it began
0.3488 **beyond** E and 0.6082 laterally off route, with all 146 replays returning 0.
This run supplies the actually walked prefix.

| entry measure | run2 (defective) | this run |
|---|---|---|
| foot z vs E plane 12 | 12.3488 (**0.3488 past**) | 11.5453 (**0.4547 before**) |
| lateral off route x -42 | 0.6082 | **0.0508** (bound 0.18) |
| supported | true | true |
| armed before crossing | no | **yes** |
| callee records across crossing | n/a | 3 -> 37 |
| credit | **all zero** | **0.080645 -> 6.000000, monotonic** |

Forward crossing observed: foot 11.5453 -> 12.1402 across z=12, supported, ordinary
WASD only, >=30ms pulses, no pose write / forced F / rail.

## Vertices 1..4 — both bounds now enforced
The old gate checked along-leg overshoot + support only, which admitted the 0.608
lateral drift. Full horizontal distance to the vertex is now required as well.

| v | along-leg s | full horizontal | lateral off route | supported |
|---|---|---|---|---|
| 1 | 0.3094 | 0.3134 | 0.0497 | true |
| 2 | 0.1309 | 0.1398 | 0.0491 | true |
| 3 | 0.2743 | 0.3039 | 0.1309 | true |
| 4 | 0.1163 | 0.2965 | 0.2727 | true |

All positive, all <= 0.35 on both measures, all supported, real guard calls.

## Credit accounting
179 callee records, 146 with nonzero displacement. Credit rises with actual foot
displacement, then **freezes at exactly 6.000000 for the final 48 records** while
displacement continues (~0.0803 per record, foot advancing to z 16.1309 / x -44.1727).

Because the prefix was genuinely walked this time, the plateau can no longer be
explained as proper refusal of a skipped prefix. Per commission, dependent claims
stop here: the eligible following leg was continued only far enough to establish the
persistent accounting plateau, and that is **not** called a full passage.

Pure-function replay ran from a frozen pre-teardown copy with breakpoints off and
live growth 0; retained replay stays separate from the next call's returned value,
which remains unobserved. bodiesClear is absent from the credit chain. No zero-gain
ceiling causality is asserted without candidate projection and exact args.

## Not claimed
Full 18-unit passage, COMMON success, chapter acceptance, full UX claim.

## Artifacts
- `verifier/captures/common-entry-crossing/run1/` (summary.json, trace.ndjson, credit-records.raw/chained.json, credit-replay.json, PNGs incl. at-pre-E-grounded.png, after-E-crossing.png)
- `verifier/probes/common-entry-crossing/` (probe, run-once.sh, selftest OK)
- `logs/common-entry-crossing/` (inline-poll.log, launcher.log, probe.log)
- `common-entry-crossing-ready.json`, `common-entry-crossing-report.json`
