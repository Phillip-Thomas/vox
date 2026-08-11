# Player Experience Audit

Reviewer: `player-experience-auditor (independent, read-only)`
Run ID: `2026-08-10-ch7-ch8-voice-repair`
Contract revision: `draft-v4` (`sha256 df544b130773c3ba9ab4f0132f0223616db5767bbda7e9e6dd59bf8ab3a1f1e3`, status `frozen`)

## Independence

- First report completed before reading peer conclusions: `yes`
- Director or implementation role on this run: `no`
- Other reviewer conclusions read before first report: `no` — `story-audit.md`,
  `naive-audience-report.md`, `score-audit.md`, `cinematography-audit.md` and
  `cohesion-judge.md` were not opened. Grounding was the production lock,
  `scene-contract.json#guidance`, `main/src/story/ux/README.md`,
  `shipped-ux-baseline.json`, `implementation.diff`, the runtime source, the raw
  traces/frames under `evidence/`, `defects.json` and `dissent-register.md`.

## Disposition

**findings-routed** (verdict `repair`). No critical and no newly-introduced high
defect. Six medium findings and five low findings are routed below. The run's
central claim — that it added no objective, marker or work order and did not
disturb the shipped guided-play lifecycle — **holds**: every published objective
ID, marker label, work order, `requiresMarker` value and one-shot entry cue is
byte-identical to the shipped baseline on every traced path and variant. What
does not hold cleanly is the *legibility and evidence* of the presentation layer
the run added, and the new 17 s live-control window it opened at the ch8 exit.

## Contract and baseline

- Signed guidance contract: `scene-contract.json#guidance` — 9 objectives,
  8 ch7 + `ch8-launch-reboard`; 5 further markerless objectives carried as
  acceptance terms.
- Shipped source and objective map: `shipped-ux-baseline.json` (rev `03e975a`,
  20 hashed source files, 3 excluded under ruling R5).
- Raw lifecycle proof: `objective-lifecycle-evidence.json` +
  `evidence/verification/objective-lifecycle-measurements.json`.
- Contract-bound focused journey proof: `chapter-journey-evidence.json`
  (`disposition: passed-no-focused-scenarios`).
- Working tree matches the lock's allowed paths exactly: only
  `emergentStoryDirector.ts(+test)` modified and `storyText.test.ts` added; no
  protected path touched.

## Player journey summary

A first-time player deep-linked into `ch7-reconstruct` reads a persistent
bottom-left card: **WRECK SCAR · TRACE RELATIONSHIPS / FOLLOW THE WRECK MARKER.
/ AIM AT THE SCAR. [F] TRACE RELATIONSHIPS.** The world marker, the interaction
prompt and the card all name the same verb, and the marker carries a live
distance readout. Each committed repair replaces the card with the next exact
bench instruction (`[F] RESTORE STRUT FRAME`, `[C] OPEN FABRICATOR. CRAFT LIFT
CELL`, …), one `terminalAdvance` acknowledgement per ID change, and the run's new
`WRECK RELAY` audit rows plus an interior voice line arrive alongside. At the
end of the beat the card settles to **WRECK · FLIGHT READY / FLIGHT CONTROLS
CALIBRATED.** and the owner-approved line *"the scar remains. now it can carry
me."* plays before ch7-board takes over.

**First uncertainty (comprehension, not navigation):** at the bench the player is
told *what to press* clearly, but the reward for pressing it is unreadable. In
all three cold desktop runs and all three variant runs the five per-repair voice
lines land 0.656–1.294 s apart into a single caption slot whose renderer reveals
one character per 34 ms, so lines 73–90 characters long are cut off after 19–38
characters. Frame
`evidence/verification/ch7-captures-desktop/pre-origin/pre_006_5.54s_ch7-reconstruct.png`
shows the M2 line on screen as the two words **"the ke"**. The player never learns
what the game just said to them about their own work — the guidance is clear,
the acknowledgement is not.

**Second uncertainty (mobile):** on portrait touch there is no persistent
objective card at all (it collapses to a top-rail `JOURNAL` button), and the new
caption traffic lands in a lane that overlaps the embodied action cluster —
frame `ch7-captures-mobile-portrait/pre-origin/pre_006_5.62s_ch7-reconstruct.png`
shows *"the keel"* running into the `CONSUME` button.

## Journey regressions

- **Exact journey-contract SHA and source-revision binding:** `partially unmet`.
  `chapter-journey-evidence.json` carries `sourceRevision 03e975a` but
  `contractSha256: null` and `contractVersion: null`, against a README that
  requires an "exact-revision, contract-hashed browser report". The machine
  authority `main/chapter-journey-contract.json` is itself schema-drifted and
  accepted out of scope under ruling R3.
- **Focused scenarios complete, or an explicit no-focused-scenario disposition:**
  `met` — explicit `passed-no-focused-scenarios`; ch8 declares no focused
  escaped-defect scenario. Lane self-declares `humanOperated: false`,
  `headed: false`, `machineJourneyCertifying: false`.
- **Prompt ownership, editable input, entity lifecycle, and reload/recovery
  seams:** `met for prompt ownership`. Captions and audit rows are written to
  `storyText.caption` / `storyText.audit`; the standing work order is written
  only by `activateGuidedStoryObjective → setWorkOrder`, and the guidance card
  renders the objective object, not the caption channel. No new copy can replace
  or mask a standing work order by construction. Reload/recovery seams carry one
  unresolved inconsistency (UX-07).
- **Diagnostic direct-entry evidence is not represented as continuity proof:**
  `met` — `seeded-entries.json` case `fly-debug-entry` is labelled diagnostic and
  is not used as continuity evidence. It should stay that way: on that route the
  card reads `HOLD [SPACE] TO IGNITE AND LIFT` for 5.24 s while the ship is
  already in `deep_space`.

## Objective lifecycle

- **Player verb and actionable final instruction:** `met` for all eight ch7
  objectives and for `ch8:launch:ignite`. Every mandatory work order ends in a
  concrete input (`[F]`, `[C]`, `[SPACE]`), and `inputGlyphs` swaps the token for
  touch labels at render time. Two terminal states name no input —
  `reconstruct:ready` ("FLIGHT CONTROLS CALIBRATED.") and
  `ch8:launch:orbital-handoff` ("LET THE SYSTEM RESOLVE.") — both are
  `requiresMarker: false` waits with nothing for the player to do; that reading is
  honest, but the run extends the first from 0.65 s to 5 s and creates the second
  as a 15.3 s state over *live flight controls* (UX-09).
- **Objective enter/change/clear lifecycle:** `met`. IDs derive from durable
  progression (repair stage receipts, milestones, flight phase through a 1.75 s
  dwell), change only when the required action changes, and clear at every beat
  boundary via `clearGuidedStoryObjective()`. Measured `activeAfterClear: false`
  for every ch7 objective except the trace-boundary case on `reconstruct:diagnose`,
  which the evidence correctly annotates as a stop-of-capture, not stale guidance.

## Marker exactness

- **Mandatory objective health and exact marker-label parity:** `met in
  substance, overstated in the contract`. All 8 ch7 objectives observed exactly
  one marker label each across 6–7 entries, byte-identical to the signed label;
  `StoryDirectorDriver.tsx` passes the bare `markerTarget.label` to
  `observeGuidedStoryMarker` while appending `· {range}m` only for display, so
  parity is structurally exact. However the signed `acceptanceCriterion` on all
  nine objectives asserts *"zero missing-marker frames"*, and the run's own raw
  evidence records 7–13 `missing-marker` observations per objective plus a
  **2.956–3.137 s** `missing-marker` window on mandatory `reconstruct:diagnose` at
  beat entry. The evidence file reconciles this with a definitional note; the
  contract text does not (UX-11).
- **Target reachability and shared marker ownership:** `met`. One marker language
  throughout; the bench marker resolves to a reachable target at 3 m in the
  captured frames; `reconstruct:craft:*` objectives are the only mandatory ones
  that spend most of their measured life in `missing-marker`, and only because in
  movie mode they exist for 23–84 ms before the autopilot crafts (UX-12,
  informational).

## Feedback and progression

- **One semantic entry cue per objective ID:** `met`. `feedbackPerEntry` is `[1,…]`
  for all 39 measured entries across desktop, mobile-portrait, reduced-motion and
  POTATO. `activateGuidedStoryObjective`'s id-equality guard is the only gate and
  it is untouched.
- **Presentation feedback remains unable to advance progression:** `met`. The cue
  emits `playSfx('terminalAdvance')` and returns; the new captions and audit rows
  are `showCaption`/`showAuditLine` calls only. `tickReconstruction` and
  `tickLaunch` still key their milestone commits on the identical durable facts
  (`hasReconstructionCalibrationReceipt`, `flight.phase === 'deep_space'`); the
  new constants only delay the commit. Sandbox prime directive verified: story
  off ⇒ zero captions, zero audit rows (`resets-trace.json` `sandbox_noop`).
- **Completion feedback distinct from entry:** `not met, pre-existing`. There is
  exactly one cue type in the whole system (`objective-enter`); completion is
  inferable only from the next objective's entry cue. This run supplies the first
  real per-step completion feedback for the ch7 build loop — and that is precisely
  the content truncated by UX-01.

## Variants and accessibility

- **Desktop / mobile / reduced-motion / lowest-quality parity:** `met for
  guidance, not met for caption legibility on mobile`. Marker labels, work orders
  and cue counts are identical across all four variants; the ch8 exit-window
  cadence matches the desktop reference to ≤0.082 s on mobile-portrait,
  reduced-motion and POTATO. POTATO skips `ch8:launch:climb` (vd-03) — correctly
  attributed pre-existing, though see UX-13 on the attribution's evidentiary
  basis. Mobile-portrait shows no persistent objective card (shipped touch
  pattern) and its caption lane collides with the embodied control cluster
  (UX-02).
- **Screen-reader meaning, safe areas, and input clarity:** `degraded`. Three
  concurrent `aria-live="polite"` regions exist (objective card, caption band,
  audit band), and both text bands rewrite `textContent` inside the live region
  once per animation frame during the typewriter reveal. This run roughly
  quadruples ch7/ch8 live-region traffic (ch7 went from 2 captions and 0 audit
  rows to 6 captions and 4 audit rows). Safe-area insets are honoured by the card,
  caption and marker solvers. `prefers-reduced-motion` is not consulted by
  `StoryCaptions.tsx` or `AuditBand.tsx` at all; parity is therefore trivially
  preserved, but a reduced-motion player still receives 16 new character-by-
  character animated lines (UX-10).

## Reset and stale state

- **Deep-link / replay / pause / quit / completion reset behavior:** `met with one
  unresolved measurement`. Quit clears the objective and all four text channels
  (`objectiveAfter: null`, `caption/audit/workorder` empty). Deep links to
  ch7-board / ch7-reconstruct / ch8-crossing each reconstruct the correct standing
  objective. Pause is genuinely pause-aware: the whole 17 s window's story offsets
  are preserved (0/2.016/4.022/6.039/8.539/11.555/14.055/17.072) while wall
  offsets shift by the 5 s hold — a player who pauses mid-window loses nothing.
  Re-entry seeding works: a mid-flight restore seeds the ladder consumed and
  replays nothing. The one unresolved item is the replay trace (UX-07).
- **Sandbox and beat-exit objective clearing:** `met`. No story-only HUD, caption
  or audit row leaks into free play; `enterEmergentStoryBeat` clears latches,
  elapsed, all five new launch fields, the dwell and the objective before the
  per-beat switch runs.

## Objective lifecycle matrix

Entry counts aggregate 3 ch7 cold movie runs, 3 ch8 cold movie runs and the 6
variant runs. "Cues" = objective-enter emissions per entry.

| ID (runtime) | Verb / input | Work order (last line) | Marker · health | Cues | Action available now | Progress / completion response | Clear / replace / reset | Variants | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `reconstruct:diagnose` | aim + `[F]` | `AIM AT THE SCAR. [F] TRACE RELATIONSHIPS.` | `WRECK SCAR · TRACE RELATIONSHIPS` · ready after a 2.96–3.14 s entry `missing-marker` window | 7×1 | yes | new M1 audit + caption on the diagnosis receipt; M1 caption truncated at 38/73 chars | clears on receipt; 8/8 reset triggers pass | D/M/RM/POTATO pass, identical label | `objective-lifecycle-measurements.json`, `ch7-flow-trace.json` |
| `reconstruct:repair:bench_online` | `[F]` | `[F] RECOVER WRECK SALVAGE.` | `WRECK BENCH · RECOVER WRECK SALVAGE` · ready | 6×1 | yes, **but the ID covers two actions** — label stays on salvage while the required act becomes the keel install | M2 caption fires on the *install* commit the HUD never named; truncated at 19/78 chars | clears on stage edge; 8/8 pass | identical across variants | dissent-06, `shipped-ux-baseline.json` marker map |
| `reconstruct:repair:frame_restored` | `[F]` | `[F] RESTORE STRUT FRAME.` | `WRECK BENCH · RESTORE STRUT FRAME` · ready | 6×1 | yes | M3 caption truncated at 19/90 chars | 8/8 pass | identical | `pre_006_5.54s` frame |
| `reconstruct:repair:hull_sealed` | `[F]` | `[F] SEAL SCARRED HULL.` | `WRECK BENCH · SEAL SCARRED HULL` · ready | 6×1 | yes | M4 audit + caption; caption truncated at 21/74 chars | 8/8 pass | identical | `cadence-assertions.json` |
| `reconstruct:craft:lift_online` | `[C]` | `[C] OPEN FABRICATOR. CRAFT LIFT CELL.` | `WRECK BENCH · CRAFT LIFT CELL` · **ready on 1 of 6 entries** | 6×1 | yes in manual play; in movie mode the objective lives 23–84 ms | none of its own | 8/8 pass | identical | measurement rows, objective 5 |
| `reconstruct:repair:lift_online` | `[F]` | `[F] INSTALL LIFT CELL.` | `WRECK BENCH · INSTALL LIFT CELL` · ready | 6×1 | yes | M5 audit + caption; caption truncated at 19/40 chars | 8/8 pass | identical | `cadence-assertions.json` |
| `reconstruct:craft:flight_ready` | `[C]` | `[C] OPEN FABRICATOR. CRAFT LOGIC WAFER.` | `WRECK BENCH · CRAFT LOGIC WAFER` · ready on 3 of 6 | 6×1 | as above | none of its own | 8/8 pass | identical | measurement rows, objective 7 |
| `reconstruct:repair:flight_ready` | `[F]` | `[F] CALIBRATE FLIGHT CONTROLS.` | `WRECK BENCH · CALIBRATE FLIGHT CONTROLS` · ready | 6×1 | yes | M6 caption renders in full (8.67 s of air) | 8/8 pass | identical | `off_4p8s` frame |
| `reconstruct:calibrating` / `reconstruct:ready` | none (wait) | `FLIGHT CONTROLS CALIBRATED.` | `WRECK · FLIGHT READY` · `requiresMarker false` | 1 each | n/a | M7 audit at +0.0 s, M7 caption at +0.61 s, exit line at +3.01 s, advance at +5.03 s | replaced by ch7-board entry caption at +5.028 s | identical | `cadence-assertions.json` ch7 |
| `ch8:launch:reboard` | `[F]` board | `FOLLOW THE HATCH MARKER AND [F] BOARD.` | `KESTREL HATCH · REBOARD` · **never observed** | 0 | unverified | unverified | unverified | `not_run` ×4 | declared gap; also unobserved at baseline |
| `ch8:launch:ignite` | hold `[SPACE]` | `HOLD [SPACE] TO IGNITE AND LIFT.` | `KESTREL FLIGHT CONTROLS · IGNITE` · `requiresMarker false` | 1 | yes | L1 fires on the `surface-flight` dwell state | replaced by climb / handoff | all 4 | `ladder-analysis.json` |
| `ch8:launch:climb` | hold course | `HOLD COURSE THROUGH THE ATMOSPHERE.` | `ATMOSPHERIC EXIT · CLIMB` · `requiresMarker false` | 1 | yes | L2 at the phase edge or +4.5 s timer | **not published at all on POTATO** | 3 of 4 | `variant-parity.json` |
| `ch8:launch:orbital-handoff` | none (wait) | `LET THE SYSTEM RESOLVE.` | `DEEP SPACE · HANDOFF` · ready | 1 | n/a — but flight controls stay live | 4 audit rows + 2 captions across 15.3 s; advance at +17.07 s | replaced by ch8-crossing entry caption | all 4, cadence within 0.082 s | `off_11p5s` frame, `quit-replay-trace.json` |

## Failure journeys

**FJ-1 — the reward for your own work is unreadable (reproducible, all routes).**
Enter ch7-reconstruct, diagnose, then perform the bench transactions in sequence.
`performWreckReconstructionAction` has no cooldown, so consecutive commits land
0.66–1.29 s apart; `storyText` is a single caption slot with instant overwrite
and no queue (the baseline records this explicitly). First broken state: the M2
line renders as **"the ke"** and is replaced. Measured cut points across 3/3 cold
runs and 3/3 variant runs: M1 38/73, M2 19/78, M3 19/90, M4 21/74, M5 19/40
characters. Only M6 survives.

**FJ-2 — mobile caption meets the thumb cluster.** Same beat on portrait touch.
`STORY_HUD_TOUCH_CONTROL_CLEARANCE_PX (174) + 18 px gap` places the caption band
at ~192–244 px from the bottom edge; the embodied `CONSUME`/`USE` row sits at
~185–240 px. First broken state: caption text drawn behind/into the action
buttons, with no objective card on screen to fall back on.

**FJ-3 — dive back down during the ch8 exit window (new surface, this run).**
Reach `deep_space`; the 17 s hold begins and the card reads `LET THE SYSTEM
RESOLVE.` while flight control is fully live. The atmosphere boundary is
bidirectional and altitude-driven (`ShipController.tsx:1031`), so nosing down
below `ATMOS_ENTER` flips `phase` to `descent`. `tickLaunch` then returns early
at its `phase !== 'deep_space'` guard, but `runtime.launchExitObservedAt` is not
reset and `runtime.elapsed` keeps accruing. First broken state: on climbing back
out, every remaining `once()` row fires in a single frame into single-slot bands
(only the last survives) and the beat advances immediately. The whole
commissioned consequence stack — up to and including `CONTACT LOGGED.` — can be
skipped. Guidance stays truthful throughout (`ch8:launch:climb` republishes with
an honest work order) and there is **no deadlock**: `exitShip()` requires
`phase === 'surface'`, so the player cannot strand themselves by leaving the seat
in deep space. Before this run the window was zero ticks wide.

**FJ-4 — the objective lags the world across the dwell.** `midflight-beat-reentry`
(`seeded-entries.json`) captures the card reading `KESTREL FLIGHT CONTROLS ·
IGNITE / HOLD [SPACE] TO IGNITE AND LIFT.` with health `ready` while
`phase: descent` and the L2 caption is mid-reveal. At the other end,
`ch8:launch:orbital-handoff` publishes **1.767 s into** the exit window, i.e. the
card still says "HOLD COURSE THROUGH THE ATMOSPHERE" after the atmosphere is
behind you, clearing the first audit row by only **0.249 s**. Pre-existing 1.75 s
dwell hysteresis; newly *visible* because the beat no longer exits on the same
tick.

**FJ-5 — replay.** `quit-replay-trace.json` records L1, L2 and L3 emitted at the
identical story-clock timestamp `3200.700 ms` after a reload of
`?story=ch8-launch&movie=1`, with only L3 left in the store and the card reading
`HOLD [SPACE] TO IGNITE AND LIFT`. The same URL under `routeC` measures L1→L2 at
1.4 s. `storyNow()` is an unpaused wall clock, so identical timestamps mean one
frame. One of the two measurements is not describing what a player sees after a
reload, and no post-replay frame evidence exists.

## Accessibility and variant parity

| Axis | Result |
| --- | --- |
| Desktop | Objective card, marker, prompt and caption all present and non-overlapping (`caption.placement: right-of-objective`). Best case. |
| Mobile portrait | Guidance parity exact; no persistent card (top-rail `JOURNAL` trigger, shipped pattern); caption lane collides with the embodied action cluster (FJ-2). Cockpit-era ch8 captions clear the flight controls. |
| Reduced motion | Cadence within 0.081 s of the desktop reference; identical strings and order. No `prefers-reduced-motion` branch exists in either text renderer, so the typewriter reveal runs regardless — parity by absence, not by design. |
| POTATO (lowest in-scope tier) | Identical card, work order and cadence (`off_6p0s_ch8-launch.png`); `ch8:launch:climb` never publishes (vd-03). |
| Manual play | **No evidence.** Baseline gap 1 ("headless cannot drive the [F]/[C] repair transactions") is carried forward unclosed; ch8 manual routes are scripted keyboard input, not headed play. |
| Movie mode | Fully traced; it is also the mode in which the ch7 truncation and the ch8 L3 drop are worst. |
| Screen reader | Meaning survives (the card is `aria-live="polite"` + `aria-atomic` with `data-objective-*` attributes), but three live regions now carry ~4× the ch7/ch8 traffic and two of them mutate per animation frame. |

## Defects

| ID | Severity | Objective / anchor | Observation | Evidence | Owner | Requested outcome / recheck route |
| --- | --- | --- | --- | --- | --- | --- |
| `ux-01` | medium | `reconstruct:repair:*` M1–M5 | Five of the six per-repair voice lines are cut mid-word at 19–38 of 73–90 characters on every traced route and variant. ch8 received arithmetic slot protection (`CH8_L1/L2_MIN_SLOT_SECONDS`, proven by unit test); ch7's stage ladder received none, although the baseline already recorded the single-slot, no-queue behaviour. | `cadence-assertions.json` `stageEdgeGapsSeconds [1.294,0.667,0.667,0.717,0.656]`; `ch7-captures-desktop/pre-origin/pre_006_5.54s_ch7-reconstruct.png` ("the ke"); `variant-parity.json` (same gaps on mobile/RM/POTATO) | chapter | Rule the intended per-stage slot behaviour (protect, shorten, or declare truncation authored as ch8 did). Recheck: verifier re-measures ch7 caption screen-life vs. reveal time on 3 cold runs per variant, plus one manual-play run. |
| `ux-02` | medium | ch7 caption band, portrait touch | New ch7 caption traffic renders into the embodied action-button lane; `STORY_HUD_TOUCH_CONTROL_CLEARANCE_PX (174) + 18` does not clear the `CONSUME`/`USE` row. The lock required a mobile caption/audit legibility check; this is the check failing. | `ch7-captures-mobile-portrait/pre-origin/pre_006_5.62s_ch7-reconstruct.png`; `storyHudLayout.ts:149-192` | cinematography | Rule the embodied-era touch caption lane against the mounted control cluster. Recheck: one portrait frame per ch7 stage caption at the widest and narrowest in-scope viewport. |
| `ux-03` | medium | `ch8:launch:orbital-handoff` / `CH8_EXIT_HOLD_SECONDS` | The 17 s hold is played over live flight controls across a bidirectional atmosphere boundary. Leaving `deep_space` suspends the advance without resetting `launchExitObservedAt`, so re-entry fires every remaining row in one frame and advances instantly, silently discarding the consequence stack. No deadlock and no dishonest guidance. | `emergentStoryDirector.ts` `tickLaunch` guard vs. `ShipController.tsx:1031`; `spaceFlight.ts:299-393`; `quit-replay-trace.json` mid-state | integration | Decide and wire the intended behaviour when the exit fact is lost mid-window (hold, re-open, or commit). Chapter ruling if the narrative intent is that the window is unrepeatable. Recheck: scripted dive-and-climb probe inside the window, 3 cold runs, asserting no row is emitted more than once and the beat still advances. |
| `ux-04` | medium | `objective-lifecycle-evidence.json`, `chapter-journey-evidence.json` | The mandatory lifecycle artifact declares `contractVersion draft-v2` / `sha aa7ea1…` / `capturedAt 18:05Z`, while the frozen contract is `draft-v4` / `df544b…` and the artifact cites measurements generated 21:08–21:57. The journey artifact carries `contractSha256: null` and `contractVersion: null` against a README that requires a contract-hashed report. Binding cannot be verified as filed. | file headers; `objective-lifecycle-measurements.json` `generatedAt 21:57:52Z`; `main/src/story/ux/README.md` "Required production evidence" | integration | Re-bind both artifacts to the frozen revision and hash, or state the supersession inline. Recheck: hash comparison only, no replay needed. |
| `ux-05` | medium | whole run | No headed, human-operated evidence exists. `chapter-journey-evidence.json` self-declares `headed: false`, `humanOperated: false`. ch7's eight mandatory objectives have **no manual-play lifecycle trace** in this run or in the baseline; `ch8:launch:reboard` has zero lifecycle, variant and reset evidence in both. The README states headless scripted input cannot stand in for real pointer-lock. | `chapter-journey-evidence.json` `lane`; `shipped-ux-baseline.json` `openBaselineGaps[0,2]`; `objective-lifecycle-evidence.json` objective 9 `gap` | full triad via Scene Cohesion Judge (exception) + verifier (evidence) | Either record an explicit scoped exception for a non-release draft-surface pacing change, or close the gap with one headed manual ch7 pass and one on-foot ch8 entry. Recheck: a single headed manual run covering the ch7 bench sequence and `ch8:launch:reboard`. |
| `ux-06` | medium | ch8 L1–L3 on drivable routes | On the chained and deep-link movie routes — the only routes traced end to end — L3 never renders (`l3DroppedEveryRun: true` on routeB, routeC and all three routeD variants), L1 is cut at ~42/94 characters by the phase-edge acceleration, and L2 at ~54/65 by L4. The contract declares this authored degradation under the drop rule and re-scopes the canonical route to ordered ignition (vd-04, draft-v4). Recorded here as the player-visible consequence of an accepted ruling, not as a challenge to it. | `ladder-analysis.json` routes `routeB.chained-movie`, `routeC.deeplink-movie`, `routeD.*`; `routeA.space-then-w` `c3MarginSeconds -1.17…-1.24` | chapter (already ruled) | No new work requested; confirm the owner has seen that the ordered-ignition canonical route is not the route a chapter-select or movie playthrough produces. |
| `ux-07` | low | replay / reload seam | L1+L2+L3 recorded at one identical story-clock timestamp after reload, contradicting the same URL's 1.4 s spread elsewhere; only L3 survives; no frame evidence for the post-replay ladder. | `quit-replay-trace.json` case `replay` vs. `ladder-analysis.json` `routeC` | integration | Re-measure the reload path with frame capture; reconcile or explain. |
| `ux-08` | low | ch7 exit line | The owner-approved line gets 2.018 s of screen life, 1.26 s of which is reveal — 0.76 s of readable dwell — before ch7-board's entry parenthetical takes the slot at +5.028 s. Captions are not cleared at a beat boundary, so an out-of-scope adjacent beat cuts the one string this run was chartered to fix. | `cadence-assertions.json` `boardOverwrite`; `ch7-captures-desktop/off_4p8s_ch7-reconstruct.png` | chapter | Rule whether 0.76 s of dwell satisfies the owner decision, given ruling R1 keeps ch7-board's caption out of scope. |
| `ux-09` | low | `reconstruct:ready`, `ch8:launch:orbital-handoff` | Two waits with no named next action are extended/created: 0.65 s → 5 s embodied, and 0 → 15.3 s over live flight controls. Both work orders are honest and the ch8 window supplies perceived progress through the audit stack; the ch7 hold supplies none. | `cadence-assertions.json`; `off_11p5s_ch8-launch.png` | chapter | Confirm the 5 s embodied wait needs no progress affordance. |
| `ux-10` | low | caption + audit renderers | `StoryCaptions.tsx` and `AuditBand.tsx` rewrite `textContent` every animation frame inside `aria-live="polite"` regions, alongside the card's own polite region; this run roughly quadruples ch7/ch8 traffic through them. Neither renderer consults `prefers-reduced-motion`. | `StoryCaptions.tsx:45-68`, `AuditBand.tsx:22-42`, `StoryGuidanceHud.tsx:375` | integration | Rule the live-region strategy for revealed text. Recheck: static/DOM assertion only. |
| `ux-11` | low | all nine guidance objectives | The signed `acceptanceCriterion` asserts "zero missing-marker frames"; the run's raw evidence records 7–13 missing-marker observations per objective and a 2.96–3.14 s window on mandatory `reconstruct:diagnose` at beat entry. The behaviour is pre-existing; the contract sentence is not satisfiable as written. | `objective-lifecycle-evidence.json` `markerHealthDefinition`; `objective-lifecycle-measurements.json` | Scene Cohesion Judge (contract wording) | Align the criterion with the measured definition, or record the transient as an accepted exception. |
| `ux-12` | low | `reconstruct:craft:*` | The two craft objectives fire a full acknowledgement cue and are replaced 23–84 ms later on the movie path (`readyReachedCount` 1/6 and 3/6). Harmless under manual play — where the objective persists until the player crafts — but unproven, since no manual trace exists. | measurement rows, objectives 5 and 7 | integration (evidence) | Covered by the `ux-05` manual pass. |
| `ux-13` | low | vd-03 attribution | "POTATO climb skip is pre-existing" rests on "no POTATO baseline exists for comparison" — an absence of contrary evidence, not evidence of pre-existence. The mechanism (tier-dependent pacing crossing the dwell threshold) is plausible and unrelated to the mutated code, so the conclusion is very likely right; the wording should say so. | `defects.json` vd-03; `objective-lifecycle-evidence.json` `nonMarkerObjectivesUndisturbed[3].note` | escalation (as filed) | Wording only. |

### Pre-existing defects — attribution checked independently

- **dissent-06 (`reconstruct:repair:bench_online`, high, pre-existing):**
  confirmed pre-existing. `shipped-ux-baseline.json`'s marker map already records
  `"exact to the published objective, but stale versus the required action after
  salvage is claimed"` at revision `03e975a`, and this run publishes the same
  label on all six entries. **Not introduced and not worsened.** One interaction
  worth the Chapter Director's attention: the new M2 line latches on the
  `bench_online` stage edge — the keel install — so the run now supplies narrative
  confirmation of an action the work order never asked for. That makes the
  existing mismatch more conspicuous without changing it. This remains the single
  worst player-experience defect inside the mutated beat.
- **vd-02 (ch8-landfall chained stall, medium):** confirmed downstream of every
  mutated path; `?story=ch8-landfall&movie=1` completes in 10.5 s. Correctly
  attributed pre-existing; the failing `voice-repair-probe.mjs full-flow` check is
  this and nothing else.
- **vd-03 (POTATO climb skip, low):** attributed pre-existing; see `ux-13` on the
  evidentiary basis.

## Protected strengths — a repair must not erase these

1. **The guidance layer itself is exemplary and untouched.** Card, world marker,
   interaction prompt and distance readout all name the same verb in the same
   words on every frame inspected. Nine objectives, 39 entries, one cue each,
   zero label drift, across four variants. Do not let a caption-pacing repair
   reach into `objectiveDirector.ts`, `storyObjectiveGuidance.ts` or the
   `StoryDirectorDriver` bridge.
2. **Presentation cannot advance progression, and this run kept it that way.**
   Both new holds still commit on the identical durable facts; the sandbox stays
   silent; the 0.65 s hold pattern was mirrored rather than replaced with a
   scheduler.
3. **Pause is genuinely pause-aware.** The 17 s window's story offsets survive a
   5 s pause exactly. Any change to the window must preserve this.
4. **Re-entry seeding.** Deep link, replay and mid-flight restore all avoid a
   catch-up burst of past lines; the phase-only seeding reading is the correct one
   and is well argued in `check-results.json.contractInterpretation`.
5. **Caption/objective separation.** `storyHudLayout`'s `right-of-objective` /
   `above-objective` solve keeps the desktop caption off the work order. The
   mobile repair must not fix `ux-02` by moving the caption over the card.
6. **The variant D restoration is honest.** `DEEP SPACE · HANDOFF / ATMOSPHERIC
   EXIT IS COMPLETE. / LET THE SYSTEM RESOLVE.` with `requiresMarker: false` and
   no fabricated marker is the correct answer for a cockpit wait; the contract
   respects the flag and the frames confirm no phantom marker appears.

## Recheck spec

Smallest evidence set that would clear the routed repairs:

**Manual (headed, human-operated) — one session, closes `ux-05`, `ux-12`:**
1. `?story=ch7-reconstruct` — diagnose, then perform the five bench transactions
   as fast as the controls allow; capture one frame per stage caption. Then repeat
   deliberately (≥4 s apart) to bound the readable case.
2. Walk away from the bench mid-objective and return; open and close the
   fabricator; press `[F]` early. Confirm the card never goes stale.
3. `?story=ch8-launch` entered **on foot** to reach `ch8:launch:reboard`; record
   marker label, health, cue count and one reset.
4. Inside the ch8 exit window, dive back below the atmosphere boundary and climb
   out (closes `ux-03`).

**Automated — closes `ux-01`, `ux-02`, `ux-04`, `ux-07`:**
1. Extend `cadence-assert.mjs` to emit, per ch7 stage line, `screenLifeSeconds`
   and `charsRevealedAtReplacement`; assert against whatever the Chapter Director
   rules. 3 cold runs × desktop/mobile/reduced-motion/POTATO.
2. One portrait frame per ch7 stage caption at the narrowest and widest in-scope
   viewport, with the action cluster visible.
3. Re-run `quit-replay-probe.mjs` with per-emission frame capture.
4. Re-hash and re-bind `objective-lifecycle-evidence.json` and
   `chapter-journey-evidence.json` to `draft-v4` / `df544b13…`.
5. Unchanged and re-run as regression: `npm --prefix main run story:ux:check`
   (6 files, 54 tests) and the objective-lifecycle measurement pass — these must
   still show one label, one cue per entry, and 8/8 resets for all nine objectives.

## Verdict

Verdict: `repair` — the shipped guided-play lifecycle is genuinely undisturbed
and the marker/work-order/cue contract is clean on all measured evidence, so
nothing here blocks on player agency or navigation. But the presentation this run
added is, on its own traced routes, largely unreadable in ch7 and collides with
the mobile control cluster; the ch8 exit hold opens a 17 s live-control window
whose loss-of-fact behaviour is unspecified; and the mandatory lifecycle and
journey artifacts are bound to a superseded contract revision with no headed or
manual-play evidence anywhere. Six medium findings are routed. This is an
independent input to the Scene Cohesion Judge, not scene or release approval.


## DELTA RE-AUDIT — 2026-08-11

Reviewer: `player-experience-auditor (independent, read-only)` · review pass 2 of 2
Contract revision: `draft-v5` (`36a7cb4f2bf9cc8d24d2413579225dcb50a4436b37a20fb762d79fec6cb4ecdb`, `frozen`)
Scope: delta only. Findings not listed here are unchanged from the 2026-08-10 report.

### VERDICT: `repair` — lane floor breach cleared

The `ux-01` breach that drove my original floor is **resolved**, and resolved at the pixel/DOM level rather than by assertion. No defect that originates inside this run's mutation boundary now exceeds medium. Two items keep the lane at `repair`: `ux-02` (measured fail, deliberately routed out of the lock to the owner) and the new `ux-15` (medium, introduced by the loop-3 repair itself). If the Judge accepts `ux-02` as a routed-out owner decision and the Chapter Director rules `ux-15`, my lane has nothing left that blocks.

### Journey summary, updated

A first-time ch7 player now receives the thing the run was chartered to give them: **the reward for their own work is legible.** Every fired stage line reaches full reveal on screen before it is replaced — verified in the frame sidecars, not just in arithmetic. The first uncertainty has moved: it is no longer "what did the game just say to me", it is **"the voice is talking about work I finished several actions ago."** Frame `evidence/verification-final/ch7queue-desktop-run1/014_strip_t9p34s_ch7-reconstruct_surface.png` shows the caption speaking the keel line (M2) at full reveal while the objective card already reads `KESTREL · CALIBRATING / FLIGHT CALIBRATION IN PROGRESS.` and the audit band carries the lift-cell row. Guidance is unaffected — the card, marker and prompt stay real-time — so this is comprehension friction, not navigation loss.

### Per-finding disposition

| ID | Disposition | Basis |
| --- | --- | --- |
| `ux-01` | **resolved** | Frame-sidecar DOM proof, not arithmetic: on 3 cold desktop movie runs every fired line hits `revealComplete: true` before replacement — M1 73/73 @6.40 (swap 6.55), M2 78/78 @9.34 (9.632), M3 90/90 @13.06 (13.115), M4 74/74 @15.97 (16.049), M6 82/82 @19.00 held to 19.41 (19.465). Portrait and landscape identical. Paced manual-shape: zero drops, all six fire, min slack 2.569 s. Mechanism verified in source — the queue is caption-only, beat-scoped, cleared in `enterEmergentStoryBeat`, drains on `runtime.elapsed` (pause-aware), and derives reveal from the renderer's own constant. M5 drops at receipt on movie under the ruled drop-at-close; M6 never drops (unit-tested). |
| `ux-02` | **confirmed-unrepaired-routed** | Independently re-confirmed by pixel, not by prose: `ch7mobile-mobile-portrait-run1/049_anchor+2.4_t21p15s_…png` shows the M7 caption's final word running under the `CONSUME` pill. 59/76 portrait frames collide, worst 3224 px²; landscape 23/76. Portrait still shows no persistent objective card. Recorded as status; fix is outside the lock and rides to the owner with the scrim-vs-ink question. |
| `ux-03` | **resolved** | 3 cold dive runs: drift **0.0000 s** across 148 samples / 10.9 s of wall dip, 0 rows during the dip, no row re-fired, min inter-row held gap 1.988 s against a 2.0 s table, all seven window rows once each within 0.001–0.017 s of their held offsets, advance requires held ≥17 **and** `deep_space`. Guidance stays honest through the dip: the objective reverts to `ch8:launch:climb` with one entry cue and returns to `orbital-handoff` with one cue (`dive.json` events, 25.57 s / 36.50 s). FJ-3 is closed. |
| `ux-04` | **resolved, one low residual** | Both artifacts carry `draft-v5` / `36a7cb4f…`. The lifecycle artifact was genuinely re-derived — `lifecycle-rebind.mjs` counts every row from 26 closing traces across 19 runtime objectives — and `supersedesBinding` records the draft-v2 origin rather than editing it away. Residual below. |
| `ux-05` | **confirmed-unrepaired, narrowed** | `ch7manual` self-declares *"SCRIPTED, NOT MOVIE, NOT PLAYER-EMBODIED"*; journey lane is still `headed: false, humanOperated: false, machineJourneyCertifying: false`; `ch8:launch:reboard` is still absent from all 19 measured objectives. What did close: the paced run gives the first per-stage manual-shape lifecycle for all eight ch7 objectives. |
| `ux-06` | **half resolved, half re-shaped → `ux-15`** | L1 is no longer cut (reveal guard; routeB swap margins 0.003–0.052 s, routeC 89/94 at 6.392 with completion before the 6.583 swap). L3 still drops on every movie route. L2 regressed — see `ux-15`. |
| `ux-07` | **resolved** | Pre-boot instrumentation: 6 captions at 6 distinct stamps over 20.449 s, 103 frames; the single-timestamp record is identified and not reproduced — it was a probe bug (subscription installed after reload). Quit-to-menu emits zero captions after the interrupt. |
| `ux-08` | **closed by ruling [32], evidence improved** | MOD-02 re-measure: the ch7-board parenthetical begins **at** the advance (Δ 0.0000 / 0.0000 / −0.001 s on three cold runs), not 0.15 s before. Exit line gets 2.00 s of screen life against a 1.292 s reveal ≈ 0.71 s of post-reveal dwell — thin, but above the run's own 0.4 s dwell constant. Accepted. |
| `ux-09` | **accepted with rider [32]** | Honest on the path that matters: on the manual-shape run the M7 anchor equals the receipt, so the hold is 5.02 s and carries the M7 stamp, M7 caption and exit line. The movie path's re-anchor extends the post-receipt wait to ~11.5 s, but that path is non-interactive. |
| `ux-10` | **unchanged, no new evidence** | No `prefers-reduced-motion` branch added. Incidental improvement: serialising the ch7 captions lowers peak live-region churn on fast paths. Stays routed to integration. |
| `ux-11` | **resolved as contract wording** | Criterion [35] restates marker health to the measured definition and records the 2.96–3.14 s `reconstruct:diagnose` acquisition transient as an accepted exception. Resolving it immediately surfaced the unaccepted case → `ux-14`. |
| `ux-12` | **resolved in substance** | Paced run: `reconstruct:craft:lift_online` lives 6.162 s and `craft:flight_ready` 6.037 s, both reaching `ready`, one cue each. The 23–84 ms movie flash is confirmed a movie-pacing artifact. Not headed. |
| `ux-13` | **resolved** | Criterion [25] now states the attribution as an absence of contrary evidence plus a mechanism argument, which is what the evidence supports. |

### New findings

| ID | Sev | Observation | Evidence | Owner | Requested outcome |
| --- | --- | --- | --- | --- | --- |
| `ux-14` | high **(pre-existing, not scored against this run)** | `reconstruct:repair:bench_online` holds `missing-marker` **while active and acquired** for 0.681–0.683 s on five movie/variant runs and **5.948 s** on the paced manual run. The flip coincides exactly with the salvage claim (manual: salvage 9.416 s → health flips 9.419 s → cleared 15.367 s). So for ~6 s of paced play the HUD names a verb already performed *and* has no marker, while the required act is the keel install. Outside criterion [35]'s accepted exception; the verifier files it as `unaccepted`. **Mitigant, stated honestly:** the work order's first line `RETURN TO THE WRECK BENCH.` still names the right place, at a fixture the player just used — the failure is verb + marker, not location. | `objective-lifecycle-evidence.json#rebind.freshFindings.unacceptedException`; `evidence/verification-final/objective-lifecycle-measurements.json` | dissent-06 family follow-on: Chapter Director (one ID covering two actions) + Integration Engineer (marker resolution in the salvage→bench window); scope exception via the Scene Cohesion Judge, since the fix lies outside the lock's `allowedPaths` | Split or re-publish the objective at the salvage receipt so verb and marker both track the required act. Do not score against this run. |
| `ux-15` | medium **(introduced by the loop-3 repair)** | The reveal guard moved `l2DueAt` to within ~0.1–0.2 s of the exit fact on every movie route. L2's slot fell from **1.32–1.71 s pre-patch to 0.06–0.19 s**, and to a **full drop on POTATO** in all three cold runs. At 34 ms/char, 0.1 s renders about three characters — no frame in the routeC strip ever caught L2 at all. Separately, L1's *post-reveal* dwell is 0.003–0.08 s: criterion [24] permits dwell to zero, so "no reveal is cut" is true while "the end of the sentence is never read" is also true. Net on the routes a chapter-select player takes: one of three ladder lines is legible, one flickers, one is absent — and the tier that loses the line entirely is the lowest one. Contract-conformant under [22]/[24]; recorded because it is material, reproducible, and a parity loss. | `verification-report.json#closingVerification.routeCandD.measuredBehaviourChange`; `evidence/verification-final/routeC-desktop.json` frame sidecars; pre-change reference `evidence/verification-v3/routeC-potato.json` (L2 at 4.37–4.72 s holding 1.64–1.66 s) | chapter | Rule the drop-vs-flash threshold for the ch8 ladder, and whether the lowest tier may carry a different line set than the others. ch7's close already answers the analogous question with drop-at-close; the two beats currently answer it differently. **Do not repair by weakening the reveal guard** — it is a real win. |
| `ux-16` | low | Post-dip dwell hysteresis at the window's tail. Run 1: dip 23.866 s → CLIMB card 25.57 s (1.70 s late); re-exit 34.766 s → HANDOFF card 36.50 s (1.73 s late) → advance 36.818 s. The correct card returns **0.32 s** before the beat ends. A dip later in the window would let the beat cut to ch8-crossing while the card still reads `HOLD COURSE THROUGH THE ATMOSPHERE` — mechanism named, that case unmeasured. | `evidence/verification-final/dive.json` objective events | integration | Reconcile the 1.75 s dwell with the held-clock advance. Must not be fixed by removing the dwell — it is what prevents flicker. |
| `ux-17` | low | Entry acknowledgement is now unproven in the *at-least-once* direction. The closing measurements report `feedbackCuesPerEntry` 0.167 for `reconstruct:diagnose` (1 cue / 6 entries), 0.417 for `ch8:launch:ignite` (10/24) and 0.75 for `board:enter-hatch` (6/8), while the headline `allOneShotEntryFeedback: true` only asserts *never more than one*. Pattern matches instrumentation attaching after beat entry (diagnose's observed life is 0.293–0.462 s on the five zero-cue sources vs 3.65 s on the one that caught the cue), and `activateGuidedStoryObjective` is untouched — but the artifact's headline should not be read as proving the cue fires. | `evidence/verification-final/objective-lifecycle-measurements.json` | integration (evidence) | Install the subscription before beat entry on one deep link per beat and re-report both directions. |
| `ux-18` | low | Criterion [3] asks three cold runs **per variant**; delivered 3 on desktop, 1 each portrait/landscape, none on ch7 reduced-motion or POTATO. Substantially de-risked by source: `StoryCaptions.tsx` reveals via `Math.floor((storyNow() - shownAt) / 34)`, so reveal duration is time-based and tier-independent, and the guard derives from the same constant. The tier-sensitive input is autopilot commit pacing, which changes only which lines drop at close — and M6's no-drop is unit-tested. Cheap to close. | `main/src/story/StoryCaptions.tsx`; contract criterion [3] | integration (evidence) | Two ch7 queue runs at reduced-motion and POTATO. |
| `ux-19` | low, informational | Accepted cost of the `ux-01` repair, recorded so the Chapter Director sees it: on fast paths the voice trails the world by up to ~3.3 s (`tM6` requested 12.748 s, displayed 16.049 s; `anchorShiftSeconds` 3.14). Frame `014_strip_t9p34s` shows M2 speaking while the card reads `KESTREL · CALIBRATING`. Guidance is untouched; the drop-at-close bounds the trail. | `verification-report.json#closingVerification.ch7QueueGuard`; the cited frame | chapter | No work requested. Confirm the trailing voice is the intended shape. |

### Residuals on otherwise-resolved findings

- **`ux-01`:** measured post-reveal dwell on the movie path lands ~0.15–0.35 s against the nominal 0.4 s (frame sampling plus one-frame quantisation of `Math.floor(elapsed/34)`); the reported slack of 0.017–0.031 s is computed against the *assumed* reveal, so true headroom is thinner than the constant reads. Also: portrait's aggregate `minSlackSeconds` reports `null` while its per-line slacks are 0.017–0.031 — aggregator nit, not a behaviour.
- **`ux-03`:** the browser-measured dip physically began at held 14.96 s with only the advance pending, because reverse throttle is 0.34× forward. The verifier declares this deviation itself. The early-window dip (five rows pending) is proven by unit test — *"freeze on dip with 600 s of wall time adding nothing"* — not by browser trace.
- **`ux-04`:** `chapter-journey-evidence.json` is re-hashed but 8 of its evidence refs still point at the superseded `evidence/verification/` set, and its `sourceRevision` reads pristine `03e975a` while the closing traces ran against `03e975a + loop-3 patch`. Separately, the top-level `markerHealthDefinition` prose in `objective-lifecycle-evidence.json` still asserts *"0.000–0.001 s for every objective except reconstruct:diagnose"*, which its own `rebind` block now contradicts (`bench_online` 0.681–5.948 s). Both are low, wording/binding only.

### Accessibility and variant parity — delta

| Axis | Result |
| --- | --- |
| Desktop | ch7 queue guard passes on 3 cold runs; every stage line fully revealed before replacement. |
| Mobile portrait | Guidance parity exact; ch7 queue guard passes (per-line slack 0.017–0.031); **caption/control collision is a measured fail** (`ux-02`). |
| Mobile landscape | Newly captured. Queue guard passes, min slack 0.018; 23/76 frames overlap but remain legible. |
| Reduced motion | ch8 parity holds (L2 cause `reveal-guard`, exit window within 0.065–0.066 s). **ch7 queue guard unmeasured** (`ux-18`). |
| POTATO | ch8 exit window within 0.066–0.069 s; **L2 now dropped entirely** where it previously held 1.64–1.66 s (`ux-15`). ch7 queue guard unmeasured. |
| Manual | Paced manual-shape run exists and is honestly declared scripted. Still no headed, human-operated evidence; `ch8:launch:reboard` still has zero lifecycle evidence (`ux-05`). |
| Movie | Fully traced; still the mode where ch8 legibility is worst and ch7 is now best-protected. |

### Protected strengths a repair must not erase — additions

7. **The ch7 queue's separation of channels.** It defers *captions only* — stage commits, regulation receipts, score variants, anchors and objective transitions all stay real-time, verified in source and visible in the frame record. Any pacing change must keep that line.
8. **The reveal guard's absoluteness.** `l2DueAt = max(t_L1 + revealSeconds(L1), min(t_L1 + slot, t_edge))` derives reveal from the string's own length against the renderer's own constant, so a copy edit can never silently outrun its protection. `ux-15` must not be repaired by loosening this.
9. **The held exit clock.** Freeze/resume/no-refire/no-burst is proven three ways — browser trace, unit test, and dual-condition advance — and the dive path's *guidance* is exemplary: one honest re-publication of `climb`, one cue, one honest return to `handoff`.
10. **Caption TTL is not the truncating agent.** `showCaption` ttl 5200 ms with fade at 4500 ms; the longest queued line needs 3.46 s. Checked and clear.
11. **Lock discipline.** All five authority hashes still match; the working tree is still inside `allowedPaths`; `storyText.ts` itself is unmodified (only its new test file), so every frozen string is untouched.

### Recheck spec — smallest set that clears what is routed

**Automated (cheap, closes `ux-17`, `ux-18`, and the `ux-04` residual):**
1. Two ch7 queue runs at reduced-motion and POTATO, asserting `screenLife ≥ reveal` per fired line and M6 never dropped.
2. One deep link per beat with the objective subscription installed pre-boot, reporting entry-cue counts in **both** directions.
3. Re-point `chapter-journey-evidence.json`'s observation refs at `evidence/verification-final/`, correct its `sourceRevision`, and reconcile the stale `markerHealthDefinition` prose with the `rebind` block. Hash comparison only.

**Ruling-dependent (`ux-15`):** whatever the Chapter Director rules, prove it on routeC desktop + POTATO, 3 cold runs, reporting L2's slot seconds *and* the character count actually rendered — the slot figure alone hid this.

**Manual, headed (still open, `ux-05` / `ux-14`):** one session — ch7 bench sequence at player pace with a frame at each stage caption; `ch8-launch` entered **on foot** to reach `ch8:launch:reboard`; and the `bench_online` salvage→keel window observed directly to confirm what a real player does during the ~6 s marker gap.


## Chapter Director closeout rulings on ux-15 / ux-19 (2026-08-11, committed verbatim by the orchestrator)

**Ruling (a) — drop-vs-flash threshold: DROP-NOT-FLASH, at the reveal-complete threshold, unifying both beats.** The threshold is `revealSeconds(line)` — the only non-arbitrary line the contract already owns: a line exists when its reveal completes; anything less is not a shorter version of the line, it is a glitch wearing its clothes. A three-character flash is worse than absence — absence reads as authored silence, a flash reads as breakage. Therefore, for the ch8 ladder: **a fired line cut before reveal-complete is classified as a DROP for all evidence, assertion, and scorecard purposes — never as a render.** Evidence must report rendered-character counts, per the auditor's own observation that the slot figure alone hid this. This dissolves the two beats' disagreement rather than picking a side: ch7 drops cleanly because its close is *knowable at fire time*; ch8's exit is a future fact, so its version of the same law is retrospective classification now, and prospective prevention wherever a future implementation can know the close (the C6 autopilot-pacing packet, or any later amendment, must convert the flash into a clean non-fire — a line may not begin unless it can finish, exactly as ch7's drop-at-close already behaves). L3's existing "authored truncation" language is subsumed: reveal-complete or absent, nothing between, in both beats. The reveal guard itself is untouched — protected strength #8 stands; this ruling governs only how sub-reveal renders are *named and asserted*. No patch this run; the classification binds the record, the recheck spec (routeC desktop + POTATO, 3 cold runs, slot seconds AND character counts), and the judge's reading of ux-15.

**Ruling (b) — tier line-set parity: NO tier carries a different authored line set; tier-dependent drops are pace outcomes of one law, and that is only acceptable under three stated conditions, all currently true.** The ladder's authored set is identical everywhere; POTATO's missing L2 is not POTATO authorship — it is the same drop law meeting a faster exit, the same way the chained movie loses L3. This is permitted because: (1) no droppable ladder line carries obligatory story information — every load-bearing fact of ch8 (the four-row stack, the designation line, the open query) lives in the guaranteed exit window, which the re-audit measures within 0.07 s on POTATO; (2) the guarantee route is tier-independent — a POTATO player on the canonical ordered-ignition pace gets the full three-line ladder, because L2 timer-fires seated before the physics ever runs, so the disparity is confined to compressed routes, not to the tier as such; (3) the parity loss is recorded as a known cost riding the C6 packet, which — if the owner approves it — converges movie routes on all tiers to the full ladder. If any future change puts obligatory information into a droppable line, or makes the canonical route itself tier-dependent, this ruling is void and the question returns to the triad. The lowest tier losing *the most texture* while losing *no facts* is the correct failure order; the reverse would be a defect.

**ux-19 confirmation — the trailing voice is the intended shape, with its bound stated as the envelope.** A builder's interior monologue arriving after the hands have moved is truthful to labor — reflection lags act; the voice was never a commentator and the queue guard makes that literal on fast paths. The instruction channel never trails (card, marker, prompt real-time — the auditor confirms navigation is untouched), and the re-audit's own journey summary records the trade exactly as intended: the uncertainty moved from *"what did the game just say"* (illegibility — the chartered defect) to *"the voice is speaking about work I finished"* (comprehension friction — the cheaper cost, and on the design-target manual pace, near zero: min slack 2.569 s, zero drops). The bound is part of the confirmation: the trail is capped by the M6 re-anchor and drop-at-close at ~3.3 s worst-case measured; a capture showing the trail exceeding its `t_M7Anchor` bound is a defect, not taste. Confirmed intended.

One sentence for the judge's synthesis: ux-15 is a real, honestly-measured cost introduced by a repair I own, ruled here into a coherent law rather than papered over — and the full-ladder experience remains what it has been since vd-04: the ordered-ignition pace, on every tier, with the C6 packet as the route by which the movie screening joins it.

## Post-judgement lane disposition — 2026-08-11 (player-experience-auditor, committed verbatim by the orchestrator)

Re-ruled against `cohesion-judge.md` FINAL. `ux-15` is discharged for this lane
(ruled into law by the Chapter Director, owned, conditions stated and
voidable). `ux-14`'s exception is accepted as to *attribution only* — its own
condition (1) keeps the defect an open high — and CIN-01/`ux-02` remains an
open high whose scope decision is queued for the owner, not made. With two
open highs on the surface and the mandatory `ch8:launch:reboard` `[F]` commit
still unobserved, this lane's pass criteria are not met. The delta verdict is
unchanged and the floor breach remains cleared; what blocks a lane pass is
owner decision, not machine work. Two recorded owner actions would flip it
without a further loop: an explicit CIN-01 scope decision, and one headed
session (or a recorded scoped exception) covering the reboard commit, the ch7
bench at player pace and the `bench_online` gap. Verdict: repair (unchanged).
