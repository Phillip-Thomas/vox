# Corner candidate disposition — Chapter

**CG-IMPL-009: object to the inspected candidate. Implementation correction is required; a compliant correction needs no contract amendment.**

Contract: scene-v2 `4dbf722b308b92b170313285854e3c9c2abac853b3407bf3e0f4efccfddff88e`. Inspected `main/src/story/commonGroundRoute.ts` SHA256 `d7e5bbc38e2ea321c18db1366cc6a8dbcd2806029fc670b1a82bd825ac8d813a`, `routeProgressUnits:489–536`, allowance at451.

The formula accepts any positive movement near a later arc when the remaining lag is at most 0.6. At C with 17.6915 credited, lateral x movement between -48 and-48.075 leaves the nearest route arc at 18 and pays the remaining 0.3085, without revisiting the omitted corner. Returning to C then also satisfies endpoint arrival. This is a **static source counterexample**, not a browser measurement.

The candidate recovery test does not repair that omission: `commonGroundRoute.test.ts:345–356` goes from C(z12) back to z12.4 and returns to C, expecting completion because total movement exceeds 18. It visits only the final leg, never the earlier cut near(-42,16). Its assertion checks distance payment rather than the required spatial passage; rejecting large skips and distant loops does not resolve this small-lag case. No test was run in this interpretation.

Ordinary recovery returns to and actually traverses unfinished eligible route while retaining valid earned progress. Endpoint movement or a later-leg loop cannot replace that traversal. Preserve ordered full actual 18, maintained reference, support, solid sight, body clearance, physical arrival and valid Continue. The signed basis is `scene-contract.json#/guidance/objectives/13/acceptanceCriterion`, `#/story/agencyWindows/3/{mandatoryPath,fallbackSemantics,rescueSemantics}`, and `#/story/events/21/acceptanceCriterion` with its matching sync anchor.

This follows `chapter-manual-corner-interpretation.md` and `producer-manual-corner-risk.json`. Root assigned CG-IMPL-009 (high, implementation-fidelity) and owns implementation routing. Correcting the formula within those existing requirements needs no amendment. Accepting debt payment for omitted ground would change the signed proof meaning and is not approved here. No new fields, rules, copy or patch are prescribed; independent manual/Continue acceptance remains pending. Exact structured evidence is in `chapter-corner-candidate-disposition.json`.

Correction may withdraw the allowance if the original honest return-to-frontier behavior already satisfies intent. The original manual risk was conditional; it never required a change to valid behavior, automatic credit for rounded cuts or any particular algorithm. At write time the integrator had advanced the source to `6025bc4c55098bb3bffc54dd04134fa3b666ef71361e22bba1a9b3fad7a1f1ff`; this disposition assesses only the inspected `d7e5bbc3…` bytes.
