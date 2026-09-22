# Arrival COMMON probe preparation — bounded instrumentation only

**Roles prepared:** `arrival-common-manual`, `arrival-common-earned`
**Runtime executed:** NO. No browser, no GPU, no preview, no capture, no build, no `npm test`.
**Game / shared source / contract / signature mutated:** NO.
**Machine-readable report:** `arrival-common-probe-prep-report.json`
(sha256 `648d8ee31767b51c73ea152678441635fcec7c98ab8170de3d967709a28249f4`).

## What was created

| New (owned) | Copied byte-exactly from |
|---|---|
| `verifier/probes/arrival-common-manual/` | `verifier/probes/common-manual-focused/` |
| `verifier/probes/arrival-common-earned/` | `verifier/probes/earned-continue/` |
| `logs/arrival-common-probe-prep/` (9 logs) | — |

**Originals are byte-exact.** Every file under both original folders was sha256'd
before any work and again after all edits; the two lists are identical (`diff`
empty). The eight before/after hashes are listed in the JSON report.

## Dependencies are pinned, not read live

`cgContract.mjs`, `ownedSession.mjs` and `sourceSnapshot.mjs` were copied into
each new probe folder as `*.pinned.mjs` and are imported from there, so a
concurrent edit to `verifier/probes/lib/*` cannot change these lanes' meaning.
The copies sit at the **same directory depth** as the originals, so
`cgContract`'s `RUN_DIR = resolve(HERE,'..','..','..')` and `REPO_ROOT` /
`CAPTURES` resolve exactly as before; each probe folder is a sibling of its
original, so `../../../../../../main/tools/lib/evidence.mjs` is also unchanged.
`evidence.mjs` is deliberately **not** copied (it transitively imports sibling
main tooling whose relative paths a copy would break); its hash at preparation
time is recorded in each `pin.json` so drift is detectable. CPU tests assert the
pinned bytes against `pin.json`.

## 1. Earned Origin gate — tightened (`arrival-common-earned`)

Per `producer-earned-continue-prep-review.json` → `requiredBeforeRuntime` 1 and 2,
`earnedOriginGate` now additionally requires:

- `landedActivePlanetId === '-1,-1'` **exactly** (the signed Origin) — not merely
  "different from the departure body";
- `anc.cg.origin-landed` present in the **named** `signedSceneAv.activationHistoryAnchorIds`;
- `anc.cg.origin-landed` present in the **chapter** fired-anchor history; and
- that the chapter anchor history was actually **read** (a `null` read is refused
  as UNMEASURED, never passed).

Everything already required is preserved: the real latched `story:ch13-origin-landed`
milestone (nothing preseeded), `surface`/`fps` modes, `supported === true`, a
finite grounded pose, a measured live frame rate ≥ `minFps`, the non-empty named
history, the array-shape check, and the raw `Object.keys(av).length` retained as
explicitly labelled **non**-evidence. All raw traces (full named history, fired
anchors, anchor id/event/beat, activation sequence, counts, and the two per-side
booleans) are reported on refusal **and** on pass.

Discriminating CPU checks, all passing:

| Case | Result |
|---|---|
| different wrong planet `3,7` (not the departure body) | refused, names the signed-Origin rule |
| near-miss `-1,-1:p2` | refused |
| **non-empty** lift-only AV history `['anc.cg.origin-lift']` | refused, raw history preserved |
| chapter-only origin history (AV lacks it) | refused, both sides reported |
| AV-only origin history (chapter anchors lack it) | refused |
| chapter anchor history not read (`null`) | refused as UNMEASURED |
| **exact earned all-state** (`-1,-1` + anchor in BOTH histories + grounded + fps) | **passes** |
| tightened gate with an unavailable signed-AV bridge | still refused |

The Continue lane is untouched: actual save bytes via the shipped
`beforeunload → doSave → saveWorld` path, no deep reseed on the Continue boot
(`?story=` / `movie=1` still refused), a real new physical action with its own
signed anchor, the by-name no-replay proof, and all preflight / role / lock /
served-identity / manifest-rehash / non-empty-capture guards.

The inherited "why a copy exists" run-4/run-5 narrative is retained only as
clearly labelled inherited prose with the producer's qualification stated inline.
No new claim rests on it.

## 2. Passive entry observation (both lanes)

`entryObservation.mjs` (identical in both folders) records, passively:
`pointerlockchange` / `pointerlockerror`; page `console` warn/error and
`pageerror`; per-click `isTrusted`, `pointerType`, `pointerId`, `buttons`,
`detail`, `sourceCapabilities.firesTouchEvents`, `target` and `currentTarget`;
focus state (`hasFocus`, `visibilityState`, `activeElement`, `pointerLockElement`,
`navigator.userActivation`); touch state (`maxTouchPoints`, `ontouchstart`,
pointer coarse/fine, `hover:none`, mounted touch-control DOM); and policy state
(`__storyInputPolicy`, permissions-API presence).

`describeEventTarget` fixes exactly the defect
`entry-discriminator-report.json` recorded — both observers threw
`TypeError: Cannot read properties of undefined (reading 'toLowerCase')` on a
window/document `currentTarget` — and handles Window, Document, Element,
element-like objects with a non-string `tagName`, text nodes, other node types,
plain objects, functions, primitives, `null`, `undefined`, and objects whose
getters throw. `entryObserverSource()` embeds `describeEventTarget.toString()`,
so the page-side function is literally the CPU-tested source, and a test asserts
that embedding.

**Explicitly not done:** no `requestPointerLock`, no forced or synthetic click,
no `dispatchEvent`, no game-handler patch, no injected key state, no focus or
permission/policy edit, no `preventDefault`/`stopPropagation` (listeners are
passive), and **no new loop, retry or timeout** — the prior 16:31 cause is
UNKNOWN and nothing was tuned to it. The manual lane keeps its ordinary
shipped-canvas click path (unchanged, up to 3 real clicks) and its pointer-lock /
focus gate byte-unchanged; observation gates nothing. Console sinks are bounded
(max 400) with overflow **counted**, never silently dropped, and absent fields
are reported as UNMEASURED rather than guessed.

Manual-lane guards preserved unchanged: ordered-plane/frontier verdicts, F
prerequisite gates, calibrated pulse/coast policy measured from the four live
holds, reference/deviation modes with the strict physical 18-unit COMMON route,
identity/lock/served-byte ownership, non-empty output refusal, before/after source
snapshots, and the owned-session cleanup guard.

## Role and release binding

`activeRole` is hardcoded as `arrival-common-manual` (passed to
`preflightDecision`; a different `activeRole` in `verifier-control.json` refuses
launch) and `arrival-common-earned` (default `--role`). Each lane expects its own
**separate** root release passing the **current** URL, the **new** source-manifest
sha256 and the current served index/bundle hashes. No old port `38007` and no old
`dc63fba…` manifest is a default anywhere; they appear only inside labelled
**unexecuted** CLI examples as placeholders. The earned lane's header no longer
states a "99 file" manifest count — it re-hashes every path the **current**
manifest lists at release. `--out` must now be **absolute** in both probes.

## CPU tests run (this preparation only)

| Command | Exit | Result | Duration |
|---|---|---|---|
| `node verifier/probes/arrival-common-manual/selftest.mjs` | 0 | **112/112 passed** | 493 ms |
| `node verifier/probes/arrival-common-earned/selftest.mjs` | 0 | **108/108 passed** | 82 ms |
| `node verifier/probes/arrival-common-earned/earned-continue-probe.mjs --self-test` | 0 | OK (no browser) | 267 ms |
| `node --check` on 6 entry/logic modules | 0 | 6/6 clean | — |

The manual selftest includes the real private-localhost HTTP served-identity
binding/refusal fixture and the real inherited-flock kernel lock-ownership test.
Log paths, byte sizes, sha256s and timestamps are in the JSON report.
Inherited → current check counts: manual ≈95 → 112, earned 69 → 108.

## Not measured, not claimed

- Manual COMMON reference/deviation remain **NOT MEASURED**.
- The 16:31 entry failure cause remains **UNPROVED**; the new observation would
  record a *future* refusal's own native reason, and explains nothing about the past.
- The tightened gate is a **refusal rule**, not evidence a landing occurred. No
  Continue, AV, chapter, playability or performance acceptance is implied; `minFps`
  stays an operational probe threshold.
- Live `main/src` bytes were deliberately not hashed as if frozen (the game
  integration engineer is editing concurrently). Only the immutable
  `iterations/arrival-common-findings/source` snapshot was referenced.

## Owner decision left open

`arrival-common-earned/pinned/commonPassageLogic.pinned.mjs` is a second-generation
pin (a copy of the earned-continue pin, itself a byte pin of the manual helper).
All three byte sets are currently identical (`24d67c65…`). By design this lane will
not follow future edits to the manual role's live helper; re-pinning is an explicit
owner decision.

**Independent runtime: PENDING.** Both lanes are prepared only.
