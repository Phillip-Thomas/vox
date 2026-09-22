# continue-spawn-verifier progress

Role: `continue-spawn-verifier` (independent, fresh). Source stays frozen; no source repair by verifier.
All paths RUN-relative unless absolute.

## Phase A — COMPLETE (CPU only, not gated on ready flag)

Receipt: `logs/continue-spawn-verifier/build-ready.json`

| item | result |
|---|---|
| source manifest sha256 | `2de3fa2aef0d577bdeca7fe9eaa4612751b2946115207fa9c18d2e8613bb9f63` — **matches** commission |
| 3 candidate source hashes | all match `producer-continue-spawn-source-review.json` |
| missing node typecheck | `npx tsc --noEmit -p tsconfig.node.json --pretty false`, cwd `main`, exit **0**, 2026-09-06T23:25:56Z |
| build | `npm run build`, cwd `main`, exit **0**, 23:26:21Z→23:26:27Z |
| dist | 11 files, buildHash `974ddaa688eb835c3d08523af6d51aa36e0a168ac9ae6d124807b3ce93a98ec1`, index `74025800f5312519a92b480a15b493c3b27f971f0cbcbe1ec2b571342d4f4c82`, bundle `/assets/index-Ddqg7x9Y.js` |

Reused (not re-run to relabel): engineer app typecheck (`tsconfig.json`, exit 0) and 8-file/101-test focused
vitest. Both log sha256 **re-verified byte-identical** to the source review before reuse. Only the genuinely
missing `tsconfig.node.json` portion was run.

No full verify yet. No GPU started. Old preview 37395 (`8962a7b2…` manifest, build `0a18affc…`) remains
baseline, not candidate — my candidate bundle `index-Ddqg7x9Y.js` differs from its `index-C1X65dZp.js`.
My build wrote only `main/dist`; root's immutable preview snapshot `/tmp/paravoxia-preview-KRdICI/dist`
was not touched. I did not start, stop or touch any server.

## Phase B — probe prepared, BLOCKED on root handoff

Owned folder `verifier/probes/continue-spawn-candidate/` (same depth as `continue-candidate/`, so the
probe's `../../../../../../main/tools/lib/evidence.mjs` import still resolves; no nested-depth copy).

- Copied working probe + helpers from `verifier/probes/continue-candidate/`. Self-test **108/108 pass** in
  the owned folder.
- Helper pins verified as verifier-helper *source* pins only. No old minified bundle pins are present or
  attached; none will be reused against the new bundle. Prior closure's pose observer is treated as causal
  baseline only.
- Preserved unchanged: raw `beforeunload` saves, real landing CTA click **before** the runtime wait, full
  point-object equality, per-rAF player/world/actor/seed/foot/HUD window for 5 s past first valid runtime,
  and the original flight 180 s / earn 120 s / walk 90 s bounds. Late serialized saved samples are compared
  against the **restored prefix**, not against the early live checkpoint. No fake clock estimates.
- `run-continue-spawn.sh` — the one owned shell launcher. It opens the shared
  `/home/thomasphillip/Projects/Paraform/harness/output/.heavy.lock` on **FD9** and `flock -x 9`, then
  `exec node` so the probe **inherits FD9** and proves kernel+contender ownership itself. Uses
  `--role continue-spawn-verifier`. Real headed GB10 via the existing owned helper; no headless NVIDIA.
- `repair-check-plan.json` — concrete executable plan for `creative:repair:check`. `runtime[0]` is the real
  browser Continue+[F] step through the launcher (never an artifact-reading substitute). Root may inspect
  both files during handoff.

**Waiting on root** (I will not touch root's server or start my own): NEW `verification-ready.json`
(`ready: true`) plus a NEW immutable preview whose served **manifest + index + bundle** bind exactly to
`2de3fa2a…`. Current state is `ready: false`, `invalidatedAt 2026-09-06T23:15:21Z`, manifest `8962a7b2…`,
`verifier-control.json action: hold` — so GPU has not started and will not until that exact binding exists.

At handoff I re-hash the served index/bundle at release (not remembered from preparation), fill
`PVX_URL`/`PVX_MANIFEST`/`PVX_OUT` (absolute, fresh), snapshot probe bytes per attempt, then invoke
`creative:repair:check`, and `--final` once for the stable candidate so the single `npm run verify` runs
after the runtime passes. Earlier 352 files / 3192 tests are baseline, not candidate.

Acceptance stands as commissioned: Continue must be actually **earned** from ch13-return flight/landing —
no seeded saved scene or completion, no setters, resume hook, teleport, scripted route grant or movie rail
for the post-Continue action. Stop at first causal game defect. Helper refusal or an unattempted action is
not a game [F] failure.

## Exit-gate addendum — HANDLED (root requirement, awaiting inspection)

Confirmed the hazard in source: `earned-continue-3d-probe.mjs` writes `summary.json` at line 1557 on the
normal path but sets `process.exitCode = 1` only in the catch (line 1564). A bare probe argv could therefore
exit 0 with `requiredGates.allHeld=false` / `actualAcceptedNewAction=false` and let `creative:repair:check`
run the full suite and mark its report passed **despite a missing player action**.

Fixed in my PRIVATE launcher only (no source change): `run-continue-spawn.sh` now runs the real browser
probe, then post-checks the SAME freshly written capture and returns nonzero. It requires `allHeld`,
`actualAcceptedNewAction`, `worldSaveEquality`, `continueTelemetryComplete`, any other `false` gate, and
`phases.newAction.offer.accepted === true`, and also fails on a nonzero probe status or a missing capture.
It never manufactures a pass, never weakens `allHeld`, never mutates game state, and artifact reading is
strictly the post-check — the runtime step remains the real probe.

Fail-closed selftest (CPU only): `logs/continue-spawn-verifier/exit-gate-selftest.log`
| case | exit |
|---|---|
| probe exit 0 but new [F] not accepted | 93 (fail) |
| all gates held, probe exit 0 | 0 (pass) |
| all gates held but probe exit 7 | 93 (fail) |
| missing `summary.json` | 92 (fail) |

Files for root inspection before GPU handoff:
`verifier/probes/continue-spawn-candidate/run-continue-spawn.sh` sha256 `c91bdba9b8f9fada941aa07dffd46ca205df567745587a0cc9519b94c86adced`,
`verifier/probes/continue-spawn-candidate/repair-check-plan.json` sha256 `18302fc3ed9c9ba7e4c3da1ae3686452fd7bb9107b928bd1cb499f0cbaf52cd2`.

I will not compare the early live 4-point checkpoint against later 16-point `beforeunload` data, and will not
read expected freshly appended samples as lost saved points; any mistaken comparison will be corrected
explicitly with raw values and retained before/after evidence.

## Current block

`verification-ready.json` is now `ready: true` bound to `2de3fa2a…` (gate checks 1764, `invalidatedAt: null`,
readyAt 23:32:11Z). **But `verifier-control.json` still reads `action: hold` with the OLD preview**
(`currentPreviewUrl 127.0.0.1:37395`, `currentIndexSha256 a9b8803…`, `currentBuildHash 0a18affc…` — the
`8962a7b2…` baseline). Root's own instruction: "GPU remains HOLD until new root preview and root inspection
of strict runtime verdict handling." So **no GPU has been started**. Phase B remains blocked pending
`action: continue` plus a new immutable preview whose served manifest+index+bundle bind exactly to
`2de3fa2a…`, and root's inspection of the launcher above.

No taste, defect-closure or chapter-acceptance claim is made here.

---

# 23:38Z — STRICT PRIVATE VERDICT READY FOR ROOT INSPECTION (supersedes the "Current block" section below)

All four missing mandatory fields from `verification-continue-spawn-runtime-review.txt` are implemented in my
PRIVATE launcher chain only. No source change, no game-state mutation, no preview started/stopped, no GPU yet.

New file `verifier/probes/continue-spawn-candidate/strict-verdict-gate.mjs`
sha256 `60f76cf830ef53bd48b70bd29ab05cc88c4ee1f5eed9a269bcdcf67c72d1c4f9`
invoked as the post-finally step of `run-continue-spawn.sh`
sha256 `79ccbf543143063483b555333bbdd3f15e90655028052c4f3240d1175e8c515e`.

1. **Post-finally cleanup + source gate.** Reads `cleanup-receipt.json` (NOT `summary.cleanupPreFinally`) and
   requires `state === "stopped"`, `cleanupCompleted === true`, `sessionStopped === true`, no `cleanupError`.
   Reads `source-rehash.json` and requires `stableAcrossCapture` plus `before.intact` and `after.intact`.
   The probe's existing preview/hardware preflight checks are retained untouched.
2. **True full point-object prefix equality.** Compares the serialized LATE saved
   `commonGround.survey.working.samples` FULL objects from the raw `worldsave-<key>.json` bytes against the
   corresponding first N of the raw `worldsave-after-continue-<key>.json` samples, index by index, plus
   `worldId`/`seed` identity from those same bytes. Points appended after the prefix are LEGITIMATE and never
   rejected. `survival.overwrite` (counts + whole-WorldSave sha) is PRESERVED verbatim as an explicitly named
   diagnostic only; it is no longer treated as prefix equality. `requiredGates.worldSaveEquality` stays strictly required.
3. **Scoped centre-to-centre pose.** The unscoped `'.player'` foot-vs-saved-centre lookup is NOT used as
   position proof. The gate resolves the SCOPED key `savedPrimary.key + '.player'` from
   `phases.pose.menuBeforeContinueClick` (falling back to the late beforeunload/menu-boot snapshot) and
   compares CENTRE to the restored CENTRE (`telemetry.samples[].frame.capsule`) inside the COMPLETE Continue
   telemetry, also requiring `completeness.complete === true` for the full 5s valid tail. Horizontal
   displacement > 5u fails; a ~100u relocation fails; ordinary vertical settling is reported separately and
   never fails on its own.
4. **Fail-closed exit.** Missing OR false prefix / pose / cleanup / source proof exits nonzero — not just
   `allHeld`. The existing mandatory new-[F] / `anc.cg.route-offered` / no-replay identities and
   `phases.newAction.offer.accepted === true` remain strictly required and are never weakened.
5. **Duplicate focused tests removed.** `repair-check-plan.json`
   sha256 `9d2517e8e6ae63f571798e613167b33424df7e915495ba73d8f262677f47b150` now has `checks: []`; the 15-test
   `playerSpawnSelection` suite and the 101 focused tests are already verified on this exact source
   `2de3fa2a`. `tools/repair-check.mjs` ITSELF mandates and appends `['npm','run','verify']` to the final
   group, so the single full stable suite runs exactly once, under `--final`, only after the strict runtime passes.

Fail-closed selftest (CPU only, no browser): `logs/continue-spawn-verifier/strict-gate-selftest.log`
— 14 cases: identical prefix + 3 appended points PASS; mutated saved point 93; lost points 93; ~100u ship
jump 93; ordinary vertical settling PASS; worldId/seed mismatch 93 (with the retained raw correction that the
first seed row's fixture, not the gate, was wrong); missing cleanup receipt 93; cleanup not stopped 93; source
changed 93; missing source-rehash 93; new [F] not accepted 93; incomplete 5s telemetry 93; probe exit 7 -> 93;
missing `summary.json` 92.

## Current state — READY, awaiting root release

Preview binding confirmed NEW from control: `http://127.0.0.1:34825/`, manifest `2de3fa2a…`,
index `74025800…`, bundle `/assets/index-Ddqg7x9Y.js` `4b41a7d5…`, root `ready: true`, gate checks 1764 PASS.
Canonical daemon `buildHash 580d08f7` is accepted; my earlier `974dd…` was a different serialization of the
exact same 11-file map, not source drift.

`verifier-control.json` still reads `action: hold` as of my last poll, so **no GPU has been started** and no
browser exists. Phase B (one real earned-Continue + new grounded [F] under the heavy lock on FD9, then one
`creative:repair:check --final`) starts the moment control reads `action: continue`. No taste, defect-closure
or chapter-acceptance claim is made.

## 23:39:46Z — GPU RELEASED, but Phase B does not fit the fixed deadline. No GPU started.

`verifier-control.json` flipped to `action: continue` at `2026-09-06T23:39:24.514427+00:00` (observed 23:39:29Z
by 10s polling of the CURRENT file; the earlier CLI's 23:34:09Z end was from a stale snapshot and is not repeated).

Absolute deadline `23:45:21.343614Z`. Remaining at release: **334 s**.
The probe's DECLARED phase bounds alone are flight 180 s + earn 120 s + walk 90 s = **390 s**, before browser
boot, landing, the beforeunload save + menu navigation, the Continue click, the mandatory 5 s valid runtime/foot
tail, the new grounded [F], post-finally cleanup, and the single `npm run verify` that
`tools/repair-check.mjs` appends under `--final`.

334 s < 390 s. The only way to start would be to shorten the original flight/earn/walk bounds, which is
explicitly prohibited, and it would guarantee a headed GB10 browser holding the shared heavy lock at the
deadline with no completed post-finally cleanup receipt. **Therefore no GPU was acquired, no browser was
launched, no heavy lock was taken, and no capture directory was created.** No fake clock estimate, no
weakened gate, and no artifact-reading substitute for the runtime step is offered in its place.

Phase B is READY TO RUN UNCHANGED on the next budget, against preview `http://127.0.0.1:34825/`
(manifest `2de3fa2a…`, index `74025800…`, bundle `4b41a7d5…`):

    export PVX_URL=http://127.0.0.1:34825/
    export PVX_MANIFEST=2de3fa2aef0d577bdeca7fe9eaa4612751b2946115207fa9c18d2e8613bb9f63
    export PVX_OUT=<absolute fresh dir under verifier/captures/continue-spawn-candidate/>
    npm --prefix main run creative:repair:check -- \
      --plan .codex/production-runs/2026-09-05-after-the-hearth/verifier/probes/continue-spawn-candidate/repair-check-plan.json \
      --out <fresh evidence dir> --final

No taste, defect-closure or chapter-acceptance claim is made.
