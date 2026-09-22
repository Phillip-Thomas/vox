# Continuity Preflight — station exit → carried bonded cell → Tidegarden install → ch13-home

Read-only. No browser, GPU, server, test, build, source or probe change. Source manifest `2de3fa2a…9f63`; root preview `http://127.0.0.1:34825/` untouched. Wall window used: 2026-09-07T00:15Z–00:23Z.

## 1. Existing probes and their real reach

| Asset | Path | Reach for this journey |
|---|---|---|
| Chapter journey probe (repo, canonical) | `main/tools/chapter-journey-probe.mjs` | CLI parsed at L209–244: `--chapter --scenario --lane{continuous,direct-entry,resume} --mode{manual,movie} --url --browser --profile --viewport --timeout-ms --output --report --run-id --headed --hardware-only`. Node builtins only (L17–22) — **no repo helper imports**, so no adaptation of helpers is needed. Default browser `/snap/bin/chromium` (L36). Lane honesty enforced: `direct-entry` is stamped `direct-entry-reconstructs-prerequisites-and-does-not-prove-continuity` (L261-ish `classifyLane`), and headless manual is refused as proof of pointer-lock (L261, L1971–1974). |
| Sibling run-local probe (**source100 provenance — labelled, not relabelled**) | `.codex/production-runs/2026-09-05-after-the-hearth/verifier/probes/common-movie-candidate/journey-probe.mjs` (schema `paravoxia.verifier.cgJourneyProbe.v2`, sha256 `bab7c633…3a36`; header L1–36 declares it v2 of `cg-lifecycle-probe.mjs`, run-local, v1 left untouched) | Beat-scoped: `--beat --lane --seconds --until-beat/--until-anchor/--until-objective/--until-objective-clear/--until-milestone --strip-s --percept`. Siblings it imports: `cgContract-v3.mjs`, `movie-preflight.mjs`, `resolve-imports.mjs`, driver `run-common-movie-candidate.sh` (same dir). It enters by **URL deep link** (`?story=<beat>&journeyprobe=1&debug=1&movie=1`), so it cannot by itself prove station→ch13 continuity. |

## 2. Start state: fixture vs earned

`main/src/story/storyState.ts` L613–650 is the decisive line. Any entry with `at >= beatIndex('ch13-home')` seeds the whole prior boundary as a **rehearsal fixture**: ch9/ch10 receipts (L622–637) plus, explicitly, `story:ch11-station-departed`, `story:ch11-bonded-cell-acquired`, `story:ch12-bonded-cell-installed`, `story:ch12-hearth-restored` (L645–648), then **deletes any carried cell** (L649–650). The comment at L642–644 states the intent: seeded consumed state, "reproduced, never reissued".

Consequence, stated plainly:
- A `?story=ch13-home` deep link is a **diagnostic fixture**, never station continuity.
- The seeded `ch12-bonded-cell-installed` is a **seeded installed save**, never earned installation.
- The real transaction lives in `main/src/story/stationReturnStory.ts`: `stationReturnPending` requires departed + acquired + NOT installed + `getItemCount('bonded_cell') > 0` (L38–43); the earned install is `installTidegardenBondedCell` (L106–134) gated on world `TIDEGARDEN_WORLD_ID`, live habitat core, and player distance ≤ `INSTALL_REACH = 4.2` (L23, L126–127), consuming the item via `removeItem` (L128) before marking installed+restored (L130–131). Objective/marker copy is real player work: `TIDEGARDEN · SECOND HEARTH` travel then `SECOND HEARTH · INSTALL BONDED CELL` with `[F] INSTALL THE SEALED CELL.` (L56–83); interaction id `story-ch12-install-bonded-cell`, class `required` (`main/src/story/storyInteractions.ts` L135).

**ch11/ch12 are milestone namespaces, not beats.** `main/chapter-journey-contract.json` declares ch13 continuity `before: ["ch10"]`, `after: []` (L2196–2203) and ch10 `after: ["ch13"]` (L2001–2008). `storyState.ts` L78–79 and L190 say the station visit and the return/install are "the prior contract's transaction, not beats". No new chapter is claimed here from milestone names.

## 3. Command that would exercise it, and the private adaptation still missing

Nearest honest existing invocation (blocking lanes per contract L15–38):

```
node main/tools/chapter-journey-probe.mjs --chapter ch13 --lane continuous --mode manual \
  --headed --hardware-only --url http://127.0.0.1:34825/ \
  --output <run>/verifier/captures/continuity-preflight --run-id <id>
```

Adaptation required before this proves the requested journey: the contract has **no chapter node whose predecessor entry is the station exit carrying a live cell** — `--chapter ch13` enters at ch13-home, i.e. downstream of the install. Exercising (1) needs a scenario that starts inside ch10's station-resolved/docking-authorized state (contract L2020–2030) and drives departure → cell acquisition → Tidegarden surface → `[F]` install through trusted headed input, with `bonded_cell` count and `story:ch12-bonded-cell-installed` asserted as *transitions*, not preconditions. `.codex/production-runs/2026-08-11-ch10-station-introduction/station-continuation-contract.md` is the right place to read the exact entry facts for that scenario; it was not opened inside this window.

## 4. Durations — measured vs guessed

Measured (three cold runs, `verifier/captures/common-movie-candidate/attempt-20260906T221545Z-run{1,2,3}/summary.json`), all `?story=ch13-common&movie=1` → `--until-beat done`, headed, `rendererClass: "hardware"`, ANGLE/NVIDIA GB10:

| Run | elapsedMs | stopReason |
|---|---|---|
| run1 | 36348 | reached-beat:done |
| run2 | 36425 | reached-beat:done |
| run3 | 36262 | reached-beat:done |

Variance 163 ms across runs — the ch13-common→done tail is stable. These summaries also state `outcomeIsAcceptance: false`.

Guessed maxima (not measured, label as such): full station→ch13-home continuous manual lane plausibly 6–12 min wall; full `?story=1&movie=1` movie flow plausibly 20–45 min. No existing trace in this run measures either.

## 5. Unresolved coverage (concrete)

1. **No evidence anywhere in this run for a continuous station-exit → carried-cell → install → ch13-home traversal.** Every `common-movie-candidate` and `arrival-common` capture starts at a ch13 deep link, which L613–650 fixtures.
2. **No earned-install artifact**: no trace observes `bonded_cell` count going 1→0 or `story:ch12-bonded-cell-installed` transitioning false→true from player input.
3. **No full-movie zero-rescue evidence**: no `?story=1&movie=1` summary exists in this run; the longest measured span is a single 36 s beat tail.
4. **Lane gap**: contract requires six lanes for ch13 (L2238–2242); only movie-mode deep-entry samples are present.
5. Root's ch10→ch13 adjacency plus the ch11/ch12 milestone strings is a modelling seam worth an explicit root decision; not decided here.

Root retains sequencing and source authority. No acceptance decision made.
