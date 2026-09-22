# Score interpretation — home-anchor eligibility

**Later eligible home anchors must remain usable on Continue or a valid deep link while the ineligible live install acknowledgement stays silent.** Suppressing the entire home-anchor sequence is not an interpretation of the signed hydration rule. This is a bounded interpretation of scene-v2, not a new direction, independent runtime acceptance or authorization to fabricate receipts.

Contract: `scene-contract.json`, SHA-256 **`4dbf722b308b92b170313285854e3c9c2abac853b3407bf3e0f4efccfddff88e`**. Reviewed `verifier-findings.json#VF-ANCHOR-OBS-1`, its home/survey summary artifacts, and the requested source owners.

## Binding clauses

- `/syncAnchors/0` (`anc.cg.cell-installed`) requires the **actual live install receipt**, one consumed cell and at most one acknowledgement when a home score host is available. Its acceptance explicitly says a hydrated entry is steady and silent, consuming no second cell. `/score/cues/0` likewise permits no completion transient on restore and no listening gate.
- `/syncAnchors/1` (`anc.cg.home-steady`) explicitly restores the steady home variant on hydrated entry, without a completion transient or queued acknowledgement. Its real departed/restored receipts, on-foot Tidegarden and actual-core conditions remain required.
- `/guidance/objectives/0` enters at home-steady and states that **a restored save reaches the review objective without replaying the transaction**. Its entry feedback is silent on hydration. The invitation therefore remains functional independently of fresh install presentation.
- `/syncAnchors/2` and `/syncAnchors/3` bind fault-reviewed to the actual core interaction and return-chosen to the explicit F commit. The latter releases the home quotation; fault review does not change it. `/guidance/objectives/1` preserves that voluntary choice. None of these clauses requires another installation.

## Required invariant and evidence distinction

Eligibility, actual activation and audible acknowledgement are distinct. A restored transaction must not be represented as a fresh installation to satisfy ordering. Equally, its ineligible live acknowledgement must not become a permanently pending prerequisite for silent steady entry or subsequent real F actions. Already-earned review/choice state restores without falsely replaying its action; a new eligible interaction retains its signed anchor. No missing receipt, core, actor/world condition or player action may be supplied by this interpretation. Return-chosen still releases home score through the existing authority; travel remains with the world conductor.

The verifier's summaries support an observed separation: the home run reached real review/return progression with an empty home anchor ledger, while the survey run recorded repeated-measure. The home loop stopped at the return-beat predicate at 2777 ms; its later hatch anchor is a separate capture-window issue. Those observations do not justify VF-ANCHOR-OBS-1's conclusion that **all four** home anchors should be observable only during a continuous journey. Only the fresh install event requires that live boundary. The evidence does not itself prove an audible failure: local score dispatch can continue despite rejected AV activation, and no listening occurred here.

Source risk: `noteAnchor` records its local once-latch before calling AV activation and does not consume its returned success value. `activateAnchor` rejects later anchors while an earlier required same-beat anchor remains pending. `enterCommonGroundBeat` requests home-steady on entry, while `tickCommonGroundEntry` calls reactivation before requesting cell-installed. If entry callbacks run before that latter request, the live path can also reject and locally spend home-steady before installation activates. This is an entry-order/latch risk requiring continuous-path evidence, **not an observed continuous-journey failure**.

## Amendment disposition

**No creative contract amendment is required for a bounded eligibility/wiring correction that enforces these existing clauses.** Preserve real event causality, silent restoration, one live install acknowledgement, subsequent actual anchors and existing release behavior. This interpretation prescribes no code and does not waive unrelated anchor ordering, receipt or production-boundary requirements. It neither closes the verifier finding nor establishes implementation success.

Inspected source SHA-256: `commonGroundDirector.ts` `deea059b75dde9bc627ca040a4ccac71d260e0cea9fc3459fe0dd074cce3dec4`; `signedSceneAvRuntime.ts` `01d59a2a44908857fa02e6d9b9849c539a7bbfa74580a7cd724659198e3a9184`. The inspected findings snapshot was `32a46bd46675d78c48546db94e8718dc3fb372cbb928a07df1662272f9fc0283`; the verifier remains active. No source, contract or signature was edited; no new probe, render or listening claim.
