# Paravoxia feedback triage — 2026-07-21 (wave 3)

Owner feedback, seven items. Scouted read-only on 2026-07-21 (three opus
scouts: audio, controls/perspective, prompts/HUD). Status: **EXECUTED &
VERIFIED 2026-07-21** — see the status appendix at the end. All lanes were
mechanical opus agents; zero fable spend.

Predecessor: `PARAVOXIA_FEEDBACK_TRIAGE_2026-07-20.md` (waves 1–2, all closed
except item 2 of that doc — early-ch1 directional indicators, still parked for
the Creative Triad delta). Worktree rules from
`CLAUDE_FABLE_HANDOFF_2026-07-20.md` remain binding: never checkout/reset/
stash/clean; preserve untracked files; both production runs stay
`releaseCandidate:false`.

---

## Item 1 — High-pitched, super-fast intermittent beeping (esp. after pickups/SFX)

**Diagnosis (ranked, scouted with file:line evidence):**

1. **Per-node, per-frame `playSfx('mine')` during cluster pickup** — the
   forage and loose-stone fields collect in a `useFrame` proximity loop that
   fires one SFX per node per frame:
   `main/src/components/ForageField.tsx:257-274` (play at :271),
   `main/src/components/LooseStoneField.tsx:194-206` (play at :203); same
   per-event pattern at `EfficientPlayer.tsx:994,1004,1007,1015`. The `mine`
   sound (`main/src/audio/sfxEngine.ts:74-76`) contains a bright 1600→700 Hz
   bandpass tick — exactly a "high-pitched beep." Walking through a dense
   patch = several ticks per frame across successive frames; stops when the
   patch clears. Best fit for "after picking something up," intermittent,
   too frequent.
2. **880 Hz `terminalKey` bursts** from debris/pod/waypoint proximity
   collection (`DebrisField.tsx:66`, `SupplyPods.tsx:63`, `NavBeacons.tsx:62`
   → `sfxEngine.ts:117`, square 880→860 Hz). Idempotent per item but a tight
   cluster yields a rapid beep run.
3. **Ch1-era square ostinato** (`scoreEngine.ts:1076-1099`;
   `storyScore.ts:43-47`, square wave, 8ths at 100–112 BPM) — the sustained
   "beeping" *texture*. Already softened in wave 2; intensity does NOT change
   its rate, and no pickup path touches intensity, so the pickup correlation
   belongs to #1/#2, not the score.
4. Ruled out: generative bed (master ramps to 0 when story leads,
   `bedEngine.ts:453,457`); legacy musicEngine has no high blip lane in early
   scenes.

**Fix plan (mechanical, opus lane — bounded exception on protected
`main/src/audio/sfxEngine.ts`, justified by explicit owner complaint):**

- Add a per-event **rate limiter/coalescer at the single choke point
  `SfxEngine.play()`** (`sfxEngine.ts:59`): minimum re-trigger interval per
  event name (order 90–140 ms for `mine`/`terminalKey`), with a small
  velocity/gain dip rather than hard silence where musically useful. All
  trigger sites keep firing; the engine dedupes.
- At the field call sites, coalesce same-frame cluster collection into ONE
  SFX per frame (count still banks; pairs with item 7's gain aggregation).
- **Evidence:** unit tests on the limiter (burst of N calls in one frame → 1
  voice; sustained spam → bounded rate); instrumented counter behind a debug
  flag logging `event` + timestamp windows. NOTE: the SFX engine owns its own
  AudioContext — offline score renders can NOT capture this
  (see memory `audio-evidence-combined-bus`); proof is counter-based +
  owner ear check.
- **Held in reserve:** if beeping still bothers after the SFX fix, the
  remaining texture is the chip ostinato — that would be a Score Director
  (fable) taste commission, not more mechanical work. Not commissioned now.

## Item 2 — Pure-2D beats: left/right + jump + extract only; no walking off the cube face

**Current state (scouted):** `ch1-fixed`, `ch1-raster`, `ch1-depth` are
side-scroller beats (`lookMode:'side'`, `depthBand 0` —
`storyInputPolicy.ts:180-183`, `storyDirector.ts:458-463`). The TouchDPad
today always renders all four directions (up/down are **inert** on these
beats since W/S are dead — `EfficientPlayer.tsx:1550-1551`) and has **no jump
button** even though `rasterPolicy.allowJump` is true; EXTRACT exists on
ch1-fixed/raster only.

**Fix plan:**

- **Per-beat button sets** in `TouchDPad.model.ts`: 2D beats render
  left/right + JUMP (synth `Space` via `mobileInput.ts` bridge) + EXTRACT
  where the beat has an extract verb (implementing agent verifies per-beat
  verbs against `dpadActionForBeat` and CH1 work orders). Up/down removed on
  2D beats. Keep the monochrome regulation-feed styling and per-chapter
  tinting.
- **Face-lock:** the travel axis is currently unbounded — walking far enough
  triggers `resolveSurfaceFrame` → `escape` → reorient onto the next face
  (`EfficientPlayer.tsx:1421-1431`). Add a symmetric **`travelBand` on
  `LensRig`** (`sideLens.ts:74-86`) mirroring the existing depth clamp at
  `EfficientPlayer.tsx:1783-1801` (velocity cancel + spring-back at band
  edge); set per-beat bands in `storyDirector.ts` for the 2D beats sized to
  each beat's authored strip. `depthBand`/`STORY_TASK_ROW_DEPTH_BAND` is the
  ready-made plumbing pattern.
- **Regression duty:** autopilot/movie traversal must still complete every
  ch1 beat (bands must contain scripted paths or autopilot poses); add a
  `chapter-journey-contract.json` lifecycle scenario for the face-lock; unit
  tests for the clamp math and the per-beat d-pad model.

## Item 3 — Top-down beats: up/down buttons fade in when the second axis opens

**Current state:** the second movement axis first opens at **`ch1-nav`**
(`depthBand: Infinity`, `storyDirector.ts:464-465`) and stays open for
`ch1-iso`.

**Fix plan:** per-beat axis config in the TouchDPad model (same change as
item 2): on `ch1-nav`/`ch1-iso` the up/down arms render and **fade in** (CSS
opacity/scale transition, ~300–400 ms, respecting reduced-motion) the first
time the beat mounts, reading as "a new axis just unlocked." Model unit tests
assert the per-beat arm sets; the fade is presentation-only.

## Item 4 — First person: replace 90° snap-turn with full drag look

**Current state:** first playable first-person is `ch1-anomaly`
(`lookMode:'feed'`, `embodiedSurveyPolicy`, `storyInputPolicy.ts:125-127,
189-190`). With `feedBlend 0`, drag accumulates and snaps
`FEED_SNAP_ANGLE = π/2` per threshold crossing (`feedCamera.ts:24-25,54-65`)
— the exact reported behavior. A smooth path already exists twice over: the
`free` branch (`CameraControls.tsx:139-145`) and `feedAccumulateLook`'s own
continuous blend as `feedBlend`→1 (A2 liberation lerps it open,
`storyInputPolicy.ts:315-319`).

**Fix plan:** start `ch1-anomaly` with smooth continuous yaw — preferred
mechanism: raise the beat's initial `feedBlend` to 1 for look purposes (or
give the policy a `snapLook:false` flag) so NO new look code is written and
the A2 liberation machinery stays intact for whatever else it drives. Applies
to both touch drag and mouse (same handler). Keep the pinned CCTV pitch band
(`feedCamera.ts:17-20,67-76`) unless the owner objects — it preserves the
surveillance-era framing while freeing yaw. **Creative note:** the snap was
an authored feed-era conceit (embodiment ladder); owner taste overrides it.
Record the override here so the Triad doesn't reintroduce it.

## Item 5 — All action prompts need mobile variants (no raw "Press F"/key names on touch)

**Current state:** an input-glyph substitution table already exists —
`TOUCH_ACTION_TOKENS` + `presentStoryGuidanceLine(line, touch)`
(`StoryGuidanceHud.tsx:42-58`) — but is used ONLY by StoryGuidanceHud, and
its table misses `[A] [D] [W] [S] [M] [MOUSE] [TAB] [ENTER]`. Scouted leak
list (complete):

| Site | Copy | Action |
|---|---|---|
| `RegulationFeedHud.tsx:363` | `WORK LINE LOCKED · [A]/[D]` | move |
| `RegulationFeedHud.tsx:401` | `ASCEND [SPACE] · …` | jump |
| `RegulationFeedHud.tsx:456` | `[F] {verb}` | interact |
| `storyScript.ts:394,410,417,424,430` (CH1_WORK_ORDERS) | `[A]/[D]`, `HOLD [E]`, `[SPACE]`, `[M]` | move/mine/jump/map |
| `storyScript.ts:344` | `[MOUSE] OR [W]/[S]` | deflection minigame |
| `MapOverlay.tsx:42` | `[M] CLOSE` | close map |
| `TerminalPrologue.tsx:183,205` | `[F] BRACE…`, `[TAB] SKIP…` | advance/skip |
| `ManifestScreen.tsx:80` | `[ENTER] EXPEDITE…` | advance |
| `RegulationCrawl.tsx:200` | `[ENTER] CONTINUE` | advance |
| `App.tsx:1953-1956` | debug legend | debug-only, lowest priority |

Already handled (no change): InteractionPrompt, BuildIndicator,
HudCornerActions, physicalBoarding, story work-orders routed through
StoryGuidanceHud, ControlsReference (device-aware tables).

**Fix plan:**

- Promote `presentStoryGuidanceLine` + token table out of StoryGuidanceHud
  into a shared `main/src/story/ux/` module; extend the table with the
  missing tokens and touch verbs that MATCH the on-screen buttons (e.g.
  `[A]/[D]` → the d-pad arrows, `[SPACE]` → `[ASCEND]`/JUMP label,
  `[E]` → `[EXTRACT]` on feed-era beats, `[M]` → `[CHART]`, `[ENTER]`/`[TAB]`
  → `TAP` phrasing). Route RegulationFeedHud captions, CH1 work orders,
  MapOverlay, and the three prologue screens through it.
- **Tap targets:** verify every leaked prompt's action is reachable by touch;
  prologue `[ENTER]`/`[TAB]`/`[F]` advance/skip must become tappable
  (tap-anywhere or an explicit chip) if they aren't already.
- **Copy law:** new touch strings stay in regulation voice and obey the
  both-readings law; they follow the established `[VERB]` token idiom, and
  the diff of every new user-facing string is listed in the wave report for
  owner/Chapter-Director delta review (batched with the parked
  directional-indicators triad delta).

## Item 6 — Sprint on mobile (Shift equivalent + prompt variant)

**Current state:** `Shift → controls.sprint` (`App.tsx:1422`,
`EfficientPlayer.tsx:1591`, stamina-gated via `canSprint`,
`survivalVitals.ts:178-184`). No touch affordance exists; `ShiftLeft` is
forwarded (`journeyInputRuntime.ts:22`) but absent from
`mobileInput.ts` `KEY_CODES` (:34-48).

**Fix plan:** add `sprint:'ShiftLeft'` to `KEY_CODES`; add a **hold-to-sprint**
button to the on-foot touch action grid (`TouchControls.model.ts:40-45`,
currently eat/use/mine/jump), gated by `storyPolicy.allowSprint` and hidden
when sprinting is impossible for the chapter; visual state reflects stamina
gating if cheap. Update the `touchOnFoot` table in
`ControlsReference.model.ts` and add `[SHIFT]` → `[SPRINT]` to the token
table (item 5). Model unit tests for press/release → synthetic key behavior.

## Item 7 — Subtle "+4 wood" gain feedback in the HUD

**Current state:** all gains funnel through gameplay commands whose
`CommandAccepted.deltas` carries `[{id, qty}]`
(`gameplayCommands.ts` — mine :204, tree :340, stone :369, forage :400/431,
craft :551). Single choke point:
`subscribeFinalizedLocalGameplayCommand` (`commandDispatchAdapter.ts:39`).
Today the only feedback is the mine SFX; InventoryPanel counts update with no
flash. `VantageToast.tsx` is the proven transient-pill template (top-center,
auto-dismiss, `pointerEvents:'none'`).

**Fix plan:** new `ResourceGainToast` HUD component modeled on VantageToast:

- Subscribes to finalized local commands, **aggregates deltas over a short
  window** (~1.2 s rolling) so sweeping a patch reads `+4 STONE` once, not
  four chips; multiple item types stack as separate small rows.
- Subtle by design: small `hudGlassPanelStyle()` chip, top-center (top-left
  is occupied by InventoryPanel), brief fade in/out, no motion spam, no
  sound of its own (the coalesced item-1 SFX is the audio half).
- Mounts in the fps HUD sibling block (`App.tsx:1603-1660`, near VantageToast
  references at :1742/:1904), gated to on-foot mode. Unit tests on the
  aggregation model (window merge, multi-item, zero-delta commands ignored).

---

## Execution shape (when approved)

All lanes are **mechanical → opus general-purpose agents**; no fable spend
except the held-in-reserve score commission in item 1. To avoid the
concurrent-edit typecheck noise seen in wave 1, run **two batches** grouped by
file overlap:

- **Batch 1 (disjoint):** Lane A audio SFX coalescer (item 1) · Lane C
  face-lock travelBand (item 2b, EfficientPlayer/sideLens/storyDirector) ·
  Lane E prompt variants + tap targets (item 5, ux/hud/prologue files).
- **Batch 2:** Lane B TouchDPad per-beat sets + jump + axis fade + sprint
  button (items 2a/3/6, TouchDPad/TouchControls/mobileInput/ControlsReference)
  · Lane D smooth first-person look (item 4, storyInputPolicy/feedCamera) ·
  Lane F ResourceGainToast (item 7, new component + App mount).
- **Verification:** full `npm --prefix main run verify` after each batch;
  `story-verifier` lifecycle probes for ch1 beat flow + autopilot traversal
  under the face-lock; because d-pad/prompt/look changes alter guided-play
  legibility, finish with a fresh read-only **player-experience-auditor**
  report (CLAUDE.md requirement) covering touch variants.
- **Owner-gated:** ear check for the beeping after Lane A (device, especially
  the forage/stone patches); taste check of d-pad button sets, axis fade,
  smooth look feel, gain-chip subtlety on a real phone.

## Open owner calls (small, non-blocking — defaults stated)

1. Item 4: keep the pinned CCTV **pitch** band during ch1-anomaly (default:
   keep; only yaw goes smooth) or free pitch too?
2. Item 1: if beeping persists after SFX coalescing, commission the Score
   Director on the ch1 square ostinato (default: wait for your ear check).
3. Item 5: touch phrasing for the deflection minigame (`[MOUSE] OR [W]/[S]`)
   — default `DRAG TO VECTOR THE SHIELD`.

## Status appendix (2026-07-21, end of wave)

| Item | Status |
|---|---|
| 1 fast beeping | **DONE** — rate limiter at `SfxEngine.play()` (`mine` 110 ms, `terminalKey` 90 ms floors; table-driven in `sfxRateLimiter.ts`), one-chip-per-frame in ForageField/LooseStoneField. Extra swarm sources covered by the engine gate: 11 `mine` sites in EfficientPlayer, `VoyageLedger` typewriter. On-device proof: `window.__voxSfxDiag()` (sounded✓/suppressed✗ over trailing 3 s). Score-ostinato commission still in reserve pending owner ear check. |
| 2 2D buttons + face-lock | **DONE** — per-beat d-pad (◀▶+JUMP on fixed/raster/depth, +EXTRACT on fixed/raster); `travelBand` on LensRig, final bands gather 29 / recovery 28 (clamp rest = dry plateau edge x=36). Contract `lifecycle:ch1-2d-face-lock`. |
| 3 axis fade-in | **DONE** — ▲▼ fade+scale in at ch1-nav (340 ms, reduced-motion instant). |
| 4 smooth first-person drag | **DONE** — `smoothYaw` policy flag on ch1-anomaly/a1-ramp (chosen over feedBlend=1, which would have opened the CCTV pitch band and shifted telemetry). Snap machinery retained for the liberation blend; override recorded in CINEMATOGRAPHY.md. |
| 5 mobile prompt variants | **DONE** — shared `main/src/story/ux/inputGlyphs.ts` (contexts embodied/feed/prologue + `chartActionable` option); all scouted leaks routed at render time; canonical copy untouched. Bonus fixes: StoryCaptions leaked `[SHIFT]`/`[M]`; DebrisDeflection was uncontrollable on touch (now DRAG). Prologue advance/skip prompts are tappable (≥44 px). |
| 6 mobile sprint | **DONE** — `sprint:'ShiftLeft'` in KEY_CODES; hold-to-sprint on the on-foot grid, gated fps ∧ ¬build ∧ allowSprint; ControlsReference agrees with runtime. |
| 7 gain chip | **DONE** — `ResourceGainToast` (1.2 s merge window, 1.8 s linger, 3-row cap + `+N MORE`), top-center + safe-area inset, inside CinematicHudVeil, aria-hidden, reduced-motion safe. Handles both delta shapes (`[{id,qty}]` AND `{drops:[…]}` — the mine path uses the latter; scout claim was wrong). |

### Regression found & fixed during verification

The story-verifier's ladder probe caught the initial face-lock (bands 36/34)
parking the movie actor 2.5 m past the dry plateau into shallow shore →
`start-column-not-traversable` → ch1-nav/iso/anomaly froze and timeout-rescued.
Three stacked fixes (Lane R1): bands tightened to 29/28; cross-face planner now
relocates a non-traversable start column (≤3 cells) and prepends the live
position as waypoint 0; autopilot waypoint consumption switched to
tangent-plane distance (this third fix cured a PREVIOUSLY MASKED ch1-anomaly
summit stall — timeout rescues had been hiding it since before this wave).
Independent re-verify: **PASS** — full ladder honest in 108 s (nav 13.9 s,
iso 9.0 s, anomaly 20.3 s with 0 teleports and a real gravity-edge crossing),
face-lock holds (0 depth drift, in-band), triangulation progresses 1/3→3/3.

### Player-experience audit (independent, read-only)

Verdict: legible/shippable after repairs; all repairs applied (Lane R2):
touch CHART entry in the FIELD SYSTEMS corner menu (mirrors the desktop KeyM
gate; opens `setMapViewOpen`); feed-era retained-tool line drops the
unactionable `[CHART]` token on touch; pause-menu "Screen actions" uses button
words (BUILD/FABRICATOR/CHART/PAUSE) not keycaps; ResourceGainToast honors
`safe-area-inset-top`. BuildIndicator legend confirmed desktop-only (not a
leak). Accepted as-is: silent face-lock spring (matches depth-clamp
convention); presentation-only ▲▼ reveal (marker guides into the axis).

### Verification ledger

- Full `npm --prefix main run verify` green after every batch; final:
  **257 files / 1903 tests / clean build**.
- `chapter:journey:check` passed (3 lifecycle contracts, 0 issues);
  `story:ux:check` 54/54.
- story-verifier ladder probe: FAIL on first run (regression above) → PASS on
  re-verify after repairs. Probe artifacts in the session scratchpad
  (`ch1-shots*/summary*.json`); all dev servers confirmed killed.

### Owner-gated follow-ups

1. Ear check the beeping fix on-device (`window.__voxSfxDiag()` proves the
   suppression); if the residual chip-ostinato texture still bothers, say so —
   the Score Director commission is scoped and waiting.
2. Headed taste pass: per-beat d-pad + JUMP feel, ▲▼ reveal at ch1-nav,
   smooth first-person drag (ch1-anomaly), gain-chip subtlety, touch CHART
   menu entry, `TAP TO …` prologue prompts.
3. Copy review of the new touch strings (inventories in the Lane E/R2 reports;
   all `[VERB]`-idiom or TAP/DRAG phrasing, canonical strings untouched).
4. Pre-existing gaps flagged by the audit, NOT fixed this wave (decide/route):
   no pause/quit affordance on touch during the whole feed era
   (storyHudTakeover unmounts HudCornerActions); no signed production-evidence
   bundle for waves 2–3 (latest on disk is 2026-07-17-ch9) if a formal
   production gate is wanted.
5. The worktree now carries THREE green-verified uncommitted waves — commit in
   coherent batches before anything else.
