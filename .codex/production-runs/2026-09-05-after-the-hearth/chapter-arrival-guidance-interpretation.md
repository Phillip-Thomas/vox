# Origin arrival guidance — Chapter interpretation

**The boarding regression is a wiring defect; completing the repair also needs a narrow exact-copy amendment.** The on-foot arrival segment already exists in signed scene-v2 `4dbf722b308b92b170313285854e3c9c2abac853b3407bf3e0f4efccfddff88e`. No additional objective, beat, anchor, plot or player verb is needed.

Telemetry rows 167–275 in `logs/handoff-standby-verifier/flight-1/telemetry.jsonl` show 109 Origin surface/fps samples with `ch13:return:board`, from 44,980 to 73,507ms, while the movie walks. Row 276 reaches `ch13-survey` and `origin-landed` at 73,791ms. `verifier/captures/handoff-standby/flight-1/run.json` identifies a headed hardware diagnostic with a direct-entry prerequisite fixture and scripted input; it is not full journey or independent UX acceptance. The movie's progress does not make the boarding instruction correct for a manual player.

The existing owner is `ch13:return:origin`, kind `travel`, marker **Origin · audit site**, from `anc.cg.lift-committed` through `anc.cg.origin-landed`. Its current exact work order is `Fly to Origin.` / `Follow the audit-site approach and land.` The arrival event already requires **land, disembark and approach W-7744 on foot**, with survey entry at real physical reach (`scene-contract.json#/story/events/6` and matching sync anchor). Re-selecting boarding after the actual Origin landing contradicts that requirement.

Simply retaining the correct ID does not finish the UX repair: its exact copy and acceptance currently require a flight verb in every state. That is not actionable once the player is walking. The UX rule requires current-action agreement and reset reconstruction (`main/src/story/ux/README.md:74–85`). Propose these exact conditional variants under the same return objective and marker:

| Actual state | Standing work order |
|---|---|
| Airborne, travelling or descending before grounded Origin | Fly to Origin. Follow the audit-site approach and land. |
| Grounded Origin, still using boarded flight controls | Disembark. Follow the audit-site marker on foot. |
| Grounded Origin, embodied/on foot, not yet at W | Follow the audit-site marker on foot. |

Keep existing departure boarding/lift semantics where actually required; do not derive a fresh mandatory departure merely from Origin's fps handback. Existing controls own disembarkation; this adds no key or F task. Keep one real audit-site destination through the handoff and on-foot approach. Landing/world activation alone never earns `origin-landed`; actual grounded, embodied W reach clears this objective and hands over to actual survey state. Phase-copy changes are silent within the ID; Continue reconstructs the same real next action. Optional ship boarding remains available where physically valid.

The JSON companion contains asserted proposed changes to `/guidance/objectives/4/{variantIntent,acceptanceCriterion,feedback/intent}`, `/story/events/6/acceptanceCriterion` and its matching sync anchor, plus the return agency wording and mirrored Cinema/intent lifecycle. Canonical flight copy, objective ID/label/kind, entry/clear anchors and physical milestone stay unchanged. This is reviewable proposed language for peer concurrence/signature under standing delegation, **not a source edit or seventh repair authorization**. Actual manual guidance, raw lifecycle/input/marker parity and Continue evidence remain required.
