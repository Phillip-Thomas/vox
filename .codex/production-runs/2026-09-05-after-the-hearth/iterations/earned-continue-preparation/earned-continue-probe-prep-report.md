# Earned return → Continue probe: PREPARATION report

**Prepared 2026-09-06 · story-verifier (mechanical) · claude-opus-5 · run 2026-09-05-after-the-hearth**

**This is not a capture result.** A probe copy plus owned helpers were written and
CPU-self-tested. No browser, GPU, preview, shared lock, game source or canonical
metadata was touched. **No earned Continue has been tested**, and nothing here is
ready-to-accept.

## What was prepared (owned paths only)

| File | sha256 |
|---|---|
| `verifier/probes/earned-continue/earned-continue-probe.mjs` | `9cf273eb…1ffa69` |
| `verifier/probes/earned-continue/earnedContinueLogic.mjs` | `71973321…c696b7` |
| `verifier/probes/earned-continue/selftest.mjs` | `7522468a…2e7514` |
| `verifier/probes/earned-continue/pinned/commonPassageLogic.pinned.mjs` | `24d67c65…19060c` |
| `verifier/probes/earned-continue/pinned/pin.json` | `9adaa45f…7d4057` |

The probe began as a byte copy of
`verifier/probes/partial-continue/partial-continue-probe.mjs`
(`fb1d4e2f…9a7b4d8d`, still unchanged) and was patched in place. Every historical
capture under `verifier/captures/partial-continue/` (run-1…run-5, earned-1,
earned-2) is untouched; this lane writes to `verifier/captures/earned-continue/`.

**Pin:** the manual COMMON role owns `common-manual-focused/commonPassageLogic.mjs`
and edited it at 16:25:52Z during this window. The lock/served-identity/preflight
primitives are therefore imported from a **byte-exact pin** taken here, never from
the live manual-role file. No manual-role or shared-probe file was edited.

## Lane the probe encodes

0. **Preflight, no browser** — root readiness, `verifier-control` action/activeRole,
   an **inherited** exclusive flock receipt (fd 9; the probe never opens the lock),
   the **actual served index+bundle byte hashes** fetched before Chromium exists, a
   dynamic re-hash of all 99 manifest source files, and a non-empty capture refusal.
1. **Earned return** — `?story=ch13-return&journeyprobe=1&debug=1&movie=1`, the
   labelled INITIAL prerequisite fixture. **No preseeded origin landing.** The
   movie-scripted physical flight must earn it; the gate requires the latched
   `story:ch13-origin-landed`, a real `activePlanetId` handoff off the departure
   body, `surface`/`fps`, grounded `supported=true`, a live rAF-measured frame rate,
   and **non-empty NAMED signed-AV anchor history** sampled over time.
   *A failed prerequisite stops the lane here — no drawing, save, Continue or [F].*
2. **Partial drawing** — movie rail plus ordinary shipped WASD bursts (labelled
   `scripted-input`) to ≥ 4 real samples, then the capture is **caught at once**;
   an already-fired `route-offered`/`route-tested` is refused as impure.
3. **Shipped save** — the real `beforeunload → doSave(true)` autosave; the actual
   per-world **and** global localStorage bytes are written out before close.
4. **Real Continue** — plain boot, **no story deep link, no movie rail** (asserted),
   storage retained (key set compared), real CTA click. The menu label alone is
   never proof.
5. **Restoration proof** — world-key prefix / world id / seed / live `activePlanetId`
   at save vs after Continue / actor milestones; earned samples still on disk; no
   replayed anchor, pending re-queue or install/arrival cue re-fire.
6. **One NEW physical action** — ordinary keys to the remaining drawing end E, then
   `[F]` **only when the shipped prompt literally offers it**; acceptance is a newly
   fired NAMED anchor and/or an advanced AV activation sequence.
7. **Cleanup** — owned session try/finally, post-finally receipt, root preview never
   stopped, source re-hashed after the capture.

Explicitly refused as proof: file-vs-file byte comparison, `Object.keys(av).length`,
predicted anchors, stale static id mappings, the menu label alone, a return deep-link
fixture, forced clicks, JS interaction shortcuts, pose/progress/milestone setters.

## Self-tests actually run (CPU only, no GPU)

| Command | Exit | Evidence |
|---|---|---|
| `node verifier/probes/earned-continue/selftest.mjs` | **0** — 69/69 checks | `logs/earned-continue-prep/selftest.log` `4880bbea…59a4` |
| `node …/earned-continue-probe.mjs --self-test` | **0** | `logs/earned-continue-prep/probe-self-test.log` `c53cf7ff…7d56` |
| `node …/earned-continue-probe.mjs --out prep-refusal-check` (no bindings) | **1**, `PREFLIGHT-REFUSED` before any browser | `no-args-refusal.log` `d09ac896…a556`, receipt `preflight-refusal-no-bindings.json` |
| `node …/earned-continue-probe.mjs --out … --url http://127.0.0.1:38007/ --expect-source-manifest dc63…36c` | **1**, after binding the served bytes | `served-identity-check.log` `b75ac1fd…a746`, receipt `preflight-served-identity-bound.json` |

The fourth run fetched the live root preview over HTTP only (no browser, no GPU) and
bound it: served index `1f699b4a…30260` and bundle `4f39f1ea…3b0ec4` both equal
root's published hashes, and the 99 manifest files re-hashed **intact** to
`dc63fbae…dc36c`. The two remaining refusals are exactly the root-controlled
prerequisites: `activeRole=common-manual-focused, not earned-continue`, and no
inherited heavy-lock descriptor. Both prep capture folders were removed; the
receipts live in `logs/earned-continue-prep/`.

## Prepared runtime command (do NOT run while the manual COMMON role is active)

```sh
exec 9>>/home/thomasphillip/Projects/Paraform/harness/output/.heavy.lock
flock -n -x 9 || { echo 'heavy lock busy'; exit 1; }
URL=$(python3 -c "import json;print(json.load(open('verifier/artifacts/preview-ownership.json'))['url'])")
node verifier/probes/earned-continue/earned-continue-probe.mjs \
  --out earned-continue-1 \
  --url "$URL" \
  --expect-source-manifest dc63fbaeacea44166f41b4d9307bc2e31307fc28845c69512f75c7d641adc36c \
  --heavy-lock /home/thomasphillip/Projects/Paraform/harness/output/.heavy.lock \
  --heavy-lock-fd 9 --role earned-continue \
  --min-samples 4 --return-ms 180000 --earn-ms 120000 --walk-ms 90000
```

`--url` is compared against whatever `preview-ownership.json` publishes **at actual
release**; no port is hardcoded. The lock is acquired by the invoker and only
inherited by the probe.

## Remaining live steps

1. Root publishes an `earned-continue` active role (today: `common-manual-focused`).
2. The invoker acquires the exclusive shared flock and passes fd 9.
3. `--url` / `--expect-source-manifest` taken from root's release-time publication.
4. One headed GB10 run with a fresh `--out`. Every phase above is **unexecuted**.

## Known limitations

- Not a capture, verification or acceptance; no restoration, no-overwrite, no-replay
  or new-anchor claim exists yet.
- The `ch13-return` deep link stays a labelled prerequisite fixture — this lane says
  nothing about a continuous station/home journey into ch13.
- The movie rail is scripted input; ordinary-key assistance is labelled as such and
  never counted as a zero-rescue movie success.
- `flight-1` landed once in 73.8 s; earned-1/earned-2 never landed, so `--return-ms`
  may still expire and stop the lane at the gate.
- The earn phase inherits the known VF4-SURVEY-STALL-1 rail stall.
- FPS is a passive rAF count, not `__game.metrics()` — `?agent=1` would install the
  scriptable AgentCamera bridge and change what draws.
- Preview binding covers the served index, the one published bundle and root's
  matched-file **count**; other built files are unmeasured.
- A later manual-role edit does not reach this lane; re-pinning is a deliberate act.

## Unresolved issues

- **BLOCKING** — the lane cannot run until root grants the active role and the
  inherited heavy lock. Both refusals fire right now.
- **UNKNOWN** — whether the shipped resume ladder lands an earned save in
  `ch13-survey` at all. With `origin-landed` absent, run-5 lawfully resumed into
  `ch13-return` on the sibling body; with it present the resume point is untested and
  the lane may legitimately stop at `EC-CONTINUE-RESUME-POINT`.
- **UNKNOWN** — whether the shipped save writes the earned samples for the Origin
  world key after a real flight. Run-5's `PC-SAVE-OVERWRITTEN` was observed with the
  incomplete fixture and must not be assumed to transfer.
- **UNVERIFIED BY ME** — the span end `E = [-42, 51.05, 12]` is inherited from the
  parent probe and was not re-derived from the current authored route; a wrong end
  point would show up as a walk that never arrives, not as a false pass.
