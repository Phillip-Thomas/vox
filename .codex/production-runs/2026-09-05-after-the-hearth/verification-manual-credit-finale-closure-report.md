# Verification — manual credit / finale CLOSURE
Role `story-verifier-manual-credit-finale-closure` · original deadline 2026-09-06T22:04:34Z

**VERDICT: PARTIAL.** Priority 1 PROVEN. Priority 2 negative PROVEN, its recovery FAILED and is retained unresolved. Priority 3 UNPERFORMED.

## Identity (rehashed live, before GPU)
| item | value | matches commission |
|---|---|---|
| served index sha256 | `a9b8803…353d8f` | yes |
| served bundle sha256 | `68c8be84…328b` | yes |
| on-disk bundle | identical to served | yes |
| live manifest (probe) | `8962a7b2…6962` | yes |
| scene contract | `5ef85a32…ec54`, scene-v3 frozen | unchanged |

Local `main/src` recomputation (988 files, relpath+bytes) = `ab98595c…6851`. This is a **different scheme and scope** from the producer 100-file manifest, so it is **not comparable** and is **not** a mismatch claim.

Exclusive GPU: inherited **fd 9 FLOCK/ADVISORY/WRITE**, inode 8397196, dev 259:2, **no contenders**, acquired per run and released after.

## Static gate — REUSED, NOT RERUN
`logs/manual-credit-finale-verifier/verify.log`, exit 0, 21:29:55→21:30:57Z: **352 test files, 3192 tests passed**, 13 audio-law PASS lines. `npm run verify` was not run again by any path.

## Priority 1 — FULL manual positive and reciprocal completion — **PROVEN**
Authoritative run: `verifier/captures/manual-credit-finale/full18-run8`.

All **9 ordered vertices** of the unchanged 18-unit route walked with ordinary ≥30 ms pulses, bounded positive overshoot, support verified. Terra credit trace (run7): 2.2526 → 4.0491 → 6.0750 → 8.2729 → 10.2980 → 12 → 14.1910 → 16.0945 → **18**.

| gate | result | measurement |
|---|---|---|
| Terra walked full 18 | PASS | terraUnits 18, 9/9 vertices |
| grounded supported arrival at T(-44,12) | PASS | horizontal 0.16598 (bound .35), vertical 0.11921, 3D closest 0.20435 |
| far reference offered by authored F | PASS | `ch13:common:offer-final-reference`, "F \| Offer this end" |
| worker reciprocal E→C reached 18 | PASS | common.workerUnits 18 |
| worker H→E 2 units UNCREDITED | PASS | settled at exactly 18, not 20 |
| both final anchors | PASS | `anc.cg.complete`, `anc.cg.handback` |
| committed + comparison proved | PASS | committed true, comparisonProved true, stage arrived |
| guidance clear / controls back | PASS | objectiveId null, prompts [] |

Horizontal .35 and vertical are recorded **separately** from the 3D closest approach — no silent rule change. Nothing was set, granted, nudged or rescued.

## Priority 2 — negative and physical recovery
**Negative: PROVEN.** After an ordinary early turn, the body walked the whole later/far route to C and credit stayed frozen: 2.0916 (run9) / 2.1703 (run10). The retained prefix was **not** paid by late walking or endpoint wiggle.

**Measured turn foot z = 14.0916 (run9) / 14.1703 (run10).** The commissioned **z≈15.82 turn was NOT achieved** — the turn occurred just after vertex 1 and skipped vertex 2 entirely, a *more severe* cut. **The 15.82 scenario is untested.** No value is labelled 15.82.

**Recovery: FAILED — retained, unresolved.**
- First causal trace `cut-run9` is **confounded**: recovery used coarse `walkTo(arrive 0.5)`, not a bounded plane crossing.
- Corrected `cut-run10` uses the *same* ordinary-pulse bounded crossing as the vertex loop. All 8 retraversal vertices `crossed=true`, `supported=true`, horizontal 0.175–0.317 (all ≤ .35) — and terraUnits stayed frozen at **2.1703337873440898 for every one of them**.
- No reset, no second grant, no rail used.

This is a measurement. Whether credit is *meant* to resume after an abandoned cut is a design question this role does not decide; it is **not** called a defect. The dependent claim "full 18 after recovery" is stopped.

## Priority 3 — **UNPERFORMED**
- **3 cold COMMON movie runs: NOT RUN.** 18/18, commit, both anchors, done, zero-rescue across 3 cold runs is **unmeasured**.
- **Finale window: NOT RUN.** Token eligibility/deadline/release, done/active, control/guidance, focus/visibility/pause/mute/context, the atomic rAF edge window, ≥3 s pre / 11.5 s post, audio/output capture and dense edge frames are **all unmeasured**.
- **No hearing or taste claim is made.** The prior 1.891 s recording lag is neither assumed away nor resolved.

## Also not performed
fps probes · screenshot-strip reading · reset matrix · continuity variants · guided-player lifecycle matrix · `creative:gate` · full station/restoration/chapter journeys · earned Continue · variants/performance · independent creative/UX acceptance.

**The chapter is NOT accepted by these tests.**

## Probe corrections (all in my own folder, snapshotted per attempt)
| run | correction |
|---|---|
| full18-run5 | ACTIVE_ROLE lacked `-closure`; refused before any browser launch |
| full18-run6 | pose sampled 460 ms after arrival at T (airborne, supported=false, vertical 4.209) → added settle wait that presses no key and writes no pose |
| full18-run7 | read credit from actor `c.worker` and guessed anchor names → corrected to `common.workerUnits` and observed `anc.cg.complete`/`anc.cg.handback` |
| cut-run9 | coarse recovery walk → bounded plane crossing in run10 |

## Preservation
Game source, contract, gates, profiles, old captures, archives and producer control/invocations **unmodified**. Nothing published. No new preview, no foreign process touched. Edits confined to `verifier/probes/manual-credit-finale/`.
