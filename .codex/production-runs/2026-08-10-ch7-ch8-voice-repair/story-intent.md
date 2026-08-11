# Story Intent — ch7/ch8 voice repair

Author: Chapter Director
Status: ready_for_independent_treatments
Contract target: `ch7-ch8-voice-repair` revision `draft-v2` (enters the triad with
`contractChangeRequired: true` — voice grammar, beat causality at ch7, and ch8-launch
exit pacing all change)

Revision note: draft-v2 reconciles this intent against the story-verifier's
measured shipped baseline (`shipped-reference-map.md`,
`shipped-visual-baseline.json`, `shipped-ux-baseline.json`, this run folder) and
two recorded orchestrator rulings (R1: interleaved parentheticals are accepted
known drift, scope not expanded; R2: the bounded ch8 exit hold is carried by the
contract). Deltas D5 and D1 in §10 record the rulings.

This document stands alone. Score and Cinematography treat from this text, the
production lock, the measured baseline files above, and the shipped runtime — not
from the design-run treatment.

---

## 0. What this run is

Two post-arrival draft chapters get their voice. `ch7-reconstruct` currently plays
its five-step ship rebuild in near-total silence between one entry parenthetical and
one exit parenthetical; `ch8-launch` has a three-word work order and zero authored
lines. This run adds latched copy on existing player actions and existing signed
anchors, changes exactly one shipped string (owner-approved), and touches nothing
else. Release surface stays `ch4-arrival`; both beats are unshipped-surface content.

The dramatic engine, both chapters: **the ship you rebuild is the ship that reports
you.** The wreck hosts the relay the Authority's process used in ch4. Every part the
player restores brings a dead system back, and a system that comes back reports in.
To leave, the worker must become detectable to the thing it refused. No timer, no
fail state, no chase — escalation keys to repair stage, so it reads identically in
slow play and under `&movie=1`. The menace is being **indexed**, not caught.

The second spine: **the brackets come off.** Every embodied-voice caption from ch5
onward is parenthetical — shipped drift against the canon law that after the first
`i—` the embodied voice must not return to parenthetical grammar
(`main/PARAVOXIA_STORY_BIBLE.md:1185`). ch7's entry line `(repair is not return.)`
stays as the last private thought; from the diagnosis receipt on, the voice is bare.
A one-way exit turns a defect into the chapter's turn. (Interleaved beats outside
this lock still carry parentheticals — see §10, Deltas, D5.)

## 1. Grounding

- Affected beats: `ch7-reconstruct`, `ch8-launch` only. Adjacent for continuity
  evidence: ch6-dive exit, ch7-board, ch8-crossing entry, ch9 entry.
- Runtime references (verified at HEAD `03e975a`):
  - `main/src/story/emergentStoryDirector.ts:301-310` — ch7-reconstruct entry:
    guidance activation + `showCaption('(repair is not return.)')`.
  - `main/src/story/emergentStoryDirector.ts:559-595` — `tickReconstruction()`:
    per-frame `getShipRepairStage()` read (`:561`), diagnosis gate
    `hasWreckDiagnosisReceipt` (`:582`), exit latch
    `once('calibration-complete', …)` firing the shipped string
    `(the scar remains. now it can carry you.)` (`:590`) with a 0.65 s
    breathing-room hold before `advanceToBeat('ch7-board')` (`:592-594`).
  - `main/src/story/emergentStoryDirector.ts:315-317` — ch8-launch entry:
    `setWorkOrder(['IGNITE. LIFT. LEAVE THE ATMOSPHERE.'])`, no captions.
  - `main/src/story/emergentStoryDirector.ts:627-640` — `tickLaunch()`: advances
    to `ch8-crossing` the same tick `flight.phase === 'deep_space'` is observed.
  - `main/src/story/emergentStoryDirector.ts:165-181` — dwelled
    `ch8LaunchState` derivation (`surface-on-foot | surface-flight | launching |
    deep-space`, hysteresis via `CH8_FLIGHT_GUIDANCE_DWELL_SECONDS`).
  - `main/src/story/emergentStoryDirector.ts:499` — `AUDIT NETWORK` header
    precedent (`FAULT: W-7744 / MODEL REFUSED BY OBSERVATION`, a4-exhale).
  - `main/src/story/storyText.ts:77-91` — `showCaption(text, ttlMs=5200)` and
    `showAuditLine(text, header?, ttlMs=6500)`. **Both bands are single-slot: a
    new call replaces the previous line.** Sequential lines must be staggered.
  - `main/src/story/wreckReconstruction.ts:92-137` — shipped ch7 guidance:
    `diagnose` (`WRECK SCAR · TRACE RELATIONSHIPS`), `craft:[stage]` /
    `repair:[stage]` (`WRECK BENCH · …`), `calibrating` (`KESTREL ·
    CALIBRATING`), `ready` (`WRECK · FLIGHT READY`); craft labels `LIFT CELL`,
    `LOGIC WAFER` (`:196-199`). The director prefixes ids with `reconstruct:`
    (`emergentStoryDirector.ts:301-308`).
  - `main/src/story/emergentCapabilities.ts:10-16` — `ShipRepairStage` union:
    `wrecked | bench_online | frame_restored | hull_sealed | lift_online |
    flight_ready`. Typed transition event: `ship_repair_stage {from,to}`
    (`main/src/game/systems/shipRestoration.ts:84-110, :192-193`).
  - `main/src/story/reconstructionEmbodiment.ts:83` (`hasWreckDiagnosisReceipt`),
    `main/src/story/reconstructionCalibration.ts:75-79`
    (`hasReconstructionCalibrationReceipt`, calibration snapshot).
  - `main/src/story/vehicleSceneAvAnchors.ts:12-36` — signed semantic events;
    ignition enters + authenticates `ch8-launch`'s AV beat when a real launch
    sequence exists (`activateLaunchIgnitionFromCreatedSequence`, called from
    `main/src/components/ShipController.tsx:583`). Liftoff fires on physical
    outward departure (`hasLaunchPhysicallyDeparted`,
    `vehicleSceneAvAnchors.ts:46-64`, called at `ShipController.tsx:742-743`).
    Atmosphere exit fires via `subscribeAtmosphereExit`
    (`main/src/story/VehicleSceneAvDriver.tsx:19-27`,
    `main/src/state/spaceFlight.ts:193`).
  - `main/src/story/generatedSceneAvRuntime.json:656-693` — the three signed
    anchors `anc.launch.ignition`, `anc.launch.liftoff`,
    `anc.launch.atmosphere-exit` (protected file; observed, never edited).
  - `main/src/story/signedSceneAvRuntime.ts:130-172, :793` — read-only
    observation surface: `getSignedSceneAvDebugSnapshot()` exposes `anchorId` /
    `activatedAnchorIds`; `subscribeSignedSceneAv(listener)` exists.
  - `main/src/story/storyObjectiveGuidance.ts:469-503` — ch8-launch objective
    variants A–D with ids `ch8:launch:reboard / ignite / climb /
    orbital-handoff`.
  - Established token: `WRECK RELAY` already exists diegetically as the ch4
    relay marker (`storyObjectiveGuidance.ts:360-361`,
    `storyDirector.ts:2439`) — this run reuses it as an audit-band header for
    the first time; no plumbing needed (`showAuditLine` takes a header).
- Canon/progression references: `main/PARAVOXIA_STORY_BIBLE.md:1185` (no return
  to parenthetical grammar after `i—`), `:1194` (regulation headers carry no
  first person), `:432-447` and `:1526-1530` (the name is A8's payoff; its
  Worker 9 use is unauthored; the render is reserved for the ending).
- Authority: `production-lock.md` (this run); owner decision 2026-08-10
  approving the single ch7 exit-string change; the §4 designation line is
  routed to the canon auditor inside this cycle (stop condition if rejected).
- Evidence baseline: `shipped-reference-map.md`, `shipped-ux-baseline.json`,
  `shipped-visual-baseline.json` in this run folder (verifier capture at
  `03e975a`); probe entries `?story=ch7-reconstruct&movie=1`,
  `?story=ch8-launch&movie=1`. **Canonical preview: `http://localhost:5176`**
  (`npm --prefix main run dev -- --port 5176 --strictPort`). Ports 5173/5174 are
  held by the sibling Paraform project — repo probes that hardcode 5174 will
  silently capture the wrong application.
- Measured baseline facts this intent is bound to (full detail in
  `shipped-reference-map.md`):
  - ch7 is **fully on the signed AV rail**: eight `anc.reconstruct.*` anchors
    keyed to the exact events the new lines latch on (diagnosis, five stage
    edges, first-hover [intentionally optional/unreached], route-online,
    calibration), nine declared shots, live PostFX. Only **score intensity** is
    excluded by name (`scoreIntensityFor()` returns `null` for
    `ch7-reconstruct`/`ch7-board`, `signedSceneAvRuntime.ts:349-353`). Shots
    01–08 are `player-camera` 75°; **`cin.reconstruct.09-one-exterior-reveal`
    is `cinematic-look` at 52°, parked at `anc.reconstruct.calibration`** — the
    M7 copy lands on top of an authored exterior camera moment.
  - All three launch shots declare `cameraAuthority: "lens-rig"`, so
    `numericLensAuthorized()` refuses their declared FOVs; observed
    `appliedFovDeg` is `null` at every launch anchor — flight feedback keeps
    FOV ownership.
  - `spaceFlight.leaveAtmosphere()` sets `phase: 'deep_space'` and notifies
    atmosphere-exit listeners **in the same synchronous moment**
    (`spaceFlight.ts:391-392`); as shipped, a ch8-launch-scoped latch has at
    most one director tick before the beat exit clears the latch set.
  - The ch8-launch entry work order `IGNITE. LIFT. LEAVE THE ATMOSPHERE.`
    **never renders**: `syncEmergentObjectiveGuidance()` runs at the end of the
    same `enterEmergentStoryBeat()` call and `setWorkOrder`s the objective's
    own lines over it before React paints (measured; every trace shows
    `BRING THE KESTREL ONLINE. / HOLD [SPACE] TO IGNITE AND LIFT.` at t=0).
  - The wreck relay is a real shipped prop (`WreckRelay.tsx`, planted at the
    pod impact pose, the ch4-comply `organics` target); its beacon is **dark**
    during ch7/ch8 (lit only for ch3-signal/ch4-vigil/ch4-arrival/done). The
    `WRECK RELAY` header lines therefore attribute restored systems to the
    **hull** (`PASSIVE BEACON RESTORED` is the ship's beacon), never to the
    relay prop's light — no visual contradiction is created and none may be
    implied.
  - Caption slots are not cleared at beat boundaries; the shipped ch7 exit
    caption was observed **overwritten mid-typewriter 0.2 s after beat change**
    by ch7-board's entry caption (see D5/D9).

## 2. Dramatic contract

### ch7-reconstruct

- Player action: diagnose the scar (`[F] TRACE RELATIONSHIPS`), recover salvage,
  then five craft/install transactions at the wreck bench (keel workbench, strut
  frame, scarred hull, lift cell, logic wafer), then flight calibration. All
  existing; unchanged.
- Emotional before: **private rebuilding** — grief-tinged labor at a filed-closed
  wreck, the world indifferent, the work its own company.
- Emotional after: **chosen visibility** — every restored system made the worker
  more detectable; the last part was installed in full knowledge of the cost.
  Escape has been bought with exposure, on purpose.
- Story information conveyed: the wreck's relay is the same reporting channel the
  Authority's process used; restored systems resume reporting; attention has been
  raised but nothing has asked yet.
- Intended ambiguity: whether the attention is procedural or personal; whether
  the ship's returning systems are being *watched* or *welcomed back*. Never
  resolved here.
- Tutorial/gameplay purpose: the craft→install→calibrate loop and the chapter's
  shipped capability gain (lift cell → suit jet/hover; logic wafer → flight
  route). Copy annotates the loop; it never instructs — standing work orders
  remain the only instruction channel.
- Reality-stage ceiling: unchanged. This run grants **no** new perceptual or
  rendering capability; it gives language to the gains ch7 already ships.

### ch8-launch

- Player action: (reboard if on foot,) hold `[SPACE]` to ignite and lift, hold
  course through the atmosphere, then drift while the system resolves. All
  existing; unchanged.
- Emotional before: **silent checklist** — a beat that currently reads as pure
  procedure: objective card imperatives (`BRING THE KESTREL ONLINE.` / `HOLD
  [SPACE] TO IGNITE AND LIFT.` …), no interiority, no consequence. (The
  authored entry work order `IGNITE. LIFT. LEAVE THE ATMOSPHERE.` never
  actually renders — see D8.)
- Emotional after: **deliberate departure, and the world's two-word reply** — the
  first fully chosen act of travel, answered not with pursuit or absolution but
  with `CONTACT LOGGED.` — a row in a table. The register the game has spoken
  since `QUESTIONS ....... 0`.
- Story information conveyed: the restored transponder was noticed; the registry
  demands a designation; none can be returned; the query stays open. This is an
  **automated handshake noticing a hull** — never the refusal, the tree, or the
  worker's conduct.
- Intended ambiguity: what, exactly, the worker holds that "is not" a
  designation. Proven retained; never printed. And whether an open query is a
  threat, a bookmark, or a door.
- Tutorial/gameplay purpose: flight controls under narrative pressure; the
  `wait` verb as drama (the stack lands while the player drifts, hands on a
  live stick).
- Reality-stage ceiling: unchanged; copy-only.

### The both-readings law (binding on every line)

Every line below must simultaneously survive:

1. the **worker narrative** — a survivor of a bureaucratic dystopia rebuilds a
   wreck and leaves; and
2. the **hidden pillar** — the narrating intelligence is the route intelligence
   itself; the rebuilt ship is a re-embodiment; the network it reports to is the
   system that once ran the narrator. PLANT, NEVER TELL: no line may confirm
   the second reading, and no line may serve one reading by breaking the other.

Per line group:

- **`WRECK RELAY` headers** (ship telemetry, third regulation register, distinct
  from `W-7744` and `AUDIT NETWORK`): worker reading — a ship's dead systems
  reporting themselves restored; pillar reading — peripheral processes coming
  back online and resuming their reports to the network that made them. Carries
  **no first person** (`Bible:1194`).
- **ch7 bare awakening lines**: worker — a builder narrating labor; pillar — an
  intelligence rebuilding its own vehicle and accepting observability as the
  price of agency. Bare first person is legal (post-`i—`); lowercase; sensory;
  one thought per line.
- **`AUDIT NETWORK` stack**: worker — bureaucracy files a discrepancy about a
  hull logged destroyed; pillar — the index discovers an entity its schema has
  no field for. `NO DESIGNATION RETURNED.` is the registry's failure, not the
  worker's.
- **The designation caption**: worker — a person with no valid registration;
  pillar — a mind holding something name-like the index cannot store. It proves
  the thing from the naming interstitial was **retained** without printing,
  quoting, or attaching it. `UNREGISTERED DESIGNATION.` is *not* reused — that
  string stays with A8.
- Timelessness audit performed: no line pattern-matches a contemporary
  flashpoint; the satire target is filing, indexing, and schema.

## 3. Exact final copy (freeze verbatim in the contract)

All regulation lines route `showAuditLine(text, header)`; all awakening lines
route `showCaption(text)`. Order within a moment: audit line first, caption
second (regulation stamps, the voice answers).

### ch7-reconstruct — seven latched moments, eleven new strings, one changed string

**M1 — diagnosis receipt** (edge: `hasWreckDiagnosisReceipt` false→true; the
player's `[F] TRACE RELATIONSHIPS` commit). *The brackets fall here.*

- `WRECK RELAY` — `HULL AT SITE 7C-θ · FILED: TOTAL LOSS · FILE CLOSED`
- `the wreck that brought me here will leave here. i will build the leaving.`

**M2 — `bench_online`** (stage edge wrecked→bench_online):

- `the keel takes the weight first. everything after this is allowed to be heavy.`

**M3 — `frame_restored`** (stage edge):

- `it remembers a straight line and goes back to it without being told. i watch that closely.`

**M4 — `hull_sealed`** (stage edge):

- `WRECK RELAY` — `PRESSURE BOUNDARY HELD · PASSIVE BEACON RESTORED`
- `i closed it, and something inside started listening again. i did that too.`

**M5 — `lift_online`** (stage edge; the chapter's shipped capability gain):

- `WRECK RELAY` — `POWER BUS LIVE · TRANSPONDER ARMED`
- `the ground's hold is a habit, not a law.`

**M6 — `flight_ready`** (stage edge; the `LOGIC WAFER` install). *The turn.*

- `the last part is the part that thinks. i am being watched now. i put it in anyway.`

**M7 — calibration receipt** (edge: `hasReconstructionCalibrationReceipt`
false→true):

- `AUDIT NETWORK` — `UNSCHEDULED HULL · SITE 7C-θ · INTEREST RAISED`
- `nothing has asked yet. something has started paying attention.`

**Exit — one shipped string changes** (existing latch at
`emergentStoryDirector.ts:588-591`; owner-approved 2026-08-10):

- from: `(the scar remains. now it can carry you.)`
- to: `the scar remains. now it can carry me.`

Entry caption `(repair is not return.)` is **unchanged** and is the chapter's
last parenthesis.

### ch8-launch — six latched moments, ten new strings

**L1 — entry, at the controls** (first dwelled `ch8LaunchState ===
'surface-flight'`, objective `ch8:launch:ignite`):

- `the pond answered every time i asked. i am leaving anyway — that is what the answers were for.`

**L2 — `anc.launch.ignition`** (signed anchor authenticates when the player's
held `[SPACE]` creates a real launch sequence):

- `hold it. this is the only order left, and i am the one giving it.`

**L3 — `anc.launch.liftoff`** (signed anchor; physical outward departure):

- `the site gets small. the tree does not. i keep finding it.`

**L4 — `anc.launch.atmosphere-exit`** (signed anchor; `flight.phase` flips to
`deep_space`):

- `i came down this line without being asked. i am going back up it on purpose.`

**L5 — the consequence stack** (staggered on the single-slot audit band, in this
order, each replacing the last; cadence by named constants, see §6):

1. `AUDIT NETWORK` — `AUTOMATED CONTACT · SITE 7C-θ · HULL LOGGED: DESTROYED`
2. `AUDIT NETWORK` — `REGISTRY QUERY · STATE DESIGNATION.`
3. `AUDIT NETWORK` — `NO DESIGNATION RETURNED.`
4. `AUDIT NETWORK` — `CONTACT LOGGED.`

then, caption band:

- `they asked for a designation. what i have is not one.`
  *(routed for canon sign-off — the boundary between "the name evaporated" and
  "the name was spent". If the canon auditor rejects it, STOP per lock; do not
  reword unilaterally.)*

**L6 — the open query** (relationship: after the stack completes, over objective
`ch8:launch:orbital-handoff` / `DEEP SPACE · HANDOFF`):

- `nothing answers. the query does not close.`

Then the existing durable-fact advance to `ch8-crossing` proceeds.

No other strings anywhere change. The work-order string `IGNITE. LIFT. LEAVE
THE ATMOSPHERE.` stays unchanged **in code** (`emergentStoryDirector.ts:316`);
it is measured to never render in the shipped build (D8) and this run neither
fixes nor removes that — the rendered instruction channel is and remains the
objective work orders. No line frames the exit as a larger sky (A5 reserved).

## 4. Character and causal spine

| Character/presence | Desire | Opposition | Tactic | Belief before | Belief after | Player-visible evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Worker 9 (embodied voice) | Leave, without undoing what was refused | Every restored system makes it visible to the system it refused | Build anyway; accept being indexed as the price | Repair is private; the wreck is mine | Visibility was chosen, not suffered; departure is authored, not permitted | ch7 bare lines M1–M7; `i put it in anyway.`; ch8 L1–L4 |
| WRECK RELAY (restored ship, third register) | None — it reports because that is what a live system does | — | Telemetry | (dead) | (reporting) | Three header lines M1/M4/M5; no first person |
| AUDIT NETWORK (automated filer, est. a4-exhale) | Schema completeness | An entity with no valid field | Query, then log | Site 7C-θ is a closed file | An unresolvable open row exists | M7 line; ch8 stack; `CONTACT LOGGED.` |
| The Authority | (absent) | — | — | — | — | Deliberately none — its answer is reserved |

Causal chain the player can reconstruct: refusal (ch4) → filed floor → wreck
diagnosis reopens a closed file (M1) → beacon (M4) → transponder (M5) → the
thinking part installed knowingly (M6) → interest raised (M7) → automated
contact on atmosphere exit (L5) → open query (L6). Being noticed is a
consequence of the player's own ten actions, not an ambush.

## 5. Reveal and payoff ledger

| ID | Truth or question | Level before | Level after | Setup refs | Payoff refs | Leak/understatement risk |
| --- | --- | --- | --- | --- | --- | --- |
| `voice-one-way-exit` | The embodied voice drops parenthetical grammar for good | author-only (Bible:1185; shipped drift) | visible (M1 onward) | `(repair is not return.)` as last parenthesis | every later bare line | flicker risk from out-of-scope interleaved parentheticals — see D5 |
| `ship-reports-you` | Restored systems report to the network | author-only | inferred (M4→M5→M7→L5 chain) | ch4 relay (`WRECK RELAY · REPORT`) | `CONTACT LOGGED.` | over-explaining would collapse menace into plot; keep telemetry flat |
| `name-retained` | Something name-like was kept; the index has no field for it | open (reader saw it "evaporate") | inferred, unprinted | naming interstitial `(retained.)` | A8 first-return of the typed name (reserved) | **the** risk: canon auditor must confirm this does not spend A8 |
| `authority-answer` | What the Authority itself says to the refusal | reserved | reserved (untouched) | — | reserved payoff | stack must stay automated — no rank-issued "I", no address to conduct |
| `hidden-pillar` | The narrator is the route intelligence | author-only | author-only | lowercase intrusions, ADVISORY seeds | A7/A8 budget | every line here passed the both-readings test in §2 |

## 6. Beat and agency ledger

| Beat | Shared anchor | Event | Cause/payoff refs | Agency type and mandatory path | Fallback/rescue semantics | Required hand-back | Acceptance signal |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ch7-reconstruct | `anchor.ch7.brackets-fall` (M1) | diagnosis receipt commit | reopens ch4's closed file | player `[F]` interact; mandatory | none needed (existing guidance loop) | none — control never leaves player | audit line + first bare caption |
| ch7-reconstruct | stage edges M2–M5 | `ship_repair_stage {from,to}` | craft/install transactions | player craft/interact; mandatory | existing | none | caption (and audit line at M4/M5) per stage, once |
| ch7-reconstruct | `anchor.ch7.anyway` (M6) | `flight_ready` commit | the turn: cost known, act chosen | player interact; mandatory | existing | none | M6 caption, once |
| ch7-reconstruct | M7 + exit | calibration receipt → exit hold → advance (0.65 s shipped; extension to ≈5 s proposed, D9) | interest raised; scar carries | `wait` (existing); M7 lands during `cin.reconstruct.09-one-exterior-reveal` | existing timeout behavior | existing | changed exit string, then ch7-board |
| ch8-launch | L1 | first dwelled `surface-flight` | thirst payoff (the pond) | player seated at controls | if player never exits ship, this is the entry state | none | pond caption, once |
| ch8-launch | `anc.launch.ignition` (L2) | signed anchor authenticates | the only order left | player holds `[SPACE]`; mandatory | movie autopilot already drives launch | none | L2 caption, once |
| ch8-launch | `anc.launch.liftoff` (L3) | physical outward departure | the refusal paid off from the air | player holds course | anchor is physics-gated, not timer-gated | none | L3 caption, once |
| ch8-launch | `anc.launch.atmosphere-exit` (L4–L6) | anchor + staggered stack + bounded hold | the world's reply; open query | `wait` over live flight controls (existing objective `ch8:launch:orbital-handoff`) | stack cadence must complete well inside ch8-launch's movie timeout; a timeout rescue does NOT count as completion | beat advance to ch8-crossing on the same durable fact (`deep_space`) after the stack window | `CONTACT LOGGED.` visible ≥ its full cadence slot before `(there is another world here…)` |

**Latch semantics (binding, and the whole content of the permitted tests):**

- Every latch is **edge-triggered on a live-observed transition**, never
  level-triggered on state. On beat entry (deep link `?story=…`, save resume,
  replay), latches seed to the *current* stage/anchor set **without firing**: a
  mid-chapter resume must not replay past lines, and a burst of catch-up
  captions is a defect. (`?story=` boots seed ch7 at `wrecked`, so a fresh jump
  plays all lines naturally.)
- Each line fires **at most once per beat entry**; the single-slot bands mean
  ordering inside a moment is fixed (audit → caption) and sequential stack
  lines replace one another on a named-constant cadence, each line holding the
  band long enough to be read (mobile-parity legibility is a lock requirement).
- Reduced motion changes nothing structurally (text with TTLs), but any timed
  cadence must have its reduced-motion variant recorded as evidence per lock.
- Cutscene-scoped state: none added. No input policy change; `SANDBOX_POLICY`
  untouched; zero strings render when story is inactive (prime directive holds
  trivially — copy-only, story-gated call sites).
- Movie-mode expectation (not a defect): `&movie=1` compresses ch7's
  diagnose→`flight_ready` into ~4 s, so M1–M6 captions will overwrite each
  other rapidly on the single caption slot. Each line still fires exactly once
  and in order; strips will catch the latest line per sample. Manual-pace
  legibility is the design target; movie mode proves flow, not pacing.

**The ch8 exit-pacing requirement (contract-level; ruled carriable by the
orchestrator, R2):** as shipped, `tickLaunch()` advances to `ch8-crossing` the
same tick `deep_space` is observed (`emergentStoryDirector.ts:627-640`), and
`ch8-crossing` immediately posts its own caption (`:320`). Worse, the
atmosphere-exit anchor notifies listeners **in the same synchronous moment**
`phase: 'deep_space'` makes the advance predicate true
(`spaceFlight.ts:391-392`), so a ch8-launch-scoped latch has at most one
director tick before `enterEmergentStoryBeat` clears the latch set. **The
bounded hold is therefore the load-bearing dependency of the entire L4–L6
commission** — without it, no launch-scoped latch can even observe the anchor
before its own state is destroyed. The advance keeps its exact durable fact
(`deep_space`) and gains a named-constant window while L4–L6 land. This is the
same shipped pattern as ch7's 0.65 s `completionObservedAt` hold (`:588-594`)
and the file's own doctrine ("timers provide breathing room after a committed
act; they never substitute for it", `:346-349`).

**Cadence semantics (freeze these in the contract; there is no line queue or
scheduler anywhere in the runtime — `storyText.ts` is one caption slot plus one
audit slot with instant overwrite):** on the first tick where
`flight.phase === 'deep_space'` is observed, `tickLaunch()` records the moment
in beat-runtime state (e.g. `launchExitObservedAt = runtime.elapsed` — a
runtime field, not persistence) and fires L4. Every subsequent line is a
per-tick elapsed-time latch inside the hold window, firing once when
`runtime.elapsed - launchExitObservedAt` passes its named offset constant.
Proposed defaults (owner-tunable named constants; the contract freezes the
**relationships and the interval values**, and every value must respect the
single-slot bands — each line owns its band until the next offset):

| Offset constant (from atmosphere exit) | Fires |
| --- | --- |
| `+0.0 s` | L4 caption |
| `+2.5 s` | stack 1 — `AUTOMATED CONTACT …` |
| `+5.0 s` | stack 2 — `REGISTRY QUERY · STATE DESIGNATION.` |
| `+7.5 s` | stack 3 — `NO DESIGNATION RETURNED.` |
| `+10.0 s` | stack 4 — `CONTACT LOGGED.` (`anchor.ch8.contact-logged`) |
| `+12.5 s` | designation caption |
| `+15.0 s` | L6 — `nothing answers. the query does not close.` |
| `+17.0 s` | advance to `ch8-crossing` |

**Variant D decision — (a), carried by the hold.** The shipped baseline proves
objective variant D (`ch8:launch:orbital-handoff`, `DEEP SPACE · HANDOFF`) is
**unreachable** today: publishing it needs 1.75 s of dwell
(`CH8_FLIGHT_GUIDANCE_DWELL_SECONDS`, `flightGuidanceDwell.model.ts:22`) and
the beat ends on the first `deep_space` tick. The hold window makes the dwell
accrue, so variant D publishes at ~1.75 s into the window — before stack 1
lands — and L6 plays over it as intended. This is a deliberate, contract-
recorded consequence: the hold **restores an authored objective's screen life**
(it resolves the baseline's defect 3 as a side effect); it does not add,
rename, or re-copy any objective. Verification must trace
`ch8:launch:orbital-handoff` actually publishing inside the hold window across
≥3 cold runs, and movie runs must show honest completion well inside
`BEAT_TIMEOUT` with zero timeout rescues.

**The ch7 exit line's screen life (measured; contract decision required):** the
baseline observed the shipped exit caption being **overwritten mid-typewriter
0.2 s after the beat change** by ch7-board's entry parenthetical — with the
existing 0.65 s hold, the owner-approved string `the scar remains. now it can
carry me.` would get ≈0.85 s of screen life. That defeats the approved change.
Two levers exist inside the allowed file: accept the truncation, or extend the
existing named hold constant at `emergentStoryDirector.ts:592` (0.65 s → ≈5 s,
one caption TTL) under the same reasoning as R2 (bounded, allowed file,
pacing-only, same durable advance fact). **I propose the extension as a
contract term; it requires triad signature — it is not assumed.** The
re-bracketing that follows at ch7-board entry remains accepted known drift
per R1 regardless of this choice (see D5/D9).

**Implementation observation route (integration's choice, but bounded):** the
three launch anchors live in protected files
(`generatedSceneAvRuntime.json`, fired from `ShipController.tsx` /
`VehicleSceneAvDriver.tsx`). The director must observe them **read-only** —
e.g. edges of `getSignedSceneAvDebugSnapshot().activatedAnchorIds` /
`anchorId`, or `subscribeSignedSceneAv` (`signedSceneAvRuntime.ts:130-172,
:793`) — or latch on the identical physical facts already exported by
unprotected state (`subscribeAtmosphereExit`, `spaceFlight.ts:193`). No
protected file changes; no duplicated physics predicates that could drift from
the anchors.

## 7. Guided play — this run adds NOTHING to the objective system

Per `main/src/story/ux/README.md`: **no new objective IDs, no new markers, no
work-order changes, no lifecycle changes.** All new copy is caption/audit-band
material and is never the only instruction for any action. The shipped
lifecycle these lines decorate, for the auditor's baseline:

- ch7: `reconstruct:diagnose` (`WRECK SCAR · TRACE RELATIONSHIPS`),
  `reconstruct:repair:[stage]` / `reconstruct:craft:[stage]` (`WRECK BENCH ·
  [VERB]` / `WRECK BENCH · CRAFT [PART]`), `reconstruct:calibrating`
  (`KESTREL · CALIBRATING`), `reconstruct:ready` (`WRECK · FLIGHT READY`).
- ch8-launch: `ch8:launch:reboard` (`KESTREL HATCH · REBOARD`),
  `ch8:launch:ignite` (`KESTREL FLIGHT CONTROLS · IGNITE`),
  `ch8:launch:climb` (`ATMOSPHERIC EXIT · CLIMB`), `ch8:launch:orbital-handoff`
  (`DEEP SPACE · HANDOFF`).

Marker-label parity, entry acknowledgements, progress/completion responses, and
clear/replace transitions are shipped behavior and must be proven **undisturbed**
(`npm --prefix main run story:ux:check` plus the lifecycle trace across deep
link, replay, pause/focus, mobile, reduced motion, low tier). The only
lifecycle-adjacent change is the ch8 exit hold in §6, which restores the screen
life of an existing objective without changing its identity or copy.

**Pre-existing shipped UX defect adjacent to this run's copy (recorded so the
player-experience-auditor sees it was known and routed, not introduced):**
objective `reconstruct:repair:bench_online` covers two different player actions
— claim salvage, then install the keel workbench — under one objective ID, so
`activateGuidedStoryObjective`'s id-equality guard suppresses the republish and
the HUD keeps showing `WRECK BENCH · RECOVER WRECK SALVAGE` while the required
action is `[F] INSTALL KEEL WORKBENCH` (violates `ux/README.md` guardrails 1
and 3; appears exactly on the common path where the player can afford the
install immediately). The M2 caption fires on the `bench_online` **stage
edge** — the install commit — so it sits next to, and is unaffected by, the
stale label. Out of this run's mutation scope; escalated for a follow-on, not
repaired here.

## 8. Constraints and questions for Score

The lock makes Score **ruling-only** this run: no score/audio code mutation;
protected paths stay protected. Within that:

- ch7 already resolves eight gameplay-derived variants
  (`diagnosis | bench | frame | hull | lift | hover | route | calibration`) via
  `resolveChapter7ReconstructionScoreVariant`, synced per-frame from
  `tickReconstruction` (`emergentStoryDirector.ts:563-572`) — the new captions
  land on the **same stage edges the score already hears**. I am not asking for
  a new ramp. Precision on the exclusion (corrected from the treatment): ch7 is
  **fully on the signed AV rail** — its eight `anc.reconstruct.*` anchors carry
  score cue refs (`sc.reconstruct.one-instrument` on every stage anchor) —
  and only **signed score intensity** is excluded by name
  (`scoreIntensityFor()` returns `null` for ch7-reconstruct/ch7-board,
  `signedSceneAvRuntime.ts:349-353`), which is what keeps the eight
  gameplay-derived moods player-driven. I respect that score-intensity
  exclusion; whether the cue/mood interplay at the new caption moments needs
  anything is **your ruling**, not my ask.
- Intent I ask you to preserve or rule on: `hull`, `lift`, and `calibration`
  should **sharpen rather than swell** — the chapter's dread is being indexed,
  not scored-at. If the shipped variants already read that way, rule so; if
  not, route a separate packet rather than mutate here.
- `CONTACT LOGGED.` wants **near-silence** — the two words should land in the
  emptiest air the beat has. ch8-launch is not in your owned-beats set, so its
  three anchors run the generic ramp: whether that ramp's state at the
  atmosphere-exit window already provides the near-silence, and whether the
  §6 stack cadence (a ~17 s held window, `anchor.ch8.contact-logged` at
  +10.0 s) fits it, **is your ruling**. For reference the baseline measured
  signed intensity 0.4375 → 0.42 → 0.35 across the shipped launch-exit →
  crossing-entry seam. Combined-bus render evidence only if your ruling
  requires proof (per lock).
- Named sync anchors you may cue against (relationships, not timestamps):
  `anchor.ch7.brackets-fall` (M1), `anchor.ch7.anyway` (M6),
  `anchor.ch8.contact-logged` (stack line 4), `anchor.ch8.open-query` (L6).
- Deliberate silence intent: L6 is an *absence staged as content* — nothing
  answers. Do not fill it.

## 9. Constraints and questions for Cinematography

The lock forbids camera/render mutation this run: your lane is
ruling/verification, or routing a separate packet. Within that:

- **The liftoff question, raised not answered:** at `anc.launch.liftoff` (shot
  `cin.launch.02-world-below`) the line is `the site gets small. the tree does
  not. i keep finding it.` If the hero tree is not findable from altitude in
  the shipped liftoff framing, the line is a lie. Rule on findability from the
  shipped frames; if the framing fails the line, route a separate camera
  packet — the line's text is frozen before its shot, deliberately, because
  the payoff (the refusal seen from the air) is story truth, not shot
  convenience.
- **M7 lands inside an authored camera moment** (corrected from the treatment:
  ch7 is fully on the signed rail, not excluded from it): the calibration
  anchor `anc.reconstruct.calibration` carries
  `cin.reconstruct.09-one-exterior-reveal`, `cinematic-look` at 52° — the
  chapter's only non-player-camera shot. The M7 audit line (`AUDIT NETWORK ·
  UNSCHEDULED HULL …`) and caption arrive during that exterior reveal. Rule on
  whether the audit band (fixed at `top: 13.5%`, below the letterbox line) and
  the bottom-centre caption read cleanly over that shot, and whether the copy
  timing honors the reveal rather than stepping on it. No shot change is in
  scope; if the reveal and the copy fight, that is a routed packet or a cadence
  note back to me.
- Context you can rely on: all three launch shots are `lens-rig` authority and
  `numericLensAuthorized()` refuses their declared FOVs (`appliedFovDeg` null
  throughout — flight feedback owns FOV), so no copy timing here interacts
  with a lens move.
- Verify caption/audit-band **legibility over launch visuals** (bright sky →
  space gradient) at LOW strips and mobile parity, and the ch6-exit / ch7 /
  ch7-board / ch8 / ch8-crossing continuity strips per lock capture density.
- The §6 stack window is a held, player-controlled drift — no letterboxing, no
  agency change; if you believe the window needs framing support, that is a
  routed packet, not a note that blocks this contract.
- Nothing in this run changes palette, grade, FOV, rigs, or effects.

## 10. Deltas from treatment (shipped code and measured baseline vs. the accepted design-run text)

- **D1 — ch8-launch exits instantly at `deep_space`** (`tickLaunch`,
  `emergentStoryDirector.ts:627-640`), and `ch8-crossing` posts its caption on
  entry (`:320`). The verifier further measured that the atmosphere-exit anchor
  notifies in the **same synchronous moment** the advance predicate becomes
  true (`spaceFlight.ts:391-392`) — a launch-scoped latch gets at most one
  director tick. The treatment's "then the consequence stack" is
  unimplementable without the bounded hold specified in §6. **Ruled R2: the
  contract may carry the hold** (~15–17 s, named constants, allowed file);
  it is now an explicit contract term (same durable fact, named-constant
  window, cadence table in §6).
- **D2 — single-slot caption/audit bands** (`storyText.ts:77-91`): the stack
  cannot pile lines; it must cadence, each line replacing the last. Adapted
  into §6. (This also serves the register: regulation stamps one row at a
  time.)
- **D3 — `WRECK RELAY` is not a wholly new token.** It already exists as ch4
  marker labels (`WRECK RELAY · REPORT` / `· REMAIN`,
  `storyObjectiveGuidance.ts:360`, `storyDirector.ts:2439`). New only as an
  audit-band *header*. This strengthens the device — the reporting relay is an
  object the player has already stood at.
- **D4 — exact string counts (corrected per audit F9, hygiene-02):** the
  lock's shorthand "ten lines" resolves to: ch7 = eleven new strings (seven
  awakening captions + four regulation lines) plus one owner-approved changed
  string; ch8 = ten new strings (six captions — L1, L2, L3, L4, the
  designation line, L6 — + four regulation rows). Total: 21 new strings + 1
  changed. The contract freezes the §3 enumeration, not the shorthand.
- **D5 — interleaved parentheticals sit inside the one-way voice window but
  outside the locked beats.** `ch7-board` opens with `(the wreck is waiting for
  an owner.)` (`emergentStoryDirector.ts:313`) and `ch8-crossing` with
  `(there is another world here. it was always here.)` (`:320`) — both between
  the M1 bracket-fall and the ch8 bare lines. **Ruled R1: ACCEPTED KNOWN DRIFT
  this run** — scope is not expanded; escalated with ch5/ch6/ch9; the owner is
  informed and may approve de-bracketing later as a repair-loop fold-in.
  **Measured severity, stated plainly for reviewers and for the escalation
  record:** ch7-board's parenthetical arrives **0.2 s after** the ch7 exit
  caption, overwriting it mid-typewriter — the bracket-fall is visibly
  re-bracketed almost immediately at the chapter seam. Within the two locked
  beats the one-way exit is fully coherent; across the seam the voice flickers
  until the follow-on lands. This is known, ruled, and routed — not an
  oversight for the naive viewer or cohesion judge to rediscover as new.
- **D6 — diagnosis prompt exact strings:** marker `WRECK SCAR · TRACE
  RELATIONSHIPS`, interaction `Trace Wreck Relationships` (treatment's
  shorthand "Trace Relationships" corrected).
- **D7 — objective variant D is unreachable in shipped code** (baseline defect
  3: `ch8:launch:orbital-handoff` needs 1.75 s of dwell; the beat ends on the
  first `deep_space` tick). Decision recorded in §6: **(a) carried by the
  hold** — the R2 window makes the dwell accrue, variant D publishes ~1.75 s
  in, and L6 plays over it. No objective is added or re-copied; an authored
  objective regains its screen life, verified by lifecycle trace.
- **D8 — the ch8-launch entry work order never renders.** The treatment's
  claim that `IGNITE. LIFT. LEAVE THE ATMOSPHERE.` "stays" was false in
  practice: `syncEmergentObjectiveGuidance()` overwrites it inside the same
  `enterEmergentStoryBeat()` call, before React paints (same shape at
  ch8-crossing and ch8-landfall). The string stays unchanged in code; the
  intent no longer asserts it renders, and changing the guidance sync is out of
  scope.
- **D9 — the ch7 exit line's measured screen life is ≈0.85 s** (0.65 s hold +
  0.2 s to the ch7-board overwrite), which would defeat the owner-approved
  string change. §6 proposes extending the existing named hold constant
  (`emergentStoryDirector.ts:592`) under the R2 precedent, **subject to triad
  signature** — not assumed.
- **D10 — "ch7 excluded from the signed AV ramp" was imprecise.** ch7 is fully
  on the signed rail — eight `anc.reconstruct.*` anchors, nine shots, live
  PostFX, and `cin.reconstruct.09-one-exterior-reveal` (`cinematic-look`, 52°)
  parked at the calibration anchor, exactly where M7 lands. Only signed
  **score intensity** is excluded by name (`signedSceneAvRuntime.ts:349-353`).
  §8 and §9 carry the corrected framing to both peers.
- **D11 — pre-existing UX defect adjacent to M2:**
  `reconstruct:repair:bench_online` covers two player actions under one ID, so
  the HUD label goes stale on the common path (`ux/README.md` guardrails 1 and
  3). Recorded in §7 as shipped, out of scope, routed — not introduced by this
  run.
- **D12 — the wreck relay prop's beacon is dark during ch7/ch8** (lit only for
  ch3-signal/ch4-vigil/ch4-arrival/done). The `WRECK RELAY` header copy
  attributes every restored system to the hull, so no visual contradiction
  arises; implementation and review must not expect (or add) a relay light.
- Treatment citations `tickReconstruction` `:559-595` and the three
  `anc.launch.*` anchors verified exact at HEAD `03e975a`. No other deltas.

## 11. Non-goals and protected strengths

Non-goals (binding): no new `stateRef`, milestone, or persistence; captions are
not stateRefs; no registry/journey-contract change; **no printed worker name
and no `{name}` substitution anywhere**; no score/audio mutation; no
camera/render mutation; no ch5/ch6/ch9 caption changes (and no ch7-board /
ch8-crossing caption changes — accepted known drift per ruling R1, see D5); no
new objectives, markers, or
work-order copy; no A5 framing ("larger sky") at atmosphere exit; no reuse of
`UNREGISTERED DESIGNATION.`; no new institutions or rank-issued first person in
regulation lines.

Protected strengths (do not flatten): the reserved payoffs — A5/Light,
W-7744's return, the Authority's answer, Worker 9's legibility, the typed
name's A8 first-return; the naming interstitial `(retained.)`; the refusal;
ch4-vigil star lines; ch7's eight gameplay-derived score variants and their
signed score-intensity exclusion (the lock's "signed-rail exclusion", made
precise in D10 — the rail's anchors/shots/PostFX are fully live in ch7);
`(repair is not return.)` as the last parenthesis; `CONTACT LOGGED.` staying
two words — do not decorate it.

## 12. Chapter Director disposition

`ready_for_independent_treatments` — grounded against HEAD `03e975a` **and
reconciled against the story-verifier's measured shipped baseline** (draft-v2);
all trigger facts exist in shipped code; both orchestrator rulings (R1
accepted-drift, R2 exit hold) are absorbed as contract terms; the Variant D
question is decided — (a), carried by the hold (D7); the one shipped-string
change carries a recorded owner decision; the §4 designation caption is flagged
for canon sign-off inside this cycle (stop condition on rejection). One item
remains for triad signature rather than discovery: the proposed ch7 exit-hold
extension (D9), without which the owner-approved string gets ≈0.85 s of screen
life.
