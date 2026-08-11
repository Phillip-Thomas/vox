# Run summary — 2026-08-10 ch7/ch8 voice repair

## Disposition

**ready-for-human-taste** (scene-cohesion-judge, final judgement post-loop-3).
Weighted 4.66 (fixture rubric) / 4.62 (judge's seven-category read) against the
4.75 autonomous-approval bar; category floor 4.35 ≥ 4.30 — the loop-1 floor
breach is cleared. Open highs: CIN-01 (mobile portrait caption/control
collision — measured fail, fix outside the lock, owner-routed with taste
question 2) and ux-14 (pre-existing `bench_online` marker gap, judge-accepted
exception, follow-on commissioned). Zero unaccepted protected-category
mediums. Loop budget (3) exhausted; every remaining blocker is constitutionally
the owner's. Publishing was never in scope; release surface stays `ch4-arrival`.

## What changed

- **Contract**: `scene-contract.json` draft-v5, SHA
  `36a7cb4f2bf9cc8d24d2413579225dcb50a4436b37a20fb762d79fec6cb4ecdb`,
  tri-signed approve-with-notes; lineage draft-v2 → v3 (vd-01 paced ladder) →
  v4 (vd-04 ordered-ignition canonical route) → v5 (loop-3 laws), with seven
  compile corrections driven by four director signature-withholds.
- **Runtime** (uncommitted, in `main/src/story/`): `emergentStoryDirector.ts`
  carries the 21 new frozen strings + the owner-approved exit-line change
  (`the scar remains. now it can carry me.`), the ch7 stage-caption queue guard
  (reveal+0.4 s, M6 may-not-drop, `t_M7Anchor`), the l2DueAt reveal guard
  (`timer|edge|reveal-guard` cause taxonomy), the ch8 held exit-window clock,
  the D9 5.0 s ch7 exit hold, the ~17 s ch8 exit window ending in
  `CONTACT LOGGED.`, and `getEmergentStoryVoiceDiag()`. Tests: 568 story tests
  green (was 558 at baseline); new `storyText.test.ts` proves the retired
  string is gone from the built client.
- **No** camera, score, audio, objective, marker, registry, or persistence
  mutation — verified per phase; protected paths clean at `03e975a`.

## Evidence

- 6 verification iterations (baseline, iteration-1 full proof, repair
  re-verification, CC1 discharge, closing pass, final-phase repair):
  `verification-report.json`, `check-results.json`, `iteration-ledger.jsonl`.
- ~4,700 captured frames + traces under `evidence/` (harness frame strips are
  gitignored; digests preserved in `evidence-registry.json`, 122 entries, all
  hashes recomputed clean); genuine A/V capture
  `evidence/verification-final/video/ch8-launch-window-av.webm`; eight ch7
  variant audition WAVs + four ch8 window WAVs for the owner.
- Key measurements: exit-window cadence within ±0.098 s over 15+ cold runs;
  CC1 margins 1.850–1.863 s vs the 0.3 s floor; held-clock drift 0.0000 s
  across a 10.9 s physical dip; ch7 screen-life ≥ reveal+0.4 s on every fired
  line; FPS medians 60.04–60.10 vs baseline 60.08–60.12; tier shot parity
  measured and passing.
- Reviews: five independent first-wave reports + two delta re-audits + critic
  moderation (six attestations PASS) + two cohesion judgements. All committed
  in this folder.

## Quality

Final scorecard: `final-scorecard.json` (`paravoxia.creativeScorecard.v1`,
ten categories, weighted 4.66, floor 4.35, decision ready-for-human-taste).
Gate states: contract phase 1 failure (accepted R3), implementation phase 1
failure (accepted R3); final phase converging — remaining items are the
compiler's register/ledger reshape plus the five honest irreducibles recorded
in `check-results.json#closingVerification.finalPhaseGateRepair`. The
preserved-dissent register (ten entries) ships un-averaged.

## Resume point

For the next session or the owner:

1. **Owner queue** — `human-decision.json` `remainingGates` enumerates it:
   two taste questions, two packets (dissent-01 score authority; dissent-02/C6
   camera+pacing), the CIN-01 scope decision, the ux-14 follow-on, the R1
   de-bracketing option, and one headed session (ch7 bench at player pace,
   on-foot reboard `[F]`, the dive window, the bench_online gap) or a recorded
   scoped exception. Owner-facing case: `cohesion-judge.md` §7 + the naive
   viewer's verdict.
2. **Pre-handoff text fixes** (no loop needed): CIN-14(b)/(c), the
   dissent-register L1→drop→L4 note, CIN-15's exemplar correction, the ux-04
   residual re-pointing, the one-word "held retained" canon repair at the next
   contract touch.
3. **Escalated follow-on train**: ch5/ch6/ch9 (+ ch7-board/ch8-crossing)
   de-bracketing (F2 raised priority, F3 seam collision), dissent-06 + ux-14,
   vd-02 landfall stall, vd-03 POTATO climb skip, F5 relay retitle option,
   ux-10 live regions, sa-04's unit test, CIN-07 POTATO focal parity, R3
   journey-contract schema repair.
4. **Nothing is committed to git yet** — the working tree holds the runtime
   patch, the run folder, and the design-run annotations; commit is a separate
   decision after the owner's review. Dev preview lives on port 5176
   (never 5173/5174 — sibling project).
