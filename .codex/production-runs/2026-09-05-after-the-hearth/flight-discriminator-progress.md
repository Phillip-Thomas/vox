# flight-discriminator — progress

Role opened 2026-09-06T15:11Z, closed 2026-09-06T15:19Z. Transport well inside
the 20-minute bound including source preparation.

| step | at (UTC) | result |
|---|---|---|
| read control + CLAUDE.md, source audit, earned-2 summary/snapshot | 15:11–15:14 | scoped |
| read shipped window bridges to fix field semantics | 15:13–15:14 | `__paravoxiaJourneyProbe.snapshot().state.systemFlight/spaceFlight` carries pose/velocity/target/activePlanetId/locationMode/activationEpoch; assist `ready`, `targetReady`, flight directive NOT on window |
| preview identity recheck | 15:13:26Z | index `ca7b448b…dedc71`, `<title>Paravoxia</title>`, 200 |
| 98-file manifest rehash BEFORE | 15:14:00.818Z | 98/98 match |
| wrote probe (own folder, no game source touched) | 15:14–15:15 | `verifier/probes/flight-discriminator/flight-discriminator-probe.mjs` |
| heavy lock acquired (flock exclusive, -w 600) | 15:15:20.017Z | uncontended |
| capture 1 of 2 authorized — 90 126 ms, 340 samples @250 ms, streamed live | 15:15:20–15:16:52 | headed ANGLE NVIDIA GB10 |
| owned browser stopped; root preview untouched | 15:16:52.486Z | cleanup `{stopped:true, invoked:true}` |
| heavy lock released | 15:16:52.510Z | — |
| 98-file manifest rehash AFTER | 15:18:30.772Z | 98/98 match, aggregate identical to before |
| preview identity recheck AFTER | 15:18:30Z | unchanged, daemon 1290230 alive |
| report written | 15:19Z | `flight-discriminator-report.{json,md}` |

Second capture NOT taken: no new demonstrated measurement issue arose, and the
first capture produced a decisive discriminator inside two full cycles.

Discriminator: two complete 37.21 s cycles. The crossing is flown (centre
distance 2 736.8 → 169.09, peak speed 102.84, ready-corridor clamp fitting
55.00 exactly at the 185 shell), then in one sub-260 ms boundary the pose is
replaced by the departure boarding pad, `activationEpoch` advances by two,
`locationMode` → `atmosphere`, `target` → null, and `activePlanetId` stays
`-1,-1:p1` in 340/340 samples. Source candidates A, B, C and the earlier
marker CLOSING heuristic are refuted; the same-system planet handoff is
implicated. Intermediate epoch state remains unsampled and unknown.

Owned and written by this role only: `verifier/probes/flight-discriminator/`,
`verifier/captures/flight-discriminator/`, `logs/flight-discriminator/`,
`flight-discriminator-report.{json,md}`, this file. Existing/shared probes were
read-only. No game/contract/build/defect edits, no full verify, no creative
acceptance. The concurrent manual-focused role's lanes were not entered.
