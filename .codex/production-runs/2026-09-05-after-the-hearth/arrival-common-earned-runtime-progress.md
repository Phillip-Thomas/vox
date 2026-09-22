# arrival-common-earned runtime — progress

Role: `arrival-common-earned` (independent story-verifier, opus).
Run: `2026-09-05-after-the-hearth`. Started 2026-09-06T18:22Z.

## Phase 0 — context and preflight (CPU only, no browser)

| Check | Result |
|---|---|
| `verifier-control.json` `activeRole` | `arrival-common-earned` — matches my role |
| control `sourceManifestSha256` | `6ef957c3dd4a1af04852773b3e5f608d2247e212eb27d05a95ba6f40c1fee5d6` |
| `implementation-source-manifest.json` actual sha256 | `6ef957c3…1fee5d6` — MATCHES |
| `scene-contract.json` actual sha256 | `5ef85a324f579ba1f627980002aab680f6c9b990fae84275daccc3dcb17eec54` (scene-v3) — matches readiness |
| Manifest `hashes` rehash | **99/99 match** |
| Manifest `auxiliaryToolingHashes` rehash | 4/5 match; 1 mismatch (see below) |
| Live `http://127.0.0.1:34413/` | 200, `<title>Paravoxia</title>`, index sha256 `6c8c378b…9bb207` = control + ownership |
| Live `/assets/index-BiDWGouH.js` | 200, sha256 `efc87feb…77a068` = ownership `bundleSha256` |
| Heavy lock `/home/thomasphillip/Projects/Paraform/harness/output/.heavy.lock` | exists, no owner PID at 18:22Z |
| GPU / display | `DISPLAY=:0`, NVIDIA GB10 present |
| Node | v25.6.1 |
| GPU authority | `producer-manual-earned-gpu-handoff.json` — released to this role at 18:21:15Z, 4 manual captures `stopped` |

### Auxiliary mismatch (reported separately, per commission)
`docs/architecture/workflow-orchestration/run-profiles/paravoxia-creative-delta.run-profile.json`
recorded `a0b0ecdd…1444c2`, observed `605fb2ef…5f57ae828` — **exactly** the drift
`producer-nonbinding-auxiliary-observation.json` recorded and permitted. It is an
UNUSED delta profile; the active profile is `paravoxia-creative-chapter@v1`. No
full-verify rerun performed (explicitly not required). The probe's own
`rehashSourceManifest` reads only the `hashes` map (99 source paths), so this
auxiliary row is not part of its gate.

## Phase 0b — entry-harness defect inspection (before any browser)

Both defects named in the commission were looked for in **this lane's own code**:

1. **Stale canvas-rectangle click.** NOT PRESENT. This lane's only click is
   `page.click('button[aria-describedby="landing-story-subtitle"]')`
   (earned-continue-probe.mjs:758) — a semantic selector; Playwright resolves the
   element's live box at click time. There is no `boundingBox()`/
   `getBoundingClientRect()` read, no coordinate click, no `page.mouse.*`, and no
   `requestPointerLock`. **No change made.**
2. **commandedUnits full-residual stall detector.** NOT PRESENT. `walkTowards`
   (earned-continue-probe.mjs:362-402) has no stall detector at all: it ends on
   `arrived`, `hold-off-distance`, `stop-condition`, `budget-exhausted`, or
   `no-key-produced-displacement` (a per-burst measured displacement, not a
   fraction of remaining distance). **No change made.**

## Phase 0c — pinned scene contract correction (instrumentation, not game repair)

`verifier/probes/arrival-common-earned/cgContract.pinned.mjs` still pinned the
superseded **scene-v2** `4dbf722b308b92b170313285854e3c9c2abac853b3407bf3e0f4efccfddff88e`.
Bounded exact update to scene-v3 applied in this lane's OWN private dependency,
as authorized:

| | sha256 |
|---|---|
| before | `5f447ebd34543387cb3c1ade1e09ad52f5abb9ab6a4dfc1384ccc8af2c45c551` |
| after | `5f3dbc2e29a62a4400df79e9c06b620792b39014be524dbeaeb453029ae083a5` |
| before copy | `logs/arrival-common-earned-runtime/cgContract.pinned.mjs.before` |

Changed: the `SIGNED_CONTRACT_SHA256` constant, and the two `scene-v2` words in
the header comment and error string. Nothing else. Shared original
`verifier/probes/lib/cgContract.mjs` re-hashed AFTER the edit: still
`5f447ebd…c2f45c551` — untouched. Owned `pinned/pin.json` updated with the
divergence record (before copy `logs/arrival-common-earned-runtime/pin.json.before`,
sha `45be04a4…f50cbcbd`).

Runtime effect on this lane: **none** — `earned-continue-probe.mjs` imports only
`ART/CAPTURES/RUN_DIR/REPO_ROOT/MAIN` from that module and never calls
`loadContract()`. The correction removes a stale constant, it does not change any
predicate, geometry or acceptance.

Owned CPU suites rerun after the edit (code changed, so this is not a duplicate):

| Command | Exit | Result |
|---|---|---|
| `node verifier/probes/arrival-common-earned/selftest.mjs` | 0 | 108/108 |
| `node verifier/probes/arrival-common-earned/earned-continue-probe.mjs --self-test` | 0 | OK |

## Phase 0d — earned-origin gate confirmed (source read, `earnedContinueLogic.mjs`)

`earnedOriginGate` requires, all of them, and refuses otherwise:
`originLandedMilestone === true` (real latched `story:ch13-origin-landed`);
`landedActivePlanetId === '-1,-1'` EXACTLY (`SIGNED_ORIGIN_PLANET_ID`) — a merely
*different* planet is refused by name; `locationMode === 'surface'`;
`controlMode === 'fps'`; `supported === true`; finite 3-number grounded pose;
measured live `fps >= minFps`; named `signedSceneAv.activationHistoryAnchorIds`
available and non-empty **and containing `anc.cg.origin-landed`** (a non-empty
lift-only history is refused with its raw history preserved); AND the chapter
fired-anchor array containing `anc.cg.origin-landed`, with a `null` chapter read
refused as UNMEASURED. `Object.keys(av).length` is retained only as
`avRawKeyCountIsNotEvidence`.

## Phase 1 — runtime lane (COMPLETE)

Read `verifier-control.json` + `verifier-inbox` at this phase boundary:
GPU authority transferred to this role at 18:21:15Z
(`producer-manual-earned-gpu-handoff.json`, 4 manual captures `stopped`,
`captureAuthorityReleased: true`). Heavy lock observed free. Proceeded.

ONE lane run: `verifier/captures/arrival-common-earned/earned-1`
(start 18:24:44Z, end 18:27:52Z, Node v25.6.1, **node exit 1** = the probe's own
prerequisite refusal, recorded separately from role completion).

| Phase | Result |
|---|---|
| 0 earned Origin landing | **PASS** — 73763 ms, planet `-1,-1` exactly, `origin-landed` in BOTH histories, supported, fps 60.3 |
| 1 partial survey drawing | **PASS** — checkpoint pure, 18 working samples in the save, pre-offer, pre-route-test |
| 2 actual `beforeunload` WorldSave | **PASS** — blob 582 -> 2753 bytes, global 3500 bytes / 91 milestones |
| 3 ordinary Continue | **PASS** — correct world actor, prefix retained, no overwrite, no replay |
| 4 new action after Continue | **PREREQUISITE FAILURE** — body 94.79 units (104 m by the shipped marker) from E, `supported=false` throughout, lane's XZ-planar mover cannot navigate the +X-up face |

Stopped at the first impossible prerequisite. No rescue, no repeat, no game patch.
Source rehashed after the capture: 99/99 intact, `stableAcrossCapture: true`.
Cleanup post-finally `stopped`, root preview untouched, no abandoned browser.

Full findings: `arrival-common-earned-runtime-report.md` / `.json`.

## Phase 2 — close

Owned artifacts written; nothing outside my ownership was modified. Probe byte
diff before/after the run is exactly the two authorized instrumentation files
(`cgContract.pinned.mjs`, `pinned/pin.json`); all probe logic files unchanged
(`logs/arrival-common-earned-runtime/probe-bytes-before.txt` vs
`probe-bytes-after.txt`).
