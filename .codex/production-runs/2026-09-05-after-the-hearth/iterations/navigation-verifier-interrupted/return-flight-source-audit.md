# ch13-return: Origin not landed within 240 s — read-only source audit

Recorded 2026-09-06T10:52-04:00 (14:52Z). Read-only mechanical auditor, opus.
**Not** an acceptance, not live physics, not a repair authorization, not a defect
finding. Companion: `return-flight-source-audit.json`.

All 98 manifest files rehashed **before** (10:48:14-04:00) and **after**
(see JSON) this audit against `implementation-source-manifest.json`: 98/98 match
both times, before == after. Nothing in `main/`, `docs/`, the contract, the
capture tree, `defects.json` or any verifier artifact was written. No build, no
browser, no GPU, no verify. The live verifier's earned-2 run was not touched.

Evidence classes used on every claim: **[C] captured** (bytes in
`verifier/captures/partial-continue/earned-1/`), **[S] source** (frozen file/line),
**[D] derived** (arithmetic on [C]+[S]), **[U] unproven** (needs live fields).

## What is captured, and what is missing

[C] `summary.json` `phases.earnedReturn`: `returnMs 240913`, `originLanded false`,
beat `ch13-return`, anchors `anc.cg.hatch-boarded` + `anc.cg.lift-committed`,
published rail plan `{action:"fly", target:null, interactionId:null,
reason:"crossing to Origin", arriveRadius:0.6}`, `worldBound:false`, ladder
objective `ch13:return:origin` at 4210 ms.
[C] `failure.json` — `PROBE-ERROR-INCONCLUSIVE`, `outcomeIsAcceptance:false`.
[C] The trace carries **no** `systemFlight.pose.position`, no `pose.velocity`,
no `systemFlight.target`, no `locationMode`. Those are exactly the fields the
chain below turns on, so this audit cannot close, only bound.

Seated-capsule note honoured: [S] `commonGroundDirector.ts:2516-2521` the `fly`
plan asserts only `controls.forward`; the body pose is *supposed* to be constant
in flight. The constant `bodyCentre [9.7516, 51.1486, -8]` across the ladder [C]
is therefore **not** evidence of stall and is not used as such anywhere here.

## Causal chain (file:line)

1. [S] `commonGroundDirector.ts:2270` — while in flight and `!onOrigin()`, the
   ch13 rail can only ever publish `fly`. It reaches `land` (`:2265`) or
   `exit-ship` (`:2262`) **only** after `onOrigin()` flips.
2. [S] `commonGroundDirector.ts:804-806` — `onOrigin()` is exactly
   `getSystemFlightSnapshot().activePlanetId === STORY_PRIMARY_WORLD_ID`
   (`'-1,-1'`, [S] `tidegardenRoute.ts:12-15`). It reads a store, never a
   distance, never a marker.
3. [S] `commonGroundDirector.ts:862-869` (`tickReturn`) — `if (!onOrigin()) return;`
   guards *everything*: the milestone `ch13OriginLanded`, `anc.cg.origin-landed`
   and `advanceToBeat('ch13-survey')`. So the whole beat has **one** choke point.
4. [S] `activePlanetId` is only rewritten by the same-system handoff commit
   driven from `components/SystemTravelDriver.tsx:108-260`. Its gate requires,
   per frame: `enabled`, `phase==='deep_space'`, `controlMode==='flight'`
   (`:128-133`), a body inside a **6°** aim cone of *camera* forward
   (`systemBodyTargeting.ts:41-84`, `DEFAULT_SYSTEM_BODY_AIM_CONE_RADIANS` `:3`),
   `targetReady` (`App.tsx:1244-1251`, a worldgen-cache hit), and
   `isWithinSystemActivationEnvelope` (`systemTravelDriverModel.ts:68-79`).
5. [D] With [S] `starSystem.ts:74` `NOMINAL_PLANET_FACE_RADIUS = 50` and [S]
   `systemTravelDriverModel.ts:1` `DEFAULT_SYSTEM_ATMOSPHERE_ENVELOPE = 135`,
   activation demands **centre distance ≤ 185**.
6. [S] `SystemTravelDriver.tsx:194-199` publishes the approach-assist target with
   `ready: targetReady`. [S] `state/systemTravelAssist.ts:47-50`: while
   `ready === false` the permitted inward speed is
   `clamp((d − 300) · 0.65, 0, 320)` — i.e. **the ship is hard-held at 300 units**
   and can never reach the 185 activation shell. [S] ShipController.tsx:899-925
   applies that clamp by subtracting the excess inward component every frame,
   in `deep_space` only.

**Bounded candidate (A):** the crossing is executed correctly and the ship parks
on the *unready* approach shell at ~300 system units from Origin centre, so
`activePlanetId` never changes, `onOrigin()` stays false, the rail never leaves
`fly`, and no landing is possible inside any budget. [D] from [S] 4-6; **[U]**
until a live centre distance exists.

**Sub-candidate (B), same choke point:** `SystemTravelDriver.tsx:238-240` cancels
the lock the moment the 6° cone is lost, and the cancel path calls
`cancelPreparationRef.current?.()` → [S] `App.tsx:1238-1241` bumps
`worldPrepGenerationRef` and cancels the worker. [S] `App.tsx:1215-1222` makes a
cancelled preparation resolve `false`. A cone that flickers therefore restarts
preparation forever and `targetReady` never latches — producing the *same*
observable as (A). [U].

Both are consistent with the final frame [C] `deep_space` / `flight` /
"FLIGHT CORRIDOR ACQUIRED": the corridor readout is the *lock*, not the arrival.

## Possible contract mismatch / implementation omission

- **Omission, ch13-side:** [S] `commonGroundDirector.ts:2432-2461`
  (`CommonGroundRailContext`) exposes no aim/attitude primitive at all. Bearing
  for ch13-return comes only from [S] `autopilot/primitives.ts:277-283, 393-404`
  (`FLIGHT_DIRECTIVE_BEATS` contains `ch13-return`; `targetWorldId` →
  `'-1,-1'` until it encloses) consumed at [S] `ShipController.tsx:789-830`. That
  path is present and looks correct; what is **not** present anywhere in the ch13
  lane is any handling of, or telemetry for, the *unready-hold* state of step 6.
  The rail's own vocabulary has no term between `fly` and `land`.
- **Mismatch risk, contract-side:** the 240 000 ms budget in the earned probe is
  not derived from any source constant; steps 5-6 admit a legitimate wait whose
  length is bounded by worldgen preparation, not by flight time. [D]

## Ruled out from source (with the reason)

- **Speed / distance budget.** [S] `starSystem.ts:213-224`: slot-1 radius is
  `2200 + u·1100`, slot 0 sits at `[0,0,0]`; [S] `ShipController.tsx:89`
  `MAX_SPEED = 320` is clamped *independently of boost* (`:896-898`). [D]
  crossing ≈ 7-11 s of cruise. 240 s is not a budget shortfall.
- **`sprint:false` in the ch13 `fly` case** ([S] `commonGroundDirector.ts:2520`)
  vs `sprint:true` on the proven ch10 return leg ([S] `rail-ch10-ask.ts:66-67`).
  [S] `BOOST_MULTIPLIER 3.2` multiplies **acceleration only**
  (`ShipController.tsx:86, 868, 886`); [D] it costs ≈ 4 s of spool, not 236 s.
  A real but non-causal divergence.
- **Tidegarden route offline / one-body manifest.** [S] `App.tsx:1104-1112,
  1144-1146` gate the two-body manifest and `systemTravelEnabled` on the route
  milestone; [S] `storyState.ts:568-571` seeds `repairStage:'flight_ready'` for
  every beat ≥ `ch7-board`, and [S] `shipRestoration.ts:97,110,160` commits
  `TIDEGARDEN_ROUTE_MILESTONE` on that stage. ch13 beats are ≥ ch7-board, so the
  route is online in this deep link. [D]
- **World-id identity mismatch.** [S] `starSystem.ts:90-93` — slot 0 → `'-1,-1'`
  (seed `coordinateToSeed(-1,-1)`, quoted by root as 3215739679), slot 1 →
  `'-1,-1:p1'`. The movie manifest ([S] `ShipController.tsx:340-343`,
  `bodyCountOverride: 2`) therefore *does* contain the descriptor
  `targetWorldId` names. No lookup miss.
- **Boarding / launch not earned.** [C] both `anc.cg.hatch-boarded` and
  `anc.cg.lift-committed` are present, and [S] `commonGroundDirector.ts:857-860`
  only notes `lift-committed` once `phase !== 'surface'` — the virtual `jump`
  reached ShipController, so the shared `controls` object is wired.
- **Seated capsule stillness.** Excluded by [S] `:2516-2521` as above; the flat
  `bodyCentre` is by design.
- **Departure world selection, marker distance, survey-fixture Continue.** Out of
  scope by commission; the 435 m Origin marker is marker-space and is
  arithmetically unrelated to the ≥185-unit celestial shells of step 5. [D]

## Uncertainty (what this audit cannot decide)

The trace omits every field that separates (A) from (B) from "the ship never
moved at all". Source alone cannot tell them apart, and **no defect is asserted**.
If the live centre distance turns out to fall below 185 with `targetReady true`
and `activePlanetId` still unchanged, both candidates above are wrong and the
fault moves into the handoff commit, which this audit did not read.

## Smallest live discriminator

One added telemetry sample per second in the already-running earned-2 lane — no
GPU, no source, no new build — reading only exported stores:

1. `getSystemFlightSnapshot().pose.position` and `.pose.velocity`
   → `d = |pose.position − [0,0,0]|` (Origin centre) and inward speed.
2. `getSystemFlightSnapshot().target` (`kind`/`worldId`) and `.locationMode`.
3. `getSystemTravelAssistTarget()` → `{worldId, ready}`.

Reading: `d` plateaus at ≈300 with `ready:false` ⇒ candidate (A)/(B) (then
`ready` flapping true/false, or `target` flapping null, separates B from A);
`d` ≈ constant 2200-3300 with `|v| ≈ 0` ⇒ neither, thrust/steering never
applied; `d < 185` with `ready:true` and `activePlanetId` unchanged ⇒ handoff.

## Smallest recommendation

Add only items 1-3 above to the earned-2 probe's per-second sample and re-run
that lane; change nothing in `main/`. Decide the candidate from those three
values before anyone opens a source repair. No repair is authorized here.
