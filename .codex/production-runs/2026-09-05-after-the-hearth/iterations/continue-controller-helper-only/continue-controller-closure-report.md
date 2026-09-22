# continue-controller-closure — CPU probe engineering report

**Run:** 2026-09-05-after-the-hearth · **Authored:** 2026-09-06T16:43:25-04:00 (started 16:39:24-04:00)
**Mode:** CPU-only, read-only against game source. **PREPARED, NOT RUN.**
`newAcceptedAction = false`, `gameAcceptance = false`, `isAcceptance = false`.
Role `continue-controller-closure-runtime` is **registered for future serial permission and was not invoked** — no browser, GPU, build, preview or headed session.

## Owned paths (nothing else written)

- `verifier/probes/continue-controller-closure/` (new, `cp -a` of `earned-continue-3d/`, original untouched)
- `logs/continue-controller-closure/`
- `continue-controller-closure-report.json` / `.md`

Original probes, `verifier/captures/earned-continue-3d/attempt-1/`, producer files and other roles' reports were opened read-only. `main/` was never written. The concurrent source-integration lane's 301 modified paths under `main/` are preserved; their hashes are recorded as audit-time **observations only** — not a violation claim, not an accepted-runtime pin.

## Defect 1 — calibration thrash (closed in the private helper)

`walkTowards.runCalibration` (`earned-continue-3d-probe.mjs:439-483`) latched `basisUp` from one snapshot taken **before** four 450 ms key presses, then compared that latch against live `up` at `:508` with `basisStale(maxTiltDeg=12)`.

Measured from `attempt-1/trace.ndjson` + `probe-log.txt`:

| quantity | value |
|---|---|
| calibrate rows / walk rows / basis-stale rows | 88 / 36 / 21 |
| median calibration displacement | 1.878 u |
| walk per calibration round (4 keys) | ≈ 7.5 u |
| **up rotation within one round** | **32.49°** ( `[0.88197,0.47130,~0]` → `[0.49081,0.87127,~0]` ) |
| walk time / bursts / recalibrations | 90 778 ms / 36 / 21 |
| final foot distance to E | 90.053 u |

32.49° > 12°, so the round's own walking invalidated the basis it had just recorded — a self-sustaining loop.

**Closure (bounded, live, no forbidden mechanism):**

- per-key direction stamped with the `up` measured at **that key's own** post-burst snapshot (`upAtSample`), never a pre-round latch;
- a stored direction is **retained through a smooth face change** while its `upAtSample` is within 45° of current *and* it still projects usably into the current plane (`chooseKey3d` already re-projects). 12° was a whole-basis latch bound; keeping it per-key would discard directions that still steer and would reproduce the thrash;
- **steerability ≠ freshness**: the motion guard may only be bypassed when *nothing* still projects usably. Conflating the two was the last hole found during testing;
- **meaningful directed motion** required between recalibrations (`minUnitsSinceCalib` = 6 u, ~3× the 1.878 u a round induces), accumulated from real foot displacement;
- **hard cap** `maxCalibrations = 6` — 21 rounds is unreachable; only stale keys are re-measured.

No teleport, setter, autopilot, rail, enlarged timeout or widened radius. A/D stay non-zero 3D on +X, the +Y frame stays proper, `stallVerdict` obstacle/no-progress detection is untouched, and arrival/steering use the published **FOOT** in full XYZ against live `up` — never a centre fallback.

## Defect 2 — object-truthiness [F] gate (closed in the private helper)

`promptOffersF` (`pinned/commonPassageLogic.pinned.mjs:582`) returns an **object**. The main probe assigned it at `:1164` and passed it into `newActionGate` (`:1171`) and `groundedActionGate` (`:1186`), both of which test truthiness only — so `{ok:false}` for an unrelated `[F] Drink` read as offered.

Authored contract, **read from shipped source, not guessed**:

- `main/src/story/commonGroundDirector.ts:1627-1636` — `survey.phase === 'drawing' && reach(CG_POSES.E, CG_POINT_REACH)` → `{ id: 'story-ch13-offer-span', verb: 'Offer the walked span' }`
- `:1552` — directive `ch13:survey:offer-span` → `vector(CG_POSES.E)`
- `beats/ch13/ch13-survey.ts:31,43` — "offer the walked span"; "Walking, and one [F]"

The neighbouring `story-ch13-hold-witness` / **"Offer this end"** (`:1645-1650`) is a different action for a different state. **Finding:** the existing `earned-continue-3d/selftest.mjs:213` used exactly that wrong verb as its positive fixture, so the original suite could not have caught the mismatch.

`signedSpanOfferAuthorization()` requires `mayPressF(...).ok === true` **and** current `objectiveId === story-ch13-offer-span` **and** `beat === ch13-survey` **and** `survey.phase === 'drawing'` **and** FOOT arrival from current ground evidence. It emits a **boolean only**; `gateInputsFromAuthorization` throws if handed an object, turning the attempt-1 defect into a hard error. F is never forced — the helper authorizes, it does not press. A later unrelated anchor or a generic phase change is refused.

## Commands and results

```
mkdir -p verifier/probes/continue-controller-closure logs/continue-controller-closure
cp -a verifier/probes/earned-continue-3d/. verifier/probes/continue-controller-closure/
node --check earned-continue-3d-probe.mjs            -> ENTRYPOINT_SYNTAX_OK
for f in *.mjs pinned/*.mjs; do node --check "$f"; done -> ALL_SYNTAX_OK
node -e "import('./liveCalibration.mjs')"            -> IMPORT_OK (10 exports)
node liveCalibration.selftest.mjs                    -> 34 passed, 0 failed
node tangentSteering3d.selftest.mjs                  -> exit 0, all CPU cases passed
node groundFrame.selftest.mjs                        -> exit 0, 25 checks, 0 failed
node selftest.mjs                                    -> exit 0, 108/108   (run EXACTLY ONCE, copy-integrity only)
```

Node v25.6.1. Logs: `logs/continue-controller-closure/{liveCalibration,tangentSteering3d,groundFrame,selftest}.selftest.log`, hashes in `probe-hashes.txt`.
The 108-check suite was **not** re-run during iteration; the edit loop used only `liveCalibration.selftest.mjs`.

New file hashes: `liveCalibration.mjs` `6afecbef…39c61`, `liveCalibration.selftest.mjs` `449c2e22…ef79d`. Copied-unmodified and read-only source hashes are in the JSON report.

## Dependency manifest (new probe)

`liveCalibration.mjs` imports only `./pinned/commonPassageLogic.pinned.mjs` (`mayPressF`) and `./tangentSteering3d.mjs`; exports `SPAN_OFFER_CONTRACT, tiltDeg, stampedCalibration, keysNeedingRecalibration, recalibrationDecision, accumulateDirected, dirsFromEntries, faceChangeRetention, signedSpanOfferAuthorization, gateInputsFromAuthorization`. The selftest additionally imports the **real** `chooseKey3d`, `groundedActionGate` and `newActionGate` — adaptation is proved against shipped exports, not a mirror. Pure CPU: no DOM, GPU, network or filesystem. Playwright is needed only at headed runtime. Existing shipped-browser-helper / headed GB10 / exclusive FD9 / identity / ownership-and-cleanup structure is retained; no duplicate preview.

## Preserved facts (unchanged by this role)

Landing + partial drawing before unload; menu-CTA-first Continue with no story-runtime wait before the click; raw all-4 pose keys + DOMStorage writes; all-WorldSave full-object-prefix equality (latest **19→20** passed; the prior **18→19** stays a separate record — counts are not blended). No game cause is established from the pose movement; world key order stays with the scope auditor. World / actor / prerequisites / no-replay / hold / support facts stand. No source patch inferred.

## Remaining repin requirements

1. Apply the adaptation **inside** the copied entrypoint: per-key `stampedCalibration` in place of the pre-round latch, and `recalibrationDecision` + `accumulateDirected` in place of the `:508` `basisStale` branch.
2. Swap `:1164`/`:1171`/`:1186` to `signedSpanOfferAuthorization` + `gateInputsFromAuthorization`.
3. Bind the live `objectiveId` source in the runtime bridge; if no field publishes the current action id, that is an observation gap and the gate must **refuse**, not fall back to prompt text.
4. Candidate repin of index/source hashes against the build actually served, after the integration lane settles.
5. Serial permission for `continue-controller-closure-runtime` + preview + headed GB10/FD9 before any browser step.
6. Full verification of the stable candidate remains outstanding.

**Non-claims:** nothing here says the game failed to restore anything; the attempt-1 walk failure is attributed to the private thrash, so route inaccessibility **cannot** be declared from it; no runtime evidence, no accepted action, no production-hash violation is asserted.
