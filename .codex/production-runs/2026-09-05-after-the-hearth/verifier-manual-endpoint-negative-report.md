# Manual endpoint-negative runtime — measurement report

**VERDICT: INCONCLUSIVE-C-ENDPOINT-NEGATIVE-NOT-REACHED** (one bounded attempt; C-endpoint negative NOT proved)

## What happened

The probe stopped at the required gate LP-A-and-LP-B-armed-without-relocation, BEFORE CUT_MODE route walking began. Zero vertices ran, so no measured foot at or near C exists in this run. This is a PRIVATE PROBE instrumentation failure consequent on bundle drift, not a game failure and not an endpoint rejection.

Failure class: **private-probe-instrumentation (stale logpoint byte-offset pins vs the bundle the page actually executed)**. True game failure: **False**. Source drift: **True**.

## Root identity revalidated before capture

- servedIndexSha256: `74025800f5312519a92b480a15b493c3b27f971f0cbcbe1ec2b571342d4f4c82`
- servedBundlePath: `/assets/index-Ddqg7x9Y.js`
- servedBundleSha256: `4b41a7d50f2da85a010eb534540187404bc10a7c2cd474c6653e5030923c83e9`
- liveSourceManifestSha256: `2de3fa2aef0d577bdeca7fe9eaa4612751b2946115207fa9c18d2e8613bb9f63`
- liveContractSha256: `5ef85a324f579ba1f627980002aab680f6c9b990fae84275daccc3dcb17eec54`
- matchesControl: `True`

## Blocking discrepancy: served vs executed bundle

- severity: `blocking-for-logpoint-arming`
- preflightFetchedBundlePath: `/assets/index-Ddqg7x9Y.js`
- preflightFetchedBundleSha256: `4b41a7d50f2da85a010eb534540187404bc10a7c2cd474c6653e5030923c83e9`
- bundleActuallyExecutedByThePage: `/assets/index-C1X65dZp.js`
- bundleActuallyExecutedSha256: `68c8be8435c5be5da681f3b5d4a16fcc071d03932e64b4e2fc985a30ab80328b`
- rootIndexReferencesOnly: `assets/index-Ddqg7x9Y.js`
- curlOfExecutedBundlePathReturns: `index.html bytes (sha 74025800f5312519a92b480a15b493c3b27f971f0cbcbe1ec2b571342d4f4c82), i.e. SPA fallback, not the JS the page ran`
- note: `RAW OBSERVATION ONLY. Preflight byte-identity against control PASSED; the page nonetheless executed a differently-hashed bundle. Not resolved by this verifier; no control or ownership file was edited.`

## Arming fault

- gate: `LP-A-and-LP-B-armed-without-relocation`
- ok: `False`
- lpA: `{"lineNumber": 7839, "columnNumber": 194730, "byteOffset": 4443926, "locations": [], "error": null}`
- lpB: `{"lineNumber": 7839, "columnNumber": 220603, "locations": [], "error": null}`
- exactResolution: `{"lpA": false, "lpB": false}`
- cause: `pinned callee byte offsets do not resolve in the executed bundle; breakpoints returned zero locations`
- consequence: `DISCRIMINATOR STAGE STOP: arming-failed -> every downstream dependent act refused by downstreamPermitted`

## Private corrections (applied, NOT exercised)

### cut-mode-negative-is-observation-not-gate
- was: vertex gate recorded required:true; a supported:false vertex broke the forward loop AND permanently blocked all later dependent actions including a legitimately re-earned F
- now: in CUT mode only, recorded with required:false as a retained raw negative observation; the walk continues ordinarily toward C without claiming the vertex valid; FULL repayment mode keeps the original required gate unchanged

### reachedC-derived-from-measured-foot
- was: reachedC: true hardcoded, frame unconditionally named after-early-cut-route-at-C
- now: derived from measured ground foot vs C(-48,51.05,12) with horizontal<=0.35, vertical<=0.35 and supported===true; frame name follows the measurement

### unreached-C-is-inconclusive-not-rejection
- was: credit-refusal gate asserted at an unverified endpoint
- now: if the physical route does not reach measured C the run records endpointVerdict INCONCLUSIVE-ROUTE-DID-NOT-PHYSICALLY-REACH-C and endpointRejection:false

All three corrections are in place and syntax/selftest clean, but CUT_MODE route code was never entered, so none were exercised. They remain UNVALIDATED by measurement.

## Gates passed before stop

- PASS current-build-identity-and-hardware-angle
- PASS fixture-boot-seeds-no-short-completion
- PASS settled-grounded-body
- PASS pointer-lock-active-via-ordinary-click
- PASS manual-lane-no-autopilot
- PASS the-body-actually-walked-the-SHORT-span
- PASS span-offered
- PASS a-NEW-authored-reference-was-offered-by-this-F
- PASS the-reference-was-actually-held-throughout
- PASS SHORT-completed-as-the-held-reference-class
- PASS common-prerequisite-held-reference-proven
- PASS grounded-supported-PRE-E-stand-before-plane-and-on-route
- PASS actual-common-stage-holding-h-with-reciprocal-reference-and-worker-atH
- PASS bundle-url-regex-actually-matches-and-rejects

## Gates failed

- FAIL LP-A-and-LP-B-armed-without-relocation
- FAIL callee-credit-call-actually-entered-on-measured-leg (required:false, degraded observation only)

## GPU / lock

- headless: `False`
- realHeadedViaOwnedHelper: `True`
- hardwareAngleGate: `current-build-identity-and-hardware-angle PASS`
- lockPath: `/home/thomasphillip/Projects/Paraform/harness/output/.heavy.lock`
- fd: `9`
- acquiredBy: `own shell launcher pid 2420715, inherited by node probe`
- kernelProof: `{"kind": "FLOCK", "scope": "ADVISORY", "mode": "WRITE", "inode": 8397196, "fdDevInoMatchesPathDevIno": true}`
- contenderProof: `CONTENDER-BLOCKED-AS-REQUIRED rc=1 on an independent fd while held`
- newServerStarted: `False`
- foreignProcessKilled: `False`
- rootPreviewSurvived: `True`

## Cleanup

- phase: `post-finally`
- state: `stopped`
- cleanupCompleted: `True`
- sessionStopInvocations: `1`
- sessionStopped: `True`
- cleanupError: `None`
- stopsRootPreview: `False`
- killsProcesses: `False`
- locationNote: `recorded INSIDE summary.json .cleanup, not a separate file`
- flockReleased: `True`

## Hashes

- `summary.json` = `0b13adc329a6a607b7f5ead5a02a9d1bc40d29a2feb365f4b26e287ea688cd8f`
- `trace.ndjson` = `66b0d2b11772065527b1cf81aa9f786822a146220053c1e373e3da7be6d4beac`
- `preflight.json` = `399cb72df37dce5777306212b5e7f672a8232ca2354f9b2d7b2c2ccf3258f407`
- `common-entry-crossing-probe.mjs` = `dba768acd9262b8e7bab12dc4567673c3f189f5e774495148779bb658513e427`
- `run-endpoint-negative.sh` = `13164065394b077b42ec0f2f24a28524331b81ae3a61921e2fe8807f5e28017c`
- `probeSnapshotBeforeEdit.common-entry-crossing-probe.mjs` = `6772c5112c4a9cfbffb52e4ca4e8d6bdf2b87865a06881e5d4ca0d53c61d8975`

## Not done
- C-endpoint negative: NOT proved (0 vertices walked)
- Repayment/full-18: not attempted
- Final F / Worker18 / commit: not attempted
- Full suite: not run (reused receipt)


## Next
Re-derive LP-A/LP-B callee sites against the bundle the page ACTUALLY executes (resolve why the executed bundle hash differs from the preflight-verified served bundle) before re-attempting the C-endpoint negative. Do not weaken the arming gate to force a pass.


defectClosure=false, chapterAcceptance=false, publicationAuthorized=false
