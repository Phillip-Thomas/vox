# Continue pose scope audit (bounded CPU, read-only)

**Role:** continue-pose-scope-audit · **Budget:** 10 min max · started 16:35:52-04:00
(20:35:49Z). Actual end time recorded by `date` in
`logs/continue-pose-scope-audit/endedAt.txt` — not handwritten.

**Record correction (prior audit preserved, not modified):**
`continue-pose-source-audit.json` carries a handwritten `endedAtUtc` of
20:42:40Z. Its own `-result.json` gives `duration_api_ms: 130605` from
`startedAt 20:31:08Z`, i.e. an actual end of ~20:33:19Z. The original file is
left byte-intact.

---

## VERDICT

**Cause re-classified and narrowed.** The earned pose restore **succeeds**. The
pose is then **clobbered after a successful restore** by a story-world excursion
to the sibling planet and back. The prior audit's ranked candidate #1 — a
`loadPlayerPose` scope mismatch returning `null` — is **falsified by the
recorded trace**.

No fidelity defect is confirmed. No patch is proposed.

---

## The finding that unlocks everything: `:p1` is a PLANET, not a scope

`src/game/starSystem.ts:90-94`

```ts
export function planetWorldId(address: PlanetAddress): string {
  const normalized = normalizePlanetAddress(address);
  const systemId = coordinateKey(normalized.system);
  return normalized.slot === 0 ? systemId : `${systemId}:p${normalized.slot}`;
}
```

`:p1` is the **planet slot segment inside the worldId string**. It is not an
actor id, not a multiplayer scope, not a migration namespace.

`src/game/starSystem.ts:96-104` binds both recorded seeds to slots:

| Key | Slot | Seed | Identity |
|---|---|---|---|
| `pvx.v1.world.-1,-1.player` | 0 | 3215739679 | Story **origin** |
| `pvx.v1.world.-1,-1:p1.player` | 1 | 1600321158 | **Tidegarden** sibling |

So the two keys are **two different planets**, and the whole "base pose copied
into the `:p1` key" framing describes a **planet excursion**, not a copy.

## There is no copy writer

Exhaustive grep for `.player` in `src` yields exactly three sites, all in
`persistence.ts`: `459` (`savePlayerPose` write), `465` (`loadPlayerPose` read),
`515` (`clearPlayerPoseForWorld`). **Nothing copies a pose between worldIds.**
The `:p1` write is an ordinary `savePlayerPose` made while `currentWorld` was
Tidegarden and the live pose was still the earned origin pose.

## The restore actually worked

`verifier/captures/earned-continue-3d/attempt-1/trace.ndjson` idx **107**,
phase `continue`, beat `ch13-survey`:

```
bodyCentre [-31.990680694580078, 52.78897476196289, 21.41554069519043]
```

That is the earned +Y exit pose, **live, after Continue**. `loadPlayerPose`
returned non-null; the worldId string matched; `EfficientScene.tsx:365-381`
took `resumeIsSafe = true` and returned `savedPosition` verbatim — exactly what
the prior CPU replay predicted. The +X pose appears only at idx **108**, one
sample (~1s) later:

```
idx 108  bodyCentre [53.567710876464844, 13.5, -14]
```

Prior candidate #1 is dead. So is the validator/rescue path, and so is
`storyAnchoredSpawn`.

## Recorded write order (logs/continue-pose-scope-audit/ordering.txt)

| idx | key | value |
|---|---|---|
| 61 | `…-1,-1.player` | earned pose `[-31.99, 52.79, 21.42]` (at exit) |
| 62 | — | storage clear / navigation |
| 71 | `pvx.v1.global` | menu boot |
| **75** | `…-1,-1:p1` | Tidegarden WorldSave, seed 1600321158 |
| **76** | `…-1,-1:p1.player` | **earned pose written to the SIBLING planet** |
| **79** | `…-1,-1` | origin WorldSave, seed 3215739679 |
| **80** | `…-1,-1.player` | **`[53.75, 13.5, -14]` — arrival shell overwrites the earned pose** |

The sibling write precedes the origin overwrite. The player moved from the +Y
face (radius 65.34) to the +X arrival shell (radius 57.16).

## Causal chain

1. Continue mounts on the **origin**. `globalsave.json` has
   `lastPlanetWorldId: "-1,-1"`, and with beat `ch13-survey`
   `resolveStoryBootWorldId` sets `originOwnedBeat = true` →
   `STORY_PRIMARY_WORLD_ID`. The earned pose restores correctly (trace 107).
2. A **story-world swap** fires. `App.tsx:537-545` recomputes
   `storyRuntimeWorldId` on **every render**; `App.tsx:624-634` immediately does
   `setPreviousWorld` / `resetSceneReady` / `setCurrentWorld` whenever that
   answer differs. `currentWorld` becomes `-1,-1:p1`.
3. The save effect's cleanup (`App.tsx:1458-1460`, `doSave(false)` →
   `savePlayerPose(world)`) runs with the live pose still equal to the earned
   origin pose → **domstorage idx 75/76**. This is the apparent "copy".
4. The resolver settles back to the origin (`ch13-survey` is origin-owned),
   `EfficientScene` **remounts**, and the player is re-seated on the origin
   arrival shell `[53.75, 13.5, -14]`; the next autosave writes it over the base
   key (idx 79/80).

Every recorded byte is explained with **no** scope mismatch, **no** validator
rescue, and **no** `storyAnchoredSpawn` branch.

---

## Exact unresolved predicate

> The literal value of `story.beat` on the render(s) between the successful
> restore and the Tidegarden swap — the argument reaching
> `resolveStoryRuntimeWorldId` / `resolveStoryBootWorldId` at `App.tsx:537-545`
> during the ~1s window between trace idx 107 and idx 108.

With beat `ch13-survey` the resolver is **stable on the origin and no swap is
possible**. The recorded swap therefore proves the beat was transiently
something else. Both `null` and `ch13-return` yield `tidegardenOwned = true`,
because `storyChapterAtLeast('ch13','ch9')` is true and neither value is in the
`originOwnedBeat` list (`ch10-transit`, `ch13-survey`, `ch13-common`). The trace
samples ~1s apart and reads `ch13-survey` on both sides, so **the transient
value is not in the existing evidence.**

## One smallest fresh actual-Continue observation

Use the **already-shipped** telemetry — no source edit:
`EfficientScene.tsx:301-314` publishes `window.__voxelDebug.spawn.terrainSeed`
and `playerRequested` on every mount.

Record on a 100 ms interval during one real Continue:
`[performance.now(), window.__storyBeat, window.__voxelDebug?.spawn?.terrainSeed]`.

- `terrainSeed` observed as **1600321158** at any point ⇒ Tidegarden excursion
  proven, and the beat sample on that tick names the offending value.
- `terrainSeed` never leaves **3215739679** ⇒ the swap is not world-driven and
  the re-seat must be attributed to a second origin mount instead.

Single page load, <30 s capture, existing preview, no new probe infrastructure.
**This is a browser observation and was NOT performed here.**

## Minimal in-scope seam (NOT confirmed, not proposed as a patch)

`src/App.tsx:624-634` reacts to a per-render resolver answer with an immediate
`setCurrentWorld` + `resetSceneReady`, with **no guard that the story point is
settled**. `tidegardenRoute.ts`'s own header comments document two prior
incidents of exactly this shape (the `ch10-ask` and `ch13-return` crossings
being reclaimed by the boot answer).

The specific thing to inspect is `resolveStoryBootWorldId`'s handling of
`beat === null`: it falls through to the chapter-ordinal test, which answers
Tidegarden for **any** chapter ≥ ch9 whose beat has not yet restored. Note also
that the function ignores its first parameter entirely (`_savedWorldId`), so the
correct saved `lastPlanetWorldId` of `-1,-1` cannot break the tie during that
transient.

No edit is justified until the transient beat value is observed.

---

## Integrity

- No browser, no GPU, no build, no preview, no full suite, no CPU replay run.
- No game source, producer file, probe, or prior report modified or deleted.
- No scratch created in the game tree.
- Dependency hashes: `logs/continue-pose-scope-audit/dependency-hashes.txt`.
- Expected source manifest `6ef957c3…1fee5d6` unchanged; 99 files still frozen.
