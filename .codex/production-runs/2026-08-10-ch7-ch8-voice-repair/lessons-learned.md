# Lessons learned — 2026-08-10 ch7/ch8 voice repair

Written by the orchestrator at closeout. Everything here is actionable by a
future production team without access to this run's conversation.

## What this run was

Scene-mode triad run implementing the 2026-07-28 story-enjoyability design
run's ch7/ch8 repair treatment: 21 new strings + 1 owner-approved changed
string, two bounded timing holds, zero camera/score/objective mutation.
Five contract revisions (draft-v2 … draft-v5 with seven compile corrections),
three repair loops (the profile maximum), four verification iterations plus a
discharge measurement and a closing pass, five independent reviews, a critic
moderation, and a cohesion judgement. First run in the repo to pass the
contract-phase gate with real (non-template) content, including 38/38
signoffs, and the first to fill `critic-report.md` at all.

## Reusable lessons (process / workflow learning)

1. **Directors reading specs as implementers is the only defense against
   executable contradictions.** Three consecutive compile corrections were
   texts a verifier would obey against the run's own interest (a trace
   assertion that failed a correct implementation; capture instructions
   demanding frames a ruled law made impossible; offsets timed from an origin
   a ruling could move). The deterministic gate validates structure and
   reference resolution; it cannot detect an unreachable demanded frame. Make
   the implementer's read of capture/trace text an explicit pre-signature step.

2. **Every capture offset must name its origin symbol, not a prose noun.**
   The sites that survived two sweeps all said "cadence +N" or "receipt +N"
   instead of naming `t_M7Anchor`. Symbolic origins make staleness greppable.

3. **Sequence signatures: verifying director first, peers after.** Dispatching
   all three signers against bytes the ruling director had not yet verified
   cost two full stale-signature cycles. The withhold-and-report protocol
   worked every time it fired (four withholds, four real defects); design the
   loop so it fires before peers spend signatures.

4. **Verify contract claims against the shipped runtime, not prior contract
   captures.** Two mis-bound cue rows (a nonexistent cueRef; a ch6 anchor
   bound to a ch7 cue) survived four signature cycles because every check
   diffed the new revision against the previous one. The fix that sticks:
   a mechanical resolver check in the contract itself
   (`check.avruntime-ref-resolution`) plus the Score Director's standing rule
   (V5-A) to sweep against `generatedSceneAvRuntime.json` at every signing.

5. **Baselines of files a run is authorized to mutate belong in
   `excludedSourceFiles` with shipped hashes preserved** (ruling R5) — the
   gate re-verifies baseline hashes every phase while requiring a non-empty
   diff, which is otherwise unsatisfiable.

6. **Signed AV anchors are not caption triggers.** `anc.launch.ignition` /
   `anc.launch.liftoff` activate at (or one tick after) beat entry, not at
   the physical moments their names suggest. Any latch keyed to them is
   either swallowed by resume-seeding or fires into a slot collision (vd-01).
   Bind captions to durable gameplay facts and paced ladders; keep signed
   anchors for score/shot conduction.

7. **Reveal arithmetic is a contract subject.** The single caption slot at
   34 ms/char means every line needs `revealSeconds(line)` of protected
   screen time; derive it from the frozen string at runtime (never hardcode)
   so copy edits can't outrun their guards. ch8 got slot constants at design
   time; ch7 didn't and shipped six mid-word cuts (ux-01) that cost a floor
   breach in the judgement.

8. **Measured physics beats authored intent — flag-backs work.** Criterion
   [21]'s own 0.3 s floor fired (vd-04): two full reveals cannot fit in 3.8 s
   of post-edge air, and no offset arithmetic fixes that. The honest repair
   was re-scoping the canonical route (ordered-ignition: order-then-act),
   not another formula. Write acceptance criteria so they can flag themselves
   back; do not let a composed inference discharge a measured-margin
   condition (Cinematography's CC1 discipline).

9. **A run's record is part of its quality.** The reviews' worst findings
   were record defects: a mobile "pass" contradicted by the run's own frames,
   evidence bound to superseded hashes, sidecars biased by
   screenshot-before-state-read, a blank-frame scan whose method could not
   see the frames it cleared. The critic-moderation pass (first ever filled)
   caught a repeat of the same failure mode inside an auditor's own
   correction (MOD-02). Method claims need method audits.

10. **Session limits and restarts are real.** Three agent transcripts were
    lost mid-run (respawned from durable artifacts — the reason every ruling
    goes to disk immediately), and one patch was killed by a session limit
    mid-test-write (resumed cleanly by auditing the working tree first).
    Durable, self-contained artifacts are what make the run resumable.

## Craft learning (creative lessons)

- The blind viewer's verdict — "beautifully written, not yet shown" — is the
  run's true epitaph and the owner-facing case for both routed packets. The
  copy's best moments (`CONTACT LOGGED.`, the two-voice band system, the
  consent beat at ignition) landed with a context-free viewer on first
  contact; the image support for the tree line and the exit line did not.
- The bracket-fall device is not player-legible while the parenthetical
  regression persists on both sides of ch7 (F2). Copy-correct ≠
  player-visible; reveal-ledger levels must be argued from the player's
  actual experienced sequence.
- Dramaturgical rulings that also solve mechanical problems are the ones that
  survive: order-then-act (the ordered-ignition route), the ship-reports-you
  device, the drop rule as authored degradation. Contrivances that only solve
  mechanics get flagged by someone eventually.

## Next-run guidance (standing state at closeout)

- Contract draft-v5 `36a7cb4f…`, tri-signed; contract-phase gate at exactly
  one failure (accepted R3, protected pre-existing `chapter-journey-contract`
  schema drift); final-phase repair simulation 0.
- Best-reachable disposition: **ready-for-human-taste** (headed-evidence gate
  ux-05 open; two owner taste questions; two routed packets; one unrepaired
  high outside the lock (CIN-01 mobile collision) awaiting the owner's taste
  answer on scrim-vs-unplated-ink).
- Escalated follow-on train (owner-visible): ch5/ch6/ch9 + ch7-board/
  ch8-crossing parenthetical de-bracketing (R1, F2 raised its priority, F3
  seam content collision), vd-02 landfall movie stall, vd-03 POTATO climb
  skip, dissent-06 bench_online double-action, F5 relay retitle option,
  ux-10 live-region strategy, sa-04's calibration-length unit test, CIN-07
  POTATO focal parity, R3 journey-contract schema repair.
