# Common Ground (ch13) — independent verification, INTERIM FAILURE CHECKPOINT

**This is not chapter verification.** It is not a scorecard, not acceptance and
not a publication decision. Machine-readable twin with every file hash:
`verification-world-interim-report.json`. Findings: `verifier-findings.json`.
Phase log: `verifier-progress.md`.

Written under root control `pause` (11:42:15Z), whose instruction is to
finalize, record, and end the invocation cleanly. That is the current state —
the earlier 11:32 pause is superseded and nothing is waiting.

## Verdict

**FAIL (interim).** The lifecycle repair genuinely fixed both blockers measured
on the previous source, and the chapter now reaches and *accepts* its first real
anchors on hardware. Two **new** blocking runtime defects stop it before a
single route sample is recorded, and the valid intermediate-Continue case root
asked for is still unproved — because the physical prerequisite for it cannot be
earned while blocker 1 stands.

## Identity — what was measured, on what

| | |
| --- | --- |
| contract | scene-v2 `4dbf722b…ff88e` |
| source manifest | `51b25376…02c3` — control, readiness and the manifest file all agree |
| independent source rehash | **96/96 identical, 0 missing**, re-checked again after the build |
| static gate | `npm --prefix main run verify` → **EXIT 0, 348 files, 3068 tests, build ok**, 61 s |
| preview | root-owned `http://127.0.0.1:45091/`, root exec session 89502 |
| identity recheck | `<title>Paravoxia</title>`; index **and** bundle `index-Bquz6XRz.js` are **byte-identical to my own build's `main/dist`**; the served bytes contain the new `__paravoxiaCommonGround` hook and the exact signed marker strings |
| renderer | ANGLE (NVIDIA GB10/PCIe, OpenGL 4.5.0) — **hardware, headed**, heavy lock taken with `flock -n` and released |

I started no server and own none. The old 43617 preview is stopped and no claim
here comes from it.

**The static gate is permission to measure, not acceptance.** Both blockers
below are invisible to all 3068 tests.

## What the repair actually fixed (measured, not read)

- **`?story=ch13-survey` now boots ON FOOT.** The rail walked the body ~60 units
  to the survey start and performed the shipped F resolver. No disembark
  fixture, no teleport, no grant.
- **The capsule-centre frame is reconciled.** The published diagnostic reports
  `bodyCentre` 52.7890 and grounded `bodyPose` 50.9890 — exactly 1.8 apart along
  the *live* up — and the body arrives 0.303 horizontal units from the authored
  S, inside the 0.35 arrive radius.
- **Signed anchors are being accepted again.** `anc.cg.repeated-measure` and
  `anc.cg.demonstration-opened` activated in order (sequence 1, 2), and
  `anc.cg.hatch-boarded` / `anc.cg.lift-committed` on `ch13-return`.
- **`ch13-home` plays**: review entered at 11 ms with the exact signed label and
  work order, performed through the shared resolver, choose-return followed, and
  the beat advanced at 2704 ms with 0 nudges and 0 page errors.

## Blocker 1 — VF3-FOOTING-1: the footing query and the body disagree by exactly one voxel cell

At S the shipped F resolver was performed **200 times**
(`story-ch13-survey-start`, `source: resolver-perform`, `performOutcome:
returned` every time). `survey.phase` never left `awaiting-start`, **zero**
samples were recorded, and the prompt stayed live with no explanation. The
chapter's own diagnostic reported `supported: false` in **1501 of 1555**
world-bound samples. The only other gate is `CG_POINT_REACH 2.0`, satisfied at
0.310.

A bounded diagnostic then measured *why*, using nothing but the published
diagnostic and the **shipped Space jump**, sampling `supported` as a function of
the body's own height at the audit site:

| voxel cell `cy` | feet y range | samples | supported = true |
| --- | --- | --- | --- |
| 25 (the cell the body stands on) | 50.989 – 51.908 | 13 | **0** |
| 26 (one cell up) | 52.123 – 54.047 | 59 | **59** |
| 27 | 54.083 – 54.212 | 14 | **0** |

`cy = round((feetY − 1.05) / 2)`, `VOXEL_SCALE = 2`; cell *k* spans world y
`[2k−1, 2k+1)`. A lift into cell 26 returning **true** requires `solid(26)` AND
`air(27)`. So the terrain model the footing query reads believes the ground's
top face at the audit site is **y = 53**, while the body physically stands with
its feet at **y = 50.99** — one whole voxel cell, 2 world units, lower. The
authored ch13 poses (51.05) match the **physical** surface, not the queried
model. At the landing area the two agree (standing feet 51.16–51.30, cell 25,
supported **true**), so the disagreement is **localised, not global**.

What is still inferred: an outside observer cannot separate "solid(25) is false"
from "solid(26) blocks the cell-above test", and cannot tell whether the gap
comes from `voxelSystem.hasVoxel` vs `generator.shouldVoxelExist`, from a
WorldSave/`isDeleted` gap, or from an audit-site clearing that exists in the
collider/render but not in the generator. **No cause is asserted, no rounding
claim is made** (`Math.round` maps both 50.989 and the authored 51.05 to the
same cell 25), and **no predicate, radius or tolerance was touched**.

For the engineer's reproduction, the world identity is legible in the captured
HUD frame: **seed 3215739679, world coordinate −1,−1, 125,000 voxels**.

**The player-facing shape of this defect** (raw HUD frame
`0034-strip-ch13-survey.png`): the exact signed marker *"Survey start · begin a
route"*, the correct standing work order, the live `F | Begin recording your
route` prompt, and a marker distance of **0 m** — while the verb does nothing,
200 times, silently. The guidance is right and the world refuses it.

## Blocker 2 — VF3-AVHOME-1: the ch13-home anchors are noted but never accepted by the AV rail

Through the whole of `ch13-home` the signed AV runtime reported `beat:
ch13-home`, `activationSequence: 0`, `activationHistoryAnchorIds: []` and an
**empty** pending queue, while the chapter's diagnostic listed
`firedAnchors ['anc.cg.home-steady','anc.cg.fault-reviewed']`. The AV ledger
only begins at `anc.cg.hatch-boarded`, in the next beat.

Source candidates, cited not asserted: `anc.cg.home-steady` is neither
conditional nor present in `RECEIPT_SATISFIED_ANCHORS`, so once its own
activation is lost, `signedSceneAvRuntime.ts:536-545` refuses every later
`ch13-home` anchor behind it — a cascade from one lost anchor. The single retry
in `drainPendingAnchors` (`commonGroundDirector.ts:461-470`) runs at the *top* of
the tick, and `clearPendingAnchors` empties the queue at the beat entry itself.
An initial foreground/visibility cancel at boot is a further **untested**
candidate.

**Precision, per root:** `noteAnchor` drives this chapter's mood/music
separately from AV acceptance, and root observed `score.mood = restored-home`.
This finding therefore claims only that **the signed AV rail did not accept the
anchors** (no activation history, no shot/lens). It makes **no** claim that a cue
was inaudible or that chapter music failed. **Nothing was listened to.**

Scope limit: measured on a **deep link**. The continuous station → home entry
has not been run on this source.

## Still-open proof gap — the valid intermediate Continue (CG008)

What exists is an **isolated AV-order boundary probe** on the real runtime
(direct anchor calls, no WorldSave reconstruction): with no ch13 receipt held,
`anc.cg.route-offered` and `anc.cg.route-tested` are refused; with
`story:ch13-route-tested` held they succeed. The whole source declares only
**six** durable ch13 milestones, and `RECEIPT_SATISFIED_ANCHORS` keys every
survey predecessor on the **final** one, so a save taken mid-drawing can carry
nothing that excuses them. Root's correction is accepted and the invented
milestone strings were removed.

**The mid-common case does not reproduce**: the crossing receipt is marked
before its anchor is noted, and it excuses `anc.cg.reciprocal-reference`.

This is **not** the valid physical Continue that was asked for. It could not be
produced, because blocker 1 refuses the very first survey sample. The bounded
engineer pass must reproduce it through the real save/driver seam.

## Harness defects found — in MY probes, fixed in MY probes

No game source and no game test file was added, changed or deleted.

1. **The stall predicate never armed** for the entire 189.8 s survey run: its
   phase came from `__autopilot.routeAction`, which reports `idle` throughout
   this chapter's screening rail — 200 consecutive `phase-out-of-scope:idle`
   resets. It now leads with the chapter's own executed rail action.
2. **`cgHoldReason` read a flat key**; the published schema nests it under
   `.diagnostic`, so a real hold never extended the window.
3. **Pose selection now leads with the published hook**, and a change of pose
   *source* is recorded as a measurement discontinuity rather than counted as a
   teleport — the earlier run's 54.77-unit "largest jump" was the boot
   placeholder switching to the real hook.
4. The new footing probe awaited the **synchronous** `frameStats` helper and
   crashed at its final write; fixed, and its summary is reconstructed offline
   from its own trace and labelled as such. Every measurement in it is verbatim
   from the live run.

Offline: `cg-harness-selftest` **25/25** (was 23/23), `--self-test` OK,
`node --check` OK. These are harness checks, **not game proof**.

## Not measured, not claimed

No route sample, neither route class, no ordered 18 units, no corner behaviour,
no manual-corner recovery, no common beat, no completion or handback; no three
cold journeys, no station→home bridge, no full story movie; the 28 anchors as a
set, the 17+2 objective lifecycles end to end, the reset matrix and the
mobile / reduced-motion / lowest-tier variants are all untouched; every
performance figure is unmeasured; and **nothing was listened to**. None of these
is recorded as passed anywhere.

## Integrity

No game source modified. No threshold, predicate, radius or tolerance touched.
No teleport, progress grant, prerequisite fixture or timeout rescue used or
counted as success. No server started by this role and none orphaned; the
root-owned preview at `http://127.0.0.1:45091/` is root's and is untouched by
this role's exit. All prior captures, logs and reports are preserved.

**A failed interim checkpoint is not chapter verification complete.** Independent
re-verification of the repaired source, and the mandatory post-fix physical
journeys, all remain required. No publication is authorized.
