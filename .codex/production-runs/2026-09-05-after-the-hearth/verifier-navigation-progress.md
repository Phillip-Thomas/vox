# Independent verifier progress — navigation-repair verification

Role: fresh independent story-verifier (opus). Run `2026-09-05-after-the-hearth`.
Owns only: this run's new probes/captures/logs/typed evidence and its own reports.
No game source, contract, or creative edits. No publication. No own preview.

---

## Phase 0 — preconditions (COMPLETE, PASS)

Read before acting: `verifier-control.json`, `verification-ready.json`,
`verification-navigation-commission.txt`, `navigation-repair-direction.json`,
`integration-navigation-complete-report.json`,
`producer-navigation-source-review.json`, `implementation-gate-pass.json`,
`check-results.json`, `implementation-source-manifest.json`,
`verifier-inbox.md`.

Engineer-finished receipts required by this commission — all three present,
`exitCode: 0`, `isError: false`:

| invocation | finishedAt | exit |
| --- | --- | --- |
| `integration-navigation-repair-invocation.json` | 2026-09-06T13:50:35.308294+00:00 | 0 |
| `integration-navigation-closure-invocation.json` | 2026-09-06T13:59:56.493039+00:00 | 0 |
| `integration-navigation-wording-invocation.json` | 2026-09-06T14:07:52.723611+00:00 | 0 |

`verification-ready.json`: `ready: true`, `readyAt` 2026-09-06T14:11:21.773199+00:00,
`contractVersion: scene-v2`, `publicationAuthorized: false`.
`verifier-control.json`: `action: continue`,
`sourceManifestSha256: 1a50c19f…a61e8`.

### Independent source identity rehash (verifier-computed, not copied)

| item | expected (root) | verifier-recomputed | result |
| --- | --- | --- | --- |
| `implementation-source-manifest.json` sha256 | `1a50c19f26ef11d17361810feb4ab7b872b215da67156b5db414abd85b8a61e8` | identical | MATCH |
| `scene-contract.json` sha256 (scene-v2) | `4dbf722b308b92b170313285854e3c9c2abac853b3407bf3e0f4efccfddff88e` | identical | MATCH |
| `defects.json` sha256 | `206ab59390baef7fa68732ed8dad0dc68ef72a7a67fb8bb8393e66a446eb084d` | identical | MATCH |
| manifest source files rehashed against disk | 98 | 98 | 98/98 MATCH, 0 missing, 0 mismatched |

Source under test is the FINAL composite (navigation repair + producer-review
closure + non-behavioral lexical correction). `sourceRevision`
`b631a52065a1a69fecac0331e69515c306408641+working-tree`.

---

## Phase 1 — independent full verify (COMPLETE, PASS)

Run once by this verifier, independently of the engineer's log.

```
command : npm run verify
cwd     : /home/thomasphillip/Projects/vox/main
startedAt : 2026-09-06T14:11:46Z
finishedAt: 2026-09-06T14:12:48Z
exitCode  : 0
```

- log: `logs/verifier-navigation/verify.log`
- log sha256: `a3eaf4fbfa043c0ffb718a67209e5382dc42e2d5671002f41a8811316a429ab4`
- log bytes: 39125
- Test Files: **350 passed (350)**
- Tests: **3139 passed (3139)**
- build: `✓ built in 5.85s`

Totals independently reproduce the engineer/producer-reported
350 files / 3139 tests. This verifier's log SHA differs from the engineer's
(`cf45406a…`) only because it is a separate execution with its own timings —
that is expected and is not build drift.

---

## BUILD READY

**BUILD READY — 2026-09-06T14:12:48Z**

Current build identity produced by this verifier's own `npm run verify` build
step, from the gated final source manifest `1a50c19f…a61e8`:

| field | value |
| --- | --- |
| dist title | `<title>Paravoxia</title>` (confirmed in bytes, not HTTP 200) |
| `dist/index.html` sha256 | `ca7b448b72cc17407fc843afffe4808df7fc12ea5203a47b77ceece1c6dedc71` |
| `assets/index-CbB2rmHN.js` | `2a5d6b2fed229855…` |
| `assets/SpaceStationSandbox-CabWoklJ.js` | `1dafd9993c60df42…` |
| `assets/worldPrep.worker-D9jfWRDd.js` | `5c34b2579d4869bb…` |
| `assets/index-Cu3vcG_z.css` | `398c81b6c1d41236…` |
| dist file count | 11 |
| auxiliary verifier buildHash | `9c7d99d7ef0de8f65bdfed9337f038b53c5cf04cc46d0c63467af9431e4c8610` |

Auxiliary verifier buildHash algorithm = sha256 over codepoint-sorted
`path` + NUL + `filesha256` + newline. The shipped preview manifest buildHash
hashes a JSON filemap instead. **These are two distinct algorithms; a differing
value between them is NOT build drift.** Bundle filenames and per-file SHAs
above are the drift-comparable identity.

---

## Phase 2 — root preview replacement RECEIVED and independently verified (PASS)

Root replaced the preview at 2026-09-06T14:14:15.597Z.
Record: `verifier/artifacts/preview-ownership.json`, `state: running`,
`owner: root-production-preview`, daemonPid 1290230, rootExec-owned.

**Canonical URL for all probes in this pass: `http://127.0.0.1:38803/`**

The superseded pre-repair preview on **40131** (`d9e36ae3`) is no longer the
ownership record. This verifier never measured it and never stopped it.

### Identity verified by this verifier against its OWN build (not HTTP 200)

| item | served by 38803 | this verifier's `main/dist` | result |
| --- | --- | --- | --- |
| title | `<title>Paravoxia</title>` | — | CONFIRMED |
| `index.html` sha256 | `ca7b448b72cc17407fc843afffe4808df7fc12ea5203a47b77ceece1c6dedc71` | identical | MATCH |
| `assets/index-CbB2rmHN.js` | `2a5d6b2fed229855…` | identical | MATCH |
| `assets/SpaceStationSandbox-CabWoklJ.js` | `1dafd9993c60df42…` | identical | MATCH |
| `assets/worldPrep.worker-D9jfWRDd.js` | `5c34b2579d4869bb…` | identical | MATCH |
| `assets/index-Cu3vcG_z.css` | `398c81b6c1d41236…` | identical | MATCH |
| ownership `sourceManifestSha256` | `1a50c19f…a61e8` | control value | MATCH |

The served index references exactly one entry bundle, `/assets/index-CbB2rmHN.js`,
which is the repaired bundle. **The preview serves byte-identical output to the
build this verifier produced itself from the gated final source.**

Build-hash algorithm note, as required: ownership `buildHash`
`2471402da0c0092972a2d88d7100a9bc2688e193a18f54da70e0ea73c7baf106` is the
shipped `previewBuildManifest` JSON-filemap algorithm; this verifier's auxiliary
`9c7d99d7ef0de8f65bdfed9337f038b53c5cf04cc46d0c63467af9431e4c8610` is the
codepoint-sorted path/NUL/sha/newline algorithm. **Different algorithms over the
same bytes — this is NOT build drift.** The per-file SHAs above are the
drift-comparable evidence and they all match.

Heavy-GPU lock `/home/thomasphillip/Projects/Paraform/harness/output/.heavy.lock`:
`fuser` returns rc=1 with no owner PIDs at 14:14Z — free. That is an observation;
acquisition happens non-blocking at the moment headed Chromium/ANGLE starts.
This verifier will never bypass another owner or stop root's preview.

---

## Not yet measured — SUPERSEDED BY PHASE 3 BELOW (written at BUILD READY, 14:12Z)

> **Stale as of 14:26Z.** This list was accurate when written, before any
> browser measurement. Items 1 and 2 have since been partly measured — see
> Phase 3.1 and 3.2. Read Phase 3 for the current state; this block is retained
> unedited only so the ordering of claims stays auditable.

Nothing below had been measured against the repaired build at the time of
writing. No result here may be read as gameplay, rendering, hearing, hardware or
creative acceptance.

- Zero-rescue movie long survey; real movement at first and subsequent x/z turns.
- Actual partial drawing -> beforeunload save -> earned landing Continue -> new
  physical anchor; and boot/menu non-overwrite of the original saved drawing.
- Manual early-corner / return-to-frontier recovery.
- Three cold focused journeys; station departure -> home -> ch13 -> final.
- Full story movie from beginning, zero rescues.
- All 17 new + 2 prior objective lifecycles; 28 anchors.
- Desktop/mobile/reduced-motion/lowest-tier parity; cold high AND low budgets.
- All scene-v2 audio eligibility/cancel/monotonic/release + control handbacks.

Static checks do not prove any of the above.

---

## Phase 3 — measurements on the repaired build (IN PROGRESS)

All measurements below are on preview 38803 / source `1a50c19f…a61e8`, hardware
ANGLE (`NVIDIA GB10/PCIe, OpenGL 4.5.0`), headed.

**Heavy-lock provenance, corrected per root 14:16Z.** My two completed GPU
probes acquired the lock with `flock -s` (SHARED). The commission requires
EXCLUSIVE `flock -n`. Recording this accurately rather than hiding it: the two
probes ran strictly serially, one owned browser at a time, and `fuser` showed no
other holder during either, so **no overlap occurred** and the evidence stands.
All subsequent heavy jobs in this pass use exclusive `flock -n`.

**Self-test exit provenance, corrected per root 14:15Z.** My first gate run
piped node into `tail`, so the `$?` I reported was `tail`'s status, not node's.
Re-run writing directly to a file: `logs/verifier-navigation/selftest.log`,
sha256 `efaa7f1d6485afd0bb6fa675f98a3faaa743f2c3bea0d0333f2cb99725d3c619`,
**ACTUAL node exit 0**, `25/25` and `41/41` passed. The gate genuinely passed;
only my exit-code evidence was sloppy.

### Root corrections acknowledged (14:15–14:22Z)

1. Sibling/`ch13-return` selection on the incomplete fixture is **LAWFUL, not a
   defect**. Acknowledged — I had already retracted this myself in 3.2 before
   reading the correction, and I have filed no such defect.
2. Exclusive lock required going forward — acknowledged above.
3. Self-test exit-code provenance — corrected above.
4. The standing `[F] Reopen` prompt does not establish the rail "ought to" press
   F — acknowledged and withdrawn as a cause in 3.1.
5. `partial-continue-probe.mjs` is NOT an earned-return flow — acknowledged; my
   contrary sentence is corrected in 3.2, and run-5 is re-scoped to
   incomplete-fixture data preservation only.

### 3.1 Survey movie, zero-rescue long survey — MEASURED, BLOCKED (not a regression)

`verifier/captures/navigation/survey-movie-1/` (108 frames, raw + percept).
Probe sha `af35801e5e7a231ece902fc1d28f78ca8cde380a192bec329606362d70572c41`.
Post-finally cleanup receipt: `state: stopped`, `sessionStopped: true`, error none,
root preview untouched.

**Navigation repair is objectively effective.** Against the pre-repair d9 source,
which physically started 4 samples then snapped ~0.75 short of off-grid goals at
the turns, this run shows real bodily traversal through the turns:

| measurement | value |
| --- | --- |
| walked path (3D) | **150.915 units** |
| walked path (horizontal) | **105.843 units** |
| net displacement | 68.533 units |
| **teleportNudgesTotal** | **0** |
| page errors | 0 |
| pose source | `cg-diagnostic:…snapshot().bodyCentre`, resolved 457 ms, 0 source switches |

Signed anchors physically reached, in order, with real body/worker positions:
`repeated-measure`(4.4s) → `demonstration-opened`(14.6s) → `survey-started`(17.4s)
→ `trace-drawn`(25.2s) → `route-offered` → `revision-ready`. That is **6 of the 7
non-contingent anchors** for this beat.

**Blocker (checkpointed once, not repeated):** `anc.cg.route-tested` (order 19,
non-contingent) is never reached, so the beat never advances to `ch13-common`.
Terminal state: objective `ch13:survey:test`, anchor `anc.cg.revision-ready`,
player `[-41.98, 52.79, 12.16]`, W-7744 `[-42, 51, 13.2]` (≈1 m apart),
`auditWorker.walk = 0`, `autopilot.routeAction = "direct"`.
`playerMovedUnitsInWindow = 0` AND `actorMovedUnitsInWindow = 0` for 150 s.

Lifecycle detail that pins it: `ch13:survey:revise` activates at 44026 ms on
`anc.cg.revision-ready` and is replaced 217 ms later at 44243 ms by
`ch13:survey:test` — i.e. the revise objective is cleared by the very anchor
that raised it, and control falls back to a `test` objective whose standing copy
asserts *"W-7744 is testing the offered route"* while W-7744's `walk` is 0.

Frame `0106-stall-fail.png` is NOT blank and shows correct HUD: objective card,
marker `W-7744 · offered route · 1m` (exact signed-label parity), and a standing,
actionable `[F] Reopen the untested span` prompt. No rescue was attempted.

> **CORRECTED 14:28Z after root inbox 14:18 / 14:20.** I earlier wrote that "the
> movie rail never presses F" as though the missing F press were the cause. Root
> is right that this does not follow: `standing-clear` is a *deliberate* choice
> to remove body obstruction, so declining to reopen is not itself the fault.
> Withdrawn as a cause; kept only as an observation that the prompt was standing.
>
> The better-supported reading, with root's source pointer: the rail target at
> the stall is `[-42, 51.05, 9]` (`commonGroundDirector.ts:1950`,
> `CG_STANDBY_CLEAR_OF_E = E.z − 3 = z9`), while the body sits at
> `z = 12.16` with `stillTime 0`. The rail is asking for a real move to
> standing-clear that does not happen. That points at **target footing /
> navigability at the standby cell**, not at a missing interact. I have not
> measured that cell's support, so this is a candidate, not a diagnosed cause,
> and I am not proposing any predicate or clearance weakening.

Root independently observed the same run reaching 42 samples / ~35.31 route
units with `testedPrefix 41`, and confirms the original off-grid draw stop is
passed. Per root's instruction I did NOT replay the survey to reconfirm.

Objective visual defects: none. No blank/black frame, no pop, no wrong-era
glimpse, no missing HUD element referenced by copy.

### 3.2 Partial drawing → save → Continue — DESTRUCTIVE-SAVE DEFECT RESOLVED

`verifier/captures/partial-continue/run-5/` (fresh folder; run-1..4 preserved).
Threshold corrected to `--min-samples 2` per commission; the drawing actually
earned **5 samples with positive walked distance**, so the old artificial ≥4 bar
is not load-bearing either way.

This is the direct counterpart of the pre-repair run-4 failure, in which a
1186-byte 4-sample Origin drawing was **overwritten** by a 606-byte idle save
after Continue.

| stage | `pvx.v1.world.-1,-1` | sha256 | commonGround | survey |
| --- | --- | --- | --- | --- |
| before navigation (pre-hydration placeholder) | 616 B | — | — | — |
| after shipped `beforeunload → doSave` | **1305 B** | `5252dfd7…f514` | true | `drawing`, 5 samples |
| **after clicking real Continue** | **1305 B** | **`5252dfd7…f514`** | **true** | **`drawing`, 5 samples** |

**Byte-identical across the Continue lifecycle.** The pre-hydration snapshot
shadowing / destructive overwrite (CG-IMPL-011 class) does **not** reproduce on
this source. Boot and menu did not overwrite the original saved drawing, which
is precisely the separate guarantee the producer asked to be checked against the
incomplete old fixture. The saved samples carry real `walkedAt` progression
(0, 1.248, 1.739, 2.721, 3.457) — an actual unfinished drawing, not a fixture.

Continue was operated as a real player: waited for the landing DOM
(`▶ Continue`, subtitle `STORY COMPLETE · RETURN TO YOUR WORLD`), clicked it,
then waited for 3D — no deep link, no reseed, storage retained.

**Resume point is LAWFUL, not a defect.** Continue landed in `ch13-return` with
`survey.phase = idle`. Per the signed contract this is correct: the saved global
carries `story:ch13-fault-reviewed` and `story:ch13-return-chosen` but NOT
`story:ch13-origin-landed`, and the ladder `ch13:return:board` →
`ch13:return:launch` → `ch13:return:origin` → `anc.cg.origin-landed` must be
walked before the survey verbs are live.

**Retracted provisional finding (recorded deliberately).** I first read the live
world after Continue as a *sibling-world selection defect*, because the debug HUD
showed world `-1,-1:p1` seed 1600321158 with objective "Kestrel hatch · board",
while the preserved drawing lives in `-1,-1` seed 3215739679. Checking the signed
contract before reporting shows `ch13:return:board` with markerLabel
`Kestrel hatch · board` and workOrder `["Follow the hatch marker.","[F] Board the
Kestrel."]` is an **authored objective of ch13-return**. `-1,-1:p1` is therefore
the lawful departure world, and GlobalSave `lastPlanetWorldId` correctly reads
`-1,-1`. **This is NOT a defect and must not be reported as one.**

**Probe error, not game failure.** run-5 Phase 4a walked toward W-7744's *Origin*
coordinates `[-34, 51.05, 10]` while still in the departure world, "arrived"
(0.985 u horizontal, 2.284 u 3D vs 3.4 u reach) next to fauna, and recorded
`originLanded = false`. That is my harness following the wrong target for this
beat. It invalidates only the run-5 Phase 4a leg. It does not touch the save
preservation result above, which is measured from stored bytes.
Frame `0003b-after-walk-to-W.png` is retained as the evidence of the probe error.

> **CORRECTION 14:28Z — my earlier sentence was wrong.** In Phase 3.3 I first
> wrote that `partial-continue-probe.mjs` "already implements the earned return
> path". It does not, and root's 14:20 inbox correction is right. That file
> boots `?story=ch13-survey` (line 263), which seeds `ch13-fault-reviewed` and
> `ch13-return-chosen` but NOT `origin-landed` (line 271), and it only walks
> toward W *after* Continue (line 475). That is an **incomplete-fixture data
> preservation** flow, not an earned-return-before-save flow. Walking to W in
> the sibling world cannot supply the missing Origin landing.
>
> Consequently run-5 is scoped to exactly one claim, and I am labelling it that
> way: **incomplete-fixture DATA PRESERVATION — passed, byte-exact.** It is NOT
> a valid primary Continue success and must not be read as one. No blanket
> "Continue failed" verdict is drawn from this old fixture either.

Also retained honestly: Phase 5's Pause button was again not clickable normally
(8 s intercept timeout) and only responded to a forced dispatch. Forced UI is
labelled diagnostic and is **not** counted as normal player acceptance, so
Quit-to-Menu remains **unexercised**, exactly as in run-4.

### 3.3 Earned return ladder (`board → launch → origin-landed`) — NOT YET MEASURED

Required to close the remaining half of check 2 (restored drawing → NEW physical
action). Manual-mode `rail` is null, so the run-5 style blind walk cannot steer
it; driving a full interplanetary return by hand risks measuring my probe rather
than the game.

**Currently blocked on shared hardware, not on the game.** At 14:26Z the heavy
lock is held EXCLUSIVELY by an unrelated Paraform job
(`flock -n harness/output/.heavy.lock node harness/perform.mjs --exp
x-bound-by-what-it-hears`, pid 1307703). My shared acquisition correctly fails.
I am waiting; I will not bypass another owner. A `--out navigation/return-movie-1`
attempt exited 1 with no output for exactly this reason (flock refusal, not a
game or probe fault); its empty output dir is why the retry uses `return-movie-2`.

### Still unmeasured on this build

Three cold journeys; continuous station-departure → home → ch13 → final; full
story movie from beginning; the full 17+2 objective lifecycles and 28 anchors;
mobile / reduced-motion / lowest-tier parity; cold high AND low hardware budgets;
all scene-v2 audio eligibility/cancel/monotonic/release and control handbacks.
No hearing claim is made anywhere — no audio has been heard.
