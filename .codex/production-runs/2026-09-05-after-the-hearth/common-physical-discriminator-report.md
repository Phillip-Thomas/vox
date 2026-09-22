# common-physical-discriminator report

- verdict: **COMMON-CREDIT-CALLEE-ENTERED**
- written 2026-09-06T20:17:16.536859+00:00; started 19:59:37Z; actual deadline 20:19:37Z
- browser run: True; headed=True; renderer=ANGLE (NVIDIA Corporation, NVIDIA GB10/PCIe, OpenGL 4.5.0)
- prerequisite (SHORT held-reference) verdict: SHORT-HELD-REFERENCE-PROVEN

## Approach to E (ordinary keys, avoiding H)
- route: S -> (-26,22) -> (-42,22) -> E(-42,12) [reversed qualified LONG tail]; avoidedH=False
  - approach-S reached=True d=0.46931704838428023 distToH=13.993113649060176 supported=True
  - approach-N reached=True d=0.5416098270934202 distToH=16.88348620831543 supported=True
  - approach-W22 reached=True d=0.8039681341512538 distToH=9.560707711004758 supported=True
  - approach-E reached=True d=0.69070112866246 distToH=1.434849141271789 supported=True
- atE: {"pose": {"foot": [-41.39181373859077, 50.988984337742814, 12.3487786909752], "bodyCentre": [-41.40382766723633, 52.788944244384766, 12.34877872467041], "up": [-0.0066744048030896765, 0.9999777259121946, 1.8719561665473904e-08], "supported": true, "groundOffsetUnits": 1.8}, "common": {"beat": "ch13-common", "common": {"stage": "holding-h", "terraUnits": 0, "comparisonProved": false, "finalReferenceOffered": false, "finalReferenceOccupied": false, "workerUnits": 0, "committed": false}, "worker": {"leg": "holding-h", "travelled": 0, "legLength": 0, "held": false, "sampledIndex": 0, "permitted": 

## Vertices 1-4
- v1 target=[-42, 51.05, 14] crossed=True finalS=0.08885185628253289 supported=True pulses=1 terraAfter=0
- v2 target=[-42, 51.05, 16] crossed=True finalS=0.07495672036789358 supported=True pulses=1 terraAfter=0
- v3 target=[-44, 51.05, 16] crossed=True finalS=0.10623397724119599 supported=True pulses=2 terraAfter=0
- v4 target=[-44, 51.05, 18] crossed=True finalS=0.05989033129305099 supported=True pulses=1 terraAfter=0

## Credit records
- {"count": 292, "dropped": 0, "calleeCalls": 146, "callerGuards": 146, "pairing": {"calleeMinusCaller": 0, "note": "ACTUAL callee entry implies the walked/support + reference guard passed. An ABSENT call does NOT identify which guard failed."}}
- analysis: {"calleeEntered": true, "positiveDisplacementCalls": 138, "lastObservedPrev": 0, "finalCallReturn": "MISSING-final-call (never interpolated)", "totalActualGain": 0, "refusedByCeilingCount": 138, "plateauAtSix": false, "numericGapToRouteUnits": 18, "zeroGainLabel": "QUALIFIED: an observed arcGain of 0 is an ACCOUNTING OBSERVATION, not a proven ceiling cause. Causality is claimed ONLY from the actual function replay below.", "causalStatement": null}
- clearance: {"bodyBodyClearanceInCreditChain": false, "note": "Body-body clearance is ABSENT from the pwe/Kme credit chain. Measured separately below; never fabricated as true.", "measuredSeparately": {"atFinalPose": {"foot": [-44.10467332458568, 50.98909779380975, 18.05989033129305], "bodyCentre": [-44.144798278808594, 52.78865051269531, 18.059890747070312], "up": [-0.022291641234949446, 0.9997515104919816, 

## Artifacts
- probe: verifier/probes/common-physical-discriminator/common-physical-discriminator-probe.mjs
- logs: verifier/logs/common-physical-discriminator/
- captures: verifier/captures/common-physical-discriminator/

## Causal result
- callee ENTERED 146x, caller guard 146x, paired 1:1, 0 dropped -> the walked/support + reference guards ACTUALLY PASSED.
- 138 calls carried positive ACTUAL displacement; credited terraUnits stayed **0** across vertices 1-4.
- REAL function replay (instrumentation removed, Debugger disabled, frozen captured args): 138/138 positive-displacement calls returned gainOnReplay **0**, maxReplayGain 0.
- Numeric gap: credited 0 of 18 route units.
- Body-body clearance is ABSENT from this credit chain; measured separately, never fabricated as true.
- Caveat: instrumentation deopt changes frame distribution; recorded deltas are still actual.
