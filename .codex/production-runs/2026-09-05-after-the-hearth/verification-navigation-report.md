# Independent navigation-repair verification — Common Ground (ch13)

**Run** `2026-09-05-after-the-hearth` · **Role** independent story-verifier
(fresh continuation) · **Written** 2026-09-06T14:56:36Z (corrected from an erroneously future 14:58Z)

## VERDICT

**FAIL — two open blockers prevent chapter completion on this source.**

This verdict is about **measured gameplay reachability only**. It is not a
creative, taste, audio or hardware judgement, and it does **not** retract the two
repairs that genuinely landed. Publication is not authorized and no acceptance
is claimed.

## What this pass proves the repair DID fix

Two of the defects under repair are closed by measurement, not by inference.

**1. Terminal exact-goal navigation (CG-IMPL-010) — RESOLVED.**
On the pre-repair `d9e36ae3` source the survey physically started 4 samples and
then snapped ~0.75 short of off-grid goals at multiple turns. On this source the
same shipped rail walks the corners for real:

| measurement | value |
| --- | --- |
| walked path (3D) | **150.915 units** |
| walked path (horizontal) | **105.843 units** |
| net displacement | 68.533 units |
| **teleport nudges** | **0** |
| page errors | 0 |
| pose-source switches | 0 (resolved at 457 ms) |

Six consecutive signed anchors fire in order: `repeated-measure` (4.4 s) →
`demonstration-opened` (14.6 s) → `survey-started` (17.4 s) → `trace-drawn`
(25.2 s) → `route-offered` → `revision-ready`. Root independently observed the
same run at 42 samples / ~35.31 route units, `testedPrefix` 41. The original
off-grid regression does **not** reproduce.

**2. Destructive pre-hydration save (CG-IMPL-011 / CG-IMPL-008) — RESOLVED.**
Pre-repair run-4 showed a 1186-byte 4-sample Origin drawing overwritten by a
606-byte idle save after Continue. On this source, with the real landing
Continue button clicked, storage retained and no deep link:

| stage | key `pvx.v1.world.-1,-1` | sha256 | survey |
| --- | --- | --- | --- |
| before navigation | 616 B (placeholder) | — | — |
| after `beforeunload → doSave` | **1305 B** | `5252dfd7…f514` | `drawing`, 5 samples |
| **after Continue** | **1305 B** | **`5252dfd7…f514`** | **`drawing`, 5 samples** |

**Byte-identical.** Boot and menu cannot overwrite the original saved drawing
even with the incomplete old fixture. The samples carry real `walkedAt`
progression (0, 1.248, 1.739, 2.721, 3.457) — an actual unfinished drawing.

> **Scope discipline.** This is **incomplete-fixture data preservation only**.
> It is explicitly *not* a valid earned Continue success and must not be read
> as one.

## The two blockers

### VF-NAV-BLOCK-1 — `ch13-return` Origin approach never lands (NEW)

The signed ladder starts correctly: `anc.cg.hatch-boarded` at 2541 ms,
`anc.cg.lift-committed` at 4560 ms, then `ch13:return:origin`. The ship then
**genuinely flies** — this is not a stalled body — but it never lands.

Over 420 s and 412 marker-distance samples the approach is a closed loop with a
period of **~38.4 s**, repeated **10 times**:

- minima at 41.1, 79.4, 117.7, 155.2, 193.5, 231.8, 269.2, 306.7, 344.2, 382.6 s — all **50–51 m** from the Origin audit site
- maxima at 78.4, 116.7, 154.1, 192.4, 230.8, 268.2, 305.5, 343.1, 381.5, 418.9 s — all **2515–2562 m**

Flight mode alternates `descent / flight` (54 samples) and `deep_space / flight`
(358). `story:ch13-origin-landed` never fires. No rescue, teleport or grant was
used.

> **Stall-predicate honesty.** This is deliberately *not* reported as a body
> stall. The body is correctly seated at `[9.75, 51.10, -8]` throughout while the
> **ship** moves ~2500 m per cycle. The discriminator used is the marker's own
> distance readout, never the body pose.
>
> **Correction to my own artifact.** `earned-2/summary.json` contains a naive
> field `flightDistanceTrend: "CLOSING"` (2730 m → 51 m). That compares only
> endpoints and hides the oscillation. **Do not quote it.** The per-sample
> profile above is the accurate statement.

This is the higher-order gate: it blocks the earned Continue, the continuous
ch13-return → ch13-survey sequence, the three cold journeys, and the full movie.

### VF-NAV-BLOCK-2 — `ch13-survey` never reaches `anc.cg.route-tested`

6 of 7 non-contingent anchors are reached, then the beat holds: player
`[-41.98, 52.79, 12.16]`, W-7744 `[-42, 51, 13.2]` (~1 m apart),
`auditWorker.walk 0`, `routeAction "direct"`, `stillTime 0`, and **both** player
and actor moved 0 units across a 150 s window.

Lifecycle detail: `ch13:survey:revise` activates at 44026 ms on
`anc.cg.revision-ready` and is replaced 217 ms later by `ch13:survey:test` — the
revise objective is cleared by the very anchor that raised it — while the
standing `test` copy asserts "W-7744 is testing the offered route" and W-7744's
walk is 0.

**Candidate, not a diagnosis:** root's pointer `commonGroundDirector.ts:1950`,
`CG_STANDBY_CLEAR_OF_E = E.z − 3 = z9`. The rail target is `[-42, 51.05, 9]`
while the body is at `z 12.16`, so the unmet request is a real *move* to the
standby cell — pointing at target footing/navigability there. I did not measure
that cell. **No predicate or clearance weakening is proposed.**

**Withdrawn:** I earlier framed "the rail never presses [F] Reopen" as the cause.
Root is right that this does not follow — standing-clear is a deliberate choice
to remove body obstruction. Retained only as an observation.

## Not a defect (retracted before filing)

I provisionally read the post-Continue world `-1,-1:p1` (seed 1600321158) with
objective "Kestrel hatch · board" as a world-selection defect. Checking
`scene-contract.json` **before** filing shows `ch13:return:board` is an authored
objective with exactly that marker label and work order. The old fixture seeds
`ch13-fault-reviewed` and `ch13-return-chosen` but not `ch13-origin-landed`, so
resuming `ch13-return` is the **lawful** ladder answer; GlobalSave
`lastPlanetWorldId` correctly reads `-1,-1`. No defect was filed. Root's 14:22Z
correction independently agrees.

## Gates and identity

| gate | result |
| --- | --- |
| engineer receipts (repair, closure, wording) | all 3 `finishedAt`, exit 0, `isError: false` |
| `scene-contract.json` sha256 | `4dbf722b…f88e` — recomputed, MATCH |
| source manifest sha256 | `1a50c19f…a61e8` — recomputed, MATCH |
| 98 source files rehashed | 98/98 MATCH, 0 mismatched |
| independent `npm run verify` | **exit 0**, 350 files / **3139 tests**, 62 s |
| offline probe self-test | **actual node exit 0**, 25/25 + 41/41 |
| preview identity (38803) | title + index + all 4 bundles byte-match my own build |

Build-hash note: the shipped manifest hash `2471402d…` (JSON filemap) and my
auxiliary `9c7d99d7…` (codepoint-sorted path/NUL/sha/newline) are **different
algorithms over the same bytes — not drift**. Port 40131 (`d9e36ae3`) was never
measured and never stopped.

## Coverage actually achieved

| item | observed | total |
| --- | --- | --- |
| objectives | **8** | 17 |
| anchors | **8** | 28 |
| marker-label parity mismatches | **0** | — |
| objective visual defects (blank/pop/wrong-era/missing HUD) | **0** | — |

Every observed marker label matched its signed label exactly, including
on-screen `W-7744 · offered route · 1m` and `origin · audit site · 435m`.

## Explicit non-claims and limitations

- **No hearing claim of any kind.** No audio was heard; no live cue-sync was
  measured; no offline WAV mux was used or relied on.
- **No FPS or hardware budget figure** — none was measured. Source constants are
  not budget measurements.
- **No taste, beauty or pacing judgement** anywhere.
- **Quit-to-Menu remains UNEXERCISED**: Pause was again not clickable normally
  (8 s intercept) and responded only to a forced dispatch, which is diagnostic
  and never counted as player acceptance.
- **Unmeasured, not failed**: manual early-corner recovery, three cold journeys,
  station-departure → home → ch13 → final, full story movie, 9 objectives and 20
  anchors, mobile / reduced-motion / lowest-tier parity, cold high+low budgets,
  all scene-v2 audio conditions, and the reset matrix.
- **Neither blocker is diagnosed.** No root cause is claimed for either.
- Continuous decodable video was **not** produced this pass; percept coverage is
  survey-only (58 raw vs 50 percept frames — not a 1:1 pairing).

## Process compliance

0 game-source / contract / creative edits · 0 publications · 0 previews started
by me · root preview never stopped · 0 timeout rescues, grants, teleports or
endpoint-credit hacks · 0 forged signatures, scores or acceptance · 0 other lock
owners bypassed (I queued ~16 min behind an unrelated Paraform job rather than
displacing it, and never killed it) · every capture carries a post-finally
cleanup receipt with `sessionStopped: true` · all failed captures (run-1..4,
earned-1, earned-2) preserved · probe sources snapshotted before execution.

**Self-reported harness faults** (a helper error is not a game failure): run-5
Phase 4a walked to the wrong world's target; my claim that the parent probe
"already implements the earned return path" was wrong; my first self-test exit
code was `tail`'s, not node's; `earned-2/failure.json` carries the parent probe's
name. Each is recorded in `verifier-findings.json` with exactly what it
invalidates — collectively, one leg of run-5 and two written statements, no
measurement above.

## Artifacts

- `verification-navigation-report.json` — machine-readable form of this report
- `verifier-findings.json` — resolved / open / not-defects / harness errors
- `evidence-registry.json` — every artifact with real sha256 and byte count
- `verifier-navigation-progress.md` — phase-by-phase log incl. corrections
- captures: `verifier/captures/navigation/survey-movie-1`,
  `verifier/captures/partial-continue/run-5`, `.../earned-1`, `.../earned-2`
- new probe: `verifier/probes/partial-continue-earned/earned-return-continue-probe.mjs`
  (sha256 `a9fefa6b…20ae`)
