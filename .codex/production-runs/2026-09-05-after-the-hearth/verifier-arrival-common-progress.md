# arrival-common-verifier — progress

Role: fresh independent story-verifier (opus). Bounded physical verification of
the **seventh** material repair. Not a creative run, not chapter acceptance, no
defect closure, no publication.

Owned paths only: `verifier/probes/arrival-common-verifier/`,
`verifier/captures/arrival-common/`, `logs/arrival-common-verifier/`,
this file, and `verification-arrival-common-report.json/md`.

---

## Phase 1 — independent full verify on the frozen source

### Source integrity, before

`logs/arrival-common-verifier/rehash-before.json`

| what | result |
| --- | --- |
| taken at (actual UTC) | 2026-09-06T17:44:5xZ (before `npm run verify` start 17:45:06Z) |
| `implementation-source-manifest.json` sha256 | `6ef957c3dd4a1af04852773b3e5f608d2247e212eb27d05a95ba6f40c1fee5d6` — equals `verifier-control.json.sourceManifestSha256` and `verification-ready.json.sourceManifestSha256` |
| `scene-contract.json` sha256 | `5ef85a324f579ba1f627980002aab680f6c9b990fae84275daccc3dcb17eec54` — equals the scene-v3 `contractSha256` in the repair direction and producer source review |
| manifest.hashes (99 source files) | **99/99 match, 0 mismatch** |
| manifest.auxiliaryToolingHashes (5 files) | 5/5 match |
| manifest.externalSourceChanges.hashes (`main/tools/creative-triad-gate.mjs`) | matches `23b347b7d7f8ae67c87d3e0eff14baf80d6e9e80cb2255bff81bc91a555e66bf` |

### The command, actually run once

| field | value |
| --- | --- |
| command | `npm --prefix main run verify` |
| cwd | `/home/thomasphillip/Projects/vox` |
| started (actual UTC) | `2026-09-06T17:45:06.245184591Z` |
| ended (actual UTC) | `2026-09-06T17:46:07.106885453Z` |
| exit code | **0** |
| log | `logs/arrival-common-verifier/verify.log` |
| log sha256 | `e57a9dab67a87a31e54bfff8a3a3d6f334ca62b76098769acbddf4c15e68d6ba` |
| vitest | **351 files / 3172 tests passed** |

This matches the integration report's own count (351 / 3172) independently.

### Source integrity, after

`logs/arrival-common-verifier/rehash-after.json`

* manifest.hashes: **99/99 match** — the frozen game source is byte-identical
  before and after my verify. No source was written by this role.
* manifest.externalSourceChanges: match.
* **1 auxiliary drift, NOT repaired, NOT reverted, NOT attributed:**
  `docs/architecture/workflow-orchestration/run-profiles/paravoxia-creative-delta.run-profile.json`
  expected `a0b0ecdd0df08f1866af39fb74645bc8eea1c05b008cf1e8856de60edc1444c2`,
  observed `605fb2efc36901bc9c012bda0a0d6e7552003888dd5f959420d612f5e57ae828`.
  This is an auxiliary tooling file fingerprinted by
  `producer-concurrent-validation-tooling-review.json`, which records that the
  changed delta run-profile **is not used by this run**. It is not a manifest
  source file and not in the verify chain. Reported as further external drift,
  per commission.

### BUILD READY

`npm --prefix main run verify` produced `main/dist` at
`/home/thomasphillip/Projects/vox/main/dist`. **Built file map (11 files):**

| file | sha256 |
| --- | --- |
| `index.html` | `6c8c378b282e3edef451a6957a5b5ad52591e206fc771390cdc33f9859cbb207` |
| `assets/index-BiDWGouH.js` | `efc87feb0068671e6ac297f808fe61ea320b208a13fd9a8c40fa051077a9a068` |
| `assets/index-Cu3vcG_z.css` | `398c81b6c1d41236a180d4deb0e2d085f63c962fbf4ec723ca31cd325f46c190` |
| `assets/SpaceStationSandbox-BjSeuRzz.js` | `cb07bc0dfdf6137dbf66db3be5d8561cfe7706862f34ebe0745fc7404283894f` |
| `assets/worldPrep.worker-D9jfWRDd.js` | `5c34b2579d4869bbb97ca0d692cf14c2ed050c8983dce442c1ffcca1676bd0de` |
| `audio/music/manifest.json` | `453c4f17ce55bbdd29a8a943049dbd2f6a3e436fb4d0bba9e2e082f7945fea65` |
| `audio/music/deep_space_out_there.ogg` | `6e02a32d963b84061cdeec66cc852e731e367c93ef572aa169b1baadbcdc20ba` |
| `audio/music/menu_ambientmain.ogg` | `9dbe685e40d6cc8876ff08938b011424b802c2757ac4052e3eb93f8634208969` |
| `audio/music/shimmer_dream_ambience.mp3` | `e2dbd95fa7e4bcc9e31b861ee1471b64f2dfa2a1d6facc458ab634f952ca567e` |
| `audio/music/surface_project_utopia.ogg` | `88d9956c98282523dd1a00fc6023ee01619818c4ce138c52816e0a39f837fa50` |
| `audio/music/warp_surreal_truth.mp3` | `fe4a94a95aa8f281185f09818d1c9f4cb0da5cd70350bf13b43b5a3c779ce691` |

Two distinct build identities, kept apart as commissioned:

* **shipped JSON file-map buildHash** (`previewSnapshot.snapshotPreviewBuild`,
  `sha256(JSON.stringify(files))`, the value root's ownership record calls
  `buildHash`): **`aa52b0341b78d0931a5c91d431d9ba0ce81b5edde12b9b5b54449a5ee1c20d74`**
* **auxiliary verifier algorithm** (sorted path + NUL + hash + newline records,
  the value ownership calls `verifierBuildHash`):
  **`318e2a54ea84286896d1afbeab2f0980f0074bb286170dee61a17a95abe40427`**

Full map: `logs/arrival-common-verifier/dist-filemap.txt`.

**BUILD READY** — source manifest `6ef957c3…`, contract scene-v3 `5ef85a32…`,
verify exit 0, 351/3172. Waiting for root to publish a new preview ownership
record bound to manifest `6ef957c3…`.

### Preview state at this moment (no browser launched)

`verifier/artifacts/preview-ownership.json` currently reads
`sourceManifestSha256: dc63fbae…`, `state: "stopped"`, `url:
http://127.0.0.1:38007/`, `stoppedAt 2026-09-06T17:45:40.753Z`. That is the
**prior immutable build** and it is both mismatched and stopped. **No browser
will be launched against it.** My journey probe copy already refuses to run on a
manifest mismatch (`PREVIEW-MANIFEST-MISMATCH`) and on a non-`running` state; my
flight probe copy will be given the same guard before it is used.

`verifier-control.json` has no `currentPreviewUrl` field yet.

### Probe copies taken (byte-identical to their originals at copy time)

| my copy | copied from | sha256 at copy |
| --- | --- | --- |
| `verifier/probes/arrival-common-verifier/arrival-flight-probe.mjs` | `verifier/probes/flight-discriminator/flight-discriminator-probe.mjs` | `15e65e89fd09e75c65e9ebce54e9a66b066cc0ea6f87d72d1a2097d51a8a4049` |
| `verifier/probes/arrival-common-verifier/journey-probe.mjs` | `verifier/probes/handoff-standby-verifier/journey-probe.mjs` | `c3fbc90bf2a4722be54655705498d6ec82f9c7915017fa8a482e942c15511fba` |

No shared probe was edited.

---

## Phase 2 — bounded return-flight capture (flight-1) — PASS

`17:49:14.083704865Z` → `17:50:31.522277478Z`, 272 samples @250 ms, 74 800 ms of
a 120 000 ms bound, probe exit 0, 22 frames, cleanup receipt
`{stopped:true, invoked:true, reason:"probe-end", requests:1, error:null}`.

Epoch **2 → 3 → 4**, monotone. Committed to Origin (`activePlanetId -1,-1`) at
40 470 ms at 174.15 units from centre and held it. **The prior departure-reset
signature (epoch 3→5, 6→8, departure pad reclaimed) did NOT reproduce.**
Grounded FPS at 44 648/45 020 ms; on-foot approach to W-7744 with the ship's
celestial pose static at `[53.5, 16, -16]`; `anc.cg.origin-landed` in the named
`activationHistoryAnchorIds`, `story:ch13-origin-landed` latched at 74 432 ms;
beat `ch13-return → ch13-survey` at 74 249 ms. Signed phase copy exact in all
three states under the SAME `ch13:return:origin` ID and `Origin · audit site`
label; no board regression. Boarded-surface phase observed in ONE telemetry
sample and in NO screenshot — frame coverage reported UNMEASURED.

## Phase 3 — movie survey/COMMON, LONG route — PASS (3 cold runs)

First journey attempt exited **1 before any browser** on the shared library's
scene-v2 contract pin; retained by root at
`logs/arrival-common-verifier/preflight-pin-failure-retained/`. Fixed by a
run-local `cgContract-v3.mjs` (pin only). Shared probe untouched.

| run | window (UTC) | exit | stop | `done` at |
| --- | --- | --- | --- | --- |
| journey-common-1 | 17:52:29.679 → 17:58:01.895 | 0 | seconds-budget-exhausted (predicate limitation) | 62.095 s |
| journey-common-2 | 17:59:58.051 → 18:01:04.054 | 0 | reached-beat:done | 62.610 s |
| journey-common-3 | 18:01:09.280 → 18:02:15.484 | 0 | reached-beat:done | 62.506 s |

All three: every original corner passed, `terraUnits 18`, `workerUnits 18`,
`committed true`, W held H `(-40, 51.05, 12)`, Terra's actual F + occupancy
(47/50/50 samples), `anc.cg.route-tested` / `anc.cg.complete` / `anc.cg.handback`
committed, objective cleared at `done`, stall predicate never fired, 0 page
errors. Repaired standby: actual occupied grounded body `(-44.09, 50.989, 12.01)`,
supported, min clearance **2.083–2.092 units** from the ENTIRE offered polyline.

## Final state

Source rehash-final: 99/99 manifest match; the single unused delta-profile
auxiliary drift persists and is preserved. Four browsers owned, zero left
running, root preview untouched, heavy lock released, no probe in flight.
Reports written: `verification-arrival-common-report.json` / `.md`.

### Post-report correction (root inbox 2026-09-06T18:08:12.507390+00:00)

Journey `sample.autopilot` DOES expose `teleportNudgesTotal` = **0** (2460 / 356 /
354 samples). An earlier draft read `hookProbe.autopilot` and wrongly said the
harness does not sample it. `nudges`, `backstops` and `stuck` are NOT fields of
that object and are recorded as **UNMEASURED, not zero**. Both report files
corrected; no capture re-run, GPU authority already transferred.
